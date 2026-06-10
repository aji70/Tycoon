"use client";

import { encodeFunctionData, type Abi, type Address, type Hash } from "viem";
import { CELO_USDM_FEE_TOKEN } from "@/lib/celoTransportForWagmi";
import { ensureMiniPayWalletReady, isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";
import { isUserRejectedTransaction } from "@/lib/utils/contractErrors";

type WagmiSendTransaction = (variables: {
  to: Address;
  data: `0x${string}`;
  gas?: bigint;
  feeCurrency?: Address;
}) => Promise<Hash>;

/**
 * MiniPay ERC-20 approve path: sendTransaction without explicit gas (wallet sets gas + fee currency).
 * Do not pass `gas` — MiniPay reserves fee headroom from the limit and users see "gas" errors at 600k–1M.
 * @see minipayRegisterPlayer.ts, useCreateGame (writeContract, no gas override)
 */
export async function miniPayWriteOrFallback<T extends Hash>(opts: {
  sendTransactionAsync: WagmiSendTransaction;
  writeContractAsync: () => Promise<T>;
  to: Address;
  abi: Abi | readonly unknown[];
  functionName: string;
  args: readonly unknown[];
}): Promise<T | Hash> {
  if (!isMiniPayEmbeddedWallet()) {
    return opts.writeContractAsync();
  }

  await ensureMiniPayWalletReady();

  const data = encodeFunctionData({
    abi: opts.abi as Abi,
    functionName: opts.functionName,
    args: opts.args,
  });

  const attempts: Array<{ to: Address; data: `0x${string}`; feeCurrency?: Address }> = [
    { to: opts.to, data },
    { to: opts.to, data, feeCurrency: CELO_USDM_FEE_TOKEN },
  ];

  let lastError: unknown;
  for (const tx of attempts) {
    try {
      return await opts.sendTransactionAsync(tx);
    } catch (err) {
      lastError = err;
      if (isUserRejectedTransaction(err)) throw err;
    }
  }
  throw lastError ?? new Error("MiniPay transaction failed");
}
