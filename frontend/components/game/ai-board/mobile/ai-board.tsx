"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast, Toaster } from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useEndAIGameAndClaim, useGetGameByCode, useTransferPropertyOwnership } from "@/context/ContractProvider";
import { Game, GameProperty, Property, Player, PROPERTY_ACTION } from "@/types/game";
import { useGameTrades } from "@/hooks/useGameTrades";
import { isAIPlayer } from "@/utils/gameUtils";

import {
  BOARD_SQUARES,
  ROLL_ANIMATION_MS,
  MOVE_ANIMATION_MS_PER_SQUARE,
  JAIL_POSITION,
  MIN_SCALE,
  MAX_SCALE,
  BASE_WIDTH_REFERENCE,
  TOKEN_POSITIONS,
  MONOPOLY_STATS,
  getDiceValues,
} from "./constants";

import Board from "./board";
import DiceAnimation from "./dice-animation";
import GameLog from "./game-log";
import GameModals from "./game-modals";
import PlayerStatus from "./player-status";
import BellNotification from "./BellNotification";
import MyBalanceBar from "./MyBalanceBar";
import BuyPromptModal from "./BuyPromptModal";
import PropertyDetailModal from "./PropertyDetailModal";
import PerksModal from "./PerksModal";
import { Sparkles, Bell } from "lucide-react";
import { ApiResponse } from "@/types/api";
import { useMobilePropertyActions } from "@/hooks/useMobilePropertyActions";
import {
  useMobileAiLogic,
  useMobileAiBankruptcy,
} from "./useMobileAiLogic";

const MobileGameLayout = ({
  game,
  properties,
  game_properties,
  me,
}: {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  me: Player | null;
}) => {
  const [currentGame, setCurrentGame] = useState<Game>(game);
  const [players, setPlayers] = useState<Player[]>(game?.players ?? []);
  const [currentGameProperties, setCurrentGameProperties] = useState<GameProperty[]>(game_properties);

  const [roll, setRoll] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [pendingRoll, setPendingRoll] = useState(0);
  const [actionLock, setActionLock] = useState<"ROLL" | "END" | null>(null);
  const [buyPrompted, setBuyPrompted] = useState(false);
  const [animatedPositions, setAnimatedPositions] = useState<Record<number, number>>({});
  const [hasMovementFinished, setHasMovementFinished] = useState(false);
  const [strategyRanThisTurn, setStrategyRanThisTurn] = useState(false);

  const [showInsolvencyModal, setShowInsolvencyModal] = useState(false);
  const [insolvencyDebt, setInsolvencyDebt] = useState(0);
  const [isRaisingFunds, setIsRaisingFunds] = useState(false);
  const [showPerksModal, setShowPerksModal] = useState(false);
  const [isSpecialMove, setIsSpecialMove] = useState(false);

  const [winner, setWinner] = useState<Player | null>(null);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [endGameCandidate, setEndGameCandidate] = useState<{
    winner: Player | null;
    position: number;
    balance: bigint;
  }>({ winner: null, position: 0, balance: BigInt(0) });

  const [showCardModal, setShowCardModal] = useState(false);
  const [cardData, setCardData] = useState<{
    type: "chance" | "community";
    text: string;
    effect?: string;
    isGood: boolean;
  } | null>(null);
  const [cardPlayerName, setCardPlayerName] = useState("");

  const [showBankruptcyModal, setShowBankruptcyModal] = useState(false);
  const [turnTimeLeft, setTurnTimeLeft] = useState<number | null>(null);

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedGameProperty, setSelectedGameProperty] = useState<GameProperty | undefined>(undefined);

  const [boardScale, setBoardScale] = useState(1);
  const [boardTransformOrigin, setBoardTransformOrigin] = useState("50% 50%");
  const [isFollowingMyMove, setIsFollowingMyMove] = useState(false);
  const [defaultScale, setDefaultScale] = useState(1.45);

  const [bellFlash, setBellFlash] = useState(false);
  const prevIncomingTradeCount = useRef(0);
   const { write: transferOwnership, isPending: isCreatePending } = useTransferPropertyOwnership();

  const {
    tradeRequests = [],
    refreshTrades,
  } = useGameTrades({
    gameId: game?.id,
    myUserId: me?.user_id,
    players: game?.players ?? [],
  });

 const durationMinutes = Number(game.duration ?? 0); // converts string → number, null/undefined → 0
