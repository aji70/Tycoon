'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import type { ReactNode } from 'react';
import { celo } from 'viem/chains';

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim()!;

/**
 * Email-only sign-in. Google / X used Privy's OAuth sheet and were not responsive on small
 * screens; magic-link email avoids that. Re-enable socials here + set NEXT_PUBLIC_PRIVY_CLIENT_ID
 * if you configure OAuth in Privy and want them back.
 */
const loginMethods = ['email'] as const;

type Props = {
  children: ReactNode;
};

export default function PrivyProviderWrapper({ children }: Props) {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        // Privy embedded wallet config schema (no nested `ethereum` key in this SDK version).
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        defaultChain: celo,
        supportedChains: [celo],
        appearance: {
          theme: 'dark',
          landingHeader: 'Sign in to Tycoon',
          loginMessage:
            'Enter your email for a magic link or code. No password — choose a username after you sign in.',
          logo: '', // Set a URL to your logo (e.g. /logo.png) or leave empty
        },
        loginMethods: [...loginMethods],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
