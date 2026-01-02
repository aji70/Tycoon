import { motion } from "framer-motion";
import DiceAnimation from "./dice-animation";
import RollResult from "./roll-result";
import ActionLog from "./action-log";

import { Property, Player, Game } from "@/types/game";

type CenterAreaProps = {
  isMyTurn: boolean;
  currentPlayer?: Player;
  playerCanRoll: boolean;
  isBankruptTurn: boolean;
  isRolling: boolean;
  roll: { die1: number; die2: number; total: number } | null;
  buyPrompted: boolean;
  currentProperty: Property | null | undefined;
  currentPlayerBalance: number;
  history: Game["history"];
  onRollDice: () => void;
  onBuyProperty: () => void;
  onSkipBuy: () => void;
  onDeclareBankruptcy: () => void;
  isPending: boolean;
};

export default function CenterArea({
  isMyTurn,
  currentPlayer,
  playerCanRoll,
  isBankruptTurn,
  isRolling,
  roll,
  buyPrompted,
  currentProperty,
  currentPlayerBalance,
  history,
  onRollDice,
  onBuyProperty,
  onSkipBuy,
  onDeclareBankruptcy,
  isPending,
}: CenterAreaProps) {
  return (
    <div className="col-start-2 col-span-9 row-start-2 row-span-9 bg-[#010F10] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Dice Animation */}
      <DiceAnimation isRolling={isRolling} roll={roll} />

      {/* Main Content: Shifted up and structured with roll result on top */}
      <div className="flex flex-col items-center justify-center z-10 -mt-48 lg:-mt-52">
        {/* Roll Result - NOW ABOVE Tycoon */}
        {roll && !isRolling && (
          <div className="mb-8">
            <RollResult roll={roll} />
          </div>
        )}

        {/* Game Title */}
        <h1 className="text-3xl lg:text-5xl font-bold text-[#F0F7F7] font-orbitron text-center mb-12">
          Tycoon
        </h1>

        {/* MAIN ACTION AREA */}

        {/* 1. Player is bankrupt → Show Declare Bankruptcy button */}
        {isMyTurn && isBankruptTurn && !roll && !isRolling && (
          <button
            onClick={onDeclareBankruptcy}
            disabled={isPending}
            className="px-12 py-6 bg-gradient-to-r from-red-700 to-red-900 text-white text-2xl font-bold rounded-2xl shadow-2xl hover:shadow-red-500/50 hover:scale-105 transition-all duration-300 border-4 border-red-500/50 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isPending ? "Processing..." : "💔 Declare Bankruptcy"}
          </button>
        )}

        {/* 2. Normal turn: Show Roll Dice */}
        {isMyTurn && !isBankruptTurn && !roll && !isRolling && !buyPrompted && playerCanRoll && (
          <button
            onClick={onRollDice}
            className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-xl rounded-full hover:from-green-600 hover:to-emerald-700 transform hover:scale-110 active:scale-95 transition-all shadow-xl"
          >
            Roll Dice
          </button>
        )}

        {/* 3. Buy Property Prompt */}
        {isMyTurn && buyPrompted && currentProperty && (
          <div className="flex gap-4 flex-wrap justify-center mt-6">
            <button
              onClick={onBuyProperty}
              disabled={currentProperty.price != null && currentPlayerBalance < currentProperty.price}
              className={`px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-full hover:from-green-600 hover:to-emerald-700 transform hover:scale-110 active:scale-95 transition-all shadow-lg ${
                currentProperty.price != null && currentPlayerBalance < currentProperty.price
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
            >
              Buy for ${currentProperty.price?.toLocaleString()}
            </button>
            <button
              onClick={onSkipBuy}
              className="px-6 py-3 bg-gray-600 text-white font-bold rounded-full hover:bg-gray-700 transform hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              Skip
            </button>
          </div>
        )}
      </div>

      {/* Action Log at the bottom */}
      <div className="absolute bottom-4 left-4 right-4 z-10 w-5/6 max-w-md mx-auto">
        <ActionLog history={history} />
      </div>
    </div>
  );
}