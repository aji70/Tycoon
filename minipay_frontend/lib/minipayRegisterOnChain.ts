"use client";

import { getConnectorClient } from "@wagmi/core";
import { waitForTransactionReceipt } from "viem/actions";
import { celo } from "wagmi/chains";
import { wagmiConfig } from "@/config";
import { TYCOON_CONTRACT_ADDRESSES } from "@/constants/contracts";
import TycoonABI from "@/context/abi/tycoonabi.json";

/**
 * Register via the connected wallet (MiniPay injected provider).
 * Uses the connector client so simulate + send + receipt all go through the wallet RPC,
 * not a separate public HTTP endpoint (which fails in the MiniPay WebView).
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

  const client = await getConnectorClient(wagmiConfig, { chainId: celo.id });
  const hash = await client.writeContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: "registerPlayer",
    args: [username],
  });

  await waitForTransactionReceipt(client, { hash });
}
