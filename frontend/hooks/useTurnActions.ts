"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { apiClient } from "@/lib/api";
import toast from "react-hot-toast";
import { Game, GameProperty, Player, Property } from "@/types/game";
import { ApiResponse } from "@/types/api";
import { RollResult } from "@/hooks/useDiceRoll";

type TurnActionsProps = {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  me: Player | null;
  currentPlayer: Player | undefined;
  players: Player[];
  setPlayers: (p: Player[]) => void;
  currentProperty: Property | null;
  dice: {
    roll: RollResult | null;
    isRolling: boolean;
    rollDice: (forAI?: boolean) => Promise<void>;
    reset: () => void;
  };
  isMyTurn: boolean;
  isAITurn: boolean;
  buyScore: number | null;
};

export function useTurnActions({
  game,
  properties,
  game_properties,
  currentPlayer,
  players,
  setPlayers,
  currentProperty,
  dice,
  isMyTurn,
  isAITurn,
  buyScore, // unused here but kept for consistency
}: TurnActionsProps) {
  const [buyPrompted, setBuyPrompted] = useState(false);
  const [hasActedOnCurrentLanding, setHasActedOnCurrentLanding] = useState(false);
  const [actionLock, setActionLock] = useState<"ROLL" | "END" | null>(null);

  const lockAction = useCallback((type: "ROLL" | "END") => {
    if (actionLock) return false;
    setActionLock(type);
    return true;
  }, [actionLock]);

  const unlockAction = useCallback(() => setActionLock(null), []);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    toast.dismiss();
    if (type === "success") toast.success(msg);
    else toast.error(msg);
  }, []);

  const fetchUpdatedGame = useCallback(async () => {
    try {
      const res = await apiClient.get<ApiResponse>(`/games/code/${game.code}`);
      if (res?.data?.success && res.data.data?.players) {
        setPlayers(res.data.data.players);
      }
    } catch (err) {
      console.error("Failed to sync game:", err);
    }
  }, [game.code, setPlayers]);

  const endTurn = useCallback(async () => {
    if (!currentPlayer || !lockAction("END")) return;

    try {
      await apiClient.post("/game-players/end-turn", {
        user_id: currentPlayer.user_id,
        game_id: game.id,
      });
      showToast("Turn ended", "success");
      await fetchUpdatedGame();
    } catch (err) {
      showToast("Failed to end turn", "error");
    } finally {
      unlockAction();
    }
  }, [currentPlayer, game.id, lockAction, unlockAction, showToast, fetchUpdatedGame]);

  const buyProperty = useCallback(async () => {
    if (!currentPlayer?.position || actionLock || !currentProperty) return;

    try {
      await apiClient.post("/game-properties/buy", {
        user_id: currentPlayer.user_id,
        game_id: game.id,
        property_id: currentProperty.id,
      });

      showToast(`Bought ${currentProperty.name}!`, "success");
      setBuyPrompted(false);
      setHasActedOnCurrentLanding(true);
      await fetchUpdatedGame();
      setTimeout(endTurn, 1000);
    } catch (err) {
      showToast("Purchase failed", "error");
    }
  }, [currentPlayer, currentProperty, game.id, actionLock, fetchUpdatedGame, endTurn, showToast]);

  const skipBuy = useCallback(() => {
    showToast("Skipped purchase", "success");
    setBuyPrompted(false);
    setHasActedOnCurrentLanding(true);
    setTimeout(endTurn, 800);
  }, [showToast, endTurn]);

  // Expose dice.rollDice so CenterInfo can call it
  const rollDice = dice.rollDice;

  const playerCanRoll = useMemo(
    () => isMyTurn && !!currentPlayer && (currentPlayer.balance ?? 0) > 0,
    [isMyTurn, currentPlayer]
  );

  // Detect when player lands on a buyable property
  useEffect(() => {
    if (!currentPlayer?.position || dice.roll === null || dice.isRolling) return;

    const square = properties.find((p) => p.id === currentPlayer.position);
    if (!square) return;

    const isOwned = game_properties.some((gp) => gp.property_id === square.id);
    const canBuy = !isOwned && ["land", "railway", "utility"].includes(square.type || "");

    if (canBuy && !hasActedOnCurrentLanding) {
      setBuyPrompted(true);

      // Optional: immediate toast if can't afford
      if (square.price && currentPlayer.balance < square.price) {
        showToast(`Not enough money to buy ${square.name}`, "error");
      }
    }
  }, [
    currentPlayer?.position,
    dice.roll,
    dice.isRolling,
    properties,
    game_properties,
    hasActedOnCurrentLanding,
    currentPlayer?.balance,
    showToast,
  ]);

  return {
    buyPrompted,
    buyProperty,
    skipBuy,
    endTurn,
    playerCanRoll,
    actionLock,
    rollDice, // ← now exposed!
  };
}