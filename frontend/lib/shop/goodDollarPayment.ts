import { formatUnits, type Address } from 'viem';
import {
  GOODDOLLAR_TOKEN_ADDRESS,
  GOODDOLLAR_SHOP_TREASURY_ADDRESSES,
} from '@/constants/contracts';

export const GOODDOLLAR_DECIMALS = 18;
export const GOODDOLLAR_SYMBOL = 'G$';

/** G$ per 1 USD. Default 14286 (~$0.00007 per G$); override via NEXT_PUBLIC_GD_USD_RATE. */
export function getGoodDollarUsdRate(): number {
  const raw = Number(process.env.NEXT_PUBLIC_GD_USD_RATE);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return 14286;
}

export function getGoodDollarTokenAddress(chainId: number): Address | undefined {
  return GOODDOLLAR_TOKEN_ADDRESS[chainId];
}

export function getGoodDollarTreasury(chainId: number): Address | undefined {
  return GOODDOLLAR_SHOP_TREASURY_ADDRESSES[chainId];
}

/**
 * Integer-safe USD → G$ wei (matches backend):
 *   gdWei = round(usd * 1e6) * rate * 1e12
 */
export function usdToGoodDollarWei(usdAmount: number): bigint {
  if (!Number.isFinite(usdAmount) || usdAmount <= 0) return 0n;
  const microUsd = BigInt(Math.round(usdAmount * 1e6));
  if (microUsd <= 0n) return 0n;
  const rate = BigInt(Math.round(getGoodDollarUsdRate()));
  if (rate <= 0n) return 0n;
  return microUsd * rate * 10n ** 12n;
}

export function formatGoodDollarWhole(wei: bigint): string {
  if (wei <= 0n) return '0';
  const whole = wei / 10n ** BigInt(GOODDOLLAR_DECIMALS);
  return whole.toLocaleString();
}

export function formatGoodDollarPrecise(wei: bigint, maxFractionDigits = 2): string {
  const whole = Number(formatUnits(wei, GOODDOLLAR_DECIMALS));
  if (!Number.isFinite(whole)) return '0';
  return whole.toLocaleString(undefined, {
    maximumFractionDigits: maxFractionDigits,
  });
}

export function hasEnoughGoodDollar(balanceWei: bigint | undefined, requiredWei: bigint): boolean {
  if (!balanceWei) return false;
  return balanceWei >= requiredWei;
}
