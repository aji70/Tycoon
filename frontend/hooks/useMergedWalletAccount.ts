"use client";

import { useAccount } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import { isAddress } from "viem";

/**
 * Merges wagmi `useAccount` and Reown AppKit `useAppKitAccount`.
 * Desktop often connects via AppKit while other hooks only read wagmi — this keeps them in sync.
 */
export function useMergedWalletAccount() {
  const {
    address: wagmiAddress,
    isConnected: wagmiConnected,
    isConnecting: wagmiConnecting,
  } = useAccount();
  const { address: appKitAddress, isConnected: appKitConnected } = useAppKitAccount();

  const address = wagmiAddress ?? appKitAddress ?? undefined;
  const isConnected = wagmiConnected || appKitConnected;
  const safeAddress =
    address && isAddress(address) ? (address as `0x${string}`) : undefined;

  return {
    address,
    safeAddress,
    isConnected,
    isConnecting: wagmiConnecting,
    wagmiAddress,
    appKitAddress,
    wagmiConnected,
    appKitConnected,
  };
}
