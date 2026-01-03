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

const isAIPlayer = (player: Player | undefined): boolean =>
  player?.username?.toLowerCase().includes("ai_") ||
  player?.username?.toLowerCase().includes("bot") ||
  false;

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

  const landedPositionThisTurn = useRef<number | null>(null);
  const turnEndInProgress = useRef(false);
  const lastToastMessage = useRef<string | null>(null);
  const rolledForPlayerId = useRef<number | null>(null);
  const [showBankruptcyModal, setShowBankruptcyModal] = useState(false);
  const [showExitPrompt, setShowExitPrompt] = useState(false);

  const currentPlayerId = game.next_player_id ?? -1;
  const currentPlayer = players.find((p) => p.user_id === currentPlayerId);

  const isMyTurn = me?.user_id === currentPlayerId;
  const isAITurn = isAIPlayer(currentPlayer);

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

  // Sync players
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

  // Reset turn state
  useEffect(() => {
    setRoll(null);
    setBuyPrompted(false);
    setIsRolling(false);
    setPendingRoll(0);
    landedPositionThisTurn.current = null;
    rolledForPlayerId.current = null;
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

  const BUY_PROPERTY = useCallback(async (isAiAction = false) => {
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

      showToast(isAiAction ? `AI bought ${justLandedProperty.name}!` : `You bought ${justLandedProperty.name}!`, "success");

      setBuyPrompted(false);
      landedPositionThisTurn.current = null;
      setTimeout(END_TURN, 800);
    } catch {
      showToast("Purchase failed", "error");
    }
  }, [currentPlayer, justLandedProperty, actionLock, END_TURN, showToast, game.id]);

  const triggerLandingLogic = useCallback((newPosition: number, isSpecial = false) => {
    if (landedPositionThisTurn.current !== null) return;

    landedPositionThisTurn.current = newPosition;
    setIsSpecialMove(isSpecial);

    setRoll({ die1: 0, die2: 0, total: 0 });
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
      }
    } catch (err) {
      console.error("Failed to refresh game state", err);
    }
  }, [game.code]);

  const ROLL_DICE = useCallback(async (forAI = false) => {
    if (isRolling || actionLock || !lockAction("ROLL")) return;

    setIsRolling(true);
    setRoll(null);
    setHasMovementFinished(false);

    setTimeout(async () => {
      let value = getDiceValues();
      while (value === null) {
        showToast("DOUBLES! Rolling again...", "success");
        await new Promise(resolve => setTimeout(resolve, 500));
        value = getDiceValues();
      }

      setRoll(value);
      const playerId = forAI ? currentPlayerId : me!.user_id;
      const player = players.find((p) => p.user_id === playerId);
      if (!player) return;

      const currentPos = player.position ?? 0;
      const isInJail = player.in_jail === true && currentPos === JAIL_POSITION;

      let newPos = currentPos;
      let shouldAnimate = false;

      if (!isInJail) {
        const totalMove = value.total + pendingRoll;
        newPos = (currentPos + totalMove) % BOARD_SQUARES;
        shouldAnimate = totalMove > 0;

        if (shouldAnimate) {
          const movePath: number[] = [];
          for (let i = 1; i <= totalMove; i++) {
            movePath.push((currentPos + i) % BOARD_SQUARES);
          }

          let i = 0;
          const animateStep = () => {
            if (i >= movePath.length) return;
            setAnimatedPositions((prev) => ({
              ...prev,
              [playerId]: movePath[i],
            }));
            i++;
            setTimeout(animateStep, MOVE_ANIMATION_MS_PER_SQUARE);
          };
          animateStep();
        }
      } else {
        showToast(
          `${player.username || "Player"} is in jail — rolled ${value.die1} + ${value.die2} = ${value.total}`,
          "default"
        );
      }

      setHasMovementFinished(true);

      try {
        await apiClient.post("/game-players/change-position", {
          user_id: playerId,
          game_id: game.id,
          position: newPos,
          rolled: value.total + pendingRoll,
          is_double: value.die1 === value.die2,
        });

        setPendingRoll(0);
        landedPositionThisTurn.current = isInJail ? null : newPos;

        if (!isInJail) {
          showToast(
            `${player.username || "Player"} rolled ${value.die1} + ${value.die2} = ${value.total}!`,
            "success"
          );
        }

        if (forAI) rolledForPlayerId.current = currentPlayerId;

        // Tweak: Check for multiple players on the landed position
        if (players.length > 1 && landedPositionThisTurn.current !== null) {
          const playersOnSquare = players.filter(p => p.position === landedPositionThisTurn.current);
          if (playersOnSquare.length > 1) {
            showToast(`Multiple players on ${justLandedProperty?.name || 'this property'}! Connected player token shown.`, "default");
            // Assuming BoardSquare handles multiple tokens (up to 8 squeezed in one box via CSS grid/flex)
          }
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
    isRolling, actionLock, lockAction, unlockAction,
    currentPlayerId, me, players, pendingRoll, game.id,
    showToast, END_TURN, justLandedProperty
  ]);

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

  useEffect(() => {
    if (actionLock || isRolling || buyPrompted || !roll || !hasMovementFinished) return;

    const timer = setTimeout(() => {
      END_TURN();
    }, isAITurn ? 1000 : 1200);

    return () => clearTimeout(timer);
  }, [roll, buyPrompted, isRolling, actionLock, isAITurn, END_TURN, hasMovementFinished]);

  const playersByPosition = useMemo(() => {
    const map = new Map<number, Player[]>();
    players.forEach((p) => {
      const pos = animatedPositions[p.user_id] !== undefined ? animatedPositions[p.user_id] : (p.position ?? 0);
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

  const handleRollDice = () => ROLL_DICE(false);
  const handleBuyProperty = () => BUY_PROPERTY(false);
  const handleSkipBuy = () => {
    showToast("Skipped purchase");
    setBuyPrompted(false);
    landedPositionThisTurn.current = null;
    setTimeout(END_TURN, 900);
  };

const handleBankruptcy = useCallback(async () => {
  if (!me || !game.id || !game.code) {
    showToast("Cannot declare bankruptcy right now", "error");
    return;
  }

  showToast("Declaring bankruptcy...", "error");

  let creditorPlayerId: number | null = null;

  // Check if we landed on an owned property → that owner is the creditor
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
    // Get ALL properties owned by the bankrupt player (me)
    const myOwnedProperties = game_properties.filter(
      (gp) => gp.address?.toLowerCase() === me.address?.toLowerCase()
    );

    if (creditorPlayerId && myOwnedProperties.length > 0) {
      // CASE 1: Transfer ALL properties to the creditor (landlord)
      showToast("All your properties transferred to the landlord!", "error");

      // You can batch this on backend, but here we do one by one for reliability
      for (const gp of myOwnedProperties) {
        await apiClient.put(`/game-properties/${gp.id}`, {
          game_id: game.id,
          player_id: creditorPlayerId,
          address: players.find(p => p.user_id === creditorPlayerId)?.address || null,
        });
      }
    } else if (myOwnedProperties.length > 0) {
      // CASE 2: Delete ALL properties (return to bank = permanent delete as you want)
      showToast("All your properties permanently deleted (returned to bank)", "error");

      for (const gp of myOwnedProperties) {
        await apiClient.delete(`/game-properties/${gp.id}`, {
          data: { game_id: game.id },
        });
      }
    }

    // Finally, leave the game
    await apiClient.post("/game-players/leave", {
      address: me.address,
      code: game.code,
      reason: "bankruptcy",
    });

    await fetchUpdatedGame();

    // Optional exit prompt
    setShowExitPrompt(true);
  } catch (err: any) {
    console.error("Bankruptcy process failed:", err);
    showToast("Bankruptcy failed — you are still eliminated.", "error");

    // Force redirect anyway
    setTimeout(() => {
      window.location.href = "/";
    }, 3000);
  } finally {
    // Always clean up UI
    setShowBankruptcyModal(false);
    setBuyPrompted(false);
    landedPositionThisTurn.current = null;
  }
}, [
  me,
  game.id,
  game.code,
  justLandedProperty,
  game_properties,
  players,
  showToast,
  fetchUpdatedGame,
]);

  // Toggle function for the sparkle button
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
              currentPlayer={currentPlayer}
              playerCanRoll={playerCanRoll}
              isRolling={isRolling}
              roll={roll}
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
              const allPlayersHere = playersByPosition.get(square.id) ?? [];
              const playersHere = allPlayersHere;

              return (
                <BoardSquare
                  key={square.id}
                  square={square}
                  playersHere={playersHere}
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

      {/* Sparkle Button - Now toggles the modal */}
      <button
        onClick={togglePerksModal}
        className="fixed bottom-20 left-6 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 shadow-2xl shadow-cyan-500/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
      >
        <Sparkles className="w-8 h-8 text-black" />
      </button>

      {/* Perks Overlay: Dark backdrop + Corner Perks Panel */}
      <AnimatePresence>
        {showPerksModal && (
          <>
            {/* Backdrop - covers entire screen */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPerksModal(false)}
              className="fixed inset-0 bg-black/70 z-50"
            />

            {/* Perks Panel - ONLY in bottom-left corner */}
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

      {/* Other Modals */}
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