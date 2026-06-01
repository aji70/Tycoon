import { wagmiConfig } from "@/config";
import { sendTransaction, waitForTransactionReceipt } from "@wagmi/core";
import { encodeFunctionData, type Address, type Hash } from "viem";
import { custom, http, type Transport } from "viem";
import { celo } from "wagmi/chains";
import TycoonABI from "@/context/abi/tycoonabi.json";
import { getCeloRpcUrlForChainId } from "@/lib/utils/erc8004InjectedEoa";
import { isUserRejectedTransaction } from "@/lib/utils/contractErrors";

/** cUSD on Celo mainnet — MiniPay users often pay gas in cUSD, not CELO. */
const CELO_CUSD_FEE_CURRENCY = (process.env.NEXT_PUBLIC_CELO_CUSDC ||
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

/** MiniPay `eth_estimateGas` often fails on register; fixed limit avoids UnknownRpcError. */
export const MINIPAY_REGISTER_GAS = 600_000n;

export function minipayContractWriteOverrides(): { gas?: bigint } {
  if (typeof window === "undefined") return {};
  const eth = (window as Window & { ethereum?: { isMiniPay?: boolean } }).ethereum;
  if (eth?.isMiniPay) return { gas: MINIPAY_REGISTER_GAS };
  return {};
}

/**
 * Register via wagmi `sendTransaction` (MiniPay-recommended), not raw `eth_sendTransaction`.
 * Raw RPC with explicit `from` + `wallet_switchEthereumChain` often returns "permission denied".
 */
export async function registerPlayerViaMiniPayInjected(params: {
  contractAddress: Address;
  username: string;
}): Promise<Hash> {
  const username = params.username.trim();
  if (!username) throw new Error("Username cannot be empty");

  const data = encodeFunctionData({
    abi: TycoonABI,
    functionName: "registerPlayerWithoutWallet",
    args: [username],
  });

  const baseTx = {
    chainId: celo.id,
    to: params.contractAddress,
    data,
    gas: MINIPAY_REGISTER_GAS,
  };

  let hash: Hash;
  try {
    // Pay gas in cUSD (typical MiniPay balance)
    hash = await sendTransaction(wagmiConfig, {
      ...baseTx,
      feeCurrency: CELO_CUSD_FEE_CURRENCY,
    } as Parameters<typeof sendTransaction>[1]);
  } catch (firstErr: unknown) {
    if (isUserRejectedTransaction(firstErr)) throw firstErr;
    const hay = String((firstErr as Error)?.message ?? "").toLowerCase();
    // Retry with native CELO gas if cUSD fee currency is rejected
    if (hay.includes("permission") || hay.includes("fee") || hay.includes("currency")) {
      hash = await sendTransaction(wagmiConfig, baseTx);
    } else {
      throw firstErr;
    }
  }

  await waitForTransactionReceipt(wagmiConfig, { hash, chainId: celo.id });
  return hash;
}
