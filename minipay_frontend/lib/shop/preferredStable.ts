export type MinipayStableSymbol = 'CUSDC' | 'USDT';

export type MinipayStableOption = {
  symbol: MinipayStableSymbol;
  tokenAddress?: `0x${string}`;
  paymentToken: number;
  balance: number;
};

export type MinipayShopItemPrices = {
  cusdcPrice: string;
  usdtPrice: string;
};

export type ResolvedMinipayShopPayment = MinipayStableOption & {
  priceWei: bigint;
  priceDisplay: number;
};

const USDT_FALLBACK: MinipayStableOption = {
  symbol: 'USDT',
  tokenAddress: undefined,
  paymentToken: 3,
  balance: 0,
};

function priceWeiFromDisplay(priceStr: string): bigint {
  const priceNum = Number(priceStr || 0);
  if (!Number.isFinite(priceNum) || priceNum <= 0) return 0n;
  return BigInt(Math.round(priceNum * 1e6));
}

/** Minipay in-app shop defaults to USDT when configured and priced. */
export function pickMinipayPreferredStable(options: MinipayStableOption[]): MinipayStableOption {
  const available = options.filter((s) => !!s.tokenAddress);
  if (available.length === 0) return USDT_FALLBACK;
  const usdt = available.find((s) => s.symbol === 'USDT');
  if (usdt) return usdt;
  return [...available].sort((a, b) => b.balance - a.balance)[0];
}

/**
 * Pick the stablecoin + on-chain price for a perk purchase.
 * USDT is preferred only when this item has a non-zero USDT price on-chain (otherwise buy reverts).
 */
export function resolveMinipayShopPayment(
  item: MinipayShopItemPrices,
  options: MinipayStableOption[]
): ResolvedMinipayShopPayment | null {
  const available = options.filter((s) => !!s.tokenAddress);
  if (available.length === 0) return null;

  const ranked: Array<{ symbol: MinipayStableSymbol; paymentToken: number; priceStr: string }> = [
    { symbol: 'USDT', paymentToken: 3, priceStr: item.usdtPrice },
    { symbol: 'CUSDC', paymentToken: 2, priceStr: item.cusdcPrice },
  ];

  for (const candidate of ranked) {
    const opt = available.find((s) => s.symbol === candidate.symbol);
    const priceWei = priceWeiFromDisplay(candidate.priceStr);
    const priceDisplay = Number(candidate.priceStr || 0);
    if (!opt || priceWei <= 0n) continue;
    if (opt.balance < priceDisplay) continue;
    return { ...opt, priceWei, priceDisplay };
  }

  // Show a useful error: priced token exists but balance too low, or no on-chain price
  for (const candidate of ranked) {
    const opt = available.find((s) => s.symbol === candidate.symbol);
    const priceWei = priceWeiFromDisplay(candidate.priceStr);
    if (opt && priceWei > 0n) {
      return { ...opt, priceWei, priceDisplay: Number(candidate.priceStr) };
    }
  }

  return null;
}
