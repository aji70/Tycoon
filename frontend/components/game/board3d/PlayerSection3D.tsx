"use client";

import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Game, Player, Property, GameProperty } from "@/types/game";
import { getPlayerSymbol } from "@/lib/types/symbol";
import { getSquareName } from "./squareNames";
import { MyEmpire } from "../ai-player/my-empire";
import { TradeSection } from "../ai-player/trade-section";
import { PropertyActionModal } from "../modals/property-action";
import { AiResponsePopup } from "../modals/ai-response";
import { TradeModal } from "../modals/trade";
import { useAiPlayerLogic } from "../ai-player/useAiPlayerLogic";

interface PlayerSection3DProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  my_properties: Property[];
  me: Player | null;
  currentPlayer: Player | null;
  positions: Record<number, number>;
  isAITurn: boolean;
}

/** 3D board–styled sidebar: Players, My Empire, Trade (amber/slate/cyan) */
export default function PlayerSection3D({
  game,
  properties,
  game_properties,
  my_properties,
  me,
  currentPlayer,
  positions,
  isAITurn,
}: PlayerSection3DProps) {
  const [showEmpire, setShowEmpire] = useState(false);
  const [showTrade, setShowTrade] = useState(false);
  const [showPlayers, setShowPlayers] = useState(true);

  const logic = useAiPlayerLogic({
    game,
    properties,
    game_properties,
    my_properties,
    me,
    currentPlayer,
    isAITurn,
  });

  const {
    tradeModal,
    setTradeModal,
    counterModal,
    setCounterModal,
    aiResponsePopup,
    setAiResponsePopup,
    selectedProperty,
    setSelectedProperty,
    offerProperties,
    requestProperties,
    offerCash,
    requestCash,
    setOfferProperties,
    setRequestProperties,
    setOfferCash,
    setRequestCash,
    openTrades,
    tradeRequests,
    refreshTrades,
    resetTradeFields,
    toggleSelect,
    startTrade,
    sortedPlayers,
    isNext,
    handleCreateTrade,
    handleTradeAction,
    submitCounterTrade,
    handleDevelopment,
    handleDowngrade,
    handleMortgage,
    handleUnmortgage,
  } = logic;

  const toggleEmpire = useCallback(() => setShowEmpire((p) => !p), []);
  const toggleTrade = useCallback(() => setShowTrade((p) => !p), []);
  const togglePlayers = useCallback(() => setShowPlayers((p) => !p), []);

  return (
    <div className="flex flex-col gap-5">
      {/* Players panel — 3D board style */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500/50 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div className="absolute inset-0 rounded-2xl border border-amber-400/20 pointer-events-none" />
        <button
          onClick={togglePlayers}
          className="w-full px-4 py-3 bg-gradient-to-r from-amber-900/40 to-amber-800/30 border-b-2 border-amber-500/40 flex justify-between items-center"
        >
          <h3 className="text-base font-black text-amber-200 tracking-widest uppercase drop-shadow-sm flex items-center gap-2">
            <span className="text-lg">🎲</span> Players
            <span className="text-xs font-normal text-amber-400/90">Live</span>
          </h3>
          <motion.span
            animate={{ rotate: showPlayers ? 180 : 0 }}
            className="text-amber-300 text-xl"
          >
            ▼
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {showPlayers && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-2.5 space-y-2 max-h-64 overflow-y-auto">
                {sortedPlayers.map((p) => {
                  const pos = positions[p.user_id] ?? p.position ?? 0;
                  const isMe = me != null && p.user_id === me.user_id;
                  const isCurrent = currentPlayer?.user_id === p.user_id;
                  const canTrade = isNext && !p.in_jail && !isMe;

                  return (
                    <div
                      key={p.user_id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl border-2 transition-all ${
                        isMe || isCurrent
                          ? "bg-amber-500/25 border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                          : "bg-slate-800/60 border-slate-600/50 hover:border-slate-500/70"
                      }`}
                    >
                      <span
                        className={`flex items-center justify-center w-10 h-10 rounded-full text-2xl shrink-0 ${
                          isMe || isCurrent ? "bg-amber-500/30 ring-2 ring-amber-400/50" : "bg-slate-700/80"
                        }`}
                        title={p.symbol ?? ""}
                      >
                        {getPlayerSymbol(p.symbol)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${isMe || isCurrent ? "text-amber-100" : "text-slate-200"}`}>
                          {p.username ?? `Player ${p.user_id}`}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          <span className="text-emerald-400 font-semibold">${Number(p.balance ?? 0)}</span>
                          <span className="text-slate-500 mx-1">·</span>
                          {getSquareName(pos)}
                        </p>
                      </div>
                      {canTrade && (
                        <button
                          onClick={() => startTrade(p)}
                          className="shrink-0 px-2 py-1 text-xs font-bold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white"
                        >
                          Trade
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* My Empire — 3D board style (cyan/slate) */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-cyan-500/50 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 shadow-[0_0_30px_rgba(6,182,212,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="absolute inset-0 rounded-2xl border border-cyan-400/20 pointer-events-none" />
        <div className="p-4">
          <MyEmpire
            showEmpire={showEmpire}
            toggleEmpire={toggleEmpire}
            my_properties={my_properties}
            properties={properties}
            game_properties={game_properties}
            setSelectedProperty={setSelectedProperty}
          />
        </div>
      </div>

      {/* Trade section — 3D board style */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-cyan-500/50 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 shadow-[0_0_30px_rgba(6,182,212,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="absolute inset-0 rounded-2xl border border-cyan-400/20 pointer-events-none" />
        <div className="p-4">
          <TradeSection
            showTrade={showTrade}
            toggleTrade={toggleTrade}
            openTrades={openTrades}
            tradeRequests={tradeRequests}
            properties={properties}
            game={game}
            handleTradeAction={handleTradeAction}
          />
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        <PropertyActionModal
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          onDevelop={handleDevelopment}
          onDowngrade={handleDowngrade}
          onMortgage={handleMortgage}
          onUnmortgage={handleUnmortgage}
        />

        <AiResponsePopup
          popup={aiResponsePopup}
          properties={properties}
          onClose={() => setAiResponsePopup(null)}
        />

        <TradeModal
          open={tradeModal.open}
          title={`Trade with ${tradeModal.target?.username || "Player"}`}
          onClose={() => {
            setTradeModal({ open: false, target: null });
            resetTradeFields();
          }}
          onSubmit={handleCreateTrade}
          my_properties={my_properties}
          properties={properties}
          game_properties={game_properties}
          offerProperties={offerProperties}
          requestProperties={requestProperties}
          setOfferProperties={setOfferProperties}
          setRequestProperties={setRequestProperties}
          offerCash={offerCash}
          requestCash={requestCash}
          setOfferCash={setOfferCash}
          setRequestCash={setRequestCash}
          toggleSelect={toggleSelect}
          targetPlayerAddress={tradeModal.target?.address}
        />

        <TradeModal
          open={counterModal.open}
          title="Counter Offer"
          onClose={() => {
            setCounterModal({ open: false, trade: null });
            resetTradeFields();
          }}
          onSubmit={submitCounterTrade}
          my_properties={my_properties}
          properties={properties}
          game_properties={game_properties}
          offerProperties={offerProperties}
          requestProperties={requestProperties}
          setOfferProperties={setOfferProperties}
          setRequestProperties={setRequestProperties}
          offerCash={offerCash}
          requestCash={requestCash}
          setOfferCash={setOfferCash}
          setRequestCash={setRequestCash}
          toggleSelect={toggleSelect}
          targetPlayerAddress={
            game.players.find((p) => p.user_id === counterModal.trade?.target_player_id)?.address
          }
        />
      </AnimatePresence>
    </div>
  );
}
