'use client';

import { createContext, useContext, useCallback, useMemo } from 'react';
import {
  useReadContract,
  useWriteContract,
  useAccount,
  useWaitForTransactionReceipt,
  useChainId,
} from 'wagmi';
import { Address, Hash } from 'viem';
import TycoonABI from './abi/tycoonabi.json';        // Must contain the latest ABI
import RewardABI from './abi/rewardabi.json';       // Latest RewardSystem ABI
import { TYCOON_CONTRACT_ADDRESSES, REWARD_CONTRACT_ADDRESSES } from '@/constants/contracts';

const STAKE_AMOUNT = BigInt(1); // BigInt literal for consistency (was 1 in contract)

/* ── Types ──────────────────────────────────────────────────────────────────────── */

export type User = {
  id: bigint;
  username: string;
  playerAddress: Address;
  registeredAt: bigint;
  gamesPlayed: bigint;
  gamesWon: bigint;
  gamesLost: bigint;
  totalStaked: bigint;
  totalEarned: bigint;
  totalWithdrawn: bigint;
};

export type GameSettings = {
  maxPlayers: number;
  privateRoomCode: string;
  auction: boolean;
  rentInPrison: boolean;
  mortgage: boolean;
  evenBuild: boolean;
  startingCash: bigint;
};

export type Game = {
  id: bigint;
  code: string;
  creator: Address;
  status: number;
  nextPlayer: number;
  winner: Address;
  numberOfPlayers: number;
  joinedPlayers: number;
  mode: number;
  ai: boolean;
  createdAt: bigint;
  endedAt: bigint;
  totalStaked: bigint;
};

export type GamePlayer = {
  gameId: bigint;
  playerAddress: Address;
  balance: bigint;
  position: number;
  order: number;
  symbol: number;
  username: string;
};

export enum CollectiblePerk {
  NONE = 0,
  EXTRA_TURN,
  JAIL_FREE,
  DOUBLE_RENT,
  ROLL_BOOST,
  CASH_TIERED,
  TELEPORT,
  SHIELD,
  PROPERTY_DISCOUNT,
  TAX_REFUND,
  ROLL_EXACT,
}

export type RewardCollectibleInfo = {
  perk: CollectiblePerk;
  strength: bigint;
  tycPrice: bigint;
  usdcPrice: bigint;
  shopStock: bigint;
};

// Return type of getCollectibleInfo() — matches the struct in Solidity
export type CollectibleInfoTuple = [
  number,      // perk (enum as uint8)
  bigint,      // strength (uint256)
  bigint,      // tycPrice (uint256)
  bigint,      // usdcPrice (uint256)
  bigint       // shopStock (uint256)
];

export const VOUCHER_ID_START = 1000000000;
export const COLLECTIBLE_ID_START = 2000000000;

export const isVoucherToken = (tokenId: bigint): boolean =>
  tokenId >= VOUCHER_ID_START && tokenId < COLLECTIBLE_ID_START;

export const isCollectibleToken = (tokenId: bigint): boolean =>
  tokenId >= COLLECTIBLE_ID_START;

/* ── Tycoon Hooks ──────────────────────────────────────────────────────────────── */

export function useIsRegistered(address?: Address) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  return useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'registered',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });
}

export function useGetUsername(address?: Address) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  return useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'addressToUsername',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });
}

export function useGetUser(username?: string) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'getUser',
    args: username ? [username] : undefined,
    query: { enabled: !!username && !!contractAddress },
  });

  return {
    ...result,
    data: result.data as User | undefined,
  };
}

export function useGetGame(gameId?: bigint | number) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'getGame',
    args: gameId !== undefined ? [BigInt(gameId)] : undefined,
    query: { enabled: gameId !== undefined && !!contractAddress },
  });

  return {
    ...result,
    data: result.data as Game | undefined,
  };
}

export function useGetGamePlayerByAddress(gameId?: bigint | number, address?: Address) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'getGamePlayerByAddress',
    args: gameId !== undefined && address ? [BigInt(gameId), address] : undefined,
    query: { enabled: gameId !== undefined && !!address && !!contractAddress },
  });

  return {
    ...result,
    data: result.data as GamePlayer | undefined,
  };
}

