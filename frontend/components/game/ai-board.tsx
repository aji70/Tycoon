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

  const price = property.price;
  const cash = player.balance;
  let score = 50;

  // Conservative cash management
  if (cash < 300) score -= 90;
  if (cash < 200) return 0; // Never buy when critically low
  if (cash < price + 400) score -= 50;

  const group = Object.values(MONOPOLY_STATS.colorGroups).find(g => g.includes(property.id));
  if (group && !["railroad", "utility"].includes(property.color)) {
    const owned = group.filter(id =>
      gameProperties.find(gp => gp.property_id === id)?.address === player.address
    ).length;

    if (owned === group.length - 1) score += 110;
    else if (owned >= 1) score += 40;
  }

  if (property.color === "railroad") {
    const owned = gameProperties.filter(gp =>
      gp.address === player.address &&
      allProperties.find(p => p.id === gp.property_id)?.color === "railroad"
    ).length;
    score += owned * 30;
  }

  if (allProperties.find(p => p.id === property.id)?.type === "utility") {
    const owned = gameProperties.filter(gp =>
      gp.address === player.address &&
      allProperties.find(p => p.id === gp.property_id)?.type === "utility"
    ).length;
    score += owned * 40;
  }

  const rank = (MONOPOLY_STATS.landingRank as Record<number, number>)[property.id] ?? 25;
  score += (30 - rank);

  return Math.max(5, Math.min(98, score));
};

// ==================== AI LIQUIDATION ====================
const aiSellHousesToRaise = async (
  player: Player,
  gameId: number,
  needed: number,
  properties: Property[],
  gameProperties: GameProperty[],
  showToast: (msg: string) => void,
  fetchUpdatedGame: () => Promise<void>
): Promise<number> => {
  let raised = 0;
  const improved = gameProperties
    .filter(gp => gp.address === player.address && (gp.development ?? 0) > 0)
    .sort((a, b) => {
      const pa = properties.find(p => p.id === a.property_id);
      const pb = properties.find(p => p.id === b.property_id);
      return (pb?.rent_hotel || 0) - (pa?.rent_hotel || 0);
    });

  for (const gp of improved) {
    if (raised >= needed) break;
    const prop = properties.find(p => p.id === gp.property_id);
    if (!prop?.cost_of_house) continue;

    const sellValue = Math.floor(prop.cost_of_house / 2);

    while ((gp.development ?? 0) > 0 && raised < needed) {
      try {
        await apiClient.post("/game-properties/sell-house", {
          game_id: gameId,
          property_id: gp.property_id,
        });
        raised += sellValue;
        showToast(`AI sold a house on ${prop.name}`);
        await fetchUpdatedGame();
      } catch (err) {
        console.error("Sell house failed", err);
        break;
      }
    }
  }
  return raised;
};

const aiMortgageToRaise = async (
  player: Player,
  gameId: number,
  needed: number,
  properties: Property[],
  gameProperties: GameProperty[],
  showToast: (msg: string) => void,
  fetchUpdatedGame: () => Promise<void>
): Promise<number> => {
  let raised = 0;
  const unmortgaged = gameProperties
    .filter(gp => gp.address === player.address && !gp.mortgaged && gp.development === 0)
    .map(gp => ({ gp, prop: properties.find(p => p.id === gp.property_id) }))
    .filter(({ prop }) => prop?.price)
    .sort((a, b) => (b.prop?.price || 0) - (a.prop?.price || 0));

  for (const { gp, prop } of unmortgaged) {
    if (raised >= needed || !prop) continue;
    const mortgageValue = Math.floor(prop.price / 2);
    try {
      await apiClient.post("/game-properties/mortgage", {
        game_id: gameId,
        property_id: gp.property_id,
      });
      raised += mortgageValue;
      showToast(`AI mortgaged ${prop.name}`);
      await fetchUpdatedGame();
    } catch (err) {
      console.error("Mortgage failed", err);
    }
  }
  return raised;
};

const declareBankruptcy = async (
  player: Player,
  gameId: number,
  showToast: (msg: string, type?: string) => void,
  fetchUpdatedGame: () => Promise<void>
) => {
  try {
    await apiClient.post("/game-players/bankrupt", {
      user_id: player.user_id,
      game_id: gameId,
    });
    showToast(`${player.username} is bankrupt and out of the game!`, "error");
    await fetchUpdatedGame();
  } catch (err) {
    showToast("Bankruptcy processing failed", "error");
  }
};

// ==================== RENT & TAX CALCULATION ====================
const calculateRent = (
  property: Property,
  gp: GameProperty,
  properties: Property[],
  gameProperties: GameProperty[],
  diceTotal?: number
): number => {
  if (gp.mortgaged) return 0;

  if (property.color === "railroad") {
    const owned = gameProperties.filter(g =>
      properties.find(p => p.id === g.property_id)?.color === "railroad" && g.address === gp.address
    ).length;
    return [0, 25, 50, 100, 200][owned] || 0;
  }

  if (property.type === "utility") {
    const owned = gameProperties.filter(g =>
      properties.find(p => p.id === g.property_id)?.type === "utility" && g.address === gp.address
    ).length;
    if (!diceTotal) return 0;
    return owned === 1 ? diceTotal * 4 : diceTotal * 10;
  }

  const dev = gp.development ?? 0;
  if (dev === 5) return property.rent_hotel;
  if (dev === 4) return property.rent_four_houses;
  if (dev === 3) return property.rent_three_houses;
  if (dev === 2) return property.rent_two_houses;
  if (dev === 1) return property.rent_one_house;

  const group = Object.values(MONOPOLY_STATS.colorGroups).find(g => g.includes(property.id));
  if (group && group.every(id => gameProperties.find(g => g.property_id === id)?.address === gp.address)) {
    return property.rent_site_only * 2;
  }

  return property.rent_site_only;
};

// ==================== DICE ====================
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

const isTopHalf = (square: Property) => square.grid_row === 1;

// ==================== MAIN COMPONENT ====================
const AiBoard = ({
  game,
  properties,
  game_properties: initialGameProperties,
  me,
}: {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  me: Player | null;
}) => {
  const [players, setPlayers] = useState<Player[]>(game.players || []);
  const [gameProperties, setGameProperties] = useState<GameProperty[]>(initialGameProperties);
  const [roll, setRoll] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [pendingRoll, setPendingRoll] = useState(0);
  const [actionLock, setActionLock] = useState<"ROLL" | "END" | "PAY" | null>(null);
  const [buyPrompted, setBuyPrompted] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);

  const currentPlayerId = game.next_player_id;
  const currentPlayer = players.find(p => p.user_id === currentPlayerId);
  const isMyTurn = me?.user_id === currentPlayerId;
  const isAITurn = currentPlayer?.username?.toLowerCase().includes("ai_") || currentPlayer?.username?.toLowerCase().includes("bot");

  const lastProcessed = useRef<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const rolledForPlayerId = useRef<number | null>(null);

  const currentProperty = currentPlayer?.position != null
    ? properties.find(p => p.id === currentPlayer.position)
    : null;

  const buyScore = useMemo(() => {
    if (!isAITurn || !buyPrompted || !currentPlayer || !currentProperty) return null;
    return calculateBuyScore(currentProperty, currentPlayer, gameProperties, properties);
  }, [isAITurn, buyPrompted, currentPlayer, currentProperty, gameProperties, properties]);

  const showToast = useCallback((message: string, type: "success" | "error" | "default" = "default") => {
    toast.dismiss();
    if (type === "success") toast.success(message);
    else if (type === "error") toast.error(message);
    else toast(message, { icon: "➤" });
  }, []);

  useEffect(() => {
    setPlayers(game.players || []);
    setGameProperties(initialGameProperties);
    const activePlayers = (game.players || []).filter(p => p.balance > 0);
    if (activePlayers.length === 1) {
      setWinner(activePlayers[0]);
    } else {
      setWinner(null);
    }
  }, [game, initialGameProperties]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [game.history?.length]);

  useEffect(() => {
    setRoll(null);
    setBuyPrompted(false);
    setIsRolling(false);
    setPendingRoll(0);
    rolledForPlayerId.current = null;
  }, [currentPlayerId]);

  const lockAction = useCallback((type: "ROLL" | "END" | "PAY") => {
    if (actionLock) return false;
    setActionLock(type);
    return true;
  }, [actionLock]);

  const unlockAction = useCallback(() => setActionLock(null), []);

  const fetchUpdatedGame = useCallback(async () => {
    try {
      const res = await apiClient.get<ApiResponse>(`/games/code/${game.code}`);
      if (res?.data?.success && res.data.data) {
        setPlayers(res.data.data.players || []);
        setGameProperties(res.data.data.game_properties || []);
      }
    } catch (err) {
      console.error("Sync failed:", err);
    }
  }, [game.code]);

  useEffect(() => {
    const interval = setInterval(fetchUpdatedGame, 8000);
    return () => clearInterval(interval);
  }, [fetchUpdatedGame]);

  const END_TURN = useCallback(async () => {
    if (!currentPlayerId || !lockAction("END")) return;

    try {
      await apiClient.post("/game-players/end-turn", {
        user_id: currentPlayerId,
        game_id: game.id,
      });
      showToast("Turn ended", "success");
      await fetchUpdatedGame();
    } catch {
      showToast("Failed to end turn", "error");
    } finally {
      unlockAction();
    }
  }, [currentPlayerId, game.id, fetchUpdatedGame, lockAction, unlockAction, showToast]);

  const BUY_PROPERTY = useCallback(async () => {
    if (!currentPlayer?.position || actionLock) return;
    const square = properties.find(p => p.id === currentPlayer.position);
    if (!square || gameProperties.some(gp => gp.property_id === square.id)) {
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
      setTimeout(END_TURN, 1000);
    } catch (err) {
      showToast("Purchase failed", "error");
    }
  }, [currentPlayer, properties, gameProperties, game.id, fetchUpdatedGame, actionLock, END_TURN, showToast]);

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
      const currentPos = players.find(p => p.user_id === playerId)?.position ?? 0;
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
        END_TURN();
      } finally {
        setIsRolling(false);
        unlockAction();
      }
    }, ROLL_ANIMATION_MS);
  }, [
    isRolling, actionLock, lockAction, unlockAction,
    currentPlayerId, me, players, pendingRoll, game.id,
    fetchUpdatedGame, currentPlayer, END_TURN, showToast
  ]);

  // AI Auto-roll
  useEffect(() => {
    if (!isAITurn || isRolling || actionLock || roll || rolledForPlayerId.current === currentPlayerId) return;

    const timer = setTimeout(() => ROLL_DICE(true), 1200);
    return () => clearTimeout(timer);
  }, [isAITurn, isRolling, actionLock, roll, currentPlayerId, ROLL_DICE]);

  // Landing logic: rent, tax, buy prompt
  useEffect(() => {
    if (!currentPlayer?.position || !roll || currentPlayer.position === lastProcessed.current) return;
    lastProcessed.current = currentPlayer.position;

    const square = properties.find(p => p.id === currentPlayer.position);
    if (!square) return;

    const gp = gameProperties.find(g => g.property_id === square.id);
    const owner = gp?.address ? players.find(p => p.address === gp.address) : null;

  const processPayment = async (amount: number, isTax: boolean = false) => {
  if (!isAITurn) return; // Human payment UI not implemented yet

  let balance = currentPlayer!.balance;
  let needed = amount - balance + 100; // small buffer

  if (needed > 0) {
    const fromHouses = await aiSellHousesToRaise(
      currentPlayer!,
      game.id,
      needed,
      properties,
      gameProperties,
      (msg) => showToast(msg, "default"), // wrap to match type
      fetchUpdatedGame
    );
    needed -= fromHouses;

    if (needed > 0) {
      const fromMortgage = await aiMortgageToRaise(
        currentPlayer!,
        game.id,
        needed,
        properties,
        gameProperties,
        (msg) => showToast(msg, "default"),
        fetchUpdatedGame
      );
      needed -= fromMortgage;
    }
  }

  await fetchUpdatedGame();
  const updatedPlayer = players.find(p => p.user_id === currentPlayer!.user_id) || currentPlayer!;

  if (updatedPlayer.balance < amount) {
    await declareBankruptcy(
      updatedPlayer,
      game.id,
      (msg, type = "error") => showToast(msg, type as "error"), // safe cast
      fetchUpdatedGame
    );
    return;
  }

  try {
    if (isTax) {
      await apiClient.post("/game-players/pay-tax", {
        user_id: currentPlayer!.user_id,
        game_id: game.id,
        amount,
      });
      showToast(`${currentPlayer!.username} paid $${amount} tax`, "success");
    } else if (owner) {
      await apiClient.post("/game-players/pay-rent", {
        payer_id: currentPlayer!.user_id,
        owner_id: owner.user_id,
        game_id: game.id,
        amount,
        property_id: square.id,
      });
      showToast(`${currentPlayer!.username} paid $${amount} rent to ${owner.username}`, "success");
    }
    await fetchUpdatedGame();
  } catch (err) {
    showToast("Payment failed", "error");
  }
};

    // Tax squares
    if (square.type === "income_tax") {
      processPayment(200, true);
    } else if (square.type === "luxury_tax") {
      processPayment(100, true);
    }

    // Rent
    if (gp?.address && owner && owner.user_id !== currentPlayer.user_id) {
      const rent = calculateRent(square, gp, properties, gameProperties, roll.total);
      if (rent > 0) {
        processPayment(rent);
      }
    }

    // Buy prompt
    const action = PROPERTY_ACTION(square.id);
    const canBuy = !gp?.address && action && ["land", "railway", "utility"].includes(action);
    if (canBuy) setBuyPrompted(true);
  }, [currentPlayer?.position, roll, gameProperties, players, properties, isAITurn, currentPlayer, fetchUpdatedGame, showToast]);

  // AI Buy Decision
  useEffect(() => {
    if (!isAITurn || !buyPrompted || !currentPlayer || !currentProperty || buyScore === null) return;

    const timer = setTimeout(async () => {
      const shouldBuy = buyScore >= 60;

      if (shouldBuy) {
        showToast(`AI buys ${currentProperty.name} (${buyScore}%)`, "success");
        await BUY_PROPERTY();
      } else {
        showToast(`AI skips ${currentProperty.name} (${buyScore}%)`);
        setBuyPrompted(false);
        setTimeout(END_TURN, 900);
      }
    }, 1800);

    return () => clearTimeout(timer);
  }, [isAITurn, buyPrompted, currentPlayer, currentProperty, buyScore, BUY_PROPERTY, END_TURN, showToast]);

  // AI Auto-end turn when no action needed
  useEffect(() => {
    if (!isAITurn || !roll || buyPrompted || actionLock) return;

    const timer = setTimeout(() => END_TURN(), 1500);
    return () => clearTimeout(timer);
  }, [isAITurn, roll, buyPrompted, actionLock, END_TURN]);

  // Human Auto-end turn when no buy possible
  useEffect(() => {
    if (!isMyTurn || !roll || buyPrompted || actionLock) return;

    const timer = setTimeout(() => END_TURN(), 1200);
    return () => clearTimeout(timer);
  }, [isMyTurn, roll, buyPrompted, actionLock, END_TURN]);

  const playersByPosition = useMemo(() => {
    const map = new Map<number, Player[]>();
    players.filter(p => p.balance > 0).forEach(p => {
      const pos = p.position ?? 0;
      if (!map.has(pos)) map.set(pos, []);
      map.get(pos)!.push(p);
    });
    return map;
  }, [players]);

  const propertyOwner = (id: number) => {
    const gp = gameProperties.find(gp => gp.property_id === id);
    return gp ? players.find(p => p.address === gp.address)?.username || null : null;
  };

  const developmentStage = (id: number) =>
    gameProperties.find(gp => gp.property_id === id)?.development ?? 0;

  const isMortgaged = (id: number) =>
    gameProperties.find(gp => gp.property_id === id)?.mortgaged ?? false;

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white p-4 flex flex-col lg:flex-row gap-4 items-start justify-center relative">
      {winner && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="bg-gradient-to-br from-yellow-600 to-orange-600 p-12 rounded-3xl shadow-2xl text-center"
          >
            <h1 className="text-6xl font-bold mb-4">🏆 Winner! 🏆</h1>
            <p className="text-4xl">{winner.username} wins the game!</p>
          </motion.div>
        </div>
      )}

      <div className="flex justify-center items-start w-full lg:w-2/3 max-w-[800px] mt-[-1rem]">
        <div className="w-full bg-[#010F10] aspect-square rounded-lg relative shadow-2xl shadow-cyan-500/10">
          <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[2px] box-border">

            <div className="col-start-2 col-span-9 row-start-2 row-span-9 bg-[#010F10] flex flex-col justify-center items-center p-4 relative overflow-hidden">

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

              {isMyTurn && !roll && !isRolling && (
                <button
                  onClick={() => ROLL_DICE(false)}
                  disabled={isRolling}
                  className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-xl rounded-full hover:from-green-600 hover:to-emerald-700 transform hover:scale-110 active:scale-95 transition-all disabled:opacity-50 shadow-xl"
                >
                  {isRolling ? "Rolling..." : "Roll Dice"}
                </button>
              )}

              {isMyTurn && buyPrompted && currentProperty && (
                <div className="flex gap-4 flex-wrap justify-center mt-4">
                  <button
                    onClick={BUY_PROPERTY}
                    className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-full hover:from-green-600 hover:to-emerald-700 transform hover:scale-110 active:scale-95 transition-all shadow-lg"
                  >
                    Buy for ${currentProperty.price}
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
                </div>
              )}

              {isAITurn && (
                <div className="mt-5 text-center z-10">
                  <motion.h2
                    className="text-2xl font-bold text-pink-300 mb-3"
                    animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.05, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    {currentPlayer?.username} is playing…
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

            {properties.map((square) => {
              const playersHere = playersByPosition.get(square.id) ?? [];
              const devLevel = developmentStage(square.id);
              const mortgaged = isMortgaged(square.id);

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

                    {mortgaged && (
                      <div className="absolute inset-0 bg-red-900/70 flex items-center justify-center z-10 pointer-events-none">
                        <span className="text-2xl font-bold text-white rotate-12">MORTGAGED</span>
                      </div>
                    )}

                    <div className="absolute bottom-1 left-1 flex flex-wrap gap-2 z-10">
                      {playersHere.map((p) => {
                        const isCurrentPlayer = p.user_id === game.next_player_id;
                        return (
                          <motion.span
                            key={p.user_id}
                            title={`${p.username} (${p.balance})`}
                            className={`text-xl md:text-2xl lg:text-3xl border-2 rounded ${isCurrentPlayer ? 'border-cyan-300' : 'border-transparent'} ${p.balance <= 0 ? 'opacity-40 grayscale' : ''}`}
                            initial={{ scale: 1 }}
                            animate={{
                              y: isCurrentPlayer ? [0, -8, 0] : [0, -3, 0],
                              scale: isCurrentPlayer ? [1, 1.1, 1] : 1,
                              rotate: isCurrentPlayer ? [0, 5, -5, 0] : 0,
                            }}
                            transition={{
                              y: { duration: isCurrentPlayer ? 1.2 : 2, repeat: Infinity, ease: "easeInOut" },
                              scale: { duration: isCurrentPlayer ? 1.2 : 0, repeat: Infinity },
                              rotate: { duration: isCurrentPlayer ? 1.5 : 0, repeat: Infinity },
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
          success: { icon: "✔", style: { borderColor: "#10b981" } },
          error: { icon: "✖", style: { borderColor: "#ef4444" } },
        }}
      />
    </div>
  );
};

export default AiBoard;