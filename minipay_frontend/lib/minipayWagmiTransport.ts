import { wagmiConfig } from "@/config";
import { waitForTransactionReceipt, writeContract } from "@wagmi/core";
import { encodeFunctionData, type Address, type Hash } from "viem";
import { custom, http, type Transport } from "viem";
import { celo } from "wagmi/chains";
import TycoonABI from "@/context/abi/tycoonabi.json";
import { getCeloRpcUrlForChainId } from "@/lib/utils/erc8004InjectedEoa";

/** cUSD on Celo mainnet — optional gas currency for raw provider calls. */
export const CELO_CUSD_FEE_CURRENCY = (process.env.NEXT_PUBLIC_CELO_CUSDC ||
  "0x765DE816845861e75A25fCA122bb6898B8B1282a") as Address;

/**
 * MiniPay docs: route RPC through `window.ethereum`, not a separate HTTP forno URL.
 * @see https://docs.minipay.xyz/getting-started/project-setup.html
 */
export function celoTransportForWagmi(): Transport {
  if (typeof window !== "undefined") {
    const eth = (window as Window & { ethereum?: object }).ethereum;
    if (eth) return custom(eth);
  }
  return http(getCeloRpcUrlForChainId(celo.id));
}

/** MiniPay `eth_estimateGas` often fails on register; fixed limit avoids opaque RPC errors. */
export const MINIPAY_REGISTER_GAS = BigInt(600_000);

export function minipayContractWriteOverrides(): { gas?: bigint } {
  if (typeof window === "undefined") return {};
  const eth = (window as Window & { ethereum?: { isMiniPay?: boolean } }).ethereum;
  if (eth?.isMiniPay) return { gas: MINIPAY_REGISTER_GAS };
  return {};
}

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
