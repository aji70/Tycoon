"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PropertyCard from "./cards/property-card";
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

  // 1. Cash safety
  if (cash < price * 1.3) score -= 70;
  else if (cash > price * 3) score += 20;
  else if (cash > price * 2) score += 10;

  // 2. Color set completion
  const group = Object.values(MONOPOLY_STATS.colorGroups).find(g => g.includes(property.id));
  if (group && !["railroad", "utility"].includes(property.color!)) {
    const owned = group.filter(id =>
      gameProperties.find(gp => gp.property_id === id)?.address === player.address
    ).length;

    if (owned === group.length - 1) score += 90;
    else if (owned >= 1) score += 35;
  }

  // 3. Railroads & Utilities
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

  // 4. Landing frequency
  const rank = (MONOPOLY_STATS.landingRank as Record<number, number>)[property.id] ?? 25;
  score += (30 - rank);

  // 5. ROI
  const roi = baseRent / price;
  if (roi > 0.12) score += 25;
  else if (roi > 0.08) score += 12;

  // 6. Block opponent
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
const ROLL_ANIMATION_MS = 1200;

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
          className="absolute w-7 h-7 bg-black rounded-full shadow-inner"
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

const isTopHalf = (square: Property) => square.grid_row === 1;

// ==================== MAIN COMPONENT ====================
const AiBoard = ({
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
  const [players, setPlayers] = useState<Player[]>(game?.players ?? []);
  const [roll, setRoll] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [pendingRoll, setPendingRoll] = useState(0);
  const [actionLock, setActionLock] = useState<"ROLL" | "END" | null>(null);
  const [currentCard, setCurrentCard] = useState<CardPopup | null>(null);
  const [buyPrompted, setBuyPrompted] = useState(false);

  const currentPlayerId = game.next_player_id;
  const currentPlayer = players.find((p) => p.user_id === currentPlayerId);
  const isMyTurn = me?.user_id === currentPlayerId;
  const isAITurn =
    currentPlayer?.username?.toLowerCase().includes("ai") ||
    currentPlayer?.username?.toLowerCase().includes("bot");

  const lastProcessed = useRef<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const rolledForPlayerId = useRef<number | null>(null);

  // Current landed property
  const currentProperty = currentPlayer?.position
    ? properties.find(p => p.id === currentPlayer.position)
    : null;

  // AI Buy Confidence
  const buyScore = useMemo(() => {
    if (!isAITurn || !buyPrompted || !currentPlayer || !currentProperty) return null;
    return calculateBuyScore(currentProperty, currentPlayer, game_properties, properties);
  }, [isAITurn, buyPrompted, currentPlayer, currentProperty, game_properties, properties]);

  // Toast helper to prevent multiples
  const showToast = useCallback((message: string, type: "success" | "error" | "default" = "default") => {
    // Dismiss any existing toast first
    toast.dismiss();

    if (type === "success") toast.success(message);
    else if (type === "error") toast.error(message);
    else toast(message, { icon: "➤" });
  }, []);

  useEffect(() => {
    if (game?.players) setPlayers(game.players);
  }, [game?.players]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [game.history?.length]);

  const lockAction = useCallback((type: "ROLL" | "END") => {
    if (actionLock) return false;
    setActionLock(type);
    return true;
  }, [actionLock]);

  const unlockAction = useCallback(() => setActionLock(null), []);

  const fetchUpdatedGame = useCallback(async () => {
    try {
      const res = await apiClient.get<ApiResponse>(`/games/code/${game.code}`);
      if (res?.data?.success && res.data.data?.players) {
        setPlayers(res.data.data.players);
      }
    } catch (err) {
      console.error("Sync failed:", err);
    }
  }, [game.code]);

  useEffect(() => {
    const interval = setInterval(fetchUpdatedGame, 8000);
    return () => clearInterval(interval);
  }, [fetchUpdatedGame]);

  // ==================== END TURN ====================
  const END_TURN = useCallback(async () => {
    if (!currentPlayerId || !lockAction("END")) return;

    try {
      await apiClient.post("/game-players/end-turn", {
        user_id: currentPlayerId,
        game_id: game.id,
      });
      showToast("Turn ended", "success");
      setRoll(null);
      setBuyPrompted(false);
      rolledForPlayerId.current = null;
      await fetchUpdatedGame();
    } catch {
      showToast("Failed to end turn", "error");
    } finally {
      unlockAction();
    }
  }, [currentPlayerId, game.id, fetchUpdatedGame, lockAction, unlockAction, showToast]);

  // ==================== BUY PROPERTY ====================
  const BUY_PROPERTY = useCallback(async () => {
    if (!currentPlayer?.position || actionLock) return;
    const square = properties.find((p) => p.id === currentPlayer.position);
    if (!square || game_properties.some((gp) => gp.property_id === square.id)) {
      setBuyPrompted(false);
      return;
    }

    try {
      await apiClient.post("/game-properties/buy", {
        user_id: currentPlayer.user_id,
        game_id: game.id,
        property_id: square.id,
      });

      showToast(`You bought ${square.name}!`, "success");
      setBuyPrompted(false);
      await fetchUpdatedGame();

      // AUTO END TURN AFTER BUYING
      setTimeout(END_TURN, 1000);
    } catch (err) {
      showToast("Purchase failed", "error");
    }
  }, [currentPlayer, properties, game_properties, game.id, fetchUpdatedGame, actionLock, END_TURN, showToast]);

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
          game_id: game.id,
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
    currentPlayerId, me, players, pendingRoll, game.id,
    fetchUpdatedGame, currentPlayer?.username, END_TURN, showToast
  ]);

  // ==================== AI AUTO-ROLL ====================
  useEffect(() => {
    if (!isAITurn || isRolling || actionLock || (currentPlayer?.rolls ?? 0) > 0 || rolledForPlayerId.current === currentPlayerId) return;

    const timer = setTimeout(() => ROLL_DICE(true), 1200);
    return () => clearTimeout(timer);
  }, [isAITurn, isRolling, actionLock, currentPlayer?.rolls, currentPlayerId, ROLL_DICE]);

  // ==================== LANDING LOGIC + BUY PROMPT ====================
  useEffect(() => {
    if (!currentPlayer?.position || !properties.length || currentPlayer.position === lastProcessed.current) return;
    lastProcessed.current = currentPlayer.position;

    const square = properties.find((p) => p.id === currentPlayer.position);
    if (!square) return;

    const hasRolled = (currentPlayer.rolls ?? 0) > 0;
    const isOwned = game_properties.some((gp) => gp.property_id === square.id);
    const action = PROPERTY_ACTION(square.id);

    setBuyPrompted(false);

    const canBuy = hasRolled && !isOwned && action && ["land", "railway", "utility"].includes(action);
    if (canBuy) setBuyPrompted(true);
  }, [
    currentPlayer?.position,
    currentPlayer?.rolls,
    properties,
    game_properties,
    currentPlayerId,
  ]);

  // ==================== AI AUTO-DECISION (BUY OR SKIP) ====================
  useEffect(() => {
    if (!isAITurn || !buyPrompted || !currentPlayer || !currentProperty || !buyScore) return;

    const timer = setTimeout(async () => {
      const shouldBuy = buyScore >= 60; // Tune this threshold!

      if (shouldBuy) {
        showToast(`AI buys ${currentProperty.name} (${buyScore}%)`, "success");
        await BUY_PROPERTY();
      } else {
        showToast(`AI skips ${currentProperty.name} (${buyScore}%)`);
      }

      // End turn after decision
      setTimeout(END_TURN, shouldBuy ? 1300 : 900);
    }, 1800);

    return () => clearTimeout(timer);
  }, [isAITurn, buyPrompted, currentPlayer, currentProperty, buyScore, BUY_PROPERTY, END_TURN, showToast]);

  // ==================== AI AUTO-END TURN (no buy needed) ====================
  useEffect(() => {
    if (!isAITurn || (currentPlayer?.rolls ?? 0) === 0 || buyPrompted || actionLock) return;

    const timer = setTimeout(() => {
      END_TURN();
    }, 1500);

    return () => clearTimeout(timer);
  }, [isAITurn, currentPlayer?.rolls, buyPrompted, actionLock, END_TURN]);

  // ==================== HUMAN AUTO-END TURN (no buy needed) ====================
  useEffect(() => {
    if (!isMyTurn || isRolling || actionLock) return;
    if (!currentPlayer?.rolls || currentPlayer.rolls === 0) return;

    const square = currentProperty;
    if (!square) return;

    const isOwned = game_properties.some(gp => gp.property_id === square.id);
    const action = PROPERTY_ACTION(square.id);
    const canBuy = !isOwned && action && ["land", "railway", "utility"].includes(action);

    // If player CAN buy → wait for decision (buyPrompted handles it)
    // If player CANNOT buy → auto-end turn
    if (!canBuy && !buyPrompted) {
      const timer = setTimeout(() => {
        END_TURN();
      }, 1200); // Small delay for visual clarity

      return () => clearTimeout(timer);
    }
  }, [
    isMyTurn,
    isRolling,
    actionLock,
    currentPlayer?.rolls,
    currentProperty,
    game_properties,
    buyPrompted,
    END_TURN
  ]);

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
    const gp = game_properties.find((gp) => gp.property_id === id);
    return gp ? players.find((p) => p.address === gp.address)?.username || null : null;
  };

  const developmentStage = (id: number) =>
    game_properties.find((gp) => gp.property_id === id)?.development ?? 0;

  // ==================== RENDER ====================
  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white p-4 flex flex-col lg:flex-row gap-4 items-start justify-center relative">
      <div className="flex justify-center items-start w-full lg:w-2/3 max-w-[800px] mt-[-1rem]">
        <div className="w-full bg-[#010F10] aspect-square rounded-lg relative shadow-2xl shadow-cyan-500/10">
          <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[2px] box-border">

            {/* CENTER PANEL */}
            <div className="col-start-2 col-span-9 row-start-2 row-span-9 bg-[#010F10] flex flex-col justify-center items-center p-4 relative overflow-hidden">

              {/* Rolling Dice Animation */}
              <AnimatePresence>
                {isRolling && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute inset-0 flex items-center justify-center gap-16 z-20 pointer-events-none"
                  >
                    <motion.div
                      animate={{ rotateX: [0, 360, 720, 1080], rotateY: [0, 360, -360, 720] }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      className="relative w-28 h-28 bg-white rounded-2xl shadow-2xl border-4 border-gray-800"
                      style={{ boxShadow: "0 25px 50px rgba(0,0,0,0.7), inset 0 10px 20px rgba(255,255,255,0.5)" }}
                    >
                      {roll ? <DiceFace value={roll.die1} /> : <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.3, repeat: Infinity, ease: "linear" }} className="flex h-full items-center justify-center text-6xl font-bold text-gray-400">?</motion.div>}
                    </motion.div>
                    <motion.div
                      animate={{ rotateX: [0, -720, 360, 1080], rotateY: [0, -360, 720, -360] }}
                      transition={{ duration: 1.2, ease: "easeOut", delay: 0.1 }}
                      className="relative w-28 h-28 bg-white rounded-2xl shadow-2xl border-4 border-gray-800"
                      style={{ boxShadow: "0 25px 50px rgba(0,0,0,0.7), inset 0 10px 20px rgba(255,255,255,0.5)" }}
                    >
                      {roll ? <DiceFace value={roll.die2} /> : <motion.div animate={{ rotate: -360 }} transition={{ duration: 0.3, repeat: Infinity, ease: "linear" }} className="flex h-full items-center justify-center text-6xl font-bold text-gray-400">?</motion.div>}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {roll && !isRolling && (
                <motion.div
                  initial={{ scale: 0, y: 50 }}
                  animate={{ scale: 1, y: 0 }}
                  className="flex items-center gap-6 text-7xl font-bold mb-4"
                >
                  <span className="text-cyan-400 drop-shadow-2xl">{roll.die1}</span>
                  <span className="text-white text-6xl">+</span>
                  <span className="text-pink-400 drop-shadow-2xl">{roll.die2}</span>
                  <span className="text-white mx-4 text-6xl">=</span>
                  <span className="text-yellow-400 text-9xl drop-shadow-2xl">{roll.total}</span>
                </motion.div>
              )}

              <h1 className="text-3xl lg:text-5xl font-bold text-[#F0F7F7] font-orbitron text-center mb-6 z-10">
                Tycoon
              </h1>

              {/* HUMAN TURN */}
              {isMyTurn && !currentPlayer?.rolls ? (
                <button
                  onClick={() => ROLL_DICE(false)}
                  disabled={isRolling}
                  className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-xl rounded-full hover:from-green-600 hover:to-emerald-700 transform hover:scale-110 active:scale-95 transition-all disabled:opacity-50 shadow-xl"
                >
                  {isRolling ? "Rolling..." : "Roll Dice"}
                </button>
              ) : isMyTurn && currentPlayer?.rolls ? (
                <div className="flex gap-4 flex-wrap justify-center">
                  {buyPrompted && (
                    <>
                      <button
                        onClick={BUY_PROPERTY}
                        className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-full hover:from-green-600 hover:to-emerald-700 transform hover:scale-110 active:scale-95 transition-all shadow-lg"
                      >
                        Buy for ${currentProperty?.price}
                      </button>
                      <button
                        onClick={() => {
                          showToast("Skipped purchase");
                          setBuyPrompted(false);
                          setTimeout(END_TURN, 800);
                        }}
                        className="px-6 py-3 bg-gray-600 text-white font-bold rounded-full hover:bg-gray-700 transform hover:scale-105 active:scale-95 transition-all shadow-lg"
                      >
                        Skip
                      </button>
                    </>
                  )}
                </div>
              ) : null}

              {/* AI TURN — Cooler text without background */}
              {isAITurn && (
                <div className="mt-5 text-center z-10">
                  <motion.h2
                    className="text-2xl font-bold text-pink-300 mb-3"
                    animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.05, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    AI {currentPlayer?.username} is playing…
                  </motion.h2>
                  {buyPrompted && buyScore !== null && (
                    <p className="text-lg text-yellow-300 font-bold">
                      Buy Confidence: {buyScore}%
                    </p>
                  )}
                  <div className="flex justify-center mt-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-cyan-400"></div>
                  </div>
                  <p className="text-pink-200 text-sm italic mt-3">
                    Smart AI • Decides automatically
                  </p>
                </div>
              )}

              {/* Action Log */}
              <div ref={logRef} className="mt-6 w-full max-w-md bg-gray-900/95 backdrop-blur-md rounded-xl border border-cyan-500/30 shadow-2xl overflow-hidden flex flex-col h-48">
                <div className="p-3 border-b border-cyan-500/20 bg-gray-800/80">
                  <h3 className="text-sm font-bold text-cyan-300 tracking-wider">Action Log</h3>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-thin scrollbar-thumb-cyan-600">
                  {(!game.history || game.history.length === 0) ? (
                    <p className="text-center text-gray-500 text-xs italic py-8">No actions yet</p>
                  ) : (
                    game.history.map((h, i) => (
                      <motion.p key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-gray-300">
                        <span className="font-medium text-cyan-200">{h.player_name}</span> {h.comment}
                        {h.rolled && <span className="text-cyan-400 font-bold ml-1">[Rolled {h.rolled}]</span>}
                      </motion.p>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Card Popup */}
            <AnimatePresence>
              {currentCard && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 flex items-center justify-center z-50 bg-black/70" onClick={() => setCurrentCard(null)}>
                  <motion.div className={`max-w-lg w-96 p-8 rounded-2xl shadow-2xl backdrop-blur-sm border border-cyan-500/30 ${currentCard.type === "chance" ? "bg-gradient-to-br from-orange-500/30 to-yellow-500/30" : "bg-gradient-to-br from-blue-500/30 to-indigo-500/30"}`} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setCurrentCard(null)} className="absolute top-4 right-4 text-2xl hover:text-white">X</button>
                    <h3 className="text-2xl font-bold text-center uppercase">{currentCard.type.replace("_", " ")}</h3>
                    <p className="text-center italic mt-4">"{currentCard.message}"</p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Board Squares */}
            {properties.map((square) => {
              const playersHere = playersByPosition.get(square.id) ?? [];
              const devLevel = developmentStage(square.id);

              return (
                <motion.div
                  key={square.id}
                  style={{
                    gridRowStart: square.grid_row,
                    gridColumnStart: square.grid_col,
                  }}
                  className="w-full h-full p-[2px] relative box-border group hover:z-10 transition-transform duration-200"
                  whileHover={{ scale: 1.75, zIndex: 50 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <div className={`w-full h-full transform group-hover:scale-200 ${isTopHalf(square) ? 'origin-top group-hover:origin-bottom group-hover:translate-y-[100px]' : ''} group-hover:shadow-lg group-hover:shadow-cyan-500/50 transition-transform duration-200 rounded-md overflow-hidden bg-black/20 p-1`}>
                    {square.type === "property" && <PropertyCard square={square} owner={propertyOwner(square.id)} />}
                    {["community_chest", "chance", "luxury_tax", "income_tax"].includes(square.type) && <SpecialCard square={square} />}
                    {square.type === "corner" && <CornerCard square={square} />}

                    {square.type === "property" && devLevel > 0 && (
                      <div className="absolute top-1 right-1 bg-yellow-500 text-black text-xs font-bold rounded px-1 z-20 flex items-center gap-0.5">
                        {devLevel === 5 ? '🏨' : `🏠 ${devLevel}`}
                      </div>
                    )}

                    <div className="absolute bottom-1 left-1 flex flex-wrap gap-2 z-10">
                      {playersHere.map((p) => {
                        const isCurrentPlayer = p.user_id === game.next_player_id;
                        return (
                          <motion.span
                            key={p.user_id}
                            title={`${p.username} (${p.balance})`}
                            className={`text-xl md:text-2xl lg:text-3xl border-2 rounded ${isCurrentPlayer ? 'border-cyan-300' : 'border-transparent'}`}
                            initial={{ scale: 1 }}
                            animate={{
                              y: isCurrentPlayer 
                                ? [0, -8, 0]  // Bouncy animation for current player
                                : [0, -3, 0], // Subtle float for others
                              scale: isCurrentPlayer ? [1, 1.1, 1] : 1,
                              rotate: isCurrentPlayer ? [0, 5, -5, 0] : 0, // Slight wobble for current
                            }}
                            transition={{
                              y: {
                                duration: isCurrentPlayer ? 1.2 : 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                              },
                              scale: {
                                duration: isCurrentPlayer ? 1.2 : 0,
                                repeat: Infinity,
                                ease: "easeInOut",
                              },
                              rotate: {
                                duration: isCurrentPlayer ? 1.5 : 0,
                                repeat: Infinity,
                                ease: "easeInOut",
                              },
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
      </div>
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
            padding: "12px 20px",
            fontSize: "16px",
            fontWeight: "600",
            boxShadow: "0 10px 30px rgba(0, 255, 255, 0.15)",
            backdropFilter: "blur(10px)",
          },
          success: {
            icon: "✔",
            style: { borderColor: "#10b981" },
          },
          error: {
            icon: "✖",
            style: { borderColor: "#ef4444" },
          },
        }}
      />
    </div>
  );
};

export default AiBoard;