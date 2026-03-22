"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import { useAccount } from "wagmi";
import { apiClient } from "@/lib/api";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import type {
  Tournament,
  TournamentDetail,
  Bracket,
  LeaderboardData,
  CreateTournamentBody,
  CreateTournamentResponse,
  RegisterTournamentBody,
} from "@/types/tournament";

type TournamentContextValue = {
  // List
  tournaments: Tournament[];
  listLoading: boolean;
  listError: string | null;
  fetchTournaments: (params?: {
    status?: string;
    chain?: string;
    prize_source?: string;
    limit?: number;
    offset?: number;
  }) => Promise<void>;

  // Single tournament
  tournament: TournamentDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  fetchTournament: (id: string, query?: Record<string, string>) => Promise<void>;
  clearTournament: () => void;

  // Bracket
  bracket: Bracket | null;
  bracketLoading: boolean;
  bracketError: string | null;
  fetchBracket: (id: string, query?: Record<string, string>) => Promise<void>;

  // Leaderboard
  leaderboard: LeaderboardData | null;
  leaderboardLoading: boolean;
  leaderboardError: string | null;
  fetchLeaderboard: (id: string, phase?: "live" | "final", query?: Record<string, string>) => Promise<void>;

  // Mutations
  createTournament: (body: CreateTournamentBody) => Promise<CreateTournamentResponse | null>;
  registerForTournament: (
    tournamentId: string,
    body?: RegisterTournamentBody
  ) => Promise<{ success: boolean; message?: string }>;
  closeRegistration: (
    tournamentId: string,
    body?: { first_round_start_at?: string }
  ) => Promise<{ success: boolean; message?: string }>;
  startRound: (
    tournamentId: string,
    roundIndex: number
  ) => Promise<{ success: boolean; message?: string }>;
  requestMatchStart: (
    tournamentId: string,
    matchId: string,
    options?: { symbol?: string }
  ) => Promise<{
    success: boolean;
    message?: string;
    data?: {
      game_id?: number;
      code?: string;
      redirect_url?: string;
      waiting?: boolean;
      forfeit_win?: boolean;
    };
  }>;
  createMatchGame: (
    tournamentId: string,
    matchId: string
  ) => Promise<{
    success: boolean;
    message?: string;
    data?: { code?: string; redirect_url?: string };
  }>;

  // Helpers
  isRegistered: (tournamentId: number) => boolean;
};

const TournamentContext = createContext<TournamentContextValue | null>(null);

const TOURNAMENTS_BASE = "tournaments";

