'use client';

import { createContext, useContext, useCallback } from 'react';
import {
  useReadContract,
  useWriteContract,
  useAccount,
  useWaitForTransactionReceipt,
  usePublicClient,
} from 'wagmi';
import { Address } from 'viem';
import PlayerABI from './abi.json';

const getContractAddress = (chainId?: number): Address | undefined => {
  if (!chainId) return undefined;

  switch (chainId) {
    case 84532: // Base Sepolia
      return process.env.NEXT_PUBLIC_BASE_SEPOLIA as Address;
    case 8453: // Base mainnet
      return process.env.NEXT_PUBLIC_BASE as Address;
    case 42220: // Celo mainnet
      return process.env.NEXT_PUBLIC_CELO as Address;
    default:
      return undefined;
  }
};





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
const STAKE = 1e14;
/* ----------------------- Hooks ----------------------- */
export function useIsRegistered(
  address?: Address,
  options = { enabled: true }
) {
  const client = usePublicClient();
  const chainId = client?.chain?.id;
  const CONTRACT_ADDRESS = getContractAddress(chainId);
    if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not found for this chain ID");
  }

  
  const result = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PlayerABI,
    functionName: 'registered',
    args: address ? [address] : undefined,
    query: { enabled: options.enabled },
  });

  return {
    data: result.data as boolean | undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useIsInGame(
  gameId?: number,
  address?: Address,
  options = { enabled: true }
) {
  const client = usePublicClient();
  const chainId = client?.chain?.id;
  const CONTRACT_ADDRESS = getContractAddress(chainId);
    if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not found for this chain ID");
  }

  
  const result = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PlayerABI,
    functionName: 'gamePlayerInGame',
    args: address ? [gameId, address] : undefined,
    query: { enabled: options.enabled },
  });

  return {
    data: result.data as boolean | undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useGetUsername(address?: Address, options = { enabled: true }) {
  const client = usePublicClient();
  const chainId = client?.chain?.id;
  const CONTRACT_ADDRESS = getContractAddress(chainId);
    if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not found for this chain ID");
  }

  
  const result = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PlayerABI,
    functionName: 'addressToUsername',
    args: address ? [address] : undefined,
    query: { enabled: options.enabled },
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
  const client = usePublicClient();
  const chainId = client?.chain?.id;
  const CONTRACT_ADDRESS = getContractAddress(chainId);
    if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not found for this chain ID");
  }

  
  const result = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PlayerABI,
    functionName: 'players',
    args: address ? [address] : undefined,
    query: { enabled: options.enabled },
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
  starting_cash: number
) {
  const client = usePublicClient();
  const chainId = client?.chain?.id;

  const CONTRACT_ADDRESS = getContractAddress(chainId);

  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not found for this chain ID");
  }

  const {
    writeContractAsync,
    isPending,
    error,
    data: txHash,
  } = useWriteContract();

  const { isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const write = useCallback(async (): Promise<string> => {
    const result = await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: PlayerABI,
      functionName: "createGame",
      args: [
        username,
        gameType,
        playerSymbol,
        numberOfPlayers,
        gameCode,
        starting_cash,
      ],
      value: BigInt(STAKE),
    });

    if (!result)
      throw new Error("Invalid game ID returned from contract");

    return result as string;
  }, [
    writeContractAsync,
    username,
    gameType,
    playerSymbol,
    numberOfPlayers,
    gameCode,
    starting_cash,
    CONTRACT_ADDRESS,
  ]);

  return { write, isPending, error, txHash, isSuccess };
}

export function useCreateAiGame(
  username: string,
  gameType: string,
  playerSymbol: string,
  numberOfPlayers: number,
  gameCode: string,
  startingCash: number,
) {
    const client = usePublicClient();
  const chainId = client?.chain?.id;

  const CONTRACT_ADDRESS = getContractAddress(chainId);

  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not found for this chain ID");
  }

  const {
    writeContractAsync,
    isPending,
    error,
    data: txHash,
  } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async (): Promise<string> => {
    const result = await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: PlayerABI,
      functionName: 'createAIGame',
      args: [username, gameType, playerSymbol, numberOfPlayers, gameCode, startingCash],
      value: BigInt(STAKE),
    });

    if (!result) throw new Error('Invalid game ID returned from contract');
    return result as string;
  }, [writeContractAsync, username, gameType, playerSymbol, numberOfPlayers, startingCash]);

  return { write, isPending, error, txHash, isSuccess };
}

