import { motion } from "framer-motion";
import DiceAnimation from "./dice-animation";
import RollResult from "./roll-result";
import ActionLog from "./action-log";

import { Property, Player, Game } from "@/types/game";

// center-area.tsx

type CenterAreaProps = {
  isMyTurn: boolean;
  isAITurn: boolean;                      // ← keep boolean
  currentPlayer?: Player;                 // ← optional is fine
  playerCanRoll: boolean;                 // ← keep boolean
  isRolling: boolean;
  roll: { die1: number; die2: number; total: number } | null;
  buyPrompted: boolean;
  currentProperty: Property | null | undefined;  // ← most accurate
  currentPlayerBalance: number;           // ← we'll guarantee non-null with ?? 0
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
  return (
    <div className="col-start-2 col-span-9 row-start-2 row-span-9 bg-[#010F10] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      <DiceAnimation isRolling={isRolling} roll={roll} />

      {roll && !isRolling && <RollResult roll={roll} />}

      <h1 className="text-3xl lg:text-5xl font-bold text-[#F0F7F7] font-orbitron text-center mb-6 z-10">
        Tycoon
      </h1>

      {isMyTurn && !roll && !isRolling && (
        playerCanRoll ? (
          <button
            onClick={onRollDice}
            className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-xl rounded-full hover:from-green-600 hover:to-emerald-700 transform hover:scale-110 active:scale-95 transition-all shadow-xl"
          >
            Roll Dice
          </button>
        ) : (
          <button
            onClick={onDeclareBankruptcy}
            disabled={isPending}
            className="px-12 py-6 bg-gradient-to-r from-red-700 to-red-900 text-white text-2xl font-bold rounded-2xl shadow-2xl hover:shadow-red-500/50 hover:scale-105 transition-all duration-300 border-4 border-red-500/50 disabled:opacity-70"
          >
            {isPending ? "Ending Game..." : "💔 Declare Bankruptcy"}
          </button>
        )
      )}

      {isMyTurn && buyPrompted && currentProperty && (
        <div className="flex gap-4 flex-wrap justify-center mt-4">
          <button
            onClick={onBuyProperty}
            disabled={currentProperty.price != null && currentPlayerBalance < currentProperty.price}
            className={`px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-full hover:from-green-600 hover:to-emerald-700 transform hover:scale-110 active:scale-95 transition-all shadow-lg ${
              currentProperty.price != null && currentPlayerBalance < currentProperty.price
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
          >
            Buy for ${currentProperty.price}
          </button>
          <button
            onClick={onSkipBuy}
            className="px-6 py-3 bg-gray-600 text-white font-bold rounded-full hover:bg-gray-700 transform hover:scale-105 active:scale-95 transition-all shadow-lg"
          >
            Skip
          </button>
        </div>
      )}

      {isAITurn && (
        <div className="mt-5 text-center z-10">
          <motion.h2
            className="text-2xl font-bold text-pink-300 mb-3"
            animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.05, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            {currentPlayer?.username} is playing…
          </motion.h2>
          {buyPrompted && buyScore !== null && (
            <p className="text-lg text-yellow-300 font-bold">
              Buy Confidence: {buyScore}%
            </p>
          )}
          <div className="flex justify-center mt-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-cyan-400"></div>
          </div>
          <p className="text-pink-200 text-sm italic mt-3">
            Smart AI • Decides automatically
          </p>
        </div>
      )}

      <ActionLog history={history} />
    </div>
  );
}