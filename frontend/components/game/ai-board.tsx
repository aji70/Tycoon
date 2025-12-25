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
import { useEndAiGame, useGetGameByCode } from "@/context/ContractProvider";
import { BankruptcyModal } from "./modals/bankruptcy";
import { CardModal } from "../game/modals/ cards";  // NEW: Import the modal

const MONOPOLY_STATS = {
  landingRank: {
    5: 1, 6: 2, 7: 3, 8: 4, 9: 5, 11: 6, 13: 7, 14: 8, 16: 9, 18: 10,
    19: 11, 21: 12, 23: 13, 24: 14, 26: 15, 27: 16, 29: 17, 31: 18, 32: 19, 34: 20, 37: 21, 39: 22,
    1: 30, 2: 25, 3: 29, 4: 35, 12: 32, 17: 28, 22: 26, 28: 33, 33: 27, 36: 24, 38: 23,
  },
  colorGroups: {
    brown: [1, 3],
    lightblue: [6, 8, 9],
    pink: [11, 13, 14],
    orange: [16, 18, 19],
    red: [21, 23, 24],
    yellow: [26, 27, 29],
    green: [31, 32, 34],
    darkblue: [37, 39],
    railroad: [5, 15, 25, 35],
    utility: [12, 28],
  },
};

const calculateBuyScore = (
  property: Property,
  player: Player,
  gameProperties: GameProperty[],
  allProperties: Property[]
): number => {
  if (!property.price || property.type !== "property") return 0;

  const price = property.price!;
  const baseRent = property.rent_site_only || 0;
  const cash = player.balance ?? 0;

  // Start more conservatively
  let score = 30;

  // Cash safety is now much more important
  if (cash < price * 1.5) score -= 80;      // Very dangerous
  else if (cash < price * 2) score -= 40;    // Risky
  else if (cash > price * 4) score += 35;    // Very safe
  else if (cash > price * 3) score += 15;

  // Monopoly completion is still very valuable
  const group = Object.values(MONOPOLY_STATS.colorGroups).find((g) => g.includes(property.id));
  if (group && !["railroad", "utility"].includes(property.color!)) {
    const owned = group.filter((id) =>
      gameProperties.find((gp) => gp.property_id === id)?.address === player.address
    ).length;

    if (owned === group.length - 1) score += 120;    // Huge incentive to complete sets
    else if (owned === group.length - 2) score += 60;
    else if (owned >= 1) score += 25;
  }

  // Railroads & Utilities - slightly toned down
  if (property.color === "railroad") {
    const owned = gameProperties.filter((gp) =>
      gp.address === player.address &&
      allProperties.find((p) => p.id === gp.property_id)?.color === "railroad"
    ).length;
    score += owned * 22;  // was 28
  }
  if (property.color === "utility") {
    const owned = gameProperties.filter((gp) =>
      gp.address === player.address &&
      allProperties.find((p) => p.id === gp.property_id)?.type === "utility"
    ).length;
    score += owned * 28;  // was 35
  }

  // Landing frequency (negative = rare = worse)
  const rank = (MONOPOLY_STATS.landingRank as Record<number, number>)[property.id] ?? 25;
  score += 35 - rank;

  // ROI still matters but less dominant
  const roi = baseRent / price;
  if (roi > 0.14) score += 30;
  else if (roi > 0.10) score += 15;

  // Opponent almost completing set → higher priority to block
  if (group && group.length <= 3) {
    const opponentOwns = group.filter((id) => {
      const gp = gameProperties.find((gp) => gp.property_id === id);
      return gp && gp.address !== player.address && gp.address !== null;
    }).length;

    if (opponentOwns === group.length - 1) score += 70;  // Block completion!
  }

  // Final clamp - AI should rarely buy above ~92 even in great spots
  return Math.max(0, Math.min(95, score));
};

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

