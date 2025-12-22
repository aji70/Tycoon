"use client";

import AiBoard from "@/components/game/ai-board";
import GameRoom from "@/components/game/game-room";
import GamePlayers from "@/components/game/ai-player";
import MobileGameLayout from "@/components/game/MobileGameLayout";
import MobilePlayerLayout from "@/components/game/MobilePlayerLayout";

import { apiClient } from "@/lib/api";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Game, GameProperty, Player, Property } from "@/types/game";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { ApiResponse } from "@/types/api";
import { useMediaQuery } from "@/components/useMediaQuery";

import { LayoutGrid, Users, Loader2 } from "lucide-react";

export default function GamePlayPage() {
  const searchParams = useSearchParams();
  const [gameCode, setGameCode] = useState<string>("");
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { address } = useAccount();

  useEffect(() => {
    const code = searchParams.get("gameCode") || localStorage.getItem("gameCode");
    if (code && code.length === 6) {
      setGameCode(code);
      localStorage.setItem("gameCode", code);
    }
  }, [searchParams]);

  const {
    data: game,
    isLoading: gameLoading,
    isError: gameError,
  } = useQuery<Game>({
    queryKey: ["game", gameCode],
    queryFn: async () => {
      if (!gameCode) throw new Error("No game code found");
      const res = await apiClient.get<ApiResponse>(`/games/code/${gameCode}`);
      if (!res.data?.success) throw new Error("Game not found");
      return res.data.data;
    },
    enabled: !!gameCode,
    refetchInterval: 5000,
    staleTime: 3000,
  });

  const me = useMemo<Player | null>(() => {
    if (!game?.players || !address) return null;
    return (
      game.players.find(
        (pl: Player) => pl.address?.toLowerCase() === address.toLowerCase()
      ) || null
    );
  }, [game, address]);

  const {
    data: properties = [],
    isLoading: propertiesLoading,
  } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse>("/properties");
      return res.data?.success ? res.data.data : [];
    },
    staleTime: Infinity,
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
    refetchInterval: 15000,
  });

  const my_properties: Property[] = useMemo(() => {
    if (!game_properties.length || !properties.length || !address) return [];

    const propertyMap = new Map(properties.map((p) => [p.id, p]));
    return game_properties
      .filter((gp) => gp.address?.toLowerCase() === address.toLowerCase())
      .map((gp) => propertyMap.get(gp.property_id))
      .filter((p): p is Property => !!p)
      .sort((a, b) => a.id - b.id);
  }, [game_properties, properties, address]);

  const [activeTab, setActiveTab] = useState<"board" | "players">("board");

  if (gameLoading || propertiesLoading) {
    return (
      <div className="w-full h-screen bg-[#010F10] flex flex-col items-center justify-center gap-4 text-cyan-300">
        <Loader2 className="w-12 h-12 animate-spin" />
        <p className="text-xl font-orbitron">Loading game...</p>
      </div>
    );
  }

  if (gameError || !game) {
    return (
      <div className="w-full h-screen bg-[#010F10] flex flex-col items-center justify-center text-center px-8">
        <h2 className="text-2xl font-bold text-red-400 mb-4">Game Not Found</h2>
        <p className="text-gray-300">
          Invalid or expired game code. Please check and try again.
        </p>
      </div>
    );
  }

  // Mobile Layout with mt-[100px]
  if (isMobile) {
    return (
      <main className="w-full h-screen flex flex-col overflow-hidden bg-[#010F10] mt-[100px]">
        {/* Main Content Area */}
        <div className="flex-1 w-full overflow-hidden">
          {activeTab === "board" ? (
            <MobileGameLayout
              game={game}
              properties={properties}
              game_properties={game_properties}
              me={me}
            />
          ) : (
            <MobilePlayerLayout
              game={game}
              properties={properties}
              game_properties={game_properties}
              my_properties={my_properties}
              me={me}
            />
          )}
        </div>

        {/* Bottom Tab Bar */}
        <nav className="fixed bottom-0 left-0 right-0 h-20 pb-safe bg-[#010F10]/95 backdrop-blur-xl border-t border-[#003B3E] flex items-center justify-around z-50 shadow-2xl">
          <button
            onClick={() => setActiveTab("board")}
            className={`flex flex-col items-center justify-center flex-1 py-3 transition-all ${
              activeTab === "board"
                ? "text-[#00F0FF] scale-110"
                : "text-gray-500"
            }`}
          >
            <LayoutGrid size={26} />
            <span className="text-xs mt-1 font-orbitron">Board</span>
          </button>

          <button
            onClick={() => setActiveTab("players")}
            className={`flex flex-col items-center justify-center flex-1 py-3 transition-all ${
              activeTab === "players"
                ? "text-[#00F0FF] scale-110"
                : "text-gray-500"
            }`}
          >
            <Users size={26} />
            <span className="text-xs mt-1 font-orbitron">Players</span>
          </button>
        </nav>
      </main>
    );
  }

  // Desktop Layout (no top margin needed)
  return (
    <main className="w-full h-screen overflow-hidden relative flex flex-row bg-[#010F10] lg:gap-4 p-4">
      <div className="hidden lg:block w-80 flex-shrink-0">
        <GamePlayers
          game={game}
          properties={properties}
          game_properties={game_properties}
          my_properties={my_properties}
          me={me}
        />
      </div>

      <div className="flex-1 min-w-0">
        <AiBoard
          game={game}
          properties={properties}
          game_properties={game_properties}
          me={me}
        />
      </div>

      {/* <div className="hidden lg:block w-80 flex-shrink-0">
        <GameRoom />
      </div> */}

      <button
        onClick={() => setActiveTab("players")}
        className="lg:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#00F0FF]/90 backdrop-blur shadow-xl flex items-center justify-center z-40 border border-[#0FF0FC]"
      >
        <Users size={24} className="text-[#010F10]" />
      </button>
    </main>
  );
}