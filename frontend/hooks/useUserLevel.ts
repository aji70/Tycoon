"use client";

import { useMemo } from "react";
import type { Address } from "viem";
import { useGetUser, useGetUsername } from "@/context/ContractProvider";
import { getLevelFromActivity, type LevelInfo } from "@/lib/level";

export interface UseUserLevelOptions {
  /** Wallet address (for contract lookup). Omit when isGuest. */
  address: string | undefined;
  /** For guest users: number of games they've played (e.g. from my-games list length) */
  guestGameCount?: number;
  /** True when current user is a guest (no wallet) */
  isGuest?: boolean;
}

/**
 * Returns level info from user activity.
 * - Wallet users: uses contract getUser(username) → gamesPlayed, gamesWon.
 * - Guest users: uses guestGameCount (total games from backend/my-games).
 */
export function useUserLevel(options: UseUserLevelOptions): {
  levelInfo: LevelInfo | null;
  isLoading: boolean;
} {
  const { address, guestGameCount = 0, isGuest = false } = options;

  const { data: fetchedUsername } = useGetUsername(address as Address | undefined);
  const username = typeof fetchedUsername === "string" ? fetchedUsername : undefined;

  const { data: contractUser, isLoading: contractLoading } = useGetUser(username ?? undefined);

  return useMemo(() => {
    if (isGuest) {
      const levelInfo = getLevelFromActivity({ totalGames: guestGameCount });
      return { levelInfo, isLoading: false };
    }

    if (!address) {
      return { levelInfo: null, isLoading: false };
    }

    if (contractLoading && !contractUser) {
      return { levelInfo: null, isLoading: true };
    }

    if (!contractUser) {
      // Not yet registered or no data → Level 1
      return {
        levelInfo: getLevelFromActivity({ gamesPlayed: 0, gamesWon: 0 }),
        isLoading: false,
      };
    }

    const gamesPlayed = Number(contractUser.gamesPlayed ?? 0);
    const gamesWon = Number(contractUser.gamesWon ?? 0);
    const levelInfo = getLevelFromActivity({ gamesPlayed, gamesWon });
    return { levelInfo, isLoading: false };
  }, [address, isGuest, guestGameCount, contractUser, contractLoading]);
}
