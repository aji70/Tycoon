"use client";

import { useState, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api";
import { toast } from "react-hot-toast";
import { Game, Player } from "@/types/game";
import { ApiResponse } from "@/types/api";

export type RollResult = {
  die1: number;
  die2: number;
  total: number;
  isDouble: boolean;
};

type UseDiceRollProps = {
  gameId: string | number;
  currentPlayer: Player | undefined;
  currentPosition: number | undefined; // allow undefined (safer)
  onPositionUpdate?: (newPosition: number, rolled: number) => void;
  onDoubles?: () => void;
};

export function useDiceRoll({
  gameId,
  currentPlayer,
  currentPosition = 0, // default to 0 if undefined
  onPositionUpdate,
  onDoubles,
}: UseDiceRollProps) {
  const [roll, setRoll] = useState<RollResult | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [pendingRoll, setPendingRoll] = useState(0);

  const isRollingRef = useRef(false);
  const doubleCountRef = useRef(0); // bonus: track consecutive doubles

  const BOARD_SQUARES = 40;
  const ROLL_ANIMATION_MS = 1200;

  const getDiceValues = (): RollResult => {
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const total = die1 + die2;
    const isDouble = die1 === die2;

    return { die1, die2, total, isDouble };
  };

  const rollDice = useCallback(
    async (forAI = false) => {
      if (isRollingRef.current) return;
      if (!currentPlayer?.user_id) {
        toast.error("No current player selected");
        return;
      }

      isRollingRef.current = true;
      setIsRolling(true);
      setRoll(null);

      try {
        // Wait for animation
        await new Promise((resolve) => setTimeout(resolve, ROLL_ANIMATION_MS));

        const value = getDiceValues();
        const { die1, die2, total, isDouble } = value;

        // Handle doubles
        if (isDouble) {
          doubleCountRef.current += 1;
          toast.success("DOUBLES! Roll again!", { duration: 3000 });

          if (doubleCountRef.current === 3) {
            toast.error("Three doubles in a row! Go to Jail!", { duration: 5000 });
            // You can add jail logic here later
            doubleCountRef.current = 0;
          }

          if (onDoubles) onDoubles();
        } else {
          doubleCountRef.current = 0;
        }

        setRoll(value);

        const playerId = currentPlayer.user_id;
        const newPosition = (currentPosition + total + pendingRoll) % BOARD_SQUARES;

        // Update position on backend
        const response = await apiClient.post<ApiResponse>("/game-players/change-position", {
          user_id: playerId,
          game_id: gameId,
          position: newPosition,
          rolled: total + pendingRoll,
          is_double: isDouble,
        });

        if (!response?.data?.success) {
          throw new Error("Position update failed");
        }

        // Reset pending roll after successful move
        setPendingRoll(0);

        // Notify parent
        if (onPositionUpdate) {
          onPositionUpdate(newPosition, total + pendingRoll);
        }

        toast.success(
          `${currentPlayer.username} rolled ${die1} + ${die2} = ${total}!`,
          { duration: 4000 }
        );

      } catch (error: any) {
        console.error("Dice roll / move failed:", error);
        toast.error(error.message || "Failed to move player");
      } finally {
        setIsRolling(false);
        isRollingRef.current = false;
      }
    },
    [
      currentPlayer,
      currentPosition,
      pendingRoll,
      gameId,
      onPositionUpdate,
      onDoubles,
    ]
  );

  const addPendingRoll = useCallback((amount: number) => {
    setPendingRoll((prev) => prev + amount);
  }, []);

  // Renamed from resetRoll → reset (to match common usage in CenterInfo)
  const reset = useCallback(() => {
    setRoll(null);
    setIsRolling(false);
    setPendingRoll(0);
    isRollingRef.current = false;
    doubleCountRef.current = 0; // reset double tracking
  }, []);

  return {
    roll,
    isRolling,
    pendingRoll,
    rollDice,
    addPendingRoll,
    reset, // ← renamed from resetRoll
  };
}