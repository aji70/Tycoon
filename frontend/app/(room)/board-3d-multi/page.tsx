"use client";

import GameBoard3DView from "@/components/game/board/game-board-3d";
import GameRoom from "@/components/game/game-room";
import { Multiplayer3DPlayerSection } from "@/components/game/multiplayer-3d-player/PlayerSection";
import { apiClient } from "@/lib/api";
import toast from "react-hot-toast";
import { socketService } from "@/lib/socket";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePreventDoubleSubmit } from "@/hooks/usePreventDoubleSubmit";
import { Game, GameProperty, Player, Property } from "@/types/game";
import { useAccount } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiResponse } from "@/types/api";
import { useMediaQuery } from "@/components/useMediaQuery";
import { GameDurationCountdown } from "@/components/game/GameDurationCountdown";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";

const SOCKET_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_SOCKET_URL ||
        (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, ""))
    : "";

/**
 * Multiplayer 3D board (desktop). Same flow as game-play but renders the 3D board.
 * Route: /board-3d-multi?gameCode=XXX
 */
export default function Board3DMultiPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [gameCode, setGameCode] = useState<string>("");
  const isMobile = useMediaQuery("(max-width: 768px)");

  const { address } = useAccount();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const myAddress = guestUser?.address ?? address;

  useEffect(() => {
    const code = searchParams.get("gameCode") || localStorage.getItem("gameCode");
    const trimmed = typeof code === "string" ? code.trim() : "";
    if (trimmed) setGameCode(trimmed.toUpperCase());
  }, [searchParams]);

  // Mobile: redirect to dedicated mobile page
  useEffect(() => {
    if (isMobile && gameCode && gameCode.length >= 6) {
      router.replace(`/board-3d-multi-mobile?gameCode=${encodeURIComponent(gameCode)}`);
    }
  }, [isMobile, gameCode, router]);

  const {
    data: game,
    isLoading: gameLoading,
    isError: gameError,
    error: gameQueryError,
    refetch: refetchGame,
  } = useQuery<Game>({
    queryKey: ["game", gameCode],
    queryFn: async () => {
      if (!gameCode) throw new Error("No game code found");
      const res = await apiClient.get<ApiResponse>(`/games/code/${gameCode}`);
      if (!res.data?.success) {
        throw new Error(
          (res.data as { error?: string; message?: string })?.error ||
            (res.data as { error?: string; message?: string })?.message ||
            "Failed to load game"
        );
      }
      return res.data.data;
    },
    enabled: !!gameCode,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!gameCode || !SOCKET_URL) return;
    const socket = socketService.connect(SOCKET_URL);
    socketService.joinGameRoom(gameCode);
    const onGameUpdate = (data: { gameCode: string }) => {
      if (data.gameCode === gameCode) {
        refetchGame();
        queryClient.invalidateQueries({ queryKey: ["game_properties"] });
      }
    };
    const onGameStarted = () => {
      refetchGame();
      queryClient.invalidateQueries({ queryKey: ["game_properties"] });
    };
    socketService.onGameUpdate(onGameUpdate);
    socketService.onGameStarted(onGameStarted);
    return () => {
      socketService.removeListener("game-update", onGameUpdate);
      socketService.removeListener("game-started", onGameStarted);
      socketService.leaveGameRoom(gameCode);
    };
  }, [gameCode, queryClient, refetchGame]);

  // Redirect AI games to AI 3D flow
  useEffect(() => {
    if (!game || !gameCode) return;
    if (game.is_ai === true) {
      router.replace(`/ai-play-3d?gameCode=${encodeURIComponent(gameCode)}`);
    }
  }, [game, gameCode, router]);

  const me = useMemo(() => {
    if (!game?.players || !myAddress) return null;
    return game.players.find(
      (pl: Player) => pl.address?.toLowerCase() === myAddress.toLowerCase()
    ) || null;
  }, [game, myAddress]);

  const currentPlayer = useMemo<Player | null>(() => {
    if (!game?.next_player_id || !game?.players) return null;
    return game.players.find((p) => p.user_id === game.next_player_id) ?? null;
  }, [game]);

  const [focusTrades, setFocusTrades] = useState(false);

  const {
    data: properties = [],
    isLoading: propertiesLoading,
    isError: propertiesError,
  } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse>("/properties");
      return res.data?.success ? res.data.data : [];
    },
  });

  const {
    data: game_properties = [],
    isLoading: gamePropertiesLoading,
    isError: gamePropertiesError,
  } = useQuery<GameProperty[]>({
    queryKey: ["game_properties", game?.id],
    queryFn: async () => {
      if (!game?.id) return [];
      const res = await apiClient.get<ApiResponse>(`/game-properties/game/${game.id}`);
      return res.data?.success ? res.data.data : [];
    },
    enabled: !!game?.id,
    refetchInterval: 10000,
  });

  const my_properties: Property[] = useMemo(() => {
    if (!game_properties?.length || !properties?.length || !myAddress) return [];
    const propertyMap = new Map(properties.map((p) => [p.id, p]));
    return game_properties
      .filter((gp) => gp.address?.toLowerCase() === myAddress.toLowerCase())
      .map((gp) => propertyMap.get(gp.property_id))
      .filter((p): p is Property => !!p)
      .sort((a, b) => a.id - b.id);
  }, [game_properties, properties, myAddress]);

  const [requestStartLoading, setRequestStartLoading] = useState(false);

  const READY_WINDOW_SECONDS = 30;
  const isWaitingForStart =
    game?.status === "PENDING" &&
    game?.ready_window_opens_at &&
    game?.players?.length >= (game?.number_of_players ?? 0);
  const readyOpensAt = game?.ready_window_opens_at ? new Date(game.ready_window_opens_at).getTime() : 0;
  const readyClosesAt = readyOpensAt + READY_WINDOW_SECONDS * 1000;
  const [readySecondsLeft, setReadySecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!isWaitingForStart || !readyOpensAt) {
      setReadySecondsLeft(null);
      return;
    }
    const tick = () => {
      const now = Date.now();
      if (now >= readyClosesAt) {
        setReadySecondsLeft(0);
        return;
      }
      setReadySecondsLeft(Math.ceil((readyClosesAt - now) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isWaitingForStart, readyOpensAt, readyClosesAt]);

  const requestStart = useCallback(async () => {
    if (!game?.id || requestStartLoading) return;
    setRequestStartLoading(true);
    try {
      const res = await apiClient.post<ApiResponse>(`/games/${game.id}/request-start`);
      const data = res.data as { success?: boolean; started?: boolean; message?: string };
      if (data?.started) await refetchGame();
      if (data?.message) toast.success(data.message);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err?.response?.data?.message || err?.message || "Failed to request start");
    } finally {
      setRequestStartLoading(false);
    }
  }, [game?.id, requestStartLoading, refetchGame]);

  const finishGameByTime = useCallback(async () => {
    if (!game?.id || game?.status !== "RUNNING") return;
    try {
      await apiClient.post(`/games/${game.id}/finish-by-time`);
      await refetchGame();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; message?: string } }; message?: string };
      toast.error(err?.response?.data?.error || err?.response?.data?.message || err?.message || "Could not end game by time.");
    }
  }, [game?.id, game?.status, refetchGame]);

  const finishByTimeGuard = usePreventDoubleSubmit();
  const onFinishByTime = useCallback(() => finishByTimeGuard.submit(() => finishGameByTime()), [finishGameByTime, finishByTimeGuard]);
  const startGuard = usePreventDoubleSubmit();

  if (gameLoading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center text-lg font-medium text-white bg-[#010F10]">
        Loading game...
      </div>
    );
  }

  const gameEnded = gameError && (gameQueryError as Error)?.message === "Game ended";
  if (gameEnded) {
    return (
      <div className="w-full min-h-screen bg-[#010F10] flex flex-col items-center justify-center text-center px-8">
        <h2 className="text-2xl font-bold text-cyan-400 mb-2">Game over</h2>
        <p className="text-gray-400 mb-6">This game has ended.</p>
        <button
          onClick={() => router.push("/")}
          className="px-8 py-4 bg-[#00F0FF] text-[#010F10] font-bold rounded-lg hover:opacity-90"
        >
          Go home
        </button>
      </div>
    );
  }

  if (gameError) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center text-lg font-medium text-white bg-[#010F10]">
        {(gameQueryError as Error)?.message ?? "Failed to load game"}
      </div>
    );
  }

  if (game && game.is_ai === true) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center text-lg font-medium text-white bg-[#010F10]">
        Redirecting to AI 3D...
      </div>
    );
  }

  // Mobile: redirect happens in useEffect; show loading until redirect
  if (isMobile && gameCode) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center text-lg font-medium text-cyan-400 bg-[#010F10]">
        Opening mobile 3D board...
      </div>
    );
  }

  if (!game || propertiesLoading || gamePropertiesLoading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center text-lg font-medium text-white bg-[#010F10]">
        Loading...
      </div>
    );
  }

  return (
    <main className="w-full h-screen overflow-hidden relative flex flex-row bg-[#010F10] lg:gap-4 p-4">
      {isWaitingForStart && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0d1f23] border border-cyan-500/30 rounded-xl p-8 max-w-md text-center shadow-xl">
            <h2 className="text-xl font-semibold text-white mb-2">All players have joined</h2>
            <p className="text-gray-300 mb-4">
              Click &quot;Start now&quot; to begin. All players must click within the window.
            </p>
            {readySecondsLeft !== null && (
              <p className="text-cyan-400 font-mono text-2xl mb-6">
                {readySecondsLeft > 0 ? `${readySecondsLeft}s left` : "Window closed"}
              </p>
            )}
            <button
              type="button"
              onClick={() => startGuard.submit(() => requestStart())}
              disabled={requestStartLoading || startGuard.isSubmitting || readySecondsLeft === 0}
              className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-colors"
            >
              {requestStartLoading || startGuard.isSubmitting ? "..." : "Start now"}
            </button>
          </div>
        </div>
      )}

      {/* Left: same player section as AI 3D (with perks) */}
      <div className="hidden lg:block w-80 flex-shrink-0">
        <Multiplayer3DPlayerSection
          game={game}
          properties={properties}
          game_properties={game_properties}
          my_properties={my_properties}
          me={me}
          currentPlayer={currentPlayer}
          roll={null}
          isAITurn={false}
          focusTrades={focusTrades}
          onViewedTrades={() => setFocusTrades(false)}
          isGuest={!!guestUser}
        />
      </div>

      {/* Center: same as ai-play-3d (board area), 3D instead of AiBoard */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <GameBoard3DView
          game={game}
          properties={properties}
          game_properties={game_properties}
          me={me}
          onGameUpdated={() => refetchGame()}
          onFinishByTime={onFinishByTime}
          embedded
        />
      </div>

      {/* Right: only addition — chat */}
      <div className="hidden lg:flex w-80 flex-shrink-0 flex-col min-h-0">
        <GameRoom game={game} me={me} fillContainer />
      </div>
    </main>
  );
}
