import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import { Game, Player } from "@/types/game";
import { apiClient } from "@/lib/api";

interface GameModalsProps {
  winner: Player | null;
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
  // endGame,
  // reset,
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

  const handleDeclareBankruptcy = async () => {
    setShowInsolvencyModal(false);
    setIsRaisingFunds(false);
    showToast("Declaring bankruptcy...", "default");

    try {
      // if (endGame) await endGame();

      const opponent = players.find(p => p.user_id !== me?.user_id);
      await apiClient.put(`/games/${currentGame.id}`, {
        status: "FINISHED",
        winner_id: opponent?.user_id || null,
      });

      showToast("Game over! You have declared bankruptcy.", "error");
      setShowBankruptcyModal(true);
    } catch (err) {
      showToast("Failed to end game", "error");
    }
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
        ? "Claiming your prize..."
        : "Finalizing game results..."
    );

    try {
      // await endGame();
      toast.success(
        winner?.user_id === me?.user_id
          ? "Prize claimed! 🎉"
          : "Game completed — thanks for playing!",
        { id: toastId, duration: 5000 }
      );
      setTimeout(() => window.location.href = "/", 1500);
    } catch (err: any) {
      toast.error(
        err?.message || "Something went wrong — you can try again later",
        { id: toastId, duration: 8000 }
      );
    } finally {
      // reset();
    }
  };

  return (
    <>
      {/* Winner Screen */}
      <AnimatePresence>
        {winner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.8, rotate: -5 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className={`p-10 rounded-3xl shadow-2xl text-center max-w-lg w-full border-8 ${
                winner.user_id === me?.user_id
                  ? "bg-gradient-to-br from-yellow-600 to-orange-600 border-yellow-400"
                  : "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-600"
              }`}
            >
              {winner.user_id === me?.user_id ? (
                <>
                  <h1 className="text-5xl font-bold mb-6 drop-shadow-2xl">🏆 YOU WIN! 🏆</h1>
                  <p className="text-3xl font-bold text-white mb-6">Congratulations, Champion!</p>
                  <p className="text-xl text-yellow-200 mb-10">You're the Tycoon of this game!</p>
                </>
              ) : (
                <>
                  <h1 className="text-4xl font-bold mb-6 text-gray-300">Game Over</h1>
                  <p className="text-2xl font-bold text-white mb-6">{winner.username} is the winner!</p>
                  <p className="text-lg text-gray-300 mb-10">Better luck next time — you played well!</p>
                </>
              )}
              <button
                onClick={() => setShowExitPrompt(true)}
                className="px-12 py-5 bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xl md:text-2xl font-bold rounded-2xl shadow-2xl hover:shadow-cyan-500/50 hover:scale-105 transition-all duration-300 border-4 border-white/40"
              >
                {winner.user_id === me?.user_id ? "Claim Rewards" : "Finish Game"}
              </button>
              <p className="text-base text-yellow-200/80 mt-8 opacity-90">Thanks for playing Tycoon!</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exit Prompt */}
      <AnimatePresence>
        {showExitPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-3xl max-w-md w-full text-center border border-cyan-500/30 shadow-2xl"
            >
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-5">One last thing!</h2>
              {winner?.user_id === me?.user_id ? (
                <p className="text-lg md:text-xl text-cyan-300 mb-6">Finalize the game to claim your rewards.</p>
              ) : (
                <p className="text-lg md:text-xl text-gray-300 mb-6">Finalize the game to wrap things up.</p>
              )}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleFinalizeAndLeave}
                  disabled={isPending}
                  className="px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition disabled:opacity-50"
                >
                  {isPending ? "Processing..." : "Yes, Finish Game"}
                </button>
                <button
                  onClick={() => {
                    setShowExitPrompt(false);
                    setTimeout(() => window.location.href = "/", 300);
                  }}
                  className="px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition"
                >
                  Skip & Leave
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Insolvency Modal */}
      <AnimatePresence>
        {showInsolvencyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-3xl max-w-md w-full text-center border border-red-500/50 shadow-2xl"
            >
              <h2 className="text-4xl font-bold text-red-400 mb-6">You're Broke!</h2>
              <p className="text-xl text-white mb-8">
                You owe <span className="text-yellow-400 font-bold">${insolvencyDebt}</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <button
                  onClick={handleRaiseFunds}
                  className="px-10 py-5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xl rounded-2xl shadow-xl hover:scale-105 transition-all"
                >
                  Raise Funds & Retry
                </button>
                <button
                  onClick={handleDeclareBankruptcy}
                  className="px-10 py-5 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold text-xl rounded-2xl shadow-xl hover:scale-105 transition-all"
                >
                  Declare Bankruptcy
                </button>
              </div>
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
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4"
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

      {/* Card Modal */}
      <AnimatePresence>
        {showCardModal && cardData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-3xl max-w-md w-full text-center border border-cyan-500/30 shadow-2xl"
            >
              <h2 className="text-2xl font-bold text-white mb-4">{cardData.type.toUpperCase()} Card</h2>
              <p className="text-lg text-gray-300 mb-4">{cardPlayerName} drew:</p>
              <p className={`text-xl font-bold ${cardData.isGood ? "text-green-400" : "text-red-400"}`}>{cardData.text}</p>
              {cardData.effect && <p className="text-lg text-yellow-400 mt-2">Effect: {cardData.effect}</p>}
              <button
                onClick={() => setShowCardModal(false)}
                className="mt-6 px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Raised Funds Button */}
      {isRaisingFunds && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[65] w-[80vw] max-w-md"
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