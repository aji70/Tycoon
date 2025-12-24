import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api";
import { Game, Player } from "@/types/game";
import { ApiResponse } from "@/types/api";

type GameSyncReturn = {
  players: Player[];
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  currentPlayer: Player | undefined;
  isMyTurn: boolean;
  isAITurn: boolean;
};

export function useGameSync(game: Game, me: Player | null): GameSyncReturn {
  const [players, setPlayers] = useState<Player[]>(game?.players ?? []);
  const lastProcessed = useRef<number | null>(null);

  const currentPlayerId = game.next_player_id;
  const currentPlayer = players.find((p) => p.user_id === currentPlayerId);

  // Fixed: safe comparison that always returns boolean
  const isMyTurn = currentPlayerId != null && me?.user_id === currentPlayerId;

  const isAITurn =
    currentPlayer?.username?.toLowerCase().includes("ai_") ||
    currentPlayer?.username?.toLowerCase().includes("bot") ||
    false; // explicit fallback to boolean

  // Fetch latest game state from backend
  const fetchUpdatedGame = useCallback(async () => {
    try {
      const res = await apiClient.get<ApiResponse>(`/games/code/${game.code}`);
      if (res?.data?.success && res.data.data?.players) {
        setPlayers(res.data.data.players);
      }
    } catch (err) {
      console.error("Game sync failed:", err);
    }
  }, [game.code]);

  // Polling
  useEffect(() => {
    const interval = setInterval(fetchUpdatedGame, 6000);
    return () => clearInterval(interval);
  }, [fetchUpdatedGame]);

  useEffect(() => {
  console.log("Turn changed → next_player_id:", game.next_player_id);
  console.log("Current player:", currentPlayer?.username);
  console.log("Is AI turn?", isAITurn);
}, [game.next_player_id, currentPlayer, isAITurn]);

  // Update players when game prop changes
  useEffect(() => {
    if (game?.players) {
      setPlayers(game.players);
    }
  }, [game?.players]);

  return {
    players,
    setPlayers,
    currentPlayer,
    isMyTurn,
    isAITurn,
  };
}