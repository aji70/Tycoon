import { motion } from "framer-motion";
import DiceAnimation from "./dice-animation";
import RollResult from "./roll-result";
import ActionLog from "./action-log";
import { toast } from "react-hot-toast";

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

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center z-10 -mt-48 lg:-mt-52 w-full max-w-2xl">

        {/* Roll Result - Above Title */}
        {roll && !isRolling && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-8"
          >
            <RollResult roll={roll} />
          </motion.div>
        )}

        {/* Game Title */}
        <h1 className="text-3xl lg:text-5xl font-bold text-[#F0F7F7] font-orbitron text-center mb-12">
          Tycoon
        </h1>

        {/* MAIN ACTION AREA */}

        {/* 1. INSOLVENT STATE: Balance ≤ 0 */}
        {isInsolvent && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="text-center px-6 py-10 bg-black/50 rounded-3xl border-4 border-red-600/70 shadow-2xl shadow-red-900/50 max-w-lg"
          >
            <h2 className="text-5xl lg:text-6xl font-black text-red-500 mb-6 tracking-wider animate-pulse">
              INSOLVENT
            </h2>

            <p className="text-3xl font-bold text-red-400 mb-4">
              Balance: ${Math.abs(currentPlayerBalance).toLocaleString()}
              {currentPlayerBalance < 0 && " in debt"}
            </p>

            <p className="text-lg lg:text-xl text-gray-300 mb-10 leading-relaxed">
              You cannot roll the dice until you raise funds.
              <br />
              <strong>Click your properties on the board</strong> to sell houses or mortgage them.
            </p>

            <div className="flex flex-col gap-6 items-center">

              {/* Hint Button */}
              <button
                onClick={() => {
                  toast.custom(
                    (t) => (
                      <div className="bg-gradient-to-r from-cyan-900 to-blue-900 border-2 border-cyan-400 rounded-2xl p-6 text-white shadow-2xl max-w-sm">
                        <div className="text-2xl mb-3">Manage Your Assets</div>
                        <div className="text-lg opacity-90">
                          Click any property you own on the board to:
                          <br />• Sell houses/hotels
                          <br />• Mortgage properties
                        </div>
                      </div>
                    ),
                    { duration: 6000, position: "top-center" }
                  );
                }}
                className="px-10 py-5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black text-2xl rounded-2xl shadow-xl transition transform hover:scale-105"
              >
                MANAGE PROPERTIES
              </button>

              {/* Declare Bankruptcy */}
              <button
                onClick={onDeclareBankruptcy}
                disabled={isPending}
                className="px-12 py-7 bg-gradient-to-r from-red-800 to-red-900 hover:from-red-700 hover:to-red-800 disabled:from-gray-800 disabled:to-gray-900 text-white font-black text-3xl lg:text-4xl rounded-2xl shadow-2xl border-4 border-red-500 transition transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed"
              >
                {isPending ? "PROCESSING..." : "DECLARE BANKRUPTCY"}
              </button>

            </div>
          </motion.div>
        )}

        {/* 2. NORMAL ROLL DICE */}
        {!isInsolvent && playerCanRoll && !roll && !isRolling && !buyPrompted && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onRollDice}
            className="px-12 py-8 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-4xl lg:text-5xl rounded-3xl shadow-2xl transition transform"
          >
            ROLL DICE
          </motion.button>
        )}

        {/* 3. BUY PROPERTY PROMPT */}
        {!isInsolvent && buyPrompted && currentProperty && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex flex-col sm:flex-row gap-6 items-center mt-8 bg-black/40 rounded-3xl p-8 border border-cyan-500/50"
          >
            <div className="text-center mb-4 sm:mb-0">
              <p className="text-2xl font-bold text-cyan-300 mb-2">
                {currentProperty.name}
              </p>
              <p className="text-xl text-gray-300">
                Price: ${currentProperty.price?.toLocaleString()}
              </p>
            </div>

            <div className="flex gap-5">
              <button
                onClick={onBuyProperty}
                disabled={currentProperty.price != null && currentPlayerBalance < currentProperty.price}
                className={`px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-xl rounded-full shadow-xl transition transform hover:scale-110 active:scale-95 ${
                  currentProperty.price != null && currentPlayerBalance < currentProperty.price
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:from-green-600 hover:to-emerald-700"
                }`}
              >
                BUY
              </button>

              <button
                onClick={onSkipBuy}
                className="px-8 py-4 bg-gray-600 hover:bg-gray-700 text-white font-bold text-xl rounded-full shadow-xl transition transform hover:scale-105 active:scale-95"
              >
                SKIP
              </button>
            </div>
          </motion.div>
        )}

        {/* 4. WAITING FOR TURN */}
        {!isMyTurn && !isInsolvent && (
          <div className="text-center">
            <p className="text-3xl text-gray-400 animate-pulse">
              Waiting for your turn...
            </p>
            {currentPlayer && (
              <p className="text-2xl text-cyan-400 mt-6 font-bold">
                {currentPlayer.username}'s turn
              </p>
            )}
          </div>
        )}

      </div>

      {/* Action Log at Bottom */}
      <div className="absolute bottom-4 left-4 right-4 z-10 max-w-2xl mx-auto">
        <ActionLog history={history} />
      </div>
    </div>
  );
}