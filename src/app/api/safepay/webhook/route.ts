import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { verifySignature } from "@/lib/safepay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Safepay telling us whether the money arrived.
 *
 * This is the only authority on payment. The customer's browser coming back to
 * a success URL proves nothing — anyone can type that URL — so the order is
 * marked paid here and nowhere else.
 *
 * There is no session behind a webhook, so it uses the service role and is
 * authenticated by the signature instead: HMAC-SHA256 of the tracker under our
 * secret. An unsigned or wrongly-signed request is refused before it can touch
 * a row.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    tracker?: string;
    signature?: string;
    order_id?: string;
    reference_code?: string;
    // Safepay has used both spellings across versions.
    referenceCode?: string;
  } | null;

  const tracker = body?.tracker?.trim();
  const signature = body?.signature?.trim();

  if (!tracker || !signature) {
    return NextResponse.json({ error: "missing tracker or signature" }, { status: 400 });
  }

  if (!verifySignature(tracker, signature)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    // 500 rather than 200: Safepay retries on a server error, so a missing
    // key delays the update instead of silently losing the payment.
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false } }
  );

  const reference = body?.reference_code ?? body?.referenceCode ?? null;

  // Matched on the tracker we stored before redirecting. Only moves an order
  // that is still pending, so a repeated webhook — Safepay retries — cannot
  // overwrite a settled one or move it backwards.
  const { data: updated, error } = await supabase
    .from("orders")
    .update({
      payment_state: "paid",
      paid_at: new Date().toISOString(),
      payment_verified_at: new Date().toISOString(),
      status: "paid",
    })
    .eq("payment_tracker", tracker)
    .in("payment_state", ["pending", "unpaid"])
    .select("id, reference");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Nothing matched: either already settled, or a tracker we never issued.
  // Answering 200 stops Safepay retrying something that will never match.
  return NextResponse.json({
    ok: true,
    updated: updated?.length ?? 0,
    reference: updated?.[0]?.reference ?? reference,
  });
}
