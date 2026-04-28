'use client';

import { createContext, useContext, useCallback, useMemo, useState } from 'react';
import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useAccount,
  useWaitForTransactionReceipt,
  useChainId,
  usePublicClien
} from 'wagmi';
import { celo } from 'wagmi/chains';
import { Address, createPublicClient, decodeEventLog, getAddress, hexToBigInt, http, parseEventLogs, zeroAddress } from 'viem';
import { celo as celoChain, celoAlfajores } from 'viem/chains';
import TycoonABI from './abi/tycoonabi.json';
import RewardABI from './abi/rewardabi.json';
import Erc20Abi from './abi/ERC20abi.json';
import UserWalletABI from './abi/tycoon-user-wallet-abi.json';
import { TYCOON_CONTRACT_ADDRESSES, REWARD_CONTRACT_ADDRESSES, USDC_TOKEN_ADDRESS, AI_AGENT_REGISTRY_ADDRESSES, USER_REGISTRY_ADDRESSES, ERC8004_REPUTATION_REGISTRY_ADDRESSES, ERC8004_IDENTITY_REGISTRY_ADDRESSES } from '@/constants/contracts';
import RegistryABI from './abi/tycoon-ai-registry-abi.json';
import ERC8004ReputationABI from './abi/erc8004-reputation-abi.json';
import ERC8004IdentityABI from './abi/erc8004-identity-abi.json';
import { getCeloRpcUrlForChainId, registerErc8004AgentViaInjectedEoa } from '@/lib/utils/erc8004InjectedEoa';
import { API_BASE_URL } from '@/lib/api';

// Fixed stake amount (adjust if needed)
const STAKE_AMOUNT = 1; // 1 wei for testing? Or change to actual value like 0.01 ether = 10000000000000000n

/* ----------------------- Types (Matching New Contracts) ----------------------- */


type User = {
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
  propertiesbought?: bigint;
  propertiesSold?: bigint;
};
/** Matches TycoonLib.User: id, username, playerAddress, registeredAt, gamesPlayed, gamesWon, gamesLost, totalStaked, totalEarned, totalWithdrawn, propertiesbought, propertiesSold */
type UserTuple = [bigint, string, Address, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];

export type GameSettings = {
  maxPlayers: number;
  auction: boolean;
  rentInPrison: boolean;
  mortgage: boolean;
  evenBuild: boolean;
  startingCash: bigint;
  privateRoomCode: string;
};

type Game = {
  id: bigint;
  code: string;
  creator: Address;
  status: number;
  winner: Address;
  numberOfPlayers: number;
  joinedPlayers: number;
  mode: number;
  ai: boolean;
  createdAt: bigint;
  stakePerPlayer: bigint;
  endedAt: bigint;
  totalStaked: bigint;
};

type ExtendedGameData = Game;
type GameTuple = [bigint, string, Address, number, number, Address, number, number, number, boolean, bigint, bigint, bigint, bigint];

type GamePlayer = {
  gameId: bigint;
  playerAddress: Address;
  balance: bigint;
  position: number;
  order: number;
  symbol: number;
  username: string;
};
type GamePlayerTuple = [bigint, Address, bigint, number, number, number, string];

/* ----------------------- Reward System Types ----------------------- */

export enum CollectiblePerk {
  NONE = 0,
  EXTRA_TURN = 1,
  JAIL_FREE = 2,
  DOUBLE_RENT = 3,
  ROLL_BOOST = 4,
  CASH_TIERED = 5,
  TELEPORT = 6,
  SHIELD = 7,
  PROPERTY_DISCOUNT = 8,
  TAX_REFUND = 9,
  ROLL_EXACT = 10,
  RENT_CASHBACK = 11,
  INTEREST = 12,
  LUCKY_7 = 13,
  FREE_PARKING_BONUS = 14,
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

/* ----------------------- Core Hooks ----------------------- */

export function useIsRegistered(address?: Address) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'registered',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });

  return {
    data: result.data as boolean | undefined,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}

export function useGetUsername(address?: Address) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'addressToUsername',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });

  return {
    data: result.data as string | undefined,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}

const UserRegistryABI = [
  { inputs: [{ name: 'ownerAddress', type: 'address' }], name: 'getWallet', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'ownerAddress', type: 'address' }], name: 'hasWallet', outputs: [{ type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '', type: 'address' }], name: 'ownerByWallet', outputs: [{ type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'newOwner', type: 'address' }], name: 'transferProfileTo', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'recreateWalletForUser', outputs: [{ name: 'newWallet', type: 'address' }], stateMutability: 'nonpayable', type: 'function' },
  /** Same as recreateWalletForUser but takes profile owner explicitly; contract allows caller to pass their own address. Use this so encoding is unambiguous. */
  { inputs: [{ name: 'profileOwner', type: 'address' }], name: 'recreateWalletForUserByBackend', outputs: [{ name: 'newWallet', type: 'address' }], stateMutability: 'nonpayable', type: 'function' },
] as const;

/** Celo-only: when disconnected, wagmi chain id may be unset — still resolve registry/reward reads on Celo. */
export function useReadChainIdOrCelo(): number {
  const raw = useChainId();
  if (raw && REWARD_CONTRACT_ADDRESSES[raw as keyof typeof REWARD_CONTRACT_ADDRESSES]) return raw;
  return celo.id;
}

