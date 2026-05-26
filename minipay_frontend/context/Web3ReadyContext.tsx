"use client";

import { createContext, useContext, type ReactNode } from "react";

const Web3ReadyContext = createContext(true);

export function Web3ReadyProvider({
  ready,
  children,
}: {
  ready: boolean;
  children: ReactNode;
}) {
  return (
    <Web3ReadyContext.Provider value={ready}>{children}</Web3ReadyContext.Provider>
  );
}

export function useWeb3Ready(): boolean {
  return useContext(Web3ReadyContext);
}

const MOUNT_EVENT = "tycoon:mount-web3";

export function requestWeb3Mount(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(MOUNT_EVENT));
  }
}

export { MOUNT_EVENT };
