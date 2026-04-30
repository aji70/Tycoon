import type { Address } from 'viem';

const zeroAddress = '0x0000000000000000000000000000000000000000';

function isValidWallet(a: unknown): a is Address {
  if (!a || typeof a !== 'string') return false;
  const s = a.trim();
  if (!s) return false;
  return s.toLowerCase() !== zeroAddress.toLowerCase() && /^0x[a-fA-F0-9]{40}$/i.test(s);
}

/** DB row key for `/users/by-address` — must match profile (linked or account address, not smart wallet alone). */
export function backendUserStatsLookupAddress(
  guestUser: { address?: string; linked_wallet_address?: string | null } | null | undefined,
  gameLookupAddress: string | undefined | null,
  walletAddress: string | undefined | null
): string | undefined {
  if (guestUser) {
    if (guestUser.linked_wallet_address && isValidWallet(guestUser.linked_wallet_address)) {
      return guestUser.linked_wallet_address.trim();
    }
    if (guestUser.address) return guestUser.address.trim();
  }
  return (gameLookupAddress ?? walletAddress) ?? undefined;
}

export function chainIdToLeaderboardChain(chainId: number): string {
  return 'CELO';
}
