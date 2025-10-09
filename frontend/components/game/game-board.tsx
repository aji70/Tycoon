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
import { Game, GameProperty, Property, Player, PROPERTY_ACTION, CardTypes } from "@/types/game";
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

interface ErrorBoundaryState {
  hasError: boolean;
}

/* ---------- ErrorBoundary (unchanged behavior but typed) ---------- */
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
const BOARD_SQUARES = 40; // keep a single source for wrap-around
const ROLL_ANIMATION_MS = 1200;

/* ---------- Helpers ---------- */
const getDiceValues = (): { die1: number; die2: number; total: number } | null => {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const total = die1 + die2;
  // original code treated double 6 specially and returned null
  if (total === 12) return null;
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

  // Mounted ref -> prevents setting state after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Local state (keep in sync with incoming props)
  const [players, setPlayers] = useState<Player[]>(() => game?.players ?? []);
  const [boardData, setBoardData] = useState<Property[]>(() => properties ?? []);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false); // prevents double submits
  const [isRolling, setIsRolling] = useState(false);
  const [rollAgain, setRollAgain] = useState(false);
  const [rollAction, setRollAction] = useState<CardTypes | null>(null);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [roll, setRoll] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [selectedCardType, setSelectedCardType] = useState<"Chance" | "CommunityChest" | null>(null);
  const [chatMessages, setChatMessages] = useState<{ sender: string; message: string }[]>([{ sender: "Player1", message: "hi" }]);
  const [chatInput, setChatInput] = useState("");

  // sync props -> local state when game/props update (avoid stale props)
  useEffect(() => {
    if (!isMountedRef.current) return;
    setPlayers(game?.players ?? []);
  }, [game?.players]);

  useEffect(() => {
    if (!isMountedRef.current) return;
    setBoardData(properties ?? []);
  }, [properties]);

  /* ---------- Utilities ---------- */
  const forceRefetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["game", game.code] });
  }, [queryClient, game.code]);

  const safeSetPlayers = useCallback((updater: (prev: Player[]) => Player[]) => {
    if (!isMountedRef.current) return;
    setPlayers((prev) => updater(prev));
  }, []);

  /* ---------- API helpers with AbortController ---------- */
  const fetchUpdatedGame = useCallback(async () => {
    const resp = await apiClient.get<Game>(`/games/code/${game.code}`);
    return resp;
  }, [game.code]);

  /* ---------- UPDATE GAME PLAYER POSITION (optimistic + rollback + refetch) ---------- */
  const UPDATE_GAME_PLAYER_POSITION = useCallback(
    async (id: number | undefined | null, position: number) => {
      if (!id) return;
      if (isProcessing) return;
      setError(null);
      setIsProcessing(true);

      // optimistic update
      const prevPlayers = players;
      safeSetPlayers((prevPlayers) => prevPlayers.map((p) => (p.user_id === id ? { ...p, position } : p)));

      try {
        await apiClient.post("/game-players/change-position", {
          position,
          user_id: id,
          game_id: game.id,
        });

        // fetch authoritative game state
        const updatedGame = await fetchUpdatedGame();

        if (updatedGame?.players && isMountedRef.current) {
          setPlayers(updatedGame.players);
          setPropertyId(position)
          const property_action = PROPERTY_ACTION(position)
          setRollAction(property_action);
        }

        // keep react-query cache consistent
        queryClient.invalidateQueries({ queryKey: ["game", game.code] });
      } catch (err) {
        console.error("UPDATE_GAME_PLAYER_POSITION error:", err);
        // rollback optimistic update if request failed
        if (isMountedRef.current) {
          setPlayers(prevPlayers);
          // setError("Failed to update player position. Try again.");
          forceRefetch();
        }
      } finally {
        if (isMountedRef.current) setIsProcessing(false);
      }
    },
    [players, safeSetPlayers, game.id, fetchUpdatedGame, queryClient, game.code, forceRefetch, isProcessing]
  );

  /* ---------- END_TURN (optimistic + safe) ---------- */
  const END_TURN = useCallback(
    async (id?: number) => {
      setRollAgain(false);
      setRoll(null);
      if (!id || game.next_player_id !== id) return;
      if (isProcessing) return;
      setIsProcessing(true);
      setError(null);

      // optimistic: compute next player index locally (if players exist)
      const prevPlayers = players;
      let optimisticPlayers = prevPlayers;
      if (prevPlayers.length > 0) {
        const currentIndex = prevPlayers.findIndex((p) => p.user_id === id);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % prevPlayers.length : 0;
        const nextPlayer = prevPlayers[nextIndex];
        optimisticPlayers = prevPlayers.map((p) =>
          p.user_id === nextPlayer.user_id ? { ...p, isNext: true } : { ...p, isNext: false }
        );
        safeSetPlayers(() => optimisticPlayers);
      }

      try {
        await apiClient.post(
          "/game-players/end-turn",
          {
            user_id: id,
            game_id: game.id,
          });

        const updatedGame = await fetchUpdatedGame();
        if (updatedGame?.players && isMountedRef.current) {
          setPlayers(updatedGame.players);
        }

        queryClient.invalidateQueries({ queryKey: ["game", game.code] });
      } catch (err) {
        console.error("END_TURN error:", err);
        if (isMountedRef.current) {
          setPlayers(prevPlayers); // rollback
          // setError("Failed to end turn. Try again.");
          forceRefetch();
        }
      } finally {
        if (isMountedRef.current) setIsProcessing(false);
      }
    },
    [players, game.next_player_id, game.id, fetchUpdatedGame, queryClient, game.code, safeSetPlayers, forceRefetch, isProcessing]
  );

  /* ---------- ROLL_DICE (keeps animation delay configurable) ---------- */
  const ROLL_DICE = useCallback(() => {
    if (isRolling || isProcessing) return;
    setError(null);
    setRollAgain(false);
    setIsRolling(true);

    // simulate roll animation then apply result
    setTimeout(async () => {
      const value = getDiceValues();
      if (!isMountedRef.current) return setIsRolling(false);

      if (!value) {
        // a special case in your original code
        setRollAgain(true);
        setRoll(null);
        setIsRolling(false);
        return;
      }

      // set roll result for immediate UI
      setRoll(value);

      // compute wrapped position
      const currentPos = me?.position ?? 0;
      let newPosition = (currentPos + value.total) % BOARD_SQUARES;
      if (newPosition < 0) newPosition += BOARD_SQUARES;

      // update local players optimistically
      safeSetPlayers((prevPlayers) => {
        const idx = prevPlayers.findIndex((p) => p.user_id === me?.user_id);
        if (idx === -1) return prevPlayers;
        const next = [...prevPlayers];
        next[idx] = { ...next[idx], position: newPosition };
        return next;
      });

      // persist to backend (no await here so UI is snappy)
      await UPDATE_GAME_PLAYER_POSITION(me?.user_id, newPosition);

      if (isMountedRef.current) setIsRolling(false);

    }, ROLL_ANIMATION_MS);
  }, [isRolling, isProcessing, me?.position, me?.user_id, safeSetPlayers, UPDATE_GAME_PLAYER_POSITION]);

  /* ---------- small helpers used in render ---------- */
  const getGridPosition = useCallback((square: Property) => {
    return {
      gridRowStart: square.grid_row,
      gridColumnStart: square.grid_col,
    } as React.CSSProperties;
  }, []);

  const isTopHalf = useCallback((square: Property) => square.grid_row === 1, []);

  /* ---------- memoized players-by-position map to avoid repeated filtering ---------- */
  const playersByPosition = useMemo(() => {
    const map = new Map<number, Player[]>();
    players.forEach((p) => {
      const pos = Number(p.position ?? 0);
      if (!map.has(pos)) map.set(pos, []);
      map.get(pos)!.push(p);
    });
    return map;
  }, [players]);

  /* ---------- render ---------- */
  return (
    <ErrorBoundary>
      <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white p-4 flex flex-col lg:flex-row gap-4 items-start justify-center relative">
        {/* Rotate Prompt for Mobile Portrait */}
        <div className="rotate-prompt hidden fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 text-center text-white p-4">
          <p className="text-lg font-semibold">
            Please rotate your device to landscape mode for the best experience.
          </p>
        </div>

        {/* Board Section */}
        <div className="flex justify-center items-start w-full lg:w-2/3 max-w-[900px] mt-[-1rem]">
          <div className="w-full bg-[#010F10] aspect-square rounded-lg relative shadow-2xl shadow-cyan-500/10">
            <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[2px] box-border">
              <div className="col-start-2 col-span-9 row-start-2 row-span-9 bg-[#010F10] flex flex-col justify-center items-center p-4 relative">
                <h1 className="text-3xl lg:text-5xl font-bold text-[#F0F7F7] font-orbitron text-center mb-4">
                  Blockopoly
                </h1>

                {game.next_player_id === me?.user_id && (
                  <div className="flex flex-col gap-2">
                    {!roll ? (
                      <button
                        type="button"
                        onClick={ROLL_DICE}
                        aria-label="Roll the dice"
                        disabled={isRolling || isProcessing}
                        className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm rounded-full hover:from-cyan-600 hover:to-blue-600 transform hover:scale-105 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
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
                          aria-label="Move to next player"
                          disabled={isProcessing}
                          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white text-sm rounded-full hover:from-amber-600 hover:to-rose-600 transform hover:scale-105 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          End Turn
                        </button>
                      </div>
                    )}

                    {rollAgain && <p className="text-xs font-normal text-red-600">You rolled a double 6 — please roll again</p>}

                    {!isRolling && roll && !rollAgain && (
                      <p className="text-gray-300 text-sm text-center">
                        Rolled: <span className="font-bold text-white">{roll.die1} + {roll.die2} = {roll.total}</span>
                      </p>
                    )}

                    {/* {error && <p className="text-red-400 text-sm mt-2 text-center">{error}</p>} */}
                  </div>
                )}

                {selectedCard && (
                  <div
                    className="mt-4 p-3 rounded-lg w-full max-w-sm bg-cover bg-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
                    style={{
                      backgroundImage: `url('https://images.unsplash.com/photo-1620283088057-7d4241262d45'), linear-gradient(to bottom, rgba(14, 40, 42, 0.8), rgba(14, 40, 42, 0.8))`,
                    }}
                  >
                    <h3 className="text-base font-semibold text-cyan-300 mb-2">
                      {selectedCardType === "CommunityChest" ? "Community Chest" : "Chance"} Card
                    </h3>
                    <p className="text-sm text-gray-300">{selectedCard}</p>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          /* process card logic stub - keep lightweight */
                          setSelectedCard(null);
                          setSelectedCardType(null);
                        }}
                        aria-label="Process the drawn card"
                        className="px-2 py-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs rounded-full hover:from-green-700 hover:to-emerald-700 transform hover:scale-105 transition-all duration-200"
                      >
                        Process
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCard(null);
                          setSelectedCardType(null);
                        }}
                        aria-label="Close card"
                        className="px-2 py-1 bg-gradient-to-r from-gray-500 to-gray-700 text-white text-xs rounded-full hover:from-gray-600 hover:to-gray-800 transform hover:scale-105 transition-all duration-200"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {boardData.map((square, index) => {
                const playersHere = playersByPosition.get(index) ?? [];
                return (
                  <div
                    key={square.id}
                    style={getGridPosition(square)}
                    className="w-full h-full p-[2px] relative box-border group hover:z-10 transition-transform duration-200"
                  >
                    <div
                      className={`w-full h-full transform group-hover:scale-200 ${isTopHalf(square) ? "origin-top group-hover:origin-bottom group-hover:translate-y-[100px]" : ""} group-hover:shadow-lg group-hover:shadow-cyan-500/50 transition-transform duration-200`}
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
                            type="button"
                            key={String(p.user_id)}
                            className={`text-lg md:text-2xl ${p.user_id === game.next_player_id ? "border-2 border-cyan-300 rounded" : ""}`}
                            aria-label={p.username ?? `Player ${p.user_id}`}
                          >
                            {getPlayerSymbol(p.symbol)}
                          </button>
                        ))}
                      </div>
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
