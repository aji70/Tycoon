"use client";

import { encodeFunctionData, type Abi, type Address, type Hash } from "viem";
import { minipaySendTransactionAttempts } from "@/lib/celoTransportForWagmi";
import { minipayEthSendTransaction } from "@/lib/minipayRawTransaction";
import { ensureMiniPayWalletReady, isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";
import { isUserRejectedTransaction } from "@/lib/utils/contractErrors";

type WagmiSendTransaction = (variables: {
  to: Address;
  data: `0x${string}`;
  feeCurrency?: Address;
}) => Promise<Hash>;

function isPermissionDenied(err: unknown): boolean {
  const hay = String((err as { message?: string })?.message ?? err).toLowerCase();
  return (
    hay.includes("permission denied") ||
    hay.includes("not authorized") ||
    hay.includes("unauthorized")
  );
}

/**
 * MiniPay shop/approve path — same as registration: wagmi sendTransaction without `from` or gas,
 * then raw provider fallback. Explicit `from` causes "permission denied" on many builds.
 */
export async function miniPayWriteOrFallback<T extends Hash>(opts: {
  sendTransactionAsync?: WagmiSendTransaction;
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

  const base = { to: opts.to, data };
  let lastError: unknown;

  if (opts.sendTransactionAsync) {
    for (const attempt of minipaySendTransactionAttempts()) {
      try {
        return await opts.sendTransactionAsync({ ...base, ...attempt });
      } catch (err) {
        lastError = err;
        if (isUserRejectedTransaction(err)) throw err;
      }
    }
  }

  try {
    return await minipayEthSendTransaction(base);
  } catch (err) {
    lastError = err;
    if (isUserRejectedTransaction(err)) throw err;
    if (!isPermissionDenied(err)) throw err;
  }

  if (opts.sendTransactionAsync) {
    for (const attempt of minipaySendTransactionAttempts()) {
      try {
        return await opts.sendTransactionAsync({ ...base, ...attempt });
      } catch (err) {
        lastError = err;
        if (isUserRejectedTransaction(err)) throw err;
      }
    }
  }

  throw lastError ?? new Error("MiniPay transaction failed");
}
