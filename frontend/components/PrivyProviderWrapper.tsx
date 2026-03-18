'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import type { ReactNode } from 'react';

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim()!;
const clientIdRaw = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID?.trim();
const clientId =
  clientIdRaw && clientIdRaw.startsWith('client-') ? clientIdRaw : undefined;

// If we don't have a valid OAuth client id, social login can appear in the UI
// but fail at runtime. In that case, fall back to email-only.
type PrivyLoginMethod =
  | 'email'
  | 'google'
  | 'twitter'
  | 'wallet'
  | 'sms'
  | 'discord'
  | 'github'
  | 'linkedin'
  | 'spotify'
  | 'instagram'
  | 'tiktok'
  | 'apple'
  | 'farcaster'
  | 'telegram';

const loginMethods: PrivyLoginMethod[] = clientId ? ['email', 'google', 'twitter'] : ['email'];

type Props = {
  children: ReactNode;
};

export default function PrivyProviderWrapper({ children }: Props) {
  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId}
      config={{
        // Privy embedded wallet config schema (no nested `ethereum` key in this SDK version).
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        appearance: {
          theme: 'dark',
          landingHeader: 'Sign in to Tycoon',
          loginMessage: 'Use email or social—no password. Choose a username once you’re in.',
          logo: '', // Set a URL to your logo (e.g. /logo.png) or leave empty
        },
        loginMethods,
      }}
    >
      {children}
    </PrivyProvider>
  );
}

