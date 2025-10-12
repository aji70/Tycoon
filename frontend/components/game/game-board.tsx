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
   TYPES & INTERFACES
   ============================================ */

/**
 * Props passed to the GameBoard component
 */
interface GameProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  my_properties: Property[];
  me: Player | null;
  loading?: boolean;
}

/**
 * State for error boundary
 */
interface ErrorBoundaryState {
  hasError: boolean;
}

/* ============================================
   ERROR BOUNDARY - Catch rendering errors
   ============================================ */

/**
 * ErrorBoundary catches JavaScript errors anywhere in the child component tree.
 * Displays a fallback UI instead of crashing the entire app.
 */
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

/* ============================================
   CONSTANTS
   ============================================ */

/** Total number of squares on the Monopoly board */
const BOARD_SQUARES = 40;

/** Duration of dice roll animation in milliseconds */
const ROLL_ANIMATION_MS = 1200;

/* ============================================
   DICE HELPER - Generate random dice rolls
   ============================================ */

/**
 * Simulates rolling two dice.
 * Returns null if both dice show 6 (doubles), indicating player should roll again.
 * Otherwise returns the individual die values and their sum.
 */
const getDiceValues = (): { die1: number; die2: number; total: number } | null => {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const total = die1 + die2;

  // Return null for doubles (6+6) to trigger "roll again"
  if (total === 12) return null;

  return { die1, die2, total };
};

/* ============================================
   GAMEBOARD COMPONENT - Main game UI
   ============================================ */

