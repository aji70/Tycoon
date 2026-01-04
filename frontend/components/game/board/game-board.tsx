"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast, Toaster } from "react-hot-toast";

import {
  Game,
  GameProperty,
  Property,
  Player,
  PROPERTY_ACTION,
} from "@/types/game";
import { apiClient } from "@/lib/api";

// Child components
import BoardSquare from "./board-square";
import CenterArea from "./center-area";
import { ApiResponse } from "@/types/api";
import { BankruptcyModal } from "../modals/bankruptcy";
import { CardModal } from "../modals/cards";
import CollectibleInventoryBar from "@/components/collectibles/collectibles-invetory";
import { Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useExitGame, useGetGameByCode } from "@/context/ContractProvider";
import { VictoryModal } from "../modals/victory";
import { PropertyActionModal } from "../modals/property-action";

const BOARD_SQUARES = 40;
const ROLL_ANIMATION_MS = 1200;
const MOVE_ANIMATION_MS_PER_SQUARE = 250;

const getDiceValues = (): { die1: number; die2: number; total: number } | null => {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const total = die1 + die2;
  return total === 12 ? null : { die1, die2, total };
};

const JAIL_POSITION = 10;

const Board = ({
  game,
  properties,
  game_properties,
  me,
}: {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  me: Player | null;
}) => {
  const [players, setPlayers] = useState<Player[]>(game?.players ?? []);
  const [roll, setRoll] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [pendingRoll, setPendingRoll] = useState(0);
  const [actionLock, setActionLock] = useState<"ROLL" | "END" | null>(null);
  const [buyPrompted, setBuyPrompted] = useState(false);
  const [animatedPositions, setAnimatedPositions] = useState<Record<number, number>>({});
  const [hasMovementFinished, setHasMovementFinished] = useState(false);
  const [isSpecialMove, setIsSpecialMove] = useState(false);
  const [showPerksModal, setShowPerksModal] = useState(false);

  const [showCardModal, setShowCardModal] = useState(false);
  const [cardData, setCardData] = useState<{
    type: "chance" | "community";
    text: string;
    effect?: string;
    isGood: boolean;
  } | null>(null);
  const [cardPlayerName, setCardPlayerName] = useState("");

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const landedPositionThisTurn = useRef<number | null>(null);
  const turnEndInProgress = useRef(false);
  const lastToastMessage = useRef<string | null>(null);
  const [showBankruptcyModal, setShowBankruptcyModal] = useState(false);
  const [showExitPrompt, setShowExitPrompt] = useState(false);

  // Victory handling
  const [winner, setWinner] = useState<Player | null>(null);
  const [endGameCandidate, setEndGameCandidate] = useState<{
    winner: Player | null;
    position: number;
    balance: bigint;
  }>({ winner: null, position: 0, balance: BigInt(0) });

  const currentPlayerId = game.next_player_id ?? -1;
  const currentPlayer = players.find((p) => p.user_id === currentPlayerId);

  const isMyTurn = me?.user_id === currentPlayerId;

  const playerCanRoll = Boolean(
    isMyTurn && currentPlayer && (currentPlayer.balance ?? 0) > 0
  );

  const currentPlayerInJail = currentPlayer?.position === JAIL_POSITION && currentPlayer?.in_jail === true;

  const currentProperty = useMemo(() => {
    return currentPlayer?.position
      ? properties.find((p) => p.id === currentPlayer.position) ?? null
      : null;
  }, [currentPlayer?.position, properties]);

  const justLandedProperty = useMemo(() => {
    if (landedPositionThisTurn.current === null) return null;
    return properties.find((p) => p.id === landedPositionThisTurn.current) ?? null;
  }, [landedPositionThisTurn.current, properties]);

  if (!game || !Array.isArray(properties) || properties.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white text-2xl">
        Loading game board...
      </div>
    );
  }

  const showToast = useCallback((message: string, type: "success" | "error" | "default" = "default") => {
    if (message === lastToastMessage.current) return;
    lastToastMessage.current = message;

    toast.dismiss();
    if (type === "success") toast.success(message);
    else if (type === "error") toast.error(message);
    else toast(message, { icon: "➤" });
  }, []);

  // Sync players from server
  useEffect(() => {
    if (game?.players) setPlayers(game.players);
  }, [game?.players]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await apiClient.get<ApiResponse>(`/games/code/${game.code}`);
        if (res?.data?.success && res.data.data?.players) {
          setPlayers(res.data.data.players);
        }
      } catch (err) {
        console.error("Sync failed:", err);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [game.code]);

  // Reset turn state + clear animation
  useEffect(() => {
    setRoll(null);
    setBuyPrompted(false);
    setIsRolling(false);
    setPendingRoll(0);
    landedPositionThisTurn.current = null;
    turnEndInProgress.current = false;
    lastToastMessage.current = null;
    setAnimatedPositions({});
    setHasMovementFinished(false);
  }, [currentPlayerId]);

  const lockAction = useCallback((type: "ROLL" | "END") => {
    if (actionLock) return false;
    setActionLock(type);
    return true;
  }, [actionLock]);

  const unlockAction = useCallback(() => setActionLock(null), []);

  const END_TURN = useCallback(async () => {
    if (currentPlayerId === -1 || turnEndInProgress.current || !lockAction("END")) return;

    turnEndInProgress.current = true;

    try {
      await apiClient.post("/game-players/end-turn", {
        user_id: currentPlayerId,
        game_id: game.id,
      });
      showToast("Turn ended", "success");
    } catch {
      showToast("Failed to end turn", "error");
    } finally {
      unlockAction();
      turnEndInProgress.current = false;
    }
  }, [currentPlayerId, game.id, lockAction, unlockAction, showToast]);

  const BUY_PROPERTY = useCallback(async () => {
    if (!currentPlayer?.position || actionLock || !justLandedProperty?.price) {
      showToast("Cannot buy right now", "error");
      return;
    }

    const playerBalance = currentPlayer.balance ?? 0;
    if (playerBalance < justLandedProperty.price) {
      showToast("Not enough money!", "error");
      return;
    }

    try {
      await apiClient.post("/game-properties/buy", {
        user_id: currentPlayer.user_id,
        game_id: game.id,
        property_id: justLandedProperty.id,
      });

      showToast(`You bought ${justLandedProperty.name}!`, "success");

      setBuyPrompted(false);
      landedPositionThisTurn.current = null;
      if (!(roll?.die1 === roll?.die2)) {
        setTimeout(END_TURN, 800);
      }
    } catch {
      showToast("Purchase failed", "error");
    }
  }, [currentPlayer, justLandedProperty, actionLock, END_TURN, showToast, game.id, roll]);

  const triggerLandingLogic = useCallback((newPosition: number, isSpecial = false) => {
    if (landedPositionThisTurn.current !== null) return;

    landedPositionThisTurn.current = newPosition;
    setIsSpecialMove(isSpecial);

    setRoll({ die1: 0, die2: 0, total: 0 }); // fake roll to trigger useEffect
    setHasMovementFinished(true);

    setTimeout(() => {
      const square = properties.find(p => p.id === newPosition);
      if (square?.price != null) {
        const isOwned = game_properties.some(gp => gp.property_id === newPosition);
        if (!isOwned && ["land", "railway", "utility"].includes(PROPERTY_ACTION(newPosition) || "")) {
          setBuyPrompted(true);
          toast(`Landed on ${square.name}! ${isSpecial ? "(Special Move)" : ""}`, { icon: "✨" });
        }
      }
    }, 300);
  }, [properties, game_properties]);

  const endTurnAfterSpecialMove = useCallback(() => {
    setBuyPrompted(false);
    landedPositionThisTurn.current = null;
    setIsSpecialMove(false);
    setTimeout(END_TURN, 800);
  }, [END_TURN]);

  const fetchUpdatedGame = useCallback(async () => {
    try {
      const res = await apiClient.get<ApiResponse<Game>>(`/games/code/${game.code}`);
      if (res?.data?.success && res.data.data) {
        setPlayers(res.data.data.players);
        return res.data.data;
      }
      return null;
    } catch (err) {
      console.error("Failed to refresh game state", err);
      return null;
    }
  }, [game.code]);

  // FIXED ROLL_DICE: Correct user_id, no animation in jail, proper doubles handling
  const ROLL_DICE = useCallback(async () => {
    if (isRolling || actionLock || !lockAction("ROLL") || !currentPlayer) return;

    setIsRolling(true);
    setRoll(null);
    setHasMovementFinished(false);
    setAnimatedPositions({});

    setTimeout(async () => {
      let value = getDiceValues();

      // Handle doubles (roll 12 → invalid, reroll)
      while (value === null) {
        showToast("DOUBLES! Rolling again...", "success");
        await new Promise(resolve => setTimeout(resolve, 600));
        value = getDiceValues();
      }

      setRoll(value);

      const oldPos = currentPlayer.position ?? 0;
      const isInJail = currentPlayer.in_jail === true && oldPos === JAIL_POSITION;
      const isDouble = value.die1 === value.die2;

      let newPos = oldPos;
      let shouldAnimate = false;

      if (!isInJail) {
        const totalMove = value.total + pendingRoll;
        newPos = (oldPos + totalMove) % BOARD_SQUARES;
        shouldAnimate = totalMove > 0;

        if (shouldAnimate) {
          const movePath: number[] = [];
          for (let i = 1; i <= totalMove; i++) {
            movePath.push((oldPos + i) % BOARD_SQUARES);
          }

          for (let i = 0; i < movePath.length; i++) {
            await new Promise(resolve => setTimeout(resolve, MOVE_ANIMATION_MS_PER_SQUARE));
            setAnimatedPositions(prev => ({
              ...prev,
              [currentPlayer.user_id]: movePath[i],
            }));
          }
        }

        // Final position
        setAnimatedPositions(prev => ({
          ...prev,
          [currentPlayer.user_id]: newPos,
        }));
      } else {
        showToast(
          `${currentPlayer.username} rolled while in jail: ${value.die1} + ${value.die2} = ${value.total}`,
          "default"
        );
      }

      setHasMovementFinished(true);
      landedPositionThisTurn.current = isInJail ? null : newPos;

      try {
        // CRITICAL: Use currentPlayer.user_id so opponent movement works in multiplayer
        await apiClient.post("/game-players/change-position", {
          user_id: currentPlayer.user_id,
          game_id: game.id,
          position: newPos,
          rolled: value.total + pendingRoll,
          is_double: isDouble,
        });

        setPendingRoll(0);

        if (!isInJail) {
          showToast(`Rolled ${value.die1} + ${value.die2} = ${value.total}!`, "success");
        }
      } catch (err) {
        console.error("Move failed:", err);
        showToast("Move failed", "error");
        END_TURN();
      } finally {
        setIsRolling(false);
        unlockAction();
      }
    }, ROLL_ANIMATION_MS);
  }, [
    isRolling,
    actionLock,
    lockAction,
    unlockAction,
    currentPlayer,
    pendingRoll,
    game.id,
    showToast,
    END_TURN,
  ]);

  // Buy prompt logic
  useEffect(() => {
    if (!hasMovementFinished || landedPositionThisTurn.current === null) {
      setBuyPrompted(false);
      return;
    }

    const pos = landedPositionThisTurn.current;
    const square = properties.find(p => p.id === pos);

    if (!square || square.price == null) {
      setBuyPrompted(false);
      return;
    }

    const isOwned = game_properties.some(gp => gp.property_id === pos);
    const action = PROPERTY_ACTION(pos);
    const isBuyableType = !!action && ["land", "railway", "utility"].includes(action);

    const canBuy = !isOwned && isBuyableType;

    if (canBuy) {
      setBuyPrompted(true);
      if ((currentPlayer?.balance ?? 0) < square.price) {
        showToast(`Not enough money to buy ${square.name}`, "error");
      }
    } else {
      setBuyPrompted(false);
    }
  }, [
    hasMovementFinished,
    landedPositionThisTurn.current,
    game_properties,
    properties,
    currentPlayer,
    showToast
  ]);

  // Auto-end turn when no action needed
  useEffect(() => {
    if (actionLock || isRolling || buyPrompted || !roll || !hasMovementFinished) return;

    const timer = setTimeout(() => {
      END_TURN();
    }, 1500);

    return () => clearTimeout(timer);
  }, [roll, buyPrompted, isRolling, actionLock, END_TURN, hasMovementFinished]);

  const playersByPosition = useMemo(() => {
    const map = new Map<number, Player[]>();
    players.forEach((p) => {
      const pos = animatedPositions[p.user_id] !== undefined
        ? animatedPositions[p.user_id]
        : (p.position ?? 0);
      if (!map.has(pos)) map.set(pos, []);
      map.get(pos)!.push(p);
    });
    return map;
  }, [players, animatedPositions]);

  const propertyOwner = (id: number) => {
    const gp = game_properties.find((gp) => gp.property_id === id);
    return gp ? players.find((p) => p.address === gp.address)?.username || null : null;
  };

  const developmentStage = (id: number) =>
    game_properties.find((gp) => gp.property_id === id)?.development ?? 0;

  const isPropertyMortgaged = (id: number) =>
    game_properties.find((gp) => gp.property_id === id)?.mortgaged === true;

  const handleRollDice = () => ROLL_DICE();
  const handleBuyProperty = () => BUY_PROPERTY();
  const handleSkipBuy = () => {
    showToast("Skipped purchase");
    setBuyPrompted(false);
    landedPositionThisTurn.current = null;
    setTimeout(END_TURN, 900);
  };

  const { data: contractGame } = useGetGameByCode(game.code);
  // Extract the on-chain game ID (it's a bigint now)
