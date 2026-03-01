"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Bell, Users, X } from "lucide-react";
import type { Game, Player, Property, GameProperty } from "@/types/game";
import PlayerSection3D from "./PlayerSection3D";
import CollectibleInventoryBar from "@/components/collectibles/collectibles-invetory-mobile";

interface Mobile3DGameUIProps {
  game: Game | null;
  properties: Property[];
  game_properties: GameProperty[];
  my_properties: Property[];
  me: Player | null;
  currentPlayer: Player | null;
  positions: Record<number, number>;
  isAITurn: boolean;
  isLoading?: boolean;
  onPropertySelect?: (property: Property, gameProperty?: GameProperty) => void;
  viewTradesRequested: boolean;
  onViewTrades: () => void;
  onTradeSectionOpened: () => void;
  incomingTradeCount?: number;
  showPerksModal: boolean;
  setShowPerksModal: (v: boolean) => void;
  isMyTurn: boolean;
  onRollDice?: () => void;
  onEndTurn: () => void;
  triggerSpecialLanding?: (position: number, isSpecial?: boolean) => void;
  endTurnAfterSpecial?: () => void;
}

export default function Mobile3DGameUI({
  game,
  properties,
  game_properties,
  my_properties,
  me,
  currentPlayer,
  positions,
  isAITurn,
  isLoading = false,
  onPropertySelect,
  viewTradesRequested,
  onViewTrades,
  onTradeSectionOpened,
  incomingTradeCount = 0,
  showPerksModal,
  setShowPerksModal,
  isMyTurn,
  onRollDice,
  onEndTurn,
  triggerSpecialLanding,
  endTurnAfterSpecial,
}: Mobile3DGameUIProps) {
  const hasGame = !!game;

  const [internalPlayerModalOpen, setInternalPlayerModalOpen] = useState(false);

  // Bell: open modal with Trade tab selected (viewTradesRequested=true)
  const openBellModal = () => {
    onViewTrades();
    setInternalPlayerModalOpen(true);
  };

  // Players: open modal with Players tab selected (do NOT set viewTradesRequested)
  const openPlayerModal = () => {
    setInternalPlayerModalOpen(true);
  };

  return (
    <>
      {/* Bottom bar: Perks, Bell (Trades), Players — high z-index so board stays behind */}
      <div
        className="fixed left-0 right-0 bottom-0 z-[9998] flex items-center justify-center gap-4 px-4 py-3 bg-slate-900/98 backdrop-blur-md border-t-2 border-slate-500/60 min-h-[56px]"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={() => setShowPerksModal(true)}
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-violet-600/80 hover:bg-violet-500/90 text-violet-100 transition"
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-xs font-medium">Perks</span>
        </button>
        <button
          type="button"
          onClick={openBellModal}
          className="relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-amber-600/80 hover:bg-amber-500/90 text-amber-100 transition"
        >
          <Bell className="w-5 h-5" />
          <span className="text-xs font-medium">Trades</span>
          {incomingTradeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
              {incomingTradeCount > 99 ? "99+" : incomingTradeCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={openPlayerModal}
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl bg-cyan-600/80 hover:bg-cyan-500/90 text-cyan-100 transition"
        >
          <Users className="w-5 h-5" />
          <span className="text-xs font-medium">Players</span>
        </button>
      </div>

      {/* Player/Game modal: Bell opens with Trade tab, Players opens with Players tab */}
      <AnimatePresence>
        {internalPlayerModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInternalPlayerModalOpen(false)}
              className="fixed inset-0 bg-black/60 z-[9999]"
              style={{ transform: "translateZ(0)" }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[9999] rounded-t-2xl border-t-2 border-amber-500/40 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl flex flex-col max-h-[85dvh]"
              style={{ paddingBottom: "env(safe-area-inset-bottom)", transform: "translateZ(0)" }}
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

      {/* Perks modal */}
      <AnimatePresence>
        {showPerksModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPerksModal(false)}
              className="fixed inset-0 bg-black/60 z-[9999]"
              style={{ transform: "translateZ(0)" }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[9999] rounded-t-2xl border-t-2 border-violet-500/40 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl flex flex-col max-h-[85dvh]"
              style={{ paddingBottom: "env(safe-area-inset-bottom)", transform: "translateZ(0)" }}
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
                  <p className="text-slate-500 text-sm py-4">Join a game to see your perks.</p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
