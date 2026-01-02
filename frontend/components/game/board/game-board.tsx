"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PropertyCard from "../cards/property-card";
import SpecialCard from "../cards/special-card";
import CornerCard from "../cards/corner-card";
import {
  Game,
  GameProperty,
  Property,
  Player,
  PROPERTY_ACTION,
} from "@/types/game";
import { useAccount } from "wagmi";
import { getPlayerSymbol } from "@/lib/types/symbol";
import { apiClient } from "@/lib/api";
import toast, { Toaster } from "react-hot-toast";
import { ApiResponse } from "@/types/api";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";

/* ============================================
   CONSTANTS
   ============================================ */

const BOARD_SQUARES = 40;
const ROLL_ANIMATION_MS = 1200;
const MOVE_ANIMATION_MS_PER_SQUARE = 300;
const JAIL_POSITION = 10;
const AUTO_END_TURN_DELAY_MS = 2000;

/* ============================================
   DICE COMPONENTS
   ============================================ */

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

const DiceAnimation = ({ isRolling, roll }: { isRolling: boolean; roll: { die1: number; die2: number } | null }) => {
  return (
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
            {roll ? <DiceFace value={roll.die1} /> : (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.3, repeat: Infinity, ease: "linear" }}
                className="flex h-full items-center justify-center text-6xl font-bold text-gray-400"
              >
                ?
              </motion.div>
            )}
          </motion.div>

          <motion.div
            animate={{ rotateX: [0, -720, 360, 1080], rotateY: [0, -360, 720, -360] }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.1 }}
            className="relative w-28 h-28 bg-white rounded-2xl shadow-2xl border-4 border-gray-800"
            style={{ boxShadow: "0 25px 50px rgba(0,0,0,0.7), inset 0 10px 20px rgba(255,255,255,0.5)" }}
          >
            {roll ? <DiceFace value={roll.die2} /> : (
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 0.3, repeat: Infinity, ease: "linear" }}
                className="flex h-full items-center justify-center text-6xl font-bold text-gray-400"
              >
                ?
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const RollResult = ({ roll }: { roll: { die1: number; die2: number; total: number } }) => {
  return (
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
  );
};

/* ============================================
   ACTION LOG COMPONENT
   ============================================ */

const ActionLog = ({ history }: { history: Game["history"] }) => {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [history]);

  return (
    <div className="mt-8 w-full max-w-lg bg-gray-900/90 rounded-xl border border-cyan-500/30 p-4 h-56 flex flex-col">
      <h3 className="text-cyan-300 font-bold mb-2">Action Log</h3>
      <div ref={logRef} className="flex-1 overflow-y-auto space-y-1 text-sm">
        {history?.length === 0 ? (
          <p className="text-gray-500 italic text-center">No actions yet</p>
        ) : (
          history?.map((h, i) => (
            <p key={i}>
              <span className="text-cyan-200 font-medium">{h.player_name}</span> {h.comment}
              {h.rolled && <span className="text-yellow-400 ml-2">[Rolled {h.rolled}]</span>}
            </p>
          ))
        )}
      </div>
    </div>
  );
};

/* ============================================
   PROPERTY MODAL
   ============================================ */

interface PropertyModalProps {
  property: Property | null;
  gameProperty: GameProperty | null;
  players: Player[];
  me: Player | null;
  isMyTurn: boolean;
  onClose: () => void;
  onAction: (action: string) => void;
  fetchUpdatedGame: () => Promise<void>;
  gameId: number;
  myUserId: number | undefined;
}

const PropertyModal = ({ 
  property, 
  gameProperty, 
  players, 
  me, 
  isMyTurn, 
  onClose, 
  onAction, 
  fetchUpdatedGame, 
  gameId, 
  myUserId 
}: PropertyModalProps) => {
  const getCurrentRent = (prop: Property, gp: GameProperty | null): number => {
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
    return prop.rent_site_only || 0;
  };

  const isOwnedByMe = gameProperty?.address?.toLowerCase() === me?.address?.toLowerCase();

  const handleDevelopment = async () => {
    if (!gameProperty || !myUserId || !isMyTurn) {
      toast.error("Not your turn or invalid property");
      return;
    }

    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/development", {
        game_id: gameId,
        user_id: myUserId,
        property_id: gameProperty.property_id,
      });

      if (res.data?.success) {
        const currentDev = gameProperty.development ?? 0;
        const isBuilding = currentDev < 5;
        const item = currentDev === 4 && isBuilding ? "hotel" : "house";
        const action = isBuilding ? "built" : "sold";
        toast.success(`Successfully ${action} ${item}!`);
        await fetchUpdatedGame();
        onClose();
      } else {
        toast.error(res.data?.message || "Development failed");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Development failed");
    }
  };

  const handleMortgageToggle = async () => {
    if (!gameProperty || !myUserId || !isMyTurn) {
      toast.error("Not your turn or invalid property");
      return;
    }

    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/mortgage", {
        game_id: gameId,
        user_id: myUserId,
        property_id: gameProperty.property_id,
      });

      if (res.data?.success) {
        const action = gameProperty.mortgaged ? "redeemed" : "mortgaged";
        toast.success(`Property ${action}!`);
        await fetchUpdatedGame();
        onClose();
      } else {
        toast.error(res.data?.message || "Mortgage failed");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Mortgage action failed");
    }
  };

  const handleSellProperty = async () => {
    if (!gameProperty || !myUserId || !isMyTurn) {
      toast.error("Not your turn or invalid property");
      return;
    }

    if ((gameProperty.development ?? 0) > 0) {
      toast.error("Cannot sell property with buildings!");
      return;
    }

    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/sell", {
        game_id: gameId,
        user_id: myUserId,
        property_id: gameProperty.property_id,
      });

      if (res.data?.success) {
        toast.success("Property sold back to bank!");
        await fetchUpdatedGame();
        onClose();
      } else {
        toast.error(res.data?.message || "Sell failed");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to sell property");
    }
  };

  if (!property) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-900 rounded-2xl shadow-2xl border border-cyan-500/50 max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
        <div className={`h-24 bg-${property.color || 'gray'}-600`} />
        <div className="p-6">
          <h2 className="text-2xl font-bold text-center mb-4">{property.name}</h2>
          <p className="text-center text-gray-300 mb-6">Price: ${property.price?.toLocaleString()}</p>

          <div className="space-y-3 text-sm mb-8">
            <div className="flex justify-between">
              <span>Current Rent:</span>
              <span className="font-bold text-yellow-400">
                ${getCurrentRent(property, gameProperty)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Owner:</span>
              <span className="font-medium">
                {gameProperty?.address
                  ? players.find(p => p.address?.toLowerCase() === gameProperty.address?.toLowerCase())?.username || "Player"
                  : "Bank"}
              </span>
            </div>
            {gameProperty?.development != null && gameProperty.development > 0 && (
              <div className="flex justify-between">
                <span>Buildings:</span>
                <span>{gameProperty.development === 5 ? "Hotel" : `${gameProperty.development} House(s)`}</span>
              </div>
            )}
            {gameProperty?.mortgaged && (
              <div className="text-red-400 font-bold text-center mt-3 bg-red-500/20 p-2 rounded-lg">MORTGAGED</div>
            )}
          </div>

          {isOwnedByMe && isMyTurn && gameProperty && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={handleDevelopment}
                disabled={gameProperty.development === 5 || (gameProperty.development ?? 0) >= 5}
                className="py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg"
              >
                {gameProperty.development === 4 ? "Build Hotel" : "Build House"}
              </button>
              <button
                onClick={handleDevelopment}
                disabled={!gameProperty.development || gameProperty.development === 0}
                className="py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg"
              >
                Sell House/Hotel
              </button>
              <button
                onClick={handleMortgageToggle}
                className="py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-lg"
              >
                {gameProperty.mortgaged ? "Unmortgage" : "Mortgage"}
              </button>
              <button
                onClick={handleSellProperty}
                disabled={(gameProperty.development ?? 0) > 0}
                className="py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg"
              >
                Sell Property
              </button>
            </div>
          )}

          {!isMyTurn && isOwnedByMe && (
            <p className="text-center text-yellow-400 bg-yellow-500/20 p-3 rounded-lg">
              You can only manage properties on your turn
            </p>
          )}

          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-gray-700 to-gray-600 text-white font-bold rounded-xl hover:from-gray-600 hover:to-gray-500 transition-all shadow-lg"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ============================================
   HELPERS
   ============================================ */

const getDiceValues = (): { die1: number; die2: number; total: number } | null => {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const total = die1 + die2;
  return total === 12 ? null : { die1, die2, total };
};

const isTopHalf = (square: Property) => square.grid_row === 1;

/* ============================================
   MAIN GAMEBOARD COMPONENT
   ============================================ */

interface GameProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  my_properties: Property[];
  me: Player | null;
}

const GameBoard = ({
  game,
  properties,
  game_properties,
  my_properties,
  me,
}: GameProps) => {
  const { address } = useAccount();
  const queryClient = useQueryClient();

  /* ---------- State ---------- */
  const [players, setPlayers] = useState<Player[]>(game?.players ?? []);
  const [isRolling, setIsRolling] = useState(false);
  const [roll, setRoll] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [rollAgain, setRollAgain] = useState(false);
  const [pendingRoll, setPendingRoll] = useState(0);
  const [actionLock, setActionLock] = useState<"ROLL" | "END" | null>(null);

  // Animation
  const [animatedPositions, setAnimatedPositions] = useState<Record<number, number>>({});
  const [hasMovementFinished, setHasMovementFinished] = useState(false);

  // Turn logic
  const [buyPrompted, setBuyPrompted] = useState(false);
  const landedPositionThisTurn = useRef<number | null>(null);

  // Property Modal
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedGameProperty, setSelectedGameProperty] = useState<GameProperty | null>(null);

  const isMyTurn = Boolean(me?.user_id && game?.next_player_id === me.user_id);
  const currentPlayer = players.find(p => p.user_id === game.next_player_id);

  /* ---------- Action Lock ---------- */
  const lockAction = useCallback((type: "ROLL" | "END") => {
    if (actionLock) return false;
    setActionLock(type);
    return true;
  }, [actionLock]);

  const unlockAction = useCallback(() => setActionLock(null), []);

  /* ---------- React Query Utilities ---------- */
  const forceRefetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["game", game.code] });
  }, [queryClient, game.code]);

  /* ---------- Sync Game State ---------- */
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

  /* ---------- Current Landed Property ---------- */
  const landedPosition = landedPositionThisTurn.current;
  const currentProperty = useMemo((): Property | null => {
    if (landedPosition === null) return null;
    return properties.find(p => p.id === landedPosition) ?? null;
  }, [landedPosition, properties]);

  const currentGameProperty = useMemo((): GameProperty | null => {
    if (!currentProperty) return null;
    return game_properties.find(gp => gp.property_id === currentProperty.id) ?? null;
  }, [currentProperty, game_properties]);

  /* ---------- Buy Prompt Logic ---------- */
  useEffect(() => {
    if (!hasMovementFinished || !currentProperty || !currentGameProperty) {
      setBuyPrompted(false);
      return;
    }

    const isBuyableType = ["property", "railroad", "utility"].includes(currentProperty.type);
    const isUnowned = !currentGameProperty;
    const hasPrice = currentProperty.price != null && currentProperty.price > 0;

    setBuyPrompted(isBuyableType && isUnowned && hasPrice);
  }, [hasMovementFinished, currentProperty, currentGameProperty]);

  /* ---------- End Turn ---------- */
  const END_TURN = useCallback(async (id?: number) => {
    if (!id || !lockAction("END")) return;

    try {
      await apiClient.post("/game-players/end-turn", {
        user_id: id,
        game_id: game.id,
      });
      toast.success("Turn ended");
      setRoll(null);
      setBuyPrompted(false);
      landedPositionThisTurn.current = null;
      await fetchUpdatedGame();
    } catch (err) {
      toast.error("Failed to end turn");
    } finally {
      unlockAction();
    }
  }, [game.id, lockAction, unlockAction, fetchUpdatedGame]);

  /* ---------- Auto End Turn ---------- */
  useEffect(() => {
    if (!roll || isRolling || buyPrompted || !hasMovementFinished) return;

    const timer = setTimeout(() => {
      END_TURN(me?.user_id!);
    }, AUTO_END_TURN_DELAY_MS);

    return () => clearTimeout(timer);
  }, [roll, isRolling, buyPrompted, hasMovementFinished, END_TURN, me?.user_id]);

  /* ---------- Roll Dice ---------- */
  const ROLL_DICE = useCallback(async () => {
    if (isRolling || actionLock || !lockAction("ROLL")) return;

    setIsRolling(true);
    setRoll(null);
    setHasMovementFinished(false);
    setAnimatedPositions({});
    setBuyPrompted(false);

    setTimeout(async () => {
      const value = getDiceValues();
      if (!value) {
        toast.success("DOUBLES! Roll again!");
        setRollAgain(true);
        setIsRolling(false);
        unlockAction();
        return;
      }

      setRoll(value);
      const steps = value.total + pendingRoll;
      const currentPos = me?.position ?? 0;
      const newPosition = (currentPos + steps) % BOARD_SQUARES;

      const inJail = me?.in_jail === true && me?.position === JAIL_POSITION;

      // Animate movement step by step (skip if in jail)
      if (!inJail && steps > 0) {
        for (let i = 1; i <= steps; i++) {
          const nextPos = (currentPos + i) % BOARD_SQUARES;
          await new Promise(r => setTimeout(r, MOVE_ANIMATION_MS_PER_SQUARE));
          setAnimatedPositions(prev => ({ ...prev, [me!.user_id!]: nextPos }));
        }
      }

      setHasMovementFinished(true);
      landedPositionThisTurn.current = inJail ? null : newPosition;

      try {
        await apiClient.post("/game-players/change-position", {
          position: newPosition,
          user_id: me?.user_id,
          game_id: game.id,
          rolled: value.total + pendingRoll,
          is_double: value.die1 === value.die2,
        });

        setPendingRoll(0);
        await fetchUpdatedGame();
      } catch (err) {
        toast.error("Move failed");
        await fetchUpdatedGame();
      } finally {
        setIsRolling(false);
        unlockAction();
      }
    }, ROLL_ANIMATION_MS);
  }, [isRolling, actionLock, lockAction, unlockAction, me, pendingRoll, game.id, fetchUpdatedGame]);

  /* ---------- Buy Property (Auto End Turn) ---------- */
  const BUY_PROPERTY = useCallback(async () => {
    if (!me?.user_id || !currentProperty) return;

    try {
      const res = await apiClient.post<ApiResponse>(
        "/game-properties/buy",
        {
          user_id: me.user_id,
          game_id: game.id,
          property_id: currentProperty.id,
        }
      );

      if (res?.data?.success) {
        toast.success(`🏠 You bought ${currentProperty.name}!`);
        setBuyPrompted(false);
        landedPositionThisTurn.current = null;
        await fetchUpdatedGame();
        forceRefetch();
        // Auto end turn after successful purchase
        setTimeout(() => END_TURN(me.user_id), 1000);
      } else {
        toast.error(res.data?.message || "Failed to buy property.");
      }
    } catch (err) {
      console.error("BUY_PROPERTY error:", err);
      toast.error("Unable to complete property purchase.");
    }
  }, [me?.user_id, currentProperty, game.id, fetchUpdatedGame, forceRefetch, END_TURN]);

  /* ---------- Skip Buy ---------- */
  const SKIP_BUY = useCallback(() => {
    setBuyPrompted(false);
    landedPositionThisTurn.current = null;
    END_TURN(me?.user_id!);
  }, [me?.user_id, END_TURN]);

  /* ---------- Property Click Handler ---------- */
  const handlePropertyClick = useCallback((propertyId: number) => {
    const prop = properties.find(p => p.id === propertyId);
    const gp = game_properties.find(g => g.property_id === propertyId);
    if (prop) {
      setSelectedProperty(prop);
      setSelectedGameProperty(gp || null);
    }
  }, [properties, game_properties]);

  const closePropertyModal = useCallback(() => {
    setSelectedProperty(null);
    setSelectedGameProperty(null);
  }, []);

  /* ---------- Players by Position (with animation) ---------- */
  const playersByPosition = useMemo(() => {
    const map = new Map<number, Player[]>();
    players.forEach(p => {
      const pos = animatedPositions[p.user_id ?? 0] ?? p.position ?? 0;
      if (!map.has(pos)) map.set(pos, []);
      map.get(pos)!.push(p);
    });
    return map;
  }, [players, animatedPositions]);

  const propertyOwner = (id: number) => {
    const gp = game_properties.find(gp => gp.property_id === id);
    return gp ? players.find(p => p.address === gp.address)?.username || null : null;
  };

  const developmentStage = (id: number) => game_properties.find(gp => gp.property_id === id)?.development ?? 0;

  /* ---------- Render ---------- */
  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white p-4 flex flex-col lg:flex-row gap-4 items-start justify-center relative">
      <div className="flex justify-center items-start w-full lg:w-2/3 max-w-[800px] mt-[-1rem]">
        <div className="w-full bg-[#010F10] aspect-square rounded-lg relative shadow-2xl shadow-cyan-500/10">
          <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[2px] box-border">

            {/* Center Area */}
            <div className="col-start-2 col-span-9 row-start-2 row-span-9 bg-[#010F10] flex flex-col justify-center items-center p-4 relative overflow-hidden">
              <h1 className="text-3xl lg:text-5xl font-bold text-[#F0F7F7] font-orbitron text-center mb-6 z-10">
                Tycoon
              </h1>

              <DiceAnimation isRolling={isRolling} roll={roll} />
              {roll && !isRolling && <RollResult roll={roll} />}

              {isMyTurn ? (
                <>
                  {!roll && !isRolling && (
                    <button
                      onClick={ROLL_DICE}
                      disabled={isRolling}
                      className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-xl rounded-full hover:from-green-600 hover:to-emerald-700 transform hover:scale-110 active:scale-95 transition-all disabled:opacity-50 shadow-2xl"
                    >
                      {isRolling ? "Rolling..." : "🤖 AUTO Roll Dice"}
                    </button>
                  )}

                  {buyPrompted && currentProperty && (
                    <div className="flex gap-4 flex-wrap justify-center">
                      <button
                        onClick={BUY_PROPERTY}
                        className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-full hover:from-green-600 hover:to-emerald-700 transform hover:scale-110 active:scale-95 transition-all shadow-lg"
                      >
                        🏠 AUTO Buy ${currentProperty.price}
                      </button>
                      <button
                        onClick={SKIP_BUY}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-full hover:from-blue-600 hover:to-indigo-600 transform hover:scale-110 active:scale-95 transition-all shadow-lg"
                      >
                        Skip (End Turn)
                      </button>
                    </div>
                  )}

                  {roll && !isRolling && !buyPrompted && hasMovementFinished && (
                    <button
                      onClick={() => END_TURN(me?.user_id)}
                      className="px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-xl rounded-full hover:from-blue-600 hover:to-indigo-600 transform hover:scale-110 active:scale-95 transition-all shadow-2xl"
                    >
                      End Turn
                    </button>
                  )}
                </>
              ) : (
                <div className="mt-5 text-center z-10">
                  <motion.h2
                    className="text-2xl font-bold text-pink-300 mb-3"
                    animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.05, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    {currentPlayer?.username} is playing…
                  </motion.h2>
                  <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-cyan-400 mt-4" />
                </div>
              )}

              {rollAgain && <p className="text-red-500 text-sm mt-4">You rolled doubles! Roll again!</p>}

              {/* Action Log */}
              <ActionLog history={game.history ?? []} />
            </div>

            {/* Board Squares - Clickable */}
            {properties.map((square) => {
              const playersHere = playersByPosition.get(square.id) ?? [];
              const devLevel = developmentStage(square.id);
              const gp = game_properties.find(g => g.property_id === square.id);

              return (
                <motion.div
                  key={square.id}
                  style={{ gridRowStart: square.grid_row, gridColumnStart: square.grid_col }}
                  className="w-full h-full p-[2px] relative group hover:z-10 cursor-pointer"
                  onClick={() => handlePropertyClick(square.id)}
                  whileHover={{ scale: 1.75, zIndex: 50 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <div className={`w-full h-full transform group-hover:scale-200 ${isTopHalf(square) ? 'origin-top group-hover:origin-bottom group-hover:translate-y-[100px]' : ''} rounded-md overflow-hidden bg-black/20 p-1`}>
                    {square.type === "property" && <PropertyCard square={square} owner={propertyOwner(square.id)} />}
                    {["community_chest", "chance", "luxury_tax", "income_tax"].includes(square.type) && <SpecialCard square={square} />}
                    {square.type === "corner" && <CornerCard square={square} />}

                    {square.type === "property" && devLevel > 0 && (
                      <div className="absolute top-1 right-1 bg-yellow-500 text-black text-xs font-bold rounded px-1 z-20">
                        {devLevel === 5 ? '🏨' : `🏠 ${devLevel}`}
                      </div>
                    )}

                    {/* Click indicator */}
                    <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 rounded-md transition-all duration-200 flex items-center justify-center z-10 pointer-events-none">
                      <span className="text-white/0 group-hover:text-white/80 text-xs font-bold opacity-0 group-hover:opacity-100 transition-all">
                        👆 Manage
                      </span>
                    </div>

                    <div className="absolute bottom-1 left-1 flex flex-wrap gap-2 z-10">
                      {playersHere.map((p) => {
                        const isCurrent = p.user_id === game.next_player_id;
                        return (
                          <motion.span
                            key={p.user_id}
                            className={`text-2xl border-2 rounded ${isCurrent ? 'border-cyan-300' : 'border-transparent'}`}
                            animate={{ y: isCurrent ? [0, -8, 0] : [0, -3, 0] }}
                            transition={{ y: { duration: isCurrent ? 1.2 : 2, repeat: Infinity } }}
                            whileHover={{ scale: 1.2 }}
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

      {/* Property Management Modal */}
      <PropertyModal
        property={selectedProperty}
        gameProperty={selectedGameProperty}
        players={players}
        me={me}
        isMyTurn={isMyTurn}
        onClose={closePropertyModal}
        onAction={() => {}}
        fetchUpdatedGame={fetchUpdatedGame}
        gameId={game.id}
        myUserId={me?.user_id}
      />

      <Toaster position="top-center" />
    </div>
  );
};

export default GameBoard;