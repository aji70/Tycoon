import { custom, http, type Transport } from "viem";
import { celo } from "wagmi/chains";
import { getCeloRpcUrlForChainId } from "@/lib/utils/erc8004InjectedEoa";

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
