"use client";

import { useEffect, useRef } from "react";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";

/**
 * Connect the injected MiniPay wallet as soon as the app loads (no Reown/AppKit modal).
 */
export function useMinipayAutoConnect(): void {
  const { address, isConnecting } = useAccount();
  const { connect } = useConnect();
  const didConnectRef = useRef(false);

  useEffect(() => {
    if (!isMiniPayEmbeddedWallet()) return;
    if (address || isConnecting || didConnectRef.current) return;
    didConnectRef.current = true;
    connect({ connector: injected() });
  }, [address, isConnecting, connect]);
}
