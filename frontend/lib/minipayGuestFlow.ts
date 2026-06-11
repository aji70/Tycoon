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
export async function ensureMiniPayWalletReady(): Promise<void> {
  if (!isMiniPayEmbeddedWallet()) return;
  const eth = (window as Window & { ethereum?: EthereumRequestProvider }).ethereum;
  if (!eth?.request) {
    throw new Error("Open Tycoon inside the MiniPay app.");
  }
  await eth.request({ method: "eth_requestAccounts" });
}

/**
 * Use backend-signed guest create/join only when there is no connected wallet
 * and the user is not in the MiniPay app (MiniPay always has an injected wallet).
 * When a wallet is connected, create/join always goes on-chain (user signs).
 */
export function shouldUseBackendGuestGameFlow(
  guestUser: {
    linked_wallet_address?: string | null;
    smart_wallet_address?: string | null;
    address?: string;
  } | null | undefined,
  wagmiAddress: string | undefined,
  _wagmiChainId: number
): boolean {
  if (wagmiAddress) return false;
  if (isMiniPayEmbeddedWallet()) return false;
  return !!guestUser;
}
