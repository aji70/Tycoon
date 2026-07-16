'use client';

import { WEB3AUTH_NETWORK, type Web3AuthOptions } from '@web3auth/modal';
import { type Web3AuthContextConfig, Web3AuthProvider } from '@web3auth/modal/react';
import type { ReactNode } from 'react';

const clientId = (process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID || '').trim();

/**
 * Email passwordless by default (same UX as previous Privy email magic link).
 * Configure Google/socials in the Embedded Wallets dashboard if you enable them here.
 * Use SAPPHIRE_DEVNET for localhost; SAPPHIRE_MAINNET for production.
 */
const networkEnv = (process.env.NEXT_PUBLIC_WEB3AUTH_NETWORK || '').trim().toLowerCase();
const web3AuthNetwork =
  networkEnv === 'sapphire_mainnet' || networkEnv === 'mainnet'
    ? WEB3AUTH_NETWORK.SAPPHIRE_MAINNET
    : WEB3AUTH_NETWORK.SAPPHIRE_DEVNET;

const web3AuthOptions: Web3AuthOptions = {
  clientId: clientId || 'WEB3AUTH_CLIENT_ID_MISSING',
  web3AuthNetwork,
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
  if (!clientId) {
    if (typeof window !== 'undefined') {
      console.warn(
        '[Web3Auth] NEXT_PUBLIC_WEB3AUTH_CLIENT_ID is not set — social login will not work. Get a Client ID from https://dashboard.web3auth.io/'
      );
    }
  }

  return <Web3AuthProvider config={web3AuthContextConfig}>{children}</Web3AuthProvider>;
}
