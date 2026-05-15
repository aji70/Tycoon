import type { Address } from 'viem';

export type WalletChain = 'CELO' | 'POLYGON' | 'BASE';

/** Query/body params so rewards + referral work with connected wallet only (no JWT). */
export function walletAuthParams(
  address: Address | string | undefined | null,
  chain: WalletChain = 'CELO'
): Record<string, string> | undefined {
  if (!address) return undefined;
  const a = String(address).trim();
  if (!/^0x[a-fA-F0-9]{40}$/i.test(a)) return undefined;
  return { address: a, chain };
}
