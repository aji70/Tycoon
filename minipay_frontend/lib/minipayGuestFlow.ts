import { getAddress, type Address } from "viem";
import { MINIPAY_CHAIN_IDS } from "@/constants/contracts";

const ZERO = "0x0000000000000000000000000000000000000000";

function isValidUserWalletAddress(a: string | null | undefined): a is string {
  if (!a || typeof a !== "string") return false;
  const s = a.trim();
  if (s.toLowerCase() === ZERO) return false;
  return /^0x[a-fA-F0-9]{40}$/i.test(s);
}

/**
 * Same resolution order as backend `getOnchainAddressForUser`: linked → smart → account primary.
 */
export function getGuestUserPlayAddress(guestUser: {
  linked_wallet_address?: string | null;
  smart_wallet_address?: string | null;
  address?: string;
} | null | undefined): string | null {
  if (!guestUser) return null;
  if (isValidUserWalletAddress(guestUser.linked_wallet_address)) {
    return guestUser.linked_wallet_address.trim();
  }
  if (isValidUserWalletAddress(guestUser.smart_wallet_address)) {
    return guestUser.smart_wallet_address.trim();
  }
  if (isValidUserWalletAddress(guestUser.address)) {
    return guestUser.address.trim();
  }
  return null;
}

/** True when running inside Celo MiniPay (injected provider). */
export function isMiniPayEmbeddedWallet(): boolean {
  if (typeof window === "undefined") return false;
  const eth = (window as Window & { ethereum?: { isMiniPay?: boolean } }).ethereum;
  return Boolean(eth?.isMiniPay);
}

type EthereumRequestProvider = {
  request: (args: { method: string; params?: readonly unknown[] }) => Promise<unknown>;
};

/**
 * MiniPay docs: auto-connect on load; call eth_requestAccounts before sending txs
 * so the provider authorizes the active account (avoids "permission denied").
 * @see https://docs.minipay.xyz/getting-started/wallet-connection.html
 */
/** Active MiniPay EOA from eth_requestAccounts (source of truth for `from`). */
export async function getMiniPayActiveAddress(): Promise<Address> {
  const eth = (window as Window & { ethereum?: EthereumRequestProvider }).ethereum;
  if (!eth?.request) {
    throw new Error("Open Tycoon inside the MiniPay app.");
  }
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  if (!Array.isArray(accounts) || !accounts[0]) {
    throw new Error("MiniPay did not return a wallet address.");
  }
  return getAddress(accounts[0] as Address);
}

export async function ensureMiniPayWalletReady(): Promise<Address | undefined> {
  if (!isMiniPayEmbeddedWallet()) return undefined;
  return getMiniPayActiveAddress();
}

/**
 * Use backend-signed guest create/join when:
 * - JWT guest with no wagmi address, or
 * - MiniPay (embedded wallet or Celo mainnet id 42220) while the injected address is not the account play address
 *   (linked / smart / primary), so the user should not pay gas from the local MiniPay wallet for Tycoon contract txs.
 */
export function shouldUseBackendGuestGameFlow(
  guestUser: {
    linked_wallet_address?: string | null;
    smart_wallet_address?: string | null;
    address?: string;
  } | null | undefined,
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
