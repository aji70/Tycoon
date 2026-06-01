"use client";

import { useCallback } from "react";
import { useConnect } from "wagmi";
import { injected } from "wagmi/connectors";

/** Connect MiniPay / injected EOA (no modal). */
export function useConnectWallet() {
  const { connect } = useConnect();

  return useCallback(() => {
    void connect({ connector: injected() });
  }, [connect]);
}
