"use client";

import { waitForTransactionReceipt, writeContract } from "@wagmi/core/actions";
import { celo } from "wagmi/chains";
import { wagmiConfig } from "@/config";
import { TYCOON_CONTRACT_ADDRESSES } from "@/constants/contracts";
import TycoonABI from "@/context/abi/tycoonabi.json";

/**
 * Register via the connected wallet (MiniPay).
 * Uses wagmi `writeContract` (not raw connector client — base Client has no writeContract).
 */
export async function registerViaWalletSign(params: { finalUsername: string }): Promise<void> {
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[celo.id];
  if (!contractAddress) {
    throw new Error("Contract not deployed on this chain");
  }

  const username = params.finalUsername.trim();
  if (!username) {
    throw new Error("Username cannot be empty");
  }

  const hash = await writeContract(wagmiConfig, {
    address: contractAddress,
    abi: TycoonABI,
    functionName: "registerPlayer",
    args: [username],
    chainId: celo.id,
  });

  await waitForTransactionReceipt(wagmiConfig, {
    hash,
    chainId: celo.id,
  });
}
