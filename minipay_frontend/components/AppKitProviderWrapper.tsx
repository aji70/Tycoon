"use client";

import { ReactNode, useEffect } from "react";
import { ensureAppKit } from "@/lib/ensureAppKit";
import { isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";

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

/**
 * Do not init AppKit on first paint inside MiniPay (injected wallet only).
 * Init after idle so shop / fallback modals still work without blocking LCP.
 */
export default function AppKitProviderWrapper({ children }: { children: ReactNode }) {
  useWcmModalAccessibleName();

  useEffect(() => {
    if (!isMiniPayEmbeddedWallet()) {
      ensureAppKit();
      return;
    }
    const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1));
    const cancel = window.cancelIdleCallback ?? ((id: number) => window.clearTimeout(id));
    const id = ric(() => ensureAppKit(), { timeout: 8000 });
    return () => cancel(id as number);
  }, []);

  return <>{children}</>;
}
