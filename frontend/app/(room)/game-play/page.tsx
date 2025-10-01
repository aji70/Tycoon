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

export default function GamePlayPage() {
  const searchParams = useSearchParams();
  const [gameCode, setGameCode] = useState<string>("");

  // ✅ get connected wallet address
  const { address } = useAccount();

  useEffect(() => {
    const code =
      searchParams.get("gameCode") || localStorage.getItem("gameCode");
    if (code && code.length === 6) {
      setGameCode(code);
    }
  }, [searchParams]);

  // --- Fetch Game ---
  const {
    data: game,
    isLoading: gameLoading,
    isError: gameError,
  } = useQuery({
    queryKey: ["game", gameCode],
    queryFn: async () =>
      gameCode ? await apiClient.get<Game>(`/games/code/${gameCode}`) : null,
    enabled: !!gameCode,
    refetchInterval: 5000,
  });

  // --- Fetch Game Properties ---
  const {
    data: game_properties = [],
    isLoading: gamePropertiesLoading,
    isError: gamePropertiesError,
  } = useQuery({
    queryKey: ["game_properties", game?.id],
    queryFn: async () =>
      game?.id
        ? await apiClient.get<GameProperty[]>(
            `/game-properties/game/${game.id}`
          )
        : [],
    enabled: !!game,
    refetchInterval: 15000,
  });

  // --- Fetch All Properties ---
  const {
    data: properties = [],
    isLoading: propertiesLoading,
    isError: propertiesError,
  } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => await apiClient.get<Property[]>("/properties"),
    staleTime: Number.POSITIVE_INFINITY,
  });

  // ✅ find my profile from game.players
  const me = useMemo(() => {
    if (!game?.players || !address) return null;
    const player = game.players.find(
      (pl: Player) => pl.address?.toLowerCase() === address.toLowerCase()
    );
    return player || null;
  }, [game, address]);

  // ✅ compute my properties
  const my_properties: Property[] = useMemo(() => {
    if (!game_properties || !properties || !game?.players || !address)
      return [];

    const propertyMap = new Map<number, Property>(
      properties.map((p) => [p.id, p])
    );

    return game_properties
      .filter(
        (gp: GameProperty) =>
          gp.address?.toLowerCase() === address.toLowerCase()
      )
      .map((gp: GameProperty) => propertyMap.get(gp.property_id))
      .filter((p): p is Property => !!p);
  }, [game_properties, properties, game, address]);

  if (gameLoading)
    return (
      <div className="w-full min-h-screen h-auto flex items-center justify-center text-lg font-medium text-white">
        Loading game...
      </div>
    );

  if (gameError)
    return (
      <div className="w-full min-h-screen h-auto flex items-center justify-center text-lg font-medium text-white">
        Failed to load game
      </div>
    );

  // --- Main Layout ---
  return game ? (
    <main className="w-full h-screen overflow-x-hidden relative flex flex-row lg:gap-2">
      <GamePlayers
        game={game}
        properties={properties}
        game_properties={game_properties}
        my_properties={my_properties}
        me={me}
        loading={gamePropertiesLoading || propertiesLoading}
      />
      <div className="lg:flex-1 w-full">
        <GameBoard
          game={game}
          properties={properties}
          game_properties={game_properties}
          my_properties={my_properties}
          me={me}
          loading={gamePropertiesLoading || propertiesLoading}
        />
      </div>
      <GameRoom />
    </main>
  ) : (
    <></>
  );
}