export function useUpdatePlayerPosition(
  gameId: bigint | number,
  targetPlayer: `0x${string}` | undefined,
  newPosition: number,           // uint8 → 0–39
  newBalance: bigint | number,
  balanceDelta: bigint | number, // int256 → can be negative
  propertyIds: number[]          // uint8[]
) {
    const client = usePublicClient();
  const chainId = client?.chain?.id;

  const CONTRACT_ADDRESS = getContractAddress(chainId);

  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not found for this chain ID");
  }

  const {
    writeContractAsync,
    isPending,
    error,
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
    if (
      !gameId ||
      !targetPlayer ||
      newPosition < 0 ||
      newPosition > 39 ||
      propertyIds.some(id => id < 0 || id > 39)
    ) {
      throw new Error("Invalid parameters for updatePlayerPosition");
    }

    const hash = await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: PlayerABI,
      functionName: "updatePlayerPosition",
      args: [
        BigInt(gameId),
        targetPlayer,
        Number(newPosition),                    // uint8
        BigInt(newBalance),                     // uint256
        BigInt(balanceDelta),                   // int256 (signed)
        propertyIds.map(id => Number(id)),      // uint8[]
      ],
    });

    return hash ?? null;
  }, [
    writeContractAsync,
    gameId,
    targetPlayer,
    newPosition,
    newBalance,
    balanceDelta,
    propertyIds,
  ]);

  return {
    updatePosition,
    isPending,
    isConfirming,
    isSuccess,
    isError: !!error || isTxError,
    error: error,
    txHash,
    reset, // useful to clear state after success/error
  };
}

export function useJoinGame(gameId: number, username: string, playerSymbol: string, code: string) {
    const client = usePublicClient();
  const chainId = client?.chain?.id;

  const CONTRACT_ADDRESS = getContractAddress(chainId);

  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not found for this chain ID");
  }

  const {
    writeContractAsync,
    isPending,
    error,
    data: txHash,
  } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async (): Promise<string> => {
    const result = await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: PlayerABI,
      functionName: 'joinGame',
      args: [gameId, username, playerSymbol, code],
       value: BigInt(STAKE),
    });

    if (!result) throw new Error('Invalid game ID returned from contract');
    return result as string;
  }, [writeContractAsync, gameId, playerSymbol]);

  return { write, isPending, error, txHash, isSuccess };
}

export function useGetGame(gameId?: string, options = { enabled: true }) {
    const client = usePublicClient();
  const chainId = client?.chain?.id;

  const CONTRACT_ADDRESS = getContractAddress(chainId);

  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not found for this chain ID");
  }

  const result = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PlayerABI,
    functionName: 'getGame',
    args: gameId ? [gameId] : undefined,
    query: { enabled: options.enabled && !!gameId },
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
    const client = usePublicClient();
  const chainId = client?.chain?.id;

  const CONTRACT_ADDRESS = getContractAddress(chainId);

  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not found for this chain ID");
  }

  const result = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PlayerABI,
    functionName: 'getPlayer',
    args: address ? [address] : undefined,
    query: { enabled: options.enabled },
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
    const client = usePublicClient();
  const chainId = client?.chain?.id;

  const CONTRACT_ADDRESS = getContractAddress(chainId);

  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not found for this chain ID");
  }

  const result = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PlayerABI,
    functionName: 'getPlayerById',
    args: id !== undefined ? [id] : undefined,
    query: { enabled: options.enabled && id !== undefined },
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
    const client = usePublicClient();
  const chainId = client?.chain?.id;

  const CONTRACT_ADDRESS = getContractAddress(chainId);

  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not found for this chain ID");
  }

  const result = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PlayerABI,
    functionName: 'getGameByCode',
    args: code ? [code] : undefined,
    query: { enabled: options.enabled && !!code },
  });

  let gameData: ExtendedGameData | undefined;

  if (result.data && typeof result.data === 'object') {
    const d = result.data as Record<string, unknown>;

    // Only assign if the keys exist
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
    const client = usePublicClient();
  const chainId = client?.chain?.id;

  const CONTRACT_ADDRESS = getContractAddress(chainId);

  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not found for this chain ID");
  }

  const result = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PlayerABI,
    functionName: 'getGamePlayer',
    args: gameId !== undefined && address ? [gameId, address] : undefined,
    query: { enabled: options.enabled && gameId !== undefined && !!address },
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
    const client = usePublicClient();
  const chainId = client?.chain?.id;

  const CONTRACT_ADDRESS = getContractAddress(chainId);

  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not found for this chain ID");
  }

  const { writeContractAsync, isPending, error, data: txHash } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async (): Promise<void> => {
    await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: PlayerABI,
      functionName: 'startGame',
      args: [gameId],
    });
  }, [writeContractAsync, gameId]);

  return { write, isPending, error, txHash, isSuccess };
}

