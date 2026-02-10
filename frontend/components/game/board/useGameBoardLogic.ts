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

export interface UseGameBoardLogicProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  me: Player | null;
}

export function useGameBoardLogic({
  game,
  properties,
  game_properties,
  me,
}: UseGameBoardLogicProps) {
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
  const [showBankruptcyModal, setShowBankruptcyModal] = useState(false);
  const [showExitPrompt, setShowExitPrompt] = useState(false);

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
    const buyerUsername = me?.username;
    if (!buyerUsername) {
      showToast("Cannot buy: your username is missing", "error");
      return;
    }
    try {
      showToast("Sending transaction...", "default");
      await transferOwnership("", buyerUsername);
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
  }, [currentPlayer, justLandedProperty, actionLock, END_TURN, showToast, game.id, roll, me?.username, transferOwnership]);

  const triggerLandingLogic = useCallback((newPosition: number, isSpecial = false) => {
    if (landedPositionThisTurn.current !== null) return;
    landedPositionThisTurn.current = newPosition;
    setIsSpecialMove(isSpecial);
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

  const ROLL_DICE = useCallback(async () => {
    if (isRolling || actionLock || !lockAction("ROLL") || !currentPlayer) return;
    setIsRolling(true);
    setRoll(null);
    setHasMovementFinished(false);
    setAnimatedPositions({});

    setTimeout(async () => {
      let value = getDiceValues();
      while (value === null) {
        showToast("DOUBLES! Rolling again...", "success");
        await new Promise((resolve) => setTimeout(resolve, 600));
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
            await new Promise((resolve) => setTimeout(resolve, MOVE_ANIMATION_MS_PER_SQUARE));
            setAnimatedPositions((prev) => ({
              ...prev,
              [currentPlayer.user_id]: movePath[i],
            }));
          }
        }
        setAnimatedPositions((prev) => ({
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

  useEffect(() => {
    if (!hasMovementFinished || landedPositionThisTurn.current === null) {
      setBuyPrompted(false);
      return;
    }
    const pos = landedPositionThisTurn.current;
    const square = properties.find((p) => p.id === pos);
    if (!square || square.price == null) {
      setBuyPrompted(false);
      return;
    }
    const isOwned = game_properties.some((gp) => gp.property_id === pos);
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
  }, [hasMovementFinished, landedPositionThisTurn.current, game_properties, properties, currentPlayer, showToast]);

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
      const pos =
        animatedPositions[p.user_id] !== undefined ? animatedPositions[p.user_id] : (p.position ?? 0);
      if (!map.has(pos)) map.set(pos, []);
      map.get(pos)!.push(p);
    });
    return map;
  }, [players, animatedPositions]);

  const propertyOwner = useCallback(
    (id: number) => {
      const gp = game_properties.find((g) => g.property_id === id);
      return gp ? players.find((p) => p.address === gp.address)?.username || null : null;
    },
    [game_properties, players]
  );

  const developmentStage = useCallback(
    (id: number) => game_properties.find((gp) => gp.property_id === id)?.development ?? 0,
    [game_properties]
  );

  const isPropertyMortgaged = useCallback(
    (id: number) => game_properties.find((gp) => gp.property_id === id)?.mortgaged === true,
    [game_properties]
  );

  const handleBankruptcy = useCallback(async () => {
    if (!me || !game.id || !game.code) {
      showToast("Cannot declare bankruptcy right now", "error");
      return;
    }
    showToast("Declaring bankruptcy...", "error");
    let creditorPlayerId: number | null = null;
    if (justLandedProperty) {
      const landedGameProp = game_properties.find((gp) => gp.property_id === justLandedProperty.id);
      if (landedGameProp?.address && landedGameProp.address !== "bank") {
        const owner = players.find(
          (p) =>
            p.address?.toLowerCase() === landedGameProp.address?.toLowerCase() && p.user_id !== me.user_id
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
        showToast(`Transferring all properties to the player who bankrupted you...`, "error");
        let successCount = 0;
        for (const gp of myOwnedProperties) {
          try {
            await apiClient.put(`/game-properties/${gp.id}`, {
              game_id: game.id,
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
              data: { game_id: game.id },
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
        code: game.code,
        reason: "bankruptcy",
      });
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
  }, [
    me,
    game,
    justLandedProperty,
    game_properties,
    players,
    showToast,
    fetchUpdatedGame,
    END_TURN,
    exitHook.exit,
  ]);

  const handleDevelopment = useCallback(
    async (id: number) => {
      if (!isNext || !me) return;
      try {
        const res = await apiClient.post<ApiResponse>("/game-properties/development", {
          game_id: game.id,
          user_id: me.user_id,
          property_id: id,
        });
        if (res?.data?.success) toast.success("Property developed successfully");
      } catch (error: unknown) {
        toast.error((error as Error)?.message || "Failed to develop property");
      }
    },
    [isNext, me, game.id]
  );

  const handleDowngrade = useCallback(
    async (id: number) => {
      if (!isNext || !me) return;
      try {
        const res = await apiClient.post<ApiResponse>("/game-properties/downgrade", {
          game_id: game.id,
          user_id: me.user_id,
          property_id: id,
        });
        if (res?.data?.success) toast.success("Property downgraded successfully");
        else toast.error(res.data?.message ?? "Failed to downgrade property");
      } catch (error: unknown) {
        toast.error((error as Error)?.message || "Failed to downgrade property");
      }
    },
    [isNext, me, game.id]
  );

  const handleMortgage = useCallback(
    async (id: number) => {
      if (!isNext || !me) return;
      try {
        const res = await apiClient.post<ApiResponse>("/game-properties/mortgage", {
          game_id: game.id,
          user_id: me.user_id,
          property_id: id,
        });
        if (res?.data?.success) toast.success("Property mortgaged successfully");
        else toast.error(res.data?.message ?? "Failed to mortgage property");
      } catch (error: unknown) {
        toast.error((error as Error)?.message || "Failed to mortgage property");
      }
    },
    [isNext, me, game.id]
  );

  const handleUnmortgage = useCallback(
    async (id: number) => {
      if (!isNext || !me) return;
      try {
        const res = await apiClient.post<ApiResponse>("/game-properties/unmortgage", {
          game_id: game.id,
          user_id: me.user_id,
          property_id: id,
        });
        if (res?.data?.success) toast.success("Property unmortgaged successfully");
        else toast.error(res.data?.message ?? "Failed to unmortgage property");
      } catch (error: unknown) {
        toast.error((error as Error)?.message || "Failed to unmortgage property");
      }
    },
    [isNext, me, game.id]
  );

  const handlePropertyClick = useCallback(
    (square: Property) => {
      const gp = game_properties.find((g) => g.property_id === square.id);
      if (gp?.address?.toLowerCase() === me?.address?.toLowerCase()) {
        setSelectedProperty(square);
      } else {
        showToast("You don't own this property", "error");
      }
    },
    [game_properties, me?.address, showToast]
  );

  const handleSkipBuy = useCallback(() => {
    showToast("Skipped purchase");
    setBuyPrompted(false);
    landedPositionThisTurn.current = null;
    setTimeout(END_TURN, 900);
  }, [showToast, END_TURN]);

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
    currentPlayerInJail,
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
  };
}
