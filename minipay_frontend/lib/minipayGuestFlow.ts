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

function resolveWindowEthereum(): MiniPayEthereumProvider | null {
  if (typeof window === 'undefined') return null;

  const eth = (window as Window & { ethereum?: MiniPayEthereumProvider }).ethereum;
  if (!eth?.request) return null;

  if (eth.isMiniPay) return eth;

  const nested = eth.providers?.find((p) => p?.isMiniPay && typeof p.request === 'function');
  if (nested) return nested;

  if (!eth.providers?.length) return eth;

  return eth;
}

/**
 * Celopedia / MiniPay project setup: same window.ethereum for authorize, transport, and send.
 * @see https://docs.minipay.xyz/getting-started/project-setup.html
 */
export function getEthereumProvider(): MiniPayEthereumProvider {
  const eth = resolveWindowEthereum();
  if (!eth) {
    throw new Error('window.ethereum is required. Run this app inside MiniPay.');
  }
  return eth;
}

/** @deprecated Use getEthereumProvider() */
export function getMiniPayEthereumProvider(): MiniPayEthereumProvider | null {
  return resolveWindowEthereum();
}

/** @deprecated Use getEthereumProvider() */
export async function getInjectedEthereumProvider(): Promise<MiniPayEthereumProvider> {
  return getEthereumProvider();
}

export function isMiniPayEmbeddedWallet(): boolean {
  if (typeof window === 'undefined') return false;
  const eth = (window as Window & { ethereum?: { isMiniPay?: boolean; providers?: { isMiniPay?: boolean }[] } })
    .ethereum;
  if (!eth) return false;
  if (eth.isMiniPay) return true;
  if (Array.isArray(eth.providers) && eth.providers.some((p) => p?.isMiniPay)) return true;
  if (isMinipayOnlyHost(window.location.hostname.toLowerCase())) return true;
  return false;
}

export function isMiniPay(): boolean {
  return isMiniPayEmbeddedWallet();
}

export function shouldBypassViemForTx(): boolean {
  return isMiniPayEmbeddedWallet();
}

function isInjectedConnector(connector: { id?: string; type?: string } | undefined): boolean {
  if (!connector) return false;
  return connector.id === 'injected' || connector.type === 'injected';
}

/**
 * Keep wagmi on injected() so UI address matches window.ethereum — drop WalletConnect sessions.
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
 * Authorize on window.ethereum (Celopedia: auto-connect on load, requestAccounts before send).
 */
export async function resolveMiniPaySender(): Promise<string> {
  await ensureInjectedMiniPayConnection();
  const eth = getEthereumProvider();

  let accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];

  if (!accounts?.[0]) {
    accounts = (await eth.request({ method: 'eth_accounts' })) as string[];
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
