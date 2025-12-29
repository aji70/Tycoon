'use client';

import { createContext, useContext, useCallback } from 'react';
import {
  useReadContract,
  useWriteContract,
  useAccount,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { Address } from 'viem';
import PlayerABI from './abi.json';
import RewardABI from './rewardabi.json';
import { useChainId } from 'wagmi';
import { PLAYER_CONTRACT_ADDRESSES, REWARD_CONTRACT_ADDRESSES } from '@/constants/contracts';

const STAKE = 1e14;

/* ----------------------- Types ----------------------- */
type PlayerData = {
  username: string;
  playerAddress: Address;
  timestamp: bigint;
};
type PlayerDataTuple = [string, Address, bigint];

export type GameSettings = {
  maxPlayers: number;
  privateRoom: string;
  auction: boolean;
  rentInPrison: boolean;
  mortgage: boolean;
  evenBuild: boolean;
  startingCash: bigint;
  randomizePlayOrder: boolean;
};

type GameData = {
  id: string;
  status: number;
  nextPlayer: number;
  winner: Address;
  creator: Address;
  createdAt: bigint;
  numberOfPlayers: number;
  endedAt: bigint;
};
type GameDataTuple = [string, number, Address, Address, bigint, number, bigint];

type ExtendedPlayerData = {
  id: bigint;
  username: string;
  playerAddress: Address;
  timestamp: bigint;
  gamesPlayed: bigint;
  gameWon: bigint;
  gameLost: bigint;
  totalStaked: bigint;
  totalEarned: bigint;
  totalWithdrawn: bigint;
};
type ExtendedPlayerDataTuple = [bigint, string, Address, bigint, bigint, bigint, bigint, bigint, bigint, bigint];

type ExtendedGameData = {
  id: bigint;
  code: string;
  creator: Address;
  status: number;
  nextPlayer: bigint;
  winner: Address;
  numberOfPlayers: number;
  joinedPlayers: number;
  mode: number;
  createdAt: bigint;
  endedAt: bigint;
};
type ExtendedGameDataTuple = [bigint, string, Address, number, bigint, Address, number, number, number, bigint, bigint];

type GamePlayerData = {
  gameId: bigint;
  playerAddress: Address;
  balance: bigint;
  position: number;
  order: bigint;
  symbol: number;
  chanceJailCard: boolean;
  communityChestJailCard: boolean;
  username: string;
};
type GamePlayerDataTuple = [bigint, Address, bigint, number, bigint, number, boolean, boolean, string];

type CollectiblePerk = number;
type RewardVoucherData = {
  tokenId: bigint;
  value: bigint;
};
type RewardCollectibleData = {
  tokenId: bigint;
  perk: CollectiblePerk;
  strength: bigint;
  shopPrice: bigint;
};

/* ----------------------- Player/Game Hooks ----------------------- */

export function useIsRegistered(address?: Address, options = { enabled: true }) {
  const chainId = useChainId();
  const contractAddress = PLAYER_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: PlayerABI,
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

export function useIsInGame(
  gameId?: number,
  address?: Address,
  options = { enabled: true }
) {
  const chainId = useChainId();
  const contractAddress = PLAYER_CONTRACT_ADDRESSES[chainId];
  const result = useReadContract({
    address: contractAddress,
    abi: PlayerABI,
    functionName: 'gamePlayerInGame',
    args: address ? [gameId, address] : undefined,
    query: {
      enabled: options.enabled && !!address && !!contractAddress,
      retry: false,
    },
  });

  return {
    data: result.data as boolean | undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useGetUsername(address?: Address, options = { enabled: true }) {
  const chainId = useChainId();
  const contractAddress = PLAYER_CONTRACT_ADDRESSES[chainId];
  const result = useReadContract({
    address: contractAddress,
    abi: PlayerABI,
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

export function useRetrievePlayer(
  address?: Address,
  options = { enabled: true }
) {
  const chainId = useChainId();
  const contractAddress = PLAYER_CONTRACT_ADDRESSES[chainId];
  const result = useReadContract({
    address: contractAddress,
    abi: PlayerABI,
    functionName: 'players',
    args: address ? [address] : undefined,
    query: {
      enabled: options.enabled && !!address && !!contractAddress,
      retry: false,
    },
  });

  return {
    data: result.data
      ? {
          username: (result.data as PlayerDataTuple)[0],
          playerAddress: (result.data as PlayerDataTuple)[1],
          timestamp: (result.data as PlayerDataTuple)[2],
        }
      : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useCreateGame(
  username: string,
  gameType: string,
  playerSymbol: string,
  numberOfPlayers: number,
  gameCode: string,
  startingCash: number
) {
  const chainId = useChainId();
  const contractAddress = PLAYER_CONTRACT_ADDRESSES[chainId];
  let stake = STAKE;
  if (chainId !== 42220) {
    stake = 1;
  }

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
      abi: PlayerABI,
      functionName: "createGame",
      args: [username, gameType, playerSymbol, numberOfPlayers, gameCode, startingCash],
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
    username,
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

export function useRegister() {
  const chainId = useChainId();
  const contractAddress = PLAYER_CONTRACT_ADDRESSES[chainId];

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
        abi: PlayerABI,
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

export function useCreateAiGame(
  username: string,
  gameType: string,
  playerSymbol: string,
  numberOfPlayers: number,
  gameCode: string,
  startingCash: number,
) {
  const chainId = useChainId();
  const contractAddress = PLAYER_CONTRACT_ADDRESSES[chainId];
  let stake = STAKE;
  if (chainId !== 42220) {
    stake = 1;
  }

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
      abi: PlayerABI,
      functionName: 'createAIGame',
      args: [username, gameType, playerSymbol, numberOfPlayers, gameCode, startingCash],
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
    username,
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

export function useUpdatePlayerPosition(
  gameId: bigint | number,
  targetPlayer: `0x${string}` | undefined,
  newPosition: number,
  newBalance: bigint | number,
  balanceDelta: bigint | number,
  propertyIds: number[]
) {
  const chainId = useChainId();
  const contractAddress = PLAYER_CONTRACT_ADDRESSES[chainId];

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

  const updatePosition = useCallback(async (): Promise<`0x${string}` | null> => {
    if (!contractAddress) {
      throw new Error(`Contract not deployed on chain ID ${chainId}. Please switch to a supported network.`);
    }

    if (
      gameId === undefined || gameId === null ||
      !targetPlayer ||
      newPosition < 0 || newPosition > 39 ||
      propertyIds.some(id => id < 0 || id > 39)
    ) {
      throw new Error("Invalid parameters for updatePlayerPosition");
    }

    const hash = await writeContractAsync({
      chainId,
      address: contractAddress,
      abi: PlayerABI,
      functionName: "updatePlayerPosition",
      args: [
        BigInt(gameId),
        targetPlayer,
        Number(newPosition),
        BigInt(newBalance),
        BigInt(balanceDelta),
        propertyIds.map(id => Number(id)),
      ],
    });

    return hash ?? null;
  }, [
    writeContractAsync,
    contractAddress,
    chainId,
    gameId,
    targetPlayer,
    newPosition,
    newBalance,
    balanceDelta,
    propertyIds,
  ]);

  return {
    updatePosition,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    isError: !!writeError || isTxError,
    error: writeError,
    txHash,
    reset,
  };
}

export function useJoinGame(
  gameId: number,
  username: string,
  playerSymbol: string,
  code: string
) {
  const chainId = useChainId();
  const contractAddress = PLAYER_CONTRACT_ADDRESSES[chainId];
  let stake = STAKE;
  if (chainId !== 42220) {
    stake = 1;
  }

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
      abi: PlayerABI,
      functionName: 'joinGame',
      args: [gameId, username, playerSymbol, code],
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

export function useEndAiGame(
  gameId: number,
  finalPosition: number,
  finalBalance: string | bigint,
  isWin: boolean
) {
  const chainId = useChainId();
  const contractAddress = PLAYER_CONTRACT_ADDRESSES[chainId];

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

    if (gameId === undefined || finalPosition === undefined || finalBalance === undefined) {
      throw new Error("Missing required parameters to end AI game");
    }

    if (!Number.isInteger(finalPosition) || finalPosition < 0 || finalPosition > 255) {
      throw new Error("finalPosition must be an integer between 0 and 255 (valid uint8)");
    }

    const hash = await writeContractAsync({
      chainId,
      address: contractAddress,
      abi: PlayerABI,
      functionName: "endAIGame",
      args: [
        BigInt(gameId),
        BigInt(finalPosition),
        typeof finalBalance === "string" ? BigInt(finalBalance) : finalBalance,
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

export function useGetGame(gameId?: string, options = { enabled: true }) {
  const chainId = useChainId();
  const contractAddress = PLAYER_CONTRACT_ADDRESSES[chainId];
  const result = useReadContract({
    address: contractAddress,
    abi: PlayerABI,
    functionName: 'getGame',
    args: gameId ? [gameId] : undefined,
    query: {
      enabled: options.enabled && !!contractAddress,
      retry: false,
    },
  });

  return {
    data: result.data
      ? {
          id: (result.data as GameDataTuple)[0],
          status: (result.data as GameDataTuple)[1],
          nextPlayer: (result.data as GameDataTuple)[2],
          winner: (result.data as GameDataTuple)[3],
          createdAt: (result.data as GameDataTuple)[4],
          numberOfPlayers: (result.data as GameDataTuple)[5],
          endedAt: (result.data as GameDataTuple)[6],
        }
      : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useGetPlayer(address?: Address, options = { enabled: true }) {
  const chainId = useChainId();
  const contractAddress = PLAYER_CONTRACT_ADDRESSES[chainId];
  const result = useReadContract({
    address: contractAddress,
    abi: PlayerABI,
    functionName: 'getPlayer',
    args: address ? [address] : undefined,
    query: {
      enabled: options.enabled && !!contractAddress,
      retry: false,
    },
  });

  return {
    data: result.data
      ? {
          id: (result.data as ExtendedPlayerDataTuple)[0],
          username: (result.data as ExtendedPlayerDataTuple)[1],
          playerAddress: (result.data as ExtendedPlayerDataTuple)[2],
          timestamp: (result.data as ExtendedPlayerDataTuple)[3],
          gamesPlayed: (result.data as ExtendedPlayerDataTuple)[4],
          gameWon: (result.data as ExtendedPlayerDataTuple)[5],
          gameLost: (result.data as ExtendedPlayerDataTuple)[6],
          totalStaked: (result.data as ExtendedPlayerDataTuple)[7],
          totalEarned: (result.data as ExtendedPlayerDataTuple)[8],
          totalWithdrawn: (result.data as ExtendedPlayerDataTuple)[9],
        }
      : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useGetPlayerById(id?: number, options = { enabled: true }) {
  const chainId = useChainId();
  const contractAddress = PLAYER_CONTRACT_ADDRESSES[chainId];
  const result = useReadContract({
    address: contractAddress,
    abi: PlayerABI,
    functionName: 'getPlayerById',
    args: id !== undefined ? [id] : undefined,
    query: {
      enabled: options.enabled && !!contractAddress,
      retry: false,
    },
  });

  return {
    data: result.data
      ? {
          id: (result.data as ExtendedPlayerDataTuple)[0],
          username: (result.data as ExtendedPlayerDataTuple)[1],
          playerAddress: (result.data as ExtendedPlayerDataTuple)[2],
          timestamp: (result.data as ExtendedPlayerDataTuple)[3],
          gamesPlayed: (result.data as ExtendedPlayerDataTuple)[4],
          gameWon: (result.data as ExtendedPlayerDataTuple)[5],
          gameLost: (result.data as ExtendedPlayerDataTuple)[6],
          totalStaked: (result.data as ExtendedPlayerDataTuple)[7],
          totalEarned: (result.data as ExtendedPlayerDataTuple)[8],
          totalWithdrawn: (result.data as ExtendedPlayerDataTuple)[9],
        }
      : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useGetGameByCode(code?: string, options = { enabled: true }) {
  const chainId = useChainId();
  const contractAddress = PLAYER_CONTRACT_ADDRESSES[chainId];
  const result = useReadContract({
    address: contractAddress,
    abi: PlayerABI,
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
      nextPlayer: BigInt(d.nextPlayer as string),
      winner: d.winner as Address,
      numberOfPlayers: Number(d.numberOfPlayers),
      joinedPlayers: Number(d.joinedPlayers),
      mode: Number(d.mode),
      createdAt: BigInt(d.createdAt as string),
      endedAt: BigInt(d.endedAt as string),
    };
  }

  return { data: gameData, isLoading: result.isLoading, error: result.error };
}

export function useGetGamePlayer(gameId?: number, address?: Address, options = { enabled: true }) {
  const chainId = useChainId();
  const contractAddress = PLAYER_CONTRACT_ADDRESSES[chainId];
  const result = useReadContract({
    address: contractAddress,
    abi: PlayerABI,
    functionName: 'getGamePlayer',
    args: gameId !== undefined && address ? [gameId, address] : undefined,
    query: { enabled: options.enabled && gameId !== undefined && !!address && !!contractAddress },
  });

  return {
    data: result.data
      ? {
          gameId: (result.data as GamePlayerDataTuple)[0],
          playerAddress: (result.data as GamePlayerDataTuple)[1],
          balance: (result.data as GamePlayerDataTuple)[2],
          position: (result.data as GamePlayerDataTuple)[3],
          order: (result.data as GamePlayerDataTuple)[4],
          symbol: (result.data as GamePlayerDataTuple)[5],
          chanceJailCard: (result.data as GamePlayerDataTuple)[6],
          communityChestJailCard: (result.data as GamePlayerDataTuple)[7],
          username: (result.data as GamePlayerDataTuple)[8],
        }
      : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useStartGame(gameId: number) {
  const chainId = useChainId();
  const contractAddress = PLAYER_CONTRACT_ADDRESSES[chainId];

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

  const write = useCallback(async (): Promise<void> => {
    if (!contractAddress) {
      throw new Error(`Contract not deployed on chain ID ${chainId}. Please switch to a supported network.`);
    }

    if (!gameId) {
      throw new Error("Invalid game ID");
    }

    await writeContractAsync({
      chainId,
      address: contractAddress,
      abi: PlayerABI,
      functionName: 'startGame',
      args: [gameId],
    });
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

export function useEndGame(gameId: number, winnerAddr: Address) {
  const chainId = useChainId();
  const contractAddress = PLAYER_CONTRACT_ADDRESSES[chainId];

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

  const write = useCallback(async (): Promise<void> => {
    if (!contractAddress) {
      throw new Error(`Contract not deployed on chain ID ${chainId}. Please switch to a supported network.`);
    }

    if (!gameId || !winnerAddr) {
      throw new Error("Missing game ID or winner address");
    }

    await writeContractAsync({
      chainId,
      address: contractAddress,
      abi: PlayerABI,
      functionName: 'endGame',
      args: [gameId, winnerAddr],
    });
  }, [writeContractAsync, contractAddress, chainId, gameId, winnerAddr]);

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
  const contractAddress = PLAYER_CONTRACT_ADDRESSES[chainId];
  const result = useReadContract({
    address: contractAddress,
    abi: PlayerABI,
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
  const contractAddress = PLAYER_CONTRACT_ADDRESSES[chainId];
  const result = useReadContract({
    address: contractAddress,
    abi: PlayerABI,
    functionName: 'totalGames',
    query: { enabled: options.enabled },
  });

  return {
    data: result.data ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useBoardSize(options = { enabled: true }) {
  const chainId = useChainId();
  const contractAddress = PLAYER_CONTRACT_ADDRESSES[chainId];
  const result = useReadContract({
    address: contractAddress,
    abi: PlayerABI,
    functionName: 'BOARD_SIZE',
    query: { enabled: options.enabled },
  });

  return {
    data: result.data ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

/* ----------------------- Reward System Hooks ----------------------- */

export function useRewardVoucherRedeemValue(tokenId?: bigint, options = { enabled: true }) {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'voucherRedeemValue',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: options.enabled && !!contractAddress && tokenId !== undefined },
  });

  return {
    data: result.data !== undefined ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useRewardCollectiblePerk(tokenId?: bigint, options = { enabled: true }) {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'getCollectiblePerk',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: options.enabled && !!contractAddress && tokenId !== undefined },
  });

  return {
    data: result.data
      ? {
          perk: Number((result.data as any)[0]),
          strength: BigInt((result.data as any)[1]),
        }
      : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useRewardGetCashTierValue(tier?: number, options = { enabled: true }) {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'getCashTierValue',
    args: tier !== undefined ? [tier] : undefined,
    query: { enabled: options.enabled && !!contractAddress && tier !== undefined },
  });

  return {
    data: result.data !== undefined ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useRewardRedeemVoucher() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const redeem = useCallback(async (tokenId: bigint): Promise<string> => {
    if (!contractAddress) throw new Error(`Reward contract not deployed on chain ${chainId}`);

    const hash = await writeContractAsync({
      chainId,
      address: contractAddress,
      abi: RewardABI,
      functionName: 'redeemVoucher',
      args: [tokenId],
    });

    return hash ?? '';
  }, [writeContractAsync, contractAddress, chainId]);

  return {
    redeem,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    error: writeError,
    txHash,
    reset,
  };
}

export function useRewardBurnCollectible() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const burn = useCallback(async (tokenId: bigint): Promise<string> => {
    if (!contractAddress) throw new Error(`Reward contract not deployed on chain ${chainId}`);

    const hash = await writeContractAsync({
      chainId,
      address: contractAddress,
      abi: RewardABI,
      functionName: 'burnCollectibleForPerk',
      args: [tokenId],
    });

    return hash ?? '';
  }, [writeContractAsync, contractAddress, chainId]);

  return {
    burn,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    error: writeError,
    txHash,
    reset,
  };
}

export function useRewardBuyCollectible() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const buy = useCallback(async (tokenId: bigint): Promise<string> => {
    if (!contractAddress) throw new Error(`Reward contract not deployed on chain ${chainId}`);

    const hash = await writeContractAsync({
      chainId,
      address: contractAddress,
      abi: RewardABI,
      functionName: 'buyCollectible',
      args: [tokenId],
    });

    return hash ?? '';
  }, [writeContractAsync, contractAddress, chainId]);

  return {
    buy,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    error: writeError,
    txHash,
    reset,
  };
}

/* ----------------------- Context ----------------------- */
type ContractContextType = {
  registerPlayer: (username: string) => Promise<void>;
  redeemVoucher: (tokenId: bigint) => Promise<string>;
  burnCollectible: (tokenId: bigint) => Promise<string>;
  buyCollectible: (tokenId: bigint) => Promise<string>;
  // Add more context functions as needed (totalUsers, etc.)
};

const BlockopolyContext = createContext<ContractContextType | undefined>(undefined);

export const PlayerContractProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { address: userAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const registerPlayer = useCallback(
    async (username: string) => {
      const chainId = useChainId();
      const contractAddress = PLAYER_CONTRACT_ADDRESSES[chainId];
      if (!userAddress) throw new Error('No wallet connected');
      if (!contractAddress) throw new Error('No contract deployed');
      await writeContractAsync({
        address: contractAddress,
        abi: PlayerABI,
        functionName: 'registerPlayer',
        args: [username],
      });
    },
    [userAddress, writeContractAsync]
  );

  const redeemVoucher = useCallback(async (tokenId: bigint) => {
    const chainId = useChainId();
    const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
    if (!contractAddress) throw new Error('Reward contract not deployed');
    const hash = await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'redeemVoucher',
      args: [tokenId],
    });
    return hash;
  }, [writeContractAsync]);

  const burnCollectible = useCallback(async (tokenId: bigint) => {
    const chainId = useChainId();
    const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
    if (!contractAddress) throw new Error('Reward contract not deployed');
    const hash = await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'burnCollectibleForPerk',
      args: [tokenId],
    });
    return hash;
  }, [writeContractAsync]);

  const buyCollectible = useCallback(async (tokenId: bigint) => {
    const chainId = useChainId();
    const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
    if (!contractAddress) throw new Error('Reward contract not deployed');
    const hash = await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'buyCollectible',
      args: [tokenId],
    });
    return hash;
  }, [writeContractAsync]);

  return (
    <BlockopolyContext.Provider
      value={{
        registerPlayer,
        redeemVoucher,
        burnCollectible,
        buyCollectible,
      }}
    >
      {children}
    </BlockopolyContext.Provider>
  );
};

export const usePlayerContract = () => {
  const context = useContext(BlockopolyContext);
  if (!context) throw new Error('usePlayerContract must be used within PlayerContractProvider');
  return context;
};