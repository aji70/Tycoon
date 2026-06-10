// components/AppKitProviderWrapper.tsx
'use client';

import { wagmiAdapter, projectId, defaultNetwork } from '@/config';
import { ReactNode, useEffect } from 'react';
import { createAppKit } from '@reown/appkit/react';
import { resolveSiteUrl } from '@/lib/siteUrl';

/** Canonical app origin for wallet metadata (Reown). Set `NEXT_PUBLIC_URL` on Vercel (e.g. https://playtycoon.xyz). */
const siteUrl = resolveSiteUrl();

let isInitialized = false;

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
  useWcmModalAccessibleName();

  useEffect(() => {
    if (!isInitialized) {
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
  }, []);

  return <>{children}</>;
}