"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useGetGameByCode, useExitGame, useTransferPropertyOwnership } from "@/context/ContractProvider";
import { Game, GameProperty, Property, Player, PROPERTY_ACTION } from "@/types/game";
import { useGameTrades } from "@/hooks/useGameTrades";
import {
  BOARD_SQUARES,
  ROLL_ANIMATION_MS,
  MOVE_ANIMATION_MS_PER_SQUARE,
  JAIL_POSITION,
  MIN_SCALE,
  MAX_SCALE,
  BASE_WIDTH_REFERENCE,
  TOKEN_POSITIONS,
  MONOPOLY_STATS,
  BUILD_PRIORITY,
  getDiceValues,
} from "../../constants";
import Board from "./board";
import DiceAnimation from "./dice-animation";
import GameLog from "./game-log";
import GameModals from "./game-modals";
import PlayerStatus from "./player-status";
import BellNotification from "./BellNotification";
import RollDiceSection from "./RollDiceSection";
import BoardPropertyDetailModal from "./BoardPropertyDetailModal";
import BoardPerksModal from "./BoardPerksModal";
import MyBalanceBar from "../../ai-board/mobile/MyBalanceBar";
import BuyPromptModal from "../../ai-board/mobile/BuyPromptModal";
import { Sparkles } from "lucide-react";
import CollectibleInventoryBar from "@/components/collectibles/collectibles-invetory-mobile";
import { GameDurationCountdown } from "../../GameDurationCountdown";
import { ApiResponse } from "@/types/api";
import { BankruptcyModal } from "../../modals/bankruptcy";
import { CardModal } from "../../modals/cards";
import { VictoryModal } from "../../player/victory";

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
  const [endGameCandidate, setEndGameCandidate] = useState<{ winner: Player | null; position: number; balance: bigint }>({
    winner: null,
    position: 0,
    balance: BigInt(0),
  });
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardData, setCardData] = useState<{ type: "chance" | "community"; text: string; effect?: string; isGood: boolean } | null>(null);
  const [cardPlayerName, setCardPlayerName] = useState("");
  const [showBankruptcyModal, setShowBankruptcyModal] = useState(false);
  const [turnTimeLeft, setTurnTimeLeft] = useState<number | null>(null);

  const { write: transferOwnership, isPending: isCreatePending } = useTransferPropertyOwnership();

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
          <span className="text-2xl">🔔</span>
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
      if (!isRolling) {
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
  }, [roll, landedPositionThisTurn.current, hasMovementFinished, properties, currentGameProperties, currentPlayer, showToast]);

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
    setTurnTimeLeft(null);
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

  const END_TURN = useCallback(async (timedOut?: boolean) => {
    if (!currentPlayerId || turnEndInProgress.current || !lockAction("END")) return;
    turnEndInProgress.current = true;

    try {
      await apiClient.post("/game-players/end-turn", {
        user_id: currentPlayerId,
        game_id: currentGame.id,
        ...(timedOut === true && { timed_out: true }),
      });
      showToast(timedOut ? "Time's up! Turn ended." : "Turn ended", timedOut ? "default" : "success");
      await fetchUpdatedGame();
    } catch {
      showToast("Failed to end turn", "error");
    } finally {
      unlockAction();
      turnEndInProgress.current = false;
    }
  }, [currentPlayerId, currentGame.id, fetchUpdatedGame, lockAction, unlockAction, showToast]);

  const playerCanRoll = Boolean(isMyTurn && currentPlayer && (currentPlayer.balance ?? 0) > 0);
  useEffect(() => {
    if (!isMyTurn || !playerCanRoll || !currentPlayer?.turn_start || isRolling || roll) {
      setTurnTimeLeft(null);
      return;
    }
    const turnStartSec = parseInt(currentPlayer.turn_start, 10);
    if (Number.isNaN(turnStartSec)) {
      setTurnTimeLeft(null);
      return;
    }
    const TURN_ROLL_SECONDS = 90;
    const tick = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, TURN_ROLL_SECONDS - (nowSec - turnStartSec));
      setTurnTimeLeft(remaining);
      if (remaining <= 0) {
        END_TURN(true);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isMyTurn, playerCanRoll, currentPlayer?.turn_start, isRolling, roll, showToast, END_TURN]);

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

  const removeInactive = useCallback(
    async (targetUserId: number) => {
      if (!me?.user_id || !currentGame?.id) return;
      try {
        await apiClient.post("/game-players/remove-inactive", {
          game_id: currentGame.id,
          user_id: me.user_id,
          target_user_id: targetUserId,
        });
        await fetchUpdatedGame();
        showToast("Player removed due to inactivity.", "default");
      } catch (err: unknown) {
        const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "Failed to remove player";
        showToast(msg, "error");
      }
    },
    [currentGame?.id, me?.user_id, fetchUpdatedGame, showToast]
  );

  const removablePlayers = useMemo(
    () => players.filter((p) => p.user_id !== me?.user_id && (p.consecutive_timeouts ?? 0) >= 3),
    [players, me?.user_id]
  );

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

    const buyerUsername = me?.username;
    if (!buyerUsername) {
      showToast("Cannot buy: your username is missing", "error");
      return;
    }

    try {
      showToast("Sending transaction...", "default");
      await transferOwnership('', buyerUsername);
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

    const isInJail = Boolean(player.in_jail) && Number(player.position) === JAIL_POSITION;

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
    isRolling,
    actionLock,
    lockAction,
    unlockAction,
    currentPlayerId,
    me,
    players,
    pendingRoll,
    currentGame.id,
    fetchUpdatedGame,
    showToast,
    END_TURN,
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
          (p) => p.address?.toLowerCase() === landedGameProp.address?.toLowerCase() &&
                 p.user_id !== me.user_id
        );
        if (owner) creditorPlayerId = owner.user_id;
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
      try { await END_TURN(); } catch {}
      setTimeout(() => { window.location.href = "/"; }, 3000);
    } finally {
      setShowBankruptcyModal(false);
      setBuyPrompted(false);
      landedPositionThisTurn.current = null;
    }
  }, [me, currentGame, justLandedProperty, currentGameProperties, players, showToast, fetchUpdatedGame, END_TURN, endGame]);

  const handleFinalizeAndLeave = async () => {
    const toastId = toast.loading(
      winner?.user_id === me?.user_id ? "Claiming your prize..." : "Finalizing game..."
    );

    try {
      if (endGame) await endGame();
      await apiClient.put(`/games/${currentGame.id}`, {
        status: "FINISHED",
        winner_id: me?.user_id || null,
      });
      toast.success(
        winner?.user_id === me?.user_id
          ? "Prize claimed! "
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
        (gp) => gp.address?.toLowerCase() === player.address?.toLowerCase() &&
                gp.mortgaged !== true
      );
    });

    if (activePlayers.length === 1) {
      const theWinner = activePlayers[0];
      if (winner?.user_id === theWinner.user_id) return;

      toast.success(`${theWinner.username} wins the game! `);
      setWinner(theWinner);
      setEndGameCandidate({
        winner: theWinner,
        position: theWinner.position ?? 0,
        balance: BigInt(theWinner.balance ?? 0),
      });
      setShowVictoryModal(true);

      if (me?.user_id === theWinner.user_id) {
        toast.success("You are the Monopoly champion! ");
      }
    }
  }, [currentGame.players, currentGameProperties, currentGame.status, me, winner]);

  useEffect(() => {
    if (actionLock || isRolling || buyPrompted || !roll || isRaisingFunds) return;
    const timer = setTimeout(END_TURN, 2000);
    return () => clearTimeout(timer);
  }, [actionLock, isRolling, buyPrompted, roll, isRaisingFunds, END_TURN]);

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

    const groupEntry = Object.entries(MONOPOLY_STATS.colorGroups).find(([_, ids]) =>
      ids.includes(prop.id)
    );

    if (groupEntry) {
      const [groupName] = groupEntry;
      if (groupName !== "railroad" && groupName !== "utility") {
        const groupIds = MONOPOLY_STATS.colorGroups[groupName as keyof typeof MONOPOLY_STATS.colorGroups];
        const ownedInGroup = currentGameProperties.filter(
          g => groupIds.includes(g.property_id) && g.address === gp.address
        ).length;
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

  const computedTokenPositions = useMemo(() => {
    const playerPositions: Record<number, { x: number; y: number }> = {};

    players.forEach((p) => {
      const pos = animatedPositions[p.user_id] ?? p.position ?? 0;
      const playersHere = players.filter(
        p2 => (animatedPositions[p2.user_id] ?? p2.position) === pos
      );

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

  const hasNegativeBalance = (me?.balance ?? 0) <= 0;
  const isSoloPlayer = players.length === 1 && players[0].user_id === me?.user_id;

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white flex flex-col items-center justify-start relative overflow-hidden">
      <button
        onClick={fetchUpdatedGame}
        className="fixed top-4 right-4 z-50 bg-blue-500 text-white text-xs px-2 py-1 rounded-full hover:bg-blue-600 transition"
      >
        Refresh
      </button>

      <BellNotification bellFlash={bellFlash} incomingCount={myIncomingTrades.length} />

      <div className="w-full max-w-2xl mx-auto px-4 mt-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <PlayerStatus currentPlayer={currentPlayer} isAITurn={!isMyTurn} buyPrompted={buyPrompted} />
          {currentGame?.duration && Number(currentGame.duration) > 0 && (
            <GameDurationCountdown game={currentGame} compact />
          )}
        </div>
        <MyBalanceBar me={me} />
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

      {removablePlayers.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 px-2 py-1.5 bg-amber-900/30 border-b border-amber-500/30">
          {removablePlayers.map((p) => (
            <button
              key={p.user_id}
              onClick={() => removeInactive(p.user_id)}
              className="text-sm font-medium rounded-lg px-3 py-1.5 bg-amber-900/80 text-amber-200 border border-amber-500/50"
            >
              Remove {p.username} (3 timeouts)
            </button>
          ))}
        </div>
      )}

      <RollDiceSection
        isMyTurn={isMyTurn}
        isRolling={isRolling}
        isRaisingFunds={isRaisingFunds}
        showInsolvencyModal={showInsolvencyModal}
        hasNegativeBalance={hasNegativeBalance}
        turnTimeLeft={turnTimeLeft}
        onRollDice={() => ROLL_DICE(false)}
        onDeclareBankruptcy={handleBankruptcy}
      />

      <BuyPromptModal
        visible={!!(isMyTurn && buyPrompted && justLandedProperty)}
        property={justLandedProperty ?? null}
        onBuy={BUY_PROPERTY}
        onSkip={() => {
          showToast("Skipped purchase", "default");
          setBuyPrompted(false);
          landedPositionThisTurn.current = null;
          setTimeout(END_TURN, 800);
        }}
      />

      <BoardPropertyDetailModal
        property={selectedProperty}
        gameProperty={selectedGameProperty}
        players={players}
        me={me}
        isMyTurn={isMyTurn}
        getCurrentRent={getCurrentRent}
        onClose={() => setSelectedProperty(null)}
        onDevelop={handleDevelopment}
        onDowngrade={handleDevelopment}
        onMortgageToggle={handleMortgageToggle}
        onSellProperty={handleSellProperty}
      />

      <button
        onClick={() => setShowPerksModal(true)}
        className="fixed bottom-20 right-6 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 shadow-2xl shadow-cyan-500/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
      >
        <Sparkles className="w-8 h-8 text-black" />
      </button>

      <BoardPerksModal
        open={showPerksModal}
        onClose={() => setShowPerksModal(false)}
        game={game}
        game_properties={game_properties}
        isMyTurn={isMyTurn}
        onRollDice={ROLL_DICE}
        onEndTurn={END_TURN}
        onTriggerSpecialLanding={triggerLandingLogic}
        onEndTurnAfterSpecial={endTurnAfterSpecialMove}
      />

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
          success: { icon: "", style: { borderColor: "#10b981" } },
          error: { icon: "", style: { borderColor: "#ef4444" } },
        }}
      />
    </div>
  );
};

export default MobileGameLayout;