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
import toast from "react-hot-toast";

/* ---------- Types ---------- */
interface GameProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  my_properties: Property[];
  me: Player | null;
  loading?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/* ---------- ErrorBoundary ---------- */
class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-red-400 text-center">
          Something went wrong. Please refresh the page.
        </div>
      );
    }
    return this.props.children;
  }
}

/* ---------- Constants ---------- */
const BOARD_SQUARES = 40;
const ROLL_ANIMATION_MS = 1200;

/* ---------- Dice helper ---------- */
const getDiceValues = (): { die1: number; die2: number; total: number } | null => {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const total = die1 + die2;
  if (total === 12) return null;
  return { die1, die2, total };
};

/* ---------- Component ---------- */
const GameBoard = ({
  game,
  properties,
  my_properties,
  me,
  loading = false,
}: GameProps) => {
  const { address } = useAccount();
  const router = useRouter();
  const queryClient = useQueryClient();

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [players, setPlayers] = useState<Player[]>(game?.players ?? []);
  const [boardData, setBoardData] = useState<Property[]>(properties ?? []);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [rollAgain, setRollAgain] = useState(false);
  const [rollAction, setRollAction] = useState<CardTypes | null>(null);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [roll, setRoll] = useState<{ die1: number; die2: number; total: number } | null>(null);

  /* ---------- Action Lock ---------- */
  const [actionLock, setActionLock] = useState<"ROLL" | "END" | null>(null);
  const lockAction = useCallback(
    (type: "ROLL" | "END") => {
      if (actionLock) return false;
      setActionLock(type);
      return true;
    },
    [actionLock]
  );
  const unlockAction = useCallback(() => setActionLock(null), []);

  /* ---------- Utilities ---------- */
  const forceRefetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["game", game.code] });
  }, [queryClient, game.code]);

  const safeSetPlayers = useCallback(
    (updater: (prev: Player[]) => Player[]) => {
      if (!isMountedRef.current) return;
      setPlayers((prev) => updater(prev));
    },
    []
  );

  const fetchUpdatedGame = useCallback(async () => {
    const resp = await apiClient.get<Game>(`/games/code/${game.code}`);
    return resp;
  }, [game.code]);

  /* ---------- UPDATE_GAME_PLAYER_POSITION ---------- */
  const UPDATE_GAME_PLAYER_POSITION = useCallback(
    async (id: number | undefined | null, position: number, rolled: number) => {
      if (!id) return;
      setError(null);
      const prevPlayers = players;

      safeSetPlayers((prevPlayers) =>
        prevPlayers.map((p) => (p.user_id === id ? { ...p, position } : p))
      );

      try {
        const resp = await apiClient.post("/game-players/change-position", {
          position,
          user_id: id,
          game_id: game.id,
          rolled,
        });
        if (!resp) throw new Error("Server rejected position update.");

        const updatedGame = await fetchUpdatedGame();
        if (updatedGame?.players && isMountedRef.current) {
          setPlayers(updatedGame.players);
          setPropertyId(position);
          setRollAction(PROPERTY_ACTION(position));
        }
        queryClient.invalidateQueries({ queryKey: ["game", game.code] });
      } catch (err: any) {
        console.error("UPDATE_GAME_PLAYER_POSITION error:", err);
        if (isMountedRef.current) {
          setPlayers(prevPlayers);
          const msg = err?.response?.data?.message || "Failed to update position. Retrying...";
          setError(msg);
          toast.error(msg);
          forceRefetch();
        }
      }
    },
    [players, safeSetPlayers, game.id, fetchUpdatedGame, queryClient, game.code, forceRefetch]
  );

  /* ---------- END_TURN ---------- */
  const END_TURN = useCallback(
    async (id?: number) => {
      if (!id || game.next_player_id !== id) return;
      if (!lockAction("END")) return;

      setRollAgain(false);
      setRoll(null);
      setError(null);

      const prevPlayers = players;
      try {
        if (prevPlayers.length > 0) {
          const currentIndex = prevPlayers.findIndex((p) => p.user_id === id);
          const nextIndex =
            currentIndex >= 0 ? (currentIndex + 1) % prevPlayers.length : 0;
          const nextPlayer = prevPlayers[nextIndex];
          safeSetPlayers(() =>
            prevPlayers.map((p) =>
              p.user_id === nextPlayer.user_id
                ? { ...p, isNext: true }
                : { ...p, isNext: false }
            )
          );
        }

        const resp = await apiClient.post("/game-players/end-turn", {
          user_id: id,
          game_id: game.id,
        });

        if (!resp) throw new Error("Server rejected turn change.");

        const updatedGame = await fetchUpdatedGame();
        if (updatedGame?.players && isMountedRef.current) {
          setPlayers(updatedGame.players);
        }
        queryClient.invalidateQueries({ queryKey: ["game", game.code] });
      } catch (err: any) {
        console.error("END_TURN error:", err);
        if (isMountedRef.current) {
          setPlayers(prevPlayers);
          const msg = err?.response?.data?.message || "Failed to end turn. Re-syncing...";
          setError(msg);
          toast.error(msg);
          forceRefetch();
        }
      } finally {
        unlockAction();
      }
    },
    [
      players,
      game.next_player_id,
      game.id,
      fetchUpdatedGame,
      queryClient,
      game.code,
      safeSetPlayers,
      forceRefetch,
      lockAction,
      unlockAction,
    ]
  );

  /* ---------- ROLL_DICE ---------- */
  const ROLL_DICE = useCallback(() => {
    if (isRolling || actionLock || !lockAction("ROLL")) return;
    setError(null);
    setRollAgain(false);
    setIsRolling(true);

    setTimeout(async () => {
      const value = getDiceValues();
      if (!isMountedRef.current) return unlockAction();

      if (!value) {
        setRollAgain(true);
        setRoll(null);
        setIsRolling(false);
        unlockAction();
        return;
      }

      setRoll(value);
      const currentPos = me?.position ?? 0;
      let newPosition = (currentPos + value.total) % BOARD_SQUARES;
      if (newPosition < 0) newPosition += BOARD_SQUARES;

      safeSetPlayers((prevPlayers) => {
        const idx = prevPlayers.findIndex((p) => p.user_id === me?.user_id);
        if (idx === -1) return prevPlayers;
        const next = [...prevPlayers];
        next[idx] = { ...next[idx], position: newPosition };
        return next;
      });

      try {
        await UPDATE_GAME_PLAYER_POSITION(me?.user_id, newPosition, value.total);
      } catch {
        const msg = "Server rejected dice roll. Re-syncing...";
        setError(msg);
        toast.error(msg);
        forceRefetch();
      } finally {
        if (isMountedRef.current) setIsRolling(false);
        unlockAction();
      }
    }, ROLL_ANIMATION_MS);
  }, [
    isRolling,
    actionLock,
    me?.position,
    me?.user_id,
    safeSetPlayers,
    UPDATE_GAME_PLAYER_POSITION,
    lockAction,
    unlockAction,
    forceRefetch,
  ]);

  /* ---------- Helpers ---------- */
  const getGridPosition = useCallback(
    (square: Property) => ({
      gridRowStart: square.grid_row,
      gridColumnStart: square.grid_col,
    }) as React.CSSProperties,
    []
  );
  const isTopHalf = useCallback((square: Property) => square.grid_row === 1, []);

  const playersByPosition = useMemo(() => {
    const map = new Map<number, Player[]>();
    players.forEach((p) => {
      const pos = Number(p.position ?? 0);
      if (!map.has(pos)) map.set(pos, []);
      map.get(pos)!.push(p);
    });
    return map;
  }, [players]);

  /* ---------- Render ---------- */
  return (
    <ErrorBoundary>
      <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white p-4 flex flex-col lg:flex-row gap-4 items-start justify-center relative">
        <div className="flex justify-center items-start w-full lg:w-2/3 max-w-[900px] mt-[-1rem]">
          <div className="w-full bg-[#010F10] aspect-square rounded-lg relative shadow-2xl shadow-cyan-500/10">
            <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[2px] box-border">
              <div className="col-start-2 col-span-9 row-start-2 row-span-9 flex flex-col justify-center items-center p-4 relative">
                <h1 className="text-3xl lg:text-5xl font-bold text-[#F0F7F7] font-orbitron text-center mb-4">
                  Blockopoly
                </h1>

                {game.next_player_id === me?.user_id && (
                  <div className="flex flex-col gap-2">
                    {!roll ? (
                      <button
                        type="button"
                        onClick={ROLL_DICE}
                        disabled={isRolling || actionLock === "END"}
                        className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm rounded-full hover:scale-105 transition-all disabled:opacity-60"
                      >
                        {isRolling ? "Rolling..." : "Roll Dice"}
                      </button>
                    ) : (
                      <div>
                        <p>
                          Prop ID: {propertyId} , Action: {rollAction}
                        </p>
                        <button
                          type="button"
                          onClick={() => END_TURN(me?.user_id)}
                          disabled={actionLock === "ROLL"}
                          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white text-sm rounded-full hover:scale-105 transition-all disabled:opacity-60"
                        >
                          End Turn
                        </button>
                      </div>
                    )}

                    {rollAgain && (
                      <p className="text-xs text-red-600">
                        You rolled a double 6 — please roll again
                      </p>
                    )}
                    {roll && !rollAgain && (
                      <p className="text-gray-300 text-sm">
                        🎲 Rolled:{" "}
                        <span className="font-bold text-white">
                          {roll.die1} + {roll.die2} = {roll.total}
                        </span>
                      </p>
                    )}
                    {error && (
                      <p className="text-red-400 text-sm text-center mt-1">
                        ⚠️ {error}
                      </p>
                    )}
                  </div>
                )}

                {/* board and players */}
              </div>

              {boardData.map((square, index) => {
                const playersHere = playersByPosition.get(index) ?? [];
                return (
                  <div
                    key={square.id}
                    style={getGridPosition(square)}
                    className="w-full h-full p-[2px] relative box-border group"
                  >
                    {square.type === "property" && (
                      <PropertyCard
                        square={square}
                        owner={
                          my_properties.find((p) => p.id === square.id)
                            ? me?.username ?? null
                            : null
                        }
                      />
                    )}
                    {square.type === "special" && <SpecialCard square={square} />}
                    {square.type === "corner" && <CornerCard square={square} />}
                    <div className="absolute bottom-1 left-1 flex flex-wrap gap-1 z-10">
                      {playersHere.map((p) => (
                        <button
                          key={String(p.user_id)}
                          className={`text-lg md:text-2xl ${p.user_id === game.next_player_id
                            ? "border-2 border-cyan-300 rounded"
                            : ""
                            }`}
                        >
                          {getPlayerSymbol(p.symbol)}
                        </button>
                      ))}
                    </div>
                  </div>
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
