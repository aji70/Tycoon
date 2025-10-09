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
  History,
} from "@/types/game";
import { useAccount } from "wagmi";
import { getPlayerSymbol } from "@/lib/types/symbol";
import { apiClient } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

/* ---------- Types ---------- */
interface GameProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  my_properties: Property[];
  me: Player | null;
  loading?: boolean;
}

/* ---------- ErrorBoundary ---------- */
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError)
      return <div className="text-red-400 text-center">Something went wrong. Please refresh.</div>;
    return this.props.children;
  }
}

/* ---------- Constants ---------- */
const BOARD_SQUARES = 40;
const ROLL_ANIMATION_MS = 1200;

/* ---------- Dice Helper ---------- */
const getDiceValues = () => {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const total = die1 + die2;
  if (total === 12) return null; // special handling (double 6)
  return { die1, die2, total };
};

/* ---------- Component ---------- */
const GameBoard = ({
  game,
  properties,
  game_properties,
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

  /* ---------- State ---------- */
  const [players, setPlayers] = useState<Player[]>(game?.players ?? []);
  const [boardData, setBoardData] = useState<Property[]>(properties ?? []);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [rollAgain, setRollAgain] = useState(false);
  const [rollAction, setRollAction] = useState<CardTypes | null>(null);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [roll, setRoll] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ---------- Sync props ---------- */
  useEffect(() => {
    if (!isMountedRef.current) return;
    setPlayers(game?.players ?? []);
  }, [game?.players]);

  useEffect(() => {
    if (!isMountedRef.current) return;
    setBoardData(properties ?? []);
  }, [properties]);

  /* ---------- Derived: Can Current Player Roll? ---------- */
  const canRollDice = useMemo(() => {
    if (!me || game.next_player_id !== me.user_id) return false;
    const myRolls = me.rolls ?? 0;
    const allRollCounts = players.map((p) => p.rolls ?? 0);
    const maxRolls = Math.max(...allRollCounts);
    return myRolls <= maxRolls;
  }, [me, game.next_player_id, players]);

  /* ---------- History ---------- */
  const lastRoll = useMemo<History | null>(() => {
    if (Array.isArray(game.history) && game.history.length > 0) {
      return game.history[0];
    }
    return null;
  }, [game.history]);

  const recentRolls = useMemo<History[]>(() => {
    if (!Array.isArray(game.history)) return [];
    return game.history.slice(0, 5);
  }, [game.history]);

  /* ---------- Utility ---------- */
  const forceRefetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["game", game.code] });
  }, [queryClient, game.code]);

  const fetchUpdatedGame = useCallback(async () => {
    const resp = await apiClient.get<Game>(`/games/code/${game.code}`);
    return resp;
  }, [game.code]);

  const safeSetPlayers = useCallback((fn: (p: Player[]) => Player[]) => {
    if (!isMountedRef.current) return;
    setPlayers((prev) => fn(prev));
  }, []);

  /* ---------- Update Player Position ---------- */
  const UPDATE_GAME_PLAYER_POSITION = useCallback(
    async (id: number | undefined | null, position: number, rolled: number) => {
      if (!id || isProcessing) return;
      setIsProcessing(true);
      setError(null);

      const prevPlayers = players;
      safeSetPlayers((prev) =>
        prev.map((p) => (p.user_id === id ? { ...p, position } : p))
      );

      try {
        await apiClient.post("/game-players/change-position", {
          position,
          user_id: id,
          game_id: game.id,
          rolled,
        });

        const updatedGame = await fetchUpdatedGame();
        if (updatedGame?.players && isMountedRef.current) {
          setPlayers(updatedGame.players);
          setPropertyId(position);
          setRollAction(PROPERTY_ACTION(position));
        }
        queryClient.invalidateQueries({ queryKey: ["game", game.code] });
      } catch (err) {
        console.error("UPDATE_GAME_PLAYER_POSITION error:", err);
        setPlayers(prevPlayers);
        forceRefetch();
      } finally {
        if (isMountedRef.current) setIsProcessing(false);
      }
    },
    [players, safeSetPlayers, game.id, fetchUpdatedGame, queryClient, game.code, forceRefetch, isProcessing]
  );

  /* ---------- End Turn ---------- */
  const END_TURN = useCallback(
    async (id?: number) => {
      setRollAgain(false);
      setRoll(null);
      if (!id || game.next_player_id !== id || isProcessing) return;
      setIsProcessing(true);

      const prevPlayers = players;

      try {
        await apiClient.post("/game-players/end-turn", { user_id: id, game_id: game.id });
        const updatedGame = await fetchUpdatedGame();
        if (updatedGame?.players && isMountedRef.current) {
          setPlayers(updatedGame.players);
        }
        queryClient.invalidateQueries({ queryKey: ["game", game.code] });
      } catch (err) {
        console.error("END_TURN error:", err);
        setPlayers(prevPlayers);
        forceRefetch();
      } finally {
        if (isMountedRef.current) setIsProcessing(false);
      }
    },
    [players, game.next_player_id, game.id, fetchUpdatedGame, queryClient, game.code, safeSetPlayers, forceRefetch, isProcessing]
  );

  /* ---------- Roll Dice ---------- */
  const ROLL_DICE = useCallback(() => {
    if (isRolling || isProcessing) return;
    setIsRolling(true);
    setError(null);
    setRollAgain(false);

    setTimeout(async () => {
      const value = getDiceValues();
      if (!isMountedRef.current) return setIsRolling(false);

      if (!value) {
        setRollAgain(true);
        setRoll(null);
        setIsRolling(false);
        return;
      }

      setRoll(value);
      const currentPos = me?.position ?? 0;
      const newPos = (currentPos + value.total) % BOARD_SQUARES;

      safeSetPlayers((prev) =>
        prev.map((p) => (p.user_id === me?.user_id ? { ...p, position: newPos } : p))
      );

      await UPDATE_GAME_PLAYER_POSITION(me?.user_id, newPos, value.total);
      if (isMountedRef.current) setIsRolling(false);
    }, ROLL_ANIMATION_MS);
  }, [isRolling, isProcessing, me?.position, me?.user_id, safeSetPlayers, UPDATE_GAME_PLAYER_POSITION]);

  /* ---------- Render ---------- */
  const playersByPosition = useMemo(() => {
    const map = new Map<number, Player[]>();
    players.forEach((p) => {
      const pos = Number(p.position ?? 0);
      if (!map.has(pos)) map.set(pos, []);
      map.get(pos)!.push(p);
    });
    return map;
  }, [players]);

  return (
    <ErrorBoundary>
      <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white p-4 flex flex-col lg:flex-row gap-6 items-start justify-center relative">
        <div className="flex flex-col justify-start items-center w-full lg:w-2/3 max-w-[900px] space-y-6">
          {/* ---------- Game Board ---------- */}
          <div className="w-full bg-[#010F10] aspect-square rounded-lg relative shadow-2xl shadow-cyan-500/10">
            <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[2px]">
              <div className="col-start-2 col-span-9 row-start-2 row-span-9 bg-[#010F10] flex flex-col justify-center items-center p-4 relative">
                <h1 className="text-3xl lg:text-5xl font-bold text-[#F0F7F7] font-orbitron text-center mb-2">
                  Blockopoly
                </h1>

                {/* 🕹️ Last Roll Summary */}
                {lastRoll && (
                  <p className="text-xs text-gray-400 mb-3">
                    Last roll:{" "}
                    <span className="text-cyan-400 font-semibold">{lastRoll.player_name}</span>{" "}
                    rolled <span className="text-white font-bold">{lastRoll.rolled}</span> → moved to{" "}
                    {lastRoll.new_position}
                  </p>
                )}

                {/* 🎲 Roll Dice / End Turn Logic */}
                {canRollDice && (
                  <div className="flex flex-col gap-2 items-center">
                    {!roll ? (
                      <button
                        onClick={ROLL_DICE}
                        disabled={isRolling || isProcessing}
                        className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm rounded-full hover:from-cyan-600 hover:to-blue-600 transform hover:scale-105 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isRolling ? "Rolling..." : "Roll Dice"}
                      </button>
                    ) : (
                      <div className="text-center">
                        <p className="text-sm mb-2">
                          Prop ID: {propertyId}, Action: {rollAction}
                        </p>
                        <button
                          onClick={() => END_TURN(me?.user_id)}
                          disabled={isProcessing}
                          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white text-sm rounded-full hover:from-amber-600 hover:to-rose-600 transform hover:scale-105 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          End Turn
                        </button>
                      </div>
                    )}
                    {rollAgain && (
                      <p className="text-xs text-red-500">You rolled a double 6 — roll again!</p>
                    )}
                    {roll && !rollAgain && (
                      <p className="text-gray-300 text-sm">
                        Rolled:{" "}
                        <span className="font-bold text-white">
                          {roll.die1} + {roll.die2} = {roll.total}
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ---------- Render Properties ---------- */}
              {boardData.map((square, index) => {
                const playersHere = playersByPosition.get(index) ?? [];
                return (
                  <div
                    key={square.id}
                    style={{
                      gridRowStart: square.grid_row,
                      gridColumnStart: square.grid_col,
                    }}
                    className="w-full h-full p-[2px] relative"
                  >
                    {square.type === "property" && (
                      <PropertyCard
                        square={square}
                        owner={my_properties.find((p) => p.id === square.id) ? me?.username ?? null : null}
                      />
                    )}
                    {square.type === "special" && <SpecialCard square={square} />}
                    {square.type === "corner" && <CornerCard square={square} />}

                    <div className="absolute bottom-1 left-1 flex flex-wrap gap-1 z-10">
                      {playersHere.map((p) => (
                        <button
                          key={p.user_id}
                          className={`text-lg md:text-2xl ${p.user_id === game.next_player_id ? "border-2 border-cyan-300 rounded" : ""
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

          {/* ---------- Roll Summary Log ---------- */}
          <div className="w-full bg-[#01181B] border border-cyan-800/30 rounded-lg p-3 text-sm shadow-lg shadow-cyan-900/10 max-h-56 overflow-y-auto">
            <h3 className="text-cyan-400 font-semibold mb-2 text-center uppercase tracking-wider">
              Recent Rolls
            </h3>
            {recentRolls.length === 0 ? (
              <p className="text-gray-400 text-center">No rolls yet...</p>
            ) : (
              <ul className="space-y-1">
                {recentRolls.map((h, idx) => (
                  <li
                    key={idx}
                    className="flex justify-between items-center bg-[#021F23] px-3 py-1.5 rounded border border-cyan-900/20"
                  >
                    <span className="text-cyan-300 font-semibold">{h.player_name}</span>
                    <span className="text-gray-400">rolled</span>
                    <span className="text-white font-bold">{h.rolled}</span>
                    <span className="text-gray-400">→ pos {h.new_position}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default GameBoard;
