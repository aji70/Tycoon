import { useEffect, useRef } from "react";

export const useCardModal = (
  game: { history?: string[] },
  setShowCardModal: (value: boolean) => void,
  setCardData: (data: {
    type: "chance" | "community";
    text: string;
    effect?: string;
    isGood: boolean;
  } | null) => void,
  setCardPlayerName: (name: string) => void
) => {
  const prevHistoryLength = useRef(game.history?.length ?? 0);

  useEffect(() => {
    const history = game.history ?? [];
    if (history.length <= prevHistoryLength.current) return;

    const newEntry = history[history.length - 1];
    prevHistoryLength.current = history.length;

    if (newEntry == null || typeof newEntry !== "string") return;

    const cardRegex = /(.+) drew (Chance|Community Chest): (.+)/i;
    const match = (newEntry as string).match(cardRegex);

    if (!match) return;

    const [, playerName, typeStr, text] = match;
    const type = typeStr.toLowerCase().includes("chance") ? "chance" : "community";

    const lowerText = text.toLowerCase();
    const isGood =
      lowerText.includes("collect") ||
      lowerText.includes("receive") ||
      lowerText.includes("advance") ||
      lowerText.includes("get out of jail") ||
      lowerText.includes("matures") ||
      lowerText.includes("refund") ||
      lowerText.includes("prize") ||
      lowerText.includes("inherit");

    const effectMatch = text.match(/([+-]?\$\d+)|go to jail|move to .+|get out of jail free/i);
    const effect = effectMatch ? effectMatch[0] : undefined;

    setCardData({ type, text, effect, isGood });
    setCardPlayerName(playerName.trim());
    setShowCardModal(true);

    const timer = setTimeout(() => setShowCardModal(false), 7000);
    return () => clearTimeout(timer);
  }, [game.history, setShowCardModal, setCardData, setCardPlayerName]);
};