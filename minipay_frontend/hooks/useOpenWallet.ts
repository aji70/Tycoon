"use client";

import { useCallback } from "react";
import { useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { useAppKit } from "@reown/appkit/react";
import { ensureAppKit } from "@/lib/ensureAppKit";
import { isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";

/**
 * MiniPay: connect injected wallet. Other browsers: lazy-init AppKit then open modal.
 */
export function useOpenWallet() {
  const { connect } = useConnect();
  const { open } = useAppKit();

  return useCallback(() => {
    if (isMiniPayEmbeddedWallet()) {
      void connect({ connector: injected() });
      return;
    }
    ensureAppKit();
    open();
  }, [connect, open]);
}
