import type { Hash, PublicClient } from "viem";

/** Wallet registration: writeContract → MiniPay sign → wait for receipt (same as createGame / shop). */
export async function registerViaWalletSign(params: {
  registerPlayer: (username: string) => Promise<Hash | undefined>;
  publicClient: PublicClient | undefined;
  finalUsername: string;
}): Promise<void> {
  const txHash = await params.registerPlayer(params.finalUsername.trim());
  if (txHash && params.publicClient) {
    await params.publicClient.waitForTransactionReceipt({ hash: txHash });
  }
}
