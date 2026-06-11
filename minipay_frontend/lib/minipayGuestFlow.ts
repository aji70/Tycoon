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

/**
 * MiniPay Mini App: never route writes through wagmi/viem prepareTransactionRequest.
 * True when the injected provider is MiniPay (flag on root or in providers[]).
 */
export function shouldBypassViemForTx(): boolean {
  return isMiniPayEmbeddedWallet();
}

type EthereumRequestProvider = {
  request: (args: { method: string; params?: readonly unknown[] }) => Promise<unknown>;
};

/**
 * Authorize MiniPay account before eth_sendTransaction (avoids EIP-1193 4100).
 * Always use eth_requestAccounts — never eth_accounts alone.
 * @see https://docs.minipay.xyz/getting-started/wallet-connection.html
 */
export async function ensureMiniPayWalletReady(): Promise<readonly string[]> {
  const eth = getInjectedEthereumProvider() as EthereumRequestProvider | null;
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
