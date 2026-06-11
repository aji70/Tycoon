import { connect, disconnect, getAccount } from '@wagmi/core';
import { injected } from 'wagmi/connectors';
import { getAddress } from 'viem';
import { getWagmiConfig } from '@/config';
import { isMinipayOnlyHost } from '@/lib/minipaySiteRedirect';

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
  providers?: MiniPayEthereumProvider[];
};

function isInjectedConnector(connector: { id?: string; type?: string } | undefined): boolean {
  if (!connector) return false;
  return connector.id === 'injected' || connector.type === 'injected';
}

/**
 * Same provider wagmi's injected connector uses — authorize and send must share this object.
 */
export async function getInjectedEthereumProvider(): Promise<MiniPayEthereumProvider> {
  if (typeof window === 'undefined') {
    throw new Error('Open Tycoon inside the MiniPay app.');
  }

  const connector = injected();
  const provider = (await connector.getProvider()) as MiniPayEthereumProvider | undefined;
  if (provider?.request) return provider;

  const eth = (window as Window & { ethereum?: MiniPayEthereumProvider }).ethereum;
  if (eth?.request) return eth;

  throw new Error('Open Tycoon inside the MiniPay app.');
}

/** @deprecated Use getInjectedEthereumProvider() — kept for callers that expect sync null. */
export function getMiniPayEthereumProvider(): MiniPayEthereumProvider | null {
  if (typeof window === 'undefined') return null;

  const eth = (window as Window & { ethereum?: MiniPayEthereumProvider }).ethereum;
  if (!eth?.request) return null;

  if (eth.isMiniPay) return eth;

  const nested = eth.providers?.find((p) => p?.isMiniPay && typeof p.request === 'function');
  if (nested) return nested;

  if (!eth.providers?.length) return eth;

  return eth;
}

export function isMiniPayEmbeddedWallet(): boolean {
  if (typeof window === 'undefined') return false;
  const eth = (window as Window & { ethereum?: { isMiniPay?: boolean; providers?: { isMiniPay?: boolean }[] } })
    .ethereum;
  if (!eth) return false;
  if (eth.isMiniPay) return true;
  if (Array.isArray(eth.providers) && eth.providers.some((p) => p?.isMiniPay)) return true;
  // MiniPay-only deployment: only MiniPay webview users remain (others redirect away).
  if (isMinipayOnlyHost(window.location.hostname.toLowerCase())) return true;
  return false;
}

export function isMiniPay(): boolean {
  return isMiniPayEmbeddedWallet();
}

export function shouldBypassViemForTx(): boolean {
  return isMiniPayEmbeddedWallet();
}

/**
 * Ensure wagmi uses the injected MiniPay provider, not a persisted WalletConnect session.
 */
export async function ensureInjectedMiniPayConnection(): Promise<void> {
  const config = getWagmiConfig();
  const account = getAccount(config);

  if (!isInjectedConnector(account.connector)) {
    try {
      await disconnect(config);
    } catch {
      // ignore
    }
    await connect(config, { connector: injected() });
  }
}

/**
 * Friend's revive pattern: eth_accounts first (authorized at connect), then eth_requestAccounts.
 */
export async function resolveMiniPaySender(): Promise<string> {
  await ensureInjectedMiniPayConnection();
  const eth = await getInjectedEthereumProvider();

  let accounts = (await eth.request({ method: 'eth_accounts' })) as string[];

  if (!accounts?.[0]) {
    accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
  }

  const raw = accounts?.[0];
  if (!raw || !isValidUserWalletAddress(raw)) {
    throw new Error(
      'MiniPay wallet not connected. Close and reopen this app from MiniPay, then try again.',
    );
  }

  return getAddress(raw as `0x${string}`);
}

export async function authorizeMiniPayWallet(): Promise<readonly string[]> {
  const from = await resolveMiniPaySender();
  return [from];
}

export async function getMiniPayAccountsForTx(): Promise<readonly string[]> {
  return authorizeMiniPayWallet();
}

export async function ensureMiniPayWalletReady(): Promise<readonly string[]> {
  return authorizeMiniPayWallet();
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