export function useGetGameByCode(code?: string) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  return useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'getGameByCode',
    args: code ? [code] : undefined,
    query: { enabled: !!code && !!contractAddress },
  });
}

export function useRegisterPlayer() {
  const { writeContractAsync } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const register = useCallback(async (username: string): Promise<Hash> => {
    if (!contractAddress) throw new Error('Tycoon contract not deployed on this chain');
    if (!username.trim()) throw new Error('Username cannot be empty');

    return writeContractAsync({
      chainId,
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'registerPlayer',
      args: [username.trim()],
    });
  }, [writeContractAsync, chainId, contractAddress]);

  return { register };
}

export function useCreateGame() {
  const { writeContractAsync } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const create = useCallback(async (
    creatorUsername: string,
    gameType: string,
    playerSymbol: string,
    numberOfPlayers: number,
    code: string,
    startingBalance: bigint | number
  ): Promise<Hash> => {
    if (!contractAddress) throw new Error('Tycoon contract not deployed');

    return writeContractAsync({
      chainId,
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'createGame',
      args: [creatorUsername, gameType, playerSymbol, numberOfPlayers, code, BigInt(startingBalance)],
      value: STAKE_AMOUNT,
    });
  }, [writeContractAsync, chainId, contractAddress]);

  return { create };
}

export function useCreateAIGame() {
  const { writeContractAsync } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const create = useCallback(async (
    creatorUsername: string,
    gameType: string,
    playerSymbol: string,
    numberOfAI: number,
    code: string,
    startingBalance: bigint | number
  ): Promise<Hash> => {
    if (!contractAddress) throw new Error('Tycoon contract not deployed');

    return writeContractAsync({
      chainId,
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'createAIGame',
      args: [creatorUsername, gameType, playerSymbol, numberOfAI, code, BigInt(startingBalance)],
      value: STAKE_AMOUNT,
    });
  }, [writeContractAsync, chainId, contractAddress]);

  return { create };
}

export function useJoinGame() {
  const { writeContractAsync } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const join = useCallback(async (
    gameId: bigint | number,
    playerUsername: string,
    playerSymbol: string,
    joinCode: string
  ): Promise<Hash> => {
    if (!contractAddress) throw new Error('Tycoon contract not deployed');

    return writeContractAsync({
      chainId,
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'joinGame',
      args: [BigInt(gameId), playerUsername, playerSymbol, joinCode],
      value: STAKE_AMOUNT,
    });
  }, [writeContractAsync, chainId, contractAddress]);

  return { join };
}

export function useEndAIGame() {
  const { writeContractAsync } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const end = useCallback(async (
    gameId: bigint | number,
    finalPosition: number,
    finalBalance: bigint | number,
    isWin: boolean
  ): Promise<Hash> => {
    if (!contractAddress) throw new Error('Tycoon contract not deployed');

    return writeContractAsync({
      chainId,
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'endAIGameAndClaim',
      args: [BigInt(gameId), finalPosition, BigInt(finalBalance), isWin],
    });
  }, [writeContractAsync, chainId, contractAddress]);

  return { end };
}

export function useClaimReward() {
  const { writeContractAsync } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const claim = useCallback(async (gameId: bigint | number): Promise<Hash> => {
    if (!contractAddress) throw new Error('Tycoon contract not deployed');

    return writeContractAsync({
      chainId,
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'claimReward',
      args: [BigInt(gameId)],
    });
  }, [writeContractAsync, chainId, contractAddress]);

  return { claim };
}

/* ── Reward System Hooks ───────────────────────────────────────────────────────── */

export function useRewardCollectibleInfo(tokenId?: bigint) {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'getCollectibleInfo',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: !!tokenId && !!contractAddress },
  });

  // Type assertion — safest when ABI inference fails
  const rawData = result.data as CollectibleInfoTuple | undefined;

  return {
    ...result,
    data: rawData
      ? {
          perk: Number(rawData[0]) as CollectiblePerk,
          strength: rawData[1],
          tycPrice: rawData[2],
          usdcPrice: rawData[3],
          shopStock: rawData[4],
        }
      : undefined,
  };
}

export function useRewardGetCashTierValue(tier?: number) {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  return useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'getCashTierValue',
    args: tier !== undefined ? [tier] : undefined,
    query: { enabled: tier !== undefined && !!contractAddress },
  });
}

