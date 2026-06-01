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

/** MiniPay `eth_estimateGas` often fails; use a safe ceiling for game txs. */
export const MINIPAY_CONTRACT_GAS = BigInt(600_000);

/** registerPlayer* mints vouchers — needs more gas than createGame. */
export const MINIPAY_REGISTER_GAS = BigInt(1_200_000);

/**
 * Celo mainnet USDC fee-currency **adapter** (not the USDC ERC-20 token).
 * MiniPay users usually hold USDC; gas must use the adapter for fee abstraction.
 * @see https://docs.minipay.xyz/technical-references/retrieve-balance.html
 */
export const CELO_USDC_FEE_ADAPTER =
  "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B" as Address;

/** Mento Dollar / USDm (cUSD) token — feeCurrency when paying gas in USDm (no adapter). */
export const CELO_USDM_FEE_TOKEN =
  "0x765DE816845861e75A25fCA122bb6898B8B1282a" as Address;

/**
 * Default gas token for game txs (createGame, joinGame, …).
 * Prefer USDC adapter; override with NEXT_PUBLIC_MINIPAY_FEE_CURRENCY.
 */
export const MINIPAY_FEE_CURRENCY = (process.env.NEXT_PUBLIC_MINIPAY_FEE_CURRENCY ||
  CELO_USDC_FEE_ADAPTER) as Address;

/** @deprecated Use CELO_USDM_FEE_TOKEN or CELO_USDC_FEE_ADAPTER */
export const CELO_CUSD_FEE_CURRENCY = CELO_USDM_FEE_TOKEN;

/** Game writes (createGame, joinGame, …) — feeCurrency + gas. */
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

/** Registration mints welcome vouchers — higher gas; let MiniPay pick fee token (no feeCurrency). */
export function minipayRegisterWriteOverrides(): { gas?: bigint } {
  if (!isMiniPayEmbeddedWallet()) return {};
  return { gas: MINIPAY_REGISTER_GAS };
}

/**
 * Registration simulate/write retries. Do not prefer USDm first — most MiniPay users hold USDC.
 * Order: wallet picks → USDC adapter → USDm token → provider default.
 */
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
