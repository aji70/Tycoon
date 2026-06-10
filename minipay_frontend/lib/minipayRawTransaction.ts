"use client";

import { getAddress, type Address, type Hash } from "viem";
import { CELO_USDM_FEE_TOKEN } from "@/lib/celoTransportForWagmi";
import {
  ensureMiniPayWalletReady,
  getMiniPayActiveAddress,
  isMiniPayEmbeddedWallet,
} from "@/lib/minipayGuestFlow";
import { isUserRejectedTransaction } from "@/lib/utils/contractErrors";

const CELO_CHAIN_ID_HEX = "0xa4ec";

type MiniPayProvider = {
  request: (args: { method: string; params?: readonly unknown[] }) => Promise<unknown>;
};

function getMiniPayProvider(): MiniPayProvider {
  const eth = (window as Window & { ethereum?: MiniPayProvider }).ethereum;
  if (!eth?.request) {
    throw new Error("Open Tycoon inside the MiniPay app.");
  }
  return eth;
}

async function ensureCeloChain(provider: MiniPayProvider): Promise<void> {
  const chainId = (await provider.request({ method: "eth_chainId" })) as string;
  if (chainId?.toLowerCase() === CELO_CHAIN_ID_HEX) return;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CELO_CHAIN_ID_HEX }],
    });
  } catch {
    // MiniPay is Celo mainnet only
  }
}

/**
 * Send via `window.ethereum.request(eth_sendTransaction)` with explicit `from`.
 * MiniPay returns "invalid sender address null" when `from` is omitted on some contract calls.
 */
export async function minipayEthSendTransaction(tx: {
  to: Address;
  data: `0x${string}`;
  feeCurrency?: Address;
  from?: Address;
}): Promise<Hash> {
  if (!isMiniPayEmbeddedWallet()) {
    throw new Error("Not running in MiniPay");
  }

  const from = getAddress(tx.from ?? (await ensureMiniPayWalletReady()) ?? (await getMiniPayActiveAddress()));
  const provider = getMiniPayProvider();
  await ensureCeloChain(provider);

  const to = getAddress(tx.to);
  const attempts: Array<Record<string, string>> = [
    { from, to, data: tx.data },
    { from, to, data: tx.data, feeCurrency: CELO_USDM_FEE_TOKEN },
  ];
  if (tx.feeCurrency) {
    attempts.unshift({ from, to, data: tx.data, feeCurrency: tx.feeCurrency });
  }

  let lastError: unknown;
  for (const params of attempts) {
    try {
      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [params],
      });
      if (typeof hash !== "string" || !hash.startsWith("0x")) {
        throw new Error("MiniPay did not return a transaction hash");
      }
      return hash as Hash;
    } catch (err) {
      lastError = err;
      if (isUserRejectedTransaction(err)) throw err;
    }
  }
  throw lastError ?? new Error("MiniPay could not send transaction");
}
