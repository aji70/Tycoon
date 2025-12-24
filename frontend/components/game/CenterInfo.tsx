"use client";

import { motion } from "framer-motion";
import DiceAnimation  from "./DiceAnimation";
import { RollResult } from "@/hooks/useDiceRoll"; // Assuming this is exported from useDiceRoll.ts
import { Property, Player } from "@/types/game"; // Adjust import based on your types
import { toast } from "react-hot-toast";

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
  }>; // Adjust this type based on your actual history shape
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
  // Helper to check if player can afford the property
  const canAfford =
    currentProperty?.price != null &&
    currentPlayer?.balance != null &&
    currentPlayer.balance >= currentProperty.price;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-10 pointer-events-none">
      {/* Dice Animation Overlay */}
      <DiceAnimation isRolling={dice.isRolling} roll={dice.roll} />

      {/* Roll Result Display */}
      {dice.roll && !dice.isRolling && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-6 text-7xl font-bold mb-8 pointer-events-none"
        >
          <span className="text-cyan-400 drop-shadow-2xl">{dice.roll.die1}</span>
          <span className="text-white text-6xl">+</span>
          <span className="text-pink-400 drop-shadow-2xl">{dice.roll.die2}</span>
          <span className="text-white mx-4 text-6xl">=</span>
          <span className="text-yellow-400 text-9xl drop-shadow-2xl">{dice.roll.total}</span>
        </motion.div>
      )}

      {/* Game Title */}
      <h1 className="text-4xl lg:text-6xl font-bold text-[#F0F7F7] font-orbitron text-center mb-8 z-20 pointer-events-none">
        Tycoon
      </h1>

      {/* Main Action Area */}
      <div className="flex flex-col items-center gap-6">
        {/* Roll / Bankruptcy Button */}
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

        {/* Buy Prompt - Human Player Only */}
        {isMyTurn && buyPrompted && currentProperty && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex flex-wrap gap-4 justify-center mt-6 pointer-events-auto"
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

        {/* AI Turn Indicator */}
        {isAITurn && (
          <div className="mt-8 text-center pointer-events-none">
            <motion.h2
              className="text-3xl font-bold text-pink-300 mb-4"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              {currentPlayerUsername || "AI Player"} is thinking…
            </motion.h2>

            {buyPrompted && buyScore !== null && (
              <p className="text-xl text-yellow-300 font-bold mb-4">
                Buy Confidence: {buyScore}%
              </p>
            )}

            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-cyan-400 border-opacity-70" />
            </div>

            <p className="text-sm text-pink-200 mt-4 italic">
              Smart AI • Deciding automatically
            </p>
          </div>
        )}
      </div>

      {/* Action Log */}
      <div className="mt-auto w-full max-w-lg mb-8">
        <div className="bg-gray-900/85 backdrop-blur-md rounded-xl border border-cyan-500/30 shadow-2xl overflow-hidden pointer-events-auto">
          <div className="p-3 border-b border-cyan-500/20 bg-gray-800/70">
            <h3 className="text-sm font-bold text-cyan-300 tracking-wider uppercase">
              Action Log
            </h3>
          </div>

          <div className="h-48 overflow-y-auto p-3 space-y-2 text-sm scrollbar-thin scrollbar-thumb-cyan-600 scrollbar-track-gray-800">
            {actionLog.length === 0 ? (
              <p className="text-center text-gray-500 italic py-8">
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
                  {entry.rolled && (
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