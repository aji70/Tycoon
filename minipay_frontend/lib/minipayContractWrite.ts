"use client";

import { ensureMiniPayWalletReady, isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";

/**
 * MiniPay: call eth_requestAccounts before contract writes to properly authorize.
 * Prevents "permission denied" errors when wagmi's writeContract tries to request accounts again.
 */
export async function writeContractWithMiniPay<T>(writeFn: () => Promise<T>): Promise<T> {
  if (!isMiniPayEmbeddedWallet()) {
    return writeFn();
  }
  // Ensure wallet is ready BEFORE wagmi tries to send the transaction
  await ensureMiniPayWalletReady();
  return writeFn();
}
