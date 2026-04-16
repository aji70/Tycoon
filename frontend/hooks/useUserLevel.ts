"use client";

import { useMemo } from "react";
import type { Address } from "viem";
import { useChainId, useReadContract } from "wagmi";
import { celo } from "wagmi/chains";
import { useQuery } from "@tanstack/react-query";
import { useGetUser, useGetUsername } from "@/context/ContractProvider";
import { getLevelFromActivity, type LevelInfo } from "@/lib/level";
import { guestGamesForLevel, walletGamesForLevel, type BackendStatsRow, type ContractUserStats } from "@/lib/level-from-sources";
import { backendUserStatsLookupAddress, chainIdToLeaderboardChain } from "@/lib/profile-stats-address";
import { TYCOON_CONTRACT_ADDRESSES } from "@/constants/contracts";
import TycoonABI from "@/context/abi/tycoonabi.json";
import { apiClient } from "@/lib/api";

const CELO_CHAIN_ID = celo.id;

export interface GuestLevelContext {
  address: string;
  linked_wallet_address?: string | null;
  smart_wallet_address?: string | null;
}

export interface UseUserLevelOptions {
  /** Address used for on-chain username / getUser (smart wallet when linked EOA is connected, etc.). */
  address: string | undefined;
  /** Connected wagmi address — used with `guestUser` for `/users/by-address` key (must match profile). */
  wagmiAddress?: string | undefined;
  guestUser?: { address?: string; linked_wallet_address?: string | null; smart_wallet_address?: string | null } | null;
  /** For guest users without a connected wallet: same shape as profile guest. */
  guestLevelContext?: GuestLevelContext | null;
  guestGameCount?: number;
  isGuest?: boolean;
}

function isValidNonZeroWallet(a: string | null | undefined): a is Address {
  if (!a || typeof a !== "string") return false;
  const s = a.trim();
  if (!s || s.length < 42) return false;
  if (s.toLowerCase() === "0x0000000000000000000000000000000000000000") return false;
  return /^0x[a-fA-F0-9]{40}$/i.test(s);
}

function parseContractUserTuple(data: unknown): ContractUserStats | null {
  if (!data) return null;
  const d = data as readonly unknown[];
  if (!Array.isArray(d) || d.length < 9) return null;
  return {
    gamesPlayed: Number(d[4] ?? 0),
    gamesWon: Number(d[5] ?? 0),
    totalStaked: Number(d[7] ?? 0),
    totalEarned: Number(d[8] ?? 0),
  };
}

/**
 * Level from the same activity sources as the profile page:
 * - Wallet: contract getUser + backend merge when on-chain totals are zero.
 * - Guest (no wagmi): Celo contract reads + backend merge, else my-games count fallback.
 */
