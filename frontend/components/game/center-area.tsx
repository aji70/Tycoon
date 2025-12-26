import { motion } from "framer-motion";
import DiceAnimation from "./dice-animation";
import RollResult from "./roll-result";
import ActionLog from "./action-log";

import { Property, Player, Game } from "@/types/game";

type CenterAreaProps = {
  isMyTurn: boolean;
  isAITurn: boolean;
  currentPlayer?: Player;
  playerCanRoll: boolean;
  isRolling: boolean;
  roll: { die1: number; die2: number; total: number } | null;
  buyPrompted: boolean;
  currentProperty: Property | null | undefined;
  currentPlayerBalance: number;
  buyScore: number | null;
  history: Game["history"];
  onRollDice: () => void;
  onBuyProperty: () => void;
  onSkipBuy: () => void;
  onDeclareBankruptcy: () => void;
  isPending: boolean;
};

export default function CenterArea({
  isMyTurn,
  isAITurn,
  currentPlayer,
  playerCanRoll,
  isRolling,
  roll,
  buyPrompted,
  currentProperty,
  currentPlayerBalance,
  buyScore,
  history,
  onRollDice,
  onBuyProperty,
  onSkipBuy,
  onDeclareBankruptcy,
  isPending,
}: CenterAreaProps) {
  const canAffordProperty =
    currentProperty?.price != null && currentPlayerBalance >= currentProperty.price;

  return (
    <div className="col-start-2 col-span-9 row-start-2 row-span-9 bg-[#010F10] flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Dice Animation */}
      <DiceAnimation isRolling={isRolling} roll={roll} />

      {/* Roll Result */}
      {roll && !isRolling && <RollResult roll={roll} />}

      {/* Game Title */}
      <h1 className="text-4xl lg:text-6xl font-bold text-[#F0F7F7] font-orbitron text-center mb-8 z-10 tracking-wider">
        Tycoon
      </h1>

      {/* Player's Turn: Roll or Bankruptcy */}
      {isMyTurn && !roll && !isRolling && (
        <div className="flex flex-col items-center gap-8">
          {playerCanRoll ? (
            <motion.button
              onClick={onRollDice}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="px-10 py-5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-2xl rounded-full shadow-2xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300"
            >
              Roll Dice
            </motion.button>
          ) : (
            <motion.button
              onClick={onDeclareBankruptcy}
              disabled={isPending}
              whileHover={{ scale: isPending ? 1 : 1.05 }}
              whileTap={{ scale: isPending ? 1 : 0.95 }}
              className="px-14 py-7 bg-gradient-to-r from-red-700 to-red-900 text-white text-3xl font-bold rounded-3xl shadow-2xl border-4 border-red-500/50 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-300"
            >
              {isPending ? "Ending Game..." : "💔 Declare Bankruptcy"}
            </motion.button>
          )}
        </div>
      )}

      {/* Buy Property Prompt */}
      {isMyTurn && buyPrompted && currentProperty && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-6 flex-wrap justify-center mt-6"
        >
          <button
            onClick={onBuyProperty}
            disabled={!canAffordProperty}
            className={`px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-xl rounded-full shadow-xl transition-all duration-300 ${
              !canAffordProperty
                ? "opacity-50 cursor-not-allowed"
                : "hover:from-green-600 hover:to-emerald-700 hover:scale-110 active:scale-95"
            }`}
          >
            Buy for ${currentProperty.price}
          </button>

          <button
            onClick={onSkipBuy}
            className="px-8 py-4 bg-gray-600 text-white font-bold text-xl rounded-full shadow-xl hover:bg-gray-700 hover:scale-105 active:scale-95 transition-all duration-300"
          >
            Skip
          </button>
        </motion.div>
      )}

      {/* AI Turn Indicator */}
      {isAITurn && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center z-10 space-y-4"
        >
          <motion.h2
            className="text-3xl font-bold text-pink-300"
            animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.06, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            {currentPlayer?.username || "AI"} is thinking…
          </motion.h2>

          {buyPrompted && buyScore !== null && (
            <p className="text-xl text-yellow-300 font-bold">
              Buy Confidence: {buyScore}%
            </p>
          )}

          <div className="flex justify-center my-6">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-cyan-400"></div>
          </div>

          <p className="text-pink-200 text-base italic">
            Smart AI • Deciding automatically
          </p>
        </motion.div>
      )}

      {/* Persistent Quit Button - Always visible, top-right */}
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={onDeclareBankruptcy}
          disabled={isPending}
          className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 rounded-lg shadow-lg hover:bg-red-700 active:scale-95 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <span>Quit Game</span>
        </button>
      </div>

      {/* Action Log at the bottom */}
      <div className="absolute bottom-4 left-4 right-4 z-10">
        <ActionLog history={history} />
      </div>
    </div>
  );
}