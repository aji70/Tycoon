"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import {
  Game,
  GameProperty,
  Property,
  Player,
  PROPERTY_ACTION,
} from "@/types/game";
import { ApiResponse } from "@/types/api";
import { apiClient } from "@/lib/api";
import { useExitGame, useGetGameByCode, useTransferPropertyOwnership } from "@/context/ContractProvider";
import {
  BOARD_SQUARES,
  ROLL_ANIMATION_MS,
  MOVE_ANIMATION_MS_PER_SQUARE,
  JAIL_POSITION,
  getDiceValues,
} from "../constants";
import { usePropertyActions } from "@/hooks/usePropertyActions";

export interface UseGameBoardLogicProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  me: Player | null;
  /** Called after successfully removing an inactive player so parent can refetch game */
  onGameUpdated?: () => void;
}

export function useGameBoardLogic({
  game,
  properties,
  game_properties,
  me,
  onGameUpdated,
}: UseGameBoardLogicProps) {
  const [players, setPlayers] = useState<Player[]>(game?.players ?? []);
  const [roll, setRoll] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [pendingRoll, setPendingRoll] = useState(0);
  const [actionLock, setActionLock] = useState<"ROLL" | "END" | null>(null);
  const [buyPrompted, setBuyPrompted] = useState(false);
  const [animatedPositions, setAnimatedPositions] = useState<Record<number, number>>({});
  const [hasMovementFinished, setHasMovementFinished] = useState(false);
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
  const [showBankruptcyModal, setShowBankruptcyModal] = useState(false);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [turnTimeLeft, setTurnTimeLeft] = useState<number | null>(null);

  const landedPositionThisTurn = useRef<number | null>(null);
  const turnEndInProgress = useRef(false);
  const lastToastMessage = useRef<string | null>(null);

  const { write: transferOwnership, isPending: isCreatePending } = useTransferPropertyOwnership();
  const { data: contractGame } = useGetGameByCode(game.code);
  const onChainGameId = contractGame?.id;
  const exitHook = useExitGame(onChainGameId ?? BigInt(0));

  const currentPlayerId = game.next_player_id ?? -1;
  const currentPlayer = players.find((p) => p.user_id === currentPlayerId);
  const isMyTurn = me?.user_id === currentPlayerId;
  const isNext = !!me && game.next_player_id === me.user_id;
  const playerCanRoll = Boolean(isMyTurn && currentPlayer && (currentPlayer.balance ?? 0) > 0);

  const currentProperty = useMemo(() => {
    return currentPlayer?.position
      ? properties.find((p) => p.id === currentPlayer.position) ?? null
      : null;
  }, [currentPlayer?.position, properties]);

  const justLandedProperty = useMemo(() => {
    if (landedPositionThisTurn.current === null) return null;
    return properties.find((p) => p.id === landedPositionThisTurn.current) ?? null;
  }, [landedPositionThisTurn.current, properties]);

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
    turnEndInProgress.current = false;
    lastToastMessage.current = null;
    setAnimatedPositions({});
    setHasMovementFinished(false);
    setTurnTimeLeft(null);
  }, [currentPlayerId]);

  const lockAction = useCallback((type: "ROLL" | "END") => {
    if (actionLock) return false;
    setActionLock(type);
    return true;
  }, [actionLock]);

  const unlockAction = useCallback(() => setActionLock(null), []);

  const END_TURN = useCallback(async (timedOut?: boolean) => {
    if (currentPlayerId === -1 || turnEndInProgress.current || !lockAction("END")) return;
    turnEndInProgress.current = true;
    try {
      await apiClient.post("/game-players/end-turn", {
        user_id: currentPlayerId,
        game_id: game.id,
        ...(timedOut === true && { timed_out: true }),
      });
      showToast(timedOut ? "Time's up! Turn ended." : "Turn ended", timedOut ? "default" : "success");
    } catch {
      showToast("Failed to end turn", "error");
    } finally {
      unlockAction();
      turnEndInProgress.current = false;
    }
  }, [currentPlayerId, game.id, lockAction, unlockAction, showToast]);

  useEffect(() => {
    if (!isMyTurn || !playerCanRoll) {
      setTurnTimeLeft(null);
      return;
    }
    // Start countdown immediately: use server turn_start if present, otherwise "now" so timer doesn't wait for next poll
    const raw = currentPlayer?.turn_start;
    const turnStartSec = raw ? parseInt(currentPlayer.turn_start, 10) : Math.floor(Date.now() / 1000);
    if (Number.isNaN(turnStartSec)) {
      setTurnTimeLeft(null);
      return;
    }
    const TURN_ROLL_SECONDS = 90;
    const tick = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const elapsed = nowSec - turnStartSec;
      const remaining = Math.max(0, TURN_ROLL_SECONDS - elapsed);
      setTurnTimeLeft(remaining);
      if (remaining <= 0) {
        END_TURN(true);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isMyTurn, playerCanRoll, currentPlayer?.turn_start, END_TURN, showToast]);

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
      await transferOwnership("", buyerUsername);
      await apiClient.post<ApiResponse>("/game-properties/buy", {
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
  }, [currentPlayer, justLandedProperty, actionLock, END_TURN, showToast, game.id, roll, me?.username, transferOwnership]);

  const triggerLandingLogic = useCallback((newPosition: number, isSpecial = false) => {
    if (landedPositionThisTurn.current !== null) return;
    landedPositionThisTurn.current = newPosition;
    setRoll({ die1: 0, die2: 0, total: 0 });
    setHasMovementFinished(true);
    setTimeout(() => {
      const square = properties.find((p) => p.id === newPosition);
      if (square?.price != null) {
        const isOwned = game_properties.some((gp) => gp.property_id === newPosition);
        if (!isOwned && ["land", "railway", "utility"].includes(PROPERTY_ACTION(newPosition) || "")) {
          setBuyPrompted(true);
          toast(`Landed on ${square.name}! ${isSpecial ? "(Special Move)" : ""}`, { icon: "✨" });
        }
      }
    }, 100);
  }, [properties, game_properties]);

  const endTurnAfterSpecialMove = useCallback(() => {
    setBuyPrompted(false);
    landedPositionThisTurn.current = null;
    setTimeout(END_TURN, 800);
  }, [END_TURN]);

  const fetchUpdatedGame = useCallback(async () => {
    try {
      const res = await apiClient.get<ApiResponse>(`/games/code/${game.code}`);
      if (res?.data?.success && res.data.data?.players) {
        setPlayers(res.data.data.players);
      }
    } catch (err) {
      console.error("Sync failed:", err);
    }
  }, [game.code]);

  const ROLL_DICE = useCallback(async () => {
    if (isRolling || actionLock || !lockAction("ROLL")) return;
    const playerId = me!.user_id;
    const player = players.find((p) => p.user_id === playerId);
    if (!player) {
      unlockAction();
      return;
    }
    const isInJail = Boolean(player.in_jail) && Number(player.position) === JAIL_POSITION;

    if (isInJail) {
      setIsRolling(true);
      const value = getDiceValues();
      if (!value || value.die1 !== value.die2) {
        setTimeout(async () => {
          try {
            await apiClient.post("/game-players/change-position", {
              user_id: playerId,
              game_id: game.id,
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
            game_id: game.id,
            position: newPos,
            rolled: totalMove,
            is_double: true,
          });
          landedPositionThisTurn.current = newPos;
          await fetchUpdatedGame();
          showToast("Rolled doubles and escaped jail!", "success");
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
      const newPos = (currentPos + totalMove) % BOARD_SQUARES;

      if (totalMove > 0) {
        const movePath: number[] = [];
        for (let i = 1; i <= totalMove; i++) {
          movePath.push((currentPos + i) % BOARD_SQUARES);
        }
        for (let i = 0; i < movePath.length; i++) {
          await new Promise((r) => setTimeout(r, MOVE_ANIMATION_MS_PER_SQUARE));
          setAnimatedPositions((prev) => ({ ...prev, [playerId]: movePath[i] }));
        }
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
        landedPositionThisTurn.current = newPos;
        await fetchUpdatedGame();
        showToast(`You rolled ${value.die1} + ${value.die2} = ${value.total}!`, "success");
      } catch (err) {
        console.error("Move failed:", err);
        showToast("Move failed", "error");
        END_TURN();
      } finally {
        setIsRolling(false);
        unlockAction();
      }
    }, ROLL_ANIMATION_MS);
  }, [isRolling, actionLock, lockAction, unlockAction, me, players, pendingRoll, game.id, fetchUpdatedGame, showToast, END_TURN]);

  useEffect(() => {
    if (!roll || !hasMovementFinished || buyPrompted || actionLock || isRolling) return;
    const timer = setTimeout(END_TURN, 1500);
    return () => clearTimeout(timer);
  }, [roll, hasMovementFinished, buyPrompted, actionLock, isRolling, END_TURN]);

  const playersByPosition = useMemo(() => {
    const map = new Map<number, Player[]>();
    players.forEach((p) => {
      const pos = animatedPositions[p.user_id] !== undefined ? animatedPositions[p.user_id] : (p.position ?? 0);
      if (!map.has(pos)) map.set(pos, []);
      map.get(pos)!.push(p);
    });
    return map;
  }, [players, animatedPositions]);

  const propertyOwner = useCallback((id: number) => {
    const gp = game_properties.find((g) => g.property_id === id);
    return gp ? players.find((p) => p.address === gp.address)?.username ?? null : null;
  }, [game_properties, players]);

  const developmentStage = useCallback((id: number) => {
    return game_properties.find((g) => g.property_id === id)?.development ?? 0;
  }, [game_properties]);

  const isPropertyMortgaged = useCallback((id: number) => {
    return game_properties.find((g) => g.property_id === id)?.mortgaged === true;
  }, [game_properties]);

  const handlePropertyClick = useCallback((square: Property) => {
    setSelectedProperty(square);
  }, []);

  const handleSkipBuy = useCallback(() => {
    showToast("Skipped purchase");
    setBuyPrompted(false);
    landedPositionThisTurn.current = null;
    setTimeout(END_TURN, 900);
  }, [showToast, END_TURN]);

  const handleBankruptcy = useCallback(async () => {
    if (!me || !game?.id || !game?.code) {
      showToast("Cannot declare bankruptcy right now", "error");
      return;
    }
    showToast("Declaring bankruptcy...", "error");
    let creditorPlayerId: number | null = null;
    if (justLandedProperty) {
      const landedGameProp = game_properties.find((gp) => gp.property_id === justLandedProperty.id);
      if (landedGameProp?.address && landedGameProp.address !== "bank") {
        const owner = players.find(
          (p) => p.address?.toLowerCase() === landedGameProp.address?.toLowerCase() && p.user_id !== me.user_id
        );
        if (owner) creditorPlayerId = owner.user_id;
      }
    }
    try {
      if (exitHook.exit) await exitHook.exit();
      const myOwnedProperties = game_properties.filter(
        (gp) => gp.address?.toLowerCase() === me.address?.toLowerCase()
      );
      if (myOwnedProperties.length === 0) {
        showToast("You have no properties to transfer.", "default");
      } else if (creditorPlayerId) {
        showToast("Transferring all properties to the player who bankrupted you...", "error");
        let successCount = 0;
        for (const gp of myOwnedProperties) {
          try {
            await apiClient.put(`/game-properties/${gp.id}`, { game_id: game.id, player_id: creditorPlayerId });
            successCount++;
          } catch (err) {
            console.error(`Failed to transfer ${gp.property_id}`, err);
          }
        }
        toast.success(`${successCount}/${myOwnedProperties.length} properties transferred!`);
      } else {
        showToast("Returning all properties to the bank...", "error");
        let successCount = 0;
        for (const gp of myOwnedProperties) {
          try {
            await apiClient.delete(`/game-properties/${gp.id}`, { data: { game_id: game.id } });
            successCount++;
          } catch (err) {
            console.error(`Failed to return ${gp.property_id}`, err);
          }
        }
        toast.success(`${successCount}/${myOwnedProperties.length} properties returned to bank.`);
      }
      await END_TURN();
      await apiClient.post("/game-players/leave", { address: me.address, code: game.code, reason: "bankruptcy" });
      await fetchUpdatedGame();
      showToast("You have declared bankruptcy and left the game.", "error");
      setShowExitPrompt(true);
    } catch (err: unknown) {
      console.error("Bankruptcy process failed:", err);
      showToast("Bankruptcy failed — but you are eliminated.", "error");
      try {
        await END_TURN();
      } catch {
        /* noop */
      }
      setTimeout(() => {
        window.location.href = "/";
      }, 3000);
    } finally {
      setShowBankruptcyModal(false);
      setBuyPrompted(false);
      landedPositionThisTurn.current = null;
    }
  }, [me, game, justLandedProperty, game_properties, players, showToast, fetchUpdatedGame, END_TURN, exitHook.exit]);

  const { handleDevelopment, handleDowngrade, handleMortgage, handleUnmortgage } = usePropertyActions(
    game.id,
    me?.user_id,
    isNext
  );

  const removeInactive = useCallback(
    async (targetUserId: number) => {
      if (!me?.user_id || !game?.id) return;
      try {
        await apiClient.post("/game-players/remove-inactive", {
          game_id: game.id,
          user_id: me.user_id,
          target_user_id: targetUserId,
        });
        await fetchUpdatedGame();
        onGameUpdated?.();
        showToast("Player removed due to inactivity.", "default");
      } catch (err: unknown) {
        const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : "Failed to remove player";
        showToast(msg, "error");
      }
    },
    [game?.id, me?.user_id, fetchUpdatedGame, onGameUpdated, showToast]
  );

  return {
    players,
    roll,
    isRolling,
    buyPrompted,
    animatedPositions,
    hasMovementFinished,
    showPerksModal,
    setShowPerksModal,
    showCardModal,
    setShowCardModal,
    cardData,
    setCardData,
    cardPlayerName,
    setCardPlayerName,
    selectedProperty,
    setSelectedProperty,
    showBankruptcyModal,
    setShowBankruptcyModal,
    showExitPrompt,
    setShowExitPrompt,
    currentPlayerId,
    currentPlayer,
    isMyTurn,
    playerCanRoll,
    currentProperty,
    justLandedProperty,
    playersByPosition,
    propertyOwner,
    developmentStage,
    isPropertyMortgaged,
    handleRollDice: () => ROLL_DICE(),
    handleBuyProperty: () => BUY_PROPERTY(),
    handleSkipBuy,
    handleBankruptcy,
    handleDevelopment,
    handleDowngrade,
    handleMortgage,
    handleUnmortgage,
    handlePropertyClick,
    ROLL_DICE,
    END_TURN,
    triggerLandingLogic,
    endTurnAfterSpecialMove,
    transferOwnership,
    isCreatePending,
    exitHook,
    turnTimeLeft,
    removeInactive,
  };
}
