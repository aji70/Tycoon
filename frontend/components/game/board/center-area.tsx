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
    <div className="col-start-2 col-span-9 row-start-2 row-span-9 bg-[#010F10] flex flex-col justify-start items-center p-6 relative overflow-hidden pt-12">

      {/* Dice Animation */}
      <DiceAnimation isRolling={isRolling} roll={roll} />

      {/* Main Content - Elevated */}
      <div className="flex flex-col items-center justify-center z-10 mt-8 lg:mt-12 w-full max-w-2xl">

        {/* Roll Result */}
        {roll && !isRolling && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mt-6 mb-8 z-10"
          >
            <RollResult roll={roll} />
          </motion.div>
        )}

        {/* Game Title */}
        <h1 className="text-4xl lg:text-6xl font-bold text-[#F0F7F7] font-orbitron text-center mb-10 z-10 tracking-wider">
          Tycoon
        </h1>

        {/* MAIN ACTION AREA */}
        <div className="flex flex-col items-center gap-10 z-10 max-w-md">

          {/* INSOLVENT STATE */}
          {isInsolvent && (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center bg-black/60 backdrop-blur-sm rounded-3xl px-8 py-10 border-4 border-red-600/60 shadow-2xl shadow-red-900/40"
            >
              <h2 className="text-5xl lg:text-6xl font-black text-red-500 mb-6 tracking-widest animate-pulse">
                INSOLVENT
              </h2>

              <p className="text-2xl lg:text-3xl font-bold text-red-400 mb-6">
                Balance: ${Math.abs(currentPlayerBalance).toLocaleString()}
                {currentPlayerBalance < 0 && " in debt"}
              </p>

              <p className="text-lg text-gray-300 mb-10 leading-relaxed px-4">
                Click your properties on the board to sell houses or mortgage them.
              </p>

              <div className="flex flex-col gap-5">
                <button
                  onClick={() => {
                    toast.custom(
                      (t) => (
                        <div className="bg-gradient-to-r from-cyan-900/90 to-blue-900/90 border-2 border-cyan-400 rounded-2xl p-6 text-white shadow-2xl">
                          <div className="text-xl font-bold mb-2">Manage Assets</div>
                          <div className="text-base opacity-90">
                            Tap any property you own to:
                            <br />• Sell houses/hotels
                            <br />• Mortgage for cash
                          </div>
                        </div>
                      ),
                      { duration: 7000, position: "top-center" }
                    );
                  }}
                  className="px-8 py-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xl rounded-full shadow-xl transition transform hover:scale-105"
                >
                  MANAGE PROPERTIES
                </button>

                <button
                  onClick={onDeclareBankruptcy}
                  disabled={isPending}
                  className="px-10 py-5 bg-gradient-to-r from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 disabled:opacity-60 text-white font-black text-2xl rounded-full shadow-2xl border-4 border-red-500/70 transition transform hover:scale-105 disabled:scale-100"
                >
                  {isPending ? "ENDING GAME..." : "DECLARE BANKRUPTCY"}
                </button>
              </div>
            </motion.div>
          )}

          {/* NORMAL ROLL DICE - Green & Smaller */}
          {!isInsolvent && playerCanRoll && !roll && !isRolling && !buyPrompted && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={onRollDice}
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-black text-3xl rounded-full shadow-2xl transition transform"
            >
              ROLL DICE
            </motion.button>
          )}

          {/* BUY PROPERTY PROMPT */}
          {!isInsolvent && buyPrompted && currentProperty && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black/50 backdrop-blur-sm rounded-3xl p-8 border border-cyan-500/40 shadow-2xl"
            >
              <p className="text-2xl lg:text-3xl font-bold text-cyan-300 text-center mb-4">
                {currentProperty.name}
              </p>
              <p className="text-xl text-gray-300 text-center mb-8">
                Price: ${currentProperty.price?.toLocaleString()}
              </p>

              <div className="flex gap-6 justify-center">
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

          {/* WAITING FOR TURN */}
          {!isMyTurn && !isInsolvent && (
            <div className="text-center">
              <p className="text-2xl lg:text-3xl text-gray-400 animate-pulse mb-4">
                Waiting for your turn...
              </p>
              {currentPlayer && (
                <p className="text-2xl text-cyan-300 font-bold">
                  {currentPlayer.username}'s turn
                </p>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Action Log - Perfectly Centered Horizontally & Moved Up */}
     <div className=" bottom-24 w-full flex justify-center ml-55 z-10">
  <div className="max-w-3xl w-full">
    <ActionLog history={history} />
  </div>
</div>

    </div>
  );
}