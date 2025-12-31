'use client';

import { createContext, useContext, useCallback, useMemo } from 'react';
import {
  useReadContract,
  useWriteContract,
  useAccount,
  useWaitForTransactionReceipt,
  useChainId,
} from 'wagmi';
import { Address } from 'viem';
import TycoonABI from './abi/tycoonabi.json';  // Updated: Assuming you renamed ABI file
import RewardABI from './abi/rewardabi.json';
import { TYCOON_CONTRACT_ADDRESSES, REWARD_CONTRACT_ADDRESSES } from '@/constants/contracts';  // Updated constant name

const STAKE_AMOUNT = 1;  // Matches new contract: STAKE_AMOUNT = 1 (was 1e14)

/* ----------------------- Types (Updated to match new structs) ----------------------- */
type User = {  // Matches TycoonLib.User
  id: bigint;
  username: string;
  playerAddress: Address;
  registeredAt: bigint;  // was timestamp
  gamesPlayed: bigint;
  gamesWon: bigint;  // was gameWon
  gamesLost: bigint;  // was gameLost
  totalStaked: bigint;
  totalEarned: bigint;
  totalWithdrawn: bigint;
};
type UserTuple = [bigint, string, Address, bigint, bigint, bigint, bigint, bigint, bigint, bigint];  // For getUser

export type GameSettings = {  // Matches TycoonLib.GameSettings
  maxPlayers: number;
  privateRoomCode: string;  // was privateRoom
  auction: boolean;
  rentInPrison: boolean;
  mortgage: boolean;
  evenBuild: boolean;
  startingCash: bigint;
  // Removed randomizePlayOrder (not in new contract)
};

type Game = {  // Matches TycoonLib.Game
  id: bigint;  // was string
  code: string;
  creator: Address;
  status: number;
  nextPlayer: number;  // was bigint
  winner: Address;
  numberOfPlayers: number;
  joinedPlayers: number;  // New
  mode: number;
  ai: boolean;  // New
  createdAt: bigint;
  endedAt: bigint;
  totalStaked: bigint;  // New
};
type GameTuple = [bigint, string, Address, number, number, Address, number, number, number, boolean, bigint, bigint, bigint];  // For getGame

type GamePlayer = {  // Matches TycoonLib.GamePlayer (simplified)
  gameId: bigint;
  playerAddress: Address;
  balance: bigint;
  position: number;
  order: number;  // was bigint
  symbol: number;
  username: string;
  // Removed chanceJailCard, communityChestJailCard (not in new struct)
};
type GamePlayerTuple = [bigint, Address, bigint, number, number, number, string];  // For getGamePlayerByAddress

// Legacy type aliases (kept for compatibility)
type ExtendedPlayerData = User;
type ExtendedPlayerDataTuple = UserTuple;
type ExtendedGameData = Game;
type ExtendedGameDataTuple = GameTuple;
type GamePlayerData = GamePlayer;
type GamePlayerDataTuple = GamePlayerTuple;

/* ----------------------- Reward System Types (Unchanged) ----------------------- */
export enum CollectiblePerk {
  NONE,
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

export const VOUCHER_ID_START = 1_000_000_000;
export const COLLECTIBLE_ID_START = 2_000_000_000;

export const isVoucherToken = (tokenId: bigint): boolean =>
  tokenId >= VOUCHER_ID_START && tokenId < COLLECTIBLE_ID_START;

export const isCollectibleToken = (tokenId: bigint): boolean =>
  tokenId >= COLLECTIBLE_ID_START;

/* ----------------------- Tycoon Hooks (Updated + Legacy Stubs) ----------------------- */

export function useIsRegistered(address?: Address, options = { enabled: true }) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'registered',
    args: address ? [address] : undefined,
    query: {
      enabled: options.enabled && !!address && !!contractAddress,
      retry: false,
    },
  });

  return {
    data: result.data as boolean | undefined,
    isLoading: result.isLoading,
    error: result.error || (contractAddress ? null : new Error('Contract not deployed on this chain')),
  };
}
export function usePreviousGame(address?: Address, options = { enabled: true }) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'getGetLastGame',
    args: address ? [address] : undefined,
    query: {
      enabled: options.enabled && !!address && !!contractAddress,
      retry: false,
    },
  });

  return {
    data: result.data as string | undefined,
    isLoading: result.isLoading,
    error: result.error || (contractAddress ? null : new Error('Contract not deployed on this chain')),
  };
}
// Stub for legacy useIsInGame (not in new contract - logs warning)
export function useIsInGame(gameId?: number, address?: Address, options = { enabled: true }) {
  console.warn('useIsInGame: Function removed in new Tycoon contract. Implement off-chain logic.');
  return { data: false, isLoading: false, error: new Error('Not implemented') };
}

