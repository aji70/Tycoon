"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useGetGameByCode, useExitGame } from "@/context/ContractProvider";
import { Game, GameProperty, Property, Player, PROPERTY_ACTION } from "@/types/game";
import { useGameTrades } from "@/hooks/useGameTrades";

import Board from "./board";
import DiceAnimation from "./dice-animation";
import GameLog from "./game-log";
import GameModals from "./game-modals";
import PlayerStatus from "./player-status";
import { Sparkles, X, Bell } from "lucide-react";
import CollectibleInventoryBar from "@/components/collectibles/collectibles-invetory-mobile";
import { ApiResponse } from "@/types/api";
import { BankruptcyModal } from "../../modals/bankruptcy";
import { CardModal } from "../../modals/cards";
import { PropertyActionModal } from "../../modals/property-action";
import { VictoryModal } from "../../player/victory";

const BOARD_SQUARES = 40;
const ROLL_ANIMATION_MS = 1200;
const MOVE_ANIMATION_MS_PER_SQUARE = 250;
const JAIL_POSITION = 10;

const MIN_SCALE = 1.05;
const MAX_SCALE = 1.05;
const BASE_WIDTH_REFERENCE = 390;

const BUILD_PRIORITY = ["orange", "red", "yellow", "pink", "lightblue", "green", "brown", "darkblue"];

const TOKEN_POSITIONS: Record<number, { x: number; y: number }> = {
  0: { x: 91.5, y: 91.5 },
  1: { x: 81.5, y: 91.5 },
  2: { x: 71.5, y: 91.5 },
  3: { x: 61.5, y: 91.5 },
  4: { x: 51.5, y: 91.5 },
  5: { x: 41.5, y: 91.5 },
  6: { x: 31.5, y: 91.5 },
  7: { x: 21.5, y: 91.5 },
  8: { x: 11.5, y: 91.5 },
  9: { x: 1.5, y: 91.5 },
  10: { x: 1.5, y: 91.5 },
  11: { x: 1.5, y: 81.5 },
  12: { x: 1.5, y: 71.5 },
  13: { x: 1.5, y: 61.5 },
  14: { x: 1.5, y: 51.5 },
  15: { x: 1.5, y: 41.5 },
  16: { x: 1.5, y: 31.5 },
  17: { x: 1.5, y: 21.5 },
  18: { x: 1.5, y: 11.5 },
  19: { x: 1.5, y: 1.5 },
  20: { x: 1.5, y: 1.5 },
  21: { x: 11.5, y: 1.5 },
  22: { x: 21.5, y: 1.5 },
  23: { x: 31.5, y: 1.5 },
  24: { x: 41.5, y: 1.5 },
  25: { x: 51.5, y: 1.5 },
  26: { x: 61.5, y: 1.5 },
  27: { x: 71.5, y: 1.5 },
  28: { x: 81.5, y: 1.5 },
  29: { x: 91.5, y: 1.5 },
  30: { x: 91.5, y: 1.5 },
  31: { x: 91.5, y: 11.5 },
  32: { x: 91.5, y: 21.5 },
  33: { x: 91.5, y: 31.5 },
  34: { x: 91.5, y: 41.5 },
  35: { x: 91.5, y: 51.5 },
  36: { x: 91.5, y: 61.5 },
  37: { x: 91.5, y: 71.5 },
  38: { x: 91.5, y: 81.5 },
  39: { x: 91.5, y: 91.5 },
};