/** Smart wallet address for a registered user (from TycoonUserRegistry). Only set after registry is deployed and user has registered. */
export function useUserRegistryWallet(ownerAddress?: Address) {
  const chainId = useReadChainIdOrCelo();
  const registryAddress = USER_REGISTRY_ADDRESSES[chainId];
  const result = useReadContract({
    address: registryAddress,
    abi: UserRegistryABI,
    functionName: 'getWallet',
    args: ownerAddress ? [ownerAddress] : undefined,
    query: { enabled: !!ownerAddress && !!registryAddress },
  });
  return {
    data: result.data as Address | undefined,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}

/** True if the address has a smart wallet in TycoonUserRegistry (profile exists and wallet != 0). */
export function useHasSmartWallet(ownerAddress?: Address) {
  const chainId = useReadChainIdOrCelo();
  const registryAddress = USER_REGISTRY_ADDRESSES[chainId];
  const result = useReadContract({
    address: registryAddress,
    abi: UserRegistryABI,
    functionName: 'hasWallet',
    args: ownerAddress ? [ownerAddress] : undefined,
    query: { enabled: !!ownerAddress && !!registryAddress },
  });
  return {
    data: result.data as boolean | undefined,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}

/** On-chain profile owner for a smart wallet (TycoonUserRegistry.ownerByWallet). */
export function useProfileOwner(smartWalletAddress?: Address) {
  const chainId = useReadChainIdOrCelo();
  const registryAddress = USER_REGISTRY_ADDRESSES[chainId];
  const result = useReadContract({
    address: registryAddress,
    abi: UserRegistryABI,
    functionName: 'ownerByWallet',
    args: smartWalletAddress ? [smartWalletAddress] : undefined,
    query: { enabled: !!smartWalletAddress && !!registryAddress },
  });
  return {
    data: result.data as Address | undefined,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}

/** Write: transfer profile (and smart wallet ownership) to new EOA. Caller must be current profile owner. */
export function useTransferProfileTo() {
  const chainId = useChainId();
  const registryAddress = USER_REGISTRY_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const transfer = useCallback(
    async (newOwner: Address) => {
      if (!registryAddress) throw new Error('User registry not configured for this chain');
      await writeContractAsync({
        address: registryAddress,
        abi: UserRegistryABI,
        functionName: 'transferProfileTo',
        args: [newOwner],
      });
    },
    [registryAddress, writeContractAsync]
  );

  return {
    transfer,
    isPending: isPending || isConfirming,
    isSuccess,
    error: writeError,
    txHash,
    reset,
  };
}

/** Write: create a new smart wallet for the current profile; registry updates profile to the new wallet. Caller must be profile owner. Uses recreateWalletForUserByBackend(caller) so encoding matches contract (contract allows profile owner to call for themselves). */
export function useRecreateWalletForUser() {
  const chainId = useChainId();
  const { address: walletAddress } = useAccount();
  const registryAddress = USER_REGISTRY_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const recreate = useCallback(
    async () => {
      if (!registryAddress) throw new Error('User registry not configured for this chain');
      if (!walletAddress) throw new Error('Connect your wallet to recreate smart wallet');
      return await writeContractAsync({
        address: registryAddress,
        abi: UserRegistryABI,
        functionName: 'recreateWalletForUserByBackend',
        args: [walletAddress],
      });
    },
    [registryAddress, walletAddress, writeContractAsync]
  );

  return {
    recreate,
    isPending: isPending || isConfirming,
    isSuccess,
    error: writeError,
    txHash,
    reset,
  };
}

export function usePreviousGameCode(address?: Address) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'previousGameCode',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });

  return {
    data: result.data as string | undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useRegisterPlayer() {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(
    async (username: string) => {
      if (!contractAddress) throw new Error('Contract not deployed on this chain');
      if (!username.trim()) throw new Error('Username cannot be empty');

      const hash = await writeContractAsync({
        address: contractAddress,
        abi: TycoonABI,
        functionName: 'registerPlayer',
        args: [username.trim()],
      });
      return hash;
    },
    [writeContractAsync, contractAddress]
  );

  return { write, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useCreateGame(
  creatorUsername: string,
  gameType: string,
  playerSymbol: string,
  numberOfPlayers: number,
  code: string,
  startingCash: bigint,
  stake: bigint,
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

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async () => {
    if (!contractAddress) throw new Error('Contract not deployed');

    return writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'createGame',
      args: [
        creatorUsername,
        gameType,
        playerSymbol,
        numberOfPlayers,
        code,
        startingCash,
        stake,
      ],
    });
  }, [
    writeContractAsync,
    contractAddress,
    creatorUsername,
    gameType,
    playerSymbol,
    numberOfPlayers,
    code,
    startingCash,
    stake,
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

export function useCreateAIGame(
  creatorUsername: string,
  gameType: string,
  playerSymbol: string,
  numberOfAI: number,
  code: string,
  startingCash: bigint,
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

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async (usernameOverride?: string) => {
    if (!contractAddress) throw new Error('Contract not deployed');
    const username = (usernameOverride ?? creatorUsername).trim();
    if (!username) throw new Error('Username required (contract: validateUsername reverts "Username empty")');

    return writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'createAIGame',
      args: [
        username,
        gameType,
        playerSymbol,
        numberOfAI,
        code,
        startingCash,
      ],
    });
  }, [
    writeContractAsync,
    contractAddress,
    creatorUsername,
    gameType,
    playerSymbol,
    numberOfAI,
    code,
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



/** On TycoonUpgradeable this calls setPropertyStats(seller, buyer). Only the game faucet can call it. */
export function useTransferPropertyOwnership() {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const {
    writeContractAsync,
    isPending,
    error: writeError,
    data: txHash,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async (seller: string, buyer: string) => {
    if (!contractAddress) throw new Error('Contract not deployed');

    return writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'setPropertyStats',
      args: [seller, buyer],
    });
  }, [writeContractAsync, contractAddress]);

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



export function useJoinGame(gameId: bigint, username: string, playerSymbol: string, code: string, stake: bigint) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async () => {
    if (!contractAddress) throw new Error('Contract not deployed');
    const hash = await writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'joinGame',
      args: [gameId, username, playerSymbol, code],
    });
    return hash;
  }, [writeContractAsync, contractAddress, gameId, username, playerSymbol, code]);

  return { write, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useEndAIGameAndClaim(gameId: bigint, finalPosition: number, finalBalance: bigint, isWin: boolean) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const write = useCallback(async () => {
    if (!contractAddress) throw new Error('Contract not deployed');
    const hash = await writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'endAIGame',
      args: [gameId, finalPosition, finalBalance, isWin],
    });
    return hash;
  }, [writeContractAsync, contractAddress, gameId, finalPosition, finalBalance, isWin]);

  return { write, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

/** Params for one AI agent stats update (from frontend/backend after game end). */
export type AIAgentStatsUpdate = {
  agentAddress: Address;
  won: boolean;
  finalBalance: bigint;
  propertiesBought?: number;
  tradesProposed?: number;
  tradesAccepted?: number;
  housesBuilt?: number;
  hotelsBuilt?: number;
  wentBankrupt?: boolean;
};

/**
 * Update AI agent stats on the registry. Only works if connected wallet is the registry's statsUpdater.
 * Call after endAIGame succeeds. Alternatively have your backend (with updater key) call the registry.
 */
export function useUpdateAIAgentStats() {
  const chainId = useChainId();
  const registryAddress = AI_AGENT_REGISTRY_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const updateOne = useCallback(async (update: AIAgentStatsUpdate) => {
    if (!registryAddress) throw new Error('AI registry not configured');
    await writeContractAsync({
      address: registryAddress,
      abi: RegistryABI as never,
      functionName: 'updateAgentStats',
      args: [
        update.agentAddress,
        update.won,
        update.finalBalance,
        BigInt(update.propertiesBought ?? 0),
        BigInt(update.tradesProposed ?? 0),
        BigInt(update.tradesAccepted ?? 0),
        BigInt(update.housesBuilt ?? 0),
        BigInt(update.hotelsBuilt ?? 0),
        update.wentBankrupt ?? false,
      ],
    });
  }, [writeContractAsync, registryAddress]);

  const updateAll = useCallback(async (updates: AIAgentStatsUpdate[]) => {
    for (const u of updates) await updateOne(u);
  }, [updateOne]);

  return { updateOne, updateAll, isPending: isPending || isConfirming, isSuccess, error: writeError, txHash, reset };
}

/** One registered AI agent from the on-chain registry */
export type RegisteredAIAgent = {
  tokenId: number;
  name: string;
  playStyle: string;
  difficultyLevel: number;
  agentAddress: Address;
};

/**
 * Fetch all registered AI agents from the registry (for game settings / agent picker).
 */
export function useRegisteredAIAgents() {
  const chainId = useChainId();
  const registryAddress = AI_AGENT_REGISTRY_ADDRESSES[chainId];

  const { data: tokenIds, isLoading: isLoadingIds } = useReadContract({
    address: registryAddress as Address,
    abi: RegistryABI as never,
    functionName: 'getAllAgents',
    query: { enabled: !!registryAddress },
  });

  const ids = useMemo(() => {
    if (!tokenIds || !Array.isArray(tokenIds)) return [];
    return (tokenIds as bigint[]).map((id) => Number(id));
  }, [tokenIds]);

  const contracts = useMemo(
    () =>
      ids.map((id) => ({
        address: registryAddress as Address,
        abi: RegistryABI as never,
        functionName: 'getAgent' as const,
        args: [id] as [number],
      })),
    [registryAddress, ids]
  );

  const { data: agentsResults, isLoading: isLoadingAgents } = useReadContracts({
    contracts,
    query: { enabled: !!registryAddress && ids.length > 0 },
  });

  const agents = useMemo((): RegisteredAIAgent[] => {
    if (!agentsResults || agentsResults.length !== ids.length) return [];
    return ids.map((id, i) => {
      const r = agentsResults[i] as { result?: unknown } | undefined;
      if (!r?.result || !Array.isArray(r.result)) return null;
      const [name, playStyle, difficultyLevel, agentAddress] = r.result as [string, string, number, Address, unknown, unknown];
      return { tokenId: id, name, playStyle, difficultyLevel, agentAddress };
    }).filter((a): a is RegisteredAIAgent => a != null);
  }, [agentsResults, ids]);

  return {
    agents,
    isLoading: isLoadingIds || isLoadingAgents,
    isSupported: !!registryAddress,
  };
}

/**
 * Submit reputation feedback for an ERC-8004 agent after an AI game.
 * Call after endAIGame (claim) succeeds. Human's wallet pays gas on Celo.
 * Requires NEXT_PUBLIC_ERC8004_AGENT_ID to be set; no-op if not set or not on Celo.
 */
export function useGiveERC8004Feedback() {
  const chainId = useChainId();
  const registryAddress = ERC8004_REPUTATION_REGISTRY_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, reset } = useWriteContract();

  const giveFeedback = useCallback(
    async (agentId: bigint | number, score: number) => {
      if (!registryAddress) return;
      const id = typeof agentId === 'number' ? BigInt(agentId) : agentId;
      // giveFeedback(agentId, value int128, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)
      await writeContractAsync({
        address: registryAddress,
        abi: ERC8004ReputationABI as never,
        functionName: 'giveFeedback',
        args: [id, BigInt(score), 0, 'tycoon', 'gameResult', '', '', '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`],
      });
    },
    [writeContractAsync, registryAddress]
  );

  return { giveFeedback, isPending, error: writeError, reset };
}

/** ERC-721 mint: Transfer(from=0, to=minter, tokenId) — Celo ERC-8004 quick start uses this for agentId ([docs](https://docs.celo.org/build-on-celo/build-with-ai/8004)). */
const ERC8004_TRANSFER_EVENT = {
  type: 'event' as const,
  name: 'Transfer',
  inputs: [
    { indexed: true, name: 'from', type: 'address' },
    { indexed: true, name: 'to', type: 'address' },
    { indexed: true, name: 'tokenId', type: 'uint256' },
  ],
};

const ERC8004_REGISTERED_EVENT = {
  type: 'event' as const,
  name: 'Registered',
  inputs: [
    { indexed: true, name: 'agentId', type: 'uint256' },
    { indexed: false, name: 'agentURI', type: 'string' },
    { indexed: true, name: 'owner', type: 'address' },
  ],
};

/** keccak256("Transfer(address,address,uint256)") — ERC-721 mint uses indexed tokenId (often empty `data`). */
const ERC721_TRANSFER_TOPIC0 =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as const;

function txHashEq(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

/** Decode `address` from a 32-byte log topic (last 20 bytes). */
function topicToAddress(topic: `0x${string}` | undefined): Address | null {
  if (!topic || topic.length < 66) return null;
  try {
    return getAddress(`0x${topic.slice(-40)}` as `0x${string}`);
  } catch {
    return null;
  }
}

/**
 * Fallback when viem decode is flaky: read mint Transfer(from=0) from the identity registry only.
 * Smart-wallet / batched txs may include other contracts’ logs; we only inspect `registryAddress`.
 */
function parseAgentIdFromRawErc721MintLogs(
  logs: readonly { address: Address; topics: readonly `0x${string}`[] }[],
  registryAddress: Address,
  ownerAddress: Address | undefined
): number | null {
  const reg = getAddress(registryAddress);
  const owner = ownerAddress ? getAddress(ownerAddress) : null;
  const mints: { tokenId: number; to: Address }[] = [];

  for (const log of logs) {
    if (getAddress(log.address) !== reg) continue;
    if (log.topics[0] !== ERC721_TRANSFER_TOPIC0 || log.topics.length !== 4) continue;
    const from = topicToAddress(log.topics[1]);
    if (!from || getAddress(from) !== getAddress(zeroAddress)) continue;
    const to = topicToAddress(log.topics[2]);
    if (!to) continue;
    mints.push({ tokenId: Number(hexToBigInt(log.topics[3]!)), to });
  }

  if (mints.length === 1) return mints[0].tokenId;
  if (owner && mints.length > 0) {
    const hit = mints.find((m) => getAddress(m.to) === owner);
    if (hit) return hit.tokenId;
  }
  if (mints.length > 0) return mints[mints.length - 1].tokenId;
  return null;
}

function parseAgentIdFromRegisterReceipt(
  receipt: { logs: readonly { address: Address; data: `0x${string}`; topics: readonly `0x${string}`[] }[] },
  registryAddress: Address,
  ownerAddress: Address | undefined
): number | null {
  const reg = getAddress(registryAddress);
  const owner = ownerAddress ? getAddress(ownerAddress) : null;
  const registryLogs = receipt.logs.filter((l) => getAddress(l.address) === reg);

  try {
    const registered = parseEventLogs({
      abi: ERC8004IdentityABI,
      eventName: 'Registered',
      logs: registryLogs,
    });
    if (registered.length === 1) return Number(registered[0].args.agentId);
    if (registered.length > 1 && owner) {
      const hit = registered.find(
        (e) => e.args.owner && getAddress(e.args.owner as Address) === owner
      );
      if (hit) return Number(hit.args.agentId);
    }
    if (registered.length > 0) return Number(registered[registered.length - 1].args.agentId);
  } catch {
    // continue
  }

  try {
    const transfers = parseEventLogs({
      abi: ERC8004IdentityABI,
      eventName: 'Transfer',
      logs: registryLogs,
    });
    const mints = transfers.filter(
      (t) => t.args.from && getAddress(t.args.from as Address) === getAddress(zeroAddress)
    );
    if (mints.length === 1) return Number(mints[0].args.tokenId);
    if (owner && mints.length > 0) {
      const hit = mints.find(
        (t) => t.args.to && getAddress(t.args.to as Address) === owner
      );
      if (hit) return Number(hit.args.tokenId);
    }
    if (mints.length > 0) return Number(mints[mints.length - 1].args.tokenId);
  } catch {
    // continue
  }

  const raw = parseAgentIdFromRawErc721MintLogs(receipt.logs, registryAddress, ownerAddress);
  if (raw != null) return raw;

  /** Legacy per-log decode (covers ABI edge cases parseEventLogs misses). */
  const mintTokenIds: number[] = [];
  for (const log of registryLogs) {
    try {
      const decoded = decodeEventLog({
        abi: ERC8004IdentityABI as never,
        data: log.data,
        topics: log.topics,
        strict: false,
      });
      if (decoded.eventName === 'Transfer') {
        const args = decoded.args as { from?: Address; to?: Address; tokenId?: bigint };
        if (
          args.from &&
          args.to &&
          args.tokenId != null &&
          getAddress(args.from) === getAddress(zeroAddress)
        ) {
          const id = Number(args.tokenId);
          if (owner && getAddress(args.to) === owner) {
            return id;
          }
          mintTokenIds.push(id);
        }
      }
      if (decoded.eventName === 'Registered' && decoded.args && 'agentId' in decoded.args) {
        return Number((decoded.args as { agentId: bigint }).agentId);
      }
    } catch {
      // not this event shape
    }
  }

  if (mintTokenIds.length === 1) {
    return mintTokenIds[0];
  }

  return null;
}

/**
 * Register a Tycoon agent on Celo ERC-8004 Identity Registry.
 * Uses the injected browser wallet (EOA) only — not wagmi / WalletConnect — so the NFT owner is always the extension account.
 */
export function useRegisterAgentERC8004() {
  const chainId = useChainId();
  const [isPending, setIsPending] = useState(false);

  const register = useCallback(
    async (agentDbId: number): Promise<number | null> => {
      const base = API_BASE_URL.replace(/\/$/, "");
      const agentURI = `${base}/agents/${agentDbId}/erc8004-registration`;
      /** Celo mainnet vs Alfajores — do not use arbitrary wagmi chainId (e.g. Base) for registry lookup. */
      const registryChainId = chainId === 44787 ? 44787 : 42220;
      const identityRegistryAddress = ERC8004_IDENTITY_REGISTRY_ADDRESSES[registryChainId];
      if (!identityRegistryAddress) {
        throw new Error('ERC-8004 identity registry address is not configured for this network.');
      }

      const receiptClient = createPublicClient({
        chain: registryChainId === 44787 ? celoAlfajores : celoChain,
        transport: http(getCeloRpcUrlForChainId(registryChainId)),
      });

      setIsPending(true);
      try {
        const { account: eoaAddress, hash } = await registerErc8004AgentViaInjectedEoa({
          chainId: registryChainId,
          contractAddress: identityRegistryAddress,
          abi: ERC8004IdentityABI as never,
          agentURI,
        });
        const receipt = await receiptClient.waitForTransactionReceipt({ hash });
        const receiptFromRpc = await receiptClient.getTransactionReceipt({ hash }).catch(() => null);
        const logsSource =
          receiptFromRpc && receiptFromRpc.logs.length > receipt.logs.length ? receiptFromRpc : receipt;

        let agentId = parseAgentIdFromRegisterReceipt(logsSource, identityRegistryAddress, eoaAddress);
        if (agentId != null) return agentId;

        // Fallback: query logs in the block (some RPCs omit full log decoding in receipt)
        try {
        const allMintsInBlock = await receiptClient.getLogs({
          address: identityRegistryAddress,
          event: ERC8004_TRANSFER_EVENT,
          args: { from: zeroAddress },
          fromBlock: receipt.blockNumber,
          toBlock: receipt.blockNumber,
        });
        const mintsThisTx = allMintsInBlock.filter((l) => txHashEq(l.transactionHash, hash));
        if (mintsThisTx.length === 1 && mintsThisTx[0].args?.tokenId != null) {
          return Number(mintsThisTx[0].args.tokenId);
        }
        if (mintsThisTx.length > 0) {
          const owner = getAddress(eoaAddress);
          const toOwner = mintsThisTx.find(
            (l) => l.args?.to != null && getAddress(l.args.to as Address) === owner
          );
          if (toOwner?.args?.tokenId != null) {
            return Number(toOwner.args.tokenId);
          }
        }
        const lastMint = mintsThisTx[mintsThisTx.length - 1];
        if (lastMint?.args?.tokenId != null) {
          return Number(lastMint.args.tokenId);
        }
        } catch {
          // continue
        }

        try {
          const registeredInBlock = await receiptClient.getLogs({
          address: identityRegistryAddress,
          event: ERC8004_REGISTERED_EVENT,
          fromBlock: receipt.blockNumber,
          toBlock: receipt.blockNumber,
        });
        const registeredThisTx = registeredInBlock.filter((l) => txHashEq(l.transactionHash, hash));
        if (registeredThisTx.length > 0) {
          const owner = getAddress(eoaAddress);
          const forOwner = registeredThisTx.find(
            (l) => l.args?.owner != null && getAddress(l.args.owner as Address) === owner
          );
          if (forOwner?.args?.agentId != null) return Number(forOwner.args.agentId);
        }
        const lastReg = registeredThisTx[registeredThisTx.length - 1];
        if (lastReg?.args?.agentId != null) return Number(lastReg.args.agentId);
      } catch {
        // continue
      }

      try {
        const registeredLogs = await receiptClient.getLogs({
          address: identityRegistryAddress,
          event: ERC8004_REGISTERED_EVENT,
          args: { owner: getAddress(eoaAddress) },
          fromBlock: receipt.blockNumber,
          toBlock: receipt.blockNumber,
        });
        const exactTxLog = registeredLogs.find((l) => txHashEq(l.transactionHash, hash));
        if (exactTxLog?.args?.agentId != null) {
          return Number(exactTxLog.args.agentId);
        }
      } catch {
        // continue
      }

      // Last resort: ERC721Enumerable (not on all deployments — often reverts)
      try {
        const balance = await receiptClient.readContract({
          address: identityRegistryAddress,
          abi: ERC8004IdentityABI as never,
          functionName: 'balanceOf',
          args: [eoaAddress],
        });
        const bal = Number(balance ?? 0);
        if (bal > 0) {
          const tokenId = await receiptClient.readContract({
            address: identityRegistryAddress,
            abi: ERC8004IdentityABI as never,
            functionName: 'tokenOfOwnerByIndex',
            args: [eoaAddress, BigInt(bal - 1)],
          });
          if (tokenId != null) return Number(tokenId);
        }
      } catch {
        // enumerable not supported
      }
        throw new Error(
          'Transaction confirmed but the app could not read the new ERC-8004 agent ID from the receipt. Check the tx in a block explorer or enter the ID manually.'
        );
      } finally {
        setIsPending(false);
      }
    },
    [chainId]
  );

  const reset = useCallback(() => {}, []);

  return { register, isPending, error: null, reset };
}

export type Erc8004VerifyResult = {
  valid: boolean;
  /** True when the agent exists and the provided wallet is the on-chain owner */
  isOwner?: boolean;
  /** On-chain owner address (when valid) */
  owner?: string;
  error?: string;
};

/**
 * Verify an ERC-8004 agent ID by reading ownerOf from the Identity Registry (ERC-721).
 * When userAddress is provided, also checks that the connected wallet owns the agent.
 * Only works when connected to Celo (42220) or Alfajores (44787).
 */
export function useVerifyErc8004AgentId() {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const isCelo = chainId === 42220 || chainId === 44787;

  const verifyAgentId = useCallback(
    async (agentIdStr: string, userAddress?: string): Promise<Erc8004VerifyResult> => {
      const trimmed = String(agentIdStr).trim();
      if (!trimmed) return { valid: false, error: 'Enter an agent ID' };
      const id = Number(trimmed);
      if (!Number.isInteger(id) || id < 1) return { valid: false, error: 'Invalid ID (must be a positive integer)' };
      if (!isCelo) return { valid: false, error: 'Switch to Celo to verify' };
      const identityRegistryAddress = ERC8004_IDENTITY_REGISTRY_ADDRESSES[chainId];
      if (!publicClient || !identityRegistryAddress) return { valid: false, error: 'Cannot verify' };
      try {
        const owner = await publicClient.readContract({
          address: identityRegistryAddress,
          abi: ERC8004IdentityABI as never,
          functionName: 'ownerOf',
          args: [BigInt(id)],
        });
        const valid = !!owner && owner !== '0x0000000000000000000000000000000000000000';
        if (!valid) return { valid: false, error: 'Agent not found' };
        const isOwner =
          !!userAddress &&
          !!owner &&
          String(owner).toLowerCase() === String(userAddress).toLowerCase();
        return { valid: true, isOwner, owner: owner as string };
      } catch {
        return { valid: false, error: 'Agent not found or invalid ID' };
      }
    },
    [publicClient, isCelo, chainId]
  );

  /** Get the first ERC-8004 agent ID owned by the given address (if registry supports enumeration). */
  const getAgentIdOwnedByAddress = useCallback(
    async (ownerAddress: string): Promise<number | null> => {
      const identityRegistryAddress = ERC8004_IDENTITY_REGISTRY_ADDRESSES[chainId];
      if (!ownerAddress || !isCelo || !publicClient || !identityRegistryAddress) return null;
      try {
        const balance = await publicClient.readContract({
          address: identityRegistryAddress,
          abi: ERC8004IdentityABI as never,
          functionName: 'balanceOf',
          args: [ownerAddress as Address],
        });
        if (balance == null || Number(balance) < 1) return null;
        const tokenId = await publicClient.readContract({
          address: identityRegistryAddress,
          abi: ERC8004IdentityABI as never,
          functionName: 'tokenOfOwnerByIndex',
          args: [ownerAddress as Address, BigInt(0)],
        });
        return tokenId != null ? Number(tokenId) : null;
      } catch {
        return null;
      }
    },
    [publicClient, isCelo, chainId]
  );

  return { verifyAgentId, isCelo, getAgentIdOwnedByAddress };
}

export function useExitGame(gameId: bigint) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const exit = useCallback(async () => {
    if (!contractAddress) throw new Error('Contract not deployed');
    const hash = await writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'exitGame',
      args: [gameId],
    });
    return hash;
  }, [writeContractAsync, contractAddress, gameId]);

  return { exit, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

/**
 * Claim / receive game reward. On TycoonUpgradeable, rewards are paid when the player exits;
 * there is no separate claimReward(). This hook calls exitGame(gameId) so the caller receives
 * their payout (rank-based USDC + voucher). Use for "Claim Your Victory" or post-game exit.
 */
export function useClaimReward(gameId: bigint) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const claim = useCallback(async () => {
    if (!contractAddress) throw new Error('Contract not deployed');
    const hash = await writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'exitGame',
      args: [gameId],
    });
    return hash;
  }, [writeContractAsync, contractAddress, gameId]);

  return { claim, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
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
    data: result.data ? {
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
      propertiesbought: (result.data as UserTuple)[10],
      propertiesSold: (result.data as UserTuple)[11],
    } : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useGetGame(gameId?: bigint) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'getGame',
    args: gameId !== undefined ? [gameId] : undefined,
    query: { enabled: gameId !== undefined && !!contractAddress },
  });

  return {
    data: result.data ? {
      id: (result.data as GameTuple)[0],
      code: (result.data as GameTuple)[1],
      creator: (result.data as GameTuple)[2],
      status: (result.data as GameTuple)[3],
      winner: (result.data as GameTuple)[5],
      numberOfPlayers: (result.data as GameTuple)[6],
      joinedPlayers: (result.data as GameTuple)[7],
      mode: (result.data as GameTuple)[8],
      ai: (result.data as GameTuple)[9],
      createdAt: (result.data as GameTuple)[10],
      endedAt: (result.data as GameTuple)[11],
      totalStaked: (result.data as GameTuple)[12],
      stakePerPlayer: (result.data as GameTuple)[13],
    } : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
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
      winner: d.winner as Address,
      numberOfPlayers: Number(d.numberOfPlayers),
      joinedPlayers: Number(d.joinedPlayers),
      mode: Number(d.mode),
      ai: Boolean(d.ai),
      stakePerPlayer: BigInt(d.stakePerPlayer as string),
      totalStaked: BigInt(d.totalStaked as string),  // New
      createdAt: BigInt(d.createdAt as string),
      endedAt: BigInt(d.endedAt as string),
    };
  }

  return { data: gameData, isLoading: result.isLoading, error: result.error };
}
export function useGetGamePlayerByAddress(gameId?: bigint, playerAddress?: Address) {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'getGamePlayer',
    args: gameId !== undefined && playerAddress ? [gameId, playerAddress] : undefined,
    query: { enabled: gameId !== undefined && !!playerAddress && !!contractAddress },
  });

  return {
    data: result.data ? {
      gameId: (result.data as GamePlayerTuple)[0],
      playerAddress: (result.data as GamePlayerTuple)[1],
      balance: (result.data as GamePlayerTuple)[2],
      position: (result.data as GamePlayerTuple)[3],
      order: (result.data as GamePlayerTuple)[4],
      symbol: (result.data as GamePlayerTuple)[5],
      username: (result.data as GamePlayerTuple)[6],
    } : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useTotalUsers() {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'totalUsers',
    query: { enabled: !!contractAddress },
  });

  return {
    data: result.data ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useTotalGames() {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'totalGames',
    query: { enabled: !!contractAddress },
  });

  return {
    data: result.data ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

/* ----------------------- Reward System Hooks ----------------------- */

/** Read TYC and USDC token addresses from the reward contract (single source of truth). */
export function useRewardTokenAddresses(): { tycAddress: Address | undefined; usdcAddress: Address | undefined; isLoading: boolean } {
  const chainId = useReadChainIdOrCelo();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const { data: tycAddress, isLoading: tycLoading } = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'tycToken',
    query: { enabled: !!contractAddress },
  });

  const { data: usdcAddress, isLoading: usdcLoading } = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'usdc',
    query: { enabled: !!contractAddress },
  });

  return {
    tycAddress: tycAddress as Address | undefined,
    usdcAddress: usdcAddress as Address | undefined,
    isLoading: tycLoading || usdcLoading,
  };
}

