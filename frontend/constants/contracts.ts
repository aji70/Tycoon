// constants/contracts.ts
import { Address } from 'viem';
import { celo } from 'wagmi/chains';

// This frontend is Celo-only. A separate Polygon frontend uses the same backend.
export const TYCOON_CONTRACT_ADDRESSES: Record<number, Address | undefined> = {
  [celo.id]: process.env.NEXT_PUBLIC_CELO as Address,
};
export const REWARD_CONTRACT_ADDRESSES: Record<number, Address | undefined> = {
  [celo.id]: process.env.NEXT_PUBLIC_CELO_REWARD as Address,
};
/** TYC ERC20 token address (must be the token contract, not the reward contract). Use useRewardTokenAddresses() in shop for addresses that match the reward contract. */
export const TYC_TOKEN_ADDRESS: Record<number, Address | undefined> = {
  [celo.id]: process.env.NEXT_PUBLIC_CELO_TYC as Address | undefined,
};

export const USDC_TOKEN_ADDRESS: Record<number, Address | undefined> = {
  [celo.id]: process.env.NEXT_PUBLIC_CELO_USDC as Address,
};

export const AI_AGENT_REGISTRY_ADDRESSES: Record<number, Address | undefined> = {
  [celo.id]: process.env.NEXT_PUBLIC_CELO_AI_REGISTRY as Address,
};

// constants/contracts.ts
export const MINIPAY_CHAIN_IDS = [42220]; // Celo Mainnet & Alfajores