const MONOPOLY_STATS = {
  landingRank: {
    5: 1, 6: 2, 7: 3, 8: 4, 9: 5, 11: 6, 13: 7, 14: 8, 16: 9, 18: 10,
    19: 11, 21: 12, 23: 13, 24: 14, 26: 15, 27: 16, 29: 17, 31: 18, 32: 19, 34: 20, 37: 21, 39: 22,
    1: 30, 2: 25, 3: 29, 4: 35, 12: 32, 17: 28, 22: 26, 28: 33, 33: 27, 36: 24, 38: 23,
  } as { [key: number]: number },

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

const getDiceValues = (): { die1: number; die2: number; total: number } | null => {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const total = die1 + die2;
  return total === 12 ? null : { die1, die2, total };
};

const isAIPlayer = (player: Player | undefined): boolean => {
  return !!player && (
    player.username?.toLowerCase().includes("ai_") ||
    player.username?.toLowerCase().includes("bot")
  );
};

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
  const [animatedPositions, setAnimatedPositions] = useState<Record<number, number>>({});
  const [hasMovementFinished, setHasMovementFinished] = useState(false);

  const [showInsolvencyModal, setShowInsolvencyModal] = useState(false);
  const [insolvencyDebt, setInsolvencyDebt] = useState(0);
  const [isRaisingFunds, setIsRaisingFunds] = useState(false);
  const [showPerksModal, setShowPerksModal] = useState(false);
  const [isSpecialMove, setIsSpecialMove] = useState(false);

  const [winner, setWinner] = useState<Player | null>(null);
  const [showVictoryModal, setShowVictoryModal] = useState(false);
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

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedGameProperty, setSelectedGameProperty] = useState<GameProperty | undefined>(undefined);

  const [boardScale, setBoardScale] = useState(1);
  const [boardTransformOrigin, setBoardTransformOrigin] = useState("50% 50%");
  const [isFollowingMyMove, setIsFollowingMyMove] = useState(false);

  const [defaultScale, setDefaultScale] = useState(1.45);

  const [bellFlash, setBellFlash] = useState(false);
  const prevIncomingTradeCount = useRef(0);

  const { tradeRequests = [], refreshTrades } = useGameTrades({
    gameId: game?.id,
    myUserId: me?.user_id,
    players: game?.players ?? [],
  });

  const myIncomingTrades = useMemo(() => {
    if (!me) return [];
    return tradeRequests.filter(
      (t) => t.target_player_id === me.user_id && t.status === "pending"
    );
  }, [tradeRequests, me]);

  useEffect(() => {
    const currentCount = myIncomingTrades.length;
    const previousCount = prevIncomingTradeCount.current;

    if (currentCount > previousCount && previousCount > 0) {
      const latestTrade = myIncomingTrades[myIncomingTrades.length - 1];
      const senderName = latestTrade?.player?.username || "Someone";

      toast.custom(
        <div className="flex items-center gap-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-3 rounded-xl shadow-2xl">
          <Bell className="w-6 h-6 animate-bell-ring" />
          <div>
            <div className="font-bold">New Trade Offer!</div>
            <div className="text-sm opacity-90">{senderName} sent you a trade</div>
          </div>
        </div>,
        { duration: 5000, position: "top-center" }
      );

      setBellFlash(true);
      setTimeout(() => setBellFlash(false), 800);
    }

    prevIncomingTradeCount.current = currentCount;
  }, [myIncomingTrades]);

  useEffect(() => {
    const calculateScale = () => {
      const width = window.innerWidth;
      let scale = (width / BASE_WIDTH_REFERENCE) * 1.48;
      scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
      setDefaultScale(scale);
    };

    calculateScale();
    window.addEventListener("resize", calculateScale);
    return () => window.removeEventListener("resize", calculateScale);
  }, []);

  const currentPlayerId = currentGame.next_player_id;
  const currentPlayer = players.find((p) => p.user_id === currentPlayerId);
  const isMyTurn = me?.user_id === currentPlayerId;

  const landedPositionThisTurn = useRef<number | null>(null);
  const turnEndInProgress = useRef(false);
  const lastToastMessage = useRef<string | null>(null);

  const justLandedProperty = useMemo(() => {
    if (landedPositionThisTurn.current === null) return null;
    return properties.find((p) => p.id === landedPositionThisTurn.current) ?? null;
  }, [landedPositionThisTurn.current, properties]);

  const { data: contractGame } = useGetGameByCode(game.code);
  const onChainGameId = contractGame?.id;
  const { exit: endGame, isPending: endGamePending, reset: endGameReset } = useExitGame(onChainGameId ?? BigInt(0));

  const showToast = useCallback((message: string, type: "success" | "error" | "default" = "default") => {
    if (message === lastToastMessage.current) return;
    lastToastMessage.current = message;
    toast.dismiss();
    if (type === "success") toast.success(message);
    else if (type === "error") toast.error(message);
    else toast(message, { icon: "➤" });
  }, []);

  const isFetching = useRef(false);

  const fetchUpdatedGame = useCallback(async () => {
    if (isFetching.current) return;
    isFetching.current = true;

    try {
      const [gameRes, propertiesRes] = await Promise.all([
        apiClient.get<ApiResponse<Game>>(`/games/code/${game.code}`),
        apiClient.get<ApiResponse<GameProperty[]>>(`/game-properties/game/${game.id}`),
      ]);

      if (gameRes?.data?.success && gameRes.data.data) {
        setCurrentGame(gameRes.data.data);
        setPlayers(gameRes.data.data.players);
      }
      if (propertiesRes?.data?.success && propertiesRes.data.data) {
        setCurrentGameProperties(propertiesRes.data.data);
      }
      refreshTrades?.();
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      isFetching.current = false;
    }
  }, [game.code, game.id, refreshTrades]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isRolling && !actionLock) {
        fetchUpdatedGame();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchUpdatedGame, isRolling, actionLock]);

  useEffect(() => {
    fetchUpdatedGame();
  }, []);

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

    if (canBuy && (currentPlayer?.balance ?? 0) < square.price!) {
      showToast(`Not enough money to buy ${square.name}`, "error");
    }
  }, [
    roll,
    landedPositionThisTurn.current,
    hasMovementFinished,
    properties,
    currentGameProperties,
    currentPlayer,
    showToast,
  ]);

  const lockAction = useCallback((type: "ROLL" | "END") => {
    if (actionLock) return false;
    setActionLock(type);
    return true;
  }, [actionLock]);

  const unlockAction = useCallback(() => setActionLock(null), []);

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
    setIsRaisingFunds(false);
  }, [currentPlayerId]);

  useEffect(() => {
    if (!isMyTurn || !roll || !hasMovementFinished) {
      setBoardScale(defaultScale);
      setBoardTransformOrigin("50% 50%");
      setIsFollowingMyMove(false);
      return;
    }

    const myPos = animatedPositions[me!.user_id] ?? me?.position ?? 0;
    const coord = TOKEN_POSITIONS[myPos] || { x: 50, y: 50 };

    setBoardScale(defaultScale * 1.8);
    setBoardTransformOrigin(`${coord.x}% ${coord.y}%`);
    setIsFollowingMyMove(true);
  }, [isMyTurn, roll, hasMovementFinished, me, animatedPositions, defaultScale]);

  useEffect(() => {
    if (!isMyTurn) {
      setBoardScale(defaultScale);
      setBoardTransformOrigin("50% 50%");
    }
  }, [isMyTurn, defaultScale]);

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

  const triggerLandingLogic = useCallback((newPosition: number, isSpecial = false) => {
    if (landedPositionThisTurn.current !== null) return;

    landedPositionThisTurn.current = newPosition;
    setIsSpecialMove(isSpecial);

    setRoll({ die1: 0, die2: 0, total: 0 });
    setHasMovementFinished(true);
  }, []);

  const endTurnAfterSpecialMove = useCallback(() => {
    setBuyPrompted(false);
    landedPositionThisTurn.current = null;
    setIsSpecialMove(false);
    setTimeout(END_TURN, 800);
  }, [END_TURN]);

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
        game_id: currentGame.id,
        property_id: justLandedProperty.id,
      });

      showToast(`You bought ${justLandedProperty.name}!`, "success");
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

    const playerId = forAI ? currentPlayerId! : me!.user_id;
    const player = players.find((p) => p.user_id === playerId);
    if (!player) {
      unlockAction();
      return;
    }

    const isInJail = player.in_jail === true && player.position === JAIL_POSITION;

    if (isInJail) {
      setIsRolling(true);
      showToast(`${player.username} is in jail — attempting to roll out...`, "default");

      const value = getDiceValues();
      if (!value || value.die1 !== value.die2) {
        setTimeout(async () => {
          try {
            await apiClient.post("/game-players/change-position", {
              user_id: playerId,
              game_id: currentGame.id,
              position: player.position,
              rolled: value?.total ?? 0,
              is_double: false,
            });
            await fetchUpdatedGame();
            showToast("No doubles — still in jail", "error");
            setTimeout(END_TURN, 1000);
          } catch {
            showToast("Jail roll failed", "error");
            END_TURN();
          } finally {
            setIsRolling(false);
            unlockAction();
          }
        }, 800);
        return;
      }

      setRoll(value);
      const totalMove = value.total;
      const newPos = (player.position + totalMove) % BOARD_SQUARES;

      setTimeout(async () => {
        try {
          await apiClient.post("/game-players/change-position", {
            user_id: playerId,
            game_id: currentGame.id,
            position: newPos,
            rolled: totalMove,
            is_double: true,
          });
          landedPositionThisTurn.current = newPos;
          await fetchUpdatedGame();
          showToast(`${player.username} rolled doubles and escaped jail!`, "success");
        } catch {
          showToast("Escape failed", "error");
        } finally {
          setIsRolling(false);
          unlockAction();
        }
      }, 800);
      return;
    }

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

      const currentPos = player.position ?? 0;
      const totalMove = value.total + pendingRoll;
      let newPos = (currentPos + totalMove) % BOARD_SQUARES;

      if (totalMove > 0 && !forAI) {
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
        landedPositionThisTurn.current = newPos;
        await fetchUpdatedGame();

        showToast(
          `${player.username} rolled ${value.die1} + ${value.die2} = ${value.total}!`,
          "success"
        );
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

  const getPlayerOwnedProperties = useCallback((playerAddress: string | undefined) => {
    if (!playerAddress) return [];
    return currentGameProperties
      .filter(gp => gp.address?.toLowerCase() === playerAddress.toLowerCase())
      .map(gp => ({
        gp,
        prop: properties.find(p => p.id === gp.property_id)!,
      }))
      .filter(item => !!item.prop);
  }, [currentGameProperties, properties]);

  const getCompleteMonopolies = useCallback((playerAddress: string | undefined) => {
    if (!playerAddress) return [];
    const owned = getPlayerOwnedProperties(playerAddress);
    const monopolies: string[] = [];

    Object.entries(MONOPOLY_STATS.colorGroups).forEach(([groupName, ids]) => {
      if (groupName === "railroad" || groupName === "utility") return;
      const ownedInGroup = owned.filter(o => ids.includes(o.prop.id));
      if (ownedInGroup.length === ids.length && ownedInGroup.every(o => !o.gp.mortgaged)) {
        monopolies.push(groupName);
      }
    });

    return monopolies.sort((a, b) => BUILD_PRIORITY.indexOf(a) - BUILD_PRIORITY.indexOf(b));
  }, [getPlayerOwnedProperties]);

  const handlePropertyTransfer = async (propertyId: number, newPlayerId: number) => {
    try {
      const res = await apiClient.put<ApiResponse>(`/game-properties/${propertyId}`, {
        game_id: currentGame.id,
        player_id: newPlayerId,
      });
      return res.data?.success ?? false;
    } catch (err) {
      console.error("Transfer failed", err);
      return false;
    }
  };

  const handleDeleteGameProperty = async (id: number) => {
    try {
      const res = await apiClient.delete<ApiResponse>(`/game-properties/${id}`, {
        data: { game_id: currentGame.id },
      });
      return res.data?.success ?? false;
    } catch (err) {
      console.error("Delete failed", err);
      return false;
    }
  };

  const getGamePlayerId = useCallback((walletAddress: string | undefined): number | null => {
    if (!walletAddress) return null;
    const ownedProp = currentGameProperties.find(gp => gp.address?.toLowerCase() === walletAddress.toLowerCase());
    return ownedProp?.player_id ?? null;
  }, [currentGameProperties]);

  const handleBankruptcy = useCallback(async () => {
    if (!me || !currentGame.id || !currentGame.code) {
      showToast("Cannot declare bankruptcy right now", "error");
      return;
    }

    showToast("Declaring bankruptcy...", "error");

    let creditorPlayerId: number | null = null;

    if (justLandedProperty) {
      const landedGameProp = currentGameProperties.find(
        (gp) => gp.property_id === justLandedProperty.id
      );

      if (landedGameProp?.address && landedGameProp.address !== "bank") {
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

      const myOwnedProperties = currentGameProperties.filter(
        (gp) => gp.address?.toLowerCase() === me.address?.toLowerCase()
      );

      if (myOwnedProperties.length === 0) {
        showToast("You have no properties to transfer.", "default");
      } else if (creditorPlayerId) {
        showToast(`Transferring all properties to the player who bankrupted you...`, "error");

        let successCount = 0;
        for (const gp of myOwnedProperties) {
          try {
            await apiClient.put(`/game-properties/${gp.id}`, {
              game_id: currentGame.id,
              player_id: creditorPlayerId,
            });
            successCount++;
          } catch (err) {
            console.error(`Failed to transfer property ${gp.property_id}`, err);
          }
        }

        toast.success(`${successCount}/${myOwnedProperties.length} properties transferred!`);
      } else {
        showToast("Returning all properties to the bank...", "error");

        let successCount = 0;
        for (const gp of myOwnedProperties) {
          try {
            await apiClient.delete(`/game-properties/${gp.id}`, {
              data: { game_id: currentGame.id },
            });
            successCount++;
          } catch (err) {
            console.error(`Failed to return property ${gp.property_id}`, err);
          }
        }

        toast.success(`${successCount}/${myOwnedProperties.length} properties returned to bank.`);
      }

      await END_TURN();

      await apiClient.post("/game-players/leave", {
        address: me.address,
        code: currentGame.code,
        reason: "bankruptcy",
      });

      await fetchUpdatedGame();

      showToast("You have declared bankruptcy and left the game.", "error");
      setShowExitPrompt(true);
    } catch (err: any) {
      console.error("Bankruptcy process failed:", err);
      showToast("Bankruptcy failed — but you are eliminated.", "error");

      try {
        await END_TURN();
      } catch {}

      setTimeout(() => {
        window.location.href = "/";
      }, 3000);
    } finally {
      setShowBankruptcyModal(false);
      setBuyPrompted(false);
      landedPositionThisTurn.current = null;
    }
  }, [
    me,
    currentGame,
    justLandedProperty,
    currentGameProperties,
    players,
    showToast,
    fetchUpdatedGame,
    END_TURN,
    endGame,
  ]);

  const handleFinalizeAndLeave = async () => {
    const toastId = toast.loading(
      winner?.user_id === me?.user_id
        ? "Claiming your prize..."
        : "Finalizing game..."
    );

    try {
      if (endGame) await endGame();

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
        err?.message || "Something went wrong — try again later",
        { id: toastId, duration: 8000 }
      );
    } finally {
      if (endGameReset) endGameReset();
    }
  };


  useEffect(() => {
    if (!currentGame || currentGame.status === "FINISHED" || !me) return;

    const activePlayers = currentGame.players.filter((player) => {
      if ((player.balance ?? 0) > 0) return true;
      return currentGameProperties.some(
        (gp) =>
          gp.address?.toLowerCase() === player.address?.toLowerCase() &&
          gp.mortgaged !== true
      );
    });

    if (activePlayers.length === 1) {
      const theWinner = activePlayers[0];

      if (winner?.user_id === theWinner.user_id) return;

      toast.success(`${theWinner.username} wins the game! 🎉🏆`);

      setWinner(theWinner);
      setEndGameCandidate({
        winner: theWinner,
        position: theWinner.position ?? 0,
        balance: BigInt(theWinner.balance ?? 0),
      });

      setShowVictoryModal(true);

      if (me?.user_id === theWinner.user_id) {
        toast.success("You are the Monopoly champion! 🏆");
      }
    }
  }, [currentGame.players, currentGameProperties, currentGame.status, me, winner, currentGameProperties]);

  useEffect(() => {
    if (actionLock || isRolling || buyPrompted || !roll || isRaisingFunds || showInsolvencyModal) return;
    const timer = setTimeout(END_TURN, 2000);
    return () => clearTimeout(timer);
  }, [actionLock, isRolling, buyPrompted, roll, isRaisingFunds, showInsolvencyModal, END_TURN]);

  const getCurrentRent = (prop: Property, gp: GameProperty | undefined): number => {
    if (!gp || !gp.address) return prop.rent_site_only || 0;
    if (gp.mortgaged) return 0;
    if (gp.development === 5) return prop.rent_hotel || 0;
    if (gp.development && gp.development > 0) {
      switch (gp.development) {
        case 1: return prop.rent_one_house || 0;
        case 2: return prop.rent_two_houses || 0;
        case 3: return prop.rent_three_houses || 0;
        case 4: return prop.rent_four_houses || 0;
        default: return prop.rent_site_only || 0;
      }
    }

    const groupEntry = Object.entries(MONOPOLY_STATS.colorGroups).find(([_, ids]) => ids.includes(prop.id));
    if (groupEntry) {
      const [groupName] = groupEntry;
      if (groupName !== "railroad" && groupName !== "utility") {
        const groupIds = MONOPOLY_STATS.colorGroups[groupName as keyof typeof MONOPOLY_STATS.colorGroups];
        const ownedInGroup = currentGameProperties.filter(g => groupIds.includes(g.property_id) && g.address === gp.address).length;
        if (ownedInGroup === groupIds.length) return (prop.rent_site_only || 0) * 2;
      }
    }

    return prop.rent_site_only || 0;
  };

  const handlePropertyClick = (propertyId: number) => {
    const prop = properties.find(p => p.id === propertyId);
    const gp = currentGameProperties.find(g => g.property_id === propertyId);
    if (prop) {
      setSelectedProperty(prop);
      setSelectedGameProperty(gp);
    }
  };

  const handleDevelopment = async () => {
    if (!selectedGameProperty || !me || !isMyTurn) {
      showToast("Not your turn or invalid property", "error");
      return;
    }

    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/development", {
        game_id: currentGame.id,
        user_id: me.user_id,
        property_id: selectedGameProperty.property_id,
      });

      if (res.data?.success) {
        const currentDev = selectedGameProperty.development ?? 0;
        const isBuilding = currentDev < 5;
        const item = currentDev === 4 && isBuilding ? "hotel" : "house";
        const action = isBuilding ? "built" : "sold";
        showToast(`Successfully ${action} ${item}!`, "success");
        await fetchUpdatedGame();
        setSelectedProperty(null);
      } else {
        showToast(res.data?.message || "Action failed", "error");
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || "Development failed", "error");
    }
  };

  const handleMortgageToggle = async () => {
    if (!selectedGameProperty || !me || !isMyTurn) {
      showToast("Not your turn or invalid property", "error");
      return;
    }

    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/mortgage", {
        game_id: currentGame.id,
        user_id: me.user_id,
        property_id: selectedGameProperty.property_id,
      });

      if (res.data?.success) {
        const action = selectedGameProperty.mortgaged ? "redeemed" : "mortgaged";
        showToast(`Property ${action}!`, "success");
        await fetchUpdatedGame();
        setSelectedProperty(null);
      } else {
        showToast(res.data?.message || "Mortgage failed", "error");
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || "Mortgage action failed", "error");
    }
  };

  const handleSellProperty = async () => {
    if (!selectedGameProperty || !me || !isMyTurn) {
      showToast("Not your turn or invalid property", "error");
      return;
    }

    if ((selectedGameProperty.development ?? 0) > 0) {
      showToast("Cannot sell property with buildings!", "error");
      return;
    }

    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/sell", {
        game_id: currentGame.id,
        user_id: me.user_id,
        property_id: selectedGameProperty.property_id,
      });

      if (res.data?.success) {
        showToast("Property sold back to bank!", "success");
        await fetchUpdatedGame();
        setSelectedProperty(null);
      } else {
        showToast(res.data?.message || "Sell failed", "error");
      }
    } catch (err: any) {
      showToast(err?.response?.data?.message || "Failed to sell property", "error");
    }
  };

  const isOwnedByMe = selectedGameProperty?.address?.toLowerCase() === me?.address?.toLowerCase();

  const computedTokenPositions = useMemo(() => {
    const playerPositions: Record<number, { x: number; y: number }> = {};

    players.forEach((p) => {
      const pos = animatedPositions[p.user_id] ?? p.position ?? 0;
      const playersHere = players.filter(p2 => (animatedPositions[p2.user_id] ?? p2.position) === pos);

      const sorted = [...playersHere].sort((a, b) => {
        if (a.user_id === me?.user_id) return 1;
        if (b.user_id === me?.user_id) return -1;
        return 0;
      });

      const index = sorted.findIndex(s => s.user_id === p.user_id);
      const base = TOKEN_POSITIONS[pos];

      if (playersHere.length > 1) {
        const isBottom = pos >= 0 && pos <= 9;
        const isLeft = pos >= 10 && pos <= 19;
        const isTop = pos >= 20 && pos <= 29;
        const isRight = pos >= 30 && pos <= 39;

        const offset = index * 3 - (playersHere.length - 1) * 1.5;

        if (isBottom || isTop) {
          playerPositions[p.user_id] = { x: base.x + offset, y: base.y };
        } else if (isLeft || isRight) {
          playerPositions[p.user_id] = { x: base.x, y: base.y + offset };
        } else {
          playerPositions[p.user_id] = base;
        }
      } else {
        playerPositions[p.user_id] = { x: 50, y: 50 };
      }
    });

    return playerPositions;
  }, [players, animatedPositions, me]);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white flex flex-col items-center justify-start relative overflow-hidden">
      <button
        onClick={fetchUpdatedGame}
        className="fixed top-4 right-4 z-50 bg-blue-500 text-white text-xs px-2 py-1 rounded-full hover:bg-blue-600 transition"
      >
        Refresh
      </button>

      <div className="fixed top-4 right-20 z-50 flex items-center">
        <motion.button
          animate={bellFlash ? { rotate: [0, -20, 20, -20, 20, 0] } : { rotate: 0 }}
          transition={{ duration: 0.6 }}
          onClick={() => {
            toast("Check the Trades section in the sidebar →", { duration: 4000 });
          }}
          className="relative p-3 bg-purple-700/80 backdrop-blur-md rounded-full shadow-lg hover:bg-purple-600 transition"
        >
          <Bell className="w-7 h-7 text-white" />

          {myIncomingTrades.length > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
              {myIncomingTrades.length}
            </span>
          )}
        </motion.button>
      </div>

      <div className="w-full max-w-2xl mx-auto px-4 mt-4">
        <PlayerStatus currentPlayer={currentPlayer} isAITurn={!isMyTurn} buyPrompted={buyPrompted} />

        {me && (
          <div className="mt-4 flex items-center justify-start gap-4 rounded-xl px-5 py-3 border border-white/20">
            <span className="text-sm opacity-80">Bal:</span>
            {(() => {
              const balance = me.balance ?? 0;
              const getBalanceColor = (bal: number): string => {
                if (bal >= 1300) return "text-cyan-300";
                if (bal >= 1000) return "text-emerald-400";
                if (bal >= 750) return "text-yellow-400";
                if (bal >= 150) return "text-orange-400";
                return "text-red-500 animate-pulse";
              };

              return (
                <span className={`text-xl font-bold ${getBalanceColor(balance)} drop-shadow-md`}>
                  ${Number(balance).toLocaleString()}
                </span>
              );
            })()}
          </div>
        )}
      </div>

      <div className="flex-1 w-full flex items-center justify-center overflow-hidden mt-4">
        <motion.div
          animate={{ scale: boardScale }}
          style={{ transformOrigin: boardTransformOrigin }}
          transition={{ type: "spring", stiffness: 120, damping: 30 }}
          className="origin-center"
        >
          <Board
            properties={properties}
            players={players}
            currentGameProperties={currentGameProperties}
            animatedPositions={animatedPositions}
            currentPlayerId={currentPlayerId}
            onPropertyClick={handlePropertyClick}
          />
        </motion.div>
      </div>

      <DiceAnimation
        isRolling={isRolling && !(currentPlayer?.in_jail && currentPlayer.position === JAIL_POSITION)}
        roll={roll}
      />

      {isMyTurn && !roll && !isRolling && !isRaisingFunds && !showInsolvencyModal && (
        <button
          onClick={() => ROLL_DICE(false)}
          className="w-full max-w-xs mx-auto py-3 px-8 mb-8 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 active:from-emerald-700 active:to-teal-800 text-white font-bold text-lg tracking-wide rounded-full shadow-md shadow-emerald-500/30 border border-white/20 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/40 active:scale-95"
        >
          Roll Dice
        </button>
      )}

      <AnimatePresence>
        {isMyTurn && buyPrompted && justLandedProperty && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 bg-gray-900/95 backdrop-blur-lg p-6 rounded-t-3xl shadow-2xl z-[60] border-t border-cyan-500/30"
          >
            <div className="max-w-md mx-auto text-center">
              <h3 className="text-2xl font-bold text-white mb-2">
                Buy {justLandedProperty.name}?
              </h3>
              <p className="text-lg text-gray-300 mb-6">
                Price: ${justLandedProperty.price?.toLocaleString()}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={BUY_PROPERTY}
                  className="py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-xl rounded-2xl shadow-lg hover:scale-105 transition"
                >
                  Buy
                </button>
                <button
                  onClick={() => {
                    showToast("Skipped purchase", "default");
                    setBuyPrompted(false);
                    landedPositionThisTurn.current = null;
                    setTimeout(END_TURN, 800);
                  }}
                  className="py-4 bg-gray-700 text-white font-bold text-xl rounded-2xl shadow-lg hover:scale-105 transition"
                >
                  Skip
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedProperty && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedProperty(null)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 rounded-2xl shadow-2xl border border-cyan-500/50 max-w-sm w-full overflow-hidden"
            >
              <div className={`h-20 bg-${selectedProperty.color || 'gray'}-600`} />
              <div className="p-6">
                <h2 className="text-2xl font-bold text-center mb-4">{selectedProperty.name}</h2>
                <p className="text-center text-gray-300 mb-6">Price: ${selectedProperty.price}</p>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span>Current Rent:</span>
                    <span className="font-bold text-yellow-400">
                      ${getCurrentRent(selectedProperty, selectedGameProperty)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Owner:</span>
                    <span className="font-medium">
                      {selectedGameProperty?.address
                        ? players.find(p => p.address?.toLowerCase() === selectedGameProperty.address?.toLowerCase())?.username || "Player"
                        : "Bank"}
                    </span>
                  </div>
                  {selectedGameProperty?.development != null && selectedGameProperty.development > 0 && (
                    <div className="flex justify-between">
                      <span>Buildings:</span>
                      <span>{selectedGameProperty.development === 5 ? "Hotel" : `${selectedGameProperty.development} House(s)`}</span>
                    </div>
                  )}
                  {selectedGameProperty?.mortgaged && (
                    <div className="text-red-400 font-bold text-center mt-3">MORTGAGED</div>
                  )}
                </div>

                {isOwnedByMe && isMyTurn && selectedGameProperty && (
                  <div className="grid grid-cols-2 gap-4 mt-8">
                    <button
                      onClick={handleDevelopment}
                      disabled={selectedGameProperty.development === 5}
                      className="py-3 bg-green-600 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-500 transition"
                    >
                      {selectedGameProperty.development === 4 ? "Build Hotel" : "Build House"}
                    </button>
                    <button
                      onClick={handleDevelopment}
                      disabled={!selectedGameProperty.development || selectedGameProperty.development === 0}
                      className="py-3 bg-orange-600 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-500 transition"
                    >
                      Sell House/Hotel
                    </button>
                    <button
                      onClick={handleMortgageToggle}
                      className="py-3 bg-red-600 rounded-xl font-bold hover:bg-red-500 transition"
                    >
                      {selectedGameProperty.mortgaged ? "Redeem" : "Mortgage"}
                    </button>
                    <button
                      onClick={handleSellProperty}
                      disabled={(selectedGameProperty.development ?? 0) > 0}
                      className="py-3 bg-purple-600 rounded-xl font-bold disabled:opacity-50 hover:bg-purple-500 transition"
                    >
                      Sell Property
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setSelectedProperty(null)}
                  className="w-full mt-6 py-3 bg-gray-700 rounded-xl font-bold hover:bg-gray-600 transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setShowPerksModal(true)}
        className="fixed bottom-20 right-6 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 shadow-2xl shadow-cyan-500/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
      >
        <Sparkles className="w-8 h-8 text-black" />
      </button>

      <AnimatePresence>
        {showPerksModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPerksModal(false)}
              className="fixed inset-0 bg-black/80 z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 top-16 z-50 bg-[#0A1C1E] rounded-t-3xl border-t border-cyan-500/50 overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-cyan-900/50 flex items-center justify-between">
                <h2 className="text-3xl font-bold flex items-center gap-4">
                  <Sparkles className="w-10 h-10 text-[#00F0FF]" />
                  My Perks
                </h2>
                <button
                  onClick={() => setShowPerksModal(false)}
                  className="text-gray-400 hover:text-white p-2"
                >
                  <X className="w-8 h-8" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 pb-8">
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
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <GameLog history={currentGame.history} />

      <GameModals
        winner={winner}
        showExitPrompt={showExitPrompt}
        setShowExitPrompt={setShowExitPrompt}
        showInsolvencyModal={showInsolvencyModal}
        insolvencyDebt={insolvencyDebt}
        isRaisingFunds={isRaisingFunds}
        showBankruptcyModal={showBankruptcyModal}
        showCardModal={showCardModal}
        cardData={cardData}
        cardPlayerName={cardPlayerName}
        setShowCardModal={setShowCardModal}
        me={me}
        players={players}
        currentGame={currentGame}
        isPending={true}
        setShowInsolvencyModal={setShowInsolvencyModal}
        setIsRaisingFunds={setIsRaisingFunds}
        setShowBankruptcyModal={setShowBankruptcyModal}
        fetchUpdatedGame={fetchUpdatedGame}
        showToast={showToast}
      />

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

      <PropertyActionModal
        property={selectedProperty}
        onClose={() => setSelectedProperty(null)}
        onDevelop={handleDevelopment}
        onDowngrade={handleSellProperty}
        onMortgage={handleMortgageToggle}
        onUnmortgage={handleMortgageToggle}
      />

      <VictoryModal
        winner={winner}
        me={me}
        onClaim={handleFinalizeAndLeave}
        claiming={endGamePending}
      />

      <style jsx>{`
        @keyframes bell-ring {
          0%, 100% { transform: rotate(0deg); }
          10%, 30%, 50%, 70%, 90% { transform: rotate(-15deg); }
          20%, 40%, 60%, 80% { transform: rotate(15deg); }
        }
        .animate-bell-ring {
          animation: bell-ring 0.8s ease-in-out;
        }
      `}</style>

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