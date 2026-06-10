"use client";

import { encodeFunctionData, type Abi, type Address, type Hash } from "viem";
import { minipayEthSendTransaction } from "@/lib/minipayRawTransaction";
import { ensureMiniPayWalletReady, isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";
import { isUserRejectedTransaction } from "@/lib/utils/contractErrors";

/**
 * MiniPay contract calls: raw eth_sendTransaction with explicit `from` (registration path).
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

  const from = await ensureMiniPayWalletReady();
  if (!from) {
    throw new Error("MiniPay wallet address not available");
  }

  const data = encodeFunctionData({
    abi: opts.abi as Abi,
    functionName: opts.functionName,
    args: opts.args,
  });

  try {
    return await minipayEthSendTransaction({ to: opts.to, data, from });
  } catch (err) {
    if (isUserRejectedTransaction(err)) throw err;
    throw err;
  }
}
