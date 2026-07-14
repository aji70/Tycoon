import { toDataSuffix } from '@celo/attribution-tags';
import type { Hex } from 'viem';

/** Locked to aji70/Tycoon — Agentic Payments & DeFAI hackathon attribution tag */
export const CELO_ATTRIBUTION_TAG =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_CELO_ATTRIBUTION_TAG?.trim()) ||
  'celo_e62d1c6c9f82';

const ATTRIBUTION_SUFFIX = toDataSuffix(CELO_ATTRIBUTION_TAG) as Hex;

const CELO_MAINNET_CHAIN_ID = 42220;
const CELO_SEPOLIA_CHAIN_ID = 11142220;

export function isCeloChainId(chainId: number | undefined | null): boolean {
  return chainId === CELO_MAINNET_CHAIN_ID || chainId === CELO_SEPOLIA_CHAIN_ID;
}

/** Append ERC-8021 suffix to calldata. Idempotent if already tagged. */
export function appendAttributionTag(data?: Hex | string | null): Hex {
  const base = !data || data === '0x' ? '0x' : String(data);
  const suffixBody = ATTRIBUTION_SUFFIX.slice(2).toLowerCase();
  if (base.toLowerCase().endsWith(suffixBody)) return base as Hex;
  return (base === '0x' ? ATTRIBUTION_SUFFIX : (`${base}${ATTRIBUTION_SUFFIX.slice(2)}` as Hex));
}

export function getAttributionDataSuffix(): Hex {
  return ATTRIBUTION_SUFFIX;
}
