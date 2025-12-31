// src/hooks/useDevGameTools.ts
import { useState } from "react";
import toast from "react-hot-toast";
import { Game, GameProperty, Player } from "@/types/game";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";

export function useDevGameTools({
  game,
  game_properties,
}: {
  game: Game;
  game_properties: GameProperty[];
}) {
  // Cash state
  const [cashTargetPlayerId, setCashTargetPlayerId] = useState<number | null>(null);
  const [cashAmount, setCashAmount] = useState<string>("");
  const [isAdjustingCash, setIsAdjustingCash] = useState(false);

  // Position state
  const [positionTargetPlayerId, setPositionTargetPlayerId] = useState<number | null>(null);
  const [newPosition, setNewPosition] = useState<string>("");
  const [isChangingPosition, setIsChangingPosition] = useState(false);

  // Shared: get real game_players.id from owned property (same as transfer)
  const getGamePlayerId = (walletAddress: string): number | null => {
    const owned = game_properties.find(
      gp => gp.address?.toLowerCase() === walletAddress.toLowerCase()
    );
    return owned?.player_id ?? null;
  };

  // === Adjust Cash ===
  const adjustCash = async () => {
    if (!cashTargetPlayerId || cashAmount === "" || isNaN(Number(cashAmount))) {
      toast.error("Select a player and enter a valid amount");
      return;
    }

    const amount = Number(cashAmount);
    if (amount === 0) {
      toast.error("Amount cannot be zero");
      return;
    }

    const targetPlayer = game.players.find(p => p.user_id === cashTargetPlayerId);
    if (!targetPlayer?.address) {
      toast.error("Player not found or missing wallet address");
      return;
    }

    const realPlayerId = getGamePlayerId(targetPlayer.address);
    if (!realPlayerId) {
      toast.error("Player must own at least one property");
      return;
    }

    setIsAdjustingCash(true);
    try {
      const res = await apiClient.put<ApiResponse>(`/game-players/${realPlayerId}`, {
        game_id: game.id,
        user_id: targetPlayer.user_id,
        balance: targetPlayer.balance + amount,
      });

      if (res?.data?.success) {
        toast.success(
          `${amount > 0 ? "+" : ""}$${Math.abs(amount).toLocaleString()} ${
            amount > 0 ? "added to" : "removed from"
          } ${targetPlayer.username}'s balance`
        );
        setCashAmount("");
        setCashTargetPlayerId(null);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to adjust cash");
    } finally {
      setIsAdjustingCash(false);
    }
  };

  // === Change Player Position (using same PUT endpoint as cash) ===
  const changePlayerPosition = async () => {
    if (!positionTargetPlayerId || newPosition === "" || isNaN(Number(newPosition))) {
      toast.error("Select a player and enter a valid position (0–39)");
      return;
    }

    const pos = Number(newPosition);
    if (pos < 0 || pos > 39) {
      toast.error("Position must be between 0 and 39");
      return;
    }

    const targetPlayer = game.players.find(p => p.user_id === positionTargetPlayerId);
    if (!targetPlayer?.address) {
      toast.error("Player not found or missing wallet address");
      return;
    }

    const realPlayerId = getGamePlayerId(targetPlayer.address);
    if (!realPlayerId) {
      toast.error("Player must own at least one property");
      return;
    }

    setIsChangingPosition(true);
    try {
      const res = await apiClient.put<ApiResponse>(`/game-players/${realPlayerId}`, {
        game_id: game.id,
        user_id: targetPlayer.user_id,
        position: pos,
      });

      if (res?.data?.success) {
        toast.success(`${targetPlayer.username} moved to position ${pos}`);
        setNewPosition("");
        setPositionTargetPlayerId(null);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to change position");
    } finally {
      setIsChangingPosition(false);
    }
  };

  return {
    // Cash
    cashTargetPlayerId,
    setCashTargetPlayerId,
    cashAmount,
    setCashAmount,
    isAdjustingCash,
    adjustCash,

    // Position
    positionTargetPlayerId,
    setPositionTargetPlayerId,
    newPosition,
    setNewPosition,
    isChangingPosition,
    changePlayerPosition,
  };
}