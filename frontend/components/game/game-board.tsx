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
import { ApiResponse } from "@/types/api";

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

  /* ---------- React Query Utilities ---------- */
  const forceRefetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["game", game.code] });
  }, [queryClient, game.code]);

  /* ---------- Fetch Updated Game ---------- */
  const fetchUpdatedGame = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Record<string, Game>>(`/games/code/${game.code}`);
      const gameData = data;
      if (gameData && Array.isArray(gameData.players)) {
        setPlayers((prev) => {
          // ✅ Avoid redundant updates if same data
          const changed = JSON.stringify(prev) !== JSON.stringify(gameData.players);
          return changed ? gameData.players : prev;
        });
      }
      return gameData;
    } catch (err) {
      console.error("fetchUpdatedGame error:", err);
      return null;
    }
  }, [game.code, setPlayers]);
  /* ---------- Turn Management ---------- */
  const checkCanRoll = useCallback(async () => {
    if (!me?.user_id) return;

    try {
      const res = await apiClient.post<ApiResponse<{ canRoll: boolean }>>(
        "/game-players/can-roll",
        { user_id: me.user_id, game_id: game.id }
      );
      const allowed = Boolean(res?.data?.canRoll);
      setCanRoll(allowed);

      if (allowed) toast.success("🎲 It's your turn — roll the dice!");
    } catch (err) {
      console.error("checkCanRoll error:", err);
      setCanRoll(false);
    }
  }, [me?.user_id, game.id, setCanRoll]);

  /* ---------- Poll every 5 seconds ---------- */
  /* ✅ Poll both canRoll and player positions */
  useEffect(() => {
    checkCanRoll();
    const poll = async () => {
      await fetchUpdatedGame();
    };
    poll(); // initial
    const interval = setInterval(poll, 5000); // 5s refresh
    return () => clearInterval(interval);
  }, [fetchUpdatedGame, checkCanRoll]);

  // Property Action

  const stableProperties = useMemo(() => properties, [properties]);

  useEffect(() => {
    if (!stableProperties.length || !me?.position || !game?.players) return;

    const property = stableProperties.find((p) => p.id === me.position);
    if (!property) return;

    const game_property =
      game_properties.length === 0
        ? null
        : game_properties.find((p) => p.property_id === property.id);

    const action = PROPERTY_ACTION(property.id);

    setCurrentProperty(property);
    setCurrentGameProperty(game_property || null);
    setCurrentAction(action);

    // ✅ Find the current player info from the game data
    const meInGame = game.players.find((p) => p.user_id === me?.user_id);
    const hasRolled = (meInGame?.rolls ?? 0) > 0;

    // ✅ Show toast & enable buy only if:
    // - it's my turn
    // - I’ve rolled at least once
    // - the roll animation finished
    // - I'm standing on a land property that’s unowned
    // - and toast not already shown for this property
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

    // Reset the buy prompt whenever I roll again or end my turn
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

      if (res?.data?.error) {
        toast.error(res.data.message || "Failed to buy property.");
        return;
      }

      toast.success(`🏠 You bought ${currentProperty.name}!`);
      await fetchUpdatedGame();
      forceRefetch();
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
        const resp = await apiClient.post<ApiResponse>("/game-players/end-turn", {
          user_id: id,
          game_id: game.id,
        });

        if (!resp?.success)
          throw new Error(resp?.message || "Server rejected turn end.");

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
      setPendingRoll(12)
    }
    setRollAgain(false);
    setIsRolling(true);

    try {
      const res = await apiClient.post<ApiResponse<{ canRoll: boolean }>>(
        "/game-players/can-roll",
        { user_id: me?.user_id, game_id: game.id }
      );

      const allowed = Boolean(res?.data?.canRoll);
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

        // Optimistic update
        // setPlayers((prev) =>
        //   prev.map((p) => (p.user_id === me?.user_id ? { ...p, position: newPosition } : p))
        // );

        try {
          const updateResp = await apiClient.post<ApiResponse>(
            "/game-players/change-position",
            {
              position: newPosition,
              user_id: me?.user_id,
              game_id: game.id,
              rolled: value.total + pendingRoll,
            }
          );

          if (!updateResp?.success) toast.error("Unable to move from current position");

          setPendingRoll(0)
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
  /* ---------- Render ---------- */
  return (
    <ErrorBoundary>
      <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white p-4 flex flex-col lg:flex-row gap-4 items-start justify-center relative">
        <div className="flex justify-center items-start w-full lg:w-2/3 max-w-[900px] mt-[-1rem]">
          <div className="w-full bg-[#010F10] aspect-square rounded-lg relative shadow-2xl shadow-cyan-500/10">
            <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[2px] box-border">
              {/* Center Area */}
              <div className="col-start-2 col-span-9 row-start-2 row-span-9 flex flex-col justify-center items-center p-4 relative">
                <h1 className="text-3xl lg:text-5xl font-bold text-[#F0F7F7] font-orbitron text-center mb-4">
                  Blockopoly
                </h1>

                {isMyTurn ? (
                  <div className="flex flex-col gap-2">
                    {(() => {
                      const myPlayer = game?.players?.find((p) => p.user_id === me?.user_id);
                      const hasRolled = (myPlayer?.rolls ?? 0) > 0;

                      if (!hasRolled) {
                        return (
                          <button
                            onClick={ROLL_DICE}
                            disabled={isRolling}
                            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm rounded-full hover:scale-105 transition-all disabled:opacity-60"
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
                                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm rounded-full hover:scale-105 transition-all disabled:opacity-60"
                              >
                                Buy {currentProperty.name} [${currentProperty.price}]
                              </button>
                            )
                          }
                          <button
                            onClick={() => END_TURN(me?.user_id)}
                            disabled={actionLock === "ROLL"}
                            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white text-sm rounded-full hover:scale-105 transition-all disabled:opacity-60"
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
                ) : (
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
                )}
              </div>

              {/* Board Squares */}
              {boardData.map((square, index) => {
                const playersHere = playersByPosition.get(index) ?? [];
                const owner =
                  my_properties.find((p) => p.id === square.id) && me?.username
                    ? me.username
                    : null;

                return (
                  <div
                    key={square.id}
                    style={{
                      gridRowStart: square.grid_row,
                      gridColumnStart: square.grid_col,
                    }}
                    className="w-full h-full p-[2px] relative box-border"
                  >
                    {square.type === "property" && <PropertyCard square={square} owner={propertyOwner(square.id)} />}
                    {square.type === "special" && <SpecialCard square={square} />}
                    {square.type === "corner" && <CornerCard square={square} />}

                    <div className="absolute bottom-1 left-1 flex flex-wrap gap-1 z-10">
                      {playersHere.map((p) => (
                        <button
                          key={p.user_id}
                          className={`text-lg md:text-2xl ${p.user_id === game.next_player_id
                            ? "border-2 border-cyan-300 rounded animate-pulse"
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
