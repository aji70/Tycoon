"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import type { Game, GameProperty, Property, Player } from "@/types/game";
import { ApiResponse } from "@/types/api";
import { apiClient } from "@/lib/api";
import { useGetGameByCode, useEndAIGameAndClaim } from "@/context/ContractProvider";
import { usePropertyActions } from "@/hooks/usePropertyActions";
import { getContractErrorMessage } from "@/lib/utils/contractErrors";
import { isAIPlayer } from "@/utils/gameUtils";
import { calculateBuyScore } from "./aiBoardUtils";
import {
  BOARD_SQUARES,
  ROLL_ANIMATION_MS,
  MOVE_ANIMATION_MS_PER_SQUARE,
  JAIL_POSITION,
  BUILD_PRIORITY,
  MONOPOLY_STATS,
  getDiceValues,
} from "../constants";
import { PROPERTY_ACTION } from "@/types/game";

export interface UseAIBoardLogicProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  me: Player | null;
  onFinishGameByTime?: () => Promise<void>;
  /** When provided, called after actions that change game state (END_TURN, BUY_PROPERTY, position change). Used by mobile to refetch game/game_properties. */
  onGameUpdated?: () => void | Promise<void>;
  /** When true, the hook does not run its own polling interval. Used by mobile which has its own fetch interval. */
  disablePolling?: boolean;
}