export function useGetUsername(address?: Address, options = { enabled: true }) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'addressToUsername',
    args: address ? [address] : undefined,
    query: {
      enabled: options.enabled && !!address && !!contractAddress,
      retry: false,
    },
  });

  return {
    data: result.data as string | undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

// Stub for legacy useRetrievePlayer (use getUser(username) instead)
export function useRetrievePlayer(address?: Address, options = { enabled: true }) {
  console.warn('useRetrievePlayer: Use useGetUser with username instead in new contract.');
  return { data: undefined, isLoading: false, error: new Error('Deprecated') };
}

export function useCreateGame(
  creatorUsername: string,  // Updated: was username
  gameType: string,
  playerSymbol: string,
  numberOfPlayers: number,
  gameCode: string,  // Updated: was code
  startingCash: number  // Now passed as BigInt internally
) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  let stake = STAKE_AMOUNT;  // Updated constant

  const {
    writeContractAsync,
    isPending,
    error: writeError,
    data: txHash,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const write = useCallback(async (): Promise<string> => {
    if (!contractAddress) {
      throw new Error(`Contract not deployed on chain ${chainId}.`);
    }

    const hash = await writeContractAsync({
      chainId,
      address: contractAddress,
      abi: TycoonABI,  // Updated
      functionName: "createGame",
      args: [creatorUsername, gameType, playerSymbol, numberOfPlayers, gameCode, BigInt(startingCash)],  // Updated args
      value: BigInt(stake),
    });

    if (!hash) {
      throw new Error("Transaction failed: no hash returned");
    }

    return hash;
  }, [
    writeContractAsync,
    contractAddress,
    chainId,
    creatorUsername,
    gameType,
    playerSymbol,
    numberOfPlayers,
    gameCode,
    startingCash,
  ]);

  return {
    write,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    error: writeError,
    txHash,
    reset,
  };
}

export function useRegister() {  // Kept original name for compatibility
  return useRegisterPlayer();  // Delegates to new hook
}

export function useRegisterPlayer() {  // New/updated version
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const {
    writeContractAsync,
    isPending,
    error: writeError,
    data: txHash,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const write = useCallback(
    async (username: string): Promise<string> => {
      if (!contractAddress) {
        throw new Error(`Contract not deployed on chain ${chainId}.`);
      }

      if (!username.trim()) {
        throw new Error("Username cannot be empty");
      }

      const hash = await writeContractAsync({
        chainId,
        address: contractAddress,
        abi: TycoonABI,  // Updated
        functionName: "registerPlayer",
        args: [username.trim()],
      });

      if (!hash) {
        throw new Error("Transaction failed: no hash returned");
      }

      return hash;
    },
    [writeContractAsync, contractAddress, chainId]
  );

  return {
    write,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    error: writeError,
    txHash,
    reset,
  };
}

export function useCreateAiGame(  // Kept original name/spelling for compatibility
  creatorUsername: string,  // Updated
  gameType: string,
  playerSymbol: string,
  numberOfAI: number,  // Updated: was numberOfPlayers, now means AI count
  gameCode: string,
  startingCash: number,
) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  let stake = STAKE_AMOUNT;

  const {
    writeContractAsync,
    isPending,
    error: writeError,
    data: txHash,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const write = useCallback(async (): Promise<string> => {
    if (!contractAddress) {
      throw new Error(`Contract not deployed on chain ${chainId}. Please switch to a supported network.`);
    }

    const hash = await writeContractAsync({
      chainId,
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'createAIGame',  // Updated
      args: [creatorUsername, gameType, playerSymbol, numberOfAI, gameCode, BigInt(startingCash)],  // Updated args
      value: BigInt(stake),
    });

    if (!hash) {
      throw new Error('Transaction failed: no hash returned');
    }

    return hash;
  }, [
    writeContractAsync,
    contractAddress,
    chainId,
    creatorUsername,
    gameType,
    playerSymbol,
    numberOfAI,
    gameCode,
    startingCash,
  ]);

  return {
    write,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    error: writeError,
    txHash,
    reset,
  };
}

// Stub for legacy useUpdatePlayerPosition (not in new contract)
export function useUpdatePlayerPosition(
  gameId: bigint | number,
  targetPlayer: `0x${string}` | undefined,
  newPosition: number,
  newBalance: bigint | number,
  balanceDelta: bigint | number,
  propertyIds: number[]
) {
  console.warn('useUpdatePlayerPosition: Removed in new Tycoon contract. Handle off-chain.');
  return { updatePosition: async () => null, isPending: false, isSuccess: false, error: new Error('Not implemented') };
}

export function useJoinGame(
  gameId: number,
  username: string,
  playerSymbol: string,
  code: string
) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  let stake = STAKE_AMOUNT;

  const {
    writeContractAsync,
    isPending,
    error: writeError,
    data: txHash,
    reset,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    isError: isTxError,
  } = useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async (): Promise<string> => {
    if (!contractAddress) {
      throw new Error(`Contract not deployed on chain ID ${chainId}. Please switch to a supported network.`);
    }

    if (!gameId || !username || !playerSymbol || !code) {
      throw new Error("Missing required parameters to join game");
    }

    const hash = await writeContractAsync({
      chainId,
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'joinGame',
      args: [BigInt(gameId), username, playerSymbol, code],  // Updated: gameId to BigInt
      value: BigInt(stake),
    });

    if (!hash) {
      throw new Error('Transaction failed: no hash returned');
    }

    return hash;
  }, [
    writeContractAsync,
    contractAddress,
    chainId,
    gameId,
    username,
    playerSymbol,
    code,
  ]);

  return {
    write,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    isError: !!writeError || isTxError,
    error: writeError,
    txHash,
    reset,
  };
}

