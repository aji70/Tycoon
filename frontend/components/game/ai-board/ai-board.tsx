"use client";

import React from "react";
import { Toaster } from "react-hot-toast";

import { Game, GameProperty, Property, Player } from "@/types/game";

import BoardSquare from "./board-square";
import CenterArea from "./center-area";
import { useAIBoardLogic } from "./useAIBoardLogic";
import { BankruptcyModal } from "../modals/bankruptcy";
import { CardModal } from "../modals/cards";
import { PropertyActionModal } from "../modals/property-action";
import CollectibleInventoryBar from "@/components/collectibles/collectibles-invetory";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";

const AiBoard = ({
  game,
  properties,
  game_properties,
  me,
  onFinishGameByTime,
}: {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  me: Player | null;
  onFinishGameByTime?: () => Promise<void>;
}) => {
  const {
    players,
    gameTimeUp,
    winner,
    showExitPrompt,
    setShowExitPrompt,
    roll,
    isRolling,
    buyPrompted,
    currentPlayerId,
    currentPlayer,
    isMyTurn,
    isAITurn,
    playerCanRoll,
    currentProperty,
    justLandedProperty,
    buyScore,
    handleGameTimeUp,
    handleFinalizeTimeUpAndLeave,
    endGamePending,
    endGameCandidate,
    playersByPosition,
    propertyOwner,
    developmentStage,
    isPropertyMortgaged,
    handleRollDice,
    handleBuyProperty,
    handleSkipBuy,
    handleDeclareBankruptcy,
    handlePropertyClick,
    handleDevelopment,
    handleDowngrade,
    handleMortgage,
    handleUnmortgage,
    selectedProperty,
    setSelectedProperty,
    showPerksModal,
    setShowPerksModal,
    showCardModal,
    setShowCardModal,
    cardData,
    cardPlayerName,
    showBankruptcyModal,
    setShowBankruptcyModal,
    triggerLandingLogic,
    endTurnAfterSpecialMove,
    ROLL_DICE,
    END_TURN,
  } = useAIBoardLogic({ game, properties, game_properties, me, onFinishGameByTime });

  if (!game || !Array.isArray(properties) || properties.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white text-2xl">
        Loading game board...
      </div>
    );
  }

  const togglePerksModal = () => setShowPerksModal((prev) => !prev);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white p-4 flex flex-col lg:flex-row gap-4 items-start justify-center relative">
      <div className="flex justify-center items-start w-full lg:w-2/3 max-w-[800px] mt-[-1rem]">
        <div className="w-full bg-[#010F10] aspect-square rounded-lg relative shadow-2xl shadow-cyan-500/10">
          <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[2px] box-border">
            <CenterArea
              isMyTurn={isMyTurn}
              isAITurn={isAITurn}
              currentPlayer={currentPlayer}
              playerCanRoll={playerCanRoll}
              isRolling={isRolling}
              roll={roll}
              buyPrompted={buyPrompted}
              currentProperty={justLandedProperty || currentProperty}
              currentPlayerBalance={currentPlayer?.balance ?? 0}
              buyScore={buyScore}
              history={game.history ?? []}
              onRollDice={handleRollDice}
              onBuyProperty={handleBuyProperty}
              onSkipBuy={handleSkipBuy}
              onDeclareBankruptcy={handleDeclareBankruptcy}
              isPending={false}
              timerSlot={null}
              gameTimeUp={gameTimeUp}
            />

            {properties.map((square) => {
              const allPlayersHere = playersByPosition.get(square.id) ?? [];
              const playersHere = allPlayersHere;

              return (
                <BoardSquare
                  key={square.id}
                  square={square}
                  playersHere={playersHere}
                  currentPlayerId={currentPlayerId}
                  owner={propertyOwner(square.id)}
                  devLevel={developmentStage(square.id)}
                  mortgaged={isPropertyMortgaged(square.id)}
                  onClick={() => handlePropertyClick(square)}
                />
              );
            })}
          </div>
        </div>
      </div>

         {/* Sparkle Button - Now toggles the modal */}
            <button
              onClick={togglePerksModal}
              className="fixed bottom-20 left-6 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 shadow-2xl shadow-cyan-500/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
            >
              <Sparkles className="w-8 h-8 text-black" />
            </button>
      
            {/* Perks Overlay: Dark backdrop + Corner Perks Panel */}
            <AnimatePresence>
              {showPerksModal && (
                <>
                  {/* Backdrop - covers entire screen */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowPerksModal(false)}
                    className="fixed inset-0 bg-black/70 z-50"
                  />
      
                  {/* Perks Panel - ONLY in bottom-right corner, small and fixed */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 50 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="fixed bottom-6 left-6 z-50 w-80 max-h-[80vh]"
                  >
                    <div >
                      <div className="p-5 border-b border-cyan-900/50 flex items-center justify-between left-6">
                        <h2 className="text-2xl font-bold flex items-center gap-3">
                          <Sparkles className="w-8 h-8 text-[#00F0FF]" />
                          My Perks
                        </h2>
                        <button
                          onClick={() => setShowPerksModal(false)}
                          className="text-gray-400 hover:text-white p-1"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>
                      
                        <CollectibleInventoryBar
                          game={game}
                          game_properties={game_properties}
                          isMyTurn={isMyTurn}
                          ROLL_DICE={ROLL_DICE}
                          END_TURN={END_TURN}
                          triggerSpecialLanding={triggerLandingLogic}
                          endTurnAfterSpecial={endTurnAfterSpecialMove}
                        />
                      
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

      <CardModal
        isOpen={showCardModal}
        onClose={() => setShowCardModal(false)}
        card={cardData}
        playerName={cardPlayerName}
      />

      <BankruptcyModal
        isOpen={showBankruptcyModal}
        tokensAwarded={0.5}
        onReturnHome={() => window.location.href = "/"}
      />

      <PropertyActionModal
        property={selectedProperty}
        onClose={() => setSelectedProperty(null)}
        onDevelop={handleDevelopment}
        onDowngrade={handleDowngrade}
        onMortgage={handleMortgage}
        onUnmortgage={handleUnmortgage}
      />

      {/* Time's up: Winner / Loser modal */}
      <AnimatePresence>
        {winner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4"
          >
            {winner.user_id === me?.user_id ? (
              <motion.div
                initial={{ scale: 0.85, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="relative p-10 md:p-12 rounded-3xl shadow-2xl text-center max-w-lg w-full overflow-hidden border-4 border-amber-400/80 bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-600"
              >
                <div className="relative z-10">
                  <motion.span className="text-6xl md:text-7xl block mb-4" animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 0.6 }}>🏆</motion.span>
                  <h1 className="text-4xl md:text-5xl font-black text-white mb-3 drop-shadow-lg tracking-tight">YOU WIN!</h1>
                  <p className="text-xl md:text-2xl font-bold text-amber-100 mb-2">Congratulations, Champion</p>
                  <p className="text-lg text-amber-200/90 mb-6">Highest net worth when time ran out.</p>
                  <button
                    onClick={() => { window.location.href = "/"; }}
                    className="block w-full px-10 py-4 bg-white text-amber-800 font-bold text-lg rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 active:scale-100 transition-all border-2 border-amber-700/50"
                  >
                    Go home
                  </button>
                  <p className="text-sm text-amber-200/80 mt-6">Thanks for playing Tycoon!</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ scale: 0.85, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="relative p-10 md:p-12 rounded-3xl shadow-2xl text-center max-w-lg w-full overflow-hidden border-4 border-slate-500/60 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800"
              >
                <div className="relative z-10">
                  <span className="text-5xl md:text-6xl block mb-4">⏱️</span>
                  <h1 className="text-3xl md:text-4xl font-bold text-slate-200 mb-3">Game ended</h1>
                  <p className="text-xl font-semibold text-white mb-1">{winner.username} wins by net worth</p>
                  <p className="text-slate-400 mb-6">You still get a consolation prize for playing.</p>
                  <button
                    onClick={() => { window.location.href = "/"; }}
                    className="block w-full px-10 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-lg rounded-2xl shadow-xl hover:shadow-cyan-500/30 hover:scale-105 active:scale-100 transition-all border border-cyan-400/40"
                  >
                    Go home
                  </button>
                  <p className="text-sm text-slate-500 mt-6">Thanks for playing Tycoon!</p>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {showExitPrompt && winner && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-3xl max-w-md w-full text-center border border-cyan-500/30 shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-white mb-5">One last step</h2>
            <p className="text-lg text-gray-300 mb-6">
              {winner.user_id === me?.user_id
                ? "End the game on the blockchain to claim your rewards."
                : "End the game on the blockchain to collect your consolation prize."}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleFinalizeTimeUpAndLeave}
                disabled={endGamePending}
                className="px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition disabled:opacity-50"
              >
                {endGamePending ? "Processing..." : "Yes, end game"}
              </button>
              <button
                onClick={() => setShowExitPrompt(false)}
                className="px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition"
              >
                Back
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <Toaster
        position="top-center"
        reverseOrder={false}
        gutter={12}
        containerClassName="z-50"
        toastOptions={{
          duration: 3200,
          style: {
            background: "rgba(15, 23, 42, 0.95)",
            color: "#fff",
            border: "1px solid rgba(34, 211, 238, 0.3)",
            borderRadius: "12px",
            padding: "12px 20px",
            fontSize: "16px",
            fontWeight: "600",
            boxShadow: "0 10px 30px rgba(0, 255, 255, 0.15)",
            backdropFilter: "blur(10px)",
          },
          success: { icon: "✔", style: { borderColor: "#10b981" } },
          error: { icon: "✖", style: { borderColor: "#ef4444" } },
        }}
      />
    </div>
  );
};

export default AiBoard;