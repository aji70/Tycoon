// constants/contracts.ts
import { Address } from 'viem';
import { celo } from 'wagmi/chains';

// This frontend is Celo-only. Both env vars should be the proxy (0xA97f...), not the implementation.
export const TYCOON_CONTRACT_ADDRESSES: Record<number, Address | undefined> = {
  [celo.id]: (process.env.NEXT_PUBLIC_CELO_UPGRADEABLE || process.env.NEXT_PUBLIC_CELO) as Address,
};
export const REWARD_CONTRACT_ADDRESSES: Record<number, Address | undefined> = {
  [celo.id]: process.env.NEXT_PUBLIC_CELO_REWARD as Address,
};
/** TYC ERC20 token address (must be the token contract, not the reward contract). Use useRewardTokenAddresses() in shop for addresses that match the reward contract. */
export const TYC_TOKEN_ADDRESS: Record<number, Address | undefined> = {
  [celo.id]: (process.env.NEXT_PUBLIC_CELO_TYC || process.env.NEXT_PUBLIC_CELO_TOKEN) as Address | undefined,
};

export const USDC_TOKEN_ADDRESS: Record<number, Address | undefined> = {
  [celo.id]: process.env.NEXT_PUBLIC_CELO_USDC as Address,
};

export const AI_AGENT_REGISTRY_ADDRESSES: Record<number, Address | undefined> = {
  [celo.id]: process.env.NEXT_PUBLIC_CELO_AI_REGISTRY as Address,
};

/** User registry: one smart wallet per registered player. getWallet(owner) returns their TycoonUserWallet. */
export const USER_REGISTRY_ADDRESSES: Record<number, Address | undefined> = {
  [celo.id]: process.env.NEXT_PUBLIC_CELO_USER_REGISTRY as Address | undefined,
};

/** Tournament escrow (entry fees + prize pool). ABI: context/abi/TycoonTournamentEscrow.json */
export const TOURNAMENT_ESCROW_ADDRESSES: Record<number, Address | undefined> = {
  [celo.id]: (process.env.NEXT_PUBLIC_CELO_TOURNAMENT_ESCROW || process.env.NEXT_PUBLIC_CELO_TOURNAMENT_ESCROW_ADDRESS) as Address | undefined,
};

export const MINIPAY_CHAIN_IDS = [42220]; // Celo Mainnet

/** ERC-8004 Agent Trust Protocol (Celo). See https://docs.celo.org/build-on-celo/build-with-ai/8004 */
export const ERC8004_REPUTATION_REGISTRY_ADDRESSES: Record<number, Address | undefined> = {
  [celo.id]: (process.env.NEXT_PUBLIC_ERC8004_REPUTATION as Address) || ('0x8004BAa17C55a88189AE136b182e5fdA19dE9b63' as Address),
};
export const ERC8004_IDENTITY_REGISTRY_ADDRESS = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as Address;