export function useRewardCollectibleInfo(tokenId?: bigint) {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'getCollectibleInfo',
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined && !!contractAddress },
  });

  return {
    data: result.data ? {
      perk: Number((result.data as any)[0]) as CollectiblePerk,
      strength: BigInt((result.data as any)[1]),
      tycPrice: BigInt((result.data as any)[2]),
      usdcPrice: BigInt((result.data as any)[3]),
      shopStock: BigInt((result.data as any)[4]),
    } : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useRewardGetCashTierValue(tier?: number) {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'getCashTierValue',
    args: tier !== undefined ? [tier] : undefined,
    query: { enabled: tier !== undefined && !!contractAddress },
  });

  return {
    data: result.data ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useRewardTokenBalance(address?: Address, tokenId?: bigint) {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'balanceOf',
    args: address && tokenId !== undefined ? [address, tokenId] : undefined,
    query: { enabled: !!address && tokenId !== undefined && !!contractAddress },
  });

  return {
    balance: result.data ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useRewardRedeemVoucher() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const redeem = useCallback(async (tokenId: bigint) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    if (!isVoucherToken(tokenId)) throw new Error('Invalid voucher token ID');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'redeemVoucher',
      args: [tokenId],
    });
  }, [writeContractAsync, contractAddress]);

  return { redeem, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useRewardRedeemVoucherFor() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const redeemFor = useCallback(async (voucherOwner: Address, tokenId: bigint) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    if (!isVoucherToken(tokenId)) throw new Error('Invalid voucher token ID');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'redeemVoucherFor',
      args: [voucherOwner, tokenId],
    });
  }, [writeContractAsync, contractAddress]);

  return { redeemFor, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useRewardBurnCollectible() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const burn = useCallback(async (tokenId: bigint) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    if (!isCollectibleToken(tokenId)) throw new Error('Invalid collectible token ID');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'burnCollectibleForPerk',
      args: [tokenId],
    });
  }, [writeContractAsync, contractAddress]);

  return { burn, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useRewardBurnCollectibleFrom() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const burnFrom = useCallback(async (payer: Address, tokenId: bigint) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    if (!isCollectibleToken(tokenId)) throw new Error('Invalid collectible token ID');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'burnCollectibleForPerkFrom',
      args: [payer, tokenId],
    });
  }, [writeContractAsync, contractAddress]);

  return { burnFrom, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useRewardBuyCollectible() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const buy = useCallback(async (tokenId: bigint, useUsdc = false) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'buyCollectible',
      args: [tokenId, useUsdc],
    });
  }, [writeContractAsync, contractAddress]);

  return { buy, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

/** Buy a collectible with USDC (or TYC) from a given payer address (e.g. smart wallet). Callable by the connected EOA when it is the owner of the payer contract. */
export function useRewardBuyCollectibleFrom() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const buyFrom = useCallback(async (payer: Address, tokenId: bigint, useUsdc = false) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'buyCollectibleFrom',
      args: [payer, tokenId, useUsdc],
    });
  }, [writeContractAsync, contractAddress]);

  return { buyFrom, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

/** Buy a bundle (multiple perks at once) with USDC or TYC. */
export function useRewardBuyBundle() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const buyBundle = useCallback(async (bundleId: bigint, useUsdc = false) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'buyBundle',
      args: [bundleId, useUsdc],
    });
  }, [writeContractAsync, contractAddress]);

  return { buyBundle, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

/** Buy a bundle with USDC or TYC from a given payer (e.g. smart wallet). Callable by the payer or by the owner of the payer if payer is a contract with owner(). */
export function useRewardBuyBundleFrom() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const buyBundleFrom = useCallback(async (payer: Address, bundleId: bigint, useUsdc = false) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'buyBundleFrom',
      args: [payer, bundleId, useUsdc],
    });
  }, [writeContractAsync, contractAddress]);

  return { buyBundleFrom, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

/** Approve ERC20 spend from a user wallet contract (e.g. smart wallet). Callable only by the wallet owner (connected EOA). */
export function useUserWalletApproveERC20(walletAddress: Address | undefined) {
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const approveERC20 = useCallback(
    async (token: Address, spender: Address, amount: bigint) => {
      if (!walletAddress) throw new Error('Wallet address required');
      return await writeContractAsync({
        address: walletAddress,
        abi: UserWalletABI as readonly unknown[],
        functionName: 'approveERC20',
        args: [token, spender, amount],
      });
    },
    [writeContractAsync, walletAddress]
  );

  return { approveERC20, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useApprove() {
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } =
    useWriteContract();

  const { isLoading: isConfirming, isSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const approve = useCallback(
    async (
      contractAddress: Address,
      spender: Address,
      amount: bigint
    ) => {
      if (!contractAddress) throw new Error('Reward contract not deployed');

      return await writeContractAsync({
        address: contractAddress,
        abi: Erc20Abi,
        functionName: 'approve',
        args: [spender, amount],
      });
    },
    [writeContractAsync]
  );

  return {
    approve,
    isPending: isPending || isConfirming,
    isConfirming,
    isSuccess,
    error: writeError,
    txHash,
    reset,
  };
}


/* ----------------------- New Reward View Hooks (from updated contract) ----------------------- */
export function useAllowance(
  owner?: Address,
  spender?: Address
) {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: Erc20Abi,
    functionName: 'allowance',
    args: owner && spender ? [owner, spender] : undefined,
    query: {
      enabled: !!owner && !!spender && !!contractAddress,
    },
  });

  return {
    data: result.data as bigint | undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useRewardOwnedTokenCount(address?: Address) {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'ownedTokenCount',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });

  return {
    data: result.data ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}

export function useRewardTokenOfOwnerByIndex(address?: Address, index?: bigint) {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  const result = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'tokenOfOwnerByIndex',
    args: address && index !== undefined ? [address, index] : undefined,
    query: { enabled: !!address && index !== undefined && !!contractAddress },
  });

  return {
    data: result.data ? BigInt(result.data as bigint) : undefined,
    isLoading: result.isLoading,
    error: result.error,
  };
}



