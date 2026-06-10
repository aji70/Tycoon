"use client";

import { encodeFunctionData, type Abi, type Address, type Hash } from "viem";
import { MINIPAY_CONTRACT_GAS, minipaySendTransactionAttempts } from "@/lib/celoTransportForWagmi";
import { ensureMiniPayWalletReady, isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";
import { isUserRejectedTransaction } from "@/lib/utils/contractErrors";

type WagmiSendTransaction = (variables: {
  to: Address;
  data: `0x${string}`;
  gas?: bigint;
  feeCurrency?: Address;
}) => Promise<Hash>;

/**
 * MiniPay often fails eth_estimateGas (viem shows "An unknown RPC error occurred").
 * Use sendTransaction + explicit gas + feeCurrency retries — same pattern as registration.
 * @see https://docs.minipay.xyz/getting-started/examples.html
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

  const base = { to: opts.to, data, gas: MINIPAY_CONTRACT_GAS };
  const attempts = minipaySendTransactionAttempts().map((extra) => ({ ...base, ...extra }));

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
