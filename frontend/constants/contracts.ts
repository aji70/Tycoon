// constants/contracts.ts
import { Address } from 'viem';
import { celo, base, polygon } from 'wagmi/chains'; // import your chains

export const PLAYER_CONTRACT_ADDRESSES: Record<number, Address | undefined> = {
  [celo.id]: process.env.NEXT_PUBLIC_CELO as Address,
  [base.id]: process.env.NEXT_PUBLIC_BASE as Address,
//   [polygon.id]: process.env.NEXT_PUBLIC_CELO as Address,
  // Add more chains as needed
  // If not deployed → leave undefined
};