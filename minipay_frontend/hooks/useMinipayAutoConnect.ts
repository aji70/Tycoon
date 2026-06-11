"use client";

import { useEffect, useState } from "react";
import { connect as wagmiConnect, disconnect, getAccount } from "@wagmi/core";
import { injected } from "wagmi/connectors";
import { useAccount, useConnect, useConnectors } from "wagmi";
import { getWagmiConfig } from "@/config";
import {
  authorizeMiniPayWallet,
  ensureInjectedMiniPayConnection,
  isMiniPayEmbeddedWallet,
} from "@/lib/minipayGuestFlow";

/**
 * MiniPay requires auto-connect on page load — never rely on a manual connect button.
 * With AppKit, connectors[0] is often WalletConnect; always pick injected in MiniPay.
 * @see https://docs.minipay.xyz/getting-started/wallet-connection.html
 */
export function useMinipayAutoConnect(): void {
  const connectors = useConnectors();
  const { address, isConnecting, connector } = useAccount();
  const { connect } = useConnect();
  const [hasAttempted, setHasAttempted] = useState(false);

  // Drop persisted WalletConnect sessions — they cause permission denied on raw sends.
  useEffect(() => {
    if (!isMiniPayEmbeddedWallet()) return;

    const config = getWagmiConfig();
    const account = getAccount(config);
    if (account.isConnected && account.connector?.id !== "injected") {
      void (async () => {
        try {
          await disconnect(config);
          await wagmiConnect(config, { connector: injected() });
          await authorizeMiniPayWallet();
        } catch (err) {
          console.warn("MiniPay connector switch:", err);
        }
      })();
    }
  }, [connector?.id]);

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
        if (isMiniPayEmbeddedWallet()) {
          await ensureInjectedMiniPayConnection();
          await authorizeMiniPayWallet();
          return;
        }

        const injectedConnector =
          connectors.find((c) => c.id === "injected") ??
          connectors.find((c) => c.type === "injected") ??
          connectors.find((c) => c.name?.toLowerCase().includes("injected"));

        await connect({ connector: injectedConnector ?? connectors[0] });
      } catch (err) {
        console.error("MiniPay auto-connect failed:", err);
      } finally {
        setHasAttempted(true);
      }
    };

    void attemptConnect();
  }, [connectors, connect, hasAttempted, address, isConnecting]);
}