/* ----------------------- Admin Reward Hooks ----------------------- */

export function useRewardSetBackendMinter() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const setMinter = useCallback(async (newMinter: Address) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'setBackendMinter',
      args: [newMinter],
    });
  }, [writeContractAsync, contractAddress]);

  return { setMinter, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useRewardMintVoucher() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const mint = useCallback(async (to: Address, tycValue: bigint) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'mintVoucher',
      args: [to, tycValue],
    });
  }, [writeContractAsync, contractAddress]);

  return { mint, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useRewardMintCollectible() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const mint = useCallback(async (to: Address, perk: CollectiblePerk, strength: number) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'mintCollectible',
      args: [to, BigInt(perk), BigInt(strength)],
    });
  }, [writeContractAsync, contractAddress]);

  return { mint, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useRewardStockShop() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const stock = useCallback(async (amount: number, perk: CollectiblePerk, strength: number, tycPrice = 0, usdcPrice = 0) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'stockShop',
      args: [BigInt(amount), BigInt(perk), BigInt(strength), tycPrice, usdcPrice],
    });
  }, [writeContractAsync, contractAddress]);

  return { stock, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useRewardStockBundle() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const stockBundle = useCallback(
    async (tokenIds: bigint[], amounts: bigint[], tycPrice: bigint, usdcPrice: bigint) => {
      if (!contractAddress) throw new Error('Reward contract not deployed');
      return await writeContractAsync({
        address: contractAddress,
        abi: RewardABI,
        functionName: 'stockBundle',
        args: [tokenIds, amounts, tycPrice, usdcPrice],
      });
    },
    [writeContractAsync, contractAddress]
  );

  return { stockBundle, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useRewardRestockCollectible() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const restock = useCallback(async (tokenId: bigint, amount: bigint) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'restockCollectible',
      args: [tokenId, amount],
    });
  }, [writeContractAsync, contractAddress]);

  return { restock, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useRewardUpdateCollectiblePrices() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const update = useCallback(async (tokenId: bigint, tycPrice: bigint, usdcPrice: bigint) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'updateCollectiblePrices',
      args: [tokenId, tycPrice, usdcPrice],
    });
  }, [writeContractAsync, contractAddress]);

  return { update, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useRewardPause() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const pause = useCallback(async () => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'pause',
    });
  }, [writeContractAsync, contractAddress]);

  const unpause = useCallback(async () => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'unpause',
    });
  }, [writeContractAsync, contractAddress]);

  return { pause, unpause, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useRewardWithdrawFunds() {
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const withdraw = useCallback(async (token: Address, to: Address, amount: bigint) => {
    if (!contractAddress) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'withdrawFunds',
      args: [token, to, amount],
    });
  }, [writeContractAsync, contractAddress]);

  return { withdraw, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

/* ----------------------- Tycoon (main game) admin – owner only ----------------------- */

export function useTycoonAdminReads() {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];

  const minStake = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'minStake',
    query: { enabled: !!contractAddress },
  });
  const minTurnsForPerks = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'minTurnsForPerks',
    query: { enabled: !!contractAddress },
  });
  const backendGameController = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'backendGameController',
    query: { enabled: !!contractAddress },
  });
  const tycoonOwner = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'owner',
    query: { enabled: !!contractAddress },
  });
  const logicContract = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'logicContract',
    query: { enabled: !!contractAddress },
  });
  const userRegistry = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'userRegistry',
    query: { enabled: !!contractAddress },
  });
  const gameFaucet = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'gameFaucet',
    query: { enabled: !!contractAddress },
  });
  const rewardSystem = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'rewardSystem',
    query: { enabled: !!contractAddress },
  });
  const totalGames = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'totalGames',
    query: { enabled: !!contractAddress },
  });
  const totalUsers = useReadContract({
    address: contractAddress,
    abi: TycoonABI,
    functionName: 'totalUsers',
    query: { enabled: !!contractAddress },
  });

  return {
    minStake: minStake.data as bigint | undefined,
    minTurnsForPerks: minTurnsForPerks.data as bigint | undefined,
    backendGameController: backendGameController.data as Address | undefined,
    tycoonOwner: tycoonOwner.data as Address | undefined,
    logicContract: logicContract.data as Address | undefined,
    userRegistry: userRegistry.data as Address | undefined,
    gameFaucet: gameFaucet.data as Address | undefined,
    rewardSystem: rewardSystem.data as Address | undefined,
    totalGames: totalGames.data as bigint | undefined,
    totalUsers: totalUsers.data as bigint | undefined,
    isLoading:
      minStake.isLoading ||
      minTurnsForPerks.isLoading ||
      backendGameController.isLoading ||
      tycoonOwner.isLoading ||
      logicContract.isLoading ||
      userRegistry.isLoading ||
      gameFaucet.isLoading ||
      rewardSystem.isLoading ||
      totalGames.isLoading ||
      totalUsers.isLoading,
  };
}

