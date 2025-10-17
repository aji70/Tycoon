"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Component,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import PropertyCard from "./cards/property-card";
import SpecialCard from "./cards/special-card";
import CornerCard from "./cards/corner-card";
import { getPlayerSymbol } from "@/lib/types/symbol";
import { apiClient } from "@/lib/api";
import {
  Game,
  GameProperty,
  Property,
  Player,
  PROPERTY_ACTION,
} from "@/types/game";
import { ApiResponse } from "@/types/api";

/* -------------------------------------------
   Error Boundary
------------------------------------------- */
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError)
      return (
        <div className="text-red-400 text-center mt-10">
          Something went wrong. Please refresh the page.
        </div>
      );
    return this.props.children;
  }
}

/* -------------------------------------------
   Helpers
------------------------------------------- */
const BOARD_SQUARES = 40;
const ROLL_ANIMATION_MS = 1200;
const getDiceValues = () => {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const total = die1 + die2;
  return total === 12 ? null : { die1, die2, total };
};

function useSafeState<S>(initial: S) {
  const mounted = useRef(false);
  const [state, setState] = useState(initial);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const safeSetState = useCallback(
    (v: React.SetStateAction<S>) => mounted.current && setState(v),
    []
  );
  return [state, safeSetState] as const;
}

/* -------------------------------------------
   Main Component
------------------------------------------- */
export default function GameBoard({
  game,
  properties,
  game_properties,
  my_properties,
  me,
}: {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  my_properties: Property[];
  me: Player | null;
}) {
  const { address } = useAccount();
  const router = useRouter();
  const queryClient = useQueryClient();

  /* --- State --- */
  const [players, setPlayers] = useSafeState<Player[]>(game.players ?? []);
  const [boardData] = useSafeState<Property[]>(properties ?? []);
  const [isRolling, setIsRolling] = useSafeState(false);
  const [roll, setRoll] = useSafeState<{ die1: number; die2: number; total: number } | null>(null);
  const [canRoll, setCanRoll] = useSafeState(false);
  const [rollAgain, setRollAgain] = useSafeState(false);
  const [actionLock, setActionLock] = useSafeState<"ROLL" | "END" | null>(null);
  const [currentProperty, setCurrentProperty] = useSafeState<Property | null>(null);
  const [currentGameProperty, setCurrentGameProperty] = useSafeState<GameProperty | null>(null);
  const [currentAction, setCurrentAction] = useSafeState<string | null>(null);
  const [buyPrompted, setBuyPrompted] = useState(false);
  const [history, setHistory] = useSafeState(game.history ?? []);

  const isMyTurn = me?.user_id && game.next_player_id === me.user_id;

  /* --- Utils --- */
  const lockAction = useCallback(
    (type: "ROLL" | "END") => {
      if (actionLock) return false;
      setActionLock(type);
      return true;
    },
    [actionLock]
  );
  const unlockAction = useCallback(() => setActionLock(null), []);

  const forceRefetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["game", game.code] });
  }, [queryClient, game.code]);

  const fetchUpdatedGame = useCallback(async () => {
    try {
      const { data } = await apiClient.get<ApiResponse<Game>>(`/games/code/${game.code}`);
      if (data?.players) setPlayers(data.players);
      if (data?.history) setHistory(data.history);
      return data;
    } catch {
      return null;
    }
  }, [game.code]);

  /* --- Poll every 5s --- */
  useEffect(() => {
    const poll = async () => {
      await fetchUpdatedGame();
    };
    poll();
    const i = setInterval(poll, 5000);
    return () => clearInterval(i);
  }, [fetchUpdatedGame]);

  /* --- Activity Log Auto-scroll --- */
  const logRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [history]);

  /* --- Hover Zoom Card --- */
  const MotionDiv = motion.div;

  /* --- Dice Roll --- */
  const ROLL_DICE = useCallback(async () => {
    if (isRolling || actionLock || !lockAction("ROLL")) return;
    setIsRolling(true);

    setTimeout(async () => {
      const value = getDiceValues();
      if (!value) {
        setRollAgain(true);
        setIsRolling(false);
        unlockAction();
        return;
      }
      setRoll(value);
      toast.success(`🎲 You rolled ${value.total}`);
      await fetchUpdatedGame();
      setIsRolling(false);
      unlockAction();
    }, ROLL_ANIMATION_MS);
  }, [isRolling, lockAction, unlockAction, fetchUpdatedGame]);

  /* --- Players on each position --- */
  const playersByPosition = useMemo(() => {
    const map = new Map<number, Player[]>();
    players.forEach((p) => {
      const pos = Number(p.position ?? 0);
      if (!map.has(pos)) map.set(pos, []);
      map.get(pos)!.push(p);
    });
    return map;
  }, [players]);

  const propertyOwner = (id: number) => {
    const gp = game_properties.find((gp) => gp.property_id === id);
    const player = players.find((p) => p.address === gp?.address);
    return player?.username || null;
  };

  /* --- UI --- */
  return (
    <ErrorBoundary>
      <div className="flex flex-col lg:flex-row w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white gap-4 p-4 items-start justify-center relative">
        {/* Board */}
        <div className="flex justify-center items-start w-full lg:w-2/3 max-w-[900px] mt-[-1rem]">
          <div className="w-full bg-[#010F10] aspect-square rounded-lg relative shadow-2xl shadow-cyan-500/10 overflow-hidden">
            <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[2px] box-border">
              {/* Center */}
              <motion.div
                className="col-start-2 col-span-9 row-start-2 row-span-9 flex flex-col justify-center items-center p-4 relative"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
              >
                <h1 className="text-3xl lg:text-5xl font-bold text-cyan-100 font-orbitron text-center mb-4">
                  Blockopoly
                </h1>

                <AnimatePresence>
                  {isMyTurn ? (
                    <motion.div
                      key="turn"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.3 }}
                      className="flex flex-col gap-2 items-center"
                    >
                      <motion.button
                        onClick={ROLL_DICE}
                        disabled={isRolling}
                        whileTap={{ scale: 0.95 }}
                        whileHover={{ scale: 1.05 }}
                        className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full text-sm shadow-lg"
                      >
                        {isRolling ? "Rolling..." : "Roll Dice"}
                      </motion.button>

                      {roll && (
                        <motion.p
                          key={roll.total}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-gray-300 text-xs"
                        >
                          🎲 You Rolled <b>{roll.die1}</b> + <b>{roll.die2}</b> ={" "}
                          <span className="text-white font-bold">{roll.total}</span>
                        </motion.p>
                      )}
                      {rollAgain && (
                        <p className="text-xs text-amber-400">
                          🎯 Double! Roll again!
                        </p>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="waiting"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col gap-1 items-center"
                    >
                      <p className="px-4 py-2 bg-gray-300 text-gray-600 rounded-full text-sm">
                        Waiting for your turn...
                      </p>
                      {game.history?.[0] && (
                        <p className="text-xs italic text-gray-300 text-center">
                          {game.history[0].player_name} — {game.history[0].comment}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Squares */}
              {boardData.map((square, index) => {
                const playersHere = playersByPosition.get(index) ?? [];
                return (
                  <MotionDiv
                    key={square.id}
                    style={{
                      gridRowStart: square.grid_row,
                      gridColumnStart: square.grid_col,
                    }}
                    whileHover={{ scale: 1.12, zIndex: 20 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="relative w-full h-full rounded-sm cursor-pointer"
                  >
                    {square.type === "property" && (
                      <PropertyCard square={square} owner={propertyOwner(square.id)} />
                    )}
                    {square.type === "special" && <SpecialCard square={square} />}
                    {square.type === "corner" && <CornerCard square={square} />}

                    {/* Player Icons */}
                    <div className="absolute bottom-1 left-1 flex gap-1 z-20">
                      {playersHere.map((p) => (
                        <motion.span
                          key={p.user_id}
                          animate={{
                            scale: p.user_id === game.next_player_id ? [1, 1.2, 1] : 1,
                          }}
                          transition={{
                            repeat: Infinity,
                            duration: 1.5,
                            ease: "easeInOut",
                          }}
                          className="text-xl"
                        >
                          {getPlayerSymbol(p.symbol)}
                        </motion.span>
                      ))}
                    </div>
                  </MotionDiv>
                );
              })}
            </div>
          </div>
        </div>

        {/* Activity Log */}
        <motion.div
          className="w-full lg:w-1/3 bg-black/40 backdrop-blur-md rounded-lg p-4 h-[600px] overflow-y-auto border border-cyan-700/30 shadow-inner"
          ref={logRef}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-xl font-semibold mb-3 text-cyan-300">Activity Log</h2>
          {history?.length > 0 ? (
            history
              .slice()
              .reverse()
              .map((h) => (
                <motion.div
                  key={h.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border-b border-gray-700/40 pb-2 mb-2"
                >
                  <p className="text-sm font-semibold text-cyan-200">
                    {h.player_name} <span className="text-gray-400 text-xs">({h.player_symbol})</span>
                  </p>
                  <p className="text-xs text-gray-300">{h.comment}</p>
                  <p className="text-xs text-gray-500 italic">
                    🎲 Rolled {h.rolled} — {h.extra?.description}
                  </p>
                </motion.div>
              ))
          ) : (
            <p className="text-gray-500 text-sm italic">No activity yet.</p>
          )}
        </motion.div>
      </div>
    </ErrorBoundary>
  );
}
