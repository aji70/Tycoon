"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "react-hot-toast";

import PropertyCard from "./cards/property-card";
import SpecialCard from "./cards/special-card";
import CornerCard from "./cards/corner-card";
import { getPlayerSymbol } from "@/lib/types/symbol";
import {
  Game,
  GameProperty,
  Property,
  Player,
  PROPERTY_ACTION,
} from "@/types/game";
import { apiClient } from "@/lib/api";
import { useEndAiGame, useGetGameByCode } from "@/context/ContractProvider";

// Child components
import BoardSquare from "./board-square";
import CenterArea from "./center-area";
import DiceAnimation from "./dice-animation";
import RollResult from "./roll-result";
import ActionLog from "./action-log";
import PlayerTokens from "./player-token";

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

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

  const group = Object.values(MONOPOLY_STATS.colorGroups).find(g => g.includes(property.id));
  if (group && !["railroad", "utility"].includes(property.color!)) {
    const owned = group.filter(id =>
      gameProperties.find(gp => gp.property_id === id)?.address === player.address
    ).length;

    if (owned === group.length - 1) score += 90;
    else if (owned >= 1) score += 35;
  }

  if (property.color === "railroad") {
    const owned = gameProperties.filter(gp =>
      gp.address === player.address &&
      allProperties.find(p => p.id === gp.property_id)?.color === "railroad"
    ).length;
    score += owned * 28;
  }
  if (property.color === "utility") {
    const owned = gameProperties.filter(gp =>
      gp.address === player.address &&
      allProperties.find(p => p.id === gp.property_id)?.type === "utility"
    ).length;
    score += owned * 35;
  }

  const rank = (MONOPOLY_STATS.landingRank as Record<number, number>)[property.id] ?? 25;
  score += (30 - rank);

  const roi = baseRent / price;
  if (roi > 0.12) score += 25;
  else if (roi > 0.08) score += 12;

  if (group) {
    const opponentOwns = group.some(id => {
      const gp = gameProperties.find(gp => gp.property_id === id);
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
  const [winner, setWinner] = useState<Player | null>(null);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [endGameCandidate] = useState<{
    winner: Player | null;
    position: number;
    balance: bigint;
  }>({ winner: null, position: 0, balance: BigInt(0) });

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

  const lastProcessed = useRef<number | null>(null);
  const rolledForPlayerId = useRef<number | null>(null);

  const currentProperty = currentPlayer?.position
    ? properties.find(p => p.id === currentPlayer.position)
    : null;

  const buyScore = useMemo(() => {
    if (!isAITurn || !buyPrompted || !currentPlayer || !currentProperty) return null;
    return calculateBuyScore(currentProperty, currentPlayer, game_properties, properties);
  }, [isAITurn, buyPrompted, currentPlayer, currentProperty, game_properties, properties]);

  const { data: contractGame } = useGetGameByCode(game.code, { enabled: !!game.code });
  const onChainGameId = contractGame?.id;

  const { write: endGame, isPending, reset } = useEndAiGame(
    Number(onChainGameId),
    endGameCandidate.position,
    endGameCandidate.balance,
    !!endGameCandidate.winner
  );

  const showToast = useCallback((message: string, type: "success" | "error" | "default" = "default") => {
    toast.dismiss();
    if (type === "success") toast.success(message);
    else if (type === "error") toast.error(message);
    else toast(message, { icon: "➤" });
  }, []);

  useEffect(() => {
    if (game?.players) setPlayers(game.players);
  }, [game?.players]);

  useEffect(() => {
    const interval = setInterval(() => {
      apiClient.get<ApiResponse>(`/games/code/${game.code}`)
        .then(res => {
          if (res?.data?.success && res.data.data?.players) {
            setPlayers(res.data.data.players);
          }
        })
        .catch(err => console.error("Sync failed:", err));
    }, 8000);

    return () => clearInterval(interval);
  }, [game.code]);

  useEffect(() => {
    setRoll(null);
    setBuyPrompted(false);
    setHasActedOnCurrentLanding(false);
    setIsRolling(false);
    setPendingRoll(0);
    rolledForPlayerId.current = null;
    lastProcessed.current = null;
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
    if (!currentPlayerId || !lockAction("END")) return;

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

  const BUY_PROPERTY = useCallback(async () => {
    if (!currentPlayer?.position || actionLock) return;
    const square = properties.find((p) => p.id === currentPlayer.position);
    if (!square || game_properties.some((gp) => gp.property_id === square.id)) {
      setBuyPrompted(false);
      return;
    }

    try {
      await apiClient.post("/game-properties/buy", {
        user_id: currentPlayer.user_id,
        game_id: game.id,
        property_id: square.id,
      });

      showToast(`You bought ${square.name}!`, "success");
      setBuyPrompted(false);
      setHasActedOnCurrentLanding(true);
      setTimeout(END_TURN, 1000);
    } catch (err) {
      showToast("Purchase failed", "error");
    }
  }, [currentPlayer, properties, game_properties, game.id, END_TURN, actionLock, showToast]);

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
      const playerId = forAI ? currentPlayerId! : me!.user_id;
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
          `${currentPlayer?.username} rolled ${value.die1} + ${value.die2} = ${value.total}!`,
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
    isRolling, actionLock, lockAction, unlockAction,
    currentPlayerId, me, players, pendingRoll, game.id,
    currentPlayer?.username, END_TURN, showToast
  ]);

  useEffect(() => {
    if (!isAITurn || isRolling || actionLock || roll || rolledForPlayerId.current === currentPlayerId) return;

    const timer = setTimeout(() => ROLL_DICE(true), 1200);
    return () => clearTimeout(timer);
  }, [isAITurn, isRolling, actionLock, roll, currentPlayerId, ROLL_DICE]);

  useEffect(() => {
    if (!currentPlayer?.position || !properties.length || currentPlayer.position === lastProcessed.current) return;
    lastProcessed.current = currentPlayer.position;

    const square = properties.find((p) => p.id === currentPlayer.position);
    if (!square) return;

    const hasRolled = !!roll;
    const isOwned = game_properties.some((gp) => gp.property_id === square.id);
    const action = PROPERTY_ACTION(square.id);

    setBuyPrompted(false);

    const canBuy = hasRolled && !isOwned && action && ["land", "railway", "utility"].includes(action);

    if (canBuy && !hasActedOnCurrentLanding) {
      setBuyPrompted(true);

      const canAfford = square.price != null && currentPlayer.balance >= square.price;
      if (!canAfford) {
        showToast(`Not enough money to buy ${square.name}`, "error");
      }
    }
  }, [
    currentPlayer?.position,
    roll,
    properties,
    game_properties,
    currentPlayer?.balance,
    hasActedOnCurrentLanding,
    showToast
  ]);

  useEffect(() => {
    if (!isAITurn || !buyPrompted || !currentPlayer || !currentProperty || !buyScore) return;

    const timer = setTimeout(async () => {
      const shouldBuy = buyScore >= 60;

      if (shouldBuy) {
        showToast(`AI buys ${currentProperty.name} (${buyScore}%)`, "success");
        await BUY_PROPERTY();
      } else {
        showToast(`AI skips ${currentProperty.name} (${buyScore}%)`);
      }

      setTimeout(END_TURN, shouldBuy ? 1300 : 900);
    }, 1800);

    return () => clearTimeout(timer);
  }, [isAITurn, buyPrompted, currentPlayer, currentProperty, buyScore, BUY_PROPERTY, END_TURN, showToast]);

  useEffect(() => {
    if (!isAITurn || !roll || buyPrompted || actionLock) return;
    const timer = setTimeout(() => END_TURN(), 1500);
    return () => clearTimeout(timer);
  }, [isAITurn, roll, buyPrompted, actionLock, END_TURN]);

  useEffect(() => {
    if (!isMyTurn || !roll || buyPrompted || actionLock) return;

    const square = currentProperty;
    if (!square) return;

    const isOwned = game_properties.some(gp => gp.property_id === square.id);
    const action = PROPERTY_ACTION(square.id);
    const canBuy = !isOwned && action && ["land", "railway", "utility"].includes(action);

    if (!canBuy) {
      const timer = setTimeout(() => END_TURN(), 1200);
      return () => clearTimeout(timer);
    }
  }, [isMyTurn, roll, buyPrompted, actionLock, currentProperty, game_properties, END_TURN]);

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

  const handleBuyProperty = () => BUY_PROPERTY();

  const handleSkipBuy = () => {
    showToast("Skipped purchase");
    setBuyPrompted(false);
    setHasActedOnCurrentLanding(true);
    setTimeout(END_TURN, 800);
  };

  const handleDeclareBankruptcy = () => {
    showToast("Bankruptcy logic not fully implemented yet", "default");
  };

  // Early return guards (this is the correct place!)
  if (!game || !Array.isArray(properties) || properties.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white text-2xl">
        Loading game board...
      </div>
    );
  }

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
              isPending={isPending}
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