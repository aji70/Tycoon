import { useCallback } from "react";
import { toast } from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";

export const useMobilePropertyActions = (
  gameId: number,
  userId: number | undefined,
  isMyTurn: boolean,
  fetchUpdatedGame: () => Promise<void>,
  showToast: (message: string, type?: "success" | "error" | "default") => void
) => {
  const handleBuild = useCallback(async (propertyId: number) => {
    if (!isMyTurn || !userId) {
      showToast("Not your turn or invalid property", "error");
      return;
    }

    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/development", {
        game_id: gameId,
        user_id: userId,
        property_id: propertyId,
      });

      if (res.data?.success) {
        showToast("Successfully built!", "success");
        await fetchUpdatedGame();
      } else {
        showToast(res.data?.message || "Build failed", "error");
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || "Build failed", "error");
    }
  }, [gameId, userId, isMyTurn, fetchUpdatedGame, showToast]);

  const handleSellBuilding = useCallback(async (propertyId: number) => {
    if (!isMyTurn || !userId) {
      showToast("Not your turn or invalid property", "error");
      return;
    }

    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/downgrade", {
        game_id: gameId,
        user_id: userId,
        property_id: propertyId,
      });

      if (res.data?.success) {
        showToast("Successfully sold building!", "success");
        await fetchUpdatedGame();
      } else {
        showToast(res.data?.message || "Sell failed", "error");
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || "Sell failed", "error");
    }
  }, [gameId, userId, isMyTurn, fetchUpdatedGame, showToast]);

  
 
  
};