const endTime =
  new Date(game.created_at).getTime() +
  durationMinutes * 60 * 1000;

  const myIncomingTrades = useMemo(() => {
    if (!me) return [];
    return tradeRequests.filter(
      (t) => t.target_player_id === me.user_id && t.status === "pending"
    );
  }, [tradeRequests, me]);

  useEffect(() => {
    const currentCount = myIncomingTrades.length;
    const previousCount = prevIncomingTradeCount.current;

    if (currentCount > previousCount && previousCount > 0) {
      const latestTrade = myIncomingTrades[myIncomingTrades.length - 1];
      const senderName = latestTrade?.player?.username || "Someone";

      toast.custom(
        <div className="flex items-center gap-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-3 rounded-xl shadow-2xl">
          <Bell className="w-6 h-6 animate-bell-ring" />
          <div>
            <div className="font-bold">New Trade Offer!</div>
            <div className="text-sm opacity-90">{senderName} sent you a trade</div>
          </div>
        </div>,
        { duration: 5000, position: "top-center" }
      );

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

  const currentPlayerId = currentGame.next_player_id;
  const currentPlayer = players.find((p) => p.user_id === currentPlayerId);
  const isMyTurn = me?.user_id === currentPlayerId;
  const isAITurn = !!currentPlayer && isAIPlayer(currentPlayer);

  const landedPositionThisTurn = useRef<number | null>(null);
  const turnEndInProgress = useRef(false);
  const lastToastMessage = useRef<string | null>(null);
  const rolledForPlayerId = useRef<number | null>(null);

  const justLandedProperty = useMemo(() => {
    if (landedPositionThisTurn.current === null) return null;
    return properties.find((p) => p.id === landedPositionThisTurn.current) ?? null;
  }, [landedPositionThisTurn.current, properties]);

  const { data: contractGame } = useGetGameByCode(game.code);
  const onChainGameId = contractGame?.id;

  const {
    write: endGame,
    isPending: endGamePending,
    reset: endGameReset,
  } = useEndAIGameAndClaim(
    onChainGameId ?? BigInt(0),
    endGameCandidate.position,
    BigInt(endGameCandidate.balance),
    !!endGameCandidate.winner
  );

  const activeToasts = useRef<Set<string>>(new Set());

  const showToast = useCallback((message: string, type: "success" | "error" | "default" = "default") => {
    if (activeToasts.current.has(message)) return;
    activeToasts.current.add(message);

    const t = type === "success"
      ? toast.success(message)
      : type === "error"
      ? toast.error(message)
      : toast(message, { icon: "➤" });

    setTimeout(() => activeToasts.current.delete(message), 4000);
  }, []);

  const fetchUpdatedGame = useCallback(async (retryDelay = 1000) => {
    try {
      const gameRes = await apiClient.get<ApiResponse<Game>>(`/games/code/${game.code}`);
      if (gameRes?.data?.success && gameRes.data.data) {
        setCurrentGame(gameRes.data.data);
        setPlayers(gameRes.data.data.players);
      }
      const propertiesRes = await apiClient.get<ApiResponse<GameProperty[]>>(`/game-properties/game/${game.id}`);
      if (propertiesRes?.data?.success && propertiesRes.data.data) {
        setCurrentGameProperties(propertiesRes.data.data);
      }
      // Safe trade refresh
      try {
        await refreshTrades?.();
      } catch (err) {
        console.warn("Failed to refresh trades (non-critical):", err);
      }
    } catch (err: any) {
      if (err.response?.status === 429) {
        console.warn("Rate limited, retrying after delay...", retryDelay);
        setTimeout(() => fetchUpdatedGame(retryDelay * 2), retryDelay); // exponential backoff
        return;
      }
      console.error("Sync failed:", err);
    }
  }, [game.code, game.id, refreshTrades]);

  useEffect(() => {
    const interval = setInterval(fetchUpdatedGame, 8000);
    return () => clearInterval(interval);
  }, [fetchUpdatedGame]);

  const lockAction = useCallback((type: "ROLL" | "END") => {
    if (actionLock) return false;
    setActionLock(type);
    return true;
  }, [actionLock]);

  const unlockAction = useCallback(() => setActionLock(null), []);

  useEffect(() => {
    setRoll(null);
    setBuyPrompted(false);
    setIsRolling(false);
    setPendingRoll(0);
    landedPositionThisTurn.current = null;
    rolledForPlayerId.current = null;
    turnEndInProgress.current = false;
    lastToastMessage.current = null;
    setAnimatedPositions({});
    setHasMovementFinished(false);
    setStrategyRanThisTurn(false);
    setIsRaisingFunds(false);
    setTurnTimeLeft(null);
  }, [currentPlayerId]);

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

  const END_TURN = useCallback(async (timedOut?: boolean) => {
    if (!currentPlayerId || turnEndInProgress.current || !lockAction("END")) return;
    turnEndInProgress.current = true;

    try {
      await apiClient.post("/game-players/end-turn", {
        user_id: currentPlayerId,
        game_id: currentGame.id,
        ...(timedOut === true && { timed_out: true }),
      });
      showToast(timedOut ? "Time's up! Turn ended." : "Turn ended", timedOut ? "default" : "success");
      await fetchUpdatedGame();
    } catch {
      showToast("Failed to end turn", "error");
    } finally {
      unlockAction();
      turnEndInProgress.current = false;
    }
  }, [currentPlayerId, currentGame.id, fetchUpdatedGame, lockAction, unlockAction, showToast]);

  const playerCanRoll = Boolean(isMyTurn && currentPlayer && (currentPlayer.balance ?? 0) > 0);
  useEffect(() => {
    if (!isMyTurn || !playerCanRoll || isRolling || roll) {
      setTurnTimeLeft(null);
      return;
    }
    // Start countdown immediately: use server turn_start if present, otherwise "now"
    const raw = currentPlayer?.turn_start;
    const turnStartSec = raw ? parseInt(String(raw), 10) : Math.floor(Date.now() / 1000);
    if (Number.isNaN(turnStartSec)) {
      setTurnTimeLeft(null);
      return;
    }
    const TURN_ROLL_SECONDS = 90;
    const tick = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, TURN_ROLL_SECONDS - (nowSec - turnStartSec));
      setTurnTimeLeft(remaining);
      if (remaining <= 0) {
        END_TURN(true);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isMyTurn, playerCanRoll, currentPlayer?.turn_start, isRolling, roll, showToast, END_TURN]);

  const triggerLandingLogic = useCallback((newPosition: number, isSpecial = false) => {
    if (landedPositionThisTurn.current !== null) return;

    landedPositionThisTurn.current = newPosition;
    setIsSpecialMove(isSpecial);
    setHasMovementFinished(true);
  }, []);

  const endTurnAfterSpecialMove = useCallback(() => {
    setBuyPrompted(false);
    landedPositionThisTurn.current = null;
    setIsSpecialMove(false);
    setTimeout(END_TURN, 800);
  }, [END_TURN]);

  const BUY_PROPERTY = useCallback(async () => {
    if (!currentPlayer?.position || actionLock || !justLandedProperty?.price) {
      showToast("Cannot buy right now", "error");
      return;
    }

    const playerBalance = currentPlayer.balance ?? 0;
    if (playerBalance < justLandedProperty.price) {
      showToast("Not enough money!", "error");
      return;
    }

      const buyerUsername = me?.username;
  

  if (!buyerUsername) {
    showToast("Cannot buy: your username is missing", "error");
    return;
  }

    try {
       // Show loading state
    showToast("Sending transaction...", "default");

    // 1. On-chain minimal proof (counters update) - skip if AI is involved
    if (isMyTurn) {
      await transferOwnership('', buyerUsername);
    }

      await apiClient.post("/game-properties/buy", {
        user_id: currentPlayer.user_id,
        game_id: currentGame.id,
        property_id: justLandedProperty.id,
      });

      showToast(`You bought ${justLandedProperty.name}!`, "success");
      setBuyPrompted(false);
      landedPositionThisTurn.current = null;
      await fetchUpdatedGame();
      setTimeout(END_TURN, 800);
    } catch {
      showToast("Purchase failed", "error");
    }
  }, [currentPlayer, justLandedProperty, actionLock, END_TURN, showToast, currentGame.id, fetchUpdatedGame]);

  const ROLL_DICE = useCallback(async (forAI = false) => {
    if (isRolling || actionLock || !lockAction("ROLL")) return;

    const playerId = forAI ? currentPlayerId! : me!.user_id;
    const player = players.find((p) => p.user_id === playerId);
    if (!player) {
      unlockAction();
      return;
    }

    const isInJail = Boolean(player.in_jail) && Number(player.position) === JAIL_POSITION;

    if (isInJail) {
      setIsRolling(true);
      showToast(`${player.username} is in jail — attempting to roll out...`, "default");

      const value = getDiceValues();
      if (!value || value.die1 !== value.die2) {
        setTimeout(async () => {
          try {
            await apiClient.post("/game-players/change-position", {
              user_id: playerId,
              game_id: currentGame.id,
              position: player.position,
              rolled: value?.total ?? 0,
              is_double: false,
            });
            await fetchUpdatedGame();
            showToast("No doubles — still in jail", "error");
            setTimeout(END_TURN, 1000);
          } catch {
            showToast("Jail roll failed", "error");
            END_TURN();
          } finally {
            setIsRolling(false);
            unlockAction();
          }
        }, 800);
        return;
      }

      // Doubles - escape jail with animation
      setRoll(value);
      const currentPos = player.position ?? 0;
      const totalMove = value.total;
      const newPos = (currentPos + totalMove) % BOARD_SQUARES;

      // Animate escape
      if (totalMove > 0) {
        const movePath: number[] = [];
        for (let i = 1; i <= totalMove; i++) {
          movePath.push((currentPos + i) % BOARD_SQUARES);
        }

        for (let i = 0; i < movePath.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, MOVE_ANIMATION_MS_PER_SQUARE));
          setAnimatedPositions((prev) => ({
            ...prev,
            [playerId]: movePath[i],
          }));
        }
      }

      setHasMovementFinished(true);

      setTimeout(async () => {
        try {
          await apiClient.post("/game-players/change-position", {
            user_id: playerId,
            game_id: currentGame.id,
            position: newPos,
            rolled: totalMove,
            is_double: true,
          });
          landedPositionThisTurn.current = newPos;
          await fetchUpdatedGame();
          showToast(`${player.username} rolled doubles and escaped jail!`, "success");
        } catch {
          showToast("Escape failed", "error");
        } finally {
          setIsRolling(false);
          unlockAction();
        }
      }, 800);
      return;
    }

    setIsRolling(true);
    setRoll(null);
    setHasMovementFinished(false);
    setAnimatedPositions({}); // Clear previous animations

    setTimeout(async () => {
      const value = getDiceValues();
      if (!value) {
        showToast("DOUBLES! Roll again!", "success");
        setIsRolling(false);
        unlockAction();
        return;
      }

      setRoll(value);

      const currentPos = player.position ?? 0;
      const totalMove = value.total + pendingRoll;
      let newPos = (currentPos + totalMove) % BOARD_SQUARES;

      // Animate movement for BOTH human and AI
      if (totalMove > 0) {
        const movePath: number[] = [];
        for (let i = 1; i <= totalMove; i++) {
          movePath.push((currentPos + i) % BOARD_SQUARES);
        }

        for (let i = 0; i < movePath.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, MOVE_ANIMATION_MS_PER_SQUARE));
          setAnimatedPositions((prev) => ({
            ...prev,
            [playerId]: movePath[i],
          }));
        }
      }

      setHasMovementFinished(true);

      try {
        await apiClient.post("/game-players/change-position", {
          user_id: playerId,
          game_id: currentGame.id,
          position: newPos,
          rolled: value.total + pendingRoll,
          is_double: value.die1 === value.die2,
        });

        setPendingRoll(0);
        landedPositionThisTurn.current = newPos;
        await fetchUpdatedGame();

        showToast(
          `${player.username} rolled ${value.die1} + ${value.die2} = ${value.total}!`,
          "success"
        );

        if (forAI) rolledForPlayerId.current = currentPlayerId;
      } catch (err) {
        console.error("Move failed:", err);
        showToast("Move failed", "error");
        END_TURN();
      } finally {
        setIsRolling(false);
        unlockAction();
      }
    }, ROLL_ANIMATION_MS);
  }, [
    isRolling,
    actionLock,
    lockAction,
    unlockAction,
    currentPlayerId,
    me,
    players,
    pendingRoll,
    currentGame.id,
    fetchUpdatedGame,
    showToast,
    END_TURN
  ]);

  useMobileAiLogic({
    game,
    properties,
    game_properties,
    me,
    currentGame,
    currentGameProperties,
    players,
    isAITurn,
    currentPlayer,
    strategyRanThisTurn,
    setStrategyRanThisTurn,
    justLandedProperty,
    isRolling,
    roll,
    actionLock,
    hasMovementFinished,
    fetchUpdatedGame,
    showToast,
    ROLL_DICE,
    END_TURN,
    landedPositionRef: landedPositionThisTurn,
  });

  useMobileAiBankruptcy({
    game,
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
    if (!me) return;

    if (me.balance < 0) {
      // Player is bankrupt — show bankruptcy button instead of roll
    }
  }, [me?.balance]);

  useEffect(() => {
    if (!me) return;

    const aiPlayers = players.filter(p => isAIPlayer(p));
    const humanPlayer = me;

    const shouldDeclareVictory =
      (players.length === 1 && players[0].user_id === me.user_id);

    if (shouldDeclareVictory) {
      setWinner(humanPlayer);
      setEndGameCandidate({
        winner: humanPlayer,
        position: humanPlayer.position ?? 0,
        balance: BigInt(humanPlayer.balance),
      });
    }
  }, [players, me]);

  useEffect(() => {
    if (actionLock || isRolling || buyPrompted || !roll || isRaisingFunds || showInsolvencyModal) return;
    const timer = setTimeout(END_TURN, 2000);
    return () => clearTimeout(timer);
  }, [actionLock, isRolling, buyPrompted, roll, isRaisingFunds, showInsolvencyModal, END_TURN]);

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

  const handlePropertyClick = (propertyId: number) => {
    const prop = properties.find(p => p.id === propertyId);
    const gp = currentGameProperties.find(g => g.property_id === propertyId);
    if (prop) {
      setSelectedProperty(prop);
      setSelectedGameProperty(gp);
    }
  };

  const { handleBuild, handleSellBuilding, handleMortgageToggle, handleSellToBank } = useMobilePropertyActions(
    currentGame.id,
    me?.user_id,
    isMyTurn,
    fetchUpdatedGame,
    showToast
  );

  const declareBankruptcy = async () => {
    showToast("Declaring bankruptcy...", "default");

    try {
      if (endGame) await endGame();

      const opponent = players.find(p => p.user_id !== me?.user_id);
      await apiClient.put(`/games/${game.id}`, {
        status: "FINISHED",
        winner_id: opponent?.user_id || null,
      });

      showToast("Game over! You have declared bankruptcy.", "error");
      setShowBankruptcyModal(true);
    } catch (err) {
      showToast("Failed to end game", "error");
    }
  };

  // Buy prompt logic
  useEffect(() => {
    if (!roll || landedPositionThisTurn.current === null || !hasMovementFinished) {
      setBuyPrompted(false);
      return;
    }

    const pos = landedPositionThisTurn.current;
    const square = properties.find(p => p.id === pos);

    if (!square || square.price == null) {
      setBuyPrompted(false);
      return;
    }

    const isOwned = currentGameProperties.some(gp => gp.property_id === pos);
    const action = PROPERTY_ACTION(pos);
    const isBuyableType = !!action && ["land", "railway", "utility"].includes(action);

    const canBuy = !isOwned && isBuyableType;

    setBuyPrompted(canBuy);

    if (canBuy && (currentPlayer?.balance ?? 0) < square.price!) {
      showToast(`Not enough money to buy ${square.name}`, "error");
    }
  }, [
    roll,
    landedPositionThisTurn.current,
    hasMovementFinished,
    properties,
    currentGameProperties,
    currentPlayer,
    showToast,
  ]);

  return (
    <div className="w-full min-h-screen bg-black text-white flex flex-col items-center justify-start relative overflow-hidden">

      <BellNotification bellFlash={bellFlash} incomingCount={myIncomingTrades.length} />

      {/* Player Status + My Balance */}
      <div className="w-full max-w-2xl mx-auto px-4 mt-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <PlayerStatus currentPlayer={currentPlayer} isAITurn={isAITurn} buyPrompted={buyPrompted} />
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
              <div className="flex flex-col items-center justify-center gap-3 text-center min-h-[80px] px-4 py-3 z-30 relative">
                {isMyTurn && !roll && !isRolling && (
                  <div className={`font-mono font-bold rounded-lg px-3 py-1.5 bg-black/90 text-sm ${(turnTimeLeft ?? 90) <= 10 ? "text-red-400 animate-pulse" : "text-cyan-300"}`}>
                    Roll in {Math.floor((turnTimeLeft ?? 90) / 60)}:{((turnTimeLeft ?? 90) % 60).toString().padStart(2, "0")}
                  </div>
                )}
                {isMyTurn && !isRolling && !isRaisingFunds && !showInsolvencyModal && (
                  (currentPlayer?.balance ?? 0) < 0 ? (
                    <button
                      onClick={declareBankruptcy}
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
        isRolling={isRolling && !(currentPlayer?.in_jail && currentPlayer.position === JAIL_POSITION)}
        roll={roll}
      />
      <MyBalanceBar me={me} />
      </div>
      <BuyPromptModal
        visible={!!(isMyTurn && buyPrompted && justLandedProperty)}
        property={justLandedProperty ?? null}
        onBuy={BUY_PROPERTY}
        onSkip={() => {
          showToast("Skipped purchase", "default");
          setBuyPrompted(false);
          landedPositionThisTurn.current = null;
          setTimeout(END_TURN, 800);
        }}
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

      <GameLog history={currentGame.history} />

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
        setShowInsolvencyModal={setShowInsolvencyModal}
        setIsRaisingFunds={setIsRaisingFunds}
        setShowBankruptcyModal={setShowBankruptcyModal}
        fetchUpdatedGame={fetchUpdatedGame}
        showToast={showToast}
      />

      <Toaster
        position="top-center"
        reverseOrder={false}
        gutter={12}
        containerClassName="z-50"
        toastOptions={{
          duration: 3000,
          style: {
            background: "rgba(15, 23, 42, 0.95)",
            color: "#fff",
            border: "1px solid rgba(34, 211, 238, 0.3)",
            borderRadius: "12px",
            padding: "8px 16px",
            fontSize: "14px",
            fontWeight: "600",
            boxShadow: "0 10px 30px rgba(0, 255, 255, 0.15)",
            backdropFilter: "blur(10px)",
          },
          success: { icon: "✔", style: { borderColor: "#10b981" } },
          error: { icon: "✖", style: { borderColor: "#ef4444" } },
        }}
      />

      <style jsx>{`
        @keyframes bell-ring {
          0%, 100% { transform: rotate(0deg); }
          10%, 30%, 50%, 70%, 90% { transform: rotate(-15deg); }
          20%, 40%, 60%, 80% { transform: rotate(15deg); }
        }
        .animate-bell-ring {
          animation: bell-ring 0.8s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default MobileGameLayout;