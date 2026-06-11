"use client";

import { celo } from "wagmi/chains";
import { encodeFunctionData, getAddress, type Address, type Hash } from "viem";
import TycoonABI from "@/context/abi/tycoonabi.json";
import { TYCOON_CONTRACT_ADDRESSES } from "@/constants/contracts";
import { CELO_USDM_FEE_TOKEN } from "@/lib/celoTransportForWagmi";
import { isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";
import { apiClient } from "@/lib/api";
import {
  collectErrorTextForMiniPay,
  isUserRejectedTransaction,
} from "@/lib/utils/contractErrors";

const CELO_CHAIN_ID_HEX = "0xa4ec";

/** Match backend `sanitizeContractUsername` — avoids on-chain / fee-abstraction failures. */
function contractSafeUsername(display: string): string {
  const raw = display.trim();
  if (!raw) throw new Error("Username cannot be empty");
  const ascii = raw.replace(/[^\w-]/g, "");
  let candidate = ascii || raw;
  if (candidate.length > 32) candidate = candidate.slice(0, 32);
  if (!candidate) throw new Error("Use letters and numbers in your username");
  return candidate;
}

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

async function getActiveMiniPayAccount(provider: MiniPayProvider): Promise<Address> {
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!Array.isArray(accounts) || !accounts[0]) {
    throw new Error("MiniPay did not return a wallet address.");
  }
  return getAddress(accounts[0] as Address);
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
    // MiniPay mainnet only
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

/**
 * MiniPay wallet registration — `registerPlayerWithoutWallet` (no smart-wallet deploy).
 * Legacy tx only: no `from`, no EIP-1559 fields. feeCurrency only USDm if needed (Celo docs).
 */
async function registerViaMiniPayProvider(displayUsername: string): Promise<Hash> {
  const username = contractSafeUsername(displayUsername);
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[celo.id];
  if (!contractAddress) {
    throw new Error("Contract not deployed on Celo");
  }

  const provider = getMiniPayProvider();
  await getActiveMiniPayAccount(provider);
  await ensureCeloChain(provider);

  const data = encodeFunctionData({
    abi: TycoonABI,
    functionName: "registerPlayerWithoutWallet",
    args: [username],
  });

  // No USDC adapter — MiniPay feeCurrency support is primarily USDm (Celo docs).
  const attempts: Array<Record<string, string>> = [
    { to: contractAddress, data },
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
  const checksummed = getAddress(address);
  const res = await apiClient.post<{
    success?: boolean;
    alreadyRegistered?: boolean;
    message?: string;
  }>("/users/register-on-chain", { address: checksummed, chain });

  const body = res.data;
  if (!body?.success) {
    throw new Error(body?.message || "Backend registration failed");
  }
  return { alreadyRegistered: body.alreadyRegistered };
}

/**
 * MiniPay on-chain registration.
 * 1) Backend-sponsored (reliable, no fee-abstraction quirks).
 * 2) Wallet `registerPlayerWithoutWallet` if backend fails.
 */
export async function completeMiniPayOnChainRegistration(
  username: string,
  address: Address
): Promise<"wallet" | "backend"> {
  if (!isMiniPayEmbeddedWallet()) {
    throw new Error("Not running in MiniPay");
  }

  const checksummed = getAddress(address);
  contractSafeUsername(username);

  try {
    await registerViaBackendNoGas(checksummed);
    return "backend";
  } catch (backendErr) {
    if (isUserRejectedTransaction(backendErr)) throw backendErr;
    try {
      await registerViaMiniPayProvider(username);
      return "wallet";
    } catch (walletErr) {
      if (isUserRejectedTransaction(walletErr)) throw walletErr;
      const backendMsg = collectErrorTextForMiniPay(backendErr);
      const walletMsg = collectErrorTextForMiniPay(walletErr);
      throw new Error(
        walletMsg.includes("invalid sender") || backendMsg.includes("invalid sender")
          ? "Registration failed. Try a shorter username (letters/numbers only) or try again in a minute."
          : backendMsg || walletMsg || "Registration failed"
      );
    }
  }
}
