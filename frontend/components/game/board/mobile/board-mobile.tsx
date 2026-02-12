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
import TradeAlertPill from "../../TradeAlertPill";
import BoardPropertyDetailModal from "./BoardPropertyDetailModal";
import BoardPerksModal from "./BoardPerksModal";
import MyBalanceBar from "../../ai-board/mobile/MyBalanceBar";
import BuyPromptModal from "../../ai-board/mobile/BuyPromptModal";
import { Sparkles } from "lucide-react";
import CollectibleInventoryBar from "@/components/collectibles/collectibles-invetory-mobile";
import { GameDurationCountdown } from "../../GameDurationCountdown";
import { ApiResponse } from "@/types/api";
import { getContractErrorMessage } from "@/lib/utils/contractErrors";
import { BankruptcyModal } from "../../modals/bankruptcy";
import { CardModal } from "../../modals/cards";
import { VictoryModal } from "../../player/victory";

const MobileGameLayout = ({
  game,
  properties,
  game_properties,
  me,
  onViewTrades,
}: {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  me: Player | null;
  onViewTrades?: () => void;
}) => {
  const [currentGame, setCurrentGame] = useState<Game>(game);
  const [players, setPlayers] = useState<Player[]>(game?.players ?? []);
  const [currentGameProperties, setCurrentGameProperties] = useState<GameProperty[]>(game_properties);

  // Sync from parent when game/properties update (e.g. from socket-triggered refetch)
  useEffect(() => {
    setCurrentGame(game);
    setPlayers(game?.players ?? []);
  }, [game]);
  useEffect(() => {
    setCurrentGameProperties(game_properties);
  }, [game_properties]);
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
  const [voteStatuses, setVoteStatuses] = useState<Record<number, { vote_count: number; required_votes: number; voters: Array<{ user_id: number; username: string }> }>>({});
  const [votingLoading, setVotingLoading] = useState<Record<number, boolean>>({});

  const { write: transferOwnership, isPending: isCreatePending } = useTransferPropertyOwnership();

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedGameProperty, setSelectedGameProperty] = useState<GameProperty | undefined>(undefined);

  const [boardScale, setBoardScale] = useState(1);
  const [boardTransformOrigin, setBoardTransformOrigin] = useState("50% 50%");
  const [isFollowingMyMove, setIsFollowingMyMove] = useState(false);
  const [defaultScale, setDefaultScale] = useState(1.45);
  const [bellFlash, setBellFlash] = useState(false);

  const prevIncomingTradeCount = useRef(0);
  const tradeToastShownThisTurn = useRef(false);
  const lastTurnForTradeToast = useRef<number | null>(null);
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

    if (currentCount > previousCount && previousCount >= 0 && !tradeToastShownThisTurn.current) {
      tradeToastShownThisTurn.current = true;
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

  // Reset "shown this turn" when turn changes so we show at most one purple toast per turn
  useEffect(() => {
    if (lastTurnForTradeToast.current !== currentPlayerId) {
      lastTurnForTradeToast.current = currentPlayerId ?? null;
      tradeToastShownThisTurn.current = false;
    }
  }, [currentPlayerId]);

  const landedPositionThisTurn = useRef<number | null>(null);
  const turnEndInProgress = useRef(false);
  const lastToastMessage = useRef<string | null>(null);
  const recordTimeoutCalledForTurn = useRef<number | null>(null);
  const timeLeftFrozenAtRollRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const INACTIVITY_SECONDS = 30;
  const TURN_TOTAL_SECONDS = 90;

  const justLandedProperty = useMemo(() => {
    if (landedPositionThisTurn.current === null) return null;
    return properties.find((p) => p.id === landedPositionThisTurn.current) ?? null;
  }, [landedPositionThisTurn.current, properties]);

  const { data: contractGame } = useGetGameByCode(game.code);
  const onChainGameId = contractGame?.id;
  const { exit: endGame, isPending: endGamePending, reset: endGameReset } = useExitGame(onChainGameId ?? BigInt(0));

  // Show toasts only for successful property purchases and the purple trade notification (toast.custom)
  const showToast = useCallback((message: string, type: "success" | "error" | "default" = "default") => {
    if (type === "success" && (message.startsWith("You bought") || (message.includes("bought") && message.endsWith("!")))) {
      toast.success(message);
    }
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
    }, 2000);

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
    recordTimeoutCalledForTurn.current = null;
    setAnimatedPositions({});
    setHasMovementFinished(false);
    setIsRaisingFunds(false);
    setTurnTimeLeft(null);
    timeLeftFrozenAtRollRef.current = null;
    lastActivityRef.current = Date.now();
  }, [currentPlayerId]);

  const touchActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

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
      // Turn state visible on board — no toast
      await fetchUpdatedGame();
    } catch (err) {
      toast.error(getContractErrorMessage(err, "Failed to end turn"));
    } finally {
      unlockAction();
      turnEndInProgress.current = false;
    }
  }, [currentPlayerId, currentGame.id, fetchUpdatedGame, lockAction, unlockAction, showToast]);

  const playerCanRoll = Boolean(isMyTurn && currentPlayer && (currentPlayer.balance ?? 0) > 0);
  const hasRolled = isMyTurn && roll != null && hasMovementFinished;
  // Timer for current player — stops counting when they roll; 90s total to wrap up
  const isTwoPlayer = players.length === 2;
  useEffect(() => {
    if (!currentPlayer?.turn_start) {
      setTurnTimeLeft(null);
      return;
    }
    const raw = currentPlayer.turn_start;
    const turnStartSec = typeof raw === "number" ? raw : parseInt(String(raw), 10);
    if (Number.isNaN(turnStartSec)) {
      setTurnTimeLeft(null);
      return;
    }
    const tick = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const elapsed = nowSec - turnStartSec;
      const liveRemaining = Math.max(0, TURN_TOTAL_SECONDS - elapsed);

      if (hasRolled) {
        if (timeLeftFrozenAtRollRef.current === null) {
          timeLeftFrozenAtRollRef.current = liveRemaining;
        }
        setTurnTimeLeft(timeLeftFrozenAtRollRef.current);
      } else {
        setTurnTimeLeft(liveRemaining);
      }

      if (liveRemaining <= 0) {
        if (isTwoPlayer) {
          END_TURN(true);
        } else {
          if (
            me?.user_id &&
            recordTimeoutCalledForTurn.current !== turnStartSec
          ) {
            recordTimeoutCalledForTurn.current = turnStartSec;
            apiClient
              .post<ApiResponse>("/game-players/record-timeout", {
                game_id: currentGame.id,
                user_id: me.user_id,
                target_user_id: currentPlayer.user_id,
              })
              .then(() => fetchUpdatedGame())
              .catch((err) => console.warn("record-timeout failed:", err));
          }
        }
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [currentPlayer?.turn_start, currentPlayer?.user_id, isTwoPlayer, me?.user_id, currentGame.id, END_TURN, fetchUpdatedGame, hasRolled]);

  // 30s inactivity after roll → auto-end turn
  useEffect(() => {
    if (!isMyTurn || !hasRolled || actionLock || isRolling) return;
    const check = () => {
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs >= INACTIVITY_SECONDS * 1000) END_TURN();
    };
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [isMyTurn, hasRolled, actionLock, isRolling, END_TURN]);

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

  // Get vote status for a target player
  const fetchVoteStatus = useCallback(
    async (targetUserId: number) => {
      if (!currentGame?.id) return;
      try {
        const res = await apiClient.post<ApiResponse>("/game-players/vote-status", {
          game_id: currentGame.id,
          target_user_id: targetUserId,
        });
        const data = res?.data?.data;
        if (res?.data?.success && data) {
          setVoteStatuses((prev) => ({
            ...prev,
            [targetUserId]: data,
          }));
        }
      } catch (err) {
        console.error("Failed to fetch vote status:", err);
      }
    },
    [currentGame?.id]
  );

  // Vote to remove a player
  const voteToRemove = useCallback(
    async (targetUserId: number) => {
      touchActivity();
      if (!me?.user_id || !currentGame?.id) return;
      setVotingLoading((prev) => ({ ...prev, [targetUserId]: true }));
      try {
        const res = await apiClient.post<ApiResponse>("/game-players/vote-to-remove", {
          game_id: currentGame.id,
          user_id: me.user_id,
          target_user_id: targetUserId,
        });
        if (res?.data?.success) {
          const data = res.data.data;
          setVoteStatuses((prev) => ({
            ...prev,
            [targetUserId]: {
              vote_count: data.vote_count,
              required_votes: data.required_votes,
              voters: [],
            },
          }));
          if (data.removed) {
            showToast(`${players.find((p) => p.user_id === targetUserId)?.username || "Player"} has been removed`, "success");
            await fetchUpdatedGame();
          } else {
            showToast(`Vote recorded. ${data.vote_count}/${data.required_votes} votes.`, "default");
            await fetchVoteStatus(targetUserId);
          }
        }
      } catch (err: unknown) {
        toast.error(getContractErrorMessage(err, "Failed to vote"));
      } finally {
        setVotingLoading((prev) => ({ ...prev, [targetUserId]: false }));
      }
    },
    [currentGame?.id, me?.user_id, players, fetchUpdatedGame, fetchVoteStatus, showToast, touchActivity]
  );

  const removeInactive = useCallback(
    async (targetUserId: number) => {
      // Redirect to voting system
      await voteToRemove(targetUserId);
    },
    [voteToRemove]
  );

  // Voteable players: timed out OR 3+ consecutive timeouts
  const voteablePlayers = useMemo(
    () => {
      const otherPlayers = players.filter((p) => p.user_id !== me?.user_id);
      return players.filter((p) => {
        if (p.user_id === me?.user_id) return false;
        const strikes = p.consecutive_timeouts ?? 0;
        const isCurrentPlayer = p.user_id === currentPlayerId;
        const timeElapsed = turnTimeLeft != null && turnTimeLeft <= 0;
        if (otherPlayers.length === 1) {
          return strikes >= 3;
        }
        return strikes > 0 || (isCurrentPlayer && timeElapsed);
      });
    },
    [players, me?.user_id, currentPlayerId, turnTimeLeft]
  );

  // Legacy: removablePlayers for backward compatibility
  const removablePlayers = useMemo(
    () => players.filter((p) => p.user_id !== me?.user_id && (p.consecutive_timeouts ?? 0) >= 3),
    [players, me?.user_id]
  );

  // Fetch vote statuses for voteable players
  useEffect(() => {
    if (!currentGame?.id || !me?.user_id) return;
    voteablePlayers.forEach((p) => {
      fetchVoteStatus(p.user_id);
    });
  }, [currentGame?.id, me?.user_id, voteablePlayers, fetchVoteStatus]);

  const BUY_PROPERTY = useCallback(async () => {
    touchActivity();
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
    } catch (err) {
      toast.error(getContractErrorMessage(err, "Purchase failed"));
    }
  }, [currentPlayer, justLandedProperty, actionLock, END_TURN, showToast, currentGame.id, fetchUpdatedGame, touchActivity]);

  const ROLL_DICE = useCallback(async (forAI = false) => {
    if (isRolling || actionLock || !lockAction("ROLL")) return;
    touchActivity();

    const playerId = forAI ? currentPlayerId! : me!.user_id;
    const player = players.find((p) => p.user_id === playerId);
    if (!player) {
      unlockAction();
      return;
    }

    const isInJail = Boolean(player.in_jail) && Number(player.position) === JAIL_POSITION;

    if (isInJail) {
      setIsRolling(true);
      // Jail roll — result visible

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
          } catch (err) {
            toast.error(getContractErrorMessage(err, "Jail roll failed"));
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
          // Escaped jail — state visible
        } catch (err) {
          toast.error(getContractErrorMessage(err, "Escape failed"));
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
        // Doubles visible — no toast
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
        // Roll visible on board — no toast
      } catch (err) {
        console.error("Move failed:", err);
        toast.error(getContractErrorMessage(err, "Move failed"));
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
    touchActivity,
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
      toast.error(getContractErrorMessage(err, "Bankruptcy failed — but you are eliminated."));
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
        getContractErrorMessage(err, "Something went wrong — try again later"),
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

  const handlePropertyClick = useCallback((propertyId: number) => {
    touchActivity();
    const prop = properties.find(p => p.id === propertyId);
    const gp = currentGameProperties.find(g => g.property_id === propertyId);
    if (prop) {
      setSelectedProperty(prop);
      setSelectedGameProperty(gp);
    }
  }, [properties, currentGameProperties, touchActivity]);

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
    <div className="w-full min-h-screen bg-black text-white flex flex-col items-center justify-start relative overflow-x-hidden overflow-y-auto">
      <button
        onClick={fetchUpdatedGame}
        className="fixed top-4 right-4 z-50 bg-blue-500 text-white text-xs px-2 py-1 rounded-full hover:bg-blue-600 transition"
      >
        Refresh
      </button>

      <div className="w-full max-w-2xl mx-auto px-4 mt-2 mb-1 flex items-center justify-between gap-3 flex-shrink-0 min-h-[44px]">
        <PlayerStatus currentPlayer={currentPlayer} isAITurn={!isMyTurn} buyPrompted={buyPrompted} compact />
        <TradeAlertPill
          incomingCount={myIncomingTrades.length}
          onViewTrades={onViewTrades}
          newTradePulse={bellFlash}
        />
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
            centerContent={
              <div className="flex flex-col items-center justify-center gap-3 text-center min-h-[80px] px-4 py-3 z-30 relative w-full">
                {currentGame?.duration && Number(currentGame.duration) > 0 && (
                  <GameDurationCountdown game={currentGame} compact />
                )}
                {turnTimeLeft != null && (
                  <div className={`font-mono font-bold rounded-lg px-3 py-1.5 bg-black/90 text-sm ${(turnTimeLeft ?? 90) <= 10 ? "text-red-400 animate-pulse" : "text-cyan-300"}`}>
                    {roll
                      ? isMyTurn
                        ? `Complete in ${Math.floor((turnTimeLeft ?? 90) / 60)}:${((turnTimeLeft ?? 90) % 60).toString().padStart(2, "0")}`
                        : `${currentPlayer?.username ?? "Player"} has ${Math.floor((turnTimeLeft ?? 90) / 60)}:${((turnTimeLeft ?? 90) % 60).toString().padStart(2, "0")} to wrap up`
                      : isMyTurn
                        ? `Roll in ${Math.floor((turnTimeLeft ?? 90) / 60)}:${((turnTimeLeft ?? 90) % 60).toString().padStart(2, "0")}`
                        : `${currentPlayer?.username ?? "Player"} has ${Math.floor((turnTimeLeft ?? 90) / 60)}:${((turnTimeLeft ?? 90) % 60).toString().padStart(2, "0")} to roll`}
                  </div>
                )}
                {!isMyTurn && (
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-base font-bold text-cyan-300">
                      {currentPlayer?.username ?? "Player"} is playing…
                    </span>
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-400/50 border-t-cyan-400" />
                  </div>
                )}
                {isMyTurn && !isRolling && !isRaisingFunds && !showInsolvencyModal && (
                  hasNegativeBalance ? (
                    <button
                      onClick={handleBankruptcy}
                      className="py-2 px-6 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-bold text-sm rounded-full shadow-md border border-white/20"
                    >
                      Declare Bankruptcy
                    </button>
                  ) : (
                    <button
                      onClick={() => ROLL_DICE(false)}
                      className="py-2.5 px-8 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-bold text-sm rounded-full shadow-lg border border-cyan-300/30"
                    >
                      Roll Dice
                    </button>
                  )
                )}
              </div>
            }
          />
        </motion.div>
      </div>

      <DiceAnimation
        isRolling={isRolling && !(currentPlayer?.in_jail && currentPlayer.position === JAIL_POSITION)}
        roll={roll}
      />

      {/* Balance bar above action log — matches AI mobile layout */}
      <div className="w-full max-w-2xl mx-auto px-4 mt-6 mb-4">
        <MyBalanceBar me={me} bottomBar />
      </div>
      <div className="w-full max-w-2xl mx-auto px-4 pb-40">
        <GameLog history={currentGame.history} />
      </div>

      {/* Vote to remove inactive/timed-out players */}
      {voteablePlayers.length > 0 && (
        <div className="flex flex-col gap-2 px-2 py-2 bg-red-950/40 border-b border-red-500/30">
          {voteablePlayers.map((p) => {
            const strikes = p.consecutive_timeouts ?? 0;
            const status = voteStatuses[p.user_id];
            const isLoading = votingLoading[p.user_id];
            const hasVoted = status?.voters?.some((v) => v.user_id === me?.user_id) ?? false;
            
            return (
              <div
                key={p.user_id}
                className="bg-red-950/60 border border-red-500/50 rounded-lg p-2 flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-xs font-bold text-red-300 truncate">
                      {p.username}
                      {strikes > 0 && ` (${strikes} timeout${strikes > 1 ? 's' : ''})`}
                    </span>
                    {status && (
                      <span className="text-xs text-red-200/70">
                        Votes: {status.vote_count}/{status.required_votes}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => voteToRemove(p.user_id)}
                    disabled={isLoading || hasVoted}
                    className={`text-xs font-medium rounded-lg px-3 py-1.5 border transition-all shrink-0 ${
                      hasVoted
                        ? "bg-green-900/60 text-green-200 border-green-500/50"
                        : isLoading
                        ? "bg-amber-900/60 text-amber-200 border-amber-500/50"
                        : "bg-red-900/80 text-red-200 border-red-500/50 active:scale-95"
                    }`}
                  >
                    {hasVoted ? "✓ Voted" : isLoading ? "..." : "Vote Out"}
                  </button>
                </div>
                {status && status.voters && status.voters.length > 0 && (
                  <div className="text-xs text-red-200/50 truncate">
                    Voted: {status.voters.map((v) => v.username).join(", ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <BuyPromptModal
        visible={!!(isMyTurn && buyPrompted && justLandedProperty)}
        property={justLandedProperty ?? null}
        onBuy={BUY_PROPERTY}
        onSkip={() => {
          touchActivity();
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
        onDevelop={() => { touchActivity(); handleDevelopment(); }}
        onDowngrade={() => { touchActivity(); handleDevelopment(); }}
        onMortgageToggle={() => { touchActivity(); handleMortgageToggle(); }}
        onSellProperty={() => { touchActivity(); handleSellProperty(); }}
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