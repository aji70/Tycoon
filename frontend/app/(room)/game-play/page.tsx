"use client";

import GameBoard from "@/components/game/game-board";
import GameRoom from "@/components/game/game-room";
import GamePlayers from "@/components/game/players";
import { apiClient } from "@/lib/api";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Game, GameProperty, Player, Property } from "@/types/game";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { ApiResponse } from "@/types/api";

export default function GamePlayPage() {
  const searchParams = useSearchParams();
  const [gameCode, setGameCode] = useState<string>("");

  const { address } = useAccount();

  // ✅ Extract gameCode from search or localStorage
  useEffect(() => {
    const code = searchParams.get("gameCode") || localStorage.getItem("gameCode");
    if (code && code.length === 6) setGameCode(code);
  }, [searchParams]);

  // --- Fetch Game ---
  const {
    data: game,
    isLoading: gameLoading,
    isError: gameError,
  } = useQuery<Game>({
    queryKey: ["game", gameCode],
    queryFn: async () => {
      if (!gameCode) throw new Error("No game code found");
      const res = await apiClient.get<ApiResponse<Game>>(`/games/code/${gameCode}`);
      return res.data!;
    },
    enabled: !!gameCode,
    refetchInterval: 5000,
  });

  // --- Fetch Game Properties ---
  const {
    data: game_properties = [],
    isLoading: gamePropertiesLoading,
    isError: gamePropertiesError,
  } = useQuery<GameProperty[]>({
    queryKey: ["game_properties", game?.id],
    queryFn: async () => {
      if (!game?.id) return [];
      const res = await apiClient.get<ApiResponse<GameProperty[]>>(
        `/game-properties/game/${game.id}`
      );
      return res.data || [];
    },
    enabled: !!game?.id,
    refetchInterval: 15000,
  });

  // --- Fetch All Properties ---
  const {
    data: properties = [],
    isLoading: propertiesLoading,
    isError: propertiesError,
  } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<Property[]>>("/properties");
      return res.data || [];
    },
    staleTime: Infinity,
  });

  // ✅ Find my player profile
  const me = useMemo(() => {
    if (!game?.players || !address) return null;
    return game.players.find(
      (pl: Player) => pl.address?.toLowerCase() === address.toLowerCase()
    ) || null;
  }, [game, address]);

  // ✅ Compute my owned properties
  const my_properties: Property[] = useMemo(() => {
    if (!game_properties?.length || !properties?.length || !address) return [];

    const propertyMap = new Map(properties.map((p) => [p.id, p]));
    return game_properties
      .filter((gp) => gp.address?.toLowerCase() === address.toLowerCase())
      .map((gp) => propertyMap.get(gp.property_id))
      .filter((p): p is Property => !!p);
  }, [game_properties, properties, address]);

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

  // --- Main Layout ---
  return game ? (
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
          my_properties={my_properties}
          me={me}
          loading={propertiesLoading}
        />
      </div>
      <GameRoom />
    </main>
  ) : (
    <></>
  );
}
