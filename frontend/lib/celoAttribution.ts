import { toDataSuffix } from '@celo/attribution-tags';
import type { Hex } from 'viem';

/**
 * ERC-8021 attribution codes for Tycoon on Celo.
 * Primary: MiniPay-issued code. Secondary: prior hackathon code (multi-code suffix).
 * Override with NEXT_PUBLIC_CELO_ATTRIBUTION_TAG (comma-separated for multiple).
 */
const DEFAULT_ATTRIBUTION_CODES = ['celo_cyfvindj', 'celo_e62d1c6c9f82'] as const;

function parseAttributionCodes(raw: string | undefined): string[] {
  if (!raw?.trim()) return [...DEFAULT_ATTRIBUTION_CODES];
  const codes = raw
    .split(',')
    .map((c) => c.trim())
    .filter((c) => /^[a-z0-9_]{1,32}$/i.test(c));
  return codes.length > 0 ? codes : [...DEFAULT_ATTRIBUTION_CODES];
}

export const CELO_ATTRIBUTION_CODES = parseAttributionCodes(
  typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_CELO_ATTRIBUTION_TAG : undefined
);

/** First / primary code (MiniPay-issued by default). */
export const CELO_ATTRIBUTION_TAG = CELO_ATTRIBUTION_CODES[0];

const ATTRIBUTION_SUFFIX = toDataSuffix(
  CELO_ATTRIBUTION_CODES.length === 1 ? CELO_ATTRIBUTION_CODES[0] : CELO_ATTRIBUTION_CODES
) as Hex;

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
