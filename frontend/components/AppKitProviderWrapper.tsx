// components/AppKitProviderWrapper.tsx
'use client';

import { ReactNode, useEffect } from 'react';
import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { celo } from '@reown/appkit/networks';

const projectId = process.env.NEXT_PUBLIC_PROJECT_ID || '912f9a3279905a7dd417a7bf68e04209';

/** Canonical app origin for wallet metadata (Reown). Align with `minikit.config.ts` / production: set `NEXT_PUBLIC_URL=https://www.tycoonworld.xyz` on Vercel. */
const siteUrl = (() => {
  const fromEnv = process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv?.trim()) return fromEnv.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3000';
  return 'https://www.tycoonworld.xyz';
})();

// Celo only
const wagmiAdapter = new WagmiAdapter({
  networks: [celo],
  projectId,
  ssr: true, // Important for Next.js
});

let isInitialized = false;

export default function AppKitProviderWrapper({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    if (!isInitialized) {
      createAppKit({
        adapters: [wagmiAdapter],
        networks: [celo],
        projectId,
        themeVariables: {
          '--w3m-z-index': 10000, // Set high z-index for Reown modal
        },
        metadata: {
          name: 'Tycoon',
          description: 'Play Monopoly onchain',
          url: siteUrl,
          icons: [`${siteUrl}/logo.png`],
        },
      });
      isInitialized = true;
    }
  }, []);

  return <>{children}</>;
}