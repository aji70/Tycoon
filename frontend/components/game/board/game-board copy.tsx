"use client";

import React, {
  Component,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import PropertyCard from "../cards/property-card";
import SpecialCard from "../cards/special-card";
import CornerCard from "../cards/corner-card";
import {
  Game,
  GameProperty,
  Property,
  Player,
  PROPERTY_ACTION,
  CardTypes,
} from "@/types/game";
import { useAccount } from "wagmi";
import { getPlayerSymbol } from "@/lib/types/symbol";
import { apiClient } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ApiResponse } from "@/types/api";
import { motion, AnimatePresence } from "framer-motion";

/* ============================================
   TYPES
   ============================================ */

interface GameProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  my_properties: Property[];
  me: Player | null;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

interface CardPopup {
  type: "chance" | "community_chest";
  message: string;
  action?: string;
}

/* ============================================
   ERROR BOUNDARY
   ============================================ */

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-red-400 text-center mt-10">
          Something went wrong. Please refresh the page.
        </div>
      );
    }
    return this.props.children;
  }
}

/* ============================================
   CONSTANTS
   ============================================ */

const BOARD_SQUARES = 40;
const ROLL_ANIMATION_MS = 1200;

/* ============================================
   HELPERS
   ============================================ */

const getDiceValues = (): { die1: number; die2: number; total: number } | null => {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const total = die1 + die2;
  return total === 12 ? null : { die1, die2, total };
};

const isTopHalf = (square: any) => {
  return square.grid_row === 1;
};

const getMockCardMessage = (type: "chance" | "community_chest"): { message: string; action?: string } => {
  // Mock card data - replace with actual card drawing logic/API if available
  const chanceCards = [
    { message: "Advance to Go (Collect $200)", action: "advance_to_go" },
    { message: "Bank pays you dividend of $50", action: "collect_dividend" },
    { message: "Pay poor tax of $15", action: "pay_tax" },
    { message: "Take a trip to Reading Railroad ($200)", action: "advance_to_railroad" },
    { message: "You have been elected Chairman of the Board. Pay each player $50", action: "pay_players" },
    // Add more as needed
  ];

  const communityCards = [
    { message: "Advance to Go (Collect $200)", action: "advance_to_go" },
    { message: "Doctor's fee. Pay $50", action: "pay_fee" },
    { message: "From sale of stock you get $50", action: "collect_stock" },
    { message: "Get Out of Jail Free", action: "get_out_of_jail_free" },
    { message: "Go to Jail. Go directly to Jail. Do not pass Go, do not collect $200", action: "go_to_jail" },
    // Add more as needed
  ];

  const cards = type === "chance" ? chanceCards : communityCards;
  const randomCard = cards[Math.floor(Math.random() * cards.length)];
  return randomCard;
};

/* ============================================
   SAFE STATE HOOK
   ============================================ */

function useSafeState<S>(initial: S) {
  const isMounted = useRef(false);
  const [state, setState] = useState(initial);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const safeSetState = useCallback(
    (value: React.SetStateAction<S>) => {
      if (isMounted.current) setState(value);
    },
    []
  );

  return [state, safeSetState] as const;
}

/* ============================================
   GAME BOARD COMPONENT
   ============================================ */

const GameBoard = ({
  game,
  properties,
  game_properties,
  my_properties,
  me,
}: GameProps) => {
  const { address } = useAccount();
  const router = useRouter();
  const queryClient = useQueryClient();

  /* ---------- State ---------- */
  const [players, setPlayers] = useSafeState<Player[]>(game?.players ?? []);
  const [boardData] = useSafeState<Property[]>(properties ?? []);
  const [error, setError] = useSafeState<string | null>(null);
  const [isRolling, setIsRolling] = useSafeState(false);
  const [rollAgain, setRollAgain] = useSafeState(false);
  const [roll, setRoll] = useSafeState<{ die1: number; die2: number; total: number } | null>(
    null
  );
  const [pendingRoll, setPendingRoll] = useSafeState<number>(0);
  const [canRoll, setCanRoll] = useSafeState<boolean>(false);
  const [actionLock, setActionLock] = useSafeState<"ROLL" | "END" | null>(null);
  const [currentCard, setCurrentCard] = useSafeState<CardPopup | null>(null);

  /* ---------- Locks ---------- */
  const lockAction = useCallback(
    (type: "ROLL" | "END") => {
      if (actionLock) return false;
      setActionLock(type);
      return true;
    },
    [actionLock, setActionLock]
  );

  const unlockAction = useCallback(() => setActionLock(null), [setActionLock]);

  const [currentAction, setCurrentAction] = useSafeState<string | null>(null);
  const [currentProperty, setCurrentProperty] = useSafeState<Property | null>(null);
  const [currentGameProperty, setCurrentGameProperty] = useSafeState<GameProperty | null>(null);
  const [buyPrompted, setBuyPrompted] = useState(false);
  const isMyTurn = me?.user_id && game?.next_player_id === me.user_id;

  // Track last processed position to prevent multiple triggers
  const lastProcessedPosition = useRef<number | null>(null);

  /* ---------- React Query Utilities ---------- */
  const forceRefetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["game", game.code] });
  }, [queryClient, game.code]);

  /* ---------- Fetch Updated Game ---------- */
  const fetchUpdatedGame = useCallback(async () => {
    try {
      const res = await apiClient.get<ApiResponse>(`/games/code/${game.code}`)
      if (res?.data?.success) {
        const gameData = res.data?.data;
        if (gameData && Array.isArray((gameData as any).players)) {
          setPlayers((prev) => {
            const changed = JSON.stringify(prev) !== JSON.stringify((gameData as any).players);
            return changed ? (gameData as any).players : prev;
          });
        }
        return gameData;
      }
    } catch (err) {
      console.error("fetchUpdatedGame error:", err);
      return null;
    }
  }, [game.code, setPlayers]);

  /* ---------- Turn Management ---------- */
  const checkCanRoll = useCallback(async () => {
    if (!me?.user_id) return;

    try {
      const res = await apiClient.post<ApiResponse>(
        "/game-players/can-roll",
        { user_id: me.user_id, game_id: game.id }
      );
      const allowed = Boolean(res?.data?.data?.canRoll);
      setCanRoll(allowed);

      if (allowed) toast.success("🎲 It's your turn — roll the dice!");
    } catch (err) {
      console.error("checkCanRoll error:", err);
      setCanRoll(false);
    }
  }, [me?.user_id, game.id, setCanRoll]);

  useEffect(() => {
    checkCanRoll();
    const poll = async () => {
      await fetchUpdatedGame();
    };
    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [fetchUpdatedGame, checkCanRoll]);

  // Property Action & Card Trigger

  const stableProperties = useMemo(() => properties, [properties]);

  useEffect(() => {
    if (!stableProperties.length || !me?.position || !game?.players) return;

    // Only process if position has changed
    if (me.position === lastProcessedPosition.current) return;

    lastProcessedPosition.current = me.position;

    const square = stableProperties.find((p) => p.id === me.position);
    if (!square) return;

    const game_property =
      game_properties.length === 0
        ? null
        : game_properties.find((p) => p.property_id === square.id);

    const action = PROPERTY_ACTION(square.id);

    setCurrentProperty(square);
    setCurrentGameProperty(game_property || null);
    setCurrentAction(action);

    // Handle Chance/Community Chest
    if (["chance", "community_chest"].includes(square.type)) {
      const cardType = square.type as "chance" | "community_chest";
      const { message, action: cardAction } = getMockCardMessage(cardType);
      setCurrentCard({ type: cardType, message, action: cardAction });
      return;
    }

    const meInGame = game.players.find((p) => p.user_id === me?.user_id);
    const hasRolled = (meInGame?.rolls ?? 0) > 0;

    if (
      isMyTurn &&
      !buyPrompted &&
      hasRolled &&
      isRolling === false &&
      roll !== null &&
      action === "land" &&
      !game_property
    ) {
      toast("💰 You can buy this property!", { icon: "🏠" });
      setBuyPrompted(true);
    }

    if (!isMyTurn || roll === null || meInGame?.rolls === 0) {
      setBuyPrompted(false);
    }
  }, [
    me?.position,
    stableProperties,
    game_properties,
    game?.players,
    isMyTurn,
    isRolling,
    roll,
    setCurrentProperty,
    setCurrentGameProperty,
    setCurrentAction,
    buyPrompted,
  ]);

  /* ---------- Buy Property ---------- */
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
        await fetchUpdatedGame();
        forceRefetch();
      }
      toast.error(res.data?.message || "Failed to buy property.");
      return;
    } catch (err) {
      console.error("BUY_PROPERTY error:", err);
      toast.error("Unable to complete property purchase.");
    }
  }, [me?.user_id, currentProperty, game.id, fetchUpdatedGame, forceRefetch]);

  /* ---------- End Turn ---------- */
  const END_TURN = useCallback(
    async (id?: number) => {
      if (!id || !lockAction("END")) return;

      try {
        const res = await apiClient.post<ApiResponse>("/game-players/end-turn", {
          user_id: id,
          game_id: game.id,
        });

        if (!res?.data?.success) throw new Error(res?.data?.message || "Server rejected turn end.");

        const updatedGame = await fetchUpdatedGame();
        if (updatedGame?.players) {
          setPlayers(updatedGame.players);
          toast.success("Turn ended. Waiting for next player...");
          setCanRoll(false);
          setRoll(null);
        }

        forceRefetch();
      } catch (err: any) {
        console.error("END_TURN error:", err);
        toast.error(err?.response?.data?.message || "Failed to end turn.");
        forceRefetch();
      } finally {
        unlockAction();
      }
    },
    [game.id, fetchUpdatedGame, lockAction, unlockAction, forceRefetch, setPlayers, setCanRoll, setRoll]
  );

  /* ---------- Roll Dice ---------- */
  const ROLL_DICE = useCallback(async () => {
    if (isRolling || actionLock || !lockAction("ROLL")) return;

    setError(null);
    if (rollAgain) {
      setPendingRoll(12);
    }
    setRollAgain(false);
    setIsRolling(true);

    try {
      const res = await apiClient.post<ApiResponse>(
        "/game-players/can-roll",
        { user_id: me?.user_id, game_id: game.id }
      );

      const allowed = Boolean(res?.data?.data?.canRoll);
      if (!allowed) {
        toast.error("⏳ Not your turn! Wait for your turn to roll.");
        setIsRolling(false);
        unlockAction();
        return;
      }

      // Animation delay
      setTimeout(async () => {
        const value = getDiceValues();
        if (!value) {
          setRollAgain(true);
          setIsRolling(false);
          unlockAction();
          return;
        }

        setRoll(value);
        const currentPos = me?.position ?? 0;
        const newPosition = (currentPos + value.total + pendingRoll) % BOARD_SQUARES;

        try {
          const updateResp = await apiClient.post<ApiResponse>(
            "/game-players/change-position",
            {
              position: newPosition,
              user_id: me?.user_id,
              game_id: game.id,
              rolled: value.total + pendingRoll,
              is_double: value.die1 == value.die2
            }
          );

          if (!updateResp?.data?.success) toast.error("Unable to move from current position");

          setPendingRoll(0);
          const updatedGame = await fetchUpdatedGame();
          if (updatedGame?.players) {
            setPlayers(updatedGame.players);
          }

          setCanRoll(false);
        } catch (err) {
          console.error("Persist move error:", err);
          toast.error("Position update failed, syncing...");
          forceRefetch();
        } finally {
          setIsRolling(false);
          unlockAction();
        }
      }, ROLL_ANIMATION_MS);
    } catch (err) {
      console.error("ROLL_DICE error:", err);
      toast.error("Failed to verify roll eligibility.");
      setIsRolling(false);
      unlockAction();
      forceRefetch();
    }
  }, [
    isRolling,
    actionLock,
    lockAction,
    unlockAction,
    me?.user_id,
    me?.position,
    game.id,
    setIsRolling,
    setPlayers,
    setRollAgain,
    setRoll,
    fetchUpdatedGame,
    forceRefetch,
    setCanRoll,
  ]);

  /* ---------- Derived Data ---------- */
  const playersByPosition = useMemo(() => {
    const map = new Map<number, Player[]>();
    players.forEach((p) => {
      const pos = Number(p.position ?? 0);
      if (!map.has(pos)) map.set(pos, []);
      map.get(pos)!.push(p);
    });
    return map;
  }, [players]);


  const propertyOwner = (property_id: number) => {
    const gp = game_properties.find((gp) => gp.property_id === property_id);
    if (gp) {
      const player = players.find((p) => p.address === gp.address)
      if (player) {
        return player.username
      }
    }
    return null;
  }

  const getGamePropertyForSquare = useCallback((property_id: number): GameProperty | null => {
    return game_properties.find((gp) => gp.property_id === property_id) || null;
  }, [game_properties]);

  const developmentStage = useCallback(
    (property_id: number) =>
      game_properties.find((gp) => gp.property_id === property_id)?.development ?? 0,
    [game_properties]
  );

  /* ---------- Activity Log Helpers ---------- */
  const logRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // auto-scroll to bottom when history changes
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [game.history]);

  /* ---------- Render ---------- */
  return (
    <ErrorBoundary>
      <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white p-4 flex flex-col lg:flex-row gap-4 items-start justify-center relative">
        <div className="flex justify-center items-start w-full lg:w-2/3 max-w-[800px] mt-[-1rem]">
          <div className="w-full bg-[#010F10] aspect-square rounded-lg relative shadow-2xl shadow-cyan-500/10">
            <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[2px] box-border">
              {/* Center Area */}
              <div className="col-start-2 col-span-9 row-start-2 row-span-9 bg-[#010F10] flex flex-col justify-center items-center p-4 relative">
                <h1 className="text-3xl lg:text-5xl font-bold text-[#F0F7F7] font-orbitron text-center mb-4">
                  Tycoon
                </h1>

                {isMyTurn ? (
                  <div
                    className="p-4 rounded-lg w-full max-w-sm bg-cover bg-center"
                    style={{
                      backgroundImage: `url('https://images.unsplash.com/photo-1620283088057-7d4241262d45'), linear-gradient(to bottom, rgba(14, 40, 42, 0.8), rgba(14, 40, 42, 0.8))`,
                    }}
                  >
                    <h2 className="text-base font-semibold text-cyan-300 mb-3">Game Actions</h2>
                    <div className="flex flex-col gap-2">
                      {(() => {
                        const myPlayer = game?.players?.find((p) => p.user_id === me?.user_id);
                        const hasRolled = (myPlayer?.rolls ?? 0) > 0;

                        if (!hasRolled) {
                          return (
                            <button
                              onClick={ROLL_DICE}
                              disabled={isRolling}
                              aria-label="Roll the dice to move your player"
                              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm rounded-full hover:from-cyan-600 hover:to-blue-600 transform hover:scale-105 transition-all duration-200 disabled:opacity-60"
                            >
                              {isRolling ? "Rolling..." : "Roll Dice"}
                            </button>
                          );
                        }

                        return (
                          <div className="flex flex-row items-center gap-2">
                            {
                              currentAction && ["land", "railway", "utility"].includes(currentAction) && !currentGameProperty && currentProperty && (
                                <button
                                  onClick={BUY_PROPERTY}
                                  aria-label="Buy the current property"
                                  className="px-2 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs rounded-full hover:from-green-600 hover:to-emerald-600 transform hover:scale-105 transition-all duration-200"
                                >
                                  Buy Property
                                </button>
                              )
                            }
                            <button
                              onClick={() => END_TURN(me?.user_id)}
                              disabled={actionLock === "ROLL"}
                              aria-label="End your turn"
                              className="px-2 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs rounded-full hover:from-blue-600 hover:to-indigo-600 transform hover:scale-105 transition-all duration-200 disabled:opacity-60"
                            >
                              End Turn
                            </button>
                          </div>
                        );
                      })()}

                      {rollAgain && <p className="text-center text-xs text-red-500">🎯 You rolled a double! Roll again!</p>}
                      {roll && (
                        <p className="text-center text-gray-300 text-xs">
                          🎲 You Rolled - {" "}
                          <span className="font-bold text-white">
                            {roll.die1} + {roll.die2} = {roll.total}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    className="p-4 rounded-lg w-full max-w-sm bg-cover bg-center"
                    style={{
                      backgroundImage: `url('https://images.unsplash.com/photo-1620283088057-7d4241262d45'), linear-gradient(to bottom, rgba(14, 40, 42, 0.8), rgba(14, 40, 42, 0.8))`,
                    }}
                  >
                    <h2 className="text-base font-semibold text-cyan-300 mb-3">Game Actions</h2>
                    <div className="flex flex-col gap-2">
                      <div className="w-full flex flex-col gap-1 items-center">
                        <button
                          disabled
                          className="px-4 py-2 bg-gray-300 text-gray-600 text-sm rounded-full cursor-not-allowed"
                        >
                          Waiting for your turn...
                        </button>
                        {game.history?.length > 0 && (
                          <div className="w-full flex flex-col gap-1 items-center">
                            <p className="text-center text-gray-300 text-xs italic">
                              {game.history[0].player_name} - {game.history[0].comment}
                            </p>
                            {!roll && (<p className="text-center text-gray-300 text-xs underline">
                              [🎲 Rolled - <b>{game.history[0].rolled}</b> | {game.history[0].extra?.description}]
                            </p>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 p-2 bg-gray-800 rounded max-h-40 overflow-y-auto w-full max-w-sm">
                  <h3 className="text-sm font-semibold text-cyan-300 mb-2">Action Log</h3>
                  {(game.history ?? []).map((h, i) => (
                    <p key={i} className="text-xs text-gray-300 mb-1 last:mb-0">
                      {`${h.player_name} ${h.comment}`}
                    </p>
                  ))}
                  {(!game.history || game.history.length === 0) && <p className="text-xs text-gray-500 italic">No actions yet</p>}
                </div>
              </div>

              {/* Card Popup Modal */}
              <AnimatePresence>
                {currentCard && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.7, y: 100, rotate: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.7, y: 100, rotate: 5 }}
                    transition={{ 
                      duration: 0.5, 
                      ease: [0.25, 0.46, 0.45, 0.94], 
                      type: "spring", 
                      stiffness: 300, 
                      damping: 25 
                    }}
                    className="fixed inset-0 flex items-center justify-center z-50 bg-black/70"
                    onClick={() => setCurrentCard(null)} // Close on backdrop click
                  >
                    <motion.div
                      layout
                      className={`max-w-lg w-96 p-8 rounded-2xl shadow-2xl backdrop-blur-sm border border-cyan-500/30 relative ${
                        currentCard.type === "chance"
                          ? "bg-gradient-to-br from-orange-500/30 to-yellow-500/30 text-orange-100"
                          : "bg-gradient-to-br from-blue-500/30 to-indigo-500/30 text-blue-100"
                      }`}
                      onClick={(e) => e.stopPropagation()} // Prevent close on card click
                    >
                      <button
                        onClick={() => setCurrentCard(null)}
                        className="absolute top-4 right-4 text-2xl text-gray-400 hover:text-gray-200 transition-colors p-1 rounded-full hover:bg-gray-800/50"
                      >
                        &times;
                      </button>
                      <motion.h3 
                        className="text-xl font-bold mb-6 text-center uppercase tracking-wide"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                      >
                        {currentCard.type === "chance" ? "Chance" : "Community Chest"}
                      </motion.h3>
                      <motion.p 
                        className="text-base leading-relaxed text-center italic mb-6"
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3, duration: 0.4 }}
                      >
                        "{currentCard.message}"
                      </motion.p>
                      {currentCard.action && (
                        <motion.p 
                          className="text-sm text-center opacity-80 bg-white/10 p-2 rounded-lg"
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: 0.4, duration: 0.4 }}
                        >
                          Action: {currentCard.action}
                        </motion.p>
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Board Squares */}
              {boardData.map((square, index) => {
                const playersHere = playersByPosition.get(index) ?? [];
                const gameProp = getGamePropertyForSquare(square.id);
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

                      {/* Development Level Indicator */}
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
      </div>
    </ErrorBoundary>
  );
};

export default GameBoard;