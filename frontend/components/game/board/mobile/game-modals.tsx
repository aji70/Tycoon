import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import { Crown, Trophy, Sparkles, HeartHandshake } from "lucide-react";
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
      {/* Winner / Loser Screen — matches AI modal; backend handles end & winner */}
      <AnimatePresence>
        {winner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[100] p-4 overflow-y-auto"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/90 via-violet-950/60 to-cyan-950/70" />

            {winner.user_id === me?.user_id ? (
              <motion.div
                initial={{ scale: 0.88, y: 24, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className="relative w-full max-w-md rounded-[2rem] overflow-hidden border-2 border-cyan-400/50 bg-gradient-to-b from-indigo-900/95 via-violet-900/90 to-slate-950/95 shadow-2xl shadow-cyan-900/30 text-center"
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.18),transparent)]" />
                <div className="relative z-10 p-8 sm:p-10">
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                    className="mb-6 relative"
                  >
                    <Crown className="w-20 h-20 sm:w-24 sm:h-24 mx-auto text-cyan-300 drop-shadow-[0_0_40px_rgba(34,211,238,0.7)]" />
                    <motion.div
                      className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2"
                      animate={{ opacity: [0.4, 0.8, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Sparkles className="w-6 h-6 text-cyan-400/80" />
                    </motion.div>
                  </motion.div>
                  <motion.h1
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-4xl sm:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-200 to-cyan-300 mb-2"
                  >
                    YOU WIN
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="text-lg text-slate-200 mb-2"
                  >
                    Congratulations — you&apos;re the Tycoon!
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-cyan-200/90 text-base mb-6"
                  >
                    Well played — you earned this one.
                  </motion.p>
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { window.location.href = "/"; }}
                    className="w-full py-4 px-6 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold text-lg shadow-lg shadow-cyan-900/40 border border-cyan-300/40 transition-all"
                  >
                    Go home
                  </motion.button>
                  <p className="text-sm text-slate-500 mt-6">Thanks for playing Tycoon!</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ scale: 0.88, y: 24, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className="relative w-full max-w-md rounded-[2rem] overflow-hidden border-2 border-slate-500/50 bg-gradient-to-b from-slate-900/95 via-slate-800/90 to-black/95 shadow-2xl shadow-slate-900/50 text-center"
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.12),transparent)]" />
                <div className="relative z-10 p-8 sm:p-10">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className="mb-5"
                  >
                    <Trophy className="w-16 h-16 sm:w-20 sm:h-20 mx-auto text-amber-400/90" />
                  </motion.div>
                  <motion.h1
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    className="text-2xl sm:text-3xl font-bold text-slate-200 mb-1"
                  >
                    Game over
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="text-xl font-semibold text-white mb-4"
                  >
                    {winner.username} <span className="text-amber-400">wins</span>
                  </motion.p>
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mb-6 flex flex-col items-center gap-3"
                  >
                    <HeartHandshake className="w-12 h-12 text-cyan-400/80" />
                    <p className="text-slate-300">Better luck next time — you played well!</p>
                  </motion.div>
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { window.location.href = "/"; }}
                    className="w-full py-4 px-6 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-lg shadow-lg shadow-cyan-900/40 border border-cyan-400/30 transition-all"
                  >
                    Go home
                  </motion.button>
                  <p className="text-sm text-slate-500 mt-6">Thanks for playing Tycoon!</p>
                </div>
              </motion.div>
            )}
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

      {/* Card Modal */}
      <AnimatePresence>
        {showCardModal && cardData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4"
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