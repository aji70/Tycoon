"use client";

import { useEffect, useRef } from "react";
import { useAccount, useConnect } from "wagmi";
import { injected } from "wagmi/connectors";

/**
 * Auto-connect MiniPay's injected `window.ethereum` on load (no connect button / modal).
 */
export function useMinipayAutoConnect(): void {
  const { address, isConnecting } = useAccount();
  const { connect } = useConnect();
  const didConnectRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;
    if (address || isConnecting || didConnectRef.current) return;
    didConnectRef.current = true;
    connect({ connector: injected() });
  }, [address, isConnecting, connect]);
}