// Updated: Matches endAIGameAndClaim
export function useEndAiGame(
  gameId: number,
  finalPosition: number,
  finalBalance: string | bigint,
  isWin: boolean
) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const {
    writeContractAsync,
    isPending,
    error: writeError,
    data: txHash,
    reset,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    isError: isTxError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const write = useCallback(async (): Promise<string> => {
    if (!contractAddress) {
      throw new Error(
        `Contract not deployed on chain ID ${chainId}. Please switch to a supported network.`
      );
    }

    if (gameId === undefined || finalPosition === undefined || finalBalance === undefined || isWin === undefined) {
      throw new Error("Missing required parameters to end AI game");
    }

    if (!Number.isInteger(finalPosition) || finalPosition < 0 || finalPosition > 39) {  // Adjusted range for board
      throw new Error("finalPosition must be an integer between 0 and 39");
    }

    const hash = await writeContractAsync({
      chainId,
      address: contractAddress,
      abi: TycoonABI,
      functionName: "endAIGameAndClaim",  // Updated function name
      args: [
        BigInt(gameId),
        Number(finalPosition),  // uint8
        BigInt(finalBalance),
        isWin,
      ],
    });

    if (!hash) {
      throw new Error("Transaction failed: no hash returned");
    }

    return hash;
  }, [
    chainId,
    contractAddress,
    writeContractAsync,
    gameId,
    finalPosition,
    finalBalance,
    isWin,
  ]);

  return {
    write,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    isError: !!writeError || isTxError,
    error: writeError,
    txHash,
    reset,
  };
}

