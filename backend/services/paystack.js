/**
 * Paystack integration for NGN perk bundle purchases.
 * - Initialize transaction (get authorization_url)
 * - Verify webhook signature (HMAC SHA512)
 * - Verify transaction (optional, for frontend polling)
 */
import crypto from "crypto";

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || "";
const PAYSTACK_BASE = "https://api.paystack.co";

export function isPaystackConfigured() {
  return Boolean(PAYSTACK_SECRET && PAYSTACK_SECRET.startsWith("sk_"));
}

/**
 * Verify that the webhook payload was signed by Paystack.
 * @param {string} rawBody - Raw request body (string or Buffer)
 * @param {string} signature - x-paystack-signature header value
 * @returns {boolean}
 */
export function verifyWebhookSignature(rawBody, signature) {
  if (!PAYSTACK_SECRET || !signature) return false;
  const body = typeof rawBody === "string" ? rawBody : (rawBody && rawBody.toString ? rawBody.toString("utf8") : "");
  const hash = crypto.createHmac("sha512", PAYSTACK_SECRET).update(body).digest("hex");
  const a = Buffer.from(hash, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Initialize a Paystack transaction. Returns authorization_url and reference.
 * @param {Object} params
 * @param {number} amountKobo - Amount in kobo (e.g. 5000 = 50 NGN)
 * @param {string} email - Customer email
 * @param {string} [reference] - Optional custom reference (unique)
 * @param {string} [callbackUrl] - URL to redirect after payment
 * @param {Object} [metadata] - Custom metadata (e.g. { user_id, bundle_id })
 * @returns {Promise<{ authorization_url: string, reference: string, access_code: string }>}
 */
export async function initializeTransaction({
  amountKobo,
  email,
  reference,
  callbackUrl,
  metadata = {},
}) {
  if (!isPaystackConfigured()) {
    throw new Error("Paystack is not configured (PAYSTACK_SECRET_KEY)");
  }
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
    },
    body: JSON.stringify({
      amount: amountKobo,
      currency: "NGN",
      email,
      reference: reference || undefined,
      callback_url: callbackUrl || undefined,
      metadata: Object.keys(metadata).length ? metadata : undefined,
    }),
  });
  const data = await res.json();
  if (!data.status || !data.data) {
    throw new Error(data.message || "Paystack initialize failed");
  }
  return {
    authorization_url: data.data.authorization_url,
    reference: data.data.reference,
    access_code: data.data.access_code,
  };
}

/**
 * Verify a transaction by reference (for frontend polling / redirect page).
 * @param {string} reference - Paystack transaction reference
 * @returns {Promise<{ status: string, amount: number, metadata?: Object } | null>}
 */
export async function verifyTransaction(reference) {
  if (!isPaystackConfigured() || !reference) return null;
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
  });
  const data = await res.json();
  if (!data.status || !data.data) return null;
  const d = data.data;
  return {
    status: d.status,
    amount: d.amount,
    metadata: d.metadata || undefined,
  };
}
