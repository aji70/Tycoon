"use client";

import GameBoard3DView from "@/components/game/board/game-board-3d";
import GameRoom from "@/components/game/game-room";
import MobileGamePlayers from "@/components/game/player/mobile/player";
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
import { GameDurationCountdown } from "@/components/game/GameDurationCountdown";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";

const fetchMessageCount = async (gameId: string | number): Promise<unknown[]> => {
  const res = await apiClient.get<{ data?: unknown[] | { data?: unknown[] } }>(`/messages/game/${gameId}`);
  const payload = (res as { data?: { data?: unknown[] } })?.data;
  const list = Array.isArray(payload) ? payload : (payload as { data?: unknown[] })?.data;
  return Array.isArray(list) ? list : [];
};

const SOCKET_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_SOCKET_URL ||
        (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, ""))
    : "";

/**
 * Multiplayer 3D board (mobile). Same flow as game-play mobile but Board tab shows 3D board.
 * Route: /board-3d-multi-mobile?gameCode=XXX
 */
export default function Board3DMultiMobilePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [gameCode, setGameCode] = useState<string>("");

  const { address } = useAccount();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const myAddress = guestUser?.address ?? address;

  useEffect(() => {
    const code = searchParams.get("gameCode") || localStorage.getItem("gameCode");
    const trimmed = typeof code === "string" ? code.trim() : "";
    if (trimmed) setGameCode(trimmed.toUpperCase());
  }, [searchParams]);

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
    socketService.connect(SOCKET_URL);
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

  const {
    data: properties = [],
    isLoading: propertiesLoading,
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

  const [activeTab, setActiveTab] = useState<"board" | "players" | "chat">("board");
  const [focusTrades, setFocusTrades] = useState(false);
  const [lastReadMessageCount, setLastReadMessageCount] = useState(0);
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
      if (now >= readyClosesAt) setReadySecondsLeft(0);
      else setReadySecondsLeft(Math.ceil((readyClosesAt - now) / 1000));
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
      toast.error(err?.response?.data?.error || err?.message || "Could not end game by time.");
    }
  }, [game?.id, game?.status, refetchGame]);

  const finishByTimeGuard = usePreventDoubleSubmit();
  const onFinishByTime = useCallback(() => finishByTimeGuard.submit(() => finishGameByTime()), [finishGameByTime, finishByTimeGuard]);

  const gameId = game?.code ?? game?.id ?? "";
  const { data: messages = [] } = useQuery({
    queryKey: ["messages", gameId],
    queryFn: () => fetchMessageCount(gameId),
    enabled: !!gameId,
    refetchInterval: 4000,
    staleTime: 2000,
  });
  const unreadCount = activeTab !== "chat" ? Math.max(0, (messages as unknown[]).length - lastReadMessageCount) : 0;

  useEffect(() => {
    if (activeTab === "chat" && Array.isArray(messages)) {
      setLastReadMessageCount((messages as unknown[]).length);
    }
  }, [activeTab, (messages as unknown[]).length]);

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
      <div className="w-full min-h-screen flex items-center justify-center text-lg font-medium text-white bg-[#010F10] px-4">
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

  if (!game || propertiesLoading || gamePropertiesLoading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center text-lg font-medium text-white bg-[#010F10]">
        Loading...
      </div>
    );
  }

  return (
    <main className="w-full h-dvh max-h-dvh min-h-0 flex flex-col overflow-hidden bg-[#010F10] pt-[calc(80px+env(safe-area-inset-top,0px))]">
      {isWaitingForStart && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm pt-[80px]">
          <div className="bg-[#0d1f23] border border-cyan-500/30 rounded-xl p-6 mx-4 max-w-sm text-center shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-2">All players have joined</h2>
            <p className="text-gray-300 text-sm mb-3">
              Click &quot;Start now&quot; to begin. All players must click within the window.
            </p>
            {readySecondsLeft !== null && (
              <p className="text-cyan-400 font-mono text-xl mb-4">
                {readySecondsLeft > 0 ? `${readySecondsLeft}s left` : "Window closed"}
              </p>
            )}
            <button
              type="button"
              onClick={requestStart}
              disabled={requestStartLoading || readySecondsLeft === 0}
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-colors"
            >
              {requestStartLoading ? "..." : "Start now"}
            </button>
          </div>
        </div>
      )}

      {game?.duration && Number(game.duration) > 0 && (
        <div className="shrink-0 flex justify-center py-2">
          <GameDurationCountdown game={game} compact onTimeUp={onFinishByTime} />
        </div>
      )}

      <div
        className={`flex-1 w-full min-h-0 flex flex-col ${activeTab === "chat" ? "overflow-hidden" : "overflow-y-auto overflow-x-hidden"} ${activeTab !== "chat" ? "pb-20" : ""}`}
      >
        {activeTab === "board" && (
          <div className="flex-1 min-h-0 w-full">
            <GameBoard3DView
              game={game}
              properties={properties}
              game_properties={game_properties}
              me={me}
              onGameUpdated={() => refetchGame()}
              onFinishByTime={onFinishByTime}
            />
          </div>
        )}
        {activeTab === "players" && (
          <MobileGamePlayers
            game={game}
            properties={properties}
            game_properties={game_properties}
            my_properties={my_properties}
            me={me}
            focusTrades={focusTrades}
            onViewedTrades={() => setFocusTrades(false)}
          />
        )}
        {activeTab === "chat" && <GameRoom game={game} me={me} isMobile />}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 h-20 pb-safe bg-[#010F10]/95 backdrop-blur-xl border-t border-[#003B3E] flex items-center justify-around z-50 shadow-2xl">
        <button
          onClick={() => setActiveTab("board")}
          className={`flex flex-col items-center justify-center flex-1 py-3 transition-all ${
            activeTab === "board" ? "text-cyan-400 scale-110" : "text-gray-500"
          }`}
        >
          <span className="text-2xl leading-none" aria-hidden>🎲</span>
          <span className="text-xs mt-1 font-semibold tracking-wide">Board</span>
        </button>
        <button
          onClick={() => setActiveTab("players")}
          className={`flex flex-col items-center justify-center flex-1 py-3 transition-all ${
            activeTab === "players" ? "text-cyan-400 scale-110" : "text-gray-500"
          }`}
        >
          <span className="text-2xl leading-none" aria-hidden>👥</span>
          <span className="text-xs mt-1 font-semibold tracking-wide">Players</span>
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={`relative flex flex-col items-center justify-center flex-1 py-3 transition-all ${
            activeTab === "chat" ? "text-cyan-400 scale-110" : "text-gray-500"
          }`}
        >
          <span className="relative inline-block">
            <span className="text-2xl leading-none" aria-hidden>💬</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 left-6 min-w-[18px] h-[18px] rounded-full bg-cyan-400 text-[#010F10] text-xs font-bold flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </span>
          <span className="text-xs mt-1 font-semibold tracking-wide">Chat</span>
        </button>
      </nav>
    </main>
  );
}
