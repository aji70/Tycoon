// hooks/useAIAutoPlay.ts
import { useEffect } from "react";
import { Property } from "@/types/game";

export const useAIAutoPlay = (
  isAITurn: boolean,
  roll: { die1: number; die2: number; total: number } | null,
  buyPrompted: boolean,
  buyScore: number | null,
  currentProperty: Property | null,
  ROLL_DICE: (forAI?: boolean) => Promise<void>,
  BUY_PROPERTY: () => Promise<void>,
  END_TURN: () => Promise<void>,
  showToast: (msg: string, type?: "success" | "error" | "default") => void
) => {
  // Auto-roll for AI
  useEffect(() => {
    if (!isAITurn || roll) return;
    const timer = setTimeout(() => ROLL_DICE(true), 1200);
    return () => clearTimeout(timer);
  }, [isAITurn, roll, ROLL_DICE]);

  // Auto-buy decision for AI
  useEffect(() => {
    if (!isAITurn || !buyPrompted || buyScore === null || !currentProperty) return;

    const timer = setTimeout(async () => {
      const shouldBuy = buyScore >= 60;
      if (shouldBuy) {
        showToast(`AI buys ${currentProperty.name} (${buyScore}%)`, "success");
        await BUY_PROPERTY();
      } else {
        showToast(`AI skips ${currentProperty.name} (${buyScore}%)`);
      }
      setTimeout(END_TURN, shouldBuy ? 1300 : 900);
    }, 1800);

    return () => clearTimeout(timer);
  }, [isAITurn, buyPrompted, buyScore, currentProperty, BUY_PROPERTY, END_TURN, showToast]);

  // Auto-end turn when no action needed
  useEffect(() => {
    if (!isAITurn || !roll || buyPrompted) return;
    const timer = setTimeout(() => END_TURN(), 1500);
    return () => clearTimeout(timer);
  }, [isAITurn, roll, buyPrompted, END_TURN]);
};