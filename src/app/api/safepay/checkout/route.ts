import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkoutUrl, createTracker, safepayConfigured } from "@/lib/safepay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Sends an order to Safepay and redirects the customer to pay.
 *
 * The amount is read from the order row, never from the request: a price that
 * arrives from the browser is a price the browser can change, and the order
 * was already priced by the database when it was placed.
 */
export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("order");
  if (!orderId) {
    return NextResponse.redirect(new URL("/dashboard/orders", request.url));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/dashboard/orders", request.url));
  }

  // RLS already restricts this to the caller's own orders; the explicit filter
  // keeps the intent visible next to the query.
  const { data: order } = await supabase
    .from("orders")
    .select("id, reference, amount_pkr, payment_state, user_id")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!order) {
    return NextResponse.redirect(new URL("/dashboard/orders", request.url));
  }

  if (order.payment_state === "paid") {
    return NextResponse.redirect(new URL(`/dashboard/orders/${order.id}`, request.url));
  }

  if (!safepayConfigured()) {
    return NextResponse.redirect(
      new URL(`/dashboard/orders/${order.id}?pay=unconfigured`, request.url)
    );
  }

  try {
    const tracker = await createTracker(order.amount_pkr);

    // Recorded before the redirect: the webhook identifies an order only by
    // its tracker, and it can arrive before the customer's browser comes back.
    await supabase
      .from("orders")
      .update({
        payment_provider: "safepay",
        payment_tracker: tracker,
        payment_state: "pending",
      })
      .eq("id", order.id);

    const origin = new URL(request.url).origin;
    return NextResponse.redirect(
      checkoutUrl({
        tracker,
        orderRef: order.reference,
        redirectUrl: `${origin}/dashboard/orders/${order.id}?pay=done`,
        cancelUrl: `${origin}/dashboard/orders/${order.id}?pay=cancelled`,
      })
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "checkout-failed";
    return NextResponse.redirect(
      new URL(
        `/dashboard/orders/${order.id}?pay=error&reason=${encodeURIComponent(message.slice(0, 120))}`,
        request.url
      )
    );
  }
}
