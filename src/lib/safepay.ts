import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Safepay checkout.
 *
 * Two keys, and they are not interchangeable: the API key identifies the
 * merchant when opening a checkout session and is safe to send in a request
 * body, while the secret only ever signs and verifies webhooks and must never
 * leave the server. Mixing them up is how a merchant account gets drained, so
 * they are read from separate variables and used in exactly one place each.
 */
const ENV = process.env.SAFEPAY_ENV === "production" ? "production" : "sandbox";

const BASE =
  ENV === "production"
    ? "https://api.getsafepay.com"
    : "https://sandbox.api.getsafepay.com";

const API_KEY = process.env.SAFEPAY_API_KEY?.trim();
const SECRET = process.env.SAFEPAY_SECRET_KEY?.trim();

export function safepayConfigured(): boolean {
  return Boolean(API_KEY && SECRET);
}

/** What is missing, so the admin console can say so rather than just failing. */
export function safepayMissing(): string[] {
  return [
    !API_KEY ? "SAFEPAY_API_KEY" : null,
    !SECRET ? "SAFEPAY_SECRET_KEY" : null,
  ].filter(Boolean) as string[];
}

/**
 * Opens a checkout session and returns its tracker.
 *
 * The amount is sent in rupees, not paisa — Safepay's init takes the major
 * unit, and sending 160000 for a Rs.1,600 order would charge a hundred times
 * the price.
 */
export async function createTracker(amountPkr: number): Promise<string> {
  if (!API_KEY) throw new Error("Safepay is not configured (SAFEPAY_API_KEY).");

  const res = await fetch(`${BASE}/order/v1/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client: API_KEY,
      amount: amountPkr,
      currency: "PKR",
      environment: ENV,
    }),
    cache: "no-store",
  });

  const body = (await res.json().catch(() => null)) as
    | { data?: { token?: string }; message?: string }
    | null;

  if (!res.ok || !body?.data?.token) {
    throw new Error(body?.message || `Safepay refused the session (${res.status}).`);
  }

  return body.data.token;
}

/**
 * Where to send the customer to pay.
 *
 * `source` is a free-form label Safepay echoes back; it is not a credential.
 */
export function checkoutUrl(opts: {
  tracker: string;
  orderRef: string;
  redirectUrl: string;
  cancelUrl: string;
}): string {
  const params = new URLSearchParams({
    env: ENV,
    beacon: opts.tracker,
    source: "scorlyntap",
    order_id: opts.orderRef,
    redirect_url: opts.redirectUrl,
    cancel_url: opts.cancelUrl,
  });
  return `${BASE}/components?${params.toString()}`;
}

/**
 * Is this webhook really from Safepay?
 *
 * The signature is HMAC-SHA256 of the tracker under our secret. Compared with
 * a constant-time check: a plain === leaks how much of a forged signature was
 * correct, which is enough to guess the rest one byte at a time.
 */
export function verifySignature(tracker: string, signature: string): boolean {
  if (!SECRET || !tracker || !signature) return false;

  const expected = createHmac("sha256", SECRET).update(tracker).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");

  // timingSafeEqual throws on a length mismatch rather than returning false.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
