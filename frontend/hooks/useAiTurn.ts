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
  const rollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const buyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasRolledThisTurn = useRef(false); // prevent double-roll

  // Reset flags when turn changes
  useEffect(() => {
    hasRolledThisTurn.current = false;
    if (rollTimerRef.current) clearTimeout(rollTimerRef.current);
    if (buyTimerRef.current) clearTimeout(buyTimerRef.current);
  }, [currentPlayer?.user_id]);

  // Auto-roll when AI turn starts and conditions met
  useEffect(() => {
    if (
      !isAITurn ||
      dice.isRolling ||
      dice.roll ||
      !currentPlayer ||
      hasRolledThisTurn.current
    ) {
      return;
    }

    console.log("[AI] Turn detected — scheduling roll in 1.4s");

    rollTimerRef.current = setTimeout(() => {
      console.log("[AI] Rolling dice now!");
      hasRolledThisTurn.current = true;
      dice.rollDice(true).catch((err) => {
        console.error("[AI] Roll failed:", err);
        toast.error("AI failed to roll");
      });
    }, 1400);

    return () => {
      if (rollTimerRef.current) clearTimeout(rollTimerRef.current);
    };
  }, [isAITurn, currentPlayer, dice.isRolling, dice.roll, dice.rollDice]);

  // AI buy/skip decision (runs after roll)
  useEffect(() => {
    if (!isAITurn || !actions.buyPrompted || buyScore === null || !currentPlayer) {
      return;
    }

    console.log("[AI] Buy prompt active — deciding in 2s");

    buyTimerRef.current = setTimeout(async () => {
      try {
        const shouldBuy = buyScore >= 60;

        if (shouldBuy) {
          console.log("[AI] Buying property");
          await actions.buyProperty();
        } else {
          console.log("[AI] Skipping buy");
          actions.skipBuy();
        }

        setTimeout(() => {
          console.log("[AI] Ending turn");
          actions.endTurn();
        }, shouldBuy ? 1200 : 800);
      } catch (err) {
        console.error("[AI] Buy decision error:", err);
        toast.error("AI decision failed");
        actions.endTurn(); // fallback
      }
    }, 2000);

    return () => {
      if (buyTimerRef.current) clearTimeout(buyTimerRef.current);
    };
  }, [isAITurn, actions.buyPrompted, buyScore, currentPlayer, actions]);
}