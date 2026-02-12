"use client";

import GameBoard from "@/components/game/board/game-board";
import GameRoom from "@/components/game/game-room";
import GamePlayers from "@/components/game/player/player";
import MobileGamePlayers from "@/components/game/player/mobile/player";
import { apiClient } from "@/lib/api";
import { socketService } from "@/lib/socket";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Game, GameProperty, Player, Property } from "@/types/game";
import { useAccount } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiResponse } from "@/types/api";
import { useMediaQuery } from "@/components/useMediaQuery";
import MobileGameLayout from "@/components/game/board/mobile/board-mobile";
import { MessageCircle } from "lucide-react";

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

export default function GamePlayPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [gameCode, setGameCode] = useState<string>("");

  const isMobile = useMediaQuery("(max-width: 768px)");

  const { address } = useAccount();

  useEffect(() => {
    const code = searchParams.get("gameCode") || localStorage.getItem("gameCode");
    if (code && code.length === 6) setGameCode(code);
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
    const socket = socketService.connect(SOCKET_URL);
    socketService.joinGameRoom(gameCode);
    const onGameUpdate = (data: { gameCode: string }) => {
      if (data.gameCode === gameCode) {
        refetchGame();
        queryClient.invalidateQueries({ queryKey: ["game_properties"] });
      }
    };
    socketService.onGameUpdate(onGameUpdate);
    return () => {
      socketService.removeListener("game-update", onGameUpdate);
      socketService.leaveGameRoom(gameCode);
    };
  }, [gameCode, queryClient, refetchGame]);

  const me = useMemo(() => {
    if (!game?.players || !address) return null;
    return game.players.find(
      (pl: Player) => pl.address?.toLowerCase() === address.toLowerCase()
    ) || null;
  }, [game, address]);

  const {
    data: properties = [],
    isLoading: propertiesLoading,
    isError: propertiesError,
  } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse>("/properties");
      return res.data?.success ? res.data.data : [];
    }
  });

  const {
    data: game_properties = [],
    isLoading: gamePropertiesLoading,
    isError: gamePropertiesError,
  } = useQuery<GameProperty[]>({
    queryKey: ["game_properties", game?.id],
    queryFn: async () => {
      if (!game?.id) return [];
      const res = await apiClient.get<ApiResponse>(
        `/game-properties/game/${game.id}`
      );
      return res.data?.success ? res.data.data : [];
    },
    enabled: !!game?.id,
    refetchInterval: 10000,
  });

  const my_properties: Property[] = useMemo(() => {
    if (!game_properties?.length || !properties?.length || !address) return [];

    const propertyMap = new Map(properties.map((p) => [p.id, p]));

    return game_properties
      .filter((gp) => gp.address?.toLowerCase() === address.toLowerCase())
      .map((gp) => propertyMap.get(gp.property_id))
      .filter((p): p is Property => !!p)
      .sort((a, b) => a.id - b.id);
  }, [game_properties, properties, address]);

  const [activeTab, setActiveTab] = useState<'board' | 'players' | 'chat'>('board');
  const [focusTrades, setFocusTrades] = useState(false);
  const [lastReadMessageCount, setLastReadMessageCount] = useState(0);

  const gameId = game?.code ?? game?.id ?? "";
  const { data: messages = [] } = useQuery({
    queryKey: ["messages", gameId],
    queryFn: () => fetchMessageCount(gameId),
    enabled: !!gameId && isMobile,
    refetchInterval: 4000,
    staleTime: 2000,
  });
  const unreadCount = activeTab !== "chat" ? Math.max(0, messages.length - lastReadMessageCount) : 0;

  useEffect(() => {
    if (activeTab === "chat" && Array.isArray(messages)) {
      setLastReadMessageCount(messages.length);
    }
  }, [activeTab, messages.length]);

  if (gameLoading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center text-lg font-medium text-white">
        Loading game...
      </div>
    );
  }

  if (gameError) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center text-lg font-medium text-white">
        {gameQueryError?.message ?? "Failed to load game"}
      </div>
    );
  }

  if (isMobile) {
    if (!game) return null;

    return (
      <main className="w-full h-[calc(100vh-80px)] flex flex-col overflow-hidden bg-[#010F10] mt-[80px]" >
        <div className={`flex-1 w-full min-h-0 flex flex-col ${activeTab === 'chat' ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'}`}>
          {activeTab === 'board' && (
            <MobileGameLayout
              game={game}
              properties={properties}
              game_properties={game_properties}
              me={me}
              onViewTrades={() => {
                setActiveTab('players');
                setFocusTrades(true);
              }}
            />
          )}
          {activeTab === 'players' && (
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
          {activeTab === 'chat' && (
            <GameRoom game={game} me={me} isMobile />
          )}
        </div>

        {/* Incoming messages notification bar — when not on Chat tab */}
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className="fixed left-3 right-3 bottom-20 z-40 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl
              bg-cyan-500/90 hover:bg-cyan-500 text-white font-semibold text-sm shadow-lg shadow-cyan-500/25
              border border-cyan-400/40 backdrop-blur-sm active:scale-[0.98] transition-all"
          >
            <MessageCircle className="w-5 h-5 flex-shrink-0" />
            <span>
              {unreadCount === 1 ? "1 new message" : `${unreadCount} new messages`}
            </span>
          </button>
        )}

        <nav className="fixed bottom-0 left-0 right-0 h-20 pb-safe bg-[#010F10]/95 backdrop-blur-xl border-t border-[#003B3E] flex items-center justify-around z-50 shadow-2xl">
          <button
            onClick={() => setActiveTab('board')}
            className={`flex flex-col items-center justify-center flex-1 py-3 transition-all ${
              activeTab === 'board' ? 'text-cyan-400 scale-110' : 'text-gray-500'
            }`}
          >
            <span className="text-2xl leading-none" aria-hidden>🎲</span>
            <span className="text-xs mt-1 font-semibold tracking-wide">Board</span>
          </button>
          <button
            onClick={() => setActiveTab('players')}
            className={`flex flex-col items-center justify-center flex-1 py-3 transition-all ${
              activeTab === 'players' ? 'text-cyan-400 scale-110' : 'text-gray-500'
            }`}
          >
            <span className="text-2xl leading-none" aria-hidden>👥</span>
            <span className="text-xs mt-1 font-semibold tracking-wide">Players</span>
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`relative flex flex-col items-center justify-center flex-1 py-3 transition-all ${
              activeTab === 'chat' ? 'text-cyan-400 scale-110' : 'text-gray-500'
            }`}
          >
            <span className="text-2xl leading-none" aria-hidden>💬</span>
            <span className="text-xs mt-1 font-semibold tracking-wide">Chat</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-2 min-w-[18px] h-[18px] rounded-full bg-cyan-400 text-[#010F10] text-xs font-bold flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </nav>
      </main>
    );
  }

  return game && !propertiesLoading && !gamePropertiesLoading ? (
    <main className="w-full h-screen max-h-screen overflow-hidden relative flex flex-row lg:gap-2">
      <GamePlayers
        game={game}
        properties={properties}
        game_properties={game_properties}
        my_properties={my_properties}
        me={me}
      />

      <div className="lg:flex-1 w-full">
        <GameBoard
          game={game}
          properties={properties}
          game_properties={game_properties}
          me={me}
          onGameUpdated={() => refetchGame()}
        />
      </div>
      <GameRoom game={game} me={me} />
    </main>
  ) : (
    <></>
  );
}