/**
 * Mirror of frontend shop/rewards definitions for backend bulk stocking.
 * Keep in sync with:
 * - frontend/components/rewards/rewardsConstants.tsx (INITIAL_COLLECTIBLES)
 * - frontend/app/rewards/useRewardsAdmin.ts (BUNDLE_DEFS_FOR_STOCK)
 */

/** @type {readonly { perk: number; strength: number; tycPrice: string; usdcPrice: string }[]} */
export const INITIAL_COLLECTIBLES = [
  { perk: 1, strength: 1, tycPrice: "0.75", usdcPrice: "0.08" },
  { perk: 2, strength: 1, tycPrice: "1.0", usdcPrice: "0.12" },
  { perk: 3, strength: 1, tycPrice: "1.4", usdcPrice: "0.30" },
  { perk: 4, strength: 1, tycPrice: "1.0", usdcPrice: "0.10" },
  { perk: 8, strength: 1, tycPrice: "1.25", usdcPrice: "0.25" },
  { perk: 7, strength: 1, tycPrice: "1.5", usdcPrice: "0.40" },
  { perk: 6, strength: 1, tycPrice: "1.8", usdcPrice: "0.60" },
  { perk: 10, strength: 1, tycPrice: "2.5", usdcPrice: "1.00" },
  { perk: 11, strength: 1, tycPrice: "1.2", usdcPrice: "0.25" },
  { perk: 12, strength: 1, tycPrice: "1.0", usdcPrice: "0.20" },
  { perk: 13, strength: 1, tycPrice: "1.1", usdcPrice: "0.22" },
  { perk: 5, strength: 1, tycPrice: "0.5", usdcPrice: "0.05" },
  { perk: 5, strength: 2, tycPrice: "0.8", usdcPrice: "0.15" },
  { perk: 5, strength: 3, tycPrice: "1.2", usdcPrice: "0.30" },
  { perk: 5, strength: 4, tycPrice: "1.6", usdcPrice: "0.50" },
  { perk: 5, strength: 5, tycPrice: "2.0", usdcPrice: "0.90" },
  { perk: 9, strength: 1, tycPrice: "0.6", usdcPrice: "0.08" },
  { perk: 14, strength: 1, tycPrice: "1.0", usdcPrice: "0.20" },
];

/** @type {readonly { name: string; items: { perk: number; strength: number; quantity: number }[]; price_tyc: string; price_usdc: string }[]} */
export const BUNDLE_DEFS_FOR_STOCK = [
  { name: "Starter Pack", price_tyc: "45", price_usdc: "2.5", items: [{ perk: 7, strength: 1, quantity: 1 }, { perk: 4, strength: 1, quantity: 1 }, { perk: 10, strength: 1, quantity: 1 }] },
  { name: "Lucky Bundle", price_tyc: "60", price_usdc: "3", items: [{ perk: 2, strength: 1, quantity: 1 }, { perk: 6, strength: 1, quantity: 1 }, { perk: 13, strength: 1, quantity: 1 }] },
  { name: "Defender Pack", price_tyc: "55", price_usdc: "2.75", items: [{ perk: 7, strength: 1, quantity: 1 }, { perk: 2, strength: 1, quantity: 1 }, { perk: 4, strength: 1, quantity: 1 }] },
  { name: "High Roller", price_tyc: "65", price_usdc: "3.25", items: [{ perk: 3, strength: 1, quantity: 1 }, { perk: 4, strength: 1, quantity: 1 }, { perk: 10, strength: 1, quantity: 1 }] },
  { name: "Cash Flow", price_tyc: "70", price_usdc: "3.5", items: [{ perk: 5, strength: 1, quantity: 1 }, { perk: 8, strength: 1, quantity: 1 }, { perk: 9, strength: 1, quantity: 1 }] },
  { name: "Chaos Bundle", price_tyc: "75", price_usdc: "4", items: [{ perk: 6, strength: 1, quantity: 1 }, { perk: 10, strength: 1, quantity: 1 }, { perk: 13, strength: 1, quantity: 1 }] },
  { name: "Landlord's Choice", price_tyc: "50", price_usdc: "2.5", items: [{ perk: 11, strength: 1, quantity: 1 }, { perk: 12, strength: 1, quantity: 1 }, { perk: 14, strength: 1, quantity: 1 }] },
  { name: "Ultimate Pack", price_tyc: "80", price_usdc: "4.5", items: [{ perk: 1, strength: 1, quantity: 1 }, { perk: 3, strength: 1, quantity: 1 }, { perk: 7, strength: 1, quantity: 1 }, { perk: 13, strength: 1, quantity: 1 }] },
];
