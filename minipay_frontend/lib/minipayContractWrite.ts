"use client";

import { ensureMiniPayWalletReady, isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";

/**
 * MiniPay: call eth_requestAccounts before contract writes.
 * Do not pass feeCurrency on writeContract — that path uses sendTransaction in MiniPay docs.
 * @see https://docs.minipay.xyz/getting-started/wallet-connection.html
 */
export async function writeContractWithMiniPay<T>(writeFn: () => Promise<T>): Promise<T> {
  if (!isMiniPayEmbeddedWallet()) {
    return writeFn();
  }
  await ensureMiniPayWalletReady();
  return writeFn();
}
