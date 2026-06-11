"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useConnectors } from "wagmi";
import { authorizeMiniPayWallet, isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";

/**
 * MiniPay requires auto-connect on page load — never rely on a manual connect button.
 * With AppKit, connectors[0] is often WalletConnect; always pick injected in MiniPay.
 * @see https://docs.minipay.xyz/getting-started/wallet-connection.html
 */
export function useMinipayAutoConnect(): void {
  const connectors = useConnectors();
  const { address, isConnecting } = useAccount();
  const { connect } = useConnect();
  const [hasAttempted, setHasAttempted] = useState(false);

  // Authorize MiniPay provider on load so eth_accounts is populated before any payment.
  useEffect(() => {
    if (!isMiniPayEmbeddedWallet()) return;
    void authorizeMiniPayWallet().catch((err) => {
      console.warn("MiniPay authorize on load:", err);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    if (hasAttempted || address || isConnecting || connectors.length === 0) return;

    const attemptConnect = async () => {
      try {
        const injected =
          connectors.find((c) => c.id === "injected") ??
          connectors.find((c) => c.type === "injected") ??
          connectors.find((c) => c.name?.toLowerCase().includes("injected"));

        // In MiniPay never auto-connect WalletConnect — it causes "unknown RPC error" on writes.
        const connector =
          isMiniPayEmbeddedWallet() && injected ? injected : injected ?? connectors[0];

        await connect({ connector });
        // Authorize session once so payment sends can use eth_accounts (friend's revive pattern).
        if (isMiniPayEmbeddedWallet()) {
          await authorizeMiniPayWallet();
        }
      } catch (err) {
        console.error("MiniPay auto-connect failed:", err);
      } finally {
        setHasAttempted(true);
      }
    };

    void attemptConnect();
  }, [connectors, connect, hasAttempted, address, isConnecting]);
}
