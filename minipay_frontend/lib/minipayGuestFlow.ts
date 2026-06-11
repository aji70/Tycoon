import { getAddress } from 'viem';

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

export type MiniPayEthereumProvider = {
  request: (args: { method: string; params?: readonly unknown[] }) => Promise<unknown>;
  isMiniPay?: boolean;
};

/**
 * MiniPay's injected provider only — never MetaMask / WalletConnect shims from providers[].
 * authorize + eth_accounts + eth_sendTransaction must all use this same object.
 */
export function getMiniPayEthereumProvider(): MiniPayEthereumProvider | null {
  if (typeof window === "undefined") return null;

  const eth = (window as Window & { ethereum?: MiniPayEthereumProvider & { providers?: MiniPayEthereumProvider[] } })
    .ethereum;
  if (!eth?.request) return null;

  if (eth.isMiniPay) return eth;

  const providers = eth.providers;
  if (Array.isArray(providers)) {
    const minipay = providers.find((p) => p?.isMiniPay && typeof p.request === "function");
    if (minipay) return minipay;
  }

  // MiniPay webview: single injected provider, sometimes without isMiniPay on root
  if (!providers?.length) return eth;

  return null;
}

/** True when running inside Celo MiniPay (injected provider). */
export function isMiniPayEmbeddedWallet(): boolean {
  return getMiniPayEthereumProvider() !== null;
}

/** Alias matching common MiniPay Mini App code (`isMiniPay()`). */
export function isMiniPay(): boolean {
  return isMiniPayEmbeddedWallet();
}

/** Never route writes through wagmi/viem prepareTransactionRequest on MiniPay. */
export function shouldBypassViemForTx(): boolean {
  return isMiniPayEmbeddedWallet();
}

/**
 * Authorize session on app load so eth_accounts is populated for later sends.
 */
export async function authorizeMiniPayWallet(): Promise<readonly string[]> {
  const eth = getMiniPayEthereumProvider();
  if (!eth?.request) {
    throw new Error("Open Tycoon inside the MiniPay app.");
  }

  let accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];

  if (!accounts?.length) {
    try {
      const { connectMiniPayWallet } = await import("@/lib/connectMiniPayWallet");
      await connectMiniPayWallet();
      accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    } catch {
      // fall through
    }
  }

  if (!accounts?.length) {
    throw new Error(
      "MiniPay wallet not connected. Open this app from MiniPay and try again."
    );
  }

  return accounts.map((a) => getAddress(a as `0x${string}`));
}

/**
 * Resolve sender for eth_sendTransaction.
 * Friend's pattern: eth_accounts when session is warm; always re-request if empty.
 */
export async function getMiniPayAccountsForTx(): Promise<readonly string[]> {
  const eth = getMiniPayEthereumProvider();
  if (!eth?.request) {
    throw new Error("Open Tycoon inside the MiniPay app.");
  }

  let accounts = (await eth.request({ method: "eth_accounts" })) as string[];
  if (!accounts?.length) {
    accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  }

  if (!accounts?.length) {
    throw new Error("MiniPay wallet not connected. Open this app from MiniPay and try again.");
  }

  return accounts.map((a) => getAddress(a as `0x${string}`));
}

/** @deprecated Use authorizeMiniPayWallet or getMiniPayAccountsForTx. */
export async function ensureMiniPayWalletReady(): Promise<readonly string[]> {
  return getMiniPayAccountsForTx();
}

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
