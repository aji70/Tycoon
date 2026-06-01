import { celo } from "wagmi/chains";

/** Public Celo RPC for wagmi reads (MiniPay injected provider can fail on eth_call). */
export function getCeloRpcUrl(): string {
  return process.env.NEXT_PUBLIC_CELO_RPC_URL || "https://forno.celo.org";
}

/** This app deploys Tycoon on Celo mainnet only. */
export function getTycoonReadChainId(_wagmiChainId?: number): number {
  return celo.id;
}
