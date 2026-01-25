"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useEndAIGameAndClaim, useGetGameByCode, useTransferPropertyOwnership } from "@/context/ContractProvider";
import { Game, GameProperty, Property, Player, PROPERTY_ACTION } from "@/types/game";
import { useGameTrades } from "@/hooks/useGameTrades";

import Board from "./board";
import DiceAnimation from "./dice-animation";
import GameLog from "./game-log";
import GameModals from "./game-modals";
import PlayerStatus from "./player-status";
import { Sparkles, X, Bell } from "lucide-react";
import CollectibleInventoryBar from "@/components/collectibles/collectibles-invetory-mobile";
import { ApiResponse } from "@/types/api";
import { useMobilePropertyActions } from "@/hooks/useMobilePropertyActions";

const BOARD_SQUARES = 40;
const ROLL_ANIMATION_MS = 1200;
const MOVE_ANIMATION_MS_PER_SQUARE = 250;
const JAIL_POSITION = 10;

const MIN_SCALE = 1.05;
const MAX_SCALE = 1.05;
const BASE_WIDTH_REFERENCE = 390;

const BUILD_PRIORITY = ["orange", "red", "yellow", "pink", "lightblue", "green", "brown", "darkblue"];

const TOKEN_POSITIONS: Record<number, { x: number; y: number }> = {
  0: { x: 91.5, y: 91.5 },
  1: { x: 81.5, y: 91.5 },
  2: { x: 71.5, y: 91.5 },
  3: { x: 61.5, y: 91.5 },
  4: { x: 51.5, y: 91.5 },
  5: { x: 41.5, y: 91.5 },
  6: { x: 31.5, y: 91.5 },
  7: { x: 21.5, y: 91.5 },
  8: { x: 11.5, y: 91.5 },
  9: { x: 1.5, y: 91.5 },
  10: { x: 1.5, y: 91.5 },
  11: { x: 1.5, y: 81.5 },
  12: { x: 1.5, y: 71.5 },
  13: { x: 1.5, y: 61.5 },
  14: { x: 1.5, y: 51.5 },
  15: { x: 1.5, y: 41.5 },
  16: { x: 1.5, y: 31.5 },
  17: { x: 1.5, y: 21.5 },
  18: { x: 1.5, y: 11.5 },
  19: { x: 1.5, y: 1.5 },
  20: { x: 1.5, y: 1.5 },
  21: { x: 11.5, y: 1.5 },
  22: { x: 21.5, y: 1.5 },
  23: { x: 31.5, y: 1.5 },
  24: { x: 41.5, y: 1.5 },
  25: { x: 51.5, y: 1.5 },
  26: { x: 61.5, y: 1.5 },
  27: { x: 71.5, y: 1.5 },
  28: { x: 81.5, y: 1.5 },
  29: { x: 91.5, y: 1.5 },
  30: { x: 91.5, y: 1.5 },
  31: { x: 91.5, y: 11.5 },
  32: { x: 91.5, y: 21.5 },
  33: { x: 91.5, y: 31.5 },
  34: { x: 91.5, y: 41.5 },
  35: { x: 91.5, y: 51.5 },
  36: { x: 91.5, y: 61.5 },
  37: { x: 91.5, y: 71.5 },
  38: { x: 91.5, y: 81.5 },
  39: { x: 91.5, y: 91.5 },
};

const MONOPOLY_STATS = {
  landingRank: {
    5: 1, 6: 2, 7: 3, 8: 4, 9: 5, 11: 6, 13: 7, 14: 8, 16: 9, 18: 10,
    19: 11, 21: 12, 23: 13, 24: 14, 26: 15, 27: 16, 29: 17, 31: 18, 32: 19, 34: 20, 37: 21, 39: 22,
    1: 30, 2: 25, 3: 29, 4: 35, 12: 32, 17: 28, 22: 26, 28: 33, 33: 27, 36: 24, 38: 23,
  } as { [key: number]: number },

  colorGroups: {
    brown: [1, 3],
    lightblue: [6, 8, 9],
    pink: [11, 13, 14],
    orange: [16, 18, 19],
    red: [21, 23, 24],
    yellow: [26, 27, 29],
    green: [31, 32, 34],
    darkblue: [37, 39],
    railroad: [5, 15, 25, 35],
    utility: [12, 28],
  },
};

const getDiceValues = (): { die1: number; die2: number; total: number } | null => {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const total = die1 + die2;
  return total === 12 ? null : { die1, die2, total };
};

