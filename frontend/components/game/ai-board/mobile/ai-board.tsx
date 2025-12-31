"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PropertyCardMobile from "../../cards/property-card-mobile";
import SpecialCard from "../../cards/special-card";
import CornerCard from "../../cards/corner-card";
import { getPlayerSymbol } from "@/lib/types/symbol";
import {
  Game,
  GameProperty,
  Property,
  Player,
  PROPERTY_ACTION,
} from "@/types/game";
import { apiClient } from "@/lib/api";
import { toast, Toaster } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useEndAiGame, useGetGameByCode } from "@/context/ContractProvider";

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

const BUILD_PRIORITY = ["orange", "red", "yellow", "pink", "lightblue", "green", "brown", "darkblue"];

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

  let score = 30;

  if (cash < price * 1.5) score -= 80;
  else if (cash < price * 2) score -= 40;
  else if (cash > price * 4) score += 35;
  else if (cash > price * 3) score += 15;

  const group = Object.values(MONOPOLY_STATS.colorGroups).find((g) => g.includes(property.id));
  if (group && !["railroad", "utility"].includes(property.color!)) {
    const owned = group.filter((id) =>
      gameProperties.find((gp) => gp.property_id === id)?.address === player.address
    ).length;

    if (owned === group.length - 1) score += 120;
    else if (owned === group.length - 2) score += 60;
    else if (owned >= 1) score += 25;
  }

  if (property.color === "railroad") {
    const owned = gameProperties.filter((gp) =>
      gp.address === player.address &&
      allProperties.find((p) => p.id === gp.property_id)?.color === "railroad"
    ).length;
    score += owned * 22;
  }
  if (property.color === "utility") {
    const owned = gameProperties.filter((gp) =>
      gp.address === player.address &&
      allProperties.find((p) => p.id === gp.property_id)?.type === "utility"
    ).length;
    score += owned * 28;
  }

  const rank = (MONOPOLY_STATS.landingRank as Record<number, number>)[property.id] ?? 25;
  score += 35 - rank;

  const roi = baseRent / price;
  if (roi > 0.14) score += 30;
  else if (roi > 0.10) score += 15;

  if (group && group.length <= 3) {
    const opponentOwns = group.filter((id) => {
      const gp = gameProperties.find((gp) => gp.property_id === id);
      return gp && gp.address !== player.address && gp.address !== null;
    }).length;

    if (opponentOwns === group.length - 1) score += 70;
  }

  return Math.max(0, Math.min(95, score));
};

const BOARD_SQUARES = 40;
const ROLL_ANIMATION_MS = 1200;
const MOVE_ANIMATION_MS_PER_SQUARE = 250;

