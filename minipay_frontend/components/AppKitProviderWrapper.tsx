// components/AppKitProviderWrapper.tsx
'use client';

import { wagmiAdapter, projectId, defaultNetwork } from '@/config';
import { ReactNode, useEffect } from 'react';
import { createAppKit } from '@reown/appkit/react';

/** Canonical app origin for wallet metadata (Reown). Set `NEXT_PUBLIC_URL` on Vercel to your canonical origin (www vs apex). */
const siteUrl = (() => {
  const fromEnv = process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv?.trim()) return fromEnv.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3000';
  return 'https://www.tycoonworld.xyz';
})();

let isInitialized = false;

function ensureAppKit() {
  if (typeof window === 'undefined' || isInitialized) return;
  createAppKit({
    adapters: [wagmiAdapter],
    networks: [defaultNetwork],
    projectId,
    defaultNetwork,
    themeVariables: {
      '--w3m-z-index': 10000, // Set high z-index for Reown modal
    },
    metadata: {
      name: 'Tycoon',
      description: 'Play Monopoly onchain',
      url: siteUrl,
      icons: [`${siteUrl}/logo.png`],
    },
    features: {
      analytics: true,
    },
  });
  isInitialized = true;
}

/** Reown injects #wcm-modal without aria-label; set one for screen readers / Lighthouse. */
function useWcmModalAccessibleName() {
  useEffect(() => {
    const label = "Wallet connection";
    const apply = () => {
      const el = document.getElementById("wcm-modal");
      if (!el) return;
      if (!el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby")) {
        el.setAttribute("aria-label", label);
      }
    };
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
}

export default function AppKitProviderWrapper({
  children,
}: {
  children: ReactNode;
}) {
  // Must run before any child calls useAppKit — useEffect runs too late (after first paint).
  ensureAppKit();

  useWcmModalAccessibleName();

  return <>{children}</>;
}