"use client";

import { celo } from "wagmi/chains";
import { encodeFunctionData, type Address, type Hash } from "viem";
import TycoonABI from "@/context/abi/tycoonabi.json";
import { TYCOON_CONTRACT_ADDRESSES } from "@/constants/contracts";
import {
  CELO_USDC_FEE_ADAPTER,
  CELO_USDM_FEE_TOKEN,
} from "@/lib/celoTransportForWagmi";
import { isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";
import { apiClient } from "@/lib/api";
import {
  collectErrorTextForMiniPay,
  isUserRejectedTransaction,
} from "@/lib/utils/contractErrors";

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
    // MiniPay mainnet only — ignore switch failures
  }
}

async function waitForReceipt(provider: MiniPayProvider, hash: Hash): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 120_000) {
    const receipt = (await provider.request({
      method: "eth_getTransactionReceipt",
      params: [hash],
    })) as { status?: string } | null;
    if (receipt) {
      if (receipt.status === "0x0") {
        throw new Error("Registration transaction reverted on-chain");
      }
      return;
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  throw new Error("Transaction confirmation timed out");
}

/** MiniPay docs: eth_sendTransaction with { to, data } — no `from`; wallet sets the sender. */
async function registerViaMiniPayProvider(username: string): Promise<Hash> {
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[celo.id];
  if (!contractAddress) {
    throw new Error("Contract not deployed on Celo");
  }

  const provider = getMiniPayProvider();
  await provider.request({ method: "eth_requestAccounts" });
  await ensureCeloChain(provider);

  const data = encodeFunctionData({
    abi: TycoonABI,
    functionName: "registerPlayer",
    args: [username.trim()],
  });

  // Let MiniPay pick gas token first; then explicit fee currencies (docs + FAQ).
  const attempts: Array<Record<string, string>> = [
    { to: contractAddress, data },
    { to: contractAddress, data, feeCurrency: CELO_USDC_FEE_ADAPTER },
    { to: contractAddress, data, feeCurrency: CELO_USDM_FEE_TOKEN },
  ];

  let lastError: unknown;
  for (const tx of attempts) {
    try {
      const hash = await provider.request({
        method: "eth_sendTransaction",
        params: [tx],
      });
      if (typeof hash !== "string" || !hash.startsWith("0x")) {
        throw new Error("MiniPay did not return a transaction hash");
      }
      await waitForReceipt(provider, hash as Hash);
      return hash as Hash;
    } catch (err) {
      lastError = err;
      if (isUserRejectedTransaction(err)) throw err;
    }
  }
  throw lastError ?? new Error("MiniPay could not send registration transaction");
}

/** Backend-sponsored on-chain registration (no wallet sign). User must exist in DB. */
export async function registerViaBackendNoGas(
  address: Address,
  chain = "Celo"
): Promise<{ alreadyRegistered?: boolean }> {
  const res = await apiClient.post<{
    success?: boolean;
    alreadyRegistered?: boolean;
    message?: string;
  }>("/users/register-on-chain", { address, chain });

  const body = res.data;
  if (!body?.success) {
    throw new Error(body?.message || "Backend registration failed");
  }
  return { alreadyRegistered: body.alreadyRegistered };
}

function isMiniPayWalletBlockedError(error: unknown): boolean {
  const hay = collectErrorTextForMiniPay(error);
  return (
    hay.includes("permission denied") ||
    hay.includes("not authorized") ||
    hay.includes("unauthorized") ||
    hay.includes("unknown rpc error") ||
    hay.includes("an unknown rpc error occurred")
  );
}

/**
 * MiniPay registration: try wallet sign (provider eth_sendTransaction), then backend no-gas.
 * Call after POST /users so backend fallback can run.
 */
export async function completeMiniPayOnChainRegistration(
  username: string,
  address: Address
): Promise<"wallet" | "backend"> {
  if (!isMiniPayEmbeddedWallet()) {
    throw new Error("Not running in MiniPay");
  }

  try {
    await registerViaMiniPayProvider(username);
    return "wallet";
  } catch (err) {
    if (isUserRejectedTransaction(err)) throw err;
    if (!isMiniPayWalletBlockedError(err)) throw err;
    await registerViaBackendNoGas(address);
    return "backend";
  }
}
