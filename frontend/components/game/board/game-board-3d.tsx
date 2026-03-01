"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { Toaster, toast } from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { Game, GameProperty, Property, Player } from "@/types/game";
import { BankruptcyModal } from "../modals/bankruptcy";
import { CardModal } from "../modals/cards";
import CollectibleInventoryBar from "@/components/collectibles/collectibles-invetory";
import { Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameBoardLogic } from "./useGameBoardLogic";
import PropertyDetailModal from "./PropertyDetailModal";
import { MONOPOLY_STATS } from "../constants";
import GameBoard3D from "../board3d/GameBoard3D";

/**
 * Standalone 3D game board. Same game logic and UI as the main 2D board,
 * but renders the board in 3D (React Three Fiber). Use via /game-play-3d?gameCode=XXX.
 * Production 2D board at /game-play is unchanged.
 */
const GameBoard3DView = ({
  game,
  properties,
  game_properties,
  me,
  onGameUpdated,
  onFinishByTime,
  embedded = false,
}: {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  me: Player | null;
  onGameUpdated?: () => void;
  onFinishByTime?: () => void | Promise<void>;
  /** When true, used inside board-3d-multi: fill container, no extra padding (same layout as AI board). */
  embedded?: boolean;
}) => {
  const logic = useGameBoardLogic({ game, properties, game_properties, me, onGameUpdated });

  const {
    displayRoll,
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
    voteToRemove,
    voteStatuses,
    votingLoading,
    touchActivity,
    timeoutPopupPlayer,
    dismissTimeoutPopup,
    showVotedOutModal,
    setShowVotedOutModal,
  } = logic;

  const voteablePlayersList = players
    .filter((p: Player) => {
      if (p.user_id === me?.user_id) return false;
      const strikes = p.consecutive_timeouts ?? 0;
      const otherPlayers = players.filter((pl) => pl.user_id !== me?.user_id);
      const isCurrentPlayer = p.user_id === currentPlayerId;
      const timeElapsed = turnTimeLeft != null && turnTimeLeft <= 0;
      if (otherPlayers.length === 1) return strikes >= 3;
      return strikes > 0 || (isCurrentPlayer && timeElapsed);
    })
    .filter((p: Player) => p.user_id !== me?.user_id);
  const canVoteOutTimeoutPlayer =
    timeoutPopupPlayer &&
    timeoutPopupPlayer.user_id !== me?.user_id &&
    voteablePlayersList.some((p) => p.user_id === timeoutPopupPlayer.user_id);

  if (!game || !Array.isArray(properties) || properties.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white text-2xl">
        Loading game board...
      </div>
    );
  }

  const togglePerksModal = () => setShowPerksModal((prev: boolean) => !prev);

  const AI_TIPS_STORAGE_KEY = "tycoon_ai_tips_on";
  const [aiTipsOn, setAiTipsOn] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(AI_TIPS_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [aiTipText, setAiTipText] = useState<string | null>(null);
  const [aiTipLoading, setAiTipLoading] = useState(false);
  const lastTipPropertyIdRef = useRef<number | null>(null);

  const toggleAiTips = useCallback(() => {
    setAiTipsOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(AI_TIPS_STORAGE_KEY, String(next));
      } catch {}
      if (!next) setAiTipText(null);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!buyPrompted) {
      setAiTipText(null);
      lastTipPropertyIdRef.current = null;
    }
  }, [buyPrompted]);

  // AI tips: available in both AI and multiplayer games (no game.is_ai check)
  useEffect(() => {
    if (!aiTipsOn || !isMyTurn || !buyPrompted || !justLandedProperty || !currentPlayer || currentPlayer?.user_id !== me?.user_id) return;
    const propId = justLandedProperty.id;
    if (lastTipPropertyIdRef.current === propId) return;
    lastTipPropertyIdRef.current = propId;
    setAiTipLoading(true);
    const groupIds = Object.values(MONOPOLY_STATS.colorGroups).find((ids) => ids.includes(justLandedProperty.id)) ?? [];
    const ownedInGroup = groupIds.filter((id) =>
      game_properties.some(
        (gp) => gp.property_id === id && (gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase())
      )
    ).length;
    const completesMonopoly = groupIds.length > 0 && ownedInGroup === groupIds.length - 1;
    const landingRank = (MONOPOLY_STATS.landingRank as Record<number, number>)[justLandedProperty.id] ?? 99;
    apiClient
      .post<{ success?: boolean; data?: { reasoning?: string }; useBuiltIn?: boolean }>("/agent-registry/decision", {
        gameId: game.id,
        slot: 1,
        decisionType: "tip",
        context: {
          myBalance: currentPlayer.balance ?? 0,
          myProperties: game_properties
            .filter((gp) => gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase())
            .map((gp) => ({ ...properties.find((p) => p.id === gp.property_id), ...gp })),
          opponents: players.filter((p) => p.user_id !== currentPlayer.user_id),
          situation: "buy_property",
          property: { ...justLandedProperty, completesMonopoly, landingRank },
        },
      })
      .then((res) => {
        const text = res?.data?.data?.reasoning ?? null;
        if (text) setAiTipText(text);
      })
      .catch(() => setAiTipText(null))
      .finally(() => setAiTipLoading(false));
  }, [
    aiTipsOn,
    isMyTurn,
    buyPrompted,
    justLandedProperty,
    currentPlayer,
    me?.user_id,
    game.id,
    players,
    game_properties,
    properties,
  ]);

  return (
    <div
      className={
        embedded
          ? "w-full h-full min-h-0 bg-[#010F10] text-white flex flex-col relative"
          : "w-full min-h-screen bg-[#010F10] text-white p-4 flex flex-col lg:flex-row gap-4 items-start justify-center relative"
      }
    >
      <AnimatePresence>
        {timeoutPopupPlayer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => dismissTimeoutPopup()}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-800 border border-cyan-500/50 rounded-xl p-6 max-w-sm w-full shadow-2xl"
            >
              <p className="text-lg font-semibold text-cyan-100 mb-1">
                {timeoutPopupPlayer.username} timed out
              </p>
              <p className="text-sm text-slate-400 mb-4">
                {canVoteOutTimeoutPlayer
                  ? "Do you want to vote them out?"
                  : "You can vote them out after 3 timeouts (2-player game)."}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => dismissTimeoutPopup()}
                  className="px-4 py-2 rounded-lg bg-slate-600 text-slate-200 hover:bg-slate-500 transition"
                >
                  Dismiss
                </button>
                {canVoteOutTimeoutPlayer && (
                  <button
                    onClick={() => {
                      voteToRemove(timeoutPopupPlayer.user_id);
                      dismissTimeoutPopup();
                    }}
                    disabled={votingLoading[timeoutPopupPlayer.user_id]}
                    className="px-4 py-2 rounded-lg bg-cyan-700 text-cyan-100 hover:bg-cyan-600 transition disabled:opacity-60"
                  >
                    {votingLoading[timeoutPopupPlayer.user_id] ? "Voting..." : `Vote ${timeoutPopupPlayer.username} Out`}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVotedOutModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-slate-800 border border-cyan-500/50 rounded-xl p-6 max-w-sm w-full shadow-2xl"
            >
              <p className="text-lg font-semibold text-cyan-100 mb-1">You were voted out</p>
              <p className="text-sm text-slate-400 mb-6">You can continue watching the game or leave.</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowVotedOutModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-600 text-slate-200 hover:bg-slate-500 transition"
                >
                  Continue watching
                </button>
                <button
                  onClick={() => { window.location.href = "/"; }}
                  className="px-4 py-2 rounded-lg bg-cyan-700 text-cyan-100 hover:bg-cyan-600 transition"
                >
                  Leave
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={
          embedded
            ? "flex-1 min-h-0 flex justify-center items-center w-full"
            : "flex justify-center items-start w-full lg:w-2/3 max-w-[800px] mt-[-1rem]"
        }
      >
        <div
          className={
            embedded
              ? "w-full max-w-[min(100%,min(80vh,800px))] aspect-square bg-[#010F10] rounded-lg relative shadow-2xl shadow-cyan-500/10"
              : "w-full bg-[#010F10] aspect-square rounded-lg relative shadow-2xl shadow-cyan-500/10"
          }
        >
          <GameBoard3D
            properties={properties}
            players={players}
            animatedPositions={animatedPositions}
            currentPlayerId={currentPlayerId}
            className="absolute inset-0 w-full h-full"
          />
          <Link
            href={`/game-play?gameCode=${encodeURIComponent(game.code)}`}
            className="absolute top-2 right-2 z-10 px-3 py-1.5 rounded-lg bg-slate-800/90 text-cyan-300 text-sm border border-cyan-500/50 hover:bg-slate-700 pointer-events-auto"
          >
            2D Board
          </Link>
          {embedded && (
            <button
              onClick={togglePerksModal}
              className="absolute bottom-4 left-4 z-10 w-14 h-14 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 shadow-2xl shadow-cyan-500/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
            >
              <Sparkles className="w-7 h-7 text-black" />
            </button>
          )}
        </div>
      </div>

      {!embedded && (
        <button
          onClick={togglePerksModal}
          className="fixed bottom-20 left-6 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 shadow-2xl shadow-cyan-500/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
        >
          <Sparkles className="w-8 h-8 text-black" />
        </button>
      )}

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
          onDevelop={(id) => { touchActivity(); handleDevelopment(id); }}
          onDowngrade={(id) => { touchActivity(); handleDowngrade(id); }}
          onMortgage={(id) => { touchActivity(); handleMortgage(id); }}
          onUnmortgage={(id) => { touchActivity(); handleUnmortgage(id); }}
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
            fontFamily: "Orbitron, sans-serif",
            background: "#0A1A1B",
            color: "#00F0FF",
            border: "1px solid rgba(0, 240, 255, 0.4)",
            borderRadius: "12px",
            padding: "12px 20px",
            fontSize: "16px",
            fontWeight: "600",
            boxShadow: "0 10px 30px rgba(0, 240, 255, 0.2)",
            backdropFilter: "blur(10px)",
          },
          success: { icon: "✔", style: { borderColor: "rgba(0, 240, 255, 0.5)", color: "#00F0FF" } },
          error: { icon: "✖", style: { borderColor: "rgba(255, 107, 107, 0.5)", color: "#00F0FF" } },
          loading: { style: { borderColor: "rgba(0, 240, 255, 0.4)", color: "#00F0FF" } },
        }}
      />
    </div>
  );
};

export default GameBoard3DView;
