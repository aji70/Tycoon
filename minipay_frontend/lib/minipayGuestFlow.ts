import { MINIPAY_CHAIN_IDS } from "@/constants/contracts";

const ZERO = "0x0000000000000000000000000000000000000000";

function isValidUserWalletAddress(a: string | null | undefined): a is string {
  if (!a || typeof a !== "string") return false;
  const s = a.trim();
  if (s.toLowerCase() === ZERO) return false;
  return /^0x[a-fA-F0-9]{40}$/i.test(s);
}

function uniqueAddresses(...candidates: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const c of candidates) {
    if (!isValidUserWalletAddress(c)) continue;
    const s = c.trim();
    if (!out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s);
  }
  return out;
}

/** True when running inside Celo MiniPay (injected provider). */
export function isMiniPayEmbeddedWallet(): boolean {
  if (typeof window === "undefined") return false;
  const eth = (window as Window & { ethereum?: { isMiniPay?: boolean } }).ethereum;
  return Boolean(eth?.isMiniPay);
}

/**
 * MiniPay uses the injected EOA for play, shop, and rewards — not TycoonUserWallet smart wallets.
 * Web/Privy may still use smart wallets for gasless flows.
 */
export function isMinipayEoaFirstFlow(): boolean {
  return isMiniPayEmbeddedWallet();
}

/** Hide create/manage smart wallet UI in the MiniPay app. */
export function shouldPromoteSmartWalletUi(): boolean {
  return !isMinipayEoaFirstFlow();
}

type GuestWalletFields = {
  linked_wallet_address?: string | null;
  smart_wallet_address?: string | null;
  address?: string;
};

/**
 * On-chain identity for games, registration, and daily claim.
 * MiniPay: linked EOA → account address → smart (legacy only).
 * Web: linked → smart → account (matches backend `getOnchainAddressForUser`).
 */
export function getGuestUserPlayAddress(guestUser: GuestWalletFields | null | undefined): string | null {
  if (!guestUser) return null;

  const linked = isValidUserWalletAddress(guestUser.linked_wallet_address)
    ? guestUser.linked_wallet_address.trim()
    : null;
  const smart = isValidUserWalletAddress(guestUser.smart_wallet_address)
    ? guestUser.smart_wallet_address.trim()
    : null;
  const primary = isValidUserWalletAddress(guestUser.address) ? guestUser.address.trim() : null;

  if (isMinipayEoaFirstFlow()) {
    return linked ?? primary;
  }
  return linked ?? smart ?? primary;
}

/** EOA-only addresses for MiniPay perks/voucher UI (no smart wallet). */
export function getGuestUserEoaHolderAddresses(
  guestUser: GuestWalletFields | null | undefined
): string[] {
  if (!guestUser) return [];
  return uniqueAddresses(guestUser.linked_wallet_address, guestUser.address);
}

/** Addresses to scan for vouchers/collectibles. MiniPay: EOAs only. */
export function getGuestUserRewardHolderAddresses(
  guestUser: GuestWalletFields | null | undefined
): string[] {
  if (!guestUser) return [];
  if (isMinipayEoaFirstFlow()) {
    return getGuestUserEoaHolderAddresses(guestUser);
  }
  return uniqueAddresses(
    guestUser.linked_wallet_address,
    guestUser.smart_wallet_address,
    guestUser.address
  );
}

/**
 * Use backend-signed guest create/join when:
 * - JWT guest with no wagmi address, or
 * - MiniPay while the injected address is not the account play address
 */
export function shouldUseBackendGuestGameFlow(
  guestUser: GuestWalletFields | null | undefined,
  wagmiAddress: string | undefined,
  wagmiChainId: number
): boolean {
  if (!guestUser) return false;
  if (!wagmiAddress) return true;
  const inMiniPay = isMiniPayEmbeddedWallet() || MINIPAY_CHAIN_IDS.includes(wagmiChainId);
  if (!inMiniPay) return false;
  const play = getGuestUserPlayAddress(guestUser);
  if (!play) return true;
  return play.toLowerCase() !== wagmiAddress.toLowerCase();
}
