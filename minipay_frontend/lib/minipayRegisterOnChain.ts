"use client";

import { celo } from "wagmi/chains";
import {
  createWalletClient,
  custom,
  encodeFunctionData,
  getAddress,
  type Address,
  type Hash,
} from "viem";
import TycoonABI from "@/context/abi/tycoonabi.json";
import { TYCOON_CONTRACT_ADDRESSES } from "@/constants/contracts";
import { getInjectedEthereumProvider } from "@/lib/utils/erc8004InjectedEoa";

const REGISTER_GAS = 800_000n;

type InjectedProvider = {
  request: (args: { method: string; params?: readonly unknown[] }) => Promise<unknown>;
};

/** Poll receipt via MiniPay provider only — never Forno HTTP. */
async function waitForReceiptInjected(
  provider: InjectedProvider,
  hash: Hash,
  timeoutMs = 120_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
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
  throw new Error("Transaction confirmation timed out. Check your wallet activity.");
}

/**
 * Register on-chain via injected wallet (MiniPay).
 * Uses sendTransaction (no simulate/estimate) so Forno HTTP is never touched.
 */
export async function registerViaWalletSign(params: {
  finalUsername: string;
  account: Address;
}): Promise<Hash> {
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[celo.id];
  if (!contractAddress) {
    throw new Error("Contract not deployed on this chain");
  }

  const username = params.finalUsername.trim();
  if (!username) {
    throw new Error("Username cannot be empty");
  }

  const provider = getInjectedEthereumProvider();
  if (!provider) {
    throw new Error("Wallet not available. Open in MiniPay or connect your wallet.");
  }

  const account = getAddress(params.account);

  const walletClient = createWalletClient({
    account,
    chain: celo,
    transport: custom(provider),
  });

  try {
    await walletClient.switchChain({ id: celo.id });
  } catch {
    // Already on Celo or wallet will prompt on send
  }

  const data = encodeFunctionData({
    abi: TycoonABI,
    functionName: "registerPlayer",
    args: [username],
  });

  const hash = await walletClient.sendTransaction({
    account,
    chain: celo,
    to: contractAddress,
    data,
    gas: REGISTER_GAS,
  });

  await waitForReceiptInjected(provider, hash);
  return hash;
}
