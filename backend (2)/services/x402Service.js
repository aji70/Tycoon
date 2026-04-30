/**
 * x402 payment service for pay-per-use agent decisions.
 * Requires THIRDWEB_SECRET_KEY and X402_PAY_TO_ADDRESS.
 * See https://docs.celo.org/build-on-celo/build-with-ai/x402
 */

import { createThirdwebClient } from "thirdweb";
import { settlePayment, facilitator } from "thirdweb/x402";
import { celo } from "thirdweb/chains";
import logger from "../config/logger.js";

let _client = null;
let _facilitator = null;

function getClient() {
  if (!process.env.THIRDWEB_SECRET_KEY) return null;
  if (!_client) _client = createThirdwebClient({ secretKey: process.env.THIRDWEB_SECRET_KEY });
  return _client;
}

function getFacilitator() {
  const payTo = process.env.X402_PAY_TO_ADDRESS;
  if (!payTo || !payTo.startsWith("0x")) return null;
  const client = getClient();
  if (!client) return null;
  if (!_facilitator) {
    _facilitator = facilitator({
      client,
      serverWalletAddress: payTo,
    });
  }
  return _facilitator;
}

/**
 * Check if x402 is configured (THIRDWEB_SECRET_KEY + X402_PAY_TO_ADDRESS).
 */
export function isConfigured() {
  return !!(getClient() && getFacilitator());
}

/**
 * Settle x402 payment and return { status, responseBody?, responseHeaders? }.
 * If payment valid, status is 200. Otherwise 402 with payment requirements.
 * @param {object} opts - { resourceUrl, method, paymentData, price?, description? }
 */
export async function settlePaymentForRequest(opts) {
  const { resourceUrl, method = "POST", paymentData, price, description } = opts;
  const fac = getFacilitator();
  const payTo = process.env.X402_PAY_TO_ADDRESS;
  if (!fac || !payTo) {
    logger.warn("x402 not configured: THIRDWEB_SECRET_KEY and X402_PAY_TO_ADDRESS required");
    return { status: 503, responseBody: { error: "Payment service not configured" } };
  }

  const priceStr = price || process.env.X402_DECISION_PRICE || "$0.01";
  const routeConfig = {
    description: description || "Tycoon AI decision (buy/skip, trade, build)",
    mimeType: "application/json",
    maxTimeoutSeconds: 60 * 5,
  };

  try {
    const result = await settlePayment({
      resourceUrl,
      method,
      paymentData: paymentData || null,
      payTo,
      network: celo,
      price: priceStr,
      facilitator: fac,
      routeConfig,
    });
    return result;
  } catch (err) {
    logger.warn({ err: err?.message }, "x402 settlePayment failed");
    return { status: 500, responseBody: { error: "Payment verification failed" } };
  }
}
