export type MinipayStableSymbol = 'CUSDC' | 'USDT';

export type MinipayStableOption = {
  symbol: MinipayStableSymbol;
  tokenAddress?: `0x${string}`;
  paymentToken: number;
  balance: number;
};

const USDT_FALLBACK: MinipayStableOption = {
  symbol: 'USDT',
  tokenAddress: undefined,
  paymentToken: 3,
  balance: 0,
};

/** Minipay in-app shop defaults to USDT when the token is configured on the chain. */
export function pickMinipayPreferredStable(options: MinipayStableOption[]): MinipayStableOption {
  const available = options.filter((s) => !!s.tokenAddress);
  if (available.length === 0) return USDT_FALLBACK;
  const usdt = available.find((s) => s.symbol === 'USDT');
  if (usdt) return usdt;
  return [...available].sort((a, b) => b.balance - a.balance)[0];
}
