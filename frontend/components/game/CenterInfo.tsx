"use client";

import { motion } from "framer-motion";
import DiceAnimation from "./DiceAnimation";
import { RollResult } from "@/hooks/useDiceRoll";
import { Property, Player } from "@/types/game";

type CenterInfoProps = {
  isMyTurn: boolean;
  isAITurn: boolean;
  currentPlayer: Player | undefined;
  dice: {
    roll: RollResult | null;
    isRolling: boolean;
  };
  currentProperty: Property | null;
  buyPrompted: boolean;
  buyScore: number | null;
  playerCanRoll: boolean;
  onRoll: () => void;
  onBuy: () => void;
  onSkipBuy: () => void;
  onEndTurn: () => void;
  onBankruptcy: () => void;
  actionLog: Array<{
    player_name: string;
    comment: string;
    rolled?: number;
  }>;
  currentPlayerUsername?: string;
};

export default function CenterInfo({
  isMyTurn,
  isAITurn,
  currentPlayer,
  dice,
  currentProperty,
  buyPrompted,
  buyScore,
  playerCanRoll,
  onRoll,
  onBuy,
  onSkipBuy,
  onEndTurn,
  onBankruptcy,
  actionLog,
  currentPlayerUsername,
}: CenterInfoProps) {
  const canAfford =
    currentProperty?.price != null &&
    currentPlayer?.balance != null &&
    currentPlayer.balance >= currentProperty.price;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-between py-6 px-4 z-10 pointer-events-none gap-4">
      {/* Top section: Dice + Result + Title */}
      <div className="flex flex-col items-center gap-3">
        <DiceAnimation isRolling={dice.isRolling} roll={dice.roll} />

        {dice.roll && !dice.isRolling && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-5 text-6xl lg:text-7xl font-bold pointer-events-none"
          >
            <span className="text-cyan-400 drop-shadow-2xl">{dice.roll.die1}</span>
            <span className="text-white text-5xl">+</span>
            <span className="text-pink-400 drop-shadow-2xl">{dice.roll.die2}</span>
            <span className="text-white mx-3 text-5xl">=</span>
            <span className="text-yellow-400 text-8xl drop-shadow-2xl">{dice.roll.total}</span>
          </motion.div>
        )}

        <h1 className="text-4xl lg:text-5xl font-bold text-[#F0F7F7] font-orbitron text-center">
          Tycoon
        </h1>
      </div>

      {/* Middle: Buttons & AI thinking */}
      <div className="flex flex-col items-center gap-5">
        {isMyTurn && !dice.roll && !dice.isRolling && (
          <div className="pointer-events-auto">
            {playerCanRoll ? (
              <button
                onClick={onRoll}
                disabled={dice.isRolling}
                className={`
                  px-10 py-5 text-xl font-bold rounded-full shadow-xl transform transition-all
                  bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700
                  hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                Roll Dice
              </button>
            ) : (
              <button
                onClick={onBankruptcy}
                className={`
                  px-12 py-6 text-2xl font-bold rounded-2xl shadow-2xl transform transition-all
                  bg-gradient-to-r from-red-700 to-red-900 hover:from-red-800 hover:to-red-950
                  hover:scale-105 active:scale-95 border-4 border-red-500/50
                `}
              >
                💔 Declare Bankruptcy
              </button>
            )}
          </div>
        )}

        {isMyTurn && buyPrompted && currentProperty && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex flex-wrap gap-4 justify-center pointer-events-auto"
          >
            <button
              onClick={onBuy}
              disabled={!canAfford}
              className={`
                px-8 py-4 text-lg font-bold rounded-full shadow-lg transition-all
                bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700
                hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              Buy for ${currentProperty.price?.toLocaleString()}
            </button>
            <button
              onClick={onSkipBuy}
              className={`
                px-8 py-4 text-lg font-bold rounded-full shadow-lg transition-all
                bg-gray-600 hover:bg-gray-700 hover:scale-105 active:scale-95
              `}
            >
              Skip
            </button>
          </motion.div>
        )}

        {isAITurn && (
          <div className="text-center pointer-events-none">
            <motion.h2
              className="text-2xl lg:text-3xl font-bold text-pink-300 mb-3"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              {currentPlayerUsername || "AI Player"} is thinking…
            </motion.h2>

            {buyPrompted && buyScore !== null && (
              <p className="text-lg text-yellow-300 font-bold mb-3">
                Buy Confidence: {buyScore}%
              </p>
            )}

            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-cyan-400 border-opacity-70" />
            </div>
          </div>
        )}
      </div>

      {/* Bottom: Action Log */}
      <div className="w-full max-w-lg mt-auto">
        <div className="bg-gray-900/85 backdrop-blur-md rounded-xl border border-cyan-500/30 shadow-2xl overflow-hidden pointer-events-auto">
          <div className="p-3 border-b border-cyan-500/20 bg-gray-800/70">
            <h3 className="text-sm font-bold text-cyan-300 tracking-wider uppercase">
              Action Log
            </h3>
          </div>

          <div className="h-48 overflow-y-auto p-3 space-y-2 text-sm scrollbar-thin scrollbar-thumb-cyan-600 scrollbar-track-gray-800">
            {actionLog.length === 0 ? (
              <p className="text-center text-gray-500 italic py-6">
                No actions yet...
              </p>
            ) : (
              actionLog.map((entry, index) => (
                <motion.p
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="text-gray-200"
                >
                  <span className="font-medium text-cyan-300">{entry.player_name}</span>{" "}
                  {entry.comment}
                  {entry.rolled !== undefined && (
                    <span className="ml-2 text-cyan-400 font-bold">
                      [Rolled {entry.rolled}]
                    </span>
                  )}
                </motion.p>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}