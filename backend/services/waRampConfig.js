/**
 * WhatsApp USDC ↔ NGN ramp config (env-driven).
 * Enable with WA_RAMP_ENABLED=true (or set WHATSAPP_TOKEN).
 *
 * Phone numbers:
 * - WHATSAPP_PHONE_NUMBER_ID       = test / default
 * - WHATSAPP_PHONE_NUMBER_ID_LIVE  = production (preferred when set)
 * Inbound webhooks reply using the phone_number_id Meta sends in the payload.
 */

function num(name, fallback) {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function isWaRampEnabled() {
  if (process.env.WA_RAMP_ENABLED === "false") return false;
  if (process.env.WA_RAMP_ENABLED === "true") return true;
  return Boolean(
    process.env.WHATSAPP_TOKEN &&
      (process.env.WHATSAPP_PHONE_NUMBER_ID_LIVE || process.env.WHATSAPP_PHONE_NUMBER_ID)
  );
}

/** Prefer live ID when configured; else test/default. */
export function resolveWhatsAppPhoneNumberId(override) {
  if (override) return String(override);
  return (
    process.env.WHATSAPP_PHONE_NUMBER_ID_LIVE ||
    process.env.WHATSAPP_PHONE_NUMBER_ID ||
    ""
  );
}

export function getWaRampConfig() {
  return {
    whatsapp: {
      token: process.env.WHATSAPP_TOKEN || "",
      phoneNumberId: resolveWhatsAppPhoneNumberId(),
      phoneNumberIdTest: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
      phoneNumberIdLive: process.env.WHATSAPP_PHONE_NUMBER_ID_LIVE || "",
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "wa-ramp-verify",
    },
    celo: {
      rpcUrl: process.env.CELO_RPC_URL || process.env.WA_RAMP_CELO_RPC_URL || "https://forno.celo.org",
      depositAddress: process.env.WA_RAMP_CELO_DEPOSIT_ADDRESS || process.env.CELO_DEPOSIT_ADDRESS || "",
      usdcAddress:
        process.env.WA_RAMP_USDC_ADDRESS ||
        process.env.CELO_USDC_ADDRESS ||
        process.env.USDC_ADDRESS ||
        "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    },
    ngn: {
      bankName: process.env.WA_RAMP_NGN_BANK_NAME || process.env.NGN_BANK_NAME || "Opay",
      accountNumber: process.env.WA_RAMP_NGN_ACCOUNT_NUMBER || process.env.NGN_ACCOUNT_NUMBER || "",
      accountName: process.env.WA_RAMP_NGN_ACCOUNT_NAME || process.env.NGN_ACCOUNT_NAME || "",
    },
    rates: {
      sellNgn: num("WA_RAMP_RATE_SELL_NGN", num("RATE_SELL_NGN", 1550)),
      buyNgn: num("WA_RAMP_RATE_BUY_NGN", num("RATE_BUY_NGN", 1600)),
    },
    maxOrderUsdc: num("WA_RAMP_MAX_ORDER_USDC", num("MAX_ORDER_USDC", 1)),
    orderTtlMinutes: num("WA_RAMP_ORDER_TTL_MINUTES", num("ORDER_TTL_MINUTES", 20)),
    adminWhatsappNumber: (
      process.env.WA_RAMP_ADMIN_WHATSAPP_NUMBER ||
      process.env.ADMIN_WHATSAPP_NUMBER ||
      ""
    ).replace(/\D/g, ""),
  };
}
