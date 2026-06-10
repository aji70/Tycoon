"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useConnectors } from "wagmi";

/**
 * MiniPay requires auto-connect on page load — never rely on a manual connect button.
 * @see https://docs.minipay.xyz/getting-started/wallet-connection.html
 */
export function useMinipayAutoConnect(): void {
  const connectors = useConnectors();
  const { address, isConnecting } = useAccount();
  const { connect } = useConnect();
  const [hasAttempted, setHasAttempted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    if (hasAttempted || address || isConnecting || connectors.length === 0) return;

    const attemptConnect = async () => {
      try {
        await connect({ connector: connectors[0] });
      } catch (err) {
        console.error("MiniPay auto-connect failed:", err);
      } finally {
        setHasAttempted(true);
      }
    };

    void attemptConnect();
  }, [connectors, connect, hasAttempted, address, isConnecting]);
}
