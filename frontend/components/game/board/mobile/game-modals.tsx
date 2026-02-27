import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import { Game, Player } from "@/types/game";
import { apiClient } from "@/lib/api";
import { VictoryDefeatModal } from "../../modals/VictoryDefeatModal";
import { CardModal } from "../../modals/cards";

interface GameModalsProps {
  winner: Player | null;
  /** Loser's finishing position (1 = winner, 2 = 2nd, etc.). From game.placements when finished by time. */
  myPosition?: number;
  showExitPrompt: boolean;
  setShowExitPrompt: (value: boolean) => void;
  showInsolvencyModal: boolean;
  insolvencyDebt: number;
  isRaisingFunds: boolean;
  showBankruptcyModal: boolean;
  showCardModal: boolean;
  cardData: {
    type: "chance" | "community";
    text: string;
    effect?: string;
    isGood: boolean;
  } | null;
  cardPlayerName: string;
  setShowCardModal: (value: boolean) => void;
  me: Player | null;
  players: Player[];
  currentGame: Game;
  isPending: boolean;
  // endGame: () => Promise<any>;
  // reset: () => void;
  setShowInsolvencyModal: (value: boolean) => void;
  setIsRaisingFunds: (value: boolean) => void;
  setShowBankruptcyModal: (value: boolean) => void;
  fetchUpdatedGame: () => Promise<void>;
  showToast: (message: string, type?: "success" | "error" | "default") => void;
}

const GameModals: React.FC<GameModalsProps> = ({
  winner,
  myPosition,
  showExitPrompt,
  setShowExitPrompt,
  showInsolvencyModal,
  insolvencyDebt,
  isRaisingFunds,
  showBankruptcyModal,
  showCardModal,
  cardData,
  cardPlayerName,
  setShowCardModal,
  me,
  players,
  currentGame,
  isPending,
  setShowInsolvencyModal,
  setIsRaisingFunds,
  setShowBankruptcyModal,
  fetchUpdatedGame,
  showToast,
}) => {
  const handleRaiseFunds = () => {
    setShowInsolvencyModal(false);
    setIsRaisingFunds(true);
    showToast("Raise funds (mortgage, sell houses, trade) then click 'Try Again'", "default");
  };

  const handleRetryAfterFunds = () => {
    fetchUpdatedGame();

    if (!me || me.balance > 0) {
      setIsRaisingFunds(false);
      showToast("Funds raised successfully! Your turn continues.", "success");
    } else {
      showToast("Still not enough money. Raise more or declare bankruptcy.", "error");
      setShowInsolvencyModal(true);
    }
  };

  const handleFinalizeAndLeave = async () => {
    setShowExitPrompt(false);
    const toastId = toast.loading(
      winner?.user_id === me?.user_id
        ? "Finalizing..."
        : "Finalizing game results..."
    );
    try {
      toast.success(
        winner?.user_id === me?.user_id
          ? "Game completed — you won! 🎉"
          : "Game completed — thanks for playing!",
        { id: toastId, duration: 5000 }
      );
    } catch (err: any) {
      toast.error(
        err?.message || "Something went wrong — you can try again later",
        { id: toastId, duration: 8000 }
      );
    }
  };

  return (
    <>
      {/* Winner / Loser — shared with desktop multiplayer */}
      {winner && (
        <VictoryDefeatModal winner={winner} me={me} myPosition={myPosition} />
      )}

      {/* Exit Prompt */}
   <AnimatePresence>
  {showExitPrompt && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[110] p-4"
    >
      <motion.div
        initial={{ scale: 0.85, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, y: 40 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-3xl max-w-md w-full text-center border border-red-500/30 shadow-2xl shadow-red-900/40"
      >
        <h2 className="text-3xl font-bold text-white mb-6">Game Over</h2>

        <p className="text-xl text-gray-300 mb-8 leading-relaxed">
          Better luck next time!<br />
          <span className="text-lg text-red-400 mt-2 block">
            You gave it a good fight — see you on the board again soon! 🔥
          </span>
        </p>

        <button
          onClick={() => {
            setShowExitPrompt(false);
            // Small delay so exit animation can finish nicely
            setTimeout(() => {
              window.location.href = "/";
            }, 400);
          }}
          className="px-10 py-4 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 
                     text-white font-bold text-lg rounded-xl shadow-lg shadow-red-600/40 
                     transition-all duration-300 hover:scale-105 active:scale-95"
        >
          Return Home
        </button>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
      {/* Bankruptcy Modal */}
      <AnimatePresence>
        {showBankruptcyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-3xl max-w-md w-full text-center border border-red-500/50 shadow-2xl"
            >
              <h2 className="text-4xl font-bold text-red-400 mb-6">Bankruptcy Declared!</h2>
              <p className="text-xl text-white mb-8">Game over. Better luck next time!</p>
              <button
                onClick={() => window.location.href = "/"}
                className="px-10 py-5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xl rounded-2xl shadow-xl hover:scale-105 transition-all"
              >
                Return Home
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card Modal — Chance / Community Chest (visible to all players) */}
      <CardModal
        isOpen={showCardModal}
        onClose={() => setShowCardModal(false)}
        card={cardData}
        playerName={cardPlayerName}
      />

      {/* Raised Funds Button */}
      {isRaisingFunds && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[110] w-[80vw] max-w-md"
        >
          <button
            onClick={handleRetryAfterFunds}
            className="w-full py-4 bg-gradient-to-r from-yellow-500 to-amber-600 text-white font-bold text-lg rounded-full shadow-2xl hover:from-yellow-600 hover:to-amber-700 transform hover:scale-105 active:scale-95 transition-all"
          >
            I've Raised Funds — Try Again
          </button>
        </motion.div>
      )}
    </>
  );
};

export default GameModals;