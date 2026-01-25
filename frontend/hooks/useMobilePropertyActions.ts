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
  
 
  
};