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

/** Naira vault (CELO→NGN). Used for one-click "Enable NGN withdrawals" on existing wallets. */
export const NAIRA_VAULT_ADDRESSES: Record<number, Address | undefined> = {
  [celo.id]: process.env.NEXT_PUBLIC_CELO_NAIRA_VAULT as Address | undefined,
};

/** Backend operator address for smart wallets. When set on a wallet, user can withdraw CELO/USDC when not connected. */
export const SMART_WALLET_OPERATOR_ADDRESSES: Record<number, Address | undefined> = {
  [celo.id]: process.env.NEXT_PUBLIC_SMART_WALLET_OPERATOR_ADDRESS as Address | undefined,
};

/** Backend withdrawal authority. Signs withdrawal requests only after user PIN; contract requires this for operator withdrawals. */
export const WITHDRAWAL_AUTHORITY_ADDRESSES: Record<number, Address | undefined> = {
  [celo.id]: process.env.NEXT_PUBLIC_WITHDRAWAL_AUTHORITY_ADDRESS as Address | undefined,
};

/** Swap executor: send CELO here from smart wallet; receives USDC back to the same wallet (Ubeswap CELO→USDC). */
export const SWAP_EXECUTOR_ADDRESSES: Record<number, Address | undefined> = {
  [celo.id]: process.env.NEXT_PUBLIC_CELO_SWAP_EXECUTOR_ADDRESS as Address | undefined,
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
export const ERC8004_IDENTITY_REGISTRY_ADDRESSES: Record<number, Address | undefined> = {
  42220: (process.env.NEXT_PUBLIC_ERC8004_IDENTITY as Address) || ('0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as Address),
  44787: (process.env.NEXT_PUBLIC_ERC8004_IDENTITY_ALFAJORES as Address) || ('0x8004A818BFB912233c491871b3d84c89A494BD9e' as Address),
};
// Backward-compatible alias (mainnet default).
export const ERC8004_IDENTITY_REGISTRY_ADDRESS = ERC8004_IDENTITY_REGISTRY_ADDRESSES[42220];