const DiceFace = ({ value }: { value: number }) => {
  const dotPositions: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [28, 72], [72, 28], [72, 72]],
    5: [[28, 28], [28, 72], [50, 50], [72, 28], [72, 72]],
    6: [[28, 28], [28, 50], [28, 72], [72, 28], [72, 50], [72, 72]],
  };

  return (
    <>
      {dotPositions[value].map(([x, y], i) => (
        <div
          key={i}
          className="absolute w-5 h-5 bg-black rounded-full shadow-inner"
          style={{
            top: `${y}%`,
            left: `${x}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </>
  );
};

const getDiceValues = (): { die1: number; die2: number; total: number } | null => {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const total = die1 + die2;
  return total === 12 ? null : { die1, die2, total };
};

const isTopRow = (square: Property) => square.grid_row === 1;
const isBottomRow = (square: Property) => square.grid_row === 11;
const isLeftColumn = (square: Property) => square.grid_col === 1;
const isRightColumn = (square: Property) => square.grid_col === 11;

const JAIL_POSITION = 10;

const isAIPlayer = (player: Player | undefined): boolean =>
  player?.username?.toLowerCase().includes("ai_") ||
  player?.username?.toLowerCase().includes("bot") ||
  false;

const MobileGameLayout = ({
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
  const [currentGame, setCurrentGame] = useState<Game>(game);
  const [players, setPlayers] = useState<Player[]>(game?.players ?? []);
  const [currentGameProperties, setCurrentGameProperties] = useState<GameProperty[]>(game_properties);
  const [roll, setRoll] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [pendingRoll, setPendingRoll] = useState(0);
  const [actionLock, setActionLock] = useState<"ROLL" | "END" | null>(null);
  const [buyPrompted, setBuyPrompted] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [focusedProperty, setFocusedProperty] = useState<Property | null>(null);
  const [animatedPositions, setAnimatedPositions] = useState<Record<number, number>>({});
  const [hasMovementFinished, setHasMovementFinished] = useState(false);
  const [strategyRanThisTurn, setStrategyRanThisTurn] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const [showInsolvencyModal, setShowInsolvencyModal] = useState(false);
  const [insolvencyDebt, setInsolvencyDebt] = useState(0);
  const [isRaisingFunds, setIsRaisingFunds] = useState(false);

  const [winner, setWinner] = useState<Player | null>(null);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [endGameCandidate, setEndGameCandidate] = useState<{
    winner: Player | null;
    position: number;
    balance: bigint;
  }>({ winner: null, position: 0, balance: BigInt(0) });

  const [showCardModal, setShowCardModal] = useState(false);
  const [cardData, setCardData] = useState<{
    type: "chance" | "community";
    text: string;
    effect?: string;
    isGood: boolean;
  } | null>(null);
  const [cardPlayerName, setCardPlayerName] = useState("");

  const [showBankruptcyModal, setShowBankruptcyModal] = useState(false);

  const currentPlayerId = currentGame.next_player_id;
  const currentPlayer = players.find((p) => p.user_id === currentPlayerId);
  const isMyTurn = me?.user_id === currentPlayerId;
  const isAITurn = isAIPlayer(currentPlayer);

  const playerCanRoll = Boolean(
    isMyTurn && currentPlayer && (currentPlayer.balance ?? 0) > 0
  );

  const currentPlayerInJail = currentPlayer?.position === JAIL_POSITION && currentPlayer?.in_jail === true;

  const lastProcessed = useRef<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const rolledForPlayerId = useRef<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const landedPositionThisTurn = useRef<number | null>(null);
  const turnEndInProgress = useRef(false);
  const lastToastMessage = useRef<string | null>(null);
  const prevHistoryLength = useRef(game.history?.length ?? 0);

  const currentProperty = currentPlayer?.position
    ? properties.find(p => p.id === currentPlayer.position)
    : null;

  const justLandedProperty = useMemo(() => {
    if (landedPositionThisTurn.current === null) return null;
    return properties.find((p) => p.id === landedPositionThisTurn.current) ?? null;
  }, [landedPositionThisTurn.current, properties]);

  const buyScore = useMemo(() => {
    if (!isAITurn || !buyPrompted || !currentPlayer || !justLandedProperty) return null;
    return calculateBuyScore(justLandedProperty, currentPlayer, currentGameProperties, properties);
  }, [isAITurn, buyPrompted, currentPlayer, justLandedProperty, currentGameProperties, properties]);

  const {
    data: contractGame,
  } = useGetGameByCode(game.code, { enabled: !!game.code });

  const id = contractGame?.id;

  const {
    write: endGame,
    isPending,
    reset,
  } = useEndAiGame(
    Number(id),
    endGameCandidate.position,
    endGameCandidate.balance,
    !!endGameCandidate.winner
  );

  const showToast = useCallback((message: string, type: "success" | "error" | "default" = "default") => {
    if (message === lastToastMessage.current) return;
    lastToastMessage.current = message;

    toast.dismiss();
    if (type === "success") toast.success(message);
    else if (type === "error") toast.error(message);
    else toast(message, { icon: "➤" });
  }, []);

  useEffect(() => {
    if (currentGame?.players) setPlayers(currentGame.players);
  }, [currentGame?.players]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [currentGame.history?.length]);

  // Detect insolvency when balance <= 0 on my turn
  useEffect(() => {
    if (!isMyTurn || !currentPlayer) return;

    if (currentPlayer.balance <= 0 && !showInsolvencyModal && !isRaisingFunds) {
      setInsolvencyDebt(Math.abs(currentPlayer.balance));
      setShowInsolvencyModal(true);
      showToast(`You're broke! You owe $${Math.abs(currentPlayer.balance)}`, "error");
    }
  }, [currentPlayer?.balance, isMyTurn, showInsolvencyModal, isRaisingFunds, showToast]);

  // Winner detection
  useEffect(() => {
    const activePlayers = players.filter(p => p.balance > 0);

    if (activePlayers.length === 1 && currentGame.status !== "FINISHED" && !showInsolvencyModal) {
      const theWinner = activePlayers[0];
      setWinner(theWinner);
      setEndGameCandidate({
        winner: theWinner,
        position: theWinner.position ?? 0,
        balance: BigInt(Math.max(0, theWinner.balance)),
      });

      apiClient.put<ApiResponse>(`/games/${currentGame.id}`, {
        status: "FINISHED",
        winner_id: theWinner.user_id,
      }).catch(console.error);
    }
  }, [players, currentGame.id, currentGame.status, showInsolvencyModal]);

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
    setStrategyRanThisTurn(false);
    setIsRaisingFunds(false);
  }, [currentPlayerId]);

  const lockAction = useCallback((type: "ROLL" | "END") => {
    if (actionLock) return false;
    setActionLock(type);
    return true;
  }, [actionLock]);

  const unlockAction = useCallback(() => setActionLock(null), []);

  const fetchUpdatedGame = useCallback(async () => {
    try {
      const gameRes = await apiClient.get<ApiResponse<Game>>(`/games/code/${game.code}`);
      if (gameRes?.data?.success && gameRes.data.data) {
        setCurrentGame(gameRes.data.data);
        setPlayers(gameRes.data.data.players);
      }
      const propertiesRes = await apiClient.get<ApiResponse<GameProperty[]>>(`/game-properties/game/${game.id}`);
      if (propertiesRes?.data?.success && propertiesRes.data.data) {
        setCurrentGameProperties(propertiesRes.data.data);
      }
    } catch (err) {
      console.error("Sync failed:", err);
    }
  }, [game.code, game.id]);

  useEffect(() => {
    const interval = setInterval(fetchUpdatedGame, 3000);
    return () => clearInterval(interval);
  }, [fetchUpdatedGame]);

  const END_TURN = useCallback(async () => {
    if (!currentPlayerId || turnEndInProgress.current || !lockAction("END")) return;

    turnEndInProgress.current = true;

    try {
      await apiClient.post("/game-players/end-turn", {
        user_id: currentPlayerId,
        game_id: currentGame.id,
      });
      showToast("Turn ended", "success");
      await fetchUpdatedGame();
    } catch {
      showToast("Failed to end turn", "error");
    } finally {
      unlockAction();
      turnEndInProgress.current = false;
    }
  }, [currentPlayerId, currentGame.id, fetchUpdatedGame, lockAction, unlockAction, showToast]);

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
        game_id: currentGame.id,
        property_id: justLandedProperty.id,
      });

      showToast(isAiAction ? `AI bought ${justLandedProperty.name}!` : `You bought ${justLandedProperty.name}!`, "success");

      setBuyPrompted(false);
      landedPositionThisTurn.current = null;
      await fetchUpdatedGame();
      setTimeout(END_TURN, 800);
    } catch {
      showToast("Purchase failed", "error");
    }
  }, [currentPlayer, justLandedProperty, actionLock, END_TURN, showToast, currentGame.id, fetchUpdatedGame]);

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
      const playerId = forAI ? currentPlayerId! : me!.user_id;
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

          for (let i = 0; i < movePath.length; i++) {
            await new Promise((resolve) => setTimeout(resolve, MOVE_ANIMATION_MS_PER_SQUARE));
            setAnimatedPositions((prev) => ({
              ...prev,
              [playerId]: movePath[i],
            }));
          }
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
          game_id: currentGame.id,
          position: newPos,
          rolled: value.total + pendingRoll,
          is_double: value.die1 === value.die2,
        });

        setPendingRoll(0);
        landedPositionThisTurn.current = isInJail ? null : newPos;
        await fetchUpdatedGame();

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
    currentPlayerId, me, players, pendingRoll, currentGame.id,
    fetchUpdatedGame, showToast, END_TURN
  ]);

  useEffect(() => {
    if (!isAITurn || isRolling || actionLock || roll || rolledForPlayerId.current === currentPlayerId || !strategyRanThisTurn) return;
    const timer = setTimeout(() => ROLL_DICE(true), 1500);
    return () => clearTimeout(timer);
  }, [isAITurn, isRolling, actionLock, roll, currentPlayerId, ROLL_DICE, strategyRanThisTurn]);

  // Buy prompt logic
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

    const isOwned = currentGameProperties.some(gp => gp.property_id === pos);
    const action = PROPERTY_ACTION(pos);
    const isBuyableType = !!action && ["land", "railway", "utility"].includes(action);

    const canBuy = !isOwned && isBuyableType;

    setBuyPrompted(canBuy);

    // Fixed: parentheses around (currentPlayer?.balance ?? 0)
    if (canBuy && (currentPlayer?.balance ?? 0) < square.price) {
      showToast(`Not enough money to buy ${square.name}`, "error");
    }
  }, [
    roll,
    landedPositionThisTurn.current,
    hasMovementFinished,
    currentGameProperties,
    properties,
    currentPlayer,
    showToast
  ]);

  // Card detection
  useEffect(() => {
    const history = currentGame.history ?? [];
    if (history.length <= prevHistoryLength.current) return;

    const newEntry = history[history.length - 1];
    prevHistoryLength.current = history.length;

    if (newEntry == null || typeof newEntry !== "string") return;

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
  }, [currentGame.history]);

  // AI buy decision
  useEffect(() => {
    if (!isAITurn || !buyPrompted || !currentPlayer || !justLandedProperty || buyScore === null) return;

    const timer = setTimeout(async () => {
      const shouldBuy =
        buyScore >= 72 &&
        (currentPlayer.balance ?? 0) > justLandedProperty.price * 1.8;

      if (shouldBuy) {
        showToast(`AI bought ${justLandedProperty.name} (score: ${buyScore}%)`, "success");
        await BUY_PROPERTY(true);
      } else {
        showToast(`AI passed on ${justLandedProperty.name} (score: ${buyScore}%)`, "default");
        setTimeout(END_TURN, 900);
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [isAITurn, buyPrompted, currentPlayer, justLandedProperty, buyScore, BUY_PROPERTY, END_TURN, showToast]);

  // Auto-end turn
  useEffect(() => {
    if (actionLock || isRolling || buyPrompted || !roll) return;

    const timer = setTimeout(() => {
      END_TURN();
    }, isAITurn ? 1000 : 1200);

    return () => clearTimeout(timer);
  }, [roll, buyPrompted, isRolling, actionLock, isAITurn, END_TURN]);

  // ── AI STRATEGY HELPERS ─────────────────────────────────────

  const getPlayerOwnedProperties = (playerAddress: string | undefined, gameProperties: GameProperty[], properties: Property[]) => {
    if (!playerAddress) return [];
    return gameProperties
      .filter(gp => gp.address?.toLowerCase() === playerAddress.toLowerCase())
      .map(gp => ({
        gp,
        prop: properties.find(p => p.id === gp.property_id)!,
      }))
      .filter(item => !!item.prop);
  };

  const getCompleteMonopolies = (playerAddress: string | undefined, gameProperties: GameProperty[], properties: Property[]) => {
    if (!playerAddress) return [];

    const owned = getPlayerOwnedProperties(playerAddress, gameProperties, properties);
    const monopolies: string[] = [];

    Object.entries(MONOPOLY_STATS.colorGroups).forEach(([groupName, ids]) => {
      if (groupName === "railroad" || groupName === "utility") return;

      const ownedInGroup = owned.filter(o => ids.includes(o.prop.id));
      if (ownedInGroup.length === ids.length) {
        const allUnmortgaged = ownedInGroup.every(o => !o.gp.mortgaged);
        if (allUnmortgaged) {
          monopolies.push(groupName);
        }
      }
    });

    return monopolies.sort((a, b) => BUILD_PRIORITY.indexOf(a) - BUILD_PRIORITY.indexOf(b));
  };

  const getNearCompleteOpportunities = (playerAddress: string | undefined, gameProperties: GameProperty[], properties: Property[]) => {
    if (!playerAddress) return [];

    const owned = getPlayerOwnedProperties(playerAddress, gameProperties, properties);
    const opportunities: {
      group: string;
      needs: number;
      missing: { id: number; name: string; ownerAddress: string | null; ownerName: string }[];
    }[] = [];

    Object.entries(MONOPOLY_STATS.colorGroups).forEach(([groupName, ids]) => {
      if (groupName === "railroad" || groupName === "utility") return;

      const ownedCount = owned.filter(o => ids.includes(o.prop.id)).length;
      const needs = ids.length - ownedCount;

      if (needs === 1 || needs === 2) {
        const missing = ids
          .filter(id => !owned.some(o => o.prop.id === id))
          .map(id => {
            const gp = gameProperties.find(g => g.property_id === id);
            const prop = properties.find(p => p.id === id)!;
            const ownerName = gp?.address
              ? players.find(p => p.address?.toLowerCase() === gp.address?.toLowerCase())?.username || gp.address.slice(0, 8)
              : "Bank";
            return {
              id,
              name: prop.name,
              ownerAddress: gp?.address || null,
              ownerName,
            };
          });

        opportunities.push({ group: groupName, needs, missing });
      }
    });

    return opportunities.sort((a, b) => {
      if (a.needs !== b.needs) return a.needs - b.needs;
      return BUILD_PRIORITY.indexOf(a.group) - BUILD_PRIORITY.indexOf(b.group);
    });
  };

  const calculateTradeFavorability = (
    trade: { offer_properties: number[]; offer_amount: number; requested_properties: number[]; requested_amount: number },
    receiverAddress: string
  ) => {
    let score = 0;

    score += trade.offer_amount - trade.requested_amount;

    trade.requested_properties.forEach(id => {
      const prop = properties.find(p => p.id === id);
      if (!prop) return;
      score += prop.price || 0;

      const group = Object.values(MONOPOLY_STATS.colorGroups).find(g => g.includes(id));
      if (group && !["railroad", "utility"].includes(prop.color!)) {
        const currentOwned = group.filter(gid =>
          currentGameProperties.find(gp => gp.property_id === gid && gp.address === receiverAddress)
        ).length;
        if (currentOwned === group.length - 1) score += 300;
        else if (currentOwned === group.length - 2) score += 120;
      }
    });

    trade.offer_properties.forEach(id => {
      const prop = properties.find(p => p.id === id);
      if (!prop) return;
      score -= (prop.price || 0) * 1.3;
    });

    return score;
  };

  const calculateFairCashOffer = (propertyId: number, completesSet: boolean, basePrice: number) => {
    return completesSet ? Math.floor(basePrice * 1.6) : Math.floor(basePrice * 1.3);
  };

  const getPropertyToOffer = (playerAddress: string, excludeGroups: string[] = []) => {
    const owned = getPlayerOwnedProperties(playerAddress, currentGameProperties, properties);
    const candidates = owned.filter(o => {
      const group = Object.keys(MONOPOLY_STATS.colorGroups).find(g =>
        MONOPOLY_STATS.colorGroups[g as keyof typeof MONOPOLY_STATS.colorGroups].includes(o.prop.id)
      );
      if (!group || excludeGroups.includes(group)) return false;
      if (o.gp.development! > 0) return false;
      return true;
    });

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => (a.prop.price || 0) - (b.prop.price || 0));
    return candidates[0];
  };

  const handleAiBuilding = async (player: Player) => {
    if (!player.address) return;

    const monopolies = getCompleteMonopolies(player.address, currentGameProperties, properties);
    if (monopolies.length === 0) return;

    let built = false;

    for (const groupName of monopolies) {
      const ids = MONOPOLY_STATS.colorGroups[groupName as keyof typeof MONOPOLY_STATS.colorGroups];
      const groupGps = currentGameProperties.filter(gp => ids.includes(gp.property_id) && gp.address === player.address);

      const developments = groupGps.map(gp => gp.development ?? 0);
      const minHouses = Math.min(...developments);
      const maxHouses = Math.max(...developments);

      if (maxHouses > minHouses + 1 || minHouses >= 5) continue;

      const prop = properties.find(p => ids.includes(p.id))!;
      const houseCost = prop.cost_of_house ?? 0;
      if (houseCost === 0) continue;

      const affordable = Math.floor((player.balance ?? 0) / houseCost);
      if (affordable < ids.length) continue;

      for (const gp of groupGps.filter(g => (g.development ?? 0) === minHouses)) {
        try {
          await apiClient.post("/game-properties/development", {
            game_id: currentGame.id,
            user_id: player.user_id,
            property_id: gp.property_id,
          });
          showToast(`AI built on ${prop.name} (${groupName})`, "success");
          built = true;
          await fetchUpdatedGame();
          await new Promise(r => setTimeout(r, 600));
        } catch (err) {
          console.error("Build failed", err);
          break;
        }
      }

      if (built) break;
    }
  };

  const refreshGame = async () => {
    await fetchUpdatedGame();
  };

  const handleAiStrategy = async () => {
    if (!currentPlayer || !isAITurn || strategyRanThisTurn) return;

    showToast(`${currentPlayer.username} is thinking... 🧠`, "default");

    const opportunities = getNearCompleteOpportunities(currentPlayer.address, currentGameProperties, properties);
    let maxTradeAttempts = 1;

    for (const opp of opportunities) {
      if (maxTradeAttempts <= 0) break;

      for (const missing of opp.missing) {
        if (!missing.ownerAddress || missing.ownerAddress === "bank") continue;

        const targetPlayer = players.find(p => p.address?.toLowerCase() === missing.ownerAddress?.toLowerCase());
        if (!targetPlayer) continue;

        const basePrice = properties.find(p => p.id === missing.id)?.price || 200;
        const cashOffer = calculateFairCashOffer(missing.id, opp.needs === 1, basePrice);

        let offerProperties: number[] = [];
        if ((currentPlayer.balance ?? 0) < cashOffer + 300) {
          const toOffer = getPropertyToOffer(currentPlayer.address!, [opp.group]);
          if (toOffer) {
            offerProperties = [toOffer.prop.id];
            showToast(`AI offering ${toOffer.prop.name} in deal`, "default");
          }
        }

        const payload = {
          game_id: currentGame.id,
          player_id: currentPlayer.user_id,
          target_player_id: targetPlayer.user_id,
          offer_properties: offerProperties,
          offer_amount: cashOffer,
          requested_properties: [missing.id],
          requested_amount: 0,
        };

        try {
          const res = await apiClient.post<ApiResponse>("/game-trade-requests", payload);
          if (res?.data?.success) {
            showToast(`AI offered $${cashOffer}${offerProperties.length ? " + property" : ""} for ${missing.name}`, "default");
            maxTradeAttempts--;

            if (isAIPlayer(targetPlayer)) {
              await new Promise(r => setTimeout(r, 800));
              const favorability = calculateTradeFavorability(
                { ...payload, requested_amount: 0 },
                targetPlayer.address!
              );

              if (favorability >= 50) {
                await apiClient.post("/game-trade-requests/accept", { id: res.data.data.id });
                showToast(`${targetPlayer.username} accepted deal! 🤝`, "success");
                await refreshGame();
              } else {
                await apiClient.post("/game-trade-requests/decline", { id: res.data.data.id });
                showToast(`${targetPlayer.username} declined`, "default");
              }
            } else {
              showToast(`Trade proposed to ${targetPlayer.username}`, "default");
            }
          }
        } catch (err) {
          console.error("Trade failed", err);
        }

        await new Promise(r => setTimeout(r, 1200));
      }
    }

    await handleAiBuilding(currentPlayer);
    setStrategyRanThisTurn(true);
    showToast(`${currentPlayer.username} ready to roll`, "default");
  };

  // Run AI strategy at start of turn
  useEffect(() => {
    if (isAITurn && currentPlayer && !strategyRanThisTurn) {
      const timer = setTimeout(handleAiStrategy, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAITurn, currentPlayer, strategyRanThisTurn]);

  const playersByPosition = useMemo(() => {
    const map = new Map<number, Player[]>();
    players.forEach((p) => {
      if (p.balance <= 0) return; // Hide bankrupt/broke players on board
      const pos = animatedPositions[p.user_id] !== undefined ? animatedPositions[p.user_id] : (p.position ?? 0);
      if (!map.has(pos)) map.set(pos, []);
      map.get(pos)!.push(p);
    });
    return map;
  }, [players, animatedPositions]);

  const propertyOwner = (id: number) => {
    const gp = currentGameProperties.find((gp) => gp.property_id === id);
    return gp ? players.find((p) => p.address === gp.address)?.username || null : null;
  };

  const developmentStage = (id: number) =>
    currentGameProperties.find((gp) => gp.property_id === id)?.development ?? 0;

  const isPropertyMortgaged = (id: number) =>
    currentGameProperties.find((gp) => gp.property_id === id)?.mortgaged === true;

  useEffect(() => {
    if (boardRef.current && currentProperty) {
      const squareElement = boardRef.current.querySelector(`[data-position="${currentProperty.id}"]`);
      if (squareElement) {
        squareElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    }
  }, [currentProperty]);

  const handleExitAttempt = (shouldTryFinalize: boolean) => {
    if (!endGameCandidate.winner) {
      window.location.href = "/";
      return;
    }

    if (shouldTryFinalize) {
      setShowExitPrompt(true);
    } else {
      window.location.href = "/";
    }
  };

  const handleFinalizeAndLeave = async () => {
    setShowExitPrompt(false);

    const toastId = toast.loading(
      winner?.user_id === me?.user_id
        ? "Claiming your prize..."
        : "Finalizing game results..."
    );

    try {
      await endGame();

      toast.success(
        winner?.user_id === me?.user_id
          ? "Prize claimed! 🎉"
          : "Game completed — thanks for playing!",
        { id: toastId, duration: 5000 }
      );

      setTimeout(() => {
        window.location.href = "/";
      }, 1500);

    } catch (err: any) {
      toast.error(
        err?.message || "Something went wrong — you can try again later",
        { id: toastId, duration: 8000 }
      );
    } finally {
      reset();
    }
  };

  const handleRaiseFunds = () => {
    setShowInsolvencyModal(false);
    setIsRaisingFunds(true);
    showToast("Raise funds (mortgage, sell houses, trade) then click 'Try Again'", "default");
  };

  const handleDeclareBankruptcy = async () => {
    setShowInsolvencyModal(false);
    setIsRaisingFunds(false);
    showToast("Declaring bankruptcy...", "default");

    try {
      if (endGame) await endGame();

      const opponent = players.find(p => p.user_id !== me?.user_id);
      await apiClient.put(`/games/${currentGame.id}`, {
        status: "FINISHED",
        winner_id: opponent?.user_id || null,
      });

      showToast("Game over! You have declared bankruptcy.", "error");
      setShowBankruptcyModal(true);
    } catch (err) {
      showToast("Failed to end game", "error");
    }
  };

 const handleRetryAfterFunds = () => {
  fetchUpdatedGame(); // Refresh state

  if (!currentPlayer) {
    showToast("Current player not found", "error");
    return;
  }

  if (currentPlayer.balance > 0) {
    setIsRaisingFunds(false);
    showToast("Funds raised successfully! Your turn continues.", "success");
  } else {
    showToast("Still not enough money. Raise more or declare bankruptcy.", "error");
    setShowInsolvencyModal(true);
  }
};

  // NEW: Property action handlers
  const handleDevelopment = async (id: number) => {
    if (!isMyTurn || !me) return;
    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/development", {
        game_id: currentGame.id,
        user_id: me.user_id,
        property_id: id,
      });
      if (res?.data?.success) toast.success("Property developed successfully");
      await fetchUpdatedGame();
    } catch (error: any) {
      toast.error(error?.message || "Failed to develop property");
    }
  };

  const handleDowngrade = async (id: number) => {
    if (!isMyTurn || !me) return;
    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/downgrade", {
        game_id: currentGame.id,
        user_id: me.user_id,
        property_id: id,
      });
      if (res?.data?.success) toast.success("Property downgraded successfully");
      else toast.error(res.data?.message ?? "Failed to downgrade property");
      await fetchUpdatedGame();
    } catch (error: any) {
      toast.error(error?.message || "Failed to downgrade property");
    }
  };

  const handleMortgage = async (id: number) => {
    if (!isMyTurn || !me) return;
    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/mortgage", {
        game_id: currentGame.id,
        user_id: me.user_id,
        property_id: id,
      });
      if (res?.data?.success) toast.success("Property mortgaged successfully");
      else toast.error(res.data?.message ?? "Failed to mortgage property");
      await fetchUpdatedGame();
    } catch (error: any) {
      toast.error(error?.message || "Failed to mortgage property");
    }
  };

  const handleUnmortgage = async (id: number) => {
    if (!isMyTurn || !me) return;
    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/unmortgage", {
        game_id: currentGame.id,
        user_id: me.user_id,
        property_id: id,
      });
      if (res?.data?.success) toast.success("Property unmortgaged successfully");
      else toast.error(res.data?.message ?? "Failed to unmortgage property");
      await fetchUpdatedGame();
    } catch (error: any) {
      toast.error(error?.message || "Failed to unmortgage property");
    }
  };

  // Handle board property click
  const handlePropertyClick = (square: Property) => {
    const gp = currentGameProperties.find(gp => gp.property_id === square.id);
    if (gp?.address === me?.address) {
      setSelectedProperty(square);
    } else {
      showToast("You don't own this property", "error");
    }
  };

  // Handle property transfer (from desktop)
  const handlePropertyTransfer = async (propertyId: number, newPlayerId: number) => {
    if (!propertyId || !newPlayerId) {
      toast("Cannot transfer: missing property or player");
      return;
    }

    try {
      const response = await apiClient.put<ApiResponse>(
        `/game-properties/${propertyId}`,
        {
          game_id: currentGame.id,
          player_id: newPlayerId,
        }
      );

      if (response.data?.success) {
        toast.success("Property transferred successfully! 🎉");
        await fetchUpdatedGame();
      } else {
        throw new Error(response.data?.message || "Transfer failed");
      }
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.message ||
        "Failed to transfer property";

      toast.error(message);
      console.error("Property transfer failed:", error);
    }
  };

  // ── PERKS FUNCTIONS ─────────────────────────────────────
  const handleCashPerk = async (id: number, amount: number) => {
    if (!me) return;
    try {
      const res = await apiClient.put<ApiResponse>(`/game-players/${id}`, {
        game_id: currentGame.id,
        user_id: me.user_id,
        balance: me.balance + amount,
      });
      if (res?.data?.success) toast.success("Cash perk applied successfully");
      await fetchUpdatedGame();
    } catch (error: any) {
      toast.error(error?.message || "Failed to apply cash perk");
    }
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white flex flex-col items-center justify-start relative overflow-hidden">
      <button
        onClick={fetchUpdatedGame}
        className="fixed top-4 right-4 z-50 bg-blue-500 text-white text-xs px-2 py-1 rounded-full hover:bg-blue-600 transition"
      >
        Refresh
      </button>

      {/* Winner / Game Over Screen */}
      <AnimatePresence>
        {winner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.8, rotate: -5 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className={`p-10 rounded-3xl shadow-2xl text-center max-w-lg w-full border-8 ${
                winner.user_id === me?.user_id
                  ? "bg-gradient-to-br from-yellow-600 to-orange-600 border-yellow-400"
                  : "bg-gradient-to-br from-gray-800 to-gray-900 border-gray-600"
              }`}
            >
              {winner.user_id === me?.user_id ? (
                <>
                  <h1 className="text-5xl font-bold mb-6 drop-shadow-2xl">🏆 YOU WIN! 🏆</h1>
                  <p className="text-3xl font-bold text-white mb-6">
                    Congratulations, Champion!
                  </p>
                  <p className="text-xl text-yellow-200 mb-10">
                    You're the Tycoon of this game!
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-4xl font-bold mb-6 text-gray-300">Game Over</h1>
                  <p className="text-2xl font-bold text-white mb-6">
                    {winner.username} is the winner!
                  </p>
                  <p className="text-lg text-gray-300 mb-10">
                    Better luck next time — you played well!
                  </p>
                </>
              )}

              <div className="flex justify-center">
                <button
                  onClick={() => handleExitAttempt(true)}
                  className="px-12 py-5 bg-gradient-to-r from-cyan-500 to-purple-600 text-white text-xl md:text-2xl font-bold rounded-2xl shadow-2xl hover:shadow-cyan-500/50 hover:scale-105 transition-all duration-300 border-4 border-white/40"
                >
                  {winner.user_id === me?.user_id ? "Claim Rewards" : "Finish Game"}
                </button>
              </div>

              <p className="text-base text-yellow-200/80 mt-8 opacity-90">
                Thanks for playing Tycoon!
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exit Confirmation Prompt */}
      <AnimatePresence>
        {showExitPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-3xl max-w-md w-full text-center border border-cyan-500/30 shadow-2xl"
            >
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-5">
                One last thing!
              </h2>

              {winner?.user_id === me?.user_id ? (
                <p className="text-lg md:text-xl text-cyan-300 mb-6">
                  Finalize the game to claim your rewards.
                </p>
              ) : (
                <p className="text-lg md:text-xl text-gray-300 mb-6">
                  Finalize the game to wrap things up.
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleFinalizeAndLeave}
                  disabled={isPending}
                  className="px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition disabled:opacity-50"
                >
                  {isPending ? "Processing..." : "Yes, Finish Game"}
                </button>

                <button
                  onClick={() => {
                    setShowExitPrompt(false);
                    setTimeout(() => window.location.href = "/", 300);
                  }}
                  className="px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition"
                >
                  Skip & Leave
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Insolvency Modal */}
      <AnimatePresence>
        {showInsolvencyModal && isMyTurn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-3xl max-w-md w-full text-center border border-red-500/50 shadow-2xl"
            >
              <h2 className="text-4xl font-bold text-red-400 mb-6">You're Broke!</h2>
              <p className="text-xl text-white mb-8">
                You owe <span className="text-yellow-400 font-bold">${insolvencyDebt}</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <button
                  onClick={handleRaiseFunds}
                  className="px-10 py-5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xl rounded-2xl shadow-xl hover:scale-105 transition-all"
                >
                  Raise Funds & Retry
                </button>
                <button
                  onClick={handleDeclareBankruptcy}
                  className="px-10 py-5 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold text-xl rounded-2xl shadow-xl hover:scale-105 transition-all"
                >
                  Declare Bankruptcy
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bankruptcy Modal */}
      <AnimatePresence>
        {showBankruptcyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-3xl max-w-md w-full text-center border border-red-500/50 shadow-2xl"
            >
              <h2 className="text-4xl font-bold text-red-400 mb-6">Bankruptcy Declared!</h2>
              <p className="text-xl text-white mb-8">Game over. Better luck next time!</p>
              <button
                onClick={() => window.location.href = "/"}
                className="px-10 py-5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xl rounded-2xl shadow-xl hover:scale-105 transition-all"
              >
                Return Home
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card Modal */}
      <AnimatePresence>
        {showCardModal && cardData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-3xl max-w-md w-full text-center border border-cyan-500/30 shadow-2xl"
            >
              <h2 className="text-2xl font-bold text-white mb-4">{cardData.type.toUpperCase()} Card</h2>
              <p className="text-lg text-gray-300 mb-4">{cardPlayerName} drew:</p>
              <p className={`text-xl font-bold ${cardData.isGood ? "text-green-400" : "text-red-400"}`}>{cardData.text}</p>
              {cardData.effect && <p className="text-lg text-yellow-400 mt-2">Effect: {cardData.effect}</p>}
              <button
                onClick={() => setShowCardModal(false)}
                className="mt-6 px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Property Action Modal */}
      <AnimatePresence>
        {selectedProperty && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-3xl max-w-md w-full text-center border border-cyan-500/30 shadow-2xl"
            >
              <h2 className="text-2xl font-bold text-white mb-4">{selectedProperty.name}</h2>
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => { handleDevelopment(selectedProperty.id); setSelectedProperty(null); }}
                  className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition"
                >
                  Develop
                </button>
                <button
                  onClick={() => { handleDowngrade(selectedProperty.id); setSelectedProperty(null); }}
                  className="px-8 py-4 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-xl transition"
                >
                  Downgrade
                </button>
                <button
                  onClick={() => { handleMortgage(selectedProperty.id); setSelectedProperty(null); }}
                  className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition"
                >
                  Mortgage
                </button>
                <button
                  onClick={() => { handleUnmortgage(selectedProperty.id); setSelectedProperty(null); }}
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition"
                >
                  Unmortgage
                </button>
                <button
                  onClick={() => setSelectedProperty(null)}
                  className="px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent "I've Raised Funds" Button */}
      {isRaisingFunds && isMyTurn && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[65] w-[80vw] max-w-md"
        >
          <button
            onClick={handleRetryAfterFunds}
            className="w-full py-4 bg-gradient-to-r from-yellow-500 to-amber-600 text-white font-bold text-lg rounded-full shadow-2xl hover:from-yellow-600 hover:to-amber-700 transform hover:scale-105 active:scale-95 transition-all"
          >
            I've Raised Funds — Try Again
          </button>
        </motion.div>
      )}

      <div ref={boardRef} className="w-full max-w-[95vw] max-h-[60vh] overflow-auto touch-pinch-zoom touch-pan-x touch-pan-y aspect-square relative shadow-2xl shadow-cyan-500/10 mt-4">
        <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[1px] box-border scale-90 sm:scale-100">
          <div className="col-start-2 col-span-9 row-start-2 row-span-9 bg-[#010F10] flex flex-col justify-center items-center p-2 relative overflow-hidden">
            <AnimatePresence>
              {isRolling && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute inset-0 flex items-center justify-center gap-8 z-20 pointer-events-none"
                >
                  <motion.div
                    animate={{ rotateX: [0, 360, 720, 1080], rotateY: [0, 360, -360, 720] }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="relative w-20 h-20 bg-white rounded-xl shadow-2xl border-2 border-gray-800"
                    style={{ boxShadow: "0 15px 30px rgba(0,0,0,0.7), inset 0 5px 10px rgba(255,255,255,0.5)" }}
                  >
                    {roll ? <DiceFace value={roll.die1} /> : <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.3, repeat: Infinity, ease: "linear" }} className="flex h-full items-center justify-center text-4xl font-bold text-gray-400">?</motion.div>}
                  </motion.div>
                  <motion.div
                    animate={{ rotateX: [0, -720, 360, 1080], rotateY: [0, -360, 720, -360] }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                    className="relative w-20 h-20 bg-white rounded-xl shadow-2xl border-2 border-gray-800"
                    style={{ boxShadow: "0 15px 30px rgba(0,0,0,0.7), inset 0 5px 10px rgba(255,255,255,0.5)" }}
                  >
                    {roll ? <DiceFace value={roll.die2} /> : <motion.div animate={{ rotate: -360 }} transition={{ duration: 0.3, repeat: Infinity, ease: "linear" }} className="flex h-full items-center justify-center text-4xl font-bold text-gray-400">?</motion.div>}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {roll && !isRolling && (
              <motion.div
                initial={{ scale: 0, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                className="flex items-center gap-4 text-5xl font-bold mb-2"
              >
                <span className="text-cyan-400 drop-shadow-2xl">{roll.die1}</span>
                <span className="text-white text-4xl">+</span>
                <span className="text-pink-400 drop-shadow-2xl">{roll.die2}</span>
                <span className="text-white mx-2 text-4xl">=</span>
                <span className="text-yellow-400 text-6xl drop-shadow-2xl">{roll.total}</span>
              </motion.div>
            )}

            <h1 className="text-2xl font-bold text-[#F0F7F7] font-orbitron text-center mb-4 z-10">
              Tycoon
            </h1>

            {isAITurn && (
              <div className="mt-2 text-center z-10">
                <motion.h2
                  className="text-lg font-bold text-pink-300 mb-2"
                  animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.05, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  {currentPlayer?.username} is playing…
                </motion.h2>
                {buyPrompted && buyScore !== null && (
                  <p className="text-sm text-yellow-300 font-bold">
                    Buy Confidence: {buyScore}%
                  </p>
                )}
                <div className="flex justify-center mt-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-400"></div>
                </div>
                <p className="text-pink-200 text-xs italic mt-2">
                  {currentPlayer?.username} • Decides automatically
                </p>
              </div>
            )}
          </div>

          {properties.map((square) => {
            const playersHere = playersByPosition.get(square.id) ?? [];
            const devLevel = developmentStage(square.id);
            const mortgaged = isPropertyMortgaged(square.id);

            let devPositionClass = "";
            if (isTopRow(square)) devPositionClass = "bottom-1 left-1/2 -translate-x-1/2";
            else if (isBottomRow(square)) devPositionClass = "top-1 left-1/2 -translate-x-1/2";
            else if (isLeftColumn(square)) devPositionClass = "top-1/2 -translate-y-1/2 right-1";
            else if (isRightColumn(square)) devPositionClass = "top-1/2 -translate-y-1/2 left-1";
            else devPositionClass = "top-0.5 right-0.5";

            return (
              <motion.div
                key={square.id}
                data-position={square.id}
                style={{
                  gridRowStart: square.grid_row,
                  gridColumnStart: square.grid_col,
                }}
                className="w-full h-full p-[1px] relative box-border group hover:z-10 transition-transform duration-200"
                whileHover={{ scale: 1.5, zIndex: 50 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                onClick={() => handlePropertyClick(square)}
              >
                <div className={`w-full h-full transform group-hover:scale-150 ${isTopRow(square) ? 'origin-top group-hover:origin-bottom group-hover:translate-y-[50px]' : ''} group-hover:shadow-lg group-hover:shadow-cyan-500/50 transition-transform duration-200 rounded-sm overflow-hidden bg-black/20 p-0.5 relative`}>
                  {square.type === "property" && <PropertyCardMobile square={square} owner={propertyOwner(square.id)} />}
                  {["community_chest", "chance", "luxury_tax", "income_tax"].includes(square.type) && <SpecialCard square={square} />}
                  {square.type === "corner" && <CornerCard square={square} />}

                  {square.type === "property" && devLevel > 0 && (
                    <div className={`absolute ${devPositionClass} z-20 bg-yellow-500 text-black text-xs font-bold rounded-full w-7 h-7 flex items-center justify-center shadow-lg`}>
                      {devLevel === 5 ? "🏨" : devLevel}
                    </div>
                  )}

                  {mortgaged && (
                    <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center z-30 pointer-events-none rounded-sm">
                      <span className="text-white text-xs font-bold rotate-12 tracking-wider drop-shadow-2xl px-2 py-1 bg-red-800/80 rounded">
                        MORTGAGED
                      </span>
                    </div>
                  )}

                  {mortgaged && (
                    <div className="absolute inset-0 bg-black/60 z-10 pointer-events-none rounded-sm" />
                  )}

                  <div className="absolute bottom-0.5 left-0.5 flex flex-col gap-1 z-40 pointer-events-none">
                    {playersHere.map((p) => {
                      const isCurrentPlayer = p.user_id === currentGame.next_player_id;
                      return (
                        <motion.span
                          key={p.user_id}
                          title={`${p.username} ($${p.balance})`}
                          className={`text-xl border-2 rounded-full ${isCurrentPlayer ? 'border-cyan-300 shadow-lg shadow-cyan-400/50' : 'border-gray-600'}`}
                          initial={{ scale: 1 }}
                          animate={{
                            y: isCurrentPlayer ? [0, -4, 0] : [0, -2, 0],
                            scale: isCurrentPlayer ? [1, 1.1, 1] : 1,
                          }}
                          transition={{
                            y: { duration: isCurrentPlayer ? 1.2 : 2, repeat: Infinity, ease: "easeInOut" },
                            scale: { duration: isCurrentPlayer ? 1.2 : 0, repeat: Infinity },
                          }}
                          whileHover={{ scale: 1.2, y: -2 }}
                        >
                          {getPlayerSymbol(p.symbol)}
                        </motion.span>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="w-full max-w-[95vw] flex flex-col items-center p-4 gap-4">
        {isMyTurn && !roll && !isRolling && !isRaisingFunds && !showInsolvencyModal && (
          <button
            onClick={() => ROLL_DICE(false)}
            disabled={isRolling}
            className="w-[80vw] py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-lg rounded-full hover:from-green-600 hover:to-emerald-700 transform hover:scale-105 active:scale-95 transition-all disabled:opacity-50 shadow-xl"
          >
            {isRolling ? "Rolling..." : "Roll Dice"}
          </button>
        )}

        <div className="w-full bg-gray-900/95 backdrop-blur-md rounded-xl border border-cyan-500/30 shadow-2xl overflow-hidden">
          <button 
            onClick={() => setShowLog(!showLog)}
            className="w-full p-3 border-b border-cyan-500/20 bg-gray-800/80 flex justify-between items-center"
          >
            <h3 className="text-sm font-bold text-cyan-300 tracking-wider">Action Log</h3>
            <span>{showLog ? '▲' : '▼'}</span>
          </button>
          {showLog && (
            <div ref={logRef} className="max-h-32 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-thin scrollbar-thumb-cyan-600">
              {(!currentGame.history || currentGame.history.length === 0) ? (
                <p className="text-center text-gray-500 text-xs italic py-4">No actions yet</p>
              ) : (
                currentGame.history.slice(-5).reverse().map((h, i) => (
                  <motion.p 
                    key={i} 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="text-xs text-gray-300"
                  >
                    <span className="font-medium text-cyan-200">{h.player_name}</span> {h.comment}
                    {h.rolled && <span className="text-cyan-400 font-bold ml-1">[Rolled {h.rolled}]</span>}
                  </motion.p>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Buy Prompt */}
      <AnimatePresence>
        {isMyTurn && buyPrompted && justLandedProperty && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 20 }}
            className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-md p-4 rounded-t-2xl shadow-2xl z-[60] flex flex-col items-center gap-4"
          >
            <h3 className="text-lg font-bold text-white">Buy {justLandedProperty.name}?</h3>
            <p className="text-sm text-gray-300">Price: ${justLandedProperty.price}</p>
            <div className="flex gap-4 w-full justify-center">
              <button
                onClick={() => BUY_PROPERTY(false)}
                className="flex-1 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-full hover:from-green-600 hover:to-emerald-700 transform hover:scale-105 active:scale-95 transition-all shadow-lg"
              >
                Buy
              </button>
              <button
                onClick={() => {
                  showToast("Skipped purchase");
                  setBuyPrompted(false);
                  landedPositionThisTurn.current = null;
                  setTimeout(END_TURN, 800);
                }}
                className="flex-1 py-3 bg-gray-600 text-white font-bold rounded-full hover:bg-gray-700 transform hover:scale-105 active:scale-95 transition-all shadow-lg"
              >
                Skip
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Property Detail Modal */}
      <AnimatePresence>
        {focusedProperty && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
            onClick={() => setFocusedProperty(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-lg w-full bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl border border-cyan-500/40 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setFocusedProperty(null)}
                className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-2xl hover:bg-black/70 transition"
              >
                ×
              </button>

              <div className="p-6 pt-12">
                {["community_chest", "chance", "luxury_tax", "income_tax"].includes(focusedProperty.type) && (
                  <SpecialCard square={focusedProperty} />
                )}
                {focusedProperty.type === "corner" && (
                  <CornerCard square={focusedProperty} />
                )}
                {focusedProperty.type === "property" && (
                  <PropertyCardMobile square={focusedProperty} owner={propertyOwner(focusedProperty.id)} />
                )}
              </div>

              <div className="px-6 pb-6 text-center space-y-2">
                <p className="text-2xl font-bold">{focusedProperty.name}</p>
                {propertyOwner(focusedProperty.id) ? (
                  <p className="text-lg text-cyan-300">
                    Owner: {propertyOwner(focusedProperty.id)}
                  </p>
                ) : (
                  <p className="text-lg text-gray-400">Available for purchase</p>
                )}
                {focusedProperty.price && (
                  <p className="text-lg">Price: <span className="text-yellow-400 font-bold">${focusedProperty.price}</span></p>
                )}
                {focusedProperty.type === "property" && developmentStage(focusedProperty.id) > 0 && (
                  <p className="text-lg">
                    Development: {developmentStage(focusedProperty.id) === 5 ? "Hotel" : `${developmentStage(focusedProperty.id)} Houses`}
                  </p>
                )}
                {isPropertyMortgaged(focusedProperty.id) && (
                  <p className="text-lg text-red-400 font-bold animate-pulse">MORTGAGED</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
            padding: "8px 16px",
            fontSize: "14px",
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

export default MobileGameLayout;