export function useAIBoardLogic({
  game,
  properties,
  game_properties,
  me,
  onFinishGameByTime,
  onGameUpdated,
  disablePolling = false,
}: UseAIBoardLogicProps) {
  const [players, setPlayers] = useState<Player[]>(game?.players ?? []);
  const [gameTimeUp, setGameTimeUp] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const timeUpHandledRef = useRef(false);
  const [roll, setRoll] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [pendingRoll, setPendingRoll] = useState(0);
  const [actionLock, setActionLock] = useState<"ROLL" | "END" | null>(null);
  const [buyPrompted, setBuyPrompted] = useState(false);
  const [animatedPositions, setAnimatedPositions] = useState<Record<number, number>>({});
  const [hasMovementFinished, setHasMovementFinished] = useState(false);
  const [strategyRanThisTurn, setStrategyRanThisTurn] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
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
  const [showBankruptcyModal, setShowBankruptcyModal] = useState(false);
  const [endGameCandidate, setEndGameCandidate] = useState<{
    winner: Player | null;
    position: number;
    balance: bigint;
    validWin?: boolean;
  }>({ winner: null, position: 0, balance: BigInt(0), validWin: true });

  const landedPositionThisTurn = useRef<number | null>(null);
  const turnEndInProgress = useRef(false);
  const lastToastMessage = useRef<string | null>(null);
  const rolledForPlayerId = useRef<number | null>(null);
  const prevHistoryLength = useRef(game.history?.length ?? 0);

  const currentPlayerId = game.next_player_id ?? -1;
  const currentPlayer = players.find((p) => p.user_id === currentPlayerId);
  const isMyTurn = me?.user_id === currentPlayerId;
  const isAITurn = !!currentPlayer && isAIPlayer(currentPlayer);
  const playerCanRoll = Boolean(
    isMyTurn && currentPlayer && (currentPlayer.balance ?? 0) > 0 && !gameTimeUp
  );

  const currentProperty = useMemo(
    () =>
      currentPlayer?.position
        ? properties.find((p) => p.id === currentPlayer.position) ?? null
        : null,
    [currentPlayer?.position, properties]
  );

  const justLandedProperty = useMemo(() => {
    if (landedPositionThisTurn.current === null) return null;
    return properties.find((p) => p.id === landedPositionThisTurn.current!) ?? null;
  }, [landedPositionThisTurn.current, properties]);

  const { data: contractGame } = useGetGameByCode(game.code);
  const onChainGameId = contractGame?.id;
  const {
    write: endGame,
    isPending: endGamePending,
    reset: endGameReset,
  } = useEndAIGameAndClaim(
    onChainGameId ?? BigInt(0),
    endGameCandidate.position,
    BigInt(endGameCandidate.balance),
    endGameCandidate.winner ? (endGameCandidate.validWin !== false) : false
  );

  const buyScore = useMemo(() => {
    if (!isAITurn || !buyPrompted || !currentPlayer || !justLandedProperty) return null;
    return calculateBuyScore(justLandedProperty, currentPlayer, game_properties, properties);
  }, [isAITurn, buyPrompted, currentPlayer, justLandedProperty, game_properties, properties]);

  const showToast = useCallback((message: string, type: "success" | "error" | "default" = "default") => {
    if (
      type === "success" &&
      (message.startsWith("You bought") ||
        message.startsWith("AI bought") ||
        (message.includes("bought") && message.endsWith("!")))
    ) {
      toast.success(message);
    }
  }, []);

  const handleGameTimeUp = useCallback(async () => {
    if (timeUpHandledRef.current || game.status !== "RUNNING") return;
    timeUpHandledRef.current = true;
    setGameTimeUp(true);
    try {
      const res = await apiClient.post<{
        success?: boolean;
        data?: { winner_id: number; game?: { players?: Player[] }; valid_win?: boolean };
      }>(`/games/${game.id}/finish-by-time`);
      const data = res?.data?.data;
      const winnerId = data?.winner_id;
      if (winnerId == null) {
        throw new Error((res?.data as { error?: string })?.error ?? "Could not finish game by time");
      }
      const updatedPlayers = data?.game?.players ?? players;
      const winnerPlayer = updatedPlayers.find((p: Player) => p.user_id === winnerId) ?? null;
      setWinner(winnerPlayer);
      const myPosition = me?.position ?? 0;
      const myBalance = BigInt(me?.balance ?? 0);
      const validWin = data?.valid_win !== false;
      if (winnerId === me?.user_id) {
        setEndGameCandidate({ winner: me!, position: myPosition, balance: myBalance, validWin });
      } else {
        setEndGameCandidate({ winner: null, position: myPosition, balance: myBalance, validWin: true });
      }
      setShowExitPrompt(true);
      await onFinishGameByTime?.();
    } catch (e) {
      console.error("Time up / finish-by-time failed:", e);
      timeUpHandledRef.current = false;
      setGameTimeUp(false);
    }
  }, [game.id, game.status, me, players, onFinishGameByTime]);

  const handleFinalizeTimeUpAndLeave = useCallback(async () => {
    setShowExitPrompt(false);
    const isHumanWinner = winner?.user_id === me?.user_id;
    try {
      await endGame();
      try {
        await onFinishGameByTime?.();
      } catch (backendErr: unknown) {
        const msg = (backendErr as { message?: string })?.message ?? "";
        if (msg.includes("not running") || (backendErr as { response?: { data?: { error?: string } } })?.response?.data?.error === "Game is not running") {
          // ignore
        } else {
          throw backendErr;
        }
      }
      toast.success(isHumanWinner ? "Prize claimed! 🎉" : "Consolation collected — thanks for playing!");
    } catch (err: unknown) {
      toast.error(getContractErrorMessage(err as Error, "Something went wrong — try again later"));
    } finally {
      endGameReset();
    }
  }, [winner?.user_id, me?.user_id, onFinishGameByTime, endGame, endGameReset]);

  const refreshGame = useCallback(async () => {
    try {
      const res = await apiClient.get<ApiResponse>(`/games/code/${game.code}`);
      if (res?.data?.success && res.data.data?.players) {
        setPlayers(res.data.data.players);
      }
    } catch (err) {
      console.error("Refresh failed", err);
    }
  }, [game.code]);

  useEffect(() => {
    if (game?.players) setPlayers(game.players);
  }, [game?.players]);

  useEffect(() => {
    if (disablePolling) return;
    const interval = setInterval(refreshGame, 8000);
    return () => clearInterval(interval);
  }, [refreshGame, disablePolling]);

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
  }, [currentPlayerId]);

  const lockAction = useCallback((type: "ROLL" | "END") => {
    if (actionLock) return false;
    setActionLock(type);
    return true;
  }, [actionLock]);

  const unlockAction = useCallback(() => setActionLock(null), []);

  const END_TURN = useCallback(async (_timedOut?: boolean) => {
    if (currentPlayerId === -1 || turnEndInProgress.current || !lockAction("END")) return;
    turnEndInProgress.current = true;
    try {
      await apiClient.post("/game-players/end-turn", {
        user_id: currentPlayerId,
        game_id: game.id,
      });
      await onGameUpdated?.();
    } catch (err) {
      toast.error(getContractErrorMessage(err as Error, "Failed to end turn"));
    } finally {
      unlockAction();
      turnEndInProgress.current = false;
    }
  }, [currentPlayerId, game.id, lockAction, unlockAction, onGameUpdated]);

  const BUY_PROPERTY = useCallback(
    async (isAiAction = false) => {
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
        if (!isAiAction) showToast("Sending transaction...", "default");
        await apiClient.post("/game-properties/buy", {
          user_id: currentPlayer.user_id,
          game_id: game.id,
          property_id: justLandedProperty.id,
        });
        showToast(
          isAiAction ? `AI bought ${justLandedProperty.name}!` : `You bought ${justLandedProperty.name}!`,
          "success"
        );
        setBuyPrompted(false);
        landedPositionThisTurn.current = null;
        await onGameUpdated?.();
        setTimeout(END_TURN, 800);
      } catch (err) {
        toast.error(getContractErrorMessage(err as Error, "Purchase failed"));
      }
    },
    [currentPlayer, justLandedProperty, actionLock, END_TURN, showToast, game.id, me?.username, onGameUpdated]
  );

  const triggerLandingLogic = useCallback(
    (newPosition: number, isSpecial = false) => {
      if (landedPositionThisTurn.current !== null) return;
      landedPositionThisTurn.current = newPosition;
      setIsSpecialMove(isSpecial);
      setRoll({ die1: 0, die2: 0, total: 0 });
      setHasMovementFinished(true);
      setTimeout(() => {
        const square = properties.find((p) => p.id === newPosition);
        if (square?.price != null) {
          const isOwned = game_properties.some((gp) => gp.property_id === newPosition);
          if (
            !isOwned &&
            ["land", "railway", "utility"].includes(PROPERTY_ACTION(newPosition) || "")
          ) {
            setBuyPrompted(true);
          }
        }
      }, 300);
    },
    [properties, game_properties]
  );

  const endTurnAfterSpecialMove = useCallback(() => {
    setBuyPrompted(false);
    landedPositionThisTurn.current = null;
    setIsSpecialMove(false);
    setTimeout(END_TURN, 800);
  }, [END_TURN]);

  // ---- AI strategy helpers (used by handleAiStrategy) ----
  const getPlayerOwnedProperties = useCallback(
    (playerAddress: string | undefined, gps: GameProperty[], props: Property[]) => {
      if (!playerAddress) return [];
      return gps
        .filter((gp) => gp.address?.toLowerCase() === playerAddress.toLowerCase())
        .map((gp) => ({
          gp,
          prop: props.find((p) => p.id === gp.property_id)!,
        }))
        .filter((item) => !!item.prop);
    },
    []
  );

  const getCompleteMonopolies = useCallback(
    (playerAddress: string | undefined, gps: GameProperty[], props: Property[]) => {
      if (!playerAddress) return [];
      const owned = getPlayerOwnedProperties(playerAddress, gps, props);
      const monopolies: string[] = [];
      Object.entries(MONOPOLY_STATS.colorGroups).forEach(([groupName, ids]) => {
        if (groupName === "railroad" || groupName === "utility") return;
        const ownedInGroup = owned.filter((o) => ids.includes(o.prop.id));
        if (
          ownedInGroup.length === ids.length &&
          ownedInGroup.every((o) => !o.gp.mortgaged)
        ) {
          monopolies.push(groupName);
        }
      });
      return monopolies.sort((a, b) => BUILD_PRIORITY.indexOf(a) - BUILD_PRIORITY.indexOf(b));
    },
    [getPlayerOwnedProperties]
  );

  const getNearCompleteOpportunities = useCallback(
    (playerAddress: string | undefined, gps: GameProperty[], props: Property[]) => {
      if (!playerAddress) return [];
      const owned = getPlayerOwnedProperties(playerAddress, gps, props);
      const opportunities: {
        group: string;
        needs: number;
        missing: { id: number; name: string; ownerAddress: string | null; ownerName: string }[];
      }[] = [];
      Object.entries(MONOPOLY_STATS.colorGroups).forEach(([groupName, ids]) => {
        if (groupName === "railroad" || groupName === "utility") return;
        const ownedCount = owned.filter((o) => ids.includes(o.prop.id)).length;
        const needs = ids.length - ownedCount;
        if (needs === 1 || needs === 2) {
          const missing = ids
            .filter((id) => !owned.some((o) => o.prop.id === id))
            .map((id) => {
              const gp = gps.find((g) => g.property_id === id);
              const prop = props.find((p) => p.id === id)!;
              const ownerName = gp?.address
                ? players.find((p) => p.address?.toLowerCase() === gp.address?.toLowerCase())?.username ||
                  gp.address.slice(0, 8)
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
    },
    [getPlayerOwnedProperties, players]
  );

  const calculateTradeFavorability = useCallback(
    (
      trade: {
        offer_properties: number[];
        offer_amount: number;
        requested_properties: number[];
        requested_amount: number;
      },
      receiverAddress: string
    ) => {
      let score = 0;
      score += trade.offer_amount - trade.requested_amount;
      trade.requested_properties.forEach((id) => {
        const prop = properties.find((p) => p.id === id);
        if (!prop) return;
        score += prop.price || 0;
        const group = Object.values(MONOPOLY_STATS.colorGroups).find((g) => g.includes(id));
        if (group && !["railroad", "utility"].includes(prop.color!)) {
          const currentOwned = group.filter(
            (gid) =>
              game_properties.find(
                (gp) => gp.property_id === gid && gp.address === receiverAddress
              )
          ).length;
          if (currentOwned === group.length - 1) score += 300;
          else if (currentOwned === group.length - 2) score += 120;
        }
      });
      trade.offer_properties.forEach((id) => {
        const prop = properties.find((p) => p.id === id);
        if (!prop) return;
        score -= (prop.price || 0) * 1.3;
      });
      return score;
    },
    [properties, game_properties]
  );

  const calculateFairCashOffer = useCallback(
    (propertyId: number, completesSet: boolean, basePrice: number) =>
      completesSet ? Math.floor(basePrice * 1.6) : Math.floor(basePrice * 1.3),
    []
  );

  const getPropertyToOffer = useCallback(
    (playerAddress: string, excludeGroups: string[] = []) => {
      const owned = getPlayerOwnedProperties(playerAddress, game_properties, properties);
      const candidates = owned.filter((o) => {
        const group = Object.keys(MONOPOLY_STATS.colorGroups).find((g) =>
          MONOPOLY_STATS.colorGroups[g as keyof typeof MONOPOLY_STATS.colorGroups].includes(o.prop.id)
        );
        if (!group || excludeGroups.includes(group)) return false;
        if ((o.gp.development ?? 0) > 0) return false;
        return true;
      });
      if (candidates.length === 0) return null;
      candidates.sort((a, b) => (a.prop.price || 0) - (b.prop.price || 0));
      return candidates[0];
    },
    [getPlayerOwnedProperties]
  );

  const handleAiBuilding = useCallback(
    async (player: Player) => {
      if (!player.address) return;
      const monopolies = getCompleteMonopolies(player.address, game_properties, properties);
      if (monopolies.length === 0) return;
      let built = false;
      for (const groupName of monopolies) {
        const ids = MONOPOLY_STATS.colorGroups[groupName as keyof typeof MONOPOLY_STATS.colorGroups];
        const groupGps = game_properties.filter(
          (gp) => ids.includes(gp.property_id) && gp.address === player.address
        );
        const developments = groupGps.map((gp) => gp.development ?? 0);
        const minHouses = Math.min(...developments);
        const maxHouses = Math.max(...developments);
        if (maxHouses > minHouses + 1 || minHouses >= 5) continue;
        const prop = properties.find((p) => ids.includes(p.id))!;
        const houseCost = prop.cost_of_house ?? 0;
        if (houseCost === 0) continue;
        const affordable = Math.floor((player.balance ?? 0) / houseCost);
        if (affordable < ids.length) continue;
        for (const gp of groupGps.filter((g) => (g.development ?? 0) === minHouses)) {
          try {
            await apiClient.post("/game-properties/development", {
              game_id: game.id,
              user_id: player.user_id,
              property_id: gp.property_id,
            });
            showToast(`AI built on ${prop.name} (${groupName})`, "success");
            built = true;
            await new Promise((r) => setTimeout(r, 600));
          } catch (err) {
            console.error("Build failed", err);
            break;
          }
        }
        if (built) break;
      }
    },
    [game.id, game_properties, properties, getCompleteMonopolies, showToast]
  );

  const handleAiStrategy = useCallback(async () => {
    if (!currentPlayer || !isAITurn || strategyRanThisTurn) return;
    showToast(`${currentPlayer.username} is thinking... 🧠`, "default");
    const opportunities = getNearCompleteOpportunities(
      currentPlayer.address!,
      game_properties,
      properties
    );
    let maxTradeAttempts = 1;
    for (const opp of opportunities) {
      if (maxTradeAttempts <= 0) break;
      for (const missing of opp.missing) {
        if (!missing.ownerAddress || missing.ownerAddress === "bank") continue;
        const targetPlayer = players.find(
          (p) => p.address?.toLowerCase() === missing.ownerAddress?.toLowerCase()
        );
        if (!targetPlayer) continue;
        const basePrice = properties.find((p) => p.id === missing.id)?.price || 200;
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
          game_id: game.id,
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
            showToast(
              `AI offered $${cashOffer}${offerProperties.length ? " + property" : ""} for ${missing.name}`,
              "default"
            );
            maxTradeAttempts--;
            if (isAIPlayer(targetPlayer)) {
              await new Promise((r) => setTimeout(r, 800));
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
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
    await handleAiBuilding(currentPlayer);
    setStrategyRanThisTurn(true);
    showToast(`${currentPlayer.username} ready to roll`, "default");
  }, [
    currentPlayer,
    isAITurn,
    strategyRanThisTurn,
    game.id,
    game_properties,
    properties,
    players,
    getNearCompleteOpportunities,
    calculateFairCashOffer,
    getPropertyToOffer,
    calculateTradeFavorability,
    handleAiBuilding,
    refreshGame,
    showToast,
  ]);

  const ROLL_DICE = useCallback(
    async (forAI = false) => {
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
        if (!player) {
          setIsRolling(false);
          unlockAction();
          return;
        }
        const currentPos = player.position ?? 0;
        const isInJail = Boolean(player.in_jail) && currentPos === JAIL_POSITION;
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
              await new Promise((r) => setTimeout(r, MOVE_ANIMATION_MS_PER_SQUARE));
              setAnimatedPositions((prev) => ({ ...prev, [playerId]: movePath[i] }));
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
            const square = properties.find((p) => p.id === newPos);
            if (square?.price != null) {
              const isOwned = game_properties.some((gp) => gp.property_id === newPos);
              if (
                !isOwned &&
                ["land", "railway", "utility"].includes(PROPERTY_ACTION(newPos) || "")
              ) {
                setTimeout(() => setBuyPrompted(true), 300);
              }
            }
          }
          if (forAI) rolledForPlayerId.current = currentPlayerId;
          await onGameUpdated?.();
        } catch (err) {
          toast.error(getContractErrorMessage(err as Error, "Move failed"));
          END_TURN();
        } finally {
          setIsRolling(false);
          unlockAction();
        }
      }, ROLL_ANIMATION_MS);
    },
    [
      isRolling,
      actionLock,
      lockAction,
      unlockAction,
      currentPlayerId,
      me,
      players,
      pendingRoll,
      game.id,
      properties,
      game_properties,
      showToast,
      END_TURN,
      onGameUpdated,
    ]
  );

  useEffect(() => {
    if (isAITurn && currentPlayer && !strategyRanThisTurn) {
      const t = setTimeout(handleAiStrategy, 1000);
      return () => clearTimeout(t);
    }
  }, [isAITurn, currentPlayer, strategyRanThisTurn, handleAiStrategy]);

  useEffect(() => {
    if (
      !isAITurn ||
      isRolling ||
      actionLock ||
      roll ||
      rolledForPlayerId.current === currentPlayerId ||
      !strategyRanThisTurn
    )
      return;
    const t = setTimeout(() => ROLL_DICE(true), 1500);
    return () => clearTimeout(t);
  }, [isAITurn, isRolling, actionLock, roll, currentPlayerId, ROLL_DICE, strategyRanThisTurn]);

  useEffect(() => {
    if (!roll || landedPositionThisTurn.current === null || !hasMovementFinished) {
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
    setBuyPrompted(!isOwned && isBuyableType);
    if (!isOwned && isBuyableType && (currentPlayer?.balance ?? 0) < square.price) {
      showToast(`Not enough money to buy ${square.name}`, "error");
    }
  }, [roll, hasMovementFinished, game_properties, properties, currentPlayer, showToast]);

  useEffect(() => {
    if (!isAITurn || !buyPrompted || !currentPlayer || !justLandedProperty || buyScore === null)
      return;
    const t = setTimeout(async () => {
      const shouldBuy =
        buyScore >= 72 && (currentPlayer.balance ?? 0) > justLandedProperty.price! * 1.8;
      if (shouldBuy) {
        showToast(`AI bought ${justLandedProperty.name} (score: ${buyScore}%)`, "success");
        await BUY_PROPERTY(true);
      } else {
        showToast(`AI passed on ${justLandedProperty.name} (score: ${buyScore}%)`, "default");
        setTimeout(END_TURN, 900);
      }
    }, 900);
    return () => clearTimeout(t);
  }, [isAITurn, buyPrompted, currentPlayer, justLandedProperty, buyScore, BUY_PROPERTY, END_TURN, showToast]);

  useEffect(() => {
    if (actionLock || isRolling || buyPrompted || !roll) return;
    const t = setTimeout(END_TURN, isAITurn ? 1000 : 1200);
    return () => clearTimeout(t);
  }, [roll, buyPrompted, isRolling, actionLock, isAITurn, END_TURN]);

  // Victory by last player standing (e.g. opponent eliminated in multiplayer). Skip for AI: AI games only have one DB player (human), so players.length === 1 on load would wrongly show "you win".
  useEffect(() => {
    if (game?.is_ai) return;
    if (!me || players.length !== 1 || players[0].user_id !== me.user_id) return;
    const turnCount = me.turn_count ?? 0;
    const validWin = turnCount >= 20;
    setWinner(me);
    setEndGameCandidate({
      winner: me,
      position: me.position ?? 0,
      balance: BigInt(me.balance ?? 0),
      validWin,
    });
  }, [game?.is_ai, me, players]);

  // When loading an already FINISHED game (e.g. refresh after time's up), show winner from backend
  useEffect(() => {
    if (game?.status !== "FINISHED" || game.winner_id == null || winner != null) return;
    const winnerPlayer = players.find((p) => p.user_id === game.winner_id) ?? null;
    if (winnerPlayer) {
      setWinner(winnerPlayer);
      const isMe = winnerPlayer.user_id === me?.user_id;
      const myPosition = me?.position ?? 0;
      const myBalance = BigInt(me?.balance ?? 0);
      setEndGameCandidate({
        winner: isMe ? winnerPlayer : null,
        position: myPosition,
        balance: myBalance,
        validWin: (winnerPlayer.turn_count ?? 0) >= 20,
      });
    }
  }, [game?.status, game.winner_id, me?.user_id, me?.position, me?.balance, players, winner]);

  useEffect(() => {
    const history = game.history ?? [];
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
    setCardPlayerName((playerName ?? "").trim());
    setShowCardModal(true);
    const timer = setTimeout(() => setShowCardModal(false), 15000);
    return () => clearTimeout(timer);
  }, [game.history]);

  const playersByPosition = useMemo(() => {
    const map = new Map<number, Player[]>();
    players.forEach((p) => {
      const pos = animatedPositions[p.user_id] !== undefined ? animatedPositions[p.user_id] : (p.position ?? 0);
      if (!map.has(pos)) map.set(pos, []);
      map.get(pos)!.push(p);
    });
    return map;
  }, [players, animatedPositions]);

  const propertyOwner = useCallback(
    (id: number) => {
      const gp = game_properties.find((gp) => gp.property_id === id);
      return gp ? players.find((p) => p.address === gp.address)?.username ?? null : null;
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

  const handleRollDice = useCallback(() => ROLL_DICE(false), [ROLL_DICE]);
  const handleBuyProperty = useCallback(() => BUY_PROPERTY(false), [BUY_PROPERTY]);
  const handleSkipBuy = useCallback(() => {
    setBuyPrompted(false);
    landedPositionThisTurn.current = null;
    setTimeout(END_TURN, 900);
  }, [END_TURN]);

  const handlePropertyTransfer = useCallback(
    async (propertyId: number, newPlayerId: number) => {
      if (!propertyId || !newPlayerId) {
        toast("Cannot transfer: missing property or player");
        return;
      }
      const gp = game_properties.find((gp) => gp.property_id === propertyId);
      if (!gp?.address) {
        toast("Cannot transfer: no current owner found");
        return;
      }
      const sellerPlayer = players.find((p) => p.address?.toLowerCase() === gp.address?.toLowerCase());
      const buyerPlayer = players.find((p) => p.user_id === newPlayerId);
      if (!sellerPlayer || !buyerPlayer) {
        toast("Cannot transfer: seller or buyer not found");
        return;
      }
      try {
        const response = await apiClient.put<ApiResponse>(`/game-properties/${propertyId}`, {
          game_id: game.id,
          player_id: newPlayerId,
        });
        if (response.data?.success) {
          toast.success("Property transferred successfully! 🎉");
        } else {
          throw new Error((response.data as { message?: string })?.message || "Transfer failed");
        }
      } catch (error: unknown) {
        toast.error(getContractErrorMessage(error as Error, "Failed to transfer property"));
        console.error("Property transfer failed:", error);
      }
    },
    [game.id, game_properties, players]
  );

  const handleDeclareBankruptcy = useCallback(async () => {
    showToast("Declaring bankruptcy...", "default");
    try {
      await endGame();
      const opponent = players.find((p) => p.user_id !== me?.user_id);
      await apiClient.put(`/games/${game.id}`, {
        status: "FINISHED",
        winner_id: opponent?.user_id ?? null,
      });
      showToast("Game over! You have declared bankruptcy.", "error");
      setShowBankruptcyModal(true);
    } catch (err) {
      toast.error(getContractErrorMessage(err as Error, "Failed to end game"));
    }
  }, [showToast, endGame, players, me?.user_id, game.id]);

  const { handleDevelopment, handleDowngrade, handleMortgage, handleUnmortgage } = usePropertyActions(
    game.id,
    me?.user_id,
    isMyTurn
  );

  const handlePropertyClick = useCallback(
    (square: Property) => {
      const gp = game_properties.find((gp) => gp.property_id === square.id);
      if (gp?.address === me?.address) {
        setSelectedProperty(square);
      } else {
        showToast("You don't own this property", "error");
      }
    },
    [game_properties, me?.address, showToast]
  );

  return {
    players,
    gameTimeUp,
    winner,
    showExitPrompt,
    setShowExitPrompt,
    roll,
    isRolling,
    buyPrompted,
    animatedPositions,
    hasMovementFinished,
    currentPlayerId,
    currentPlayer,
    isMyTurn,
    isAITurn,
    playerCanRoll,
    currentProperty,
    justLandedProperty,
    buyScore,
    showToast,
    handleGameTimeUp,
    handleFinalizeTimeUpAndLeave,
    endGame,
    endGamePending,
    endGameReset,
    endGameCandidate,
    playersByPosition,
    propertyOwner,
    developmentStage,
    isPropertyMortgaged,
    handleRollDice,
    handleBuyProperty,
    handleSkipBuy,
    handlePropertyTransfer,
    handleDeclareBankruptcy,
    handlePropertyClick,
    handleDevelopment,
    handleDowngrade,
    handleMortgage,
    handleUnmortgage,
    selectedProperty,
    setSelectedProperty,
    showPerksModal,
    setShowPerksModal,
    showCardModal,
    setShowCardModal,
    cardData,
    cardPlayerName,
    showBankruptcyModal,
    setShowBankruptcyModal,
    triggerLandingLogic,
    endTurnAfterSpecialMove,
    ROLL_DICE,
    END_TURN,
    refreshGame,
  };
}