export function useGetGame(gameId?: string | number, options = { enabled: true }) {  // Updated arg type
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'getGame',
    args: gameId ? [BigInt(gameId)] : undefined,  // Updated to BigInt
    query: {
      enabled: options.enabled && !!contractAddress,
      retry: false,
    },
  });

  return {
    data: result.data
      ? {
          id: (result.data as GameTuple)[0],
          code: (result.data as GameTuple)[1],
          creator: (result.data as GameTuple)[2],
          status: (result.data as GameTuple)[3],
          nextPlayer: (result.data as GameTuple)[4],
          winner: (result.data as GameTuple)[5],
          numberOfPlayers: (result.data as GameTuple)[6],
          joinedPlayers: (result.data as GameTuple)[7],
          mode: (result.data as GameTuple)[8],
          ai: Boolean((result.data as GameTuple)[9]),
          createdAt: (result.data as GameTuple)[10],
          endedAt: (result.data as GameTuple)[11],
          totalStaked: (result.data as GameTuple)[12],
        }
      : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

// Stub for legacy useGetPlayer (use getUser(username) instead)
export function useGetPlayer(address?: Address, options = { enabled: true }) {
  console.warn('useGetPlayer: Use useGetUser with username in new contract.');
  return { data: undefined, isLoading: false, error: new Error('Deprecated') };
}

// Stub for legacy useGetPlayerById
export function useGetPlayerById(id?: number, options = { enabled: true }) {
  console.warn('useGetPlayerById: Removed in new contract. Use totalUsers for count.');
  return { data: undefined, isLoading: false, error: new Error('Not implemented') };
}

export function useGetGameByCode(code?: string, options = { enabled: true }) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'getGameByCode',
    args: code ? [code] : undefined,
    query: {
      enabled: options.enabled && !!contractAddress,
      retry: false,
    },
  });

  let gameData: ExtendedGameData | undefined;

  if (result.data && typeof result.data === 'object') {
    const d = result.data as Record<string, unknown>;
    gameData = {
      id: BigInt(d.id as string),
      code: String(d.code),
      creator: d.creator as Address,
      status: Number(d.status),
      nextPlayer: Number(d.nextPlayer),  // Updated: number not bigint
      winner: d.winner as Address,
      numberOfPlayers: Number(d.numberOfPlayers),
      joinedPlayers: Number(d.joinedPlayers),
      mode: Number(d.mode),
      ai: Boolean(d.ai),
      createdAt: BigInt(d.createdAt as string),
      endedAt: BigInt(d.endedAt as string),
      totalStaked: BigInt(d.totalStaked as string),  // New
    };
  }

  return { data: gameData, isLoading: result.isLoading, error: result.error };
}

// Stub for legacy useGetGamePlayer (use getGamePlayerByAddress instead)
export function useGetGamePlayer(gameId?: number, address?: Address, options = { enabled: true }) {
  console.warn('useGetGamePlayer: Use useGetGamePlayerByAddress in new contract.');
  return { data: undefined, isLoading: false, error: new Error('Deprecated') };
}

// New: Matches getGamePlayerByAddress
export function useGetGamePlayerByAddress(gameId?: number, address?: Address, options = { enabled: true }) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'getGamePlayerByAddress',
    args: gameId !== undefined && address ? [BigInt(gameId), address] : undefined,
    query: { enabled: options.enabled && gameId !== undefined && !!address && !!contractAddress },
  });

  return {
    data: result.data
      ? {
          gameId: (result.data as GamePlayerTuple)[0],
          playerAddress: (result.data as GamePlayerTuple)[1],
          balance: (result.data as GamePlayerTuple)[2],
          position: (result.data as GamePlayerTuple)[3],
          order: (result.data as GamePlayerTuple)[4],
          symbol: (result.data as GamePlayerTuple)[5],
          username: (result.data as GamePlayerTuple)[6],
        }
      : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

// Stub for legacy useStartGame (not in new contract - games auto-start on full join for non-AI)
export function useStartGame(gameId: number) {
  console.warn('useStartGame: Removed in new Tycoon contract. Games auto-start.');
  return { write: async () => {}, isPending: false, isSuccess: false, error: new Error('Not implemented') };
}

// Stub for legacy useEndGame (use claimReward after ending)
export function useEndGame(gameId: number, winnerAddr: Address) {
  console.warn('useEndGame: Use claimReward in new contract.');
  return { write: async () => {}, isPending: false, isSuccess: false, error: new Error('Not implemented') };
}

// New: For claiming rewards after game end
export function useClaimReward(gameId: number) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const {
    writeContractAsync,
    isPending,
    error: writeError,
    data: txHash,
    reset,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    isError: isTxError,
  } = useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async (): Promise<string> => {
    if (!contractAddress) {
      throw new Error(`Contract not deployed on chain ID ${chainId}. Please switch to a supported network.`);
    }

    if (!gameId) {
      throw new Error("Invalid game ID");
    }

    const hash = await writeContractAsync({
      chainId,
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'claimReward',
      args: [BigInt(gameId)],
    });

    return hash;
  }, [writeContractAsync, contractAddress, chainId, gameId]);

  return {
    write,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    isError: !!writeError || isTxError,
    error: writeError,
    txHash,
    reset,
  };
}

