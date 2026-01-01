"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useEndAiGame, useGetGameByCode } from "@/context/ContractProvider";
import { Game, GameProperty, Property, Player, PROPERTY_ACTION } from "@/types/game";

import Board from "./board";
import DiceAnimation from "./dice-animation";
import GameLog from "./game-log";
import GameModals from "./game-modals";
import PlayerStatus from "./player-status";
import { Sparkles, X } from "lucide-react";
import CollectibleInventoryBar from "@/components/collectibles/collectibles-invetory-mobile";

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

const BOARD_SQUARES = 40;
const ROLL_ANIMATION_MS = 1200;
const MOVE_ANIMATION_MS_PER_SQUARE = 250;
const JAIL_POSITION = 10;

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

const BUILD_PRIORITY = ["orange", "red", "yellow", "pink", "lightblue", "green", "brown", "darkblue"];

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
  const [strategyRanThisTurn, setStrategyRanThisTurn] = useState(false);

  const [showInsolvencyModal, setShowInsolvencyModal] = useState(false);
  const [insolvencyDebt, setInsolvencyDebt] = useState(0);
  const [isRaisingFunds, setIsRaisingFunds] = useState(false);
  const [showPerksModal, setShowPerksModal] = useState(false);
  const [isSpecialMove, setIsSpecialMove] = useState(false);

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

  // Property details modal (single modal - no separate manage modal)
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedGameProperty, setSelectedGameProperty] = useState<GameProperty | undefined>(undefined);

  const currentPlayerId = currentGame.next_player_id;
  const currentPlayer = players.find((p) => p.user_id === currentPlayerId);
  const isMyTurn = me?.user_id === currentPlayerId;
  const isAITurn = isAIPlayer(currentPlayer);

  const landedPositionThisTurn = useRef<number | null>(null);
  const turnEndInProgress = useRef(false);
  const lastToastMessage = useRef<string | null>(null);
  const rolledForPlayerId = useRef<number | null>(null);

  const justLandedProperty = useMemo(() => {
    if (landedPositionThisTurn.current === null) return null;
    return properties.find((p) => p.id === landedPositionThisTurn.current) ?? null;
  }, [landedPositionThisTurn.current, properties]);

  const { data: contractGame } = useGetGameByCode(game.code, { enabled: !!game.code });
  const id = contractGame?.id;

  const { write: endGame, isPending, reset } = useEndAiGame(
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
    rolledForPlayerId.current = null;
    turnEndInProgress.current = false;
    lastToastMessage.current = null;
    setAnimatedPositions({});
    setHasMovementFinished(false);
    setStrategyRanThisTurn(false);
    setIsRaisingFunds(false);
  }, [currentPlayerId]);

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
  
    setTimeout(() => {
      const square = properties.find(p => p.id === newPosition);
      if (square?.price != null) {
        const isOwned = game_properties.some(gp => gp.property_id === newPosition);
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
          } catch (err) {
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
        } catch (err) {
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
      let shouldAnimate = totalMove > 0;

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

  // ── AI STRATEGY HELPERS (simplified) ─────────────────────────────────────
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

  const handleAiBuyDecision = useCallback(async () => {
    if (!isAITurn || !justLandedProperty || !justLandedProperty.price || !currentPlayer) return;

    const isOwned = currentGameProperties.some(gp => gp.property_id === justLandedProperty.id);
    if (isOwned || justLandedProperty.type !== "property") return;

    const balance = currentPlayer.balance ?? 0;
    const price = justLandedProperty.price;

    const ownedInGroup = getPlayerOwnedProperties(currentPlayer.address, currentGameProperties, properties)
      .filter(o => {
        return Object.entries(MONOPOLY_STATS.colorGroups).some(([_, ids]) => 
          ids.includes(o.prop.id) && ids.includes(justLandedProperty.id)
        );
      }).length;

    const groupSize = Object.values(MONOPOLY_STATS.colorGroups)
      .find(ids => ids.includes(justLandedProperty.id))?.length || 0;

    const completesMonopoly = groupSize > 0 && ownedInGroup === groupSize - 1;
    const goodLandingRank = (MONOPOLY_STATS.landingRank[justLandedProperty.id] ?? 99) <= 15;
    const affordable = balance >= price + 200;

    const shouldBuy = completesMonopoly || (goodLandingRank && affordable);

    if (shouldBuy) {
      showToast(`${currentPlayer.username} is buying ${justLandedProperty.name}...`, "default");
      try {
        await apiClient.post("/game-properties/buy", {
          user_id: currentPlayer.user_id,
          game_id: currentGame.id,
          property_id: justLandedProperty.id,
        });
        showToast(`${currentPlayer.username} bought ${justLandedProperty.name}!`, "success");
        await fetchUpdatedGame();
      } catch (err) {
        showToast("AI purchase failed", "error");
      }
    } else
      showToast(`${currentPlayer.username} skipped buying ${justLandedProperty.name}`, "default");

    landedPositionThisTurn.current = null;
  }, [isAITurn, justLandedProperty, currentPlayer, currentGameProperties, properties, currentGame.id, fetchUpdatedGame, showToast]);

  const handleAiStrategy = useCallback(async () => {
    if (!currentPlayer || !isAITurn || strategyRanThisTurn) return;

    showToast(`${currentPlayer.username} is thinking... 🧠`, "default");

    await handleAiBuilding(currentPlayer);
    setStrategyRanThisTurn(true);
    showToast(`${currentPlayer.username} ready to roll`, "default");
  }, [currentPlayer, isAITurn, strategyRanThisTurn, currentGameProperties, properties, showToast, currentGame.id]);

  useEffect(() => {
    if (isAITurn && currentPlayer && !strategyRanThisTurn) {
      const timer = setTimeout(handleAiStrategy, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAITurn, currentPlayer, strategyRanThisTurn, handleAiStrategy]);

  useEffect(() => {
    if (isAITurn && !isRolling && !roll && !actionLock && strategyRanThisTurn) {
      const timer = setTimeout(() => ROLL_DICE(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isAITurn, isRolling, roll, actionLock, strategyRanThisTurn, ROLL_DICE]);

  useEffect(() => {
    if (isAITurn && hasMovementFinished && roll && landedPositionThisTurn.current !== null) {
      const timer = setTimeout(handleAiBuyDecision, 1200);
      return () => clearTimeout(timer);
    }
  }, [isAITurn, hasMovementFinished, roll, landedPositionThisTurn.current, handleAiBuyDecision]);

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
    const canBuy = !isOwned && square.type === "property";

    setBuyPrompted(canBuy && isMyTurn);

    if (canBuy && (currentPlayer?.balance ?? 0) < square.price) {
      showToast(`Not enough money to buy ${square.name}`, "error");
    }
  }, [roll, landedPositionThisTurn.current, hasMovementFinished, currentGameProperties, properties, currentPlayer, showToast, isMyTurn]);

  useEffect(() => {
    if (actionLock || isRolling || buyPrompted || !roll || isRaisingFunds || showInsolvencyModal) return;

    const timer = setTimeout(END_TURN, 2000);
    return () => clearTimeout(timer);
  }, [actionLock, isRolling, buyPrompted, roll, isRaisingFunds, showInsolvencyModal, END_TURN]);

  // ── PROPERTY MANAGEMENT (TYPE-SAFE) ─────────────────────────────────────
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

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-cyan-900 text-white flex flex-col items-center justify-start relative overflow-hidden">
      <button
        onClick={fetchUpdatedGame}
        className="fixed top-4 right-4 z-50 bg-blue-500 text-white text-xs px-2 py-1 rounded-full hover:bg-blue-600 transition"
      >
        Refresh
      </button>

      <PlayerStatus currentPlayer={currentPlayer} isAITurn={isAITurn} buyPrompted={buyPrompted} />

      <Board
        properties={properties}
        players={players}
        currentGameProperties={currentGameProperties}
        animatedPositions={animatedPositions}
        currentPlayerId={currentPlayerId}
        onPropertyClick={handlePropertyClick}
      />

      <DiceAnimation isRolling={isRolling && !(currentPlayer?.in_jail && currentPlayer.position === JAIL_POSITION)} roll={roll} />

      {isMyTurn && !roll && !isRolling && !isRaisingFunds && !showInsolvencyModal && (
        <button
          onClick={() => ROLL_DICE(false)}
          className="w-full max-w-sm mx-auto px-12 py-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:from-emerald-800 active:to-teal-800 text-white font-bold text-2xl tracking-wide rounded-2xl shadow-2xl border border-emerald-300/20 transition-all duration-300 ease-out hover:scale-105 hover:shadow-cyan-500/30 hover:shadow-2xl active:scale-95 flex items-center justify-center gap-4 mt-8"
        >
          <span className="drop-shadow-lg">
            {isRolling ? "Rolling..." : "Roll Dice"}
          </span>

          {!isRolling && (
            <svg className="w-9 h-9 opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="4" ry="4" className="stroke-white/80" />
              <circle cx="8" cy="8" r="2" fill="white" />
              <circle cx="16" cy="16" r="2" fill="white" />
              <circle cx="16" cy="8" r="2" fill="white" />
              <circle cx="8" cy="16" r="2" fill="white" />
            </svg>
          )}
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
                <button onClick={BUY_PROPERTY} className="py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-xl rounded-2xl shadow-lg hover:scale-105 transition">
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

      {/* SINGLE PROPERTY DETAILS MODAL WITH ACTIONS */}
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

                {/* Action buttons - only if owned by me and it's my turn */}
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
        isPending={isPending}
        endGame={endGame}
        reset={reset}
        setShowInsolvencyModal={setShowInsolvencyModal}
        setIsRaisingFunds={setIsRaisingFunds}
        setShowBankruptcyModal={setShowBankruptcyModal}
        fetchUpdatedGame={fetchUpdatedGame}
        showToast={showToast}
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
          success: { icon: "✔", style: { borderColor: "#10b981" } },
          error: { icon: "✖", style: { borderColor: "#ef4444" } },
        }}
      />
    </div>
  );
};

export default MobileGameLayout;