export function TournamentProvider({ children }: { children: ReactNode }) {
  const { guestUser } = useGuestAuthOptional() ?? {};
  const { address: walletAddress } = useAccount();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [bracketLoading, setBracketLoading] = useState(false);
  const [bracketError, setBracketError] = useState<string | null>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  const fetchTournaments = useCallback(
    async (params?: {
      status?: string;
      chain?: string;
      prize_source?: string;
      public_arena?: boolean;
      limit?: number;
      offset?: number;
    }) => {
      setListLoading(true);
      setListError(null);
      try {
        const axiosParams =
          params != null
            ? {
                status: params.status,
                chain: params.chain,
                prize_source: params.prize_source,
                limit: params.limit,
                offset: params.offset,
                ...(params.public_arena ? { public_arena: "1" } : {}),
              }
            : undefined;
        const res = await apiClient.get<Tournament[]>(TOURNAMENTS_BASE, axiosParams);
        const data = res?.data;
        // Handle direct array or wrapped { data: [] } from different API formats
        const list: Tournament[] = Array.isArray(data)
          ? data
          : (data != null && typeof data === "object" && "data" in data)
              ? (Array.isArray((data as { data?: unknown }).data) ? ((data as { data: Tournament[] }).data) : [])
              : [];
        setTournaments(list);
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } }; message?: string })?.response
            ?.data?.message ||
          (err as { message?: string })?.message ||
          "Failed to load tournaments";
        setListError(message);
        setTournaments([]);
      } finally {
        setListLoading(false);
      }
    },
    []
  );

  const fetchTournament = useCallback(async (id: string, query?: Record<string, string>) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await apiClient.get<TournamentDetail>(`${TOURNAMENTS_BASE}/${id}`, query);
      setTournament(res?.data ?? null);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response
          ?.data?.message ||
        (err as { message?: string })?.message ||
        "Failed to load tournament";
      setDetailError(message);
      setTournament(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const clearTournament = useCallback(() => {
    setTournament(null);
    setDetailError(null);
    setBracket(null);
    setBracketError(null);
    setLeaderboard(null);
    setLeaderboardError(null);
  }, []);

  const fetchBracket = useCallback(async (id: string, query?: Record<string, string>) => {
    setBracketLoading(true);
    setBracketError(null);
    try {
      const res = await apiClient.get<Bracket>(`${TOURNAMENTS_BASE}/${id}/bracket`, query);
      const data = res?.data;
      const ok =
        data != null &&
        typeof data === "object" &&
        "rounds" in data &&
        Array.isArray((data as Bracket).rounds);
      setBracket(ok ? (data as Bracket) : null);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response
          ?.data?.message ||
        (err as { message?: string })?.message ||
        "Failed to load bracket";
      setBracketError(message);
      setBracket(null);
    } finally {
      setBracketLoading(false);
    }
  }, []);

  const fetchLeaderboard = useCallback(
    async (id: string, phase: "live" | "final" = "live", query?: Record<string, string>) => {
      setLeaderboardLoading(true);
      setLeaderboardError(null);
      try {
        const res = await apiClient.get<LeaderboardData>(`${TOURNAMENTS_BASE}/${id}/leaderboard`, {
          phase,
          ...query,
        });
        setLeaderboard(res?.data ?? null);
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } }; message?: string })?.response
            ?.data?.message ||
          (err as { message?: string })?.message ||
          "Failed to load leaderboard";
        setLeaderboardError(message);
        setLeaderboard(null);
      } finally {
        setLeaderboardLoading(false);
      }
    },
    []
  );

  const createTournament = useCallback(async (body: CreateTournamentBody): Promise<CreateTournamentResponse | null> => {
    try {
      const res = await apiClient.post<CreateTournamentResponse>(TOURNAMENTS_BASE, body);
      return res?.data ?? null;
    } catch (err: unknown) {
      throw err;
    }
  }, []);

  const registerForTournament = useCallback(
    async (
      tournamentId: string,
      body?: RegisterTournamentBody
    ): Promise<{ success: boolean; message?: string }> => {
      try {
        await apiClient.post<{ success: boolean; data?: unknown }>(
          `${TOURNAMENTS_BASE}/${tournamentId}/register`,
          body ?? {}
        );
        return { success: true };
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } }; message?: string })?.response
            ?.data?.message ||
          (err as { message?: string })?.message ||
          "Registration failed";
        return { success: false, message };
      }
    },
    []
  );

  const closeRegistration = useCallback(
    async (
      tournamentId: string,
      body?: { first_round_start_at?: string }
    ): Promise<{ success: boolean; message?: string }> => {
      try {
        await apiClient.post(
          `${TOURNAMENTS_BASE}/${tournamentId}/close-registration`,
          body ?? {}
        );
        return { success: true };
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } }; message?: string })?.response
            ?.data?.message ||
          (err as { message?: string })?.message ||
          "Failed to close registration";
        return { success: false, message };
      }
    },
    []
  );

  const startRound = useCallback(
    async (
      tournamentId: string,
      roundIndex: number
    ): Promise<{ success: boolean; message?: string }> => {
      try {
        await apiClient.post(
          `${TOURNAMENTS_BASE}/${tournamentId}/start-round/${roundIndex}`
        );
        return { success: true };
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } }; message?: string })?.response
            ?.data?.message ||
          (err as { message?: string })?.message ||
          "Failed to start round";
        return { success: false, message };
      }
    },
    []
  );

  const requestMatchStart = useCallback(
    async (
      tournamentId: string,
      matchId: string,
      options?: { symbol?: string }
    ): Promise<{
      success: boolean;
      message?: string;
      data?: {
        game_id?: number;
        code?: string;
        redirect_url?: string;
        waiting?: boolean;
        forfeit_win?: boolean;
      };
    }> => {
      try {
        const res = await apiClient.post<{
          success: boolean;
          data?: {
            game_id?: number;
            code?: string;
            redirect_url?: string;
            waiting?: boolean;
            forfeit_win?: boolean;
          };
        }>(`${TOURNAMENTS_BASE}/${tournamentId}/matches/${matchId}/start-now`, {
          ...(options?.symbol && { symbol: options.symbol }),
        });
        return {
          success: true,
          data: res?.data?.data,
        };
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } }; message?: string })?.response
            ?.data?.message ||
          (err as { message?: string })?.message ||
          "Start failed";
        return { success: false, message };
      }
    },
    []
  );

  const createMatchGame = useCallback(
    async (
      tournamentId: string,
      matchId: string
    ): Promise<{
      success: boolean;
      message?: string;
      data?: { code?: string; redirect_url?: string };
    }> => {
      try {
        const res = await apiClient.post<{
          success: boolean;
          data?: { code?: string; redirect_url?: string };
        }>(`${TOURNAMENTS_BASE}/${tournamentId}/matches/${matchId}/create-game`, {});
        return {
          success: true,
          data: res?.data?.data,
        };
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } }; message?: string })?.response
            ?.data?.message ||
          (err as { message?: string })?.message ||
          "Create game failed";
        return { success: false, message };
      }
    },
    []
  );

  const isRegistered = useCallback(
    (tid: number): boolean => {
      if (!tournament || tournament.id !== tid || !tournament.entries?.length) return false;
      const uid = guestUser?.id;
      const addr = (walletAddress ?? guestUser?.address)?.toLowerCase();
      return tournament.entries.some(
        (e) =>
          (uid != null && e.user_id === uid) ||
          (addr != null && e.address?.toLowerCase() === addr)
      );
    },
    [tournament, guestUser?.id, guestUser?.address, walletAddress]
  );

  const value = useMemo<TournamentContextValue>(
    () => ({
      tournaments,
      listLoading,
      listError,
      fetchTournaments,
      tournament,
      detailLoading,
      detailError,
      fetchTournament,
      clearTournament,
      bracket,
      bracketLoading,
      bracketError,
      fetchBracket,
      leaderboard,
      leaderboardLoading,
      leaderboardError,
      fetchLeaderboard,
      createTournament,
      registerForTournament,
      closeRegistration,
      startRound,
      requestMatchStart,
      createMatchGame,
      isRegistered,
    }),
    [
      tournaments,
      listLoading,
      listError,
      fetchTournaments,
      tournament,
      detailLoading,
      detailError,
      fetchTournament,
      clearTournament,
      bracket,
      bracketLoading,
      bracketError,
      fetchBracket,
      leaderboard,
      leaderboardLoading,
      leaderboardError,
      fetchLeaderboard,
      createTournament,
      registerForTournament,
      closeRegistration,
      startRound,
      requestMatchStart,
      createMatchGame,
      isRegistered,
    ]
  );

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament(): TournamentContextValue {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error("useTournament must be used within TournamentProvider");
  return ctx;
}

export function useTournamentOptional(): TournamentContextValue | null {
  return useContext(TournamentContext);
}