const onChainGameId = contractGame?.id;

  const {
    exit: endGame,
    isPending: endGamePending,
    isSuccess: endGameSuccess,
    error: endGameError,
    txHash: endGameTxHash,
    reset: endGameReset,
  } = useExitGame(onChainGameId ?? BigInt(0));

  const handleBankruptcy = useCallback(async () => {
  if (!me || !game.id || !game.code) {
    showToast("Cannot declare bankruptcy right now", "error");
    return;
  }

  showToast("Declaring bankruptcy...", "error");

  let creditorPlayerId: number | null = null;

  // Determine if we owe rent to another player (landlord)
  if (justLandedProperty) {
    const landedGameProp = game_properties.find(
      (gp) => gp.property_id === justLandedProperty.id
    );

    if (landedGameProp?.address) {
      const owner = players.find(
        (p) =>
          p.address?.toLowerCase() === landedGameProp.address?.toLowerCase() &&
          p.user_id !== me.user_id
      );

      if (owner) {
        creditorPlayerId = owner.user_id;
      }
    }
  }

  try {

    if (endGame) await endGame();
    // Get all properties owned by the bankrupt player
    const myOwnedProperties = game_properties.filter(
      (gp) => gp.address?.toLowerCase() === me.address?.toLowerCase()
    );

    // CASE 1: Transfer properties to creditor (if we landed on their property)
    if (creditorPlayerId && myOwnedProperties.length > 0) {
      showToast("All your properties transferred to the landlord!", "error");

      for (const gp of myOwnedProperties) {
        await apiClient.put(`/game-properties/${gp.id}`, {
          game_id: game.id,
          player_id: creditorPlayerId,
          address: players.find(p => p.user_id === creditorPlayerId)?.address || null,
        });
      }
    }
    // CASE 2: Return properties to bank (no creditor)
    else if (myOwnedProperties.length > 0) {
      showToast("All your properties returned to bank", "error");

      for (const gp of myOwnedProperties) {
        await apiClient.delete(`/game-properties/${gp.id}`, {
          data: { game_id: game.id },
        });
      }
    }

    // IMPORTANT: End the turn so next_player_id advances
    // This ensures the game continues for remaining players
    await END_TURN();
    
    // Officially leave the game
    await apiClient.post("/game-players/leave", {
      address: me.address,
      code: game.code,
      reason: "bankruptcy",
    });

    // Refresh game state to reflect changes
    await fetchUpdatedGame();

    showToast("You have declared bankruptcy and left the game.", "error");

    

    setShowExitPrompt(true);
  } catch (err: any) {
    console.error("Bankruptcy process failed:", err);
    showToast("Bankruptcy failed — but you are eliminated.", "error");

    // Even on failure, try to end the turn to unblock the game
    try {
      await END_TURN();
    } catch (endErr) {
      console.error("Failed to end turn after bankruptcy error:", endErr);
    }

    // Force redirect after delay
    setTimeout(() => {
      window.location.href = "/";
    }, 3000);
  } finally {
    // Clean up UI state regardless of success/failure
    setShowBankruptcyModal(false);
    setBuyPrompted(false);
    landedPositionThisTurn.current = null;
  }
}, [
  me,
  game,
  justLandedProperty,
  game_properties,
  players,
  showToast,
  fetchUpdatedGame,
  END_TURN, // ← Make sure END_TURN is in the dependency array
]);
  const togglePerksModal = () => {
    setShowPerksModal(prev => !prev);
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white p-4 flex flex-col lg:flex-row gap-4 items-start justify-center relative">
      <div className="flex justify-center items-start w-full lg:w-2/3 max-w-[800px] mt-[-1rem]">
        <div className="w-full bg-[#010F10] aspect-square rounded-lg relative shadow-2xl shadow-cyan-500/10">
          <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[2px] box-border">
            <CenterArea
              isMyTurn={isMyTurn}
              playerCanRoll={playerCanRoll}
              isRolling={isRolling}
              roll={roll}
              currentPlayer={currentPlayer}
              buyPrompted={buyPrompted}
              currentProperty={justLandedProperty || currentProperty}
              currentPlayerBalance={currentPlayer?.balance ?? 0}
              history={game.history ?? []}
              onRollDice={handleRollDice}
              onBuyProperty={handleBuyProperty}
              onSkipBuy={handleSkipBuy}
              onDeclareBankruptcy={handleBankruptcy}
              isPending={false}
            />

            {properties.map((square) => {
              const playersHere = playersByPosition.get(square.id) ?? [];
              const sortedPlayersHere = [...playersHere].sort((a, b) => {
                if (a.user_id === me?.user_id) return 1;
                if (b.user_id === me?.user_id) return -1;
                return 0;
              });

              return (
                <BoardSquare
                  key={square.id}
                  square={square}
                  playersHere={sortedPlayersHere}
                  currentPlayerId={currentPlayerId}
                  owner={propertyOwner(square.id)}
                  devLevel={developmentStage(square.id)}
                  mortgaged={isPropertyMortgaged(square.id)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Perks Button */}
      <button
        onClick={togglePerksModal}
        className="fixed bottom-20 left-6 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 shadow-2xl shadow-cyan-500/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
      >
        <Sparkles className="w-8 h-8 text-black" />
      </button>

      {/* Perks Modal */}
      <AnimatePresence>
        {showPerksModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPerksModal(false)}
              className="fixed inset-0 bg-black/70 z-50"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 50 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-6 left-6 z-50 w-80 max-h-[80vh]"
            >
              <div className="bg-[#0A1C1E] rounded-2xl shadow-2xl border border-cyan-500/30 overflow-hidden">
                <div className="p-5 border-b border-cyan-900/50 flex items-center justify-between">
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <Sparkles className="w-8 h-8 text-[#00F0FF]" />
                    My Perks
                  </h2>
                  <button
                    onClick={() => setShowPerksModal(false)}
                    className="text-gray-400 hover:text-white p-1"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                  <CollectibleInventoryBar
                    game={game}
                    game_properties={game_properties}
                    isMyTurn={isMyTurn}
                    ROLL_DICE={ROLL_DICE}
                    END_TURN={END_TURN}
                    triggerSpecialLanding={triggerLandingLogic}
                    endTurnAfterSpecial={endTurnAfterSpecialMove}
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modals */}
      <CardModal
        isOpen={showCardModal}
        onClose={() => setShowCardModal(false)}
        card={cardData}
        playerName={cardPlayerName}
      />

      <BankruptcyModal
        isOpen={showBankruptcyModal}
        tokensAwarded={0.5}
        onConfirmBankruptcy={handleBankruptcy}
        onReturnHome={() => window.location.href = "/"}
      />

      <Toaster
        position="top-center"
        reverseOrder={false}
        gutter={12}
        containerClassName="z-50"
        toastOptions={{
          duration: 3200,
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
          success: { icon: "✔", style: { borderColor: "#10b981" } },
          error: { icon: "✖", style: { borderColor: "#ef4444" } },
        }}
      />
    </div>
  );
};

export default Board;