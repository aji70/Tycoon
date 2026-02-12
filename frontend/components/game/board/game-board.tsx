"use client";

import React from "react";
import { Toaster } from "react-hot-toast";
import { Game, GameProperty, Property, Player } from "@/types/game";
import BoardSquare from "./board-square";
import CenterArea from "./center-area";
import { BankruptcyModal } from "../modals/bankruptcy";
import { CardModal } from "../modals/cards";
import CollectibleInventoryBar from "@/components/collectibles/collectibles-invetory";
import { GameDurationCountdown } from "../GameDurationCountdown";
import { Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PropertyActionModal } from "../modals/property-action";
import { useGameBoardLogic } from "./useGameBoardLogic";
import PropertyDetailModal from "./PropertyDetailModal";

const Board = ({
  game,
  properties,
  game_properties,
  me,
  onGameUpdated,
}: {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  me: Player | null;
  onGameUpdated?: () => void;
}) => {
  const logic = useGameBoardLogic({ game, properties, game_properties, me, onGameUpdated });

  const {
    roll,
    isRolling,
    buyPrompted,
    animatedPositions,
    showPerksModal,
    setShowPerksModal,
    showCardModal,
    setShowCardModal,
    cardData,
    cardPlayerName,
    selectedProperty,
    setSelectedProperty,
    showBankruptcyModal,
    setShowBankruptcyModal,
    currentPlayerId,
    currentPlayer,
    isMyTurn,
    playerCanRoll,
    currentProperty,
    justLandedProperty,
    players,
    playersByPosition,
    propertyOwner,
    developmentStage,
    isPropertyMortgaged,
    handleRollDice,
    handleBuyProperty,
    handleSkipBuy,
    handleBankruptcy,
    handleDevelopment,
    handleDowngrade,
    handleMortgage,
    handleUnmortgage,
    handlePropertyClick,
    getCurrentRent,
    ROLL_DICE,
    END_TURN,
    triggerLandingLogic,
    endTurnAfterSpecialMove,
    turnTimeLeft,
    removeInactive,
  } = logic;

  if (!game || !Array.isArray(properties) || properties.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white text-2xl">
        Loading game board...
      </div>
    );
  }

  const togglePerksModal = () => setShowPerksModal((prev: boolean) => !prev);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white p-4 flex flex-col lg:flex-row gap-4 items-start justify-center relative">
      <div className="flex justify-center items-start w-full lg:w-2/3 max-w-[800px] mt-[-1rem]">
        <div className="w-full bg-[#010F10] aspect-square rounded-lg relative shadow-2xl shadow-cyan-500/10">
          <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[2px] box-border">
            <CenterArea
              isMyTurn={isMyTurn}
              playerCanRoll={playerCanRoll}
              isRolling={isRolling}
              roll={roll}
              currentPlayer={currentPlayer}
              buyPrompted={buyPrompted}
              currentProperty={justLandedProperty || currentProperty}
              currentPlayerBalance={currentPlayer?.balance ?? 0}
              history={game.history ?? []}
              onRollDice={handleRollDice}
              onBuyProperty={handleBuyProperty}
              onSkipBuy={handleSkipBuy}
              onDeclareBankruptcy={() => setShowBankruptcyModal(true)}
              isPending={false}
              timerSlot={game?.duration && Number(game.duration) > 0 ? <GameDurationCountdown game={game} /> : null}
              turnTimeLeft={turnTimeLeft}
              removablePlayers={players.filter((p: Player) => p.user_id !== me?.user_id && (p.consecutive_timeouts ?? 0) >= 3)}
              onRemoveInactive={removeInactive}
            />

            {properties.map((square) => {
              const playersHere = playersByPosition.get(square.id) ?? [];

              // Sort: connected player (by address) on top (rendered last)
              const sortedPlayersHere = [...playersHere].sort((a, b) => {
                const aIsMe = me?.address && a.address?.toLowerCase() === me.address.toLowerCase();
                const bIsMe = me?.address && b.address?.toLowerCase() === me.address.toLowerCase();

                if (aIsMe) return 1;   // me → last (on top)
                if (bIsMe) return -1;  // other → before me
                return 0;
              });

              const playerCount = sortedPlayersHere.length;

              return (
                <BoardSquare
                  key={square.id}
                  square={square}
                  playersHere={sortedPlayersHere}
                  playerCount={playerCount}   // ← new prop for dynamic sizing
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

      {/* Perks Button */}
      <button
        onClick={togglePerksModal}
        className="fixed bottom-20 left-6 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 shadow-2xl shadow-cyan-500/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
      >
        <Sparkles className="w-8 h-8 text-black" />
      </button>

      {/* Perks Modal */}
      <AnimatePresence>
        {showPerksModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPerksModal(false)}
              className="fixed inset-0 bg-black/70 z-50"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 50 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-6 left-6 z-50 w-80 max-h-[80vh]"
            >
              <div className="bg-[#0A1C1E] rounded-2xl shadow-2xl border border-cyan-500/30 overflow-hidden">
                <div className="p-5 border-b border-cyan-900/50 flex items-center justify-between">
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
                <div className="p-4 overflow-y-auto max-h-[60vh]">
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
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modals */}
      <CardModal
        isOpen={showCardModal}
        onClose={() => setShowCardModal(false)}
        card={cardData}
        playerName={cardPlayerName}
      />

      <BankruptcyModal
        isOpen={showBankruptcyModal}
        tokensAwarded={0.5}
        onConfirmBankruptcy={handleBankruptcy}
        onReturnHome={() => window.location.href = "/"}
      />

      {selectedProperty && (
        <PropertyDetailModal
          property={selectedProperty}
          gameProperty={game_properties.find(gp => gp.property_id === selectedProperty.id)}
          players={players}
          me={me}
          isMyTurn={isMyTurn}
          getCurrentRent={getCurrentRent}
          onClose={() => setSelectedProperty(null)}
          onDevelop={handleDevelopment}
          onDowngrade={handleDowngrade}
          onMortgage={handleMortgage}
          onUnmortgage={handleUnmortgage}
        />
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

export default Board;