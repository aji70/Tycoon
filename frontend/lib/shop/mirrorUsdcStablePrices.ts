/** Reward shop lists USDC; MiniPay pays with USDT/cUSD — mirror USDC wei to all stables when stocking. */
export function mirrorUsdcStablePrices(usdcWei: bigint) {
  return { usdcWei, cusdcWei: usdcWei, usdtWei: usdcWei };
}
