"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PropertyCardMobile from "./cards/property-card-mobile";
import SpecialCard from "./cards/special-card";
import CornerCard from "./cards/corner-card";
import { getPlayerSymbol } from "@/lib/types/symbol";
import {
  Game,
  GameProperty,
  Property,
  Player,
  PROPERTY_ACTION,
} from "@/types/game";
import { apiClient } from "@/lib/api";
import toast, { Toaster } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

interface CardPopup {
  type: "chance" | "community_chest";
  message: string;
}

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

// ==================== AI DECISION ENGINE ====================
const MONOPOLY_STATS = {
  landingRank: {
    5: 1, 6: 2, 7: 3, 8: 4, 9: 5, 11: 6, 13: 7, 14: 8, 16: 9, 18: 10,
    19: 11, 21: 12, 23: 13, 24: 14, 26: 15, 27: 16, 29: 17, 31: 18, 32: 19, 34: 20, 37: 21, 39: 22,
    1: 30, 2: 25, 3: 29, 4: 35, 12: 32, 17: 28, 22: 26, 28: 33, 33: 27, 36: 24, 38: 23,
  },
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

const calculateBuyScore = (
  property: Property,
  player: Player,
  gameProperties: GameProperty[],
  allProperties: Property[]
): number => {
  if (!property.price || property.type !== "property") return 0;

  const price = property.price!;
  const baseRent = property.rent_site_only || 0;
  const cash = player.balance;
  let score = 50;

  if (cash < price * 1.3) score -= 70;
  else if (cash > price * 3) score += 20;
  else if (cash > price * 2) score += 10;

  const group = Object.values(MONOPOLY_STATS.colorGroups).find(g => g.includes(property.id));
  if (group && !["railroad", "utility"].includes(property.color!)) {
    const owned = group.filter(id =>
      gameProperties.find(gp => gp.property_id === id)?.address === player.address
    ).length;

    if (owned === group.length - 1) score += 90;
    else if (owned >= 1) score += 35;
  }

  if (property.color === "railroad") {
    const owned = gameProperties.filter(gp =>
      gp.address === player.address &&
      allProperties.find(p => p.id === gp.property_id)?.color === "railroad"
    ).length;
    score += owned * 28;
  }
  if (property.color === "utility") {
    const owned = gameProperties.filter(gp =>
      gp.address === player.address &&
      allProperties.find(p => p.id === gp.property_id)?.type === "utility"
    ).length;
    score += owned * 35;
  }

  const rank = (MONOPOLY_STATS.landingRank as Record<number, number>)[property.id] ?? 25;
  score += (30 - rank);

  const roi = baseRent / price;
  if (roi > 0.12) score += 25;
  else if (roi > 0.08) score += 12;

  if (group) {
    const opponentOwns = group.some(id => {
      const gp = gameProperties.find(gp => gp.property_id === id);
      return gp && gp.address !== player.address;
    });
    if (opponentOwns && group.length <= 3) score += 30;
  }

  return Math.max(5, Math.min(98, score));
};

// ==================== DICE & MOCK CARDS ====================
const BOARD_SQUARES = 40;
const ROLL_ANIMATION_MS = 800;

const DiceFace = ({ value }: { value: number }) => {
  const dotPositions: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [28, 72], [72, 28], [72, 72]],
    5: [[28, 28], [28, 72], [50, 50], [72, 28], [72, 72]],
    6: [[28, 28], [28, 50], [28, 72], [72, 28], [72, 50], [72, 72]],
  };

  return (
    <>
      {dotPositions[value].map(([x, y], i) => (
        <div
          key={i}
          className="absolute w-5 h-5 bg-black rounded-full shadow-inner"
          style={{
            top: `${y}%`,
            left: `${x}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </>
  );
};

const getDiceValues = (): { die1: number; die2: number; total: number } | null => {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const total = die1 + die2;
  return total === 12 ? null : { die1, die2, total };
};

const getMockCardMessage = (type: "chance" | "community_chest") => {
  const chanceCards = [
    "Advance to Go (Collect $200)",
    "Bank pays you dividend of $50",
    "Pay poor tax of $15",
  ];
  const communityCards = [
    "Advance to Go (Collect $200)",
    "Doctor's fee. Pay $50",
    "You inherit $100",
  ];
  const cards = type === "chance" ? chanceCards : communityCards;
  return cards[Math.floor(Math.random() * cards.length)];
};

// ==================== POSITION HELPERS ====================
const isTopRow = (square: Property) => square.grid_row === 1;
const isBottomRow = (square: Property) => square.grid_row === 11;
const isLeftColumn = (square: Property) => square.grid_col === 1;
const isRightColumn = (square: Property) => square.grid_col === 11;

// ==================== MAIN COMPONENT ====================
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
  const [currentCard, setCurrentCard] = useState<CardPopup | null>(null);
  const [buyPrompted, setBuyPrompted] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [focusedProperty, setFocusedProperty] = useState<Property | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);

  const currentPlayerId = currentGame.next_player_id;
  const currentPlayer = players.find((p) => p.user_id === currentPlayerId);
  const isMyTurn = me?.user_id === currentPlayerId;
  const isAITurn =
    currentPlayer?.username?.toLowerCase().includes("ai_") ||
    currentPlayer?.username?.toLowerCase().includes("bot");

  const lastProcessed = useRef<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const rolledForPlayerId = useRef<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const currentProperty = currentPlayer?.position
    ? properties.find(p => p.id === currentPlayer.position)
    : null;

  const buyScore = useMemo(() => {
    if (!isAITurn || !buyPrompted || !currentPlayer || !currentProperty) return null;
    return calculateBuyScore(currentProperty, currentPlayer, currentGameProperties, properties);
  }, [isAITurn, buyPrompted, currentPlayer, currentProperty, currentGameProperties, properties]);

  const showToast = useCallback((message: string, type: "success" | "error" | "default" = "default") => {
    toast.dismiss();
    if (type === "success") toast.success(message);
    else if (type === "error") toast.error(message);
    else toast(message, { icon: "➤" });
  }, []);

  useEffect(() => {
    if (currentGame?.players) setPlayers(currentGame.players);
  }, [currentGame?.players]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [currentGame.history?.length]);

  // Winner detection & set game to FINISHED
  useEffect(() => {
    const activePlayers = players.filter(p => p.balance > 0);

    if (activePlayers.length === 1) {
      const theWinner = activePlayers[0];

      // Update backend: set game status to FINISHED and declare winner
      apiClient
        .put<ApiResponse>(`/games/${game.id}`, {
          status: "FINISHED",
          winner_id: theWinner.user_id,
        })
        .catch(err => {
          console.error("Failed to mark game as finished:", err);
          toast.error("Game ended but failed to save result");
        });

      setWinner(theWinner);
    } else {
      setWinner(null);
    }
  }, [players, game.id]);

  // === RESET TURN-SPECIFIC STATE WHEN TURN CHANGES ===
  useEffect(() => {
    setRoll(null);
    setBuyPrompted(false);
    setIsRolling(false);
    setPendingRoll(0);
    rolledForPlayerId.current = null;
  }, [currentPlayerId]);

  const lockAction = useCallback((type: "ROLL" | "END") => {
    if (actionLock) return false;
    setActionLock(type);
    return true;
  }, [actionLock]);

  const unlockAction = useCallback(() => setActionLock(null), []);

  const fetchUpdatedGame = useCallback(async () => {
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
    } catch (err) {
      console.error("Sync failed:", err);
    }
  }, [game.code, game.id]);

  useEffect(() => {
    const interval = setInterval(fetchUpdatedGame, 3000);
    return () => clearInterval(interval);
  }, [fetchUpdatedGame]);

  // ==================== END TURN ====================
  const END_TURN = useCallback(async () => {
    if (!currentPlayerId || !lockAction("END")) return;

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
    }
  }, [currentPlayerId, currentGame.id, fetchUpdatedGame, lockAction, unlockAction, showToast]);

  // ==================== BUY PROPERTY ====================
  const BUY_PROPERTY = useCallback(async () => {
    if (!currentPlayer?.position || actionLock) return;
    const square = properties.find((p) => p.id === currentPlayer.position);
    if (!square || currentGameProperties.some((gp) => gp.property_id === square.id)) {
      setBuyPrompted(false);
      return;
    }

    try {
      await apiClient.post("/game-properties/buy", {
        user_id: currentPlayer.user_id,
        game_id: currentGame.id,
        property_id: square.id,
      });

      showToast(`You bought ${square.name}!`, "success");
      setBuyPrompted(false);
      await fetchUpdatedGame();
      setTimeout(END_TURN, 1000);
    } catch (err) {
      showToast("Purchase failed", "error");
    }
  }, [currentPlayer, properties, currentGameProperties, currentGame.id, fetchUpdatedGame, actionLock, END_TURN, showToast]);

  // ==================== ROLL DICE ====================
  const ROLL_DICE = useCallback(async (forAI = false) => {
    if (isRolling || actionLock || !lockAction("ROLL")) return;

    setIsRolling(true);
    setRoll(null);

    setTimeout(async () => {
      const value = getDiceValues();
      if (!value) {
        showToast("DOUBLES! Roll again!", "success");
        setIsRolling(false);
        unlockAction();
        return;
      }

      setRoll(value);
      const playerId = forAI ? currentPlayerId! : me!.user_id;
      const currentPos = players.find((p) => p.user_id === playerId)?.position ?? 0;
      const newPos = (currentPos + value.total + pendingRoll) % BOARD_SQUARES;

      try {
        await apiClient.post("/game-players/change-position", {
          user_id: playerId,
          game_id: currentGame.id,
          position: newPos,
          rolled: value.total + pendingRoll,
          is_double: value.die1 === value.die2,
        });

        setPendingRoll(0);
        await fetchUpdatedGame();

        showToast(
          `${currentPlayer?.username} rolled ${value.die1} + ${value.die2} = ${value.total}!`,
          "success"
        );

        if (forAI) rolledForPlayerId.current = currentPlayerId;
      } catch {
        showToast("Move failed", "error");
        if (forAI) rolledForPlayerId.current = currentPlayerId;
        END_TURN();
      } finally {
        setIsRolling(false);
        unlockAction();
      }
    }, ROLL_ANIMATION_MS);
  }, [
    isRolling, actionLock, lockAction, unlockAction,
    currentPlayerId, me, players, pendingRoll, currentGame.id,
    fetchUpdatedGame, currentPlayer?.username, END_TURN, showToast
  ]);

  // ==================== AI AUTO-ROLL ====================
  useEffect(() => {
    if (!isAITurn || isRolling || actionLock || roll || rolledForPlayerId.current === currentPlayerId) return;

    const timer = setTimeout(() => ROLL_DICE(true), 1200);
    return () => clearTimeout(timer);
  }, [isAITurn, isRolling, actionLock, roll, currentPlayerId, ROLL_DICE]);

  // ==================== LANDING LOGIC + BUY PROMPT ====================
  useEffect(() => {
    if (!currentPlayer?.position || !properties.length || currentPlayer.position === lastProcessed.current) return;
    lastProcessed.current = currentPlayer.position;

    const square = properties.find((p) => p.id === currentPlayer.position);
    if (!square) return;

    const hasRolled = !!roll;
    const isOwned = currentGameProperties.some((gp) => gp.property_id === square.id);
    const action = PROPERTY_ACTION(square.id);

    setBuyPrompted(false);

    const canBuy = hasRolled && !isOwned && action && ["land", "railway", "utility"].includes(action);
    if (canBuy) setBuyPrompted(true);
  }, [currentPlayer?.position, roll, properties, currentGameProperties]);

  // ==================== AI AUTO-DECISION ====================
  useEffect(() => {
    if (!isAITurn || !buyPrompted || !currentPlayer || !currentProperty || !buyScore) return;

    const timer = setTimeout(async () => {
      const shouldBuy = buyScore >= 60;

      if (shouldBuy) {
        showToast(`AI buys ${currentProperty.name} (${buyScore}%)`, "success");
        await BUY_PROPERTY();
      } else {
        showToast(`AI skips ${currentProperty.name} (${buyScore}%)`);
      }

      setTimeout(END_TURN, shouldBuy ? 1300 : 900);
    }, 1800);

    return () => clearTimeout(timer);
  }, [isAITurn, buyPrompted, currentPlayer, currentProperty, buyScore, BUY_PROPERTY, END_TURN, showToast]);

  // ==================== AI AUTO-END TURN (no action needed) ====================
  useEffect(() => {
    if (!isAITurn || !roll || buyPrompted || actionLock) return;

    const timer = setTimeout(() => END_TURN(), 1500);
    return () => clearTimeout(timer);
  }, [isAITurn, roll, buyPrompted, actionLock, END_TURN]);

  // ==================== HUMAN AUTO-END TURN (no buy needed) ====================
  useEffect(() => {
    if (!isMyTurn || !roll || buyPrompted || actionLock) return;

    const square = currentProperty;
    if (!square) return;

    const isOwned = currentGameProperties.some(gp => gp.property_id === square.id);
    const action = PROPERTY_ACTION(square.id);
    const canBuy = !isOwned && action && ["land", "railway", "utility"].includes(action);

    if (!canBuy) {
      const timer = setTimeout(() => END_TURN(), 1200);
      return () => clearTimeout(timer);
    }
  }, [isMyTurn, roll, buyPrompted, actionLock, currentProperty, currentGameProperties, END_TURN]);

  // ==================== UTILITIES ====================
  const playersByPosition = useMemo(() => {
    const map = new Map<number, Player[]>();
    players.forEach((p) => {
      const pos = p.position ?? 0;
      if (!map.has(pos)) map.set(pos, []);
      map.get(pos)!.push(p);
    });
    return map;
  }, [players]);

  const propertyOwner = (id: number) => {
    const gp = currentGameProperties.find((gp) => gp.property_id === id);
    return gp ? players.find((p) => p.address === gp.address)?.username || null : null;
  };

  const developmentStage = (id: number) =>
    currentGameProperties.find((gp) => gp.property_id === id)?.development ?? 0;

  const isPropertyMortgaged = (id: number) =>
    currentGameProperties.find((gp) => gp.property_id === id)?.mortgaged === true;

  // Auto-scroll to current position
  useEffect(() => {
    if (boardRef.current && currentProperty) {
      const squareElement = boardRef.current.querySelector(`[data-position="${currentProperty.id}"]`);
      if (squareElement) {
        squareElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    }
  }, [currentProperty]);

  // ==================== RENDER ====================
  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white flex flex-col items-center justify-start relative overflow-hidden">
      <button
        onClick={fetchUpdatedGame}
        className="fixed top-4 right-4 z-50 bg-blue-500 text-white text-xs px-2 py-1 rounded-full hover:bg-blue-600 transition"
      >
        Refresh
      </button>

      {/* Winner Screen */}
      <AnimatePresence>
  {winner && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.8, rotate: -5 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className={`p-16 rounded-3xl shadow-2xl text-center max-w-lg w-full border-8 ${
          winner.user_id === me?.user_id
            ? "bg-gradient-to-br from-yellow-600 to-orange-600 border-yellow-400"
            : "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-600"
        }`}
      >
        {winner.user_id === me?.user_id ? (
          <>
            <h1 className="text-6xl font-bold mb-6 drop-shadow-2xl">🏆 YOU WIN! 🏆</h1>
            <p className="text-5xl font-bold text-white mb-8 drop-shadow-lg">
              Congratulations, Champion!
            </p>
            <p className="text-3xl font-semibold text-yellow-200 mb-12">
              You are the Tycoon!
            </p>

            <button
              onClick={() => {
                window.location.href = "/";
              }}
              className="px-12 py-6 bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-3xl font-bold rounded-2xl shadow-2xl hover:shadow-cyan-500/50 hover:scale-105 transform transition-all duration-300 border-4 border-white/50"
            >
              ✨ Claim Your Prize ✨
            </button>

            <p className="text-lg text-yellow-200 mt-8 opacity-80">
              Thank you for playing Tycoon!
            </p>
          </>
        ) : (
          <>
            <h1 className="text-5xl font-bold mb-6 text-gray-300">Game Over</h1>
            <p className="text-4xl font-bold text-white mb-4">
              {winner.username} wins!
            </p>
            <p className="text-2xl text-gray-400 mb-12">
              Better luck next time!
            </p>

            <button
              onClick={() => {
                window.location.href = "/";
              }}
              className="px-12 py-5 bg-gradient-to-r from-gray-600 to-gray-700 text-white text-2xl font-bold rounded-2xl shadow-xl hover:shadow-gray-500/50 hover:scale-105 transform transition-all duration-300 border-4 border-gray-500"
            >
              Return to Home
            </button>

            <p className="text-md text-gray-500 mt-8 opacity-80">
              Thanks for playing!
            </p>
          </>
        )}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

      <div ref={boardRef} className="w-full max-w-[95vw] max-h-[60vh] overflow-auto touch-pinch-zoom touch-pan-x touch-pan-y aspect-square relative shadow-2xl shadow-cyan-500/10 mt-4">
        <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[1px] box-border scale-90 sm:scale-100">
          <div className="col-start-2 col-span-9 row-start-2 row-span-9 bg-[#010F10] flex flex-col justify-center items-center p-2 relative overflow-hidden">
            <AnimatePresence>
              {isRolling && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute inset-0 flex items-center justify-center gap-8 z-20 pointer-events-none"
                >
                  <motion.div
                    animate={{ rotateX: [0, 360, 720, 1080], rotateY: [0, 360, -360, 720] }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="relative w-20 h-20 bg-white rounded-xl shadow-2xl border-2 border-gray-800"
                    style={{ boxShadow: "0 15px 30px rgba(0,0,0,0.7), inset 0 5px 10px rgba(255,255,255,0.5)" }}
                  >
                    {roll ? <DiceFace value={roll.die1} /> : <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.3, repeat: Infinity, ease: "linear" }} className="flex h-full items-center justify-center text-4xl font-bold text-gray-400">?</motion.div>}
                  </motion.div>
                  <motion.div
                    animate={{ rotateX: [0, -720, 360, 1080], rotateY: [0, -360, 720, -360] }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                    className="relative w-20 h-20 bg-white rounded-xl shadow-2xl border-2 border-gray-800"
                    style={{ boxShadow: "0 15px 30px rgba(0,0,0,0.7), inset 0 5px 10px rgba(255,255,255,0.5)" }}
                  >
                    {roll ? <DiceFace value={roll.die2} /> : <motion.div animate={{ rotate: -360 }} transition={{ duration: 0.3, repeat: Infinity, ease: "linear" }} className="flex h-full items-center justify-center text-4xl font-bold text-gray-400">?</motion.div>}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {roll && !isRolling && (
              <motion.div
                initial={{ scale: 0, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                className="flex items-center gap-4 text-5xl font-bold mb-2"
              >
                <span className="text-cyan-400 drop-shadow-2xl">{roll.die1}</span>
                <span className="text-white text-4xl">+</span>
                <span className="text-pink-400 drop-shadow-2xl">{roll.die2}</span>
                <span className="text-white mx-2 text-4xl">=</span>
                <span className="text-yellow-400 text-6xl drop-shadow-2xl">{roll.total}</span>
              </motion.div>
            )}

            <h1 className="text-2xl font-bold text-[#F0F7F7] font-orbitron text-center mb-4 z-10">
              Tycoon
            </h1>

            {isAITurn && (
              <div className="mt-2 text-center z-10">
                <motion.h2
                  className="text-lg font-bold text-pink-300 mb-2"
                  animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.05, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  {currentPlayer?.username} is playing…
                </motion.h2>
                {buyPrompted && buyScore !== null && (
                  <p className="text-sm text-yellow-300 font-bold">
                    Buy Confidence: {buyScore}%
                  </p>
                )}
                <div className="flex justify-center mt-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-400"></div>
                </div>
                <p className="text-pink-200 text-xs italic mt-2">
                  {currentPlayer?.username} • Decides automatically
                </p>
              </div>
            )}
          </div>

          {properties.map((square) => {
            const playersHere = playersByPosition.get(square.id) ?? [];
            const devLevel = developmentStage(square.id);
            const mortgaged = isPropertyMortgaged(square.id);

            // Determine development badge position
            let devPositionClass = "";
            if (isTopRow(square)) devPositionClass = "bottom-1 left-1/2 -translate-x-1/2";
            else if (isBottomRow(square)) devPositionClass = "top-1 left-1/2 -translate-x-1/2";
            else if (isLeftColumn(square)) devPositionClass = "top-1/2 -translate-y-1/2 right-1";
            else if (isRightColumn(square)) devPositionClass = "top-1/2 -translate-y-1/2 left-1";
            else devPositionClass = "top-0.5 right-0.5";

            return (
              <motion.div
                key={square.id}
                data-position={square.id}
                style={{
                  gridRowStart: square.grid_row,
                  gridColumnStart: square.grid_col,
                }}
                className="w-full h-full p-[1px] relative box-border group hover:z-10 transition-transform duration-200"
                whileHover={{ scale: 1.5, zIndex: 50 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                onClick={() => setFocusedProperty(square)}
              >
                <div className={`w-full h-full transform group-hover:scale-150 ${isTopRow(square) ? 'origin-top group-hover:origin-bottom group-hover:translate-y-[50px]' : ''} group-hover:shadow-lg group-hover:shadow-cyan-500/50 transition-transform duration-200 rounded-sm overflow-hidden bg-black/20 p-0.5 relative`}>
                  {square.type === "property" && <PropertyCardMobile square={square} owner={propertyOwner(square.id)} />}
                  {["community_chest", "chance", "luxury_tax", "income_tax"].includes(square.type) && <SpecialCard square={square} />}
                  {square.type === "corner" && <CornerCard square={square} />}

                  {/* Development Badge */}
                  {square.type === "property" && devLevel > 0 && (
                    <div className={`absolute ${devPositionClass} z-20 bg-yellow-500 text-black text-xs font-bold rounded-full w-7 h-7 flex items-center justify-center shadow-lg`}>
                      {devLevel === 5 ? "🏨" : devLevel}
                    </div>
                  )}

                  {/* MORTGAGED OVERLAY */}
                  {mortgaged && (
                    <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center z-30 pointer-events-none rounded-sm">
                      <span className="text-white text-xs font-bold rotate-12 tracking-wider drop-shadow-2xl px-2 py-1 bg-red-800/80 rounded">
                        MORTGAGED
                      </span>
                    </div>
                  )}

                  {/* Dim if mortgaged */}
                  {mortgaged && (
                    <div className="absolute inset-0 bg-black/60 z-10 pointer-events-none rounded-sm" />
                  )}

                  {/* Player Tokens */}
                  <div className="absolute bottom-0.5 left-0.5 flex flex-col gap-1 z-40 pointer-events-none">
                    {playersHere.map((p) => {
                      const isCurrentPlayer = p.user_id === currentGame.next_player_id;
                      return (
                        <motion.span
                          key={p.user_id}
                          title={`${p.username} (${p.balance})`}
                          className={`text-xl border-2 rounded-full ${isCurrentPlayer ? 'border-cyan-300 shadow-lg shadow-cyan-400/50' : 'border-gray-600'}`}
                          initial={{ scale: 1 }}
                          animate={{
                            y: isCurrentPlayer ? [0, -4, 0] : [0, -2, 0],
                            scale: isCurrentPlayer ? [1, 1.1, 1] : 1,
                          }}
                          transition={{
                            y: { duration: isCurrentPlayer ? 1.2 : 2, repeat: Infinity, ease: "easeInOut" },
                            scale: { duration: isCurrentPlayer ? 1.2 : 0, repeat: Infinity },
                          }}
                          whileHover={{ scale: 1.2, y: -2 }}
                        >
                          {getPlayerSymbol(p.symbol)}
                        </motion.span>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Rest of UI */}
      <div className="w-full max-w-[95vw] flex flex-col items-center p-4 gap-4">
        {isMyTurn && !roll && !isRolling && (
          <button
            onClick={() => ROLL_DICE(false)}
            disabled={isRolling}
            className="w-[80vw] py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-lg rounded-full hover:from-green-600 hover:to-emerald-700 transform hover:scale-105 active:scale-95 transition-all disabled:opacity-50 shadow-xl"
          >
            {isRolling ? "Rolling..." : "Roll Dice"}
          </button>
        )}

        <div className="w-full bg-gray-900/95 backdrop-blur-md rounded-xl border border-cyan-500/30 shadow-2xl overflow-hidden">
          <button 
            onClick={() => setShowLog(!showLog)}
            className="w-full p-3 border-b border-cyan-500/20 bg-gray-800/80 flex justify-between items-center"
          >
            <h3 className="text-sm font-bold text-cyan-300 tracking-wider">Action Log</h3>
            <span>{showLog ? '▲' : '▼'}</span>
          </button>
          {showLog && (
            <div ref={logRef} className="max-h-32 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-thin scrollbar-thumb-cyan-600">
              {(!currentGame.history || currentGame.history.length === 0) ? (
                <p className="text-center text-gray-500 text-xs italic py-4">No actions yet</p>
              ) : (
                currentGame.history.slice(-5).map((h, i) => (
                  <motion.p key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-gray-300">
                    <span className="font-medium text-cyan-200">{h.player_name}</span> {h.comment}
                    {h.rolled && <span className="text-cyan-400 font-bold ml-1">[Rolled {h.rolled}]</span>}
                  </motion.p>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Buy Prompt */}
      <AnimatePresence>
        {isMyTurn && buyPrompted && currentProperty && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 20 }}
            className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-md p-4 rounded-t-2xl shadow-2xl z-[60] flex flex-col items-center gap-4"
          >
            <h3 className="text-lg font-bold text-white">Buy {currentProperty.name}?</h3>
            <p className="text-sm text-gray-300">Price: ${currentProperty.price}</p>
            <div className="flex gap-4 w-full justify-center">
              <button
                onClick={BUY_PROPERTY}
                className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-full hover:from-green-600 hover:to-emerald-700 transform hover:scale-105 active:scale-95 transition-all shadow-lg"
              >
                Buy
              </button>
              <button
                onClick={() => {
                  showToast("Skipped purchase");
                  setBuyPrompted(false);
                  setTimeout(END_TURN, 800);
                }}
                className="flex-1 py-3 bg-gray-600 text-white font-bold rounded-full hover:bg-gray-700 transform hover:scale-105 active:scale-95 transition-all shadow-lg"
              >
                Skip
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Focused Property Modal */}
      <AnimatePresence>
        {focusedProperty && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
            onClick={() => setFocusedProperty(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-lg w-full bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl border border-cyan-500/40 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setFocusedProperty(null)}
                className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-2xl hover:bg-black/70 transition"
              >
                ×
              </button>

              <div className="p-6 pt-12">
                {["community_chest", "chance", "luxury_tax", "income_tax"].includes(focusedProperty.type) && (
                  <SpecialCard square={focusedProperty} />
                )}
                {focusedProperty.type === "corner" && (
                  <CornerCard square={focusedProperty} />
                )}
                {focusedProperty.type === "property" && (
                  <PropertyCardMobile square={focusedProperty} owner={propertyOwner(focusedProperty.id)} />
                )}
              </div>

              <div className="px-6 pb-6 text-center space-y-2">
                <p className="text-2xl font-bold">{focusedProperty.name}</p>
                {propertyOwner(focusedProperty.id) ? (
                  <p className="text-lg text-cyan-300">
                    Owner: {propertyOwner(focusedProperty.id)}
                  </p>
                ) : (
                  <p className="text-lg text-gray-400">Available for purchase</p>
                )}
                {focusedProperty.price && (
                  <p className="text-lg">Price: <span className="text-yellow-400 font-bold">${focusedProperty.price}</span></p>
                )}
                {focusedProperty.type === "property" && developmentStage(focusedProperty.id) > 0 && (
                  <p className="text-lg">
                    Development: {developmentStage(focusedProperty.id) === 5 ? "Hotel" : `${developmentStage(focusedProperty.id)} Houses`}
                  </p>
                )}
                {isPropertyMortgaged(focusedProperty.id) && (
                  <p className="text-lg text-red-400 font-bold animate-pulse">MORTGAGED</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
    </div>
  );
};

export default MobileGameLayout;