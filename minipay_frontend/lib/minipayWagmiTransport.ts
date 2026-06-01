import { waitForTransactionReceipt, writeContract } from "@wagmi/core";
import { encodeFunctionData, type Address, type Hash } from "viem";
import { celo } from "wagmi/chains";
import TycoonABI from "@/context/abi/tycoonabi.json";
import { MINIPAY_REGISTER_GAS } from "@/lib/celoTransportForWagmi";

export {
  celoTransportForWagmi,
  MINIPAY_REGISTER_GAS,
  minipayContractWriteOverrides,
} from "@/lib/celoTransportForWagmi";

/** cUSD on Celo mainnet — optional gas currency for raw provider calls. */
export const CELO_CUSD_FEE_CURRENCY = (process.env.NEXT_PUBLIC_CELO_CUSDC ||
  "0x765DE816845861e75A25fCA122bb6898B8B1282a") as Address;

/**
 * MiniPay: use @wagmi/core writeContract (same stack as create-game) with fixed gas.
 * Avoids raw eth_sendTransaction (permission denied) and sendTransaction feeCurrency typing issues.
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
    gas: MINIPAY_REGISTER_GAS,
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
