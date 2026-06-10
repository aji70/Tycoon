"use client";

import { encodeFunctionData, type Abi, type Address, type Hash } from "viem";
import {
  CELO_USDM_FEE_TOKEN,
  MINIPAY_BUY_GAS,
  MINIPAY_CONTRACT_GAS,
} from "@/lib/celoTransportForWagmi";
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
 * Try registration-style send first (no gas), then explicit gas — same as minipayRegisterPlayer.
 * @see https://docs.minipay.xyz/getting-started/examples.html
 */
export async function miniPayWriteOrFallback<T extends Hash>(opts: {
  sendTransactionAsync: WagmiSendTransaction;
  writeContractAsync: () => Promise<T>;
  to: Address;
  abi: Abi | readonly unknown[];
  functionName: string;
  args: readonly unknown[];
  /** Heavier contract calls (e.g. buyCollectible) need a higher ceiling. */
  gas?: bigint;
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

  const gas = opts.gas ?? MINIPAY_CONTRACT_GAS;
  const attempts: Array<{ to: Address; data: `0x${string}`; gas?: bigint; feeCurrency?: Address }> = [
    { to: opts.to, data },
    { to: opts.to, data, feeCurrency: CELO_USDM_FEE_TOKEN },
    { to: opts.to, data, gas },
    { to: opts.to, data, gas, feeCurrency: CELO_USDM_FEE_TOKEN },
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

/** Gas preset for reward-shop purchases (approve uses default MINIPAY_CONTRACT_GAS). */
export const MINIPAY_SHOP_BUY_GAS = MINIPAY_BUY_GAS;