const GameBoard = ({
  game,
  properties,
  my_properties,
  me,
  loading = false,
}: GameProps) => {
  // ============ Hooks & Refs ============

  const { address } = useAccount();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Track if component is still mounted to prevent state updates on unmounted component
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ============ State Management ============

  // Game state
  const [players, setPlayers] = useState<Player[]>(game?.players ?? []);
  const [boardData, setBoardData] = useState<Property[]>(properties ?? []);
  const [error, setError] = useState<string | null>(null);

  // Dice rolling state
  const [isRolling, setIsRolling] = useState(false);
  const [rollAgain, setRollAgain] = useState(false);
  const [roll, setRoll] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [canRoll, setCanRoll] = useState<boolean>(false);

  // Card/property action state after landing on a square
  const [rollAction, setRollAction] = useState<CardTypes | null>(null);
  const [propertyId, setPropertyId] = useState<number | null>(null);

  // Action lock prevents simultaneous roll/end-turn requests
  const [actionLock, setActionLock] = useState<"ROLL" | "END" | null>(null);

  // ============ Action Lock System ============
  // Prevents multiple simultaneous API calls

  /**
   * Locks an action (ROLL or END_TURN) to prevent duplicate requests.
   * Returns true if lock was successful, false if already locked.
   */
  const lockAction = useCallback(
    (type: "ROLL" | "END") => {
      if (actionLock) return false;
      setActionLock(type);
      return true;
    },
    [actionLock]
  );

  /** Unlocks the current action, allowing new actions to proceed */
  const unlockAction = useCallback(() => setActionLock(null), []);

  // ============ API & Data Utilities ============

  /**
   * Invalidates the game query cache to trigger a refetch.
   * Used when data needs to be synced from server.
   */
  const forceRefetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["game", game.code] });
  }, [queryClient, game.code]);

  /**
   * Safe wrapper for setPlayers that checks if component is still mounted.
   * Prevents "Can't perform a React state update on an unmounted component" warning.
   */
  const safeSetPlayers = useCallback(
    (updater: (prev: Player[]) => Player[]) => {
      if (!isMountedRef.current) return;
      setPlayers((prev) => updater(prev));
    },
    []
  );

  /**
   * Fetches the latest game state from server and updates local player state.
   */
  const fetchUpdatedGame = useCallback(async () => {
    const resp = await apiClient.get<Record<string, Game>>(`/games/code/${game.code}`);
    const gameData = resp.data;
    if (gameData && gameData.players) {
      setPlayers(gameData.players);
    }
    return gameData;
  }, [game.code]);

  // ============ Turn Management ============

  /**
   * Checks if it's the current player's turn to roll.
   * Polls the server every 8 seconds to stay in sync.
   * Shows a toast notification when it's the player's turn.
   */
  const checkCanRoll = useCallback(async () => {
    if (!me?.user_id) return;

    try {
      const res = await apiClient.post<ApiResponse<{ canRoll: boolean }>>("/game-players/can-roll", {
        user_id: me.user_id,
        game_id: game.id,
      });

      // Extract canRoll from different possible response structures
      const allowed = (res?.data as any)?.data?.canRoll ?? false;

      setCanRoll(Boolean(allowed));

      // Notify player when it's their turn
      if (allowed) toast.success("🎲 It's your turn — roll the dice!");
    } catch (err) {
      console.error("checkCanRoll error:", err);
      setCanRoll(false);
    }
  }, [me?.user_id, game.id]);

  /**
   * Set up turn checking on mount and poll every 8 seconds.
   * Clean up interval on unmount.
   */
  useEffect(() => {
    checkCanRoll();
    const interval = setInterval(() => checkCanRoll(), 8000);
    return () => clearInterval(interval);
  }, [checkCanRoll]);

  // ============ Turn Actions ============

  /**
   * Ends the current player's turn.
   * - Validates user permission
   * - Sends end-turn request to server
   * - Updates game state with new player data
   * - Resets dice display for next player
   */
  const END_TURN = useCallback(
    async (id?: number) => {
      if (!id) return;
      if (!lockAction("END")) return; // Exit if already locked

      try {
        // Send end-turn request to server
        const resp = await apiClient.post<ApiResponse>("/game-players/end-turn", {
          user_id: id,
          game_id: game.id,
        });

        // Check if server accepted the turn end
        if (!resp?.data?.success) {
          throw new Error(resp?.data?.message || "Server rejected turn end.");
        }

        // Fetch updated game state with new player order
        const updatedGame = await fetchUpdatedGame();
        if (updatedGame?.players && isMountedRef.current) {
          setPlayers(updatedGame.players);
          toast.success("✅ Turn ended. Waiting for next player...");
          setCanRoll(false); // Current player can no longer roll
          setRoll(null); // Clear dice display for next player
        }

        // Invalidate query cache to sync UI
        queryClient.invalidateQueries({ queryKey: ["game", game.code] });
      } catch (err: any) {
        console.error("END_TURN error:", err);
        toast.error(err?.response?.data?.message || "Failed to end turn.");
        forceRefetch(); // Sync with server on error
      } finally {
        unlockAction(); // Release lock regardless of success/failure
      }
    },
    [game.id, fetchUpdatedGame, queryClient, game.code, lockAction, unlockAction, forceRefetch]
  );

  // ============ Dice Rolling ============

  /**
   * Handles the dice roll sequence:
   * 1. Validates it's the player's turn
   * 2. Animates the dice roll
   * 3. Calculates new position on board (wraps around at 40 squares)
   * 4. Updates position on server
   * 5. Fetches updated game state
   * 6. Triggers property/card action based on landed square
   */
  const ROLL_DICE = useCallback(async () => {
    if (!canRoll) return;
    // Guard against simultaneous rolls or action lock
    if (isRolling || actionLock || !lockAction("ROLL")) return;

    setError(null);
    setRollAgain(false);
    setIsRolling(true);

    try {
      // Verify it's actually this player's turn (double-check)
      const res = await apiClient.post<ApiResponse<{ canRoll: boolean }>>("/game-players/can-roll", {
        user_id: me?.user_id,
        game_id: game.id,
      });
      const allowed: boolean = (res?.data as any)?.data?.canRoll;

      if (!allowed) {
        toast.error("⏳ Not your turn! Wait for your turn to roll.");
        setIsRolling(false);
        unlockAction();
        return;
      }

      // Wait for animation duration before processing roll
      setTimeout(async () => {
        // Get random dice values (null if doubles)
        const value = getDiceValues();
        if (!value) {
          // Doubles - player rolls again
          setRollAgain(true);
          setIsRolling(false);
          unlockAction();
          return;
        }

        setRoll(value); // Display the dice values

        // Calculate new position: (current + rolled) mod 40
        const currentPos = me?.position ?? 0;
        const newPosition = (currentPos + value.total) % BOARD_SQUARES;

        // Optimistically update local player position
        safeSetPlayers((prev) =>
          prev.map((p) =>
            p.user_id === me?.user_id ? { ...p, position: newPosition } : p
          )
        );

        try {
          // Persist the position change to server
          const updateResp = await apiClient.post<ApiResponse>(
            "/game-players/change-position",
            {
              position: newPosition,
              user_id: me?.user_id,
              game_id: game.id,
              rolled: value.total,
            }
          );

          if (!updateResp?.data?.success) {
            console.log(updateResp)
            toast.error("Unable to move from current position");
          }

          // Fetch latest game state to get property/card actions
          const updatedGame = await fetchUpdatedGame();
          if (updatedGame?.players && isMountedRef.current) {
            setPlayers(updatedGame.players);
            setPropertyId(newPosition); // Mark the property they landed on
            setRollAction(PROPERTY_ACTION(newPosition)); // Determine card/property action
          }
          setCanRoll(false); // Turn ends after roll (unless doubles)
        } catch (err: any) {
          console.error("Persist move error:", err);
          toast.error("Position update failed, syncing...");
          forceRefetch(); // Sync with server on error
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
    safeSetPlayers,
    fetchUpdatedGame,
    forceRefetch,
    game.id,
  ]);

  // ============ Helper Computations ============

  /**
   * Groups players by their current board position.
   * Used to display multiple player tokens on the same square.
   */
  const playersByPosition = useMemo(() => {
    const map = new Map<number, Player[]>();
    players.forEach((p) => {
      const pos = Number(p.position ?? 0);
      if (!map.has(pos)) map.set(pos, []);
      map.get(pos)!.push(p);
    });
    return map;
  }, [players]);

  /** Check if it's the current player's turn */
  const isMyTurn = me?.user_id && game?.next_player_id === me.user_id;

  // ============ Render ============

  return (
    <ErrorBoundary>
      <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white p-4 flex flex-col lg:flex-row gap-4 items-start justify-center relative">
        {/* Main board container */}
        <div className="flex justify-center items-start w-full lg:w-2/3 max-w-[900px] mt-[-1rem]">
          <div className="w-full bg-[#010F10] aspect-square rounded-lg relative shadow-2xl shadow-cyan-500/10">
            {/* 11x11 grid: outer border (squares) + inner 9x9 area (center) */}
            <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[2px] box-border">
              {/* Center area - Title & Controls */}
              <div className="col-start-2 col-span-9 row-start-2 row-span-9 flex flex-col justify-center items-center p-4 relative">
                <h1 className="text-3xl lg:text-5xl font-bold text-[#F0F7F7] font-orbitron text-center mb-4">
                  Blockopoly
                </h1>

                {/* Show controls only if it's player's turn */}
                {isMyTurn && (
                  <div className="flex flex-col gap-2">
                    {/* Show Roll Dice button until player rolls, then show End Turn */}
                    {canRoll ? (
                      <button
                        type="button"
                        onClick={ROLL_DICE}
                        disabled={isRolling}
                        className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm rounded-full hover:scale-105 transition-all disabled:opacity-60"
                      >
                        {isRolling ? "Rolling..." : "Roll Dice"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => END_TURN(me?.user_id)}
                        disabled={actionLock === "ROLL"}
                        className="px-4 py-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white text-sm rounded-full hover:scale-105 transition-all disabled:opacity-60"
                      >
                        End Turn
                      </button>
                    )}

                    {/* Show if player rolled doubles and can roll again */}
                    {rollAgain && (
                      <p className="text-xs text-red-500">
                        🎯 You rolled a double! Roll again!
                      </p>
                    )}

                    {/* Display the current roll result */}
                    {roll && (
                      <p className="text-gray-300 text-sm">
                        🎲 Rolled:{" "}
                        <span className="font-bold text-white">
                          {roll.die1} + {roll.die2} = {roll.total}
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Board squares - Render each property/card on the board */}
              {boardData.map((square, index) => {
                // Get all players currently on this square
                const playersHere = playersByPosition.get(index) ?? [];

                return (
                  <div
                    key={square.id}
                    style={{
                      gridRowStart: square.grid_row,
                      gridColumnStart: square.grid_col,
                    }}
                    className="w-full h-full p-[2px] relative box-border"
                  >
                    {/* Render different card types based on square type */}
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

                    {/* Display player tokens on this square */}
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