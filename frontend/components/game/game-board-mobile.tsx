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
  CardTypes,
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
const ROLL_ANIMATION_MS = 800; // Reduced for mobile snappiness

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
          className="absolute w-5 h-5 bg-black rounded-full shadow-inner" // Smaller dots for mobile
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

const MobileGameLayout = ({
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
  const [roll, setRoll] = useSafeState<{ die1: number; die2: number; total: number } | null>(null);
  const [pendingRoll, setPendingRoll] = useSafeState<number>(0);
  const [canRoll, setCanRoll] = useSafeState<boolean>(false);
  const [actionLock, setActionLock] = useSafeState<"ROLL" | "END" | null>(null);
  const [currentCard, setCurrentCard] = useSafeState<CardPopup | null>(null);
  const [showLog, setShowLog] = useState(false); // For collapsible log
  const [focusedProperty, setFocusedProperty] = useState<Property | null>(null); // For modal inspect

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
      const res = await apiClient.get<ApiResponse>(`/games/code/${game.code}`);
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
      const res = await apiClient.post<ApiResponse>("/game-players/can-roll", {
        user_id: me.user_id,
        game_id: game.id,
      });
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
    const interval = setInterval(poll, 8000); // Slightly faster polling for multiplayer
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

    const game_property = game_properties.find((p) => p.property_id === square.id) || null;

    const action = PROPERTY_ACTION(square.id);

    setCurrentProperty(square);
    setCurrentGameProperty(game_property);
    setCurrentAction(action);

    const meInGame = game.players.find((p) => p.user_id === me?.user_id);
    const hasRolled = (meInGame?.rolls ?? 0) > 0;

    if (
      isMyTurn &&
      !buyPrompted &&
      hasRolled &&
      isRolling === false &&
      roll !== null &&
      action &&
      ["land", "railway", "utility"].includes(action) &&
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

  // Extract real card message from action log
  const latestCardEntry = useMemo<CardPopup | null>(() => {
    if (!game.history || game.history.length === 0) return null;

    const entry = game.history[game.history.length - 1];
    const rawComment = entry.comment ?? "";
    const comment = rawComment.toLowerCase();
    if (
      !comment.includes("drew chance") &&
      !comment.includes("drew community chest") &&
      !comment.includes("chance:") &&
      !comment.includes("community chest:")
    )
      return null;

    const isChance = comment.includes("chance");

    const match = rawComment.match(/(?:drew chance|drew community chest)[:-]?\s*(.+)/i);
    const message = match ? match[1].trim() : rawComment;

    return {
      type: isChance ? ("chance" as const) : ("community_chest" as const),
      message: message || "Card drawn",
    };
  }, [game.history]);

  // Auto-show card when a new card appears in the log
  const historyLengthRef = useRef(0);
  useEffect(() => {
    if (latestCardEntry && game.history.length > historyLengthRef.current) {
      setCurrentCard(latestCardEntry);
      const timer = setTimeout(() => setCurrentCard(null), 6000); // Shorter for mobile
      historyLengthRef.current = game.history.length;
      return () => clearTimeout(timer);
    }
  }, [game.history, latestCardEntry, setCurrentCard]);

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
      } else {
        toast.error(res.data?.message || "Failed to buy property.");
      }
    } catch (err) {
      console.error("BUY_PROPERTY error:", err);
      toast.error("Unable to complete property purchase.");
    } finally {
      setBuyPrompted(false);
      // Auto-end turn after buy
      setTimeout(() => END_TURN(me?.user_id), 1000);
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
    [
      game.id,
      fetchUpdatedGame,
      lockAction,
      unlockAction,
      forceRefetch,
      setPlayers,
      setCanRoll,
      setRoll,
    ]
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
      const res = await apiClient.post<ApiResponse>("/game-players/can-roll", {
        user_id: me?.user_id,
        game_id: game.id,
      });

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
              is_double: value.die1 === value.die2,
            }
          );

          if (!updateResp?.data?.success)
            toast.error("Unable to move from current position");

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

  // Auto-end turn if no actions needed (for human player)
  useEffect(() => {
    if (!isMyTurn || isRolling || actionLock) return;
    const myPlayer = game?.players?.find((p) => p.user_id === me?.user_id);
    if (!myPlayer?.rolls || myPlayer.rolls === 0) return;

    const square = currentProperty;
    if (!square) return;

    const isOwned = game_properties.some((gp) => gp.property_id === square.id);
    const action = PROPERTY_ACTION(square.id);
    const canBuy =
      !isOwned && action && ["land", "railway", "utility"].includes(action);

    // If player CAN buy → wait for decision (buyPrompted handles it)
    // If player CANNOT buy → auto-end turn
    if (!canBuy && !buyPrompted) {
      const timer = setTimeout(() => {
        END_TURN(me?.user_id);
      }, 1200); // Small delay for visual clarity

      return () => clearTimeout(timer);
    }
  }, [
    isMyTurn,
    isRolling,
    actionLock,
    game?.players,
    me?.user_id,
    currentProperty,
    game_properties,
    buyPrompted,
    END_TURN,
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
      const player = players.find((p) => p.address === gp.address);
      if (player) {
        return player.username;
      }
    }
    return null;
  };

  const getGamePropertyForSquare = useCallback(
    (property_id: number): GameProperty | null => {
      return game_properties.find((gp) => gp.property_id === property_id) || null;
    },
    [game_properties]
  );

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

  // Auto-focus on current position after roll
  const boardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (boardRef.current && currentProperty) {
      const squareElement = boardRef.current.querySelector(
        `[data-position="${currentProperty.id}"]`
      );
      if (squareElement) {
        squareElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });
      }
    }
  }, [currentProperty]);

  // Toast helper to prevent multiples
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "default" = "default") => {
      // Dismiss any existing toast first
      toast.dismiss();

      if (type === "success") toast.success(message);
      else if (type === "error") toast.error(message);
      else toast(message, { icon: "➤" });
    },
    []
  );

  /* ---------- Render ---------- */
  return (
    <ErrorBoundary>
      <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white flex flex-col items-center justify-start relative overflow-hidden">
        {/* Board Section - Scaled and Zoomable */}
        <div
          ref={boardRef}
          className="w-full max-w-[95vw] max-h-[60vh] overflow-auto touch-pinch-zoom touch-pan-x touch-pan-y aspect-square relative shadow-2xl shadow-cyan-500/10 mt-4"
        >
          <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[1px] box-border scale-90 sm:scale-100">
            {/* Reduced gap and scale for mobile */}
            {/* Center Area */}
            <div className="col-start-2 col-span-9 row-start-2 row-span-9 bg-[#010F10] flex flex-col justify-center items-center p-2 relative">
              {/* Reduced padding */}
              <h1 className="text-2xl font-bold text-[#F0F7F7] font-orbitron text-center mb-4 z-10">
                {/* Smaller title */}
                Tycoon
              </h1>

              {/* Rolling Dice Animation */}
              <AnimatePresence>
                {isRolling && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute inset-0 flex items-center justify-center gap-8 z-20 pointer-events-none"
                  >
                    {/* Smaller gap */}
                    <motion.div
                      animate={{
                        rotateX: [0, 360, 720, 1080],
                        rotateY: [0, 360, -360, 720],
                      }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="relative w-20 h-20 bg-white rounded-xl shadow-2xl border-2 border-gray-800"
                      style={{
                        boxShadow:
                          "0 15px 30px rgba(0,0,0,0.7), inset 0 5px 10px rgba(255,255,255,0.5)",
                      }}
                    >
                      {/* Smaller dice */}
                      {roll ? (
                        <DiceFace value={roll.die1} />
                      ) : (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 0.3,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                          className="flex h-full items-center justify-center text-4xl font-bold text-gray-400"
                        >
                          ?
                        </motion.div>
                      )}
                    </motion.div>
                    <motion.div
                      animate={{
                        rotateX: [0, -720, 360, 1080],
                        rotateY: [0, -360, 720, -360],
                      }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                      className="relative w-20 h-20 bg-white rounded-xl shadow-2xl border-2 border-gray-800"
                      style={{
                        boxShadow:
                          "0 15px 30px rgba(0,0,0,0.7), inset 0 5px 10px rgba(255,255,255,0.5)",
                      }}
                    >
                      {roll ? (
                        <DiceFace value={roll.die2} />
                      ) : (
                        <motion.div
                          animate={{ rotate: -360 }}
                          transition={{
                            duration: 0.3,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                          className="flex h-full items-center justify-center text-4xl font-bold text-gray-400"
                        >
                          ?
                        </motion.div>
                      )}
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
                  {/* Smaller text */}
                  <span className="text-cyan-400 drop-shadow-2xl">{roll.die1}</span>
                  <span className="text-white text-4xl">+</span>
                  <span className="text-pink-400 drop-shadow-2xl">{roll.die2}</span>
                  <span className="text-white mx-2 text-4xl">=</span>
                  <span className="text-yellow-400 text-6xl drop-shadow-2xl">
                    {roll.total}
                  </span>
                </motion.div>
              )}

              {isMyTurn ? null : ( // Hide controls in center for mobile, move to bottom
                <div className="mt-2 text-center z-10">
                  <motion.h2
                    className="text-lg font-bold text-pink-300 mb-2"
                    animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.05, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    {currentPlayer?.username} is playing…
                  </motion.h2>
                  <div className="flex justify-center mt-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-400"></div>{" "}
                    {/* Smaller spinner */}
                  </div>
                </div>
              )}

              {rollAgain && (
                <p className="text-center text-xs text-red-500">
                  🎯 You rolled a double! Roll again!
                </p>
              )}
            </div>

            {/* Card Popup Modal - Smaller for mobile */}
            <AnimatePresence>
              {currentCard && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                  onClick={() => setCurrentCard(null)}
                >
                  <motion.div
                    initial={{ scale: 0, rotateY: -180 }}
                    animate={{ scale: 1, rotateY: 0 }}
                    exit={{ scale: 0, rotateY: 180 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className={`relative w-80 max-w-full mx-4 p-6 rounded-3xl shadow-2xl overflow-hidden border
                      ${
                        currentCard.type === "chance"
                          ? "bg-gradient-to-br from-orange-600/90 to-amber-600/90 border-orange-400"
                          : "bg-gradient-to-br from-indigo-600/90 to-purple-600/90 border-purple-400"
                      }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Card Back Pattern */}
                    <div className="absolute inset-0 opacity-10">
                      {currentCard.type === "chance" ? "Chance" : "Community Chest"}
                    </div>

                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-white/20 animate-pulse" />

                    {/* Header */}
                    <motion.div
                      initial={{ y: -30, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-center mb-4"
                    >
                      <h2 className="text-2xl font-bold uppercase tracking-widest text-white drop-shadow-lg">
                        {currentCard.type === "chance" ? "Chance" : "Community Chest"}
                      </h2>
                      {currentCard.type === "chance" ? (
                        <span className="text-4xl">?</span>
                      ) : (
                        <span className="text-4xl">Chest</span>
                      )}
                    </motion.div>

                    {/* Message */}
                    <motion.p
                      initial={{ y: 30, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="text-lg text-center font-medium text-white leading-relaxed px-4 drop-shadow-md"
                    >
                      {currentCard.message}
                    </motion.p>

                    {/* Close button */}
                    <button
                      onClick={() => setCurrentCard(null)}
                      className="absolute top-2 right-2 text-white/70 hover:text-white text-2xl transition"
                    >
                      ×
                    </button>

                    {/* Decorative bottom glow */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30" />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Board Squares */}
            {boardData.map((square) => {
              const playersHere = playersByPosition.get(square.id) ?? [];
              const gameProp = getGamePropertyForSquare(square.id);
              const devLevel = developmentStage(square.id);

              return (
                <motion.div
                  key={square.id}
                  data-position={square.id} // For scrolling to
                  style={{
                    gridRowStart: square.grid_row,
                    gridColumnStart: square.grid_col,
                  }}
                  className="w-full h-full p-[1px] relative box-border group hover:z-10 transition-transform duration-200"
                  whileHover={{ scale: 1.5, zIndex: 50 }} // Reduced hover scale for mobile
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  onClick={() => setFocusedProperty(square)} // Tap to inspect
                >
                  <div
                    className={`w-full h-full transform group-hover:scale-150 ${
                      isTopHalf(square)
                        ? "origin-top group-hover:origin-bottom group-hover:translate-y-[50px]"
                        : ""
                    } group-hover:shadow-lg group-hover:shadow-cyan-500/50 transition-transform duration-200 rounded-sm overflow-hidden bg-black/20 p-0.5`}
                  >
                    {/* Smaller padding, reduced transform */}
                    {square.type === "property" && (
                      <PropertyCard
                        square={square}
                        owner={propertyOwner(square.id)}
                      />
                    )}
                    {["community_chest", "chance", "luxury_tax", "income_tax"].includes(
                      square.type
                    ) && <SpecialCard square={square} />}
                    {square.type === "corner" && <CornerCard square={square} />}

                    {/* Development Level Indicator */}
                    {square.type === "property" && devLevel > 0 && (
                      <div className="absolute top-0.5 right-0.5 bg-yellow-500 text-black text-xxs font-bold rounded px-0.5 z-20 flex items-center gap-0.5">
                        {/* Smaller */}
                        {devLevel === 5 ? "🏨" : `🏠 ${devLevel}`}
                      </div>
                    )}

                    <div className="absolute bottom-0.5 left-0.5 flex flex-col gap-1 z-10">
                      {/* Stack vertically for multiple players */}
                      {playersHere.map((p) => {
                        const isCurrentPlayer = p.user_id === game.next_player_id;
                        return (
                          <motion.span
                            key={p.user_id}
                            title={`${p.username} (${p.balance})`}
                            className={`text-lg border-2 rounded ${
                              isCurrentPlayer
                                ? "border-cyan-300"
                                : "border-transparent"
                            }`}
                            // Smaller symbols
                            initial={{ scale: 1 }}
                            animate={{
                              y: isCurrentPlayer ? [0, -4, 0] : [0, -2, 0], // Less bouncy
                              scale: isCurrentPlayer ? [1, 1.05, 1] : 1,
                              rotate: isCurrentPlayer ? [0, 3, -3, 0] : 0,
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
                            whileHover={{ scale: 1.1, y: -1 }}
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

        {/* Controls Section - Below Board */}
        <div className="w-full max-w-[95vw] flex flex-col items-center p-4 gap-4">
          {/* HUMAN TURN Controls */}
          {isMyTurn &&
            (() => {
              const myPlayer = game?.players?.find((p) => p.user_id === me?.user_id);
              const hasRolled = (myPlayer?.rolls ?? 0) > 0;

              if (!hasRolled) {
                return (
                  <button
                    onClick={ROLL_DICE}
                    disabled={isRolling}
                    className="w-[80vw] py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-lg rounded-full hover:from-green-600 hover:to-emerald-700 transform hover:scale-105 active:scale-95 transition-all disabled:opacity-50 shadow-xl"
                  >
                    {/* Enlarged for touch */}
                    {isRolling ? "Rolling..." : "Roll Dice"}
                  </button>
                );
              }

              return (
                <button
                  onClick={() => END_TURN(me?.user_id)}
                  disabled={actionLock === "ROLL"}
                  className="w-[80vw] py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold text-lg rounded-full hover:from-blue-600 hover:to-indigo-600 transform hover:scale-105 active:scale-95 transition-all disabled:opacity-50 shadow-xl"
                >
                  End Turn
                </button>
              );
            })()}

          {/* Action Log - Collapsible */}
          <div className="w-full bg-gray-900/95 backdrop-blur-md rounded-xl border border-cyan-500/30 shadow-2xl overflow-hidden">
            <button
              onClick={() => setShowLog(!showLog)}
              className="w-full p-3 border-b border-cyan-500/20 bg-gray-800/80 flex justify-between items-center"
            >
              <h3 className="text-sm font-bold text-cyan-300 tracking-wider">
                Action Log
              </h3>
              <span>{showLog ? "▲" : "▼"}</span>
            </button>
            {showLog && (
              <div
                ref={logRef}
                className="max-h-32 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-thin scrollbar-thumb-cyan-600"
              >
                {/* Limited height */}
                {(!game.history || game.history.length === 0) ? (
                  <p className="text-center text-gray-500 text-xs italic py-4">
                    No actions yet
                  </p>
                ) : (
                  game.history.slice(-5).map((h, i) => (
                    // Show last 5 for brevity
                    <motion.p
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-gray-300"
                    >
                      <span className="font-medium text-cyan-200">
                        {h.player_name}
                      </span>{" "}
                      {h.comment}
                      {h.rolled && (
                        <span className="text-cyan-400 font-bold ml-1">
                          [Rolled {h.rolled}]
                        </span>
                      )}
                    </motion.p>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Buy Prompt as Bottom Sheet */}
        <AnimatePresence>
          {isMyTurn && buyPrompted && currentProperty && (
               <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 20 }}
                  className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-md p-4 rounded-t-2xl shadow-2xl z-[60] flex flex-col items-center gap-4"  // Changed to z-[60]
                  >
              <h3 className="text-lg font-bold text-white">
                Buy {currentProperty.name}?
              </h3>
              <p className="text-sm text-gray-300">
                Price: ${currentProperty.price}
              </p>
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
                    setTimeout(() => END_TURN(me?.user_id), 800);
                  }}
                  className="flex-1 py-3 bg-gray-600 text-white font-bold rounded-full hover:bg-gray-700 transform hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                  Skip
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Property Inspect Modal */}
        <AnimatePresence>
          {focusedProperty && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 flex items-center justify-center z-50 bg-black/70"
              onClick={() => setFocusedProperty(null)}
            >
              <motion.div
                className="max-w-md w-4/5 p-6 bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl border border-cyan-500/30"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setFocusedProperty(null)}
                  className="absolute top-2 right-2 text-xl hover:text-white"
                >
                  X
                </button>
                {/* Render enlarged PropertyCard or details here */}
                {focusedProperty.type === "property" && (
                  <PropertyCard
                    square={focusedProperty}
                    owner={propertyOwner(focusedProperty.id)}
                  />
                )}
                {/* Add more details like rent, owner, etc. */}
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
              padding: "8px 16px", // Smaller padding
              fontSize: "14px", // Smaller font
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
    </ErrorBoundary>
  );
};

export default MobileGameLayout;