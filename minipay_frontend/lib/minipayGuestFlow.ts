import { getInjectedEthereumProvider } from "@/lib/utils/erc8004InjectedEoa";

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

  const eth = (window as Window & { ethereum?: { isMiniPay?: boolean; providers?: { isMiniPay?: boolean }[] } })
    .ethereum;
  if (eth?.isMiniPay) return true;

  const providers = eth?.providers;
  if (Array.isArray(providers) && providers.some((p) => p?.isMiniPay)) return true;

  const injected = getInjectedEthereumProvider();
  return Boolean((injected as { isMiniPay?: boolean } | null)?.isMiniPay);
}

/** Alias matching common MiniPay Mini App code (`isMiniPay()`). */
export function isMiniPay(): boolean {
  return isMiniPayEmbeddedWallet();
}

/**
 * MiniPay Mini App: never route writes through wagmi/viem prepareTransactionRequest.
 */
export function shouldBypassViemForTx(): boolean {
  return isMiniPayEmbeddedWallet();
}

type EthereumRequestProvider = {
  request: (args: { method: string; params?: readonly unknown[] }) => Promise<unknown>;
};

function getMiniPayProvider(): EthereumRequestProvider | null {
  return getInjectedEthereumProvider() as EthereumRequestProvider | null;
}

/**
 * One-time session authorization on app load (auto-connect).
 * After this succeeds, payment sends can use eth_accounts.
 */
export async function authorizeMiniPayWallet(): Promise<readonly string[]> {
  const eth = getMiniPayProvider();
  if (!eth?.request) {
    if (shouldBypassViemForTx()) {
      throw new Error("Open Tycoon inside the MiniPay app.");
    }
    return [];
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

  return accounts;
}

/**
 * Accounts for eth_sendTransaction — friend's pattern:
 * eth_accounts first (after auto-connect authorized the session), eth_requestAccounts only if empty.
 */
export async function getMiniPayAccountsForTx(): Promise<readonly string[]> {
  const eth = getMiniPayProvider();
  if (!eth?.request) {
    if (shouldBypassViemForTx()) {
      throw new Error("Open Tycoon inside the MiniPay app.");
    }
    return [];
  }

  const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
  if (accounts?.length) return accounts;

  return authorizeMiniPayWallet();
}

/** @deprecated Use authorizeMiniPayWallet (connect) or getMiniPayAccountsForTx (send). */
export async function ensureMiniPayWalletReady(): Promise<readonly string[]> {
  return getMiniPayAccountsForTx();
}

/**
 * Use backend-signed guest create/join only when there is no connected wallet
 * and the user is not in the MiniPay app (MiniPay always has an injected wallet).
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