export function useTycoonSetMinStake() {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const setMinStake = useCallback(async (newMinStakeWei: bigint) => {
    if (!contractAddress) throw new Error('Tycoon contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'setMinStake',
      args: [newMinStakeWei],
    });
  }, [writeContractAsync, contractAddress]);

  return { setMinStake, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useTycoonSetMinTurnsForPerks() {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const setMinTurnsForPerks = useCallback(async (newMin: bigint) => {
    if (!contractAddress) throw new Error('Tycoon contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'setMinTurnsForPerks',
      args: [newMin],
    });
  }, [writeContractAsync, contractAddress]);

  return { setMinTurnsForPerks, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useTycoonSetBackendGameController() {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const setBackendGameController = useCallback(async (newController: Address) => {
    if (!contractAddress) throw new Error('Tycoon contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'setBackendGameController',
      args: [newController],
    });
  }, [writeContractAsync, contractAddress]);

  return { setBackendGameController, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useTycoonSetLogicContract() {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const setLogicContract = useCallback(async (logic: Address) => {
    if (!contractAddress) throw new Error('Tycoon contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'setLogicContract',
      args: [logic],
    });
  }, [writeContractAsync, contractAddress]);

  return { setLogicContract, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useTycoonSetUserRegistry() {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const setUserRegistry = useCallback(async (registry: Address) => {
    if (!contractAddress) throw new Error('Tycoon contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'setUserRegistry',
      args: [registry],
    });
  }, [writeContractAsync, contractAddress]);

  return { setUserRegistry, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useTycoonSetGameFaucet() {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const setGameFaucet = useCallback(async (faucet: Address) => {
    if (!contractAddress) throw new Error('Tycoon contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'setGameFaucet',
      args: [faucet],
    });
  }, [writeContractAsync, contractAddress]);

  return { setGameFaucet, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useTycoonSetRewardSystem() {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const setRewardSystem = useCallback(async (rewardSystemAddress: Address) => {
    if (!contractAddress) throw new Error('Tycoon contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'setRewardSystem',
      args: [rewardSystemAddress],
    });
  }, [writeContractAsync, contractAddress]);

  return { setRewardSystem, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

export function useTycoonCreateWalletForExistingUser() {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const { writeContractAsync, isPending, error: writeError, data: txHash, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const createWalletForExistingUser = useCallback(async (player: Address) => {
    if (!contractAddress) throw new Error('Tycoon contract not deployed');
    return await writeContractAsync({
      address: contractAddress,
      abi: TycoonABI,
      functionName: 'createWalletForExistingUser',
      args: [player],
    });
  }, [writeContractAsync, contractAddress]);

  return { createWalletForExistingUser, isPending: isPending || isConfirming, isSuccess, isConfirming, error: writeError, txHash, reset };
}

/* ----------------------- Context Provider ----------------------- */

type TycoonContextType = {
  registerPlayer: (username: string) => Promise<string | undefined>;
  redeemVoucher: (tokenId: bigint) => Promise<string>;
  burnCollectible: (tokenId: bigint) => Promise<string>;
  burnCollectibleFrom: (payer: Address, tokenId: bigint) => Promise<string>;
  buyCollectible: (tokenId: bigint, useUsdc?: boolean) => Promise<string>;
};

const TycoonContext = createContext<TycoonContextType | undefined>(undefined);

export const TycoonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { address: userAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const chainId = useChainId();

  const registerPlayer = useCallback(async (username: string) => {
    const addr = TYCOON_CONTRACT_ADDRESSES[chainId];
    if (!userAddress || !addr) throw new Error('Wallet or contract not available');
    return await writeContractAsync({
      address: addr,
      abi: TycoonABI,
      functionName: 'registerPlayer',
      args: [username],
    });
  }, [userAddress, writeContractAsync, chainId]);

  const redeemVoucher = useCallback(async (tokenId: bigint) => {
    const addr = REWARD_CONTRACT_ADDRESSES[chainId];
    if (!addr) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: addr,
      abi: RewardABI,
      functionName: 'redeemVoucher',
      args: [tokenId],
    });
  }, [writeContractAsync, chainId]);

  const burnCollectible = useCallback(async (tokenId: bigint) => {
    const addr = REWARD_CONTRACT_ADDRESSES[chainId];
    if (!addr) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: addr,
      abi: RewardABI,
      functionName: 'burnCollectibleForPerk',
      args: [tokenId],
    });
  }, [writeContractAsync, chainId]);

  const burnCollectibleFrom = useCallback(async (payer: Address, tokenId: bigint) => {
    const addr = REWARD_CONTRACT_ADDRESSES[chainId];
    if (!addr) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: addr,
      abi: RewardABI,
      functionName: 'burnCollectibleForPerkFrom',
      args: [payer, tokenId],
    });
  }, [writeContractAsync, chainId]);

  const buyCollectible = useCallback(async (tokenId: bigint, useUsdc = false) => {
    const addr = REWARD_CONTRACT_ADDRESSES[chainId];
    if (!addr) throw new Error('Reward contract not deployed');
    return await writeContractAsync({
      address: addr,
      abi: RewardABI,
      functionName: 'buyCollectible',
      args: [tokenId, useUsdc],
    });
  }, [writeContractAsync, chainId]);

  const value = useMemo(() => ({
    registerPlayer,
    redeemVoucher,
    burnCollectible,
    burnCollectibleFrom,
    buyCollectible,
  }), [registerPlayer, redeemVoucher, burnCollectible, burnCollectibleFrom, buyCollectible]);

  return <TycoonContext.Provider value={value}>{children}</TycoonContext.Provider>;
};

export const useTycoon = () => {
  const context = useContext(TycoonContext);
  if (!context) throw new Error('useTycoon must be used within TycoonProvider');
  return context;
};