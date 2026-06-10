"use client";

import { encodeFunctionData, type Abi, type Address, type Hash } from "viem";
import { minipayEthSendTransaction } from "@/lib/minipayRawTransaction";
import { ensureMiniPayWalletReady, isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";
import { isUserRejectedTransaction } from "@/lib/utils/contractErrors";

/**
 * MiniPay contract calls: raw eth_sendTransaction (registration path), not wagmi writeContract/estimateGas.
 */
export async function miniPayWriteOrFallback<T extends Hash>(opts: {
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

  try {
    return await minipayEthSendTransaction({ to: opts.to, data });
  } catch (err) {
    if (isUserRejectedTransaction(err)) throw err;
    throw err;
  }
}
