import { useCallback } from "react";
import { toast } from "react-hot-toast";
import { apiClient } from "@/lib/api"; // Assuming this is the correct import path
import { ApiResponse } from "@/types/api"; // Assuming this is the correct import path

export const usePropertyActions = (gameId: number, userId: number | undefined, isMyTurn: boolean) => {
  const handleDevelopment = useCallback(async (id: number) => {
    if (!isMyTurn || !userId) return;
    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/development", {
        game_id: gameId,
        user_id: userId,
        property_id: id,
      });
      if (res?.data?.success) toast.success("Property developed successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to develop property");
    }
  }, [gameId, userId, isMyTurn]);


 

  
};