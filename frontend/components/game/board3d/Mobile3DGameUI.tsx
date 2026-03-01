"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Bell, Users, X } from "lucide-react";
import type { Game, GameProperty, Player, Property } from "@/types/game";
import PlayerSection3D from "./PlayerSection3D";
import CollectibleInventoryBar from "@/components/collectibles/collectibles-invetory-mobile";

export interface Mobile3DGameUIProps {
  game?: Game | null;
  properties?: Property[];
  game_properties?: GameProperty[];
  my_properties?: Property[];
  me?: Player | null;
  currentPlayer?: Player | null;
  positions?: Record<number, number>;
  isAITurn?: boolean;
  isLoading?: boolean;
  onPropertySelect?: (property: Property, gameProperty?: GameProperty) => void;
  viewTradesRequested?: boolean;
  onViewTrades?: () => void;
  onTradeSectionOpened?: () => void;
  incomingTradeCount?: number;
  showPerksModal?: boolean;
  setShowPerksModal?: (v: boolean) => void;
  isMyTurn?: boolean;
  onRollDice?: () => void;
  onEndTurn?: () => void;
  triggerSpecialLanding?: (position: number, isSpecial?: boolean) => void;
  endTurnAfterSpecial?: () => void;
}

export default function Mobile3DGameUI(props: Mobile3DGameUIProps) {
  const {
    game,
    properties = [],
    game_properties = [],
    my_properties = [],
    me,
    currentPlayer,
    positions = {},
    isAITurn = false,
    isLoading = false,
    onPropertySelect,
    viewTradesRequested = false,
    onViewTrades,
    onTradeSectionOpened,
    incomingTradeCount = 0,
    showPerksModal: controlledPerksOpen,
    setShowPerksModal: setControlledPerksOpen,
    isMyTurn = false,
    onRollDice,
    onEndTurn,
    triggerSpecialLanding,
    endTurnAfterSpecial,
  } = props;

  const [internalPlayerModalOpen, setInternalPlayerModalOpen] = useState(false);
  const [internalPerksOpen, setInternalPerksOpen] = useState(false);

  const showPerksModal = controlledPerksOpen ?? internalPerksOpen;
  const setShowPerksModal = setControlledPerksOpen ?? setInternalPerksOpen;
  const showPlayerModal = internalPlayerModalOpen;

  const hasGame = !!game && !isLoading;

  const openPlayerModal = (tab?: "players" | "empire" | "trade") => {
    if (viewTradesRequested && onTradeSectionOpened) onTradeSectionOpened();
    setInternalPlayerModalOpen(true);
  };

  return (
    <>
      {/* Notification bar — Perks · Trade · Players (always on top so it’s visible) */}
      <div
        className="fixed left-0 right-0 bottom-0 z-[100] flex items-center justify-center gap-4 px-4 py-3 bg-slate-900/98 backdrop-blur-md border-t-2 border-slate-500/60 min-h-[56px]"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={() => setShowPerksModal(true)}
          className="w-12 h-12 rounded-xl flex items-center justify-center bg-violet-600/90 border border-violet-400/60 text-white hover:bg-violet-500 transition-colors"
          aria-label="Perks & collectibles"
        >
          <Sparkles className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => {
            onViewTrades?.();
            openPlayerModal();
          }}
          className="relative w-12 h-12 rounded-xl flex items-center justify-center border border-violet-500/50 bg-gradient-to-br from-violet-800/95 to-fuchsia-800/95 text-violet-200 hover:border-violet-400/60 transition-colors"
          aria-label="Trade"
        >
          <Bell className="w-5 h-5" />
          {incomingTradeCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-bold text-white">
              {incomingTradeCount > 99 ? "99+" : incomingTradeCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => openPlayerModal()}
          className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-600/90 border border-amber-400/60 text-white hover:bg-amber-500 transition-colors"
          aria-label="Players"
        >
          <Users className="w-5 h-5" />
        </button>
      </div>

      {/* Player modal: PlayerSection3D when game exists, else placeholder */}
      <AnimatePresence>
        {showPlayerModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInternalPlayerModalOpen(false)}
              className="fixed inset-0 bg-black/60 z-[110]"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[110] rounded-t-2xl border-t-2 border-amber-500/40 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl flex flex-col max-h-[85dvh]"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-600/50 shrink-0">
                <h2 className="text-lg font-bold text-amber-200">Game</h2>
                <button
                  type="button"
                  onClick={() => setInternalPlayerModalOpen(false)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {hasGame && game ? (
                  <PlayerSection3D
                    game={game}
                    properties={properties}
                    game_properties={game_properties}
                    my_properties={my_properties}
                    me={me ?? null}
                    currentPlayer={currentPlayer ?? null}
                    positions={positions}
                    isAITurn={isAITurn}
                    isLoading={false}
                    onPropertySelect={onPropertySelect}
                    openTradeSection={viewTradesRequested}
                    onTradeSectionOpened={onTradeSectionOpened}
                  />
                ) : (
                  <div className="space-y-2 py-4">
                    <p className="text-slate-500 text-sm">Join a game to see players, your empire, and trades.</p>
                    <p className="text-slate-600 text-xs">Use a game link with ?gameCode=XXXXXX</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Perks modal: CollectibleInventoryBar when game exists, else placeholder */}
      <AnimatePresence>
        {showPerksModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPerksModal(false)}
              className="fixed inset-0 bg-black/60 z-[110]"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[110] rounded-t-2xl border-t-2 border-violet-500/40 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl flex flex-col max-h-[85dvh]"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-600/50 shrink-0">
                <h2 className="text-lg font-bold text-violet-200 flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Perks & collectibles
                </h2>
                <button
                  type="button"
                  onClick={() => setShowPerksModal(false)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {hasGame && game && onRollDice ? (
                  <CollectibleInventoryBar
                    game={game}
                    game_properties={game_properties}
                    isMyTurn={isMyTurn}
                    ROLL_DICE={onRollDice}
                    END_TURN={onEndTurn}
                    triggerSpecialLanding={triggerSpecialLanding}
                    endTurnAfterSpecial={endTurnAfterSpecial}
                  />
                ) : (
                  <>
                    <p className="text-slate-500 text-sm">Perks content</p>
                    <p className="text-slate-600 text-xs mt-1">Join a game to use collectibles and perks.</p>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
