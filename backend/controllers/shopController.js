import logger from "../config/logger.js";

/**
 * GET /api/shop/bundles
 * List available shop bundles/packs
 * Returns pre-configured bundles with prices
 */
/**
 * Calculate NGN price with discount for purchases over 1000 NGN
 * Minimum purchase: 200 NGN
 * Discount: 20% off for amounts > 1000 NGN
 */
const calculateNgnPrice = (baseNgnPrice) => {
  const minNgnPurchase = 200;
  if (baseNgnPrice < minNgnPurchase) return minNgnPurchase;
  if (baseNgnPrice > 1000) return Math.round(baseNgnPrice * 0.8);
  return baseNgnPrice;
};

export async function listBundles(_req, res) {
  try {
    // Pre-configured bundles with pricing (these are stocked via the admin "stock all bundles" endpoint)
    // Naira conversion: 1 USDC = 1600 NGN
    const USDC_TO_NGN_RATE = 1600;
    const bundles = [
      { id: 1, name: "Starter Pack", description: "Shield, Roll Boost, and Exact Roll — great for new players.", price_tyc: "45", price_usdc: "2.5", price_ngn: calculateNgnPrice(Math.round(2.5 * USDC_TO_NGN_RATE)) },
      { id: 2, name: "Lucky Bundle", description: "Jail Free, Teleport, and Lucky 7. Get out of tight spots.", price_tyc: "60", price_usdc: "3", price_ngn: calculateNgnPrice(Math.round(3 * USDC_TO_NGN_RATE)) },
      { id: 3, name: "Defender Pack", description: "Shield, Jail Free, and Roll Boost. Stay in the game when the board turns against you.", price_tyc: "55", price_usdc: "2.75", price_ngn: calculateNgnPrice(Math.round(2.75 * USDC_TO_NGN_RATE)) },
      { id: 4, name: "High Roller", description: "Double Rent, Roll Boost, and Exact Roll. Maximize income and land where it hurts.", price_tyc: "65", price_usdc: "3.25", price_ngn: calculateNgnPrice(Math.round(3.25 * USDC_TO_NGN_RATE)) },
      { id: 5, name: "Cash Flow", description: "Instant Cash, Property Discount, and Tax Refund (tiered). Keep your balance healthy.", price_tyc: "70", price_usdc: "3.5", price_ngn: calculateNgnPrice(Math.round(3.5 * USDC_TO_NGN_RATE)) },
      { id: 6, name: "Chaos Bundle", description: "Teleport, Exact Roll, and Lucky 7. Control the board and bend the dice.", price_tyc: "75", price_usdc: "4", price_ngn: calculateNgnPrice(Math.round(4 * USDC_TO_NGN_RATE)) },
      { id: 7, name: "Landlord's Choice", description: "Rent Cashback, Interest, and Free Parking Bonus. Rewards for property owners and patient play.", price_tyc: "50", price_usdc: "2.5", price_ngn: calculateNgnPrice(Math.round(2.5 * USDC_TO_NGN_RATE)) },
      { id: 8, name: "Ultimate Pack", description: "A bit of everything to dominate the board.", price_tyc: "80", price_usdc: "4.5", price_ngn: calculateNgnPrice(Math.round(4.5 * USDC_TO_NGN_RATE)) },
    ];

    res.json({
      success: true,
      data: {
        bundles,
        ngn_available: process.env.PAYSTACK_SECRET_KEY ? true : false,
      }
    });
  } catch (err) {
    logger.error({ err: err?.message }, "listBundles error");
    res.status(500).json({ success: false, message: "Failed to list bundles" });
  }
}

/**
 * POST /api/shop/paystack/initialize
 * Initialize a Paystack payment
 */
export async function paystackInitialize(_req, res) {
  try {
    // TODO: Initialize Paystack payment
    res.status(501).json({ success: false, message: "Paystack integration not yet configured" });
  } catch (err) {
    logger.error({ err: err?.message }, "paystackInitialize error");
    res.status(500).json({ success: false, message: "Failed to initialize payment" });
  }
}

/**
 * GET /api/shop/paystack/verify
 * Verify a Paystack payment
 */
export async function paystackVerify(_req, res) {
  try {
    // TODO: Verify Paystack payment with reference
    res.status(501).json({ success: false, message: "Paystack verification not yet configured" });
  } catch (err) {
    logger.error({ err: err?.message }, "paystackVerify error");
    res.status(500).json({ success: false, message: "Failed to verify payment" });
  }
}

/**
 * POST /api/shop/paystack/webhook
 * Receive Paystack webhook events
 */
export async function paystackWebhook(_req, res) {
  try {
    // TODO: Handle Paystack webhook
    logger.info("Paystack webhook received");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err: err?.message }, "paystackWebhook error");
    res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
}

/**
 * GET /api/shop/flutterwave/status
 * Get Flutterwave service status
 */
export async function flutterwaveStatus(_req, res) {
  try {
    // TODO: Check Flutterwave integration status
    res.json({ success: true, status: "unconfigured" });
  } catch (err) {
    logger.error({ err: err?.message }, "flutterwaveStatus error");
    res.status(500).json({ success: false, message: "Failed to get status" });
  }
}

/**
 * POST /api/shop/flutterwave/initialize-test
 * Initialize a test Flutterwave payment
 */
export async function flutterwaveInitializeTest(_req, res) {
  try {
    // TODO: Initialize test Flutterwave payment
    res.status(501).json({ success: false, message: "Flutterwave test integration not yet configured" });
  } catch (err) {
    logger.error({ err: err?.message }, "flutterwaveInitializeTest error");
    res.status(500).json({ success: false, message: "Failed to initialize test payment" });
  }
}

/**
 * POST /api/shop/flutterwave/initialize
 * Initialize a Flutterwave payment
 */
export async function flutterwaveInitialize(_req, res) {
  try {
    // TODO: Initialize Flutterwave payment
    res.status(501).json({ success: false, message: "Flutterwave integration not yet configured" });
  } catch (err) {
    logger.error({ err: err?.message }, "flutterwaveInitialize error");
    res.status(500).json({ success: false, message: "Failed to initialize payment" });
  }
}

/**
 * POST /api/shop/flutterwave/initialize-perk
 * Initialize a Flutterwave payment for perks
 */
export async function flutterwaveInitializePerk(_req, res) {
  try {
    // TODO: Initialize Flutterwave payment for perk purchase
    res.status(501).json({ success: false, message: "Flutterwave perk integration not yet configured" });
  } catch (err) {
    logger.error({ err: err?.message }, "flutterwaveInitializePerk error");
    res.status(500).json({ success: false, message: "Failed to initialize perk payment" });
  }
}

/**
 * GET /api/shop/flutterwave/verify
 * Verify a Flutterwave payment
 */
export async function flutterwaveVerify(_req, res) {
  try {
    // TODO: Verify Flutterwave payment
    res.status(501).json({ success: false, message: "Flutterwave verification not yet configured" });
  } catch (err) {
    logger.error({ err: err?.message }, "flutterwaveVerify error");
    res.status(500).json({ success: false, message: "Failed to verify payment" });
  }
}

/**
 * POST /api/shop/flutterwave/webhook
 * Receive Flutterwave webhook events
 */
export async function flutterwaveWebhook(_req, res) {
  try {
    // TODO: Handle Flutterwave webhook
    logger.info("Flutterwave webhook received");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err: err?.message }, "flutterwaveWebhook error");
    res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
}
