"use client";

import {
  CELO_USDM_FEE_TOKEN,
  MINIPAY_CONTRACT_GAS,
  minipayContractWriteOverrides,
} from "@/lib/celoTransportForWagmi";
import { ensureMiniPayWalletReady, isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";
import { isUserRejectedTransaction } from "@/lib/utils/contractErrors";

type WriteExtras = Record<string, unknown>;

/**
 * MiniPay requires eth_requestAccounts before contract writes (avoids "permission denied").
 * Retries with feeCurrency / gas overrides when the default write fails.
 * @see https://docs.minipay.xyz/getting-started/wallet-connection.html
 */
export async function writeContractWithMiniPay<T>(
  writeFn: (extras: WriteExtras) => Promise<T>
): Promise<T> {
  if (!isMiniPayEmbeddedWallet()) {
    return writeFn({});
  }

  await ensureMiniPayWalletReady();

  const attempts: WriteExtras[] = [
    minipayContractWriteOverrides(),
    { gas: MINIPAY_CONTRACT_GAS, feeCurrency: CELO_USDM_FEE_TOKEN },
    { gas: MINIPAY_CONTRACT_GAS },
    {},
  ];

  let lastError: unknown;
  for (const extras of attempts) {
    try {
      return await writeFn(extras);
    } catch (err) {
      lastError = err;
      if (isUserRejectedTransaction(err)) throw err;
    }
  }
  throw lastError ?? new Error("MiniPay transaction failed");
}
