import { waitForTransactionReceipt, writeContract } from "@wagmi/core";
import { encodeFunctionData, type Address, type Hash } from "viem";
import { celo } from "wagmi/chains";
import TycoonABI from "@/context/abi/tycoonabi.json";
import { minipayContractWriteOverrides } from "@/lib/celoTransportForWagmi";

export {
  celoTransportForWagmi,
  MINIPAY_REGISTER_GAS,
  minipayContractWriteOverrides,
} from "@/lib/celoTransportForWagmi";

export {
  CELO_CUSD_FEE_CURRENCY,
  MINIPAY_FEE_CURRENCY,
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
    functionName: "registerPlayer",
    args: [username],
    chainId: celo.id,
    ...minipayContractWriteOverrides(),
  });

  await waitForTransactionReceipt(wagmiConfig, { hash, chainId: celo.id });
  return hash;
}

/** Encode register calldata (e.g. debugging or future provider-specific send). */
export function encodeRegisterPlayerWithoutWalletCalldata(username: string): `0x${string}` {
  return encodeFunctionData({
    abi: TycoonABI,
    functionName: "registerPlayer",
    args: [username.trim()],
  });
}