export function useTotalUsers(options = { enabled: true }) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'totalUsers',
    query: { enabled: options.enabled && !!contractAddress },
  });

  return {
    data: result.data ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useTotalGames(options = { enabled: true }) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'totalGames',
    query: { enabled: options.enabled && !!contractAddress },
  });

  return {
    data: result.data ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

// Stub for legacy useBoardSize (constant not exposed; hardcode 40 if needed)
export function useBoardSize(options = { enabled: true }) {
  console.warn('useBoardSize: Hardcode BOARD_SIZE = 40 in new contract.');
  return { data: 40, isLoading: false, error: null };
}

// New: Matches getUser(username)
export function useGetUser(username?: string, options = { enabled: true }) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'getUser',
    args: username ? [username] : undefined,
    query: {
      enabled: options.enabled && !!username && !!contractAddress,
      retry: false,
    },
  });

  return {
    data: result.data
      ? {
          id: (result.data as UserTuple)[0],
          username: (result.data as UserTuple)[1],
          playerAddress: (result.data as UserTuple)[2],
          registeredAt: (result.data as UserTuple)[3],
          gamesPlayed: (result.data as UserTuple)[4],
          gamesWon: (result.data as UserTuple)[5],
          gamesLost: (result.data as UserTuple)[6],
          totalStaked: (result.data as UserTuple)[7],
          totalEarned: (result.data as UserTuple)[8],
          totalWithdrawn: (result.data as UserTuple)[9],
        }
      : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

/* ----------------------- Updated Reward System Hooks (Unchanged) ----------------------- */

/** Read full collectible info (perk, strength, both prices, current shop stock) */
export function useRewardCollectibleInfo(
  tokenId?: bigint,
  options = { enabled: true }
) {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'getCollectibleInfo',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: options.enabled && !!contractAddress && tokenId !== undefined,
    },
  });

  return {
    data: result.data
      ? {
          perk: Number((result.data as any)[0]) as CollectiblePerk,
          strength: BigInt((result.data as any)[1]),
          tycPrice: BigInt((result.data as any)[2]),
          usdcPrice: BigInt((result.data as any)[3]),
          shopStock: BigInt((result.data as any)[4]),
        }
      : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

/** Get cash tier value (for CASH_TIERED or TAX_REFUND) */
export function useRewardGetCashTierValue(tier?: number, options = { enabled: true }) {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'getCashTierValue',
    args: tier !== undefined ? [tier] : undefined,
    query: {
      enabled: options.enabled && !!contractAddress && tier !== undefined,
    },
  });

  return {
    data: result.data !== undefined ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

/** ERC1155 balance of any token (voucher or collectible) */
export function useRewardTokenBalance(
  address?: Address,
  tokenId?: bigint,
  options = { enabled: true }
) {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'balanceOf',
    args: address && tokenId !== undefined ? [address, tokenId] : undefined,
    query: {
      enabled: options.enabled && !!address && tokenId !== undefined && !!contractAddress,
    },
  });

  return {
    balance: result.data !== undefined ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

/** Redeem a TYC voucher */
export function useRewardRedeemVoucher() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const redeem = useCallback(
    async (tokenId: bigint) => {
      if (!contractAddress) throw new Error(`Reward contract not deployed on chain ${chainId}`);
      if (!isVoucherToken(tokenId)) throw new Error('Not a voucher token ID');

      const hash = await writeContractAsync({
        address: contractAddress,
        abi: RewardABI,
        functionName: 'redeemVoucher',
        args: [tokenId],
      });

      return hash;
    },
    [writeContractAsync, contractAddress, chainId]
  );

  return { redeem, isPending: isPending || isConfirming, isConfirming, isSuccess, error: writeError, txHash, reset };
}

