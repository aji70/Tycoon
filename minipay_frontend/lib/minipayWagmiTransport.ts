import { waitForTransactionReceipt, writeContract } from "@wagmi/core";
import { encodeFunctionData, type Address, type Hash } from "viem";
import { celo } from "wagmi/chains";
import TycoonABI from "@/context/abi/tycoonabi.json";
import {
  minipayContractWriteOverrides,
  minipayRegisterWriteOverrides,
} from "@/lib/celoTransportForWagmi";

export {
  celoTransportForWagmi,
  MINIPAY_REGISTER_GAS,
  minipayContractWriteOverrides,
  minipayRegisterWriteOverrides,
} from "@/lib/celoTransportForWagmi";

export {
  CELO_CUSD_FEE_CURRENCY,
  CELO_USDC_FEE_ADAPTER,
  CELO_USDM_FEE_TOKEN,
  MINIPAY_FEE_CURRENCY,
  minipayRegistrationFeeAttempts,
} from "@/lib/celoTransportForWagmi";

/**
 * MiniPay: use @wagmi/core writeContract (same stack as create-game) with fixed gas + feeCurrency.
 */
export async function registerPlayerViaMiniPayInjected(params: {
  contractAddress: Address;
  username: string;
}): Promise<Hash> {
  const username = params.username.trim();
  if (!username) throw new Error("Username cannot be empty");

  const { wagmiConfig } = await import("@/config");
  const hash = await writeContract(wagmiConfig, {
    address: params.contractAddress,
    abi: TycoonABI,
    functionName: "registerPlayerWithoutWallet",
    args: [username],
    chainId: celo.id,
    ...minipayRegisterWriteOverrides(),
  });

  await waitForTransactionReceipt(wagmiConfig, { hash, chainId: celo.id });
  return hash;
}

/** Encode register calldata (e.g. debugging or future provider-specific send). */
export function encodeRegisterPlayerWithoutWalletCalldata(username: string): `0x${string}` {
  return encodeFunctionData({
    abi: TycoonABI,
    functionName: "registerPlayerWithoutWallet",
    args: [username.trim()],
  });
}
