'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import type { ReactNode } from 'react';

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;
const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID;

type Props = {
  children: ReactNode;
};

export default function PrivyProviderWrapper({ children }: Props) {
  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId}
      config={{
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        appearance: {
          theme: 'dark',
        },
        loginMethods: ['email', 'google', 'twitter'],
      }}
    >
      {children}
    </PrivyProvider>
  );
}