const isAIPlayer = (player: Player | undefined): boolean => {
  return !!player && (
    player.username?.toLowerCase().includes("ai_") ||
    player.username?.toLowerCase().includes("bot")
  );
};

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
  const [gameTimeLeft, setGameTimeLeft] = useState(0);
  const [turnTimeLeft, setTurnTimeLeft] = useState(60);

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



  console.log("END TIMEs",endTime)

  
  

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
  const isAITurn = isAIPlayer(currentPlayer);

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

  //   useEffect(() => {
  //   if (!endTime) return;
  
  //   const update = () => {
  //     const now = Date.now();
  //     const remainingMs = Math.max(endTime - now);
  //     console.log("REMAINING MS",remainingMs)
  //     setGameTimeLeft(Math.floor(remainingMs / 1000));
  //   };
  
  //   update();
  //   const interval = setInterval(update, 1000);
  
  //   return () => clearInterval(interval);
  // }, [endTime, isMyTurn]);

  const {
    write: endGame,
    isPending: endGamePending,
    isSuccess: endGameSuccess,
    error: endGameError,
    txHash: endGameTxHash,
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

  const END_TURN = useCallback(async () => {
    if (!currentPlayerId || turnEndInProgress.current || !lockAction("END")) return;
    turnEndInProgress.current = true;

    try {
      await apiClient.post("/game-players/end-turn", {
        user_id: currentPlayerId,
        game_id: currentGame.id,
      });
      showToast("Turn ended", "success");
      await fetchUpdatedGame();
    } catch {
      showToast("Failed to end turn", "error");
    } finally {
      unlockAction();
      turnEndInProgress.current = false;
    }
  }, [currentPlayerId, currentGame.id, fetchUpdatedGame, lockAction, unlockAction, showToast]);

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

    const isInJail = player.in_jail === true && player.position === JAIL_POSITION;

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

  const getPlayerOwnedProperties = useCallback((playerAddress: string | undefined) => {
    if (!playerAddress) return [];
    return currentGameProperties
      .filter(gp => gp.address?.toLowerCase() === playerAddress.toLowerCase())
      .map(gp => ({
        gp,
        prop: properties.find(p => p.id === gp.property_id)!,
      }))
      .filter(item => !!item.prop);
  }, [currentGameProperties, properties]);

  const getCompleteMonopolies = useCallback((playerAddress: string | undefined) => {
    if (!playerAddress) return [];
    const owned = getPlayerOwnedProperties(playerAddress);
    const monopolies: string[] = [];

    Object.entries(MONOPOLY_STATS.colorGroups).forEach(([groupName, ids]) => {
      if (groupName === "railroad" || groupName === "utility") return;
      const ownedInGroup = owned.filter(o => ids.includes(o.prop.id));
      if (ownedInGroup.length === ids.length && ownedInGroup.every(o => !o.gp.mortgaged)) {
        monopolies.push(groupName);
      }
    });

    return monopolies.sort((a, b) => BUILD_PRIORITY.indexOf(a) - BUILD_PRIORITY.indexOf(b));
  }, [getPlayerOwnedProperties]);

  const handleAiBuilding = async (player: Player) => {
    if (!player.address) return;

    const monopolies = getCompleteMonopolies(player.address);
    if (monopolies.length === 0) return;

    let built = false;

    for (const groupName of monopolies) {
      const ids = MONOPOLY_STATS.colorGroups[groupName as keyof typeof MONOPOLY_STATS.colorGroups];
      const groupGps = currentGameProperties.filter(gp => ids.includes(gp.property_id) && gp.address === player.address);

      const developments = groupGps.map(gp => gp.development ?? 0);
      const minHouses = Math.min(...developments);
      const maxHouses = Math.max(...developments);

      if (maxHouses > minHouses + 1 || minHouses >= 5) continue;

      const prop = properties.find(p => ids.includes(p.id))!;
      const houseCost = prop.cost_of_house ?? 0;
      if (houseCost === 0) continue;

      const affordable = Math.floor((player.balance ?? 0) / houseCost);
      if (affordable < ids.length) continue;

      for (const gp of groupGps.filter(g => (g.development ?? 0) === minHouses)) {
        try {
          await apiClient.post("/game-properties/development", {
            game_id: currentGame.id,
            user_id: player.user_id,
            property_id: gp.property_id,
          });
          built = true;
          await fetchUpdatedGame();
          await new Promise(r => setTimeout(r, 600));
        } catch (err) {
          console.error("Build failed", err);
          break;
        }
      }

      if (built) break;
    }
  };

  const handleAiBuyDecision = useCallback(async () => {
    if (!isAITurn || !justLandedProperty || !justLandedProperty.price || !currentPlayer) return;

    const isOwned = currentGameProperties.some(gp => gp.property_id === justLandedProperty.id);
    if (isOwned || justLandedProperty.type !== "property") return;

    const balance = currentPlayer.balance ?? 0;
    const price = justLandedProperty.price;

    const ownedInGroup = getPlayerOwnedProperties(currentPlayer.address)
      .filter(o => {
        return Object.entries(MONOPOLY_STATS.colorGroups).some(([_, ids]) =>
          ids.includes(o.prop.id) && ids.includes(justLandedProperty.id)
        );
      }).length;

    const groupSize = Object.values(MONOPOLY_STATS.colorGroups)
      .find(ids => ids.includes(justLandedProperty.id))?.length || 0;

    const completesMonopoly = groupSize > 0 && ownedInGroup === groupSize - 1;
    const goodLandingRank = (MONOPOLY_STATS.landingRank[justLandedProperty.id] ?? 99) <= 15;
    const affordable = balance >= price + 200;

    const shouldBuy = completesMonopoly || (goodLandingRank && affordable);

    if (shouldBuy) {
      try {
        await apiClient.post("/game-properties/buy", {
          user_id: currentPlayer.user_id,
          game_id: currentGame.id,
          property_id: justLandedProperty.id,
        });
        await fetchUpdatedGame();
      } catch (err) {
        console.error("AI purchase failed", err);
      }
    }

    landedPositionThisTurn.current = null;
  }, [isAITurn, justLandedProperty, currentPlayer, currentGameProperties, properties, currentGame.id, fetchUpdatedGame, getPlayerOwnedProperties]);

   const getNearCompleteOpportunities = (playerAddress: string | undefined, game_properties: GameProperty[], properties: Property[]) => {
    if (!playerAddress) return [];

    const owned = getPlayerOwnedProperties(playerAddress);
    const opportunities: {
      group: string;
      needs: number;
      missing: { id: number; name: string; ownerAddress: string | null; ownerName: string }[];
    }[] = [];

    Object.entries(MONOPOLY_STATS.colorGroups).forEach(([groupName, ids]) => {
      if (groupName === "railroad" || groupName === "utility") return;

      const ownedCount = owned.filter(o => ids.includes(o.prop.id)).length;
      const needs = ids.length - ownedCount;

      if (needs === 1 || needs === 2) {
        const missing = ids
          .filter(id => !owned.some(o => o.prop.id === id))
          .map(id => {
            const gp = game_properties.find(g => g.property_id === id);
            const prop = properties.find(p => p.id === id)!;
            const ownerName = gp?.address
              ? players.find(p => p.address?.toLowerCase() === gp.address?.toLowerCase())?.username || gp.address.slice(0, 8)
              : "Bank";
            return {
              id,
              name: prop.name,
              ownerAddress: gp?.address || null,
              ownerName,
            };
          });

        opportunities.push({ group: groupName, needs, missing });
      }
    });

    return opportunities.sort((a, b) => {
      if (a.needs !== b.needs) return a.needs - b.needs;
      return BUILD_PRIORITY.indexOf(a.group) - BUILD_PRIORITY.indexOf(b.group);
    });
  };

  const calculateTradeFavorability = (
    trade: { offer_properties: number[]; offer_amount: number; requested_properties: number[]; requested_amount: number },
    receiverAddress: string
  ) => {
    let score = 0;

    score += trade.offer_amount - trade.requested_amount;

    trade.requested_properties.forEach(id => {
      const prop = properties.find(p => p.id === id);
      if (!prop) return;
      score += prop.price || 0;

      const group = Object.values(MONOPOLY_STATS.colorGroups).find(g => g.includes(id));
      if (group && !["railroad", "utility"].includes(prop.color!)) {
        const currentOwned = group.filter(gid =>
          game_properties.find(gp => gp.property_id === gid && gp.address === receiverAddress)
        ).length;
        if (currentOwned === group.length - 1) score += 300;
        else if (currentOwned === group.length - 2) score += 120;
      }
    });

    trade.offer_properties.forEach(id => {
      const prop = properties.find(p => p.id === id);
      if (!prop) return;
      score -= (prop.price || 0) * 1.3;
    });

    return score;
  };

  const calculateFairCashOffer = (propertyId: number, completesSet: boolean, basePrice: number) => {
    return completesSet ? Math.floor(basePrice * 1.6) : Math.floor(basePrice * 1.3);
  };

  const getPropertyToOffer = (playerAddress: string, excludeGroups: string[] = []) => {
    const owned = getPlayerOwnedProperties(playerAddress);
    const candidates = owned.filter(o => {
      const group = Object.keys(MONOPOLY_STATS.colorGroups).find(g =>
        MONOPOLY_STATS.colorGroups[g as keyof typeof MONOPOLY_STATS.colorGroups].includes(o.prop.id)
      );
      if (!group || excludeGroups.includes(group)) return false;
      if (o.gp.development! > 0) return false;
      return true;
    });

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => (a.prop.price || 0) - (b.prop.price || 0));
    return candidates[0];
  };

    const refreshGame = async () => {
    try {
      const res = await apiClient.get<ApiResponse>(`/games/code/${game.code}`);
      if (res?.data?.success) {
        setPlayers(res.data.data.players);
      }
    } catch (err) {
      console.error("Refresh failed", err);
    }
  };

