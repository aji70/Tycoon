/** Celo mainnet USDT — must match reward contract `usdt()` (what MiniPay spends for perks). */
export const CELO_SHOP_USDT =
  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as const;

export type MinipayStableSymbol = 'USDT';

export type MinipayStableOption = {
  symbol: MinipayStableSymbol;
  tokenAddress?: `0x${string}`;
  paymentToken: number;
  balance: number;
};

export type MinipayShopItemPrices = {
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

/** Minipay perk shop pays in USDT only. */
export function pickMinipayPreferredStable(options: MinipayStableOption[]): MinipayStableOption {
  const usdt = options.find((s) => s.symbol === "USDT" && s.tokenAddress);
  return usdt ?? USDT_FALLBACK;
}

export function shopPaymentLabel(_symbol: MinipayStableSymbol): string {
  return "USDT";
}

/** USDT @ CELO_SHOP_USDT — approve + buyCollectible(paymentToken: 3). */
export function resolveMinipayShopPayment(
  item: MinipayShopItemPrices,
  options: MinipayStableOption[]
): ResolvedMinipayShopPayment | null {
  const usdt = options.find((s) => s.symbol === "USDT" && s.tokenAddress);
  if (!usdt) return null;

  const priceWei = priceWeiFromDisplay(item.usdtPrice);
  const priceDisplay = Number(item.usdtPrice || 0);
  if (priceWei <= 0n) return null;

  return { ...usdt, priceWei, priceDisplay };
}
