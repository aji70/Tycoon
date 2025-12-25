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
  const cash = player.balance;
  let score = 50;

  if (cash < price * 1.3) score -= 70;
  else if (cash > price * 3) score += 20;
  else if (cash > price * 2) score += 10;

  const group = Object.values(MONOPOLY_STATS.colorGroups).find((g) => g.includes(property.id));
  if (group && !["railroad", "utility"].includes(property.color!)) {
    const owned = group.filter((id) =>
      gameProperties.find((gp) => gp.property_id === id)?.address === player.address
    ).length;

    if (owned === group.length - 1) score += 90;
    else if (owned >= 1) score += 35;
  }

  if (property.color === "railroad") {
    const owned = gameProperties.filter((gp) =>
      gp.address === player.address &&
      allProperties.find((p) => p.id === gp.property_id)?.color === "railroad"
    ).length;
    score += owned * 28;
  }
  if (property.color === "utility") {
    const owned = gameProperties.filter((gp) =>
      gp.address === player.address &&
      allProperties.find((p) => p.id === gp.property_id)?.type === "utility"
    ).length;
    score += owned * 35;
  }

  const rank = (MONOPOLY_STATS.landingRank as Record<number, number>)[property.id] ?? 25;
  score += 30 - rank;

  const roi = baseRent / price;
  if (roi > 0.12) score += 25;
  else if (roi > 0.08) score += 12;

  if (group) {
    const opponentOwns = group.some((id) => {
      const gp = gameProperties.find((gp) => gp.property_id === id);
      return gp && gp.address !== player.address;
    });
    if (opponentOwns && group.length <= 3) score += 30;
  }

  return Math.max(5, Math.min(98, score));
};

const BOARD_SQUARES = 40;
const ROLL_ANIMATION_MS = 1200;

