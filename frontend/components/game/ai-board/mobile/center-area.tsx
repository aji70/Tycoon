"use client";

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
  return (
    <div className="col-start-2 col-span-9 row-start-2 row-span-9 bg-[#010F10] flex flex-col items-center justify-center p-3 sm:p-4 relative overflow-hidden">
      {/* Dice + Result - smaller vertical space */}
      <div className="mb-3 sm:mb-5">
        <DiceAnimation isRolling={isRolling} roll={roll} />
        {roll && !isRolling && <RollResult roll={roll} />}
      </div>

      {/* Title - smaller */}
      <h1 className="text-2xl sm:text-4xl font-bold text-[#F0F7F7] font-orbitron text-center mb-4 sm:mb-6 z-10">
        Tycoon
      </h1>

      {/* Main Action Area - compact buttons */}
      <div className="flex flex-col items-center gap-4 sm:gap-6 w-full max-w-xs">
        {/* My Turn: Roll or Bankruptcy */}
        {isMyTurn && !roll && !isRolling && (
          playerCanRoll ? (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onRollDice}
              className="w-full py-3 px-10 bg-gradient-to-r from-green-600 to-emerald-700 text-white font-bold text-lg rounded-full hover:from-green-500 hover:to-emerald-600 shadow-lg active:scale-95 transition-all"
            >
              Roll Dice 🎲
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onDeclareBankruptcy}
              disabled={isPending}
              className="w-full py-3 px-8 bg-gradient-to-r from-red-700 to-rose-900 text-white font-bold text-lg rounded-full shadow-lg hover:shadow-red-600/50 active:scale-95 transition-all disabled:opacity-60"
            >
              {isPending ? "Ending..." : "💔 Bankruptcy"}
            </motion.button>
          )
        )}

        {/* Buy Prompt - smaller buttons */}
        {isMyTurn && buyPrompted && currentProperty && currentProperty.price != null && (
          <div className="flex flex-row gap-3 w-full">
            <button
              onClick={onBuyProperty}
              disabled={currentPlayerBalance < currentProperty.price}
              className={`flex-1 py-3 px-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold text-base rounded-xl shadow-md hover:from-emerald-500 hover:to-teal-600 active:scale-95 transition-all disabled:opacity-50 ${
                currentPlayerBalance < currentProperty.price ? "cursor-not-allowed" : ""
              }`}
            >
              Buy ${currentProperty.price}
            </button>
            <button
              onClick={onSkipBuy}
              className="flex-1 py-3 px-5 bg-gray-700 hover:bg-gray-600 text-white font-bold text-base rounded-xl shadow-md active:scale-95 transition-all"
            >
              Skip
            </button>
          </div>
        )}

        {/* AI Turn Indicator - more compact */}
        {isAITurn && (
          <div className="text-center mt-4">
            <motion.h2
              className="text-xl sm:text-2xl font-bold text-pink-300 mb-2"
              animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.03, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            >
              {currentPlayer?.username} thinking…
            </motion.h2>

            {buyPrompted && buyScore !== null && (
              <p className="text-base text-yellow-300 font-semibold">
                Buy: {buyScore}%
              </p>
            )}

            <div className="flex justify-center mt-3">
              <div className="animate-spin rounded-full h-8 w-8 border-t-4 border-b-4 border-cyan-400"></div>
            </div>
          </div>
        )}
      </div>

      {/* Quit Button - smaller & top-right */}
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-50">
        <button
          onClick={onDeclareBankruptcy}
          disabled={isPending}
          className="px-3 py-1.5 text-xs sm:text-sm font-bold bg-red-700 hover:bg-red-800 text-white rounded shadow-md active:scale-95 transition-all disabled:opacity-60"
        >
          {isPending ? "..." : "Quit"}
        </button>
      </div>

      {/* Action Log - pushed to bottom with minimal space */}
      <div className="w-full mt-auto pt-4 pb-2">
        <ActionLog history={history} />
      </div>
    </div>
  );
}