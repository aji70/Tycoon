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

 
};