const handleAiStrategy = async () => {
    if (!currentPlayer || !isAITurn || strategyRanThisTurn) return;

    showToast(`${currentPlayer.username} is thinking... 🧠`, "default");

    const opportunities = getNearCompleteOpportunities(currentPlayer.address, game_properties, properties);
    let maxTradeAttempts = 1;

    for (const opp of opportunities) {
      if (maxTradeAttempts <= 0) break;

      for (const missing of opp.missing) {
        if (!missing.ownerAddress || missing.ownerAddress === "bank") continue;

        const targetPlayer = players.find(p => p.address?.toLowerCase() === missing.ownerAddress?.toLowerCase());
        if (!targetPlayer) continue;

        const basePrice = properties.find(p => p.id === missing.id)?.price || 200;
        const cashOffer = calculateFairCashOffer(missing.id, opp.needs === 1, basePrice);

        let offerProperties: number[] = [];
        if ((currentPlayer.balance ?? 0) < cashOffer + 300) {
          const toOffer = getPropertyToOffer(currentPlayer.address!, [opp.group]);
          if (toOffer) {
            offerProperties = [toOffer.prop.id];
            showToast(`AI offering ${toOffer.prop.name} in deal`, "default");
          }
        }

        const payload = {
          game_id: game.id,
          player_id: currentPlayer.user_id,
          target_player_id: targetPlayer.user_id,
          offer_properties: offerProperties,
          offer_amount: cashOffer,
          requested_properties: [missing.id],
          requested_amount: 0,
        };

        try {
          const res = await apiClient.post<ApiResponse>("/game-trade-requests", payload);
          if (res?.data?.success) {
            showToast(`AI offered $${cashOffer}${offerProperties.length ? " + property" : ""} for ${missing.name}`, "default");
            maxTradeAttempts--;

            if (isAIPlayer(targetPlayer)) {
              await new Promise(r => setTimeout(r, 800));
              const favorability = calculateTradeFavorability(
                { ...payload, requested_amount: 0 },
                targetPlayer.address!
              );

              if (favorability >= 50) {
                await apiClient.post("/game-trade-requests/accept", { id: res.data.data.id });
                showToast(`${targetPlayer.username} accepted deal! 🤝`, "success");
                await refreshGame();
              } else {
                await apiClient.post("/game-trade-requests/decline", { id: res.data.data.id });
                showToast(`${targetPlayer.username} declined`, "default");
              }
            } else {
              showToast(`Trade proposed to ${targetPlayer.username}`, "default");
            }
          }
        } catch (err) {
          console.error("Trade failed", err);
        }

        await new Promise(r => setTimeout(r, 1200));
      }
    }

    await handleAiBuilding(currentPlayer);
    setStrategyRanThisTurn(true);
    showToast(`${currentPlayer.username} ready to roll`, "default");
  };

  useEffect(() => {
    if (isAITurn && currentPlayer && !strategyRanThisTurn) {
      const timer = setTimeout(handleAiStrategy, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAITurn, currentPlayer, strategyRanThisTurn, handleAiStrategy]);

  useEffect(() => {
    if (isAITurn && !isRolling && !roll && !actionLock && strategyRanThisTurn) {
      const timer = setTimeout(() => ROLL_DICE(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isAITurn, isRolling, roll, actionLock, strategyRanThisTurn, ROLL_DICE]);

  useEffect(() => {
    if (isAITurn && hasMovementFinished && roll && landedPositionThisTurn.current !== null) {
      const timer = setTimeout(handleAiBuyDecision, 1200);
      return () => clearTimeout(timer);
    }
  }, [isAITurn, hasMovementFinished, roll, landedPositionThisTurn.current, handleAiBuyDecision]);

  const aiSellHouses = async (player: Player) => {
    const improved = currentGameProperties
      .filter(gp => gp.address === player.address && (gp.development ?? 0) > 0);

    for (const gp of improved) {
      const prop = properties.find(p => p.id === gp.property_id);
      if (!prop?.cost_of_house) continue;

      const houses = gp.development ?? 0;
      for (let i = 0; i < houses; i++) {
        try {
          await apiClient.post("/game-properties/downgrade", {
            game_id: currentGame.id,
            user_id: player.user_id,
            property_id: gp.property_id,
          });
          await fetchUpdatedGame();
        } catch (err) {
          console.error("AI failed to sell house", err);
          break;
        }
      }
    }
  };

  const aiMortgageProperties = async (player: Player) => {
    const unmortgaged = currentGameProperties
      .filter(gp => gp.address === player.address && !gp.mortgaged && gp.development === 0);

    for (const gp of unmortgaged) {
      try {
        await apiClient.post("/game-properties/mortgage", {
          game_id: currentGame.id,
          user_id: player.user_id,
          property_id: gp.property_id,
        });
        await fetchUpdatedGame();
      } catch (err) {
        console.error("AI failed to mortgage", err);
      }
    }
  };

  const handlePropertyTransfer = async (propertyId: number, newPlayerId: number) => {
    try {
      const res = await apiClient.put<ApiResponse>(`/game-properties/${propertyId}`, {
        game_id: currentGame.id,
        player_id: newPlayerId,
      });
      return res.data?.success ?? false;
    } catch (err) {
      console.error("Transfer failed", err);
      return false;
    }
  };

  const handleDeleteGameProperty = async (id: number) => {
    try {
      const res = await apiClient.delete<ApiResponse>(`/game-properties/${id}`, {
        data: { game_id: currentGame.id },
      });
      return res.data?.success ?? false;
    } catch (err) {
      console.error("Delete failed", err);
      return false;
    }
  };
  const getGamePlayerId = useCallback((walletAddress: string | undefined): number | null => {
    if (!walletAddress) return null;
    const ownedProp = currentGameProperties.find(gp => gp.address?.toLowerCase() === walletAddress.toLowerCase());
    return ownedProp?.player_id ?? null;
  }, [currentGameProperties]);

  const processingBankruptcy = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (
      !isAITurn ||
      !currentPlayer ||
      currentPlayer.balance >= 0 ||
      !isAIPlayer(currentPlayer) ||
      processingBankruptcy.current.has(currentPlayer.user_id)
    ) {
      return;
    }

    const handleAiBankruptcy = async () => {
      // Mark as processing immediately
      processingBankruptcy.current.add(currentPlayer.user_id);

      const mainToastId = toast.loading(
        `${currentPlayer.username} is bankrupt — eliminating...`,
        { duration: 15000 }
      );

      try {
        setIsRaisingFunds(true);

        // Sell houses
        await aiSellHouses(currentPlayer);
        // Mortgage properties
        await aiMortgageProperties(currentPlayer);
        // Refresh once after liquidation
        await fetchUpdatedGame();

        // Transfer or delete properties
        const aiProps = currentGameProperties.filter(
          (gp) => gp.address === currentPlayer.address
        );
        const landedGp = currentGameProperties.find(
          (gp) => gp.property_id === currentPlayer.position
        );
        const creditorAddr =
          landedGp?.address && landedGp.address !== "bank" ? landedGp.address : null;
        const creditor = creditorAddr
          ? players.find(
              (p) =>
                p.address?.toLowerCase() === creditorAddr.toLowerCase()
            )
          : null;

        if (creditor && !isAIPlayer(creditor)) {
          const creditorId = getGamePlayerId(creditor.address);
          if (creditorId) {
            for (const prop of aiProps) {
              await handlePropertyTransfer(prop.id, creditorId);
            }
          } else {
            for (const prop of aiProps) {
              await handleDeleteGameProperty(prop.id);
            }
          }
        } else {
          for (const prop of aiProps) {
            await handleDeleteGameProperty(prop.id);
          }
        }

           await apiClient.post("/game-players/end-turn", {
                user_id: currentPlayer.user_id,
                game_id: currentGame.id,
              });

        // Finally leave the game
        await apiClient.post("/game-players/leave", {
          address: currentPlayer.address,
          code: game.code,
          reason: "bankruptcy",
        });

        await fetchUpdatedGame();

        toast.dismiss(mainToastId);
        toast.success(`${currentPlayer.username} has been eliminated.`, {
          duration: 6000,
        });
      } catch (err) {
        console.error("AI bankruptcy failed:", err);
        toast.dismiss(mainToastId);
        toast.error("Failed to process bankruptcy");
      } finally {
        setIsRaisingFunds(false);
        // Optional: clean up ref after some delay
        setTimeout(() => {
          processingBankruptcy.current.delete(currentPlayer.user_id);
        }, 5000);
      }
    };

    handleAiBankruptcy();
  }, [
    isAITurn,
    currentPlayer?.user_id,
    currentPlayer?.balance,
    currentPlayer?.address,
    currentPlayer?.position,
  ]);

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

  const handleDevelopment = async () => {
    if (!selectedGameProperty || !me || !isMyTurn) {
      showToast("Not your turn or invalid property", "error");
      return;
    }

    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/development", {
        game_id: currentGame.id,
        user_id: me.user_id,
        property_id: selectedGameProperty.property_id,
      });

      if (res.data?.success) {
        const currentDev = selectedGameProperty.development ?? 0;
        const isBuilding = currentDev < 5;
        const item = currentDev === 4 && isBuilding ? "hotel" : "house";
        const action = isBuilding ? "built" : "sold";
        showToast(`Successfully ${action} ${item}!`, "success");
        await fetchUpdatedGame();
        setSelectedProperty(null);
      } else {
        showToast(res.data?.message || "Action failed", "error");
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || "Development failed", "error");
    }
  };

  const isOwnedByMe = selectedGameProperty?.address?.toLowerCase() === me?.address?.toLowerCase();
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

    // useEffect(() => {
    // if (!isMyTurn) {
    //   setTurnTimeLeft(60);
    //   return;
    // }

  //   const fetchMyGamePlayer = async () => {
  //     const m = getGamePlayerId(me?.address);
  //     if (!m) {
  //       console.warn("No game player ID for me");
  //       return;
  //     }

  //     try {
  //       const res = await apiClient.get<ApiResponse>(`/game-players/${m}`);
  //       console.log("Fetched my game player:", res.data);
        
  //       const startTime = res.data?.data?.duration_per_player 
  //         ? new Date(res.data.data.duration_per_player).getTime() 
  //         : Date.now();

  //       const update = () => {
  //         const now = Date.now();
  //         const elapsed = Math.floor((now - startTime) / 1000);
  //         const remaining = Math.max(60 - elapsed, 0);
  //         setTurnTimeLeft(remaining);
  //         if (remaining <= 0) {
  //           // Optional: Auto-end turn if time expires
  //           // END_TURN();
  //         }
  //       };

  //       update();
  //       const interval = setInterval(update, 1000);
  //       return () => clearInterval(interval);
  //     } catch (err) {
  //       console.error("Failed to fetch my game player:", err);
  //     }
  //   };

  //   fetchMyGamePlayer();
  // }, [isMyTurn, END_TURN, me?.address, getGamePlayerId]);

  return (
    <div className="w-full min-h-screen bg-black text-white flex flex-col items-center justify-start relative overflow-hidden">

      {/* Bell Notification – Trade Incoming Indicator */}
      <div className="fixed top-4 right-20 z-50 flex items-center">
        <motion.button
          animate={bellFlash ? { rotate: [0, -20, 20, -20, 20, 0] } : { rotate: 0 }}
          transition={{ duration: 0.6 }}
          onClick={() => {
            toast("Check the Trades section in the sidebar →", { duration: 4000 });
          }}
          className="relative p-3 bg-purple-700/80 backdrop-blur-md rounded-full shadow-lg hover:bg-purple-600 transition"
        >
          <Bell className="w-7 h-7 text-white" />

          {myIncomingTrades.length > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
              {myIncomingTrades.length}
            </span>
          )}
        </motion.button>
      </div>

      {/* Player Status + My Balance */}
      <div className="w-full max-w-2xl mx-auto px-4 mt-4">
        <PlayerStatus currentPlayer={currentPlayer} isAITurn={isAITurn} buyPrompted={buyPrompted} />

   

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
          />
        </motion.div>
      </div>

      <DiceAnimation
        isRolling={isRolling && !(currentPlayer?.in_jail && currentPlayer.position === JAIL_POSITION)}
        roll={roll}
      />

      {/* Roll Dice OR Declare Bankruptcy */}
      {isMyTurn && !isRolling && !isRaisingFunds && !showInsolvencyModal && (
        <>
          {me && me.balance >= 0 && !roll && (
     <div className="flex justify-center items-center w-full mb-8">
  <button
    onClick={() => ROLL_DICE(false)}
    className="
      py-2.5 px-10
      bg-gradient-to-r from-cyan-500 to-cyan-600 
      hover:from-cyan-400 hover:to-cyan-500 
      active:from-cyan-600 active:to-cyan-700 
      text-white font-bold text-base tracking-wide rounded-full 
      shadow-lg shadow-cyan-500/40 border border-cyan-300/30 
      transition-all duration-300 
      hover:scale-105 hover:shadow-xl hover:shadow-cyan-400/60 
      active:scale-95
    "
  >
    Roll Dice
  </button>
</div>
          )}

          {me && me.balance < 0 && (
            <div className="w-full max-w-md mx-auto mb-8 text-center">
              <div className="text-red-400 text-xl font-bold mb-4 animate-pulse">
                BANKRUPT — Balance: ${Math.abs(me.balance).toLocaleString()}
              </div>
              <button
                onClick={declareBankruptcy}
                className="w-full py-4 px-8 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-800 text-white font-black text-2xl tracking-wide rounded-full shadow-2xl shadow-red-900/50 border-4 border-red-400 transition-all duration-300 hover:scale-105 active:scale-95 animate-pulse"
              >
                DECLARE BANKRUPTCY
              </button>
              <p className="text-gray-400 text-sm mt-4">
                You cannot continue with a negative balance.
              </p>
            </div>
          )}
        </>
      )}
    {me && (
  <div className="mt-4 flex items-center justify-start gap-4 rounded-xl px-5 py-3 border border-white/20 flex-wrap gap-y-2">

    {/* Balance */}
    <div className="flex items-center gap-3">
      <span className="text-sm opacity-80">Bal:</span>

      {(() => {
        // Define the function here
        const getBalanceColor = (bal: number): string => {
          if (bal >= 1300) return "text-cyan-300";
          if (bal >= 1000) return "text-emerald-400";
          if (bal >= 750) return "text-yellow-400";
          if (bal >= 150) return "text-orange-400";
          return "text-red-500 animate-pulse";
        };

        const balance = me?.balance ?? 0;
        return (
          <span className={`text-xl font-bold ${getBalanceColor(balance)} drop-shadow-md`}>
            ${Number(balance).toLocaleString()}
          </span>
        );
      })()}
    </div>

    {/* Time left */}
    {/* <div className="flex items-center gap-3">
      <span className="text-sm opacity-80">Time left:</span>
      {(() => {
        const totalSeconds = gameTimeLeft ?? 0;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        const timeColor =
          totalSeconds <= 60 ? "text-red-500 animate-pulse" :
          totalSeconds <= 300 ? "text-yellow-400" :
          "text-green-400";

        return (
          <span className={`text-xl font-bold ${timeColor} drop-shadow-md`}>
            {minutes}:{seconds.toString().padStart(2, "0")}
          </span>
        );
      })()}
    </div> */}

    {/* Turn Time */}
    {/* <div className="flex items-center gap-3">
      <span className="text-sm opacity-80">Turn Time:</span>
      {(() => {
        const totalSeconds = turnTimeLeft;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        const timeColor =
          totalSeconds <= 10 ? "text-red-500 animate-pulse" :
          totalSeconds <= 30 ? "text-yellow-400" :
          "text-green-400";

        return (
          <span className={`text-xl font-bold ${timeColor} drop-shadow-md`}>
            {minutes}:{seconds.toString().padStart(2, "0")}
          </span>
        );
      })()}
    </div> */}
  </div>
)}
      </div>
      {/* Buy Prompt Modal */}
      <AnimatePresence>
        {isMyTurn && buyPrompted && justLandedProperty && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 bg-gray-900/95 backdrop-blur-lg p-6 rounded-t-3xl shadow-2xl z-[60] border-t border-cyan-500/30"
          >
            <div className="max-w-md mx-auto text-center">
              <h3 className="text-2xl font-bold text-white mb-2">
                Buy {justLandedProperty.name}?
              </h3>
              <p className="text-lg text-gray-300 mb-6">
                Price: ${justLandedProperty.price?.toLocaleString()}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={BUY_PROPERTY}
                  className="py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-xl rounded-2xl shadow-lg hover:scale-105 transition"
                >
                  Buy
                </button>
                <button
                  onClick={() => {
                    showToast("Skipped purchase", "default");
                    setBuyPrompted(false);
                    landedPositionThisTurn.current = null;
                    setTimeout(END_TURN, 800);
                  }}
                  className="py-4 bg-gray-700 text-white font-bold text-xl rounded-2xl shadow-lg hover:scale-105 transition"
                >
                  Skip
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Property Detail Modal */}
      <AnimatePresence>
        {selectedProperty && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedProperty(null)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 rounded-2xl shadow-2xl border border-cyan-500/50 max-w-sm w-full overflow-hidden"
            >
              <div className={`h-20 bg-${selectedProperty.color || 'gray'}-600`} />
              <div className="p-6">
                <h2 className="text-2xl font-bold text-center mb-4">{selectedProperty.name}</h2>
                <p className="text-center text-gray-300 mb-6">Price: ${selectedProperty.price}</p>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span>Current Rent:</span>
                    <span className="font-bold text-yellow-400">
                      ${getCurrentRent(selectedProperty, selectedGameProperty)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Owner:</span>
                    <span className="font-medium">
                      {selectedGameProperty?.address
                        ? players.find(p => p.address?.toLowerCase() === selectedGameProperty.address?.toLowerCase())?.username || "Player"
                        : "Bank"}
                    </span>
                  </div>
                  {selectedGameProperty?.development != null && selectedGameProperty.development > 0 && (
                    <div className="flex justify-between">
                      <span>Buildings:</span>
                      <span>{selectedGameProperty.development === 5 ? "Hotel" : `${selectedGameProperty.development} House(s)`}</span>
                    </div>
                  )}
                  {selectedGameProperty?.mortgaged && (
                    <div className="text-red-400 font-bold text-center mt-3">MORTGAGED</div>
                  )}
                </div>

                {isOwnedByMe && isMyTurn && selectedGameProperty && (
                  <div className="grid grid-cols-2 gap-4 mt-8">
                    <button
                      onClick={handleDevelopment}
                      disabled={selectedGameProperty.development === 5}
                      className="py-3 bg-green-600 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-500 transition"
                    >
                      {selectedGameProperty.development === 4 ? "Build Hotel" : "Build House"}
                    </button>
                    <button
                      onClick={() => handleSellBuilding(selectedGameProperty.property_id)}
                      disabled={!selectedGameProperty.development || selectedGameProperty.development === 0}
                      className="py-3 bg-orange-600 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-500 transition"
                    >
                      Sell House/Hotel
                    </button>
                    <button
                      onClick={() => handleMortgageToggle(selectedGameProperty.property_id, !!selectedGameProperty.mortgaged)}
                      className="py-3 bg-red-600 rounded-xl font-bold hover:bg-red-500 transition"
                    >
                      {selectedGameProperty.mortgaged ? "Redeem" : "Mortgage"}
                    </button>
                    <button
                      onClick={() => handleSellToBank(selectedGameProperty.property_id)}
                      disabled={(selectedGameProperty.development ?? 0) > 0}
                      className="py-3 bg-purple-600 rounded-xl font-bold disabled:opacity-50 hover:bg-purple-500 transition"
                    >
                      Sell Property
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setSelectedProperty(null)}
                  className="w-full mt-6 py-3 bg-gray-700 rounded-xl font-bold hover:bg-gray-600 transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Perks Button */}
      <button
        onClick={() => setShowPerksModal(true)}
        className="fixed bottom-20 right-6 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 shadow-2xl shadow-cyan-500/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
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
              className="fixed inset-0 bg-black/80 z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 top-16 z-50 bg-[#0A1C1E] rounded-t-3xl border-t border-cyan-500/50 overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-cyan-900/50 flex items-center justify-between">
                <h2 className="text-3xl font-bold flex items-center gap-4">
                  <Sparkles className="w-10 h-10 text-[#00F0FF]" />
                  My Perks
                </h2>
                <button
                  onClick={() => setShowPerksModal(false)}
                  className="text-gray-400 hover:text-white p-2"
                >
                  <X className="w-8 h-8" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-8">
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