export function useRewardTokenBalance(address?: Address, tokenId?: bigint) {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  return useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'balanceOf',
    args: address && tokenId !== undefined ? [address, tokenId] : undefined,
    query: { enabled: !!address && tokenId !== undefined && !!contractAddress },
  });
}

export function useRewardRedeemVoucher() {
  const { writeContractAsync } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const redeem = useCallback(async (tokenId: bigint): Promise<Hash> => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    if (!isVoucherToken(tokenId)) throw new Error('Invalid voucher token ID');

    return writeContractAsync({
      chainId,
      address: contractAddress,
      abi: RewardABI,
      functionName: 'redeemVoucher',
      args: [tokenId],
    });
  }, [writeContractAsync, chainId, contractAddress]);

  return { redeem };
}

export function useRewardBurnCollectible() {
  const { writeContractAsync } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const burn = useCallback(async (tokenId: bigint): Promise<Hash> => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    if (!isCollectibleToken(tokenId)) throw new Error('Invalid collectible token ID');

    return writeContractAsync({
      chainId,
      address: contractAddress,
      abi: RewardABI,
      functionName: 'burnCollectibleForPerk',
      args: [tokenId],
    });
  }, [writeContractAsync, chainId, contractAddress]);

  return { burn };
}

export function useRewardBuyCollectible() {
  const { writeContractAsync } = useWriteContract();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const buy = useCallback(async (tokenId: bigint, useUsdc = false): Promise<Hash> => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    if (!isCollectibleToken(tokenId)) throw new Error('Invalid collectible token ID');

    return writeContractAsync({
      chainId,
      address: contractAddress,
      abi: RewardABI,
      functionName: 'buyCollectible',
      args: [tokenId, useUsdc],
    });
  }, [writeContractAsync, chainId, contractAddress]);

  return { buy };
}

/* ── Context Provider (optional – simplified) ──────────────────────────────────── */

type TycoonContextValue = {
  registerPlayer: (username: string) => Promise<Hash>;
  redeemVoucher: (tokenId: bigint) => Promise<Hash>;
  burnCollectible: (tokenId: bigint) => Promise<Hash>;
  buyCollectible: (tokenId: bigint, useUsdc?: boolean) => Promise<Hash>;
};

const TycoonContext = createContext<TycoonContextValue | undefined>(undefined);

export function TycoonProvider({ children }: { children: React.ReactNode }) {
  const { writeContractAsync } = useWriteContract();
  const chainId = useChainId();

  const tycoonAddr = TYCOON_CONTRACT_ADDRESSES[chainId];
  const rewardAddr = REWARD_CONTRACT_ADDRESSES[chainId];

  const value = useMemo(() => ({
    registerPlayer: async (username: string) => {
      if (!tycoonAddr) throw new Error('Tycoon not deployed');
      return writeContractAsync({
        chainId,
        address: tycoonAddr,
        abi: TycoonABI,
        functionName: 'registerPlayer',
        args: [username],
      });
    },

    redeemVoucher: async (tokenId: bigint) => {
      if (!rewardAddr) throw new Error('Reward not deployed');
      return writeContractAsync({
        chainId,
        address: rewardAddr,
        abi: RewardABI,
        functionName: 'redeemVoucher',
        args: [tokenId],
      });
    },

    burnCollectible: async (tokenId: bigint) => {
      if (!rewardAddr) throw new Error('Reward not deployed');
      return writeContractAsync({
        chainId,
        address: rewardAddr,
        abi: RewardABI,
        functionName: 'burnCollectibleForPerk',
        args: [tokenId],
      });
    },

    buyCollectible: async (tokenId: bigint, useUsdc = false) => {
      if (!rewardAddr) throw new Error('Reward not deployed');
      return writeContractAsync({
        chainId,
        address: rewardAddr,
        abi: RewardABI,
        functionName: 'buyCollectible',
        args: [tokenId, useUsdc],
      });
    },
  }), [writeContractAsync, chainId, tycoonAddr, rewardAddr]);

  return <TycoonContext.Provider value={value}>{children}</TycoonContext.Provider>;
}

export const useTycoon = () => {
  const ctx = useContext(TycoonContext);
  if (!ctx) throw new Error('useTycoon must be used within TycoonProvider');
  return ctx;
};