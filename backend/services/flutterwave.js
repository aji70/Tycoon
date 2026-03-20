/**
 * Flutterwave integration for NGN perk bundle purchases.
 * - Initialize payment (get link to Flutterwave checkout)
 * - Verify webhook (verif-hash header)
 * - Verify transaction by id (optional, for webhook double-check)
 */
import logger from "../config/logger.js";

const FLW_SECRET = process.env.FLW_SECRET_KEY || "";
const FLW_BASE = "https://api.flutterwave.com/v3";
const FLW_DEFAULT_EMAIL = "realjaiboi70@gmail.com";
const FLW_DEFAULT_PHONE = "08060332714";

function isLikelyEmail(value) {
  if (!value) return false;
  const v = String(value).trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

/** Optional: full URL to your logo (e.g. https://yoursite.com/logo.png). Shown on Flutterwave checkout. */
function getCheckoutLogoUrl() {
  const fromEnv = process.env.FLW_LOGO_URL || process.env.FLUTTERWAVE_LOGO_URL;
  if (fromEnv && String(fromEnv).trim().startsWith("http")) return String(fromEnv).trim();
  const base = (process.env.FRONTEND_URL || process.env.PUBLIC_APP_URL || "").replace(/\/$/, "");
  if (base) return `${base}/game/rewardrealm.svg`;
  return null;
}

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
 * @param {Object} [customizations] - Optional override for title/description (e.g. { title: "Buy CELO", description: "..." })
 * @returns {Promise<{ link: string, tx_ref: string }>}
 */
export async function initializePayment({
  amountNaira,
  email,
  txRef,
  redirectUrl,
  meta = {},
  customerName,
  customizations: customizationsOverride,
}) {
  if (!isFlutterwaveConfigured()) {
    throw new Error("Flutterwave is not configured (FLW_SECRET_KEY)");
  }
  if (!redirectUrl || typeof redirectUrl !== "string" || !redirectUrl.startsWith("http")) {
    throw new Error("redirect_url is required and must be a valid URL");
  }
  const amount = Number(amountNaira);
  if (!Number.isFinite(amount) || amount < 200) {
    throw new Error("amount must be at least 200 Naira");
  }
  // Some guest usernames generate placeholder emails that Flutterwave rejects.
  // Fall back to a known-good sender email when the provided value is malformed.
  const customerEmail = isLikelyEmail(email) ? String(email).trim() : FLW_DEFAULT_EMAIL;
  const customerNameStr = (customerName && String(customerName).trim()) || "Tycoon Player";
  const defaultCustomizations = {
    title: "Tycoon — Perk Bundle",
    description: "Secure payment for your perk bundle. Your perks will be available in-game after purchase.",
    ...(getCheckoutLogoUrl() && { logo: getCheckoutLogoUrl() }),
  };
  const customizations =
    customizationsOverride && typeof customizationsOverride === "object" && Object.keys(customizationsOverride).length > 0
      ? { ...defaultCustomizations, ...customizationsOverride }
      : defaultCustomizations;
  // Match Flutterwave doc: tx_ref, amount (number), currency, redirect_url, customer (email, name, phonenumber)
  // payment_options: comma-separated, no spaces. amount as number for v3 compatibility.
  const amountRounded = Math.round(amount);
  const payload = {
    tx_ref: String(txRef),
    amount: amountRounded,
    currency: "NGN",
    redirect_url: String(redirectUrl),
    payment_options: "card,ussd,account",
    customer: {
      email: customerEmail,
      name: customerNameStr,
      phonenumber: String(FLW_DEFAULT_PHONE || "08000000000"),
    },
    customizations,
  };
  if (meta && typeof meta === "object" && Object.keys(meta).length > 0) {
    payload.meta = Object.fromEntries(
      Object.entries(meta).map(([k, v]) => [k, v == null ? "" : String(v)])
    );
  }

  logger.info(
    { amount: payload.amount, redirect_len: payload.redirect_url?.length, customer_email: payload.customer?.email?.slice(0, 20) },
    "Flutterwave payload (no secret)"
  );

  let res;
  let text;
  try {
    res = await fetch(`${FLW_BASE}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FLW_SECRET}`,
      },
      body: JSON.stringify(payload),
    });
    text = await res.text();
  } catch (networkErr) {
    const msg = networkErr?.message || String(networkErr);
    throw new Error(`Flutterwave request failed: ${msg}`);
  }

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    throw new Error(`Flutterwave returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }

  if (data.status !== "success" || !data.data?.link) {
    const msg = data.message || data.data?.message || "Flutterwave initialize failed";
    const validation =
      data.data?.validation_errors ||
      data.validation_errors ||
      data.error?.validation_errors ||
      [];
    const parts = Array.isArray(validation)
      ? validation.map((v) => v.field_name || v.field || v.message || String(v))
      : [];
    const detail = parts.length ? `${msg}: ${parts.join(", ")}` : msg;
    logger.warn({ flwStatus: res.status, flwResponse: data }, "Flutterwave payments API error");
    throw new Error(detail);
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

/**
 * Verify a transaction by tx_ref.
 * @param {string} txRef
 * @returns {Promise<{ status: string, amount: number, currency: string, tx_ref: string } | null>}
 */
export async function verifyTransactionByReference(txRef) {
  if (!isFlutterwaveConfigured() || !txRef) return null;
  const ref = encodeURIComponent(String(txRef));
  const res = await fetch(`${FLW_BASE}/transactions/verify_by_reference?tx_ref=${ref}`, {
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

/**
 * Create a transfer recipient (NGN bank account). Required before initiating a transfer.
 * @param {string} accountNumber - Nigerian bank account number
 * @param {string} bankCode - Flutterwave bank code (e.g. "044" for Access Bank)
 * @returns {Promise<{ recipientId: string }>}
 */
export async function createTransferRecipient(accountNumber, bankCode) {
  if (!isFlutterwaveConfigured()) throw new Error("Flutterwave is not configured (FLW_SECRET_KEY)");
  const an = String(accountNumber).trim();
  const bc = String(bankCode).trim();
  if (!an || !bc) throw new Error("account_number and bank_code are required");
  const res = await fetch(`${FLW_BASE}/beneficiaries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FLW_SECRET}`,
    },
    body: JSON.stringify({
      account_number: an,
      account_bank: bc,
      beneficiary_name: "Tycoon User",
      currency: "NGN",
    }),
  });
  const data = await res.json();
  if (data.status !== "success" || !data.data?.id) {
    const msg = data.message || data.data?.message || "Flutterwave create beneficiary failed";
    logger.warn({ flwResponse: data }, "Flutterwave beneficiaries API error");
    throw new Error(msg);
  }
  return { recipientId: data.data.id };
}

/**
 * Transfer NGN to a bank account (CELO→Naira payout).
 * Uses Flutterwave Transfers API. Your Flutterwave balance must be funded.
 * @param {string} accountNumber - Nigerian bank account number
 * @param {string} bankCode - Flutterwave bank code (e.g. "044")
 * @param {number} amountNaira - Amount in Naira (whole number)
 * @param {string} reference - Unique reference for idempotency (e.g. naira-withdraw-{userId}-{timestamp})
 * @param {string} [narration] - Transfer narration (e.g. "Tycoon CELO withdrawal")
 * @returns {Promise<{ transferId: number, status: string }>}
 */
export async function transferToBankAccount(accountNumber, bankCode, amountNaira, reference, narration = "Tycoon CELO withdrawal") {
  if (!isFlutterwaveConfigured()) throw new Error("Flutterwave is not configured (FLW_SECRET_KEY)");
  const amount = Math.round(Number(amountNaira));
  if (!Number.isFinite(amount) || amount < 100) throw new Error("amount must be at least 100 Naira");
  const ref = String(reference || `naira-${Date.now()}`).trim();
  const res = await fetch(`${FLW_BASE}/transfers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${FLW_SECRET}`,
    },
    body: JSON.stringify({
      account_bank: String(bankCode).trim(),
      account_number: String(accountNumber).trim(),
      amount,
      narration: String(narration).slice(0, 100),
      currency: "NGN",
      reference: ref,
      callback_url: process.env.FLW_TRANSFER_CALLBACK_URL || null,
    }),
  });
  const data = await res.json();
  if (data.status !== "success" || !data.data) {
    const msg = data.message || data.data?.message || "Flutterwave transfer failed";
    logger.warn({ flwResponse: data }, "Flutterwave transfers API error");
    throw new Error(msg);
  }
  const d = data.data;
  logger.info({ transferId: d.id, amount, reference: ref }, "Flutterwave transfer initiated");
  return { transferId: d.id, status: d.status || "NEW" };
}
