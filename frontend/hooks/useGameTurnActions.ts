// hooks/useGameTurnActions.ts
import { useCallback, useState } from "react";
import { apiClient } from "@/lib/api";
import { toast } from "react-hot-toast";
import { Player, Property } from "@/types/game";

const BOARD_SQUARES = 40;
const ROLL_ANIMATION_MS = 1200;

const getDiceValues = (): { die1: number; die2: number; total: number } | null => {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const total = die1 + die2;
  return total === 12 ? null : { die1, die2, total };
};

export const useGameTurnActions = (
  gameId: number,
  currentPlayerId: number,
  currentPlayer: Player | undefined,
  me: Player | null,
  properties: Property[],
  onSuccess?: () => void
) => {
  const [roll, setRoll] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [pendingRoll, setPendingRoll] = useState(0);
  const [actionLock, setActionLock] = useState<"ROLL" | "END" | null>(null);

  const lockAction = useCallback((type: "ROLL" | "END") => {
    if (actionLock) return false;
    setActionLock(type);
    return true;
  }, [actionLock]);

  const unlockAction = useCallback(() => setActionLock(null), []);

  const showToast = useCallback((message: string, type: "success" | "error" | "default" = "default") => {
    toast.dismiss();
    if (type === "success") toast.success(message);
    else if (type === "error") toast.error(message);
    else toast(message, { icon: "➤" });
  }, []);

  const END_TURN = useCallback(async () => {
    if (!currentPlayerId || !lockAction("END")) return;

    try {
      await apiClient.post("/game-players/end-turn", {
        user_id: currentPlayerId,
        game_id: gameId,
      });
      showToast("Turn ended", "success");
      onSuccess?.();
    } catch {
      showToast("Failed to end turn", "error");
    } finally {
      unlockAction();
    }
  }, [currentPlayerId, gameId, lockAction, unlockAction, showToast, onSuccess]);

  const BUY_PROPERTY = useCallback(async () => {
    if (!currentPlayer?.position || actionLock) return;
    const square = properties.find((p) => p.id === currentPlayer.position);
    if (!square) return;

    try {
      await apiClient.post("/game-properties/buy", {
        user_id: currentPlayer.user_id,
        game_id: gameId,
        property_id: square.id,
      });
      showToast(`You bought ${square.name}!`, "success");
      onSuccess?.();
    } catch {
      showToast("Purchase failed", "error");
    }
  }, [currentPlayer, properties, gameId, actionLock, showToast, onSuccess]);

  const ROLL_DICE = useCallback(async (forAI = false) => {
    if (isRolling || actionLock || !lockAction("ROLL")) return;

    setIsRolling(true);
    setRoll(null);

    setTimeout(async () => {
      const value = getDiceValues();
      if (!value) {
        showToast("DOUBLES! Roll again!", "success");
        setIsRolling(false);
        unlockAction();
        return;
      }

      setRoll(value);
      const playerId = forAI ? currentPlayerId : me!.user_id;
      const currentPos = currentPlayer?.position ?? 0;
      const newPos = (currentPos + value.total + pendingRoll) % BOARD_SQUARES;

      try {
        await apiClient.post("/game-players/change-position", {
          user_id: playerId,
          game_id: gameId,
          position: newPos,
          rolled: value.total + pendingRoll,
          is_double: value.die1 === value.die2,
        });
        setPendingRoll(0);
        showToast(
          `${currentPlayer?.username} rolled ${value.die1} + ${value.die2} = ${value.total}!`,
          "success"
        );
      } catch {
        showToast("Move failed", "error");
        await END_TURN();
      } finally {
        setIsRolling(false);
        unlockAction();
      }
    }, ROLL_ANIMATION_MS);
  }, [
    isRolling,
    actionLock,
    lockAction,
    unlockAction,
    currentPlayerId,
    me,
    currentPlayer,
    pendingRoll,
    gameId,
    END_TURN,
    showToast,
  ]);

  return {
    roll,
    setRoll,
    isRolling,
    pendingRoll,
    setPendingRoll,
    actionLock,
    ROLL_DICE,
    BUY_PROPERTY,
    END_TURN,
    lockAction,
    unlockAction,
    showToast,
  };
};