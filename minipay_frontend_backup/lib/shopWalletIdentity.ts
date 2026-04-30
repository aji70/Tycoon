import { isAddress, type Address } from 'viem';

const ZERO = '0x0000000000000000000000000000000000000000' as Address;

function isNonZeroAddress(a: string | undefined): a is Address {
  return !!a && isAddress(a) && a.toLowerCase() !== ZERO.toLowerCase();
}

type GuestLike = {
  address?: string;
  linked_wallet_address?: string | null;
  smart_wallet_address?: string | null;
} | null | undefined;

/**
 * Owner address for `TycoonUserRegistry.getWallet`.
 * When a guest JWT session exists, use the account’s linked EOA or row address — not the browser’s
 * connected wallet (which may be a different key while still logged in as the same Tycoon user).
 */
export function shopRegistryOwnerAddress(params: {
  guestUser: GuestLike;
  connectedAddress: Address | undefined;
}): Address | undefined {
  const g = params.guestUser;
  if (g) {
    const linked = g.linked_wallet_address?.trim();
    if (isNonZeroAddress(linked)) return linked;
    const row = g.address?.trim();
    if (isNonZeroAddress(row)) return row;
    return undefined;
  }
  return params.connectedAddress;
}

/**
 * Smart wallet used for shop balances and `buyFrom` / approvals.
 * For guests, prefer `smart_wallet_address` from the session (backend) then on-chain registry.
 */
export function shopSmartWalletAddress(params: {
  guestUser: GuestLike;
  registrySmartWallet: string | undefined;
}): Address | null {
  const { guestUser, registrySmartWallet } = params;
  const jwt = guestUser?.smart_wallet_address?.trim();
  const reg = registrySmartWallet?.trim();
  if (guestUser) {
    if (isNonZeroAddress(jwt)) return jwt;
    if (isNonZeroAddress(reg)) return reg;
    return null;
  }
  if (isNonZeroAddress(reg)) return reg;
  if (isNonZeroAddress(jwt)) return jwt;
  return null;
}
