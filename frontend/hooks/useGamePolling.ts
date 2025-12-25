// hooks/useGamePolling.ts
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Player } from "@/types/game";

interface ApiResponse {
  success: boolean;
  data?: { players: Player[] };
}

export const useGamePolling = (gameCode: string, initialPlayers: Player[]) => {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await apiClient.get<ApiResponse>(`/games/code/${gameCode}`);
        if (res?.data?.success && res.data.data?.players) {
          setPlayers(res.data.data.players);
        }
      } catch (err) {
        console.error("Game polling failed:", err);
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [gameCode]);

  return { players, setPlayers };
};