const getDiceValues = (): { die1: number; die2: number; total: number } | null => {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const total = die1 + die2;
  return total === 12 ? null : { die1, die2, total };
};

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
  const [hasActedOnCurrentLanding, setHasActedOnCurrentLanding] = useState(false);

  const turnEndInProgress = useRef(false);
  const lastToastMessage = useRef<string | null>(null);
  const lastRollPosition = useRef<number | null>(null);
  const rolledForPlayerId = useRef<number | null>(null);

  const currentPlayerId = game.next_player_id ?? -1;
  const currentPlayer = players.find((p) => p.user_id === currentPlayerId);

  const isMyTurn = me?.user_id === currentPlayerId;

  const isAITurn = Boolean(
    currentPlayer?.username?.toLowerCase().includes("ai_") ||
    currentPlayer?.username?.toLowerCase().includes("bot")
  );

  const playerCanRoll = Boolean(
    isMyTurn && currentPlayer && currentPlayer.balance > 0
  );

  const [endGameCandidate, setEndGameCandidate] = useState<{
    winner: Player | null;
    position: number;
    balance: bigint;
  }>({ winner: null, position: 0, balance: BigInt(0) });

  const currentProperty = currentPlayer?.position
    ? properties.find((p) => p.id === currentPlayer.position)
    : null;

  const { data: contractGame } = useGetGameByCode(game.code, { enabled: !!game.code });
  const onChainGameId = contractGame?.id;

  const { write: endGame, isPending, reset } = useEndAiGame(
    Number(onChainGameId),
    endGameCandidate.position,
    endGameCandidate.balance,
    !!endGameCandidate.winner
  );

  const buyScore = useMemo(() => {
    if (!isAITurn || !buyPrompted || !currentPlayer || !currentProperty) return null;
    return calculateBuyScore(currentProperty, currentPlayer, game_properties, properties);
  }, [isAITurn, buyPrompted, currentPlayer, currentProperty, game_properties, properties]);

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

  // Sync players from initial props
  useEffect(() => {
    if (game?.players) setPlayers(game.players);
  }, [game?.players]);

  // Periodic sync from server
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

  // Reset turn state when current player changes
  useEffect(() => {
    setRoll(null);
    setBuyPrompted(false);
    setHasActedOnCurrentLanding(false);
    setIsRolling(false);
    setPendingRoll(0);
    rolledForPlayerId.current = null;
    lastRollPosition.current = null;
    turnEndInProgress.current = false;
    lastToastMessage.current = null;
  }, [currentPlayerId]);

  useEffect(() => {
    if (roll) setHasActedOnCurrentLanding(false);
  }, [roll]);

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
    }
  }, [currentPlayerId, game.id, lockAction, unlockAction, showToast]);

  const BUY_PROPERTY = useCallback(async (isAiAction = false) => {
    if (!roll || !buyPrompted || !currentPlayer?.position || actionLock) {
      showToast("Cannot buy right now", "error");
      return;
    }

    const square = properties.find((p) => p.id === currentPlayer.position);
    if (!square) return;

    const isOwnedByMe = game_properties.some(
      (gp) => gp.property_id === square.id && gp.address === currentPlayer.address
    );

    if (isOwnedByMe) {
      showToast("You already own this property!", "error");
      setBuyPrompted(false);
      return;
    }

    try {
      await apiClient.post("/game-properties/buy", {
        user_id: currentPlayer.user_id,
        game_id: game.id,
        property_id: square.id,
      });

      if (isAiAction) {
        showToast(`AI bought ${square.name}!`, "success");
      } else {
        showToast(`You bought ${square.name}!`, "success");
      }

      lastRollPosition.current = null;
      setBuyPrompted(false);
      setHasActedOnCurrentLanding(true);
      setTimeout(END_TURN, 1000);
    } catch {
      showToast("Purchase failed", "error");
    }
  }, [roll, buyPrompted, currentPlayer, properties, game_properties, game.id, actionLock, END_TURN, showToast]);

  const ROLL_DICE = useCallback(async (forAI = false) => {
    if (isRolling || actionLock || !lockAction("ROLL")) return;

    setIsRolling(true);
    setRoll(null);

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
      const currentPos = players.find((p) => p.user_id === playerId)?.position ?? 0;
      const newPos = (currentPos + value.total + pendingRoll) % BOARD_SQUARES;

      try {
        await apiClient.post("/game-players/change-position", {
          user_id: playerId,
          game_id: game.id,
          position: newPos,
          rolled: value.total + pendingRoll,
          is_double: value.die1 === value.die2,
        });

        setPendingRoll(0);
        showToast(
          `${currentPlayer?.username || "Player"} rolled ${value.die1} + ${value.die2} = ${value.total}!`,
          "success"
        );

        if (forAI) rolledForPlayerId.current = currentPlayerId;
      } catch {
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
    currentPlayerId,
    me,
    players,
    pendingRoll,
    game.id,
    currentPlayer,
    END_TURN,
    showToast,
  ]);

  // AI auto-roll
  useEffect(() => {
    if (!isAITurn || isRolling || actionLock || roll || rolledForPlayerId.current === currentPlayerId) return;
    const timer = setTimeout(() => ROLL_DICE(true), 1200);
    return () => clearTimeout(timer);
  }, [isAITurn, isRolling, actionLock, roll, currentPlayerId, ROLL_DICE]);

  // Buy prompt detection
  useEffect(() => {
    if (!roll || !currentPlayer?.position) return;

    const currentPos = currentPlayer.position;

    if (lastRollPosition.current === currentPos) return;
    lastRollPosition.current = currentPos;

    setBuyPrompted(false);

    const square = properties.find(p => p.id === currentPos);
    if (!square) return;

    const isOwnedByAnyone = game_properties.some(gp => gp.property_id === currentPos);
    const isOwnedByMe = game_properties.some(
      gp => gp.property_id === currentPos && gp.address === currentPlayer.address
    );

    const action = PROPERTY_ACTION(currentPos);
    const isBuyable = action && ["land", "railway", "utility"].includes(action);

    const canBuyNow = !isOwnedByAnyone && !isOwnedByMe && isBuyable;

    if (canBuyNow) {
      setBuyPrompted(true);

      if (square.price != null && currentPlayer.balance < square.price) {
        showToast(`Not enough money to buy ${square.name}`, "error");
      }
    }
  }, [
    roll,
    currentPlayer?.position,
    currentPlayer?.balance,
    currentPlayer?.address,
    properties,
    game_properties,
    showToast
  ]);

  // AI buy decision
  useEffect(() => {
    if (!isAITurn || !buyPrompted || !currentProperty || buyScore === null) return;

    const timer = setTimeout(async () => {
      const shouldBuy = buyScore >= 60;
      if (shouldBuy) {
        showToast(`AI buys ${currentProperty.name} (${buyScore}%)`, "success");
        await BUY_PROPERTY(true);
      } else {
        showToast(`AI skips ${currentProperty.name} (${buyScore}%)`);
        lastRollPosition.current = null;
        setBuyPrompted(false);
        setHasActedOnCurrentLanding(true);
        setTimeout(END_TURN, 900);
      }
    }, 1800);

    return () => clearTimeout(timer);
  }, [isAITurn, buyPrompted, currentProperty, buyScore, BUY_PROPERTY, END_TURN, showToast]);

  // Auto-end turn when no action is pending (both human & AI)
  useEffect(() => {
    if (actionLock || !roll || buyPrompted || isRolling) return;

    const shouldAutoEnd = hasActedOnCurrentLanding || !currentProperty;

    if (!shouldAutoEnd) return;

    const timer = setTimeout(() => {
      END_TURN();
    }, isAITurn ? 1400 : 1800);

    return () => clearTimeout(timer);
  }, [
    roll,
    buyPrompted,
    isRolling,
    actionLock,
    hasActedOnCurrentLanding,
    currentProperty,
    isAITurn,
    END_TURN
  ]);

  const playersByPosition = useMemo(() => {
    const map = new Map<number, Player[]>();
    players.forEach((p) => {
      const pos = p.position ?? 0;
      if (!map.has(pos)) map.set(pos, []);
      map.get(pos)!.push(p);
    });
    return map;
  }, [players]);

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
    lastRollPosition.current = null;
    setBuyPrompted(false);
    setHasActedOnCurrentLanding(true);
    setTimeout(END_TURN, 800);
  };

  const handleDeclareBankruptcy = async () => {
    showToast("Declaring bankruptcy...", "default");

    try {
      if (endGame) {
        await endGame();
      }

      const opponent = players.find(p => p.user_id !== me?.user_id);
      await apiClient.put(`/games/${game.id}`, {
        status: "FINISHED",
        winner_id: opponent?.user_id || null,
      });

      showToast("Game over! You have declared bankruptcy.", "error");
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
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
              currentProperty={currentProperty}
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
              const playersHere = playersByPosition.get(square.id) ?? [];
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