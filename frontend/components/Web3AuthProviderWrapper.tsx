'use client';

import { CHAIN_NAMESPACES, UX_MODE, WEB3AUTH_NETWORK, type Web3AuthOptions } from '@web3auth/modal';
import { type Web3AuthContextConfig, Web3AuthProvider } from '@web3auth/modal/react';
import { useEffect, type ReactNode } from 'react';

const clientId = (process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID || '').trim();

/** Web3Auth/Torus logs every iframe JSON-RPC at info level; suppress in the browser console. */
function suppressEmbeddedWalletRpcLogs(): void {
  if (typeof window === 'undefined') return;
  const flag = '__tycoon_web3auth_rpc_log_filter__';
  if ((window as Window & { [key: string]: boolean })[flag]) return;
  (window as Window & { [key: string]: boolean })[flag] = true;

  (['info', 'log', 'debug'] as const).forEach((method) => {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      const first = args[0];
      if (typeof first === 'string' && first.startsWith('RPC (')) return;
      original(...args);
    };
  });
}

/**
 * Email passwordless by default (same UX as previous Privy email magic link).
 * Configure Google/socials in the Embedded Wallets dashboard if you enable them here.
 *
 * IMPORTANT: this project's Web3Auth Client ID is sapphire_devnet-only (mainnet returns
 * "Network mismatch"). Default must stay SAPPHIRE_DEVNET until a sapphire_mainnet
 * Client ID is created and wired into Vercel + Railway.
 */
const networkEnv = (process.env.NEXT_PUBLIC_WEB3AUTH_NETWORK || '').trim().toLowerCase();
const web3AuthNetwork =
  networkEnv === 'sapphire_mainnet' || networkEnv === 'mainnet'
    ? WEB3AUTH_NETWORK.SAPPHIRE_MAINNET
    : WEB3AUTH_NETWORK.SAPPHIRE_DEVNET;

/** Dashboard currently only lists Sepolia; Tycoon runs on Celo — pass Celo explicitly. */
const CELO_CHAIN_ID = '0xa4ec';
const celoChain = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: CELO_CHAIN_ID,
  rpcTarget: (process.env.NEXT_PUBLIC_CELO_RPC_URL || 'https://forno.celo.org').trim(),
  displayName: 'Celo',
  blockExplorerUrl: 'https://celoscan.io',
  ticker: 'CELO',
  tickerName: 'Celo',
  decimals: 18,
  logo: 'https://images.web3auth.io/chains/42220.png',
};

const web3AuthOptions: Web3AuthOptions = {
  clientId: clientId || 'WEB3AUTH_CLIENT_ID_MISSING',
  web3AuthNetwork,
  enableLogging: false,
  chains: [celoChain],
  defaultChainId: CELO_CHAIN_ID,
  // Popup OTP often shows "success" then never returns the session to the opener.
  // Redirect completes login on the same tab so backend sync can run.
  uxMode: UX_MODE.REDIRECT,
  uiConfig: {
    appName: 'Tycoon',
    mode: 'dark',
    loginGridCol: 2,
    primaryButton: 'emailLogin',
  },
};

const web3AuthContextConfig: Web3AuthContextConfig = {
  web3AuthOptions,
};

type Props = {
  children: ReactNode;
};

export default function Web3AuthProviderWrapper({ children }: Props) {
  useEffect(() => {
    suppressEmbeddedWalletRpcLogs();
  }, []);

  if (!clientId) {
    if (typeof window !== 'undefined') {
      console.warn(
        '[Web3Auth] NEXT_PUBLIC_WEB3AUTH_CLIENT_ID is not set — social login will not work. Get a Client ID from https://dashboard.web3auth.io/'
      );
    }
  }

  return <Web3AuthProvider config={web3AuthContextConfig}>{children}</Web3AuthProvider>;
}
