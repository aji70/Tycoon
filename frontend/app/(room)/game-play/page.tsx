"use client";

import GameBoard from "@/components/game/board/game-board";
import GameRoom from "@/components/game/game-room";
import GamePlayers from "@/components/game/player/player";
import MobileGamePlayers from "@/components/game/player/mobile/player";
import { apiClient } from "@/lib/api";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Game, GameProperty, Player, Property } from "@/types/game";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { ApiResponse } from "@/types/api";
import { useMediaQuery } from "@/components/useMediaQuery";
import MobileGameLayout from "@/components/game/ai-board/ai-board-mobile";

export default function GamePlayPage() {
  const searchParams = useSearchParams();
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
  } = useQuery<Game>({
    queryKey: ["game", gameCode],
    queryFn: async () => {
      if (!gameCode) throw new Error("No game code found");
      const res = await apiClient.get<ApiResponse>(`/games/code/${gameCode}`);
      return res.data?.success ? res.data.data : null;
    },
    enabled: !!gameCode,
    refetchInterval: 5000,
  });

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
    refetchInterval: 15000,
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
        Failed to load game
      </div>
    );
  }

  if (isMobile) {
    if (!game) return null;

    return (
      <main className="w-full h-screen flex flex-col overflow-hidden bg-[#010F10] mt-[100px]" >
        <div className="flex-1 w-full overflow-hidden">
          {activeTab === 'board' && (
            <MobileGameLayout
              game={game}
              properties={properties}
              game_properties={game_properties}
              me={me}
            />
          )}
          {activeTab === 'players' && (
            <MobileGamePlayers
              game={game}
        properties={properties}
        game_properties={game_properties}
        my_properties={my_properties}
        me={me}
            />
          )}
          {activeTab === 'chat' && (
            <GameRoom />
          )}
        </div>
        <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-cyan-500 flex justify-around items-center h-16 z-50">
          <button
            onClick={() => setActiveTab('board')}
            className={`flex-1 py-2 text-center font-bold ${activeTab === 'board' ? 'text-cyan-300 bg-cyan-900/40' : 'text-white'}`}
          >
            Board
          </button>
          <button
            onClick={() => setActiveTab('players')}
            className={`flex-1 py-2 text-center font-bold ${activeTab === 'players' ? 'text-cyan-300 bg-cyan-900/40' : 'text-white'}`}
          >
            Players
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2 text-center font-bold ${activeTab === 'chat' ? 'text-cyan-300 bg-cyan-900/40' : 'text-white'}`}
          >
            Chat
          </button>
        </nav>
      </main>
    );
  }

  return game && !propertiesLoading && !gamePropertiesLoading ? (
    <main className="w-full h-screen overflow-x-hidden relative flex flex-row lg:gap-2">
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
        />
      </div>
      <GameRoom />
    </main>
  ) : (
    <></>
  );
}