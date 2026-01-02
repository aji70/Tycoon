import { motion } from "framer-motion";
import DiceAnimation from "./dice-animation";
import RollResult from "./roll-result";
import ActionLog from "./action-log";

import { Property, Player, Game } from "@/types/game";

type CenterAreaProps = {
  isMyTurn: boolean;
  currentPlayer?: Player;
  playerCanRoll: boolean;
  isInsolvent: boolean;
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
  isInsolvent,
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

      {/* Roll Result */}
      {roll && !isRolling && <RollResult roll={roll} />}

      {/* Game Title */}
      <h1 className="text-4xl lg:text-6xl font-bold text-[#F0F7F7] font-orbitron text-center mb-8 tracking-wider">
        Tycoon
      </h1>

      {/* Main Action Area */}
      {!buyPrompted && (
        <>
          {/* Insolvent State */}
          {isInsolvent ? (
            <button
              onClick={onDeclareBankruptcy}
              disabled={isPending}
              className="px-12 py-6 bg-gradient-to-r from-red-700 to-red-900 text-white text-2xl font-bold rounded-2xl shadow-2xl hover:shadow-red-500/50 hover:scale-105 transition-all duration-300 border-4 border-red-500/50 disabled:opacity-70"
            >
              {isPending ? "Ending Game..." : "💔 Declare Bankruptcy"}
            </button>
          ) : isMyTurn && playerCanRoll && !roll && !isRolling ? (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={onRollDice}
              className="px-10 py-5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black text-3xl rounded-full shadow-2xl"
            >
              ROLL DICE
            </motion.button>
          ) : (
            !isMyTurn && (
              <div className="text-center">
                <p className="text-2xl text-gray-400 animate-pulse mb-2">
                  Waiting for your turn...
                </p>
                <p className="text-3xl text-cyan-300 font-bold">
                  {currentPlayer?.username}'s turn
                </p>
              </div>
            )
          )}
        </>
      )}

      {/* Buy Property Prompt - Inline, clean */}
      {buyPrompted && currentProperty && (
        <div className="flex gap-6 flex-wrap justify-center mt-6">
          <button
            onClick={onBuyProperty}
            disabled={currentProperty.price != null && currentPlayerBalance < currentProperty.price}
            className={`px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-2xl rounded-full shadow-xl transform transition-all ${
              currentProperty.price != null && currentPlayerBalance < currentProperty.price
                ? "opacity-50 cursor-not-allowed"
                : "hover:from-green-400 hover:to-emerald-500 hover:scale-110 active:scale-95"
            }`}
          >
            BUY • ${currentProperty.price?.toLocaleString()}
          </button>
          <button
            onClick={onSkipBuy}
            className="px-8 py-4 bg-gray-600 hover:bg-gray-500 text-white font-bold text-2xl rounded-full shadow-xl transform hover:scale-105 active:scale-95 transition"
          >
            SKIP
          </button>
        </div>
      )}

      {/* Action Log - Naturally at bottom */}
      <div className="mt-8 w-full max-w-3xl ml-52">
        <ActionLog history={history} />
      </div>
    </div>
  );
}