/** Burn a collectible to activate its perk */
export function useRewardBurnCollectible() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const burn = useCallback(
    async (tokenId: bigint) => {
      if (!contractAddress) throw new Error(`Reward contract not deployed on chain ${chainId}`);
      if (!isCollectibleToken(tokenId)) throw new Error('Not a collectible token ID');

      const hash = await writeContractAsync({
        address: contractAddress,
        abi: RewardABI,
        functionName: 'burnCollectibleForPerk',
        args: [tokenId],
      });

      return hash;
    },
    [writeContractAsync, contractAddress, chainId]
  );

  return { burn, isPending: isPending || isConfirming, isConfirming, isSuccess, error: writeError, txHash, reset };
}

/** Buy a collectible from the shop — supports TYC or USDC via boolean flag */
export function useRewardBuyCollectible() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const buy = useCallback(
    async (tokenId: bigint, useUsdc: boolean = false) => {
      if (!contractAddress) throw new Error(`Reward contract not deployed on chain ${chainId}`);
      if (!isCollectibleToken(tokenId)) throw new Error('Invalid collectible token ID');

      const hash = await writeContractAsync({
        address: contractAddress,
        abi: RewardABI,
        functionName: 'buyCollectible',
        args: [tokenId, useUsdc],
      });

      return hash;
    },
    [writeContractAsync, contractAddress, chainId]
  );

  return { buy, isPending: isPending || isConfirming, isConfirming, isSuccess, error: writeError, txHash, reset };
}

/* ----------------------- NEW ADMIN REWARD SYSTEM HOOKS (Appended at the end) ----------------------- */

/** Set the backend minter address (onlyOwner) */
export function useRewardSetBackendMinter() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const {
    writeContractAsync,
    isPending,
    error: writeError,
    data: txHash,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const setMinter = useCallback(
    async (newMinter: Address): Promise<string> => {
      if (!contractAddress) throw new Error(`Reward contract not deployed on chain ${chainId}`);
      if (!newMinter) throw new Error('Invalid minter address');

      const hash = await writeContractAsync({
        chainId,
        address: contractAddress,
        abi: RewardABI,
        functionName: 'setBackendMinter',
        args: [newMinter],
      });

      if (!hash) throw new Error('Transaction failed: no hash returned');

      return hash;
    },
    [writeContractAsync, chainId, contractAddress]
  );

  return {
    setMinter,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    error: writeError,
    txHash,
    reset,
  };
}

/** Mint a TYC voucher to any address (onlyBackend) */
export function useRewardMintVoucher() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const {
    writeContractAsync,
    isPending,
    error: writeError,
    data: txHash,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const mint = useCallback(
    async (to: Address, tycValue: bigint): Promise<string> => {
      if (!contractAddress) throw new Error(`Reward contract not deployed on chain ${chainId}`);
      if (!to) throw new Error('Invalid recipient address');
      if (tycValue <= 0) throw new Error('Voucher value must be positive');

      const hash = await writeContractAsync({
        chainId,
        address: contractAddress,
        abi: RewardABI,
        functionName: 'mintVoucher',
        args: [to, tycValue],
      });

      if (!hash) throw new Error('Transaction failed: no hash returned');

      return hash;
    },
    [writeContractAsync, chainId, contractAddress]
  );

  return {
    mint,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    error: writeError,
    txHash,
    reset,
  };
}

