import { custom, http, type Transport } from "viem";
import type { Address } from "viem";
import { celo } from "wagmi/chains";
import { getCeloRpcUrlForChainId } from "@/lib/utils/erc8004InjectedEoa";
import { isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";

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

/** MiniPay `eth_estimateGas` often fails; use a safe ceiling. */
export const MINIPAY_REGISTER_GAS = BigInt(600_000);

/**
 * Pay gas with cUSD (or env override) — MiniPay users rarely hold CELO.
 * @see https://docs.celo.org/build-on-celo/build-on-minipay/quickstart
 */
export const MINIPAY_FEE_CURRENCY = (process.env.NEXT_PUBLIC_MINIPAY_FEE_CURRENCY ||
  process.env.NEXT_PUBLIC_CELO_CUSDC ||
  "0x765DE816845861e75A25fCA122bb6898B8B1282a") as Address;

/** @deprecated Use MINIPAY_FEE_CURRENCY */
export const CELO_CUSD_FEE_CURRENCY = MINIPAY_FEE_CURRENCY;

/** Game writes (createGame, joinGame, …) — feeCurrency + gas. */
export function minipayContractWriteOverrides(): {
  gas?: bigint;
  feeCurrency?: Address;
} {
  if (!isMiniPayEmbeddedWallet()) return {};
  return {
    gas: MINIPAY_REGISTER_GAS,
    feeCurrency: MINIPAY_FEE_CURRENCY,
  };
}