export function useUserLevel(options: UseUserLevelOptions): {
  levelInfo: LevelInfo | null;
  isLoading: boolean;
} {
  const {
    address: contractLookupAddress,
    wagmiAddress,
    guestUser,
    guestLevelContext,
    guestGameCount = 0,
    isGuest = false,
  } = options;

  const chainId = useChainId();
  const chainParam = chainIdToLeaderboardChain(chainId);

  const { data: fetchedUsername } = useGetUsername(contractLookupAddress as Address | undefined);
  const username = typeof fetchedUsername === "string" ? fetchedUsername : undefined;

  const { data: contractUser, isLoading: contractLoading } = useGetUser(username ?? undefined);

  const guestLookupAddress = useMemo(() => {
    if (!isGuest || !guestLevelContext) return undefined;
    const smart = guestLevelContext.smart_wallet_address;
    const linked = guestLevelContext.linked_wallet_address;
    if (isValidNonZeroWallet(smart)) return smart.trim() as Address;
    if (isValidNonZeroWallet(linked)) return linked.trim() as Address;
    return guestLevelContext.address.trim() as Address;
  }, [isGuest, guestLevelContext]);

  const tycoonCelo = TYCOON_CONTRACT_ADDRESSES[CELO_CHAIN_ID];

  const { data: guestOnChainUsername, isLoading: guestUsernameLoading } = useReadContract({
    address: tycoonCelo,
    abi: TycoonABI,
    functionName: "addressToUsername",
    args: guestLookupAddress ? [guestLookupAddress] : undefined,
    chainId: CELO_CHAIN_ID,
    query: { enabled: Boolean(isGuest && guestLookupAddress && tycoonCelo) },
  });

  const guestUsernameStr =
    typeof guestOnChainUsername === "string" && guestOnChainUsername.trim() ? guestOnChainUsername.trim() : undefined;

  const { data: guestPlayerRaw, isLoading: guestPlayerLoading } = useReadContract({
    address: tycoonCelo,
    abi: TycoonABI,
    functionName: "getUser",
    args: guestUsernameStr ? [guestUsernameStr] : undefined,
    chainId: CELO_CHAIN_ID,
    query: { enabled: Boolean(isGuest && guestUsernameStr && tycoonCelo) },
  });

  const walletBackendAddr =
    !isGuest && contractLookupAddress
      ? backendUserStatsLookupAddress(guestUser ?? null, contractLookupAddress, wagmiAddress ?? contractLookupAddress)
      : undefined;

  const { data: walletBackendRaw } = useQuery({
    queryKey: ["user-level-wallet-backend", walletBackendAddr, chainParam],
    queryFn: async () => {
      const res = await apiClient.get(`/users/by-address/${walletBackendAddr}`, { params: { chain: chainParam } });
      return res.data as BackendStatsRow | null;
    },
    enabled: Boolean(walletBackendAddr && !isGuest),
    staleTime: 60_000,
  });

  const guestBackendAddr = useMemo(() => {
    if (!isGuest || !guestLevelContext) return undefined;
    if (isValidNonZeroWallet(guestLevelContext.linked_wallet_address)) {
      return guestLevelContext.linked_wallet_address!.trim();
    }
    return guestLevelContext.address?.trim();
  }, [isGuest, guestLevelContext]);

  const { data: guestBackendRaw } = useQuery({
    queryKey: ["user-level-guest-backend", guestBackendAddr],
    queryFn: async () => {
      const res = await apiClient.get(`/users/by-address/${guestBackendAddr}`, { params: { chain: "CELO" } });
      return res.data as BackendStatsRow | null;
    },
    enabled: Boolean(isGuest && guestBackendAddr),
    staleTime: 60_000,
  });

  return useMemo(() => {
    if (isGuest) {
      if (!guestLevelContext) {
        return { levelInfo: getLevelFromActivity({ totalGames: guestGameCount }), isLoading: false };
      }
      const contractStats = parseContractUserTuple(guestPlayerRaw);
      const merged = guestGamesForLevel(contractStats, guestBackendRaw ?? undefined);
      let levelInfo: LevelInfo;
      if (merged.gamesPlayed > 0 || merged.gamesWon > 0) {
        levelInfo = getLevelFromActivity({ gamesPlayed: merged.gamesPlayed, gamesWon: merged.gamesWon });
      } else if (guestGameCount > 0) {
        levelInfo = getLevelFromActivity({ totalGames: guestGameCount });
      } else {
        levelInfo = getLevelFromActivity({ gamesPlayed: 0, gamesWon: 0 });
      }
      const isLoading =
        Boolean(guestLookupAddress && guestUsernameLoading) || Boolean(guestUsernameStr && guestPlayerLoading);
      return { levelInfo, isLoading };
    }

    if (!contractLookupAddress) {
      return { levelInfo: null, isLoading: false };
    }

    if (contractLoading && !contractUser) {
      return { levelInfo: null, isLoading: true };
    }

    const contractStats: ContractUserStats | null = contractUser
      ? {
          gamesPlayed: Number(contractUser.gamesPlayed ?? 0),
          gamesWon: Number(contractUser.gamesWon ?? 0),
          totalStaked: Number(contractUser.totalStaked ?? 0),
          totalEarned: Number(contractUser.totalEarned ?? 0),
        }
      : null;

    const merged = walletGamesForLevel(contractStats, walletBackendRaw ?? undefined, chainParam);
    const levelInfo = getLevelFromActivity({ gamesPlayed: merged.gamesPlayed, gamesWon: merged.gamesWon });
    const isLoading = contractLoading && !contractUser;
    return { levelInfo, isLoading };
  }, [
    isGuest,
    guestLevelContext,
    guestGameCount,
    guestLookupAddress,
    guestUsernameLoading,
    guestUsernameStr,
    guestPlayerLoading,
    guestPlayerRaw,
    guestBackendAddr,
    guestBackendRaw,
    contractLookupAddress,
    contractLoading,
    contractUser,
    walletBackendAddr,
    walletBackendRaw,
    chainParam,
  ]);
}