/** Mint a collectible to any address (onlyBackend) */
export function useRewardMintCollectible() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const {
    writeContractAsync,
    isPending,
    error: writeError,
    data: txHash,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const mint = useCallback(
    async (to: Address, perk: number, strength: number): Promise<string> => {
      if (!contractAddress) throw new Error(`Reward contract not deployed on chain ${chainId}`);
      if (!to) throw new Error('Invalid recipient address');

      const hash = await writeContractAsync({
        chainId,
        address: contractAddress,
        abi: RewardABI,
        functionName: 'mintCollectible',
        args: [to, BigInt(perk), BigInt(strength)],
      });

      if (!hash) throw new Error('Transaction failed: no hash returned');

      return hash;
    },
    [writeContractAsync, chainId, contractAddress]
  );

  return {
    mint,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    error: writeError,
    txHash,
    reset,
  };
}

/** Stock the shop with a new collectible (onlyBackend) */
export function useRewardStockShop() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const {
    writeContractAsync,
    isPending,
    error: writeError,
    data: txHash,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const stock = useCallback(
    async (
      amount: number,
      perk: number,
      strength: number,
      tycPrice: bigint = BigInt(0),
      usdcPrice: bigint = BigInt(0)
    ): Promise<string> => {
      if (!contractAddress) throw new Error(`Reward contract not deployed on chain ${chainId}`);
      if (amount <= 0) throw new Error('Amount must be positive');

      const hash = await writeContractAsync({
        chainId,
        address: contractAddress,
        abi: RewardABI,
        functionName: 'stockShop',
        args: [BigInt(amount), BigInt(perk), BigInt(strength), tycPrice, usdcPrice],
      });

      if (!hash) throw new Error('Transaction failed: no hash returned');

      return hash;
    },
    [writeContractAsync, chainId, contractAddress]
  );

  return {
    stock,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    error: writeError,
    txHash,
    reset,
  };
}

/** Restock an existing collectible in the shop (onlyBackend) */
export function useRewardRestockCollectible() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const {
    writeContractAsync,
    isPending,
    error: writeError,
    data: txHash,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const restock = useCallback(
    async (tokenId: bigint, additionalAmount: number): Promise<string> => {
      if (!contractAddress) throw new Error(`Reward contract not deployed on chain ${chainId}`);
      if (additionalAmount <= 0) throw new Error('Amount must be positive');

      const hash = await writeContractAsync({
        chainId,
        address: contractAddress,
        abi: RewardABI,
        functionName: 'restockCollectible',
        args: [tokenId, BigInt(additionalAmount)],
      });

      if (!hash) throw new Error('Transaction failed: no hash returned');

      return hash;
    },
    [writeContractAsync, chainId, contractAddress]
  );

  return {
    restock,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    error: writeError,
    txHash,
    reset,
  };
}

/** Update TYC & USDC prices for an existing collectible (onlyBackend) */
export function useRewardUpdateCollectiblePrices() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const {
    writeContractAsync,
    isPending,
    error: writeError,
    data: txHash,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const update = useCallback(
    async (tokenId: bigint, newTycPrice: bigint, newUsdcPrice: bigint): Promise<string> => {
      if (!contractAddress) throw new Error(`Reward contract not deployed on chain ${chainId}`);

      const hash = await writeContractAsync({
        chainId,
        address: contractAddress,
        abi: RewardABI,
        functionName: 'updateCollectiblePrices',
        args: [tokenId, newTycPrice, newUsdcPrice],
      });

      if (!hash) throw new Error('Transaction failed: no hash returned');

      return hash;
    },
    [writeContractAsync, chainId, contractAddress]
  );

  return {
    update,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    error: writeError,
    txHash,
    reset,
  };
}

/** Pause or Unpause the Reward contract (onlyOwner) */
export function useRewardTogglePause() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const {
    writeContractAsync,
    isPending,
    error: writeError,
    data: txHash,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const pause = useCallback(async (): Promise<string> => {
    if (!contractAddress) throw new Error(`Reward contract not deployed on chain ${chainId}`);

    const hash = await writeContractAsync({
      chainId,
      address: contractAddress,
      abi: RewardABI,
      functionName: 'pause',
    });

    if (!hash) throw new Error('Transaction failed: no hash returned');

    return hash;
  }, [writeContractAsync, chainId, contractAddress]);

  const unpause = useCallback(async (): Promise<string> => {
    if (!contractAddress) throw new Error(`Reward contract not deployed on chain ${chainId}`);

    const hash = await writeContractAsync({
      chainId,
      address: contractAddress,
      abi: RewardABI,
      functionName: 'unpause',
    });

    if (!hash) throw new Error('Transaction failed: no hash returned');

    return hash;
  }, [writeContractAsync, chainId, contractAddress]);

  return {
    pause,
    unpause,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    error: writeError,
    txHash,
    reset,
  };
}

/** Withdraw TYC or USDC funds from the contract (onlyOwner) */
export function useRewardWithdrawFunds() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const {
    writeContractAsync,
    isPending,
    error: writeError,
    data: txHash,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const withdraw = useCallback(
    async (token: Address, to: Address, amount: bigint): Promise<string> => {
      if (!contractAddress) throw new Error(`Reward contract not deployed on chain ${chainId}`);
      if (!to) throw new Error('Invalid recipient address');

      const hash = await writeContractAsync({
        chainId,
        address: contractAddress,
        abi: RewardABI,
        functionName: 'withdrawFunds',
        args: [token, to, amount],
      });

      if (!hash) throw new Error('Transaction failed: no hash returned');

      return hash;
    },
    [writeContractAsync, chainId, contractAddress]
  );

  return {
    withdraw,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    error: writeError,
    txHash,
    reset,
  };
}

/* ----------------------- Context Provider (Renamed for new contract) ----------------------- */
type ContractContextType = {
  registerPlayer: (username: string) => Promise<void>;
  redeemVoucher: (tokenId: bigint) => Promise<string>;
  burnCollectible: (tokenId: bigint) => Promise<string>;
  buyCollectible: (tokenId: bigint, useUsdc?: boolean) => Promise<string>;
};

const TycoonContext = createContext<ContractContextType | undefined>(undefined);

export const TycoonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {  // Renamed from PlayerContractProvider
  const { address: userAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const chainId = useChainId();

  const registerPlayer = useCallback(
    async (username: string) => {
      const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];  // Updated
      if (!userAddress) throw new Error('No wallet connected');
      if (!contractAddress) throw new Error('Tycoon contract not deployed');  // Updated message
      await writeContractAsync({
        address: contractAddress,
        abi: TycoonABI,  // Updated
        functionName: 'registerPlayer',
        args: [username],
      });
    },
    [userAddress, writeContractAsync, chainId]
  );

  const redeemVoucher = useCallback(
    async (tokenId: bigint) => {
      const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
      if (!contractAddress) throw new Error('Reward contract not deployed');
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: RewardABI,
        functionName: 'redeemVoucher',
        args: [tokenId],
      });
      return hash;
    },
    [writeContractAsync, chainId]
  );

  const burnCollectible = useCallback(
    async (tokenId: bigint) => {
      const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
      if (!contractAddress) throw new Error('Reward contract not deployed');
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: RewardABI,
        functionName: 'burnCollectibleForPerk',
        args: [tokenId],
      });
      return hash;
    },
    [writeContractAsync, chainId]
  );

  const buyCollectible = useCallback(
    async (tokenId: bigint, useUsdc: boolean = false) => {
      const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
      if (!contractAddress) throw new Error('Reward contract not deployed');
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: RewardABI,
        functionName: 'buyCollectible',
        args: [tokenId, useUsdc],
      });
      return hash;
    },
    [writeContractAsync, chainId]
  );

  const value = useMemo(
    () => ({
      registerPlayer,
      redeemVoucher,
      burnCollectible,
      buyCollectible,
    }),
    [registerPlayer, redeemVoucher, burnCollectible, buyCollectible]
  );

  return <TycoonContext.Provider value={value}>{children}</TycoonContext.Provider>;
};

// Updated hook name for compatibility (alias old one)
export const useTycoonContract = () => usePlayerContract();  // Temporary alias

export const usePlayerContract = () => {  // Kept original for backward compat
  const context = useContext(TycoonContext);
  if (!context) throw new Error('usePlayerContract must be used within TycoonProvider');  // Updated message
  return context;
};