/**
 * Utility functions for shop pricing calculations
 */

const USDC_TO_NGN_RATE = 1600;
const MIN_NGN_PURCHASE = 200;
const DISCOUNT_THRESHOLD = 1000; // NGN
const DISCOUNT_RATE = 0.8; // 20% off (pay 80%)

/**
 * Calculate NGN price with discount for purchases over 1000 NGN
 * Minimum purchase: 200 NGN
 * Discount: 20% off for amounts > 1000 NGN
 */
export function calculateNgnPrice(baseNgnPrice) {
  if (baseNgnPrice < MIN_NGN_PURCHASE) return MIN_NGN_PURCHASE;
  if (baseNgnPrice > DISCOUNT_THRESHOLD) return Math.round(baseNgnPrice * DISCOUNT_RATE);
  return baseNgnPrice;
}

/**
 * Convert USDC price to NGN with discount applied
 */
export function usdcToNgn(usdcPrice) {
  const baseNgnPrice = Math.round(usdcPrice * USDC_TO_NGN_RATE);
  return calculateNgnPrice(baseNgnPrice);
}

/**
 * Validate NGN amount
 */
export function validateNgnAmount(amountNgn) {
  if (!amountNgn || amountNgn < MIN_NGN_PURCHASE) {
    return {
      valid: false,
      error: `Minimum purchase amount is ₦${MIN_NGN_PURCHASE}`,
    };
  }
  return { valid: true };
}

export { USDC_TO_NGN_RATE, MIN_NGN_PURCHASE, DISCOUNT_THRESHOLD, DISCOUNT_RATE };
