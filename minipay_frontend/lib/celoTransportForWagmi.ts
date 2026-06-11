import { custom, http, type Transport } from "viem";
import type { Address } from "viem";
import { celo } from "wagmi/chains";
import { getCeloRpcUrlForChainId } from "@/lib/utils/erc8004InjectedEoa";
import { isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";

/**
 * Route RPC through `window.ethereum` in the browser (MiniPay docs), not Forno HTTP.
 * @see https://docs.minipay.xyz/getting-started/project-setup.html
 */
export function celoTransportForWagmi(): Transport {
  if (typeof window !== "undefined") {
    const w = window as Window & {
      ethereum?: { isMiniPay?: boolean; providers?: { isMiniPay?: boolean; request?: unknown }[]; request?: unknown };
    };
    const eth = w.ethereum;
    if (eth && typeof eth.request === "function") {
      if (eth.isMiniPay) return custom(eth);
      const nested = eth.providers?.find((p) => p?.isMiniPay && typeof p.request === "function");
      if (nested) return custom(nested);
      if (!eth.providers?.length) return custom(eth);
    }
  }
  return http(getCeloRpcUrlForChainId(celo.id));
}

/** MiniPay `eth_estimateGas` often fails; safe ceiling for typical game txs. */
export const MINIPAY_CONTRACT_GAS = 600_000n;

/** registerPlayer mints vouchers — needs more gas than createGame. */
export const MINIPAY_REGISTER_GAS = 1_200_000n;

/**
 * Celo mainnet USDC fee-currency adapter (not the USDC ERC-20).
 * MiniPay users usually hold USDC; gas uses this adapter for fee abstraction.
 */
export const CELO_USDC_FEE_ADAPTER =
  "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B" as Address;

/** Mento Dollar / cUSD — feeCurrency when paying gas in USDm. */
export const CELO_USDM_FEE_TOKEN =
  "0x765DE816845861e75A25fCA122bb6898B8B1282a" as Address;

export const MINIPAY_FEE_CURRENCY = (process.env.NEXT_PUBLIC_MINIPAY_FEE_CURRENCY ||
  CELO_USDC_FEE_ADAPTER) as Address;

export function minipayContractWriteOverrides(): {
  gas?: bigint;
  feeCurrency?: Address;
} {
  if (!isMiniPayEmbeddedWallet()) return {};
  return {
    gas: MINIPAY_CONTRACT_GAS,
    feeCurrency: MINIPAY_FEE_CURRENCY,
  };
}

export function minipayRegisterWriteOverrides(): { gas?: bigint } {
  if (!isMiniPayEmbeddedWallet()) return {};
  return { gas: MINIPAY_REGISTER_GAS };
}

/**
 * MiniPay sendTransaction retries (docs: feeCurrency on encoded contract calls).
 * @see https://docs.minipay.xyz/getting-started/examples.html
 */
/** MiniPay feeCurrency: prefer wallet default, then USDm only (Celo docs). */
export function minipaySendTransactionAttempts(): Array<{ feeCurrency?: Address }> {
  return [{}, { feeCurrency: CELO_USDM_FEE_TOKEN }];
}

/** @deprecated Use minipaySendTransactionAttempts with useSendTransaction */
export function minipayRegistrationFeeAttempts(
  gas: bigint = MINIPAY_REGISTER_GAS
): Array<{ gas?: bigint; feeCurrency?: Address }> {
  return [
    { gas },
    { gas, feeCurrency: CELO_USDC_FEE_ADAPTER },
    { gas, feeCurrency: CELO_USDM_FEE_TOKEN },
    {},
  ];
}