const AiBoard = ({
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

  // NEW: Card modal states
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardData, setCardData] = useState<{
    type: "chance" | "community";
    text: string;
    effect?: string;
    isGood: boolean;
  } | null>(null);
  const [cardPlayerName, setCardPlayerName] = useState("");
  const prevHistoryLength = useRef(game.history?.length ?? 0);

  const landedPositionThisTurn = useRef<number | null>(null);
  const turnEndInProgress = useRef(false);
  const lastToastMessage = useRef<string | null>(null);
  const rolledForPlayerId = useRef<number | null>(null);
  const [showBankruptcyModal, setShowBankruptcyModal] = useState(false);

  const currentPlayerId = game.next_player_id ?? -1;
  const currentPlayer = players.find((p) => p.user_id === currentPlayerId);

  const isMyTurn = me?.user_id === currentPlayerId;
  const isAITurn = Boolean(
    currentPlayer?.username?.toLowerCase().includes("ai_") ||
    currentPlayer?.username?.toLowerCase().includes("bot")
  );

  const playerCanRoll = Boolean(
    isMyTurn && currentPlayer && (currentPlayer.balance ?? 0) > 0
  );

  const currentPlayerInJail = currentPlayer?.position === JAIL_POSITION && currentPlayer?.in_jail === true;

  const [endGameCandidate, setEndGameCandidate] = useState<{
    winner: Player | null;
    position: number;
    balance: bigint;
  }>({ winner: null, position: 0, balance: BigInt(0) });

  const currentProperty = useMemo(() => {
    return currentPlayer?.position
      ? properties.find((p) => p.id === currentPlayer.position) ?? null
      : null;
  }, [currentPlayer?.position, properties]);

  // ── NEW: Reliable property we just landed on (fixes stale data flash) ──
  const justLandedProperty = useMemo(() => {
    if (landedPositionThisTurn.current === null) return null;
    return properties.find((p) => p.id === landedPositionThisTurn.current) ?? null;
  }, [landedPositionThisTurn.current, properties]);

  const { data: contractGame } = useGetGameByCode(game.code, { enabled: !!game.code });
  const onChainGameId = contractGame?.id;

  const { write: endGame, isPending, reset } = useEndAiGame(
    Number(onChainGameId),
    endGameCandidate.position,
    endGameCandidate.balance,
    !!endGameCandidate.winner
  );

  const buyScore = useMemo(() => {
    if (!isAITurn || !buyPrompted || !currentPlayer || !justLandedProperty) return null;
    return calculateBuyScore(justLandedProperty, currentPlayer, game_properties, properties);
  }, [isAITurn, buyPrompted, currentPlayer, justLandedProperty, game_properties, properties]);

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

 const ROLL_DICE = useCallback(async (forAI = false) => {
  if (isRolling || actionLock || !lockAction("ROLL")) return;

  setIsRolling(true);
  setRoll(null);
  setHasMovementFinished(false);

  setTimeout(async () => {
    const value = getDiceValues();
    if (!value) {
      showToast("DOUBLES! Roll again!", "success");
      setIsRolling(false);
      unlockAction();
      return;
    }

    setRoll(value);
    const playerId = forAI ? currentPlayerId : me!.user_id;
    const player = players.find((p) => p.user_id === playerId);
    if (!player) return;

    const currentPos = player.position ?? 0;
    const isInJail = player.in_jail === true && currentPos === JAIL_POSITION;

    let newPos = currentPos; // Default: stay put
    let shouldAnimate = false;

    // Only move if NOT in jail
    if (!isInJail) {
      const totalMove = value.total + pendingRoll;
      newPos = (currentPos + totalMove) % BOARD_SQUARES;
      shouldAnimate = totalMove > 0;

      if (shouldAnimate) {
        const movePath: number[] = [];
        for (let i = 1; i <= totalMove; i++) {
          movePath.push((currentPos + i) % BOARD_SQUARES);
        }

        // Animate step by step
        for (let i = 0; i < movePath.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, MOVE_ANIMATION_MS_PER_SQUARE));
          setAnimatedPositions((prev) => ({
            ...prev,
            [playerId]: movePath[i],
          }));
        }
      }
    } else {
      // In jail → no movement, but still show the roll result
      showToast(
        `${player.username || "Player"} is in jail — rolled ${value.die1} + ${value.die2} = ${value.total} (no movement)`,
        "default"
      );
    }

    setHasMovementFinished(true);

    try {
      // Always send the roll result to backend (even in jail — backend will handle doubles, pay, etc.)
      await apiClient.post("/game-players/change-position", {
        user_id: playerId,
        game_id: game.id,
        position: newPos,           // stays the same if in jail
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
  showToast, END_TURN
]);

  // AI auto-roll
  useEffect(() => {
    if (!isAITurn || isRolling || actionLock || roll || rolledForPlayerId.current === currentPlayerId) return;
    const timer = setTimeout(() => ROLL_DICE(true), 700);
    return () => clearTimeout(timer);
  }, [isAITurn, isRolling, actionLock, roll, currentPlayerId, ROLL_DICE]);

  // Buy prompt logic – now uses landed position
  useEffect(() => {
    if (!roll || landedPositionThisTurn.current === null || !hasMovementFinished) {
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

    setBuyPrompted(canBuy);

    if (canBuy) {
      const playerBalance = currentPlayer?.balance ?? 0;
      if (playerBalance < square.price) {
        showToast(`Not enough money to buy ${square.name}`, "error");
      }
    }
  }, [
    roll,
    landedPositionThisTurn.current,
    hasMovementFinished,
    game_properties,
    properties,
    currentPlayer?.balance,
    showToast
  ]);


// NEW: Detect card draw from history changes
useEffect(() => {
  const history = game.history ?? [];
  if (history.length <= prevHistoryLength.current) return;

  const newEntry = history[history.length - 1];
  prevHistoryLength.current = history.length;

  // Early return if no valid entry
  if (newEntry == null || typeof newEntry !== "string") {
    return;
  }

  const cardRegex = /(.+) drew (Chance|Community Chest): (.+)/i;
  const match = (newEntry as string).match(cardRegex);

  if (!match) return;

  const [, playerName, typeStr, text] = match;
  const type = typeStr.toLowerCase().includes("chance") ? "chance" : "community";

  const lowerText = text.toLowerCase();
  const isGood =
    lowerText.includes("collect") ||
    lowerText.includes("receive") ||
    lowerText.includes("advance") ||
    lowerText.includes("get out of jail") ||
    lowerText.includes("matures") ||
    lowerText.includes("refund") ||
    lowerText.includes("prize") ||
    lowerText.includes("inherit");

  const effectMatch = text.match(/([+-]?\$\d+)|go to jail|move to .+|get out of jail free/i);
  const effect = effectMatch ? effectMatch[0] : undefined;

  setCardData({ type, text, effect, isGood });
  setCardPlayerName(playerName.trim());
  setShowCardModal(true);

  const timer = setTimeout(() => setShowCardModal(false), 7000);
  return () => clearTimeout(timer);
}, [game.history]);

  // Smarter AI buy decision
  useEffect(() => {
    if (!isAITurn || !buyPrompted || !currentPlayer || !justLandedProperty || buyScore === null) return;

    const timer = setTimeout(async () => {
      // Much stricter thresholds + cash safety check
      const shouldBuy =
        buyScore >= 72 && // was 60 – now requires really good spot
        (currentPlayer.balance ?? 0) > justLandedProperty.price * 1.8;

      if (shouldBuy) {
        showToast(`AI bought ${justLandedProperty.name} (score: ${buyScore}%)`, "success");
        await BUY_PROPERTY(true);
      } else {
        showToast(`AI passed on ${justLandedProperty.name} (score: ${buyScore}%)`, "default");
      }

      setTimeout(END_TURN, shouldBuy ? 1200 : 900);
    }, 900);

    return () => clearTimeout(timer);
  }, [
    isAITurn,
    buyPrompted,
    currentPlayer,
    justLandedProperty,
    buyScore,
    BUY_PROPERTY,
    END_TURN,
    showToast
  ]);

  // Auto-end turn when nothing to do
  useEffect(() => {
    if (actionLock || isRolling || buyPrompted || !roll) return;

    const timer = setTimeout(() => {
      END_TURN();
    }, isAITurn ? 1000 : 1200);

    return () => clearTimeout(timer);
  }, [roll, buyPrompted, isRolling, actionLock, isAITurn, END_TURN]);

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

  const handleDeclareBankruptcy = async () => {
    
    showToast("Declaring bankruptcy...", "default");

    try {
      if (endGame) await endGame();

      const opponent = players.find(p => p.user_id !== me?.user_id);
      await apiClient.put(`/games/${game.id}`, {
        status: "FINISHED",
        winner_id: opponent?.user_id || null,
      });

      showToast("Game over! You have declared bankruptcy.", "error");
      setShowBankruptcyModal(true);
  
    } catch (err) {
      showToast("Failed to end game", "error");
    }
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white p-4 flex flex-col lg:flex-row gap-4 items-start justify-center relative">
      <div className="flex justify-center items-start w-full lg:w-2/3 max-w-[800px] mt-[-1rem]">
        <div className="w-full bg-[#010F10] aspect-square rounded-lg relative shadow-2xl shadow-cyan-500/10">
          <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[2px] box-border">
            <CenterArea
              isMyTurn={isMyTurn}
              isAITurn={isAITurn}
              currentPlayer={currentPlayer}
              playerCanRoll={playerCanRoll}
              isRolling={isRolling}
              roll={roll}
              buyPrompted={buyPrompted}
              currentProperty={justLandedProperty || currentProperty} // Prefer landed property for UI
              currentPlayerBalance={currentPlayer?.balance ?? 0}
              buyScore={buyScore}
              history={game.history ?? []}
              onRollDice={handleRollDice}
              onBuyProperty={handleBuyProperty}
              onSkipBuy={handleSkipBuy}
              onDeclareBankruptcy={handleDeclareBankruptcy}
              isPending={false}
            />

            {properties.map((square) => {
              const allPlayersHere = playersByPosition.get(square.id) ?? [];
              let playersHere: Player[] = [];

              if (allPlayersHere.length > 0) {
                const currentHere = allPlayersHere.find(p => p.user_id === currentPlayerId);
                if (currentHere) {
                  // Prioritize current player
                  playersHere = [currentHere];
                } else {
                  // Show only one other player (prefer human if present)
                  const humanHere = allPlayersHere.find(p => p.user_id === me?.user_id);
                  playersHere = [humanHere || allPlayersHere[0]];
                }
              }

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

      {/* NEW: Card Modal */}
      <CardModal
        isOpen={showCardModal}
        onClose={() => setShowCardModal(false)}
        card={cardData}
        playerName={cardPlayerName}
      />

      <BankruptcyModal
  isOpen={showBankruptcyModal}
  tokensAwarded={0.5}
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

export default AiBoard;