"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast, Toaster } from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { Game, GameProperty, Property, Player } from "@/types/game";
import { useGameTrades } from "@/hooks/useGameTrades";
import { isAIPlayer } from "@/utils/gameUtils";

import {
  MIN_SCALE,
  MAX_SCALE,
  BASE_WIDTH_REFERENCE,
  TOKEN_POSITIONS,
  MONOPOLY_STATS,
  JAIL_POSITION,
} from "./constants";

import Board from "./board";
import DiceAnimation from "./dice-animation";
import GameLog from "./game-log";
import GameModals from "./game-modals";
import PlayerStatus from "./player-status";
import TradeAlertPill from "../../TradeAlertPill";
import MyBalanceBar from "./MyBalanceBar";
import BuyPromptModal from "./BuyPromptModal";
import PropertyDetailModal from "./PropertyDetailModal";
import PerksModal from "./PerksModal";
import { Sparkles } from "lucide-react";
import { GameDurationCountdown } from "../../GameDurationCountdown";
import { ApiResponse } from "@/types/api";
import { getContractErrorMessage } from "@/lib/utils/contractErrors";
import { useMobilePropertyActions } from "@/hooks/useMobilePropertyActions";
import { useMobileAiBankruptcy } from "./useMobileAiLogic";
import { useAIBoardLogic } from "../useAIBoardLogic";

const MobileGameLayout = ({
  game,
  properties,
  game_properties,
  me,
  onFinishGameByTime,
  onViewTrades,
}: {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  me: Player | null;
  onFinishGameByTime?: () => Promise<void>;
  onViewTrades?: () => void;
}) => {
  const [currentGame, setCurrentGame] = useState<Game>(game);
  const [currentGameProperties, setCurrentGameProperties] = useState<GameProperty[]>(game_properties);

  const [showInsolvencyModal, setShowInsolvencyModal] = useState(false);
  const [insolvencyDebt, setInsolvencyDebt] = useState(0);
  const [isRaisingFunds, setIsRaisingFunds] = useState(false);
  const [showPerksModal, setShowPerksModal] = useState(false);

  const [boardScale, setBoardScale] = useState(1);
  const [boardTransformOrigin, setBoardTransformOrigin] = useState("50% 50%");
  const [isFollowingMyMove, setIsFollowingMyMove] = useState(false);
  const [defaultScale, setDefaultScale] = useState(1.45);

  const [bellFlash, setBellFlash] = useState(false);
  const prevIncomingTradeCount = useRef(0);
  const tradeToastShownThisTurn = useRef(false);
  const lastTurnForTradeToast = useRef<number | null>(null);

  const { tradeRequests = [], refreshTrades } = useGameTrades({
    gameId: game?.id,
    myUserId: me?.user_id,
    players: game?.players ?? [],
  });

  const FETCH_THROTTLE_MS = 2200;
  const lastFetchTimeRef = useRef(0);
  const pendingFetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUpdatedGame = useCallback(async (retryDelay = 2000) => {
    const doFetch = async () => {
      lastFetchTimeRef.current = Date.now();
      try {
        const gameRes = await apiClient.get<ApiResponse<Game>>(`/games/code/${game.code}`);
        if (gameRes?.data?.success && gameRes.data.data) {
          setCurrentGame(gameRes.data.data);
        }
        const propertiesRes = await apiClient.get<ApiResponse<GameProperty[]>>(`/game-properties/game/${game.id}`);
        if (propertiesRes?.data?.success && propertiesRes.data.data) {
          setCurrentGameProperties(propertiesRes.data.data);
        }
        try {
          await refreshTrades?.();
        } catch {
          // Non-critical
        }
      } catch (err: unknown) {
        const e = err as { response?: { status: number; data?: { message?: string } }; message?: string };
        if (e?.response?.status === 429 || e?.message?.toLowerCase().includes("too many")) {
          const msg = e?.response?.data?.message || e?.message || "Too many requests — wait a moment";
          toast(msg, { duration: 2500, icon: "⏳" });
          setTimeout(() => fetchUpdatedGame(retryDelay * 1.5), retryDelay);
          return;
        }
        console.error("Sync failed:", err);
      }
    };

    const now = Date.now();
    const elapsed = now - lastFetchTimeRef.current;
    if (elapsed > 0 && elapsed < FETCH_THROTTLE_MS) {
      const wait = FETCH_THROTTLE_MS - elapsed;
      if (pendingFetchTimeoutRef.current) clearTimeout(pendingFetchTimeoutRef.current);
      pendingFetchTimeoutRef.current = setTimeout(() => {
        pendingFetchTimeoutRef.current = null;
        doFetch();
      }, wait);
      return;
    }
    if (pendingFetchTimeoutRef.current) {
      clearTimeout(pendingFetchTimeoutRef.current);
      pendingFetchTimeoutRef.current = null;
    }
    await doFetch();
  }, [game.code, game.id, refreshTrades]);

  const {
    players,
    gameTimeUp,
    winner,
    showExitPrompt,
    setShowExitPrompt,
    roll,
    isRolling,
    buyPrompted,
    animatedPositions,
    hasMovementFinished,
    currentPlayerId,
    currentPlayer,
    isMyTurn,
    isAITurn,
    justLandedProperty,
    showToast,
    handleGameTimeUp,
    handleFinalizeTimeUpAndLeave,
    endGame,
    endGamePending,
    endGameReset,
    endGameCandidate,
    handleRollDice,
    handleBuyProperty,
    handleSkipBuy,
    handleDeclareBankruptcy,
    handlePropertyClick: hookHandlePropertyClick,
    selectedProperty,
    setSelectedProperty,
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
  } = useAIBoardLogic({
    game: currentGame,
    properties,
    game_properties: currentGameProperties,
    me,
    onFinishGameByTime,
    onGameUpdated: fetchUpdatedGame,
    disablePolling: true,
  });

  const myIncomingTrades = useMemo(() => {
    if (!me) return [];
    return tradeRequests.filter(
      (t) => t.target_player_id === me.user_id && t.status === "pending"
    );
  }, [tradeRequests, me]);

  useEffect(() => {
    const currentCount = myIncomingTrades.length;
    const previousCount = prevIncomingTradeCount.current;
    if (currentCount > previousCount && previousCount >= 0 && !tradeToastShownThisTurn.current) {
      tradeToastShownThisTurn.current = true;
      setBellFlash(true);
      setTimeout(() => setBellFlash(false), 800);
    }
    prevIncomingTradeCount.current = currentCount;
  }, [myIncomingTrades]);

  useEffect(() => {
    const calculateScale = () => {
      const width = window.innerWidth;
      let scale = (width / BASE_WIDTH_REFERENCE) * 1.48;
      scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
      setDefaultScale(scale);
    };
    calculateScale();
    window.addEventListener("resize", calculateScale);
    return () => window.removeEventListener("resize", calculateScale);
  }, []);

  useEffect(() => {
    if (lastTurnForTradeToast.current !== currentPlayerId) {
      lastTurnForTradeToast.current = currentPlayerId ?? null;
      tradeToastShownThisTurn.current = false;
    }
  }, [currentPlayerId]);

  useMobileAiBankruptcy({
    game: currentGame,
    currentGame,
    currentGameProperties,
    players,
    isAITurn,
    currentPlayer,
    fetchUpdatedGame,
    setIsRaisingFunds,
    properties,
  });

  useEffect(() => {
    if (!isMyTurn || !roll || !hasMovementFinished) {
      setBoardScale(defaultScale);
      setBoardTransformOrigin("50% 50%");
      setIsFollowingMyMove(false);
      return;
    }
    const myPos = animatedPositions[me!.user_id] ?? me?.position ?? 0;
    const coord = TOKEN_POSITIONS[myPos] || { x: 50, y: 50 };
    setBoardScale(defaultScale * 1.8);
    setBoardTransformOrigin(`${coord.x}% ${coord.y}%`);
    setIsFollowingMyMove(true);
  }, [isMyTurn, roll, hasMovementFinished, me, animatedPositions, defaultScale]);

  useEffect(() => {
    if (isAITurn) {
      setBoardScale(defaultScale);
      setBoardTransformOrigin("50% 50%");
    }
  }, [isAITurn, defaultScale]);

  const selectedGameProperty = useMemo(
    () => (selectedProperty ? currentGameProperties.find((gp) => gp.property_id === selectedProperty.id) : undefined),
    [selectedProperty, currentGameProperties]
  );

  const handlePropertyClick = useCallback(
    (propertyId: number) => {
      const prop = properties.find((p) => p.id === propertyId);
      if (prop) {
        hookHandlePropertyClick(prop);
      }
    },
    [properties, hookHandlePropertyClick]
  );

  const getCurrentRent = (prop: Property, gp: GameProperty | undefined): number => {
    if (!gp || !gp.address) return prop.rent_site_only || 0;
    if (gp.mortgaged) return 0;
    if (gp.development === 5) return prop.rent_hotel || 0;
    if (gp.development && gp.development > 0) {
      switch (gp.development) {
        case 1: return prop.rent_one_house || 0;
        case 2: return prop.rent_two_houses || 0;
        case 3: return prop.rent_three_houses || 0;
        case 4: return prop.rent_four_houses || 0;
        default: return prop.rent_site_only || 0;
      }
    }

    const groupEntry = Object.entries(MONOPOLY_STATS.colorGroups).find(([_, ids]) => ids.includes(prop.id));
    if (groupEntry) {
      const [groupName] = groupEntry;
      if (groupName !== "railroad" && groupName !== "utility") {
        const groupIds = MONOPOLY_STATS.colorGroups[groupName as keyof typeof MONOPOLY_STATS.colorGroups];
        const ownedInGroup = currentGameProperties.filter(g => groupIds.includes(g.property_id) && g.address === gp.address).length;
        if (ownedInGroup === groupIds.length) return (prop.rent_site_only || 0) * 2;
      }
    }

    return prop.rent_site_only || 0;
  };

  const { handleBuild, handleSellBuilding, handleMortgageToggle, handleSellToBank } = useMobilePropertyActions(
    currentGame.id,
    me?.user_id,
    isMyTurn,
    fetchUpdatedGame,
    showToast
  );

  return (
    <div className="w-full min-h-screen bg-black text-white flex flex-col items-center justify-start relative overflow-hidden">

      {/* Player Status + Trade notification bell */}
      <div className="w-full max-w-2xl mx-auto px-4 mt-4 flex items-center justify-between gap-3 flex-wrap">
        <PlayerStatus currentPlayer={currentPlayer} isAITurn={isAITurn} buyPrompted={buyPrompted} />
        <TradeAlertPill
          incomingCount={myIncomingTrades.length}
          onViewTrades={onViewTrades}
          newTradePulse={bellFlash}
        />
      </div>

      {/* Board */}
      <div className="flex-1 w-full flex items-center justify-center overflow-hidden mt-4">
        <motion.div
          animate={{ scale: boardScale }}
          style={{ transformOrigin: boardTransformOrigin }}
          transition={{ type: "spring", stiffness: 120, damping: 30 }}
          className="origin-center"
        >
          <Board
            properties={properties}
            players={players}
            currentGameProperties={currentGameProperties}
            animatedPositions={animatedPositions}
            currentPlayerId={currentPlayerId}
            onPropertyClick={handlePropertyClick}
            centerContent={
              <div className="flex flex-col items-center justify-center gap-3 text-center min-h-[80px] px-4 py-3 z-30 relative w-full">
                {currentGame?.duration && Number(currentGame.duration) > 0 && (
                  <GameDurationCountdown game={currentGame} compact onTimeUp={handleGameTimeUp} />
                )}
                {gameTimeUp && (
                  <div className="font-mono font-bold rounded-xl px-6 py-3 bg-amber-500/20 border-2 border-amber-400/60 text-amber-300 text-lg">
                    Time&apos;s Up!
                  </div>
                )}
                {!gameTimeUp && isMyTurn && !isRolling && !isRaisingFunds && !showInsolvencyModal && (
                  (currentPlayer?.balance ?? 0) < 0 ? (
                    <button
                      onClick={handleDeclareBankruptcy}
                      className="py-2 px-6 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-800 text-white font-bold text-sm rounded-full shadow-md border border-white/20"
                    >
                      Declare Bankruptcy
                    </button>
                  ) : (
                    <button
                      onClick={() => ROLL_DICE(false)}
                      className="py-2.5 px-8 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-bold text-sm rounded-full shadow-lg border border-cyan-300/30"
                    >
                      Roll Dice
                    </button>
                  )
                )}
              </div>
            }
          />
        </motion.div>
      </div>

      <DiceAnimation
        isRolling={isRolling && !(currentPlayer?.in_jail && currentPlayer?.position === JAIL_POSITION)}
        roll={roll}
      />

      {/* Balance bar above action log — extra pb so log is fully visible above bottom nav */}
      <div className="w-full max-w-2xl mx-auto px-4 mt-6 mb-4">
        <MyBalanceBar me={me} bottomBar />
      </div>
      <div className="w-full max-w-2xl mx-auto px-4 pb-40">
        <GameLog history={currentGame.history} />
      </div>
      <BuyPromptModal
        visible={!!(isMyTurn && buyPrompted && justLandedProperty)}
        property={justLandedProperty ?? null}
        onBuy={handleBuyProperty}
        onSkip={handleSkipBuy}
      />

      <PropertyDetailModal
        property={selectedProperty}
        gameProperty={selectedGameProperty}
        players={players}
        me={me}
        isMyTurn={isMyTurn}
        getCurrentRent={getCurrentRent}
        onClose={() => setSelectedProperty(null)}
        onBuild={handleBuild}
        onSellBuilding={handleSellBuilding}
        onMortgageToggle={handleMortgageToggle}
        onSellToBank={handleSellToBank}
      />

      <button
        onClick={() => setShowPerksModal(true)}
        className="fixed bottom-20 right-6 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 shadow-2xl shadow-cyan-500/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
      >
        <Sparkles className="w-8 h-8 text-black" />
      </button>

      <PerksModal
        open={showPerksModal}
        onClose={() => setShowPerksModal(false)}
        game={game}
        game_properties={game_properties}
        isMyTurn={isMyTurn}
        onRollDice={ROLL_DICE}
        onEndTurn={END_TURN}
        onTriggerSpecialLanding={triggerLandingLogic}
        onEndTurnAfterSpecial={endTurnAfterSpecialMove}
      />

      <GameModals
        winner={winner}
        showExitPrompt={showExitPrompt}
        setShowExitPrompt={setShowExitPrompt}
        showInsolvencyModal={showInsolvencyModal}
        insolvencyDebt={insolvencyDebt}
        isRaisingFunds={isRaisingFunds}
        showBankruptcyModal={showBankruptcyModal}
        showCardModal={showCardModal}
        cardData={cardData}
        cardPlayerName={cardPlayerName}
        setShowCardModal={setShowCardModal}
        me={me}
        players={players}
        currentGame={currentGame}
        isPending={endGamePending}
        endGame={endGame}
        reset={endGameReset}
        onFinishGameByTime={onFinishGameByTime}
        setShowInsolvencyModal={setShowInsolvencyModal}
        setIsRaisingFunds={setIsRaisingFunds}
        setShowBankruptcyModal={setShowBankruptcyModal}
        fetchUpdatedGame={fetchUpdatedGame}
        showToast={showToast}
      />

      <Toaster
        position="top-center"
        reverseOrder={false}
        gutter={8}
        containerClassName="z-50"
        toastOptions={{
          duration: 2000,
          style: {
            background: "#010F10",
            color: "#e0f7fa",
            border: "1px solid rgba(34, 211, 238, 0.25)",
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: "500",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          },
          success: {
            icon: "✓",
            duration: 2000,
            style: {
              borderColor: "rgba(34, 211, 238, 0.7)",
              background: "rgba(6, 78, 99, 0.35)",
              boxShadow: "0 4px 16px rgba(0, 240, 255, 0.2)",
              color: "#a5f3fc",
            },
          },
          error: { icon: "!", duration: 2500 },
          loading: { duration: Infinity },
        }}
      />
    </div>
  );
};

export default MobileGameLayout;