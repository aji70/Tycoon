// hooks/useCurrentPlayer.ts
import { useMemo } from "react";
import { Game, Player, Property } from "@/types/game";

export const useCurrentPlayer = (
  game: Game,
  players: Player[],
  me: Player | null,
  properties: Property[]
) => {
  const currentPlayerId = useMemo(() => game.next_player_id ?? -1, [game.next_player_id]);

  const currentPlayer = useMemo(
    () => players.find((p) => p.user_id === currentPlayerId),
    [players, currentPlayerId]
  );

  const isMyTurn = useMemo(
    () => me?.user_id === currentPlayerId,
    [me?.user_id, currentPlayerId]
  );

  const isAITurn = useMemo(
    () =>
      Boolean(
        currentPlayer?.username?.toLowerCase().includes("ai_") ||
          currentPlayer?.username?.toLowerCase().includes("bot")
      ),
    [currentPlayer]
  );

  const playerCanRoll = useMemo(
    () => Boolean(isMyTurn && currentPlayer && currentPlayer.balance > 0),
    [isMyTurn, currentPlayer]
  );

  const currentProperty = useMemo(() => {
    if (!currentPlayer?.position) return null;
    return properties.find((p) => p.id === currentPlayer.position) ?? null;
  }, [currentPlayer?.position, properties]);

  return {
    currentPlayerId,
    currentPlayer,
    isMyTurn,
    isAITurn,
    playerCanRoll,
    currentProperty,
  };
};