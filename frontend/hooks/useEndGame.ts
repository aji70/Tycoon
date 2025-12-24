import { useState, useCallback } from "react";
import { useEndAiGame, useGetGameByCode } from "@/context/ContractProvider";
import { apiClient } from "@/lib/api";
import toast from "react-hot-toast";
import { Game, Player } from "@/types/game";

export function useGameEnd({ game, me, players }: { game: Game; me: Player | null; players: Player[] }) {
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null); // you might want to compute this
 const [endGameCandidate, setEndGameCandidate] = useState<{
    winner: Player | null;
    position: number;
    balance: bigint;
  }>({ winner: null, position: 0, balance: BigInt(0) });
  const { data: contractGame } = useGetGameByCode(game.code, { enabled: !!game.code });
  const onChainGameId = contractGame?.id;



  const { write: endGame, isPending, reset } = useEndAiGame(
    Number(onChainGameId),
    endGameCandidate.position,
    endGameCandidate.balance,
    !!endGameCandidate.winner
  );

  const handleDeclareBankruptcy = useCallback(async () => {
    const toastId = toast.loading("Declaring bankruptcy...");
    try {
      const opponent = players.find((p) => p.user_id !== me?.user_id);
      await apiClient.put(`/games/${game.id}`, {
        status: "FINISHED",
        winner_id: opponent?.user_id || null,
      });

      if (endGame) await endGame();

      toast.success("Game over — bankruptcy declared", { id: toastId });
      setTimeout(() => (window.location.href = "/"), 2000);
    } catch {
      toast.error("Failed to declare bankruptcy", { id: toastId });
    }
  }, [game.id, me, players, endGame]);

  const handleFinalizeAndLeave = useCallback(async () => {
    setShowExitPrompt(false);
    const toastId = toast.loading("Finalizing game...");

    try {
      if (endGame) await endGame();
      toast.success("Game completed!", { id: toastId });
      setTimeout(() => (window.location.href = "/"), 1500);
    } catch {
      toast.error("Failed to finalize game", { id: toastId });
    } finally {
      reset?.();
    }
  }, [endGame, reset]);

  const handleExitAttempt = useCallback((shouldTryFinalize: boolean) => {
    if (!winner) {
      window.location.href = "/";
      return;
    }
    if (shouldTryFinalize) {
      setShowExitPrompt(true);
    } else {
      window.location.href = "/";
    }
  }, [winner]);

  return {
    winner,
    showExitPrompt,
    isPending,
    handleDeclareBankruptcy,
    handleFinalizeAndLeave,
    handleExitAttempt,
    setShowExitPrompt,
  };
}