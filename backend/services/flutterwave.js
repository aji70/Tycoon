/**
 * Flutterwave integration for NGN perk bundle purchases.
 * - Initialize payment (get link to Flutterwave checkout)
 * - Verify webhook (verif-hash header)
 * - Verify transaction by id (optional, for webhook double-check)
 */
const FLW_SECRET = process.env.FLW_SECRET_KEY || "";
const FLW_BASE = "https://api.flutterwave.com/v3";

export function isFlutterwaveConfigured() {
  return Boolean(FLW_SECRET && (FLW_SECRET.startsWith("FLWSECK_TEST-") || FLW_SECRET.startsWith("FLWSECK-")));
}

/**
 * Verify that the webhook request is from Flutterwave using verif-hash header.
 * @param {string} signature - verif-hash header value
 * @returns {boolean}
 */
export function verifyWebhookSignature(signature) {
  const secretHash = process.env.FLW_SECRET_HASH || "";
  if (!secretHash || !signature) return false;
  return signature === secretHash;
}

/**
 * Initialize a Flutterwave payment. Returns link for redirect.
 * @param {Object} params
 * @param {number} amountNaira - Amount in Naira (e.g. 50)
 * @param {string} email - Customer email
 * @param {string} txRef - Unique transaction reference
 * @param {string} [redirectUrl] - URL to redirect after payment
 * @param {Object} [meta] - Custom metadata (e.g. { user_id, bundle_id })
 * @param {string} [customerName] - Customer name
 * @returns {Promise<{ link: string, tx_ref: string }>}
 */
export async function initializePayment({
  amountNaira,
  email,
  txRef,
  redirectUrl,
  meta = {},
  customerName,
}) {
  if (!isFlutterwaveConfigured()) {
    throw new Error("Flutterwave is not configured (FLW_SECRET_KEY)");
  }
  const res = await fetch(`${FLW_BASE}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FLW_SECRET}`,
    },
    body: JSON.stringify({
      tx_ref: txRef,
      amount: Number(amountNaira),
      currency: "NGN",
      redirect_url: redirectUrl || undefined,
      customer: {
        email,
        name: customerName || "Tycoon Player",
      },
      customizations: {
        title: "Tycoon Perk Bundle",
        description: "Perk bundle purchase",
      },
      meta: Object.keys(meta).length ? meta : undefined,
    }),
  });
  const data = await res.json();
  if (data.status !== "success" || !data.data?.link) {
    throw new Error(data.message || data.data?.message || "Flutterwave initialize failed");
  }
  return {
    link: data.data.link,
    tx_ref: txRef,
  };
}

/**
 * Verify a transaction by id (e.g. from webhook data.id). Optional server-side check.
 * @param {number} transactionId - Flutterwave transaction id
 * @returns {Promise<{ status: string, amount: number, currency: string, tx_ref: string } | null>}
 */
export async function verifyTransactionById(transactionId) {
  if (!isFlutterwaveConfigured() || !transactionId) return null;
  const res = await fetch(`${FLW_BASE}/transactions/${transactionId}/verify`, {
    headers: { Authorization: `Bearer ${FLW_SECRET}` },
  });
  const data = await res.json();
  if (data.status !== "success" || !data.data) return null;
  const d = data.data;
  return {
    status: d.status,
    amount: d.amount,
    currency: d.currency,
    tx_ref: d.tx_ref,
  };
}