export function useEndGame(gameId: number, winnerAddr: Address) {
    const client = usePublicClient();
  const chainId = client?.chain?.id;

  const CONTRACT_ADDRESS = getContractAddress(chainId);

  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not found for this chain ID");
  }

  const { writeContractAsync, isPending, error, data: txHash } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async (): Promise<void> => {
    await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: PlayerABI,
      functionName: 'endGame',
      args: [gameId, winnerAddr],
    });
  }, [writeContractAsync, gameId, winnerAddr]);

  return { write, isPending, error, txHash, isSuccess };
}

export function useRollDice(gameId: number) {
    const client = usePublicClient();
  const chainId = client?.chain?.id;

  const CONTRACT_ADDRESS = getContractAddress(chainId);

  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not found for this chain ID");
  }

  const { writeContractAsync, isPending, error, data: txHash } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async (): Promise<void> => {

    await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: PlayerABI,
      functionName: 'rollDice',
      args: [gameId],
    });
  }, [writeContractAsync, gameId]);

  return { write, isPending, error, txHash, isSuccess };
}

export function useDrawChanceCard(gameId?: number, options = { enabled: true }) {
    const client = usePublicClient();
  const chainId = client?.chain?.id;

  const CONTRACT_ADDRESS = getContractAddress(chainId);

  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not found for this chain ID");
  }

  const result = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PlayerABI,
    functionName: 'drawChanceCard',
    args: gameId !== undefined ? [gameId] : undefined,
    query: { enabled: options.enabled && gameId !== undefined },
  });

  return {
    data: result.data ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useDrawCommunityCard(gameId?: number, options = { enabled: true }) {
    const client = usePublicClient();
  const chainId = client?.chain?.id;

  const CONTRACT_ADDRESS = getContractAddress(chainId);

  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not found for this chain ID");
  }

  const result = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PlayerABI,
    functionName: 'drawCommunityCard',
    args: gameId !== undefined ? [gameId] : undefined,
    query: { enabled: options.enabled && gameId !== undefined },
  });

  return {
    data: result.data ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useTotalUsers(options = { enabled: true }) {
    const client = usePublicClient();
  const chainId = client?.chain?.id;

  const CONTRACT_ADDRESS = getContractAddress(chainId);

  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not found for this chain ID");
  }

  const result = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PlayerABI,
    functionName: 'totalUsers',
    query: { enabled: options.enabled },
  });

  return {
    data: result.data ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useTotalGames(options = { enabled: true }) {
    const client = usePublicClient();
  const chainId = client?.chain?.id;

  const CONTRACT_ADDRESS = getContractAddress(chainId);

  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not found for this chain ID");
  }

  const result = useReadContract({
    address: CONTRACT_ADDRESS,
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
    const client = usePublicClient();
  const chainId = client?.chain?.id;

  const CONTRACT_ADDRESS = getContractAddress(chainId);

  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not found for this chain ID");
  }

  const result = useReadContract({
    address: CONTRACT_ADDRESS,
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

/* ----------------------- Context ----------------------- */
type ContractContextType = {
  registerPlayer: (username: string) => Promise<void>;
  totalUsers: () => Promise<bigint>;
  totalGames: () => Promise<bigint>;
  boardSize: () => Promise<bigint>;
};

const BlockopolyContext = createContext<ContractContextType | undefined>(undefined);

export const PlayerContractProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { address: userAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();
    const client = usePublicClient();
  const chainId = client?.chain?.id;

  const CONTRACT_ADDRESS = getContractAddress(chainId);

  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract address not found for this chain ID");
  }


  const registerPlayer = useCallback(
    async (username: string) => {
      if (!userAddress) throw new Error('No wallet connected');
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: PlayerABI,
        functionName: 'registerPlayer',
        args: [username],
      });
    },
    [userAddress, writeContractAsync]
  );

  const totalUsers = useCallback(async (): Promise<bigint> => {
    const result = await useReadContract({
      address: CONTRACT_ADDRESS,
      abi: PlayerABI,
      functionName: 'totalUsers',
    });
    return BigInt(result.data as bigint);
  }, []);

  const totalGames = useCallback(async (): Promise<bigint> => {
    const result = await useReadContract({
      address: CONTRACT_ADDRESS,
      abi: PlayerABI,
      functionName: 'totalGames',
    });
    return BigInt(result.data as bigint);
  }, []);

  const boardSize = useCallback(async (): Promise<bigint> => {
    const result = await useReadContract({
      address: CONTRACT_ADDRESS,
      abi: PlayerABI,
      functionName: 'BOARD_SIZE',
    });
    return BigInt(result.data as bigint);
  }, []);

  return (
    <BlockopolyContext.Provider value={{ registerPlayer, totalUsers, totalGames, boardSize }}>
      {children}
    </BlockopolyContext.Provider>
  );
};

export const usePlayerContract = () => {
  const context = useContext(BlockopolyContext);
  if (!context)
    throw new Error(
      'usePlayerContract must be used within a PlayerContractProvider'
    );
  return context;
};