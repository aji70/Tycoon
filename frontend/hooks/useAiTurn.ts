import { useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import { Player } from "@/types/game";
import { RollResult } from "@/hooks/useDiceRoll";

type UseAITurnProps = {
  isAITurn: boolean;
  currentPlayer: Player | undefined;
  dice: {
    roll: RollResult | null;
    isRolling: boolean;
    rollDice: (forAI?: boolean) => Promise<void>;
    reset: () => void;
  };
  actions: {
    buyPrompted: boolean;
    buyProperty: () => Promise<void>;
    skipBuy: () => void;
    endTurn: () => Promise<void>;
  };
  buyScore: number | null;
};

export function useAITurn({
  isAITurn,
  currentPlayer,
  dice,
  actions,
  buyScore,
}: UseAITurnProps) {
  // Ref to prevent multiple simultaneous timers
  const rollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const buyTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Auto-roll when it's AI's turn and no roll/action in progress
  useEffect(() => {
    if (!isAITurn || dice.isRolling || dice.roll || !currentPlayer) {
      // Cleanup any pending roll timer
      if (rollTimerRef.current) {
        clearTimeout(rollTimerRef.current);
        rollTimerRef.current = null;
      }
      return;
    }

    rollTimerRef.current = setTimeout(() => {
      dice.rollDice(true).catch((err) => {
        console.error("AI auto-roll failed:", err);
        toast.error("AI failed to roll dice");
      });
    }, 1400);

    return () => {
      if (rollTimerRef.current) {
        clearTimeout(rollTimerRef.current);
        rollTimerRef.current = null;
      }
    };
  }, [isAITurn, dice.isRolling, dice.roll, currentPlayer, dice.rollDice]);

  // 2. AI automatic buy/skip decision
  useEffect(() => {
    if (!isAITurn || !actions.buyPrompted || buyScore === null || !currentPlayer) {
      // Cleanup any pending buy timer
      if (buyTimerRef.current) {
        clearTimeout(buyTimerRef.current);
        buyTimerRef.current = null;
      }
      return;
    }

    buyTimerRef.current = setTimeout(async () => {
      try {
        const shouldBuy = buyScore >= 60;

        if (shouldBuy) {
          await actions.buyProperty();
          toast.success(`AI bought the property (${buyScore}%)`);
        } else {
          actions.skipBuy();
          toast("AI skipped purchase", { icon: "⏭️" });
        }

        // Auto end turn with slight delay for better UX
        setTimeout(() => {
          actions.endTurn().catch((err) => {
            console.error("AI end turn failed:", err);
            toast.error("AI failed to end turn");
          });
        }, shouldBuy ? 1200 : 800);
      } catch (err) {
        console.error("AI buy decision failed:", err);
        toast.error("AI decision error");
        // Fallback: force end turn
        actions.endTurn();
      }
    }, 2000);

    return () => {
      if (buyTimerRef.current) {
        clearTimeout(buyTimerRef.current);
        buyTimerRef.current = null;
      }
    };
  }, [
    isAITurn,
    actions.buyPrompted,
    buyScore,
    currentPlayer,
    actions.buyProperty,
    actions.skipBuy,
    actions.endTurn,
  ]);

  // Optional: Reset AI state when turn changes
  useEffect(() => {
    return () => {
      // Cleanup all timers on unmount / turn change
      if (rollTimerRef.current) clearTimeout(rollTimerRef.current);
      if (buyTimerRef.current) clearTimeout(buyTimerRef.current);
    };
  }, []);
}