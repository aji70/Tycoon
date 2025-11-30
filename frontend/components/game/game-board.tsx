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
import PropertyCard from "./cards/property-card";
import SpecialCard from "./cards/special-card";
import CornerCard from "./cards/corner-card";
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
import { useQueryClient } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
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
  const [buyPrompted, setBuyPrompted] = useSafeState<boolean>(false);
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
      const res = await apiClient.get<ApiResponse>(`/games/code/${game.code}`);
      if (res?.data?.success) {
        const gameData = res.data?.data;
        if (gameData && Array.isArray(gameData.players)) {
          setPlayers((prev) => {
            const changed = JSON.stringify(prev) !== JSON.stringify(gameData.players);
            return changed ? gameData.players : prev;
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

  // Property Action Trigger

  const stableProperties = useMemo(() => properties, [properties]);

  useEffect(() => {
    if (!stableProperties.length || !me?.position || !game?.players) return;

    if (me.position === lastProcessedPosition.current) return;

    lastProcessedPosition.current = me.position;

    const square = stableProperties.find((p) => p.id === me.position);
    if (!square) return;

    const game_property = game_properties.find((p) => p.property_id === square.id) || null;

    const action = PROPERTY_ACTION(square.id);

    setCurrentProperty(square);
    setCurrentGameProperty(game_property);
    setCurrentAction(action);

    const meInGame = game.players.find((p) => p.user_id === me?.user_id);
    const hasRolled = (meInGame?.rolls ?? 0) > 0;

    if (isMyTurn && hasRolled && !isRolling && roll !== null && action === "land" && !game_property) {
      toast("💰 You can buy this property!", { icon: "🏠" });
      setBuyPrompted(true);
    }

    if (!isMyTurn || roll === null || meInGame?.rolls === 0) {
      setBuyPrompted(false);
    }
  }, [me?.position, stableProperties, game_properties, game?.players, isMyTurn, isRolling, roll, setCurrentProperty, setCurrentGameProperty, setCurrentAction, setBuyPrompted]);

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
          setBuyPrompted(false);
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
    [game.id, fetchUpdatedGame, lockAction, unlockAction, forceRefetch, setPlayers, setCanRoll, setRoll, setBuyPrompted]
  );

  /* ---------- Buy Property ---------- */
  const BUY_PROPERTY = useCallback(async () => {
    if (!me?.user_id || !currentProperty) return;

    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/buy", {
        user_id: me.user_id,
        game_id: game.id,
        property_id: currentProperty.id,
      });

      if (res?.data?.success) {
        toast.success(`🏠 You bought ${currentProperty.name}!`);
        await fetchUpdatedGame();
        forceRefetch();
        setBuyPrompted(false);
        setTimeout(() => END_TURN(me.user_id), 1000);
      } else {
        toast.error(res.data?.message || "Failed to buy property.");
      }
    } catch (err) {
      console.error("BUY_PROPERTY error:", err);
      toast.error("Unable to complete property purchase.");
    }
  }, [me?.user_id, currentProperty, game.id, fetchUpdatedGame, forceRefetch, END_TURN, setBuyPrompted]);

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

  /* ---------- Auto End Turn ---------- */
  useEffect(() => {
    if (!isMyTurn || isRolling || actionLock) return;

    const myPlayer = players.find(p => p.user_id === me?.user_id);
    if (!myPlayer?.rolls || myPlayer.rolls === 0) return;

    if (!buyPrompted) {
      const timer = setTimeout(() => END_TURN(me?.user_id), 1200);
      return () => clearTimeout(timer);
    }
  }, [isMyTurn, isRolling, actionLock, players, me?.user_id, buyPrompted, END_TURN]);

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

  const currentPlayer = players.find((p) => p.user_id === game.next_player_id);

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

                {isMyTurn ? (
                  (() => {
                    const myPlayer = game?.players?.find((p) => p.user_id === me?.user_id);
                    const hasRolled = (myPlayer?.rolls ?? 0) > 0;

                    // 1. Haven't rolled yet → Roll Dice button
                    if (!hasRolled) {
                      return (
                        <button
                          onClick={ROLL_DICE}
                          disabled={isRolling}
                          className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xl rounded-full hover:from-cyan-600 hover:to-blue-700 transform hover:scale-110 active:scale-95 transition-all disabled:opacity-50 shadow-2xl"
                        >
                          {isRolling ? "Rolling..." : "Roll Dice"}
                        </button>
                      );
                    }

                    // 2. Landed on a buyable property → show Buy + Skip
                    if (buyPrompted && currentProperty) {
                      return (
                        <div className="flex gap-4 flex-wrap justify-center">
                          <button
                            onClick={BUY_PROPERTY}
                            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-full hover:from-green-600 hover:to-emerald-700 transform hover:scale-110 active:scale-95 transition-all shadow-lg"
                          >
                            Buy for ${currentProperty.price}
                          </button>
                          <button
                            onClick={() => {
                              toast("Purchase skipped");
                              setBuyPrompted(false);
                              END_TURN(me?.user_id);
                            }}
                            className="px-6 py-3 bg-gray-600 text-white font-bold rounded-full hover:bg-gray-700 transform hover:scale-105 active:scale-95 transition-all shadow-lg"
                          >
                            Skip
                          </button>
                        </div>
                      );
                    }

                    // 3. Has rolled + NOT on a buyable property → show End Turn immediately
                    // This covers: Chance, Community Chest, Tax, Go to Jail, Free Parking, owned properties, etc.
                    return (
                      <button
                        onClick={() => END_TURN(me?.user_id)}
                        disabled={actionLock === "ROLL"}
                        className="px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-xl rounded-full hover:from-blue-600 hover:to-indigo-600 transform hover:scale-110 active:scale-95 transition-all disabled:opacity-50 shadow-2xl"
                      >
                        End Turn
                      </button>
                    );
                  })()
                ) : (
                  <div className="mt-5 text-center z-10">
                    <motion.h2
                      className="text-2xl font-bold text-pink-300 mb-3"
                      animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.05, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                      {currentPlayer?.username} is playing…
                    </motion.h2>
                    <div className="flex justify-center mt-4">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-cyan-400"></div>
                    </div>
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

              {/* Board Squares */}
              {boardData.map((square) => {
                const playersHere = playersByPosition.get(square.id) ?? [];
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
    </ErrorBoundary>
  );
};

export default GameBoard;