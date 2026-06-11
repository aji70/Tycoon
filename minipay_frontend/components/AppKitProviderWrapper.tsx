// components/AppKitProviderWrapper.tsx
'use client';

import { ReactNode, useEffect } from 'react';
import { scheduleLazyAppKitInit } from '@/lib/lazyAppKit';

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
    scheduleLazyAppKitInit();
  }, []);

  return <>{children}</>;
}
