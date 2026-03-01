"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";
import type { Property, Player, History, Game, GameProperty } from "@/types/game";
import { PROPERTY_ACTION } from "@/types/game";
import { getSquareName } from "@/components/game/board3d/squareNames";
import { getDiceValues } from "@/components/game/constants";
import { JAIL_POSITION, MOVE_ANIMATION_MS_PER_SQUARE } from "@/components/game/constants";
import { getContractErrorMessage } from "@/lib/utils/contractErrors";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { usePreventDoubleSubmit } from "@/hooks/usePreventDoubleSubmit";
import { useGameTrades } from "@/hooks/useGameTrades";
import { useAiBankruptcy } from "@/hooks/useAiBankruptcy";
import { useMobilePropertyActions } from "@/hooks/useMobilePropertyActions";
import { useGetGameByCode, useEndAIGameAndClaim } from "@/context/ContractProvider";
import { Toaster, toast } from "react-hot-toast";
import { isAIPlayer, getAiSlotFromPlayer } from "@/utils/gameUtils";
import { MONOPOLY_STATS, BUILD_PRIORITY } from "@/components/game/constants";
import { CardModal } from "@/components/game/modals/cards";
import { BankruptcyModal } from "@/components/game/modals/bankruptcy";
import PropertyDetailModal3D from "@/components/game/board3d/PropertyDetailModal3D";
import { GameDurationCountdown } from "@/components/game/GameDurationCountdown";
const Mobile3DGameUI = dynamic(
  () => import("@/components/game/board3d/Mobile3DGameUI").then((m) => m.default),
  { ssr: false }
);
import ActionLog from "@/components/game/ai-board/action-log";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Trophy, HeartHandshake } from "lucide-react";

const Canvas = dynamic(
  () => import("@react-three/fiber").then((m) => m.Canvas),
  { ssr: false }
);
const BoardScene = dynamic(
  () => import("@/components/game/board3d/BoardScene").then((m) => m.default),
  { ssr: false }
);

function useBoardProperties() {
  const { data: apiProperties = [], isLoading } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse>("/properties");
      return res.data?.success ? res.data.data : [];
    },
    staleTime: Infinity,
  });

  if (apiProperties.length >= 40) {
    return { properties: [...apiProperties].sort((a, b) => a.id - b.id), isLoading: false };
  }
  return { properties: buildMockProperties(), isLoading };
}

function buildMockProperties(): Property[] {
  const positions: ("top" | "bottom" | "left" | "right")[] = [];
  for (let i = 0; i < 40; i++) {
    if (i <= 9) positions.push("bottom");
    else if (i <= 19) positions.push("left");
    else if (i <= 29) positions.push("top");
    else positions.push("right");
  }

  const squares: { id: number; type: Property["type"]; color: string }[] = [
    { id: 0, type: "corner", color: "#2ecc71" },
    { id: 1, type: "property", color: "#8B4513" },
    { id: 2, type: "community_chest", color: "#8B4513" },
    { id: 3, type: "property", color: "#8B4513" },
    { id: 4, type: "income_tax", color: "#fff" },
    { id: 5, type: "property", color: "railroad" },
    { id: 6, type: "property", color: "#87CEEB" },
    { id: 7, type: "chance", color: "#87CEEB" },
    { id: 8, type: "property", color: "#87CEEB" },
    { id: 9, type: "property", color: "#87CEEB" },
    { id: 10, type: "corner", color: "#7f8c8d" },
    { id: 11, type: "property", color: "#FF69B4" },
    { id: 12, type: "property", color: "utility" },
    { id: 13, type: "property", color: "#FF69B4" },
    { id: 14, type: "property", color: "#FF69B4" },
    { id: 15, type: "property", color: "railroad" },
    { id: 16, type: "property", color: "#FFA500" },
    { id: 17, type: "community_chest", color: "#FFA500" },
    { id: 18, type: "property", color: "#FFA500" },
    { id: 19, type: "property", color: "#FFA500" },
    { id: 20, type: "corner", color: "#3498db" },
    { id: 21, type: "property", color: "#FF0000" },
    { id: 22, type: "chance", color: "#FF0000" },
    { id: 23, type: "property", color: "#FF0000" },
    { id: 24, type: "property", color: "#FF0000" },
    { id: 25, type: "property", color: "railroad" },
    { id: 26, type: "property", color: "#FFD700" },
    { id: 27, type: "property", color: "#FFD700" },
    { id: 28, type: "property", color: "utility" },
    { id: 29, type: "property", color: "#FFD700" },
    { id: 30, type: "corner", color: "#e74c3c" },
    { id: 31, type: "property", color: "#228B22" },
    { id: 32, type: "property", color: "#228B22" },
    { id: 33, type: "community_chest", color: "#228B22" },
    { id: 34, type: "property", color: "#228B22" },
    { id: 35, type: "property", color: "railroad" },
    { id: 36, type: "chance", color: "#0000CD" },
    { id: 37, type: "property", color: "#0000CD" },
    { id: 38, type: "luxury_tax", color: "#0000CD" },
    { id: 39, type: "property", color: "#0000CD" },
  ];

  return squares.map((s, idx) => ({
    ...s,
    name: getSquareName(s.id),
    group_id: Math.floor(s.id / 10),
    position: positions[idx],
    grid_row: s.id <= 9 ? 11 : s.id <= 19 ? 11 - (s.id - 10) : s.id <= 29 ? 1 : (s.id - 30) + 1,
    grid_col: s.id <= 9 ? 11 - s.id : s.id <= 19 ? 1 : s.id <= 29 ? (s.id - 20) + 1 : 11,
    price: 0,
    rent_site_only: 0,
    rent_one_house: 0,
    rent_two_houses: 0,
    rent_three_houses: 0,
    rent_four_houses: 0,
    rent_hotel: 0,
    cost_of_house: 0,
    is_mortgaged: false,
  })) as Property[];
}

function makeHistoryEntry(id: number, player_name: string, comment: string, rolled: number): History {
  return {
    id,
    game_id: 0,
    game_player_id: 0,
    rolled,
    old_position: null,
    new_position: 0,
    action: "",
    amount: 0,
    extra: { description: "" },
    comment,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    active: 1,
    player_symbol: "hat",
    player_name,
  };
}

const BOARD_HEIGHT_PCT = 65.6; /* 10% smaller than 72.9 so board fits screen */

export default function Board3DMobilePage() {
  const searchParams = useSearchParams();
  const gameCode = searchParams.get("gameCode")?.trim().toUpperCase() || null;

  const { address } = useAccount();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const isGuest = !!guestUser;

  const { properties, isLoading } = useBoardProperties();
  const { data: game, isLoading: gameLoading, isError: gameError, refetch: refetchGame } = useQuery<Game>({
    queryKey: ["game", gameCode ?? ""],
    queryFn: async () => {
      if (!gameCode) throw new Error("No code");
      const res = await apiClient.get<ApiResponse>(`/games/code/${gameCode}`);
      if (!res.data?.success) throw new Error("Game not found");
      return res.data.data;
    },
    enabled: !!gameCode && gameCode.length === 6,
    refetchInterval: gameCode ? 5000 : false,
  });
  const { data: gameProperties = [], refetch: refetchGameProperties } = useQuery<GameProperty[]>({
    queryKey: ["game_properties", game?.id],
    queryFn: async () => {
      if (!game?.id) return [];
      const res = await apiClient.get<ApiResponse>(`/game-properties/game/${game.id}`);
      return res.data?.success ? res.data.data : [];
    },
    enabled: !!game?.id,
  });

  const isLiveGame = !!gameCode && !!game;

  const me = useMemo<Player | null>(() => {
    const myAddress = guestUser?.address ?? address;
    if (!game?.players || !myAddress) return null;
    return game.players.find((p: Player) => p.address?.toLowerCase() === myAddress.toLowerCase()) ?? null;
  }, [game?.players, address, guestUser?.address]);

  const [buyPrompted, setBuyPrompted] = useState(false);
  const [jailChoiceRequired, setJailChoiceRequired] = useState(false);
  const [turnEndScheduled, setTurnEndScheduled] = useState(false);
  const [gameTimeUpLocal, setGameTimeUpLocal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardData, setCardData] = useState<{ type: "chance" | "community"; text: string; effect?: string; isGood: boolean } | null>(null);
  const [cardPlayerName, setCardPlayerName] = useState("");
  const [showBankruptcyModal, setShowBankruptcyModal] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [landedPositionForBuy, setLandedPositionForBuy] = useState<number | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedGameProperty, setSelectedGameProperty] = useState<GameProperty | undefined>(undefined);
  const [viewTradesRequested, setViewTradesRequested] = useState(false);
  const [showPerksModal, setShowPerksModal] = useState(false);
  const [liveMovementOverride, setLiveMovementOverride] = useState<Record<number, number>>({});
  const [strategyRanThisTurn, setStrategyRanThisTurn] = useState(false);
  const [rollingDice, setRollingDice] = useState<{ die1: number; die2: number } | null>(null);
  const [lastRollResultLive, setLastRollResultLive] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [endGameCandidate, setEndGameCandidate] = useState<{
    winner: Player | null;
    position: number;
    balance: bigint;
    validWin: boolean;
  }>({ winner: null, position: 0, balance: BigInt(0), validWin: true });
  const [claimAndLeaveInProgress, setClaimAndLeaveInProgress] = useState(false);

  const AI_TIPS_STORAGE_KEY = "tycoon_ai_tips_on_3d_mobile";
  const [aiTipsOn, setAiTipsOn] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(AI_TIPS_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [aiTipText, setAiTipText] = useState<string | null>(null);
  const [aiTipLoading, setAiTipLoading] = useState(false);
  const lastTipPropertyIdRef = useRef<number | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resetViewTrigger, setResetViewTrigger] = useState(0);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  const timeUpHandledRef = useRef(false);
  const rollingForPlayerIdRef = useRef<number | null>(null);
  const rolledForPlayerIdRef = useRef<number | null>(null);
  const pendingRollRef = useRef<{ die1: number; die2: number; total: number }>({ die1: 0, die2: 0, total: 0 });
  const landedPositionThisTurnRef = useRef<number | null>(null);
  const hasScheduledTurnEndRef = useRef(false);
  const turnEndInProgressRef = useRef(false);
  const lastTopHistoryIdRef = useRef<number | null>(null);

  const currentPlayerId = game?.next_player_id ?? null;
  const isUntimed = !game?.duration || Number(game.duration) === 0;
  const isMyTurn = !!(me && currentPlayerId !== null && me.user_id === currentPlayerId);
  const gameTimeUp = game?.status === "FINISHED" || gameTimeUpLocal;
  const meInJail = !!(me && Number(me.position) === JAIL_POSITION && me.in_jail);
  const canPayToLeaveJail = meInJail && (me?.balance ?? 0) >= 50;
  const hasChanceJailCard = (me?.chance_jail_card ?? 0) >= 1;
  const hasCommunityChestJailCard = (me?.community_chest_jail_card ?? 0) >= 1;
  const playerCanRoll =
    isLiveGame &&
    isMyTurn &&
    (me?.balance ?? 0) > 0 &&
    !gameTimeUp &&
    !turnEndScheduled &&
    !buyPrompted &&
    !(meInJail && jailChoiceRequired);

  const livePlayers = useMemo(() => game?.players ?? [], [game?.players]);
  const liveAnimatedPositions = useMemo(() => {
    const out: Record<number, number> = {};
    livePlayers.forEach((p) => {
      out[p.user_id] = p.position ?? 0;
    });
    return out;
  }, [livePlayers]);

  const currentPlayer = useMemo(() => {
    if (!game?.players || currentPlayerId == null) return null;
    return game.players.find((p: Player) => p.user_id === currentPlayerId) ?? null;
  }, [game?.players, currentPlayerId]);

  const isAITurn = useMemo(() => {
    if (!currentPlayer || !isAIPlayer(currentPlayer)) return false;
    if (me != null && currentPlayer.user_id === me.user_id) return false;
    return true;
  }, [currentPlayer, me]);

  useAiBankruptcy({
    isAITurn: isLiveGame && isAITurn,
    currentPlayer: isLiveGame ? currentPlayer : null,
    game_properties: gameProperties,
    properties,
    game: game ?? ({} as Game),
    refetchGame: async () => {
      const res = await refetchGame();
      return res?.data;
    },
  });

  const liveDevelopmentByPropertyId = useMemo(() => {
    const out: Record<number, number> = {};
    gameProperties.forEach((gp) => {
      out[gp.property_id] = gp.development ?? 0;
    });
    return out;
  }, [gameProperties]);

  const ownerByPropertyId = useMemo(() => {
    const out: Record<number, string> = {};
    gameProperties.forEach((gp) => {
      if (gp.address) {
        const owner = livePlayers.find((p) => p.address?.toLowerCase() === gp.address?.toLowerCase());
        if (owner?.username) out[gp.property_id] = owner.username;
      }
    });
    return out;
  }, [gameProperties, livePlayers]);

  const ownerSymbolByPropertyId = useMemo(() => {
    const out: Record<number, string> = {};
    gameProperties.forEach((gp) => {
      if (gp.address) {
        const owner = livePlayers.find((p) => p.address?.toLowerCase() === gp.address?.toLowerCase());
        if (owner?.symbol) out[gp.property_id] = owner.symbol;
      }
    });
    return out;
  }, [gameProperties, livePlayers]);

  const my_properties = useMemo(() => {
    if (!me?.address) return [];
    const myIds = gameProperties
      .filter((gp) => gp.address?.toLowerCase() === me.address?.toLowerCase())
      .map((gp) => gp.property_id);
    return properties.filter((p) => myIds.includes(p.id));
  }, [me?.address, gameProperties, properties]);

  const justLandedProperty = useMemo(() => {
    const pos = landedPositionForBuy ?? me?.position;
    if (pos == null) return null;
    const square = properties.find((p) => p.id === pos);
    if (!square || square.price == null) return null;
    const isOwned = gameProperties.some((gp) => gp.property_id === pos);
    const action = PROPERTY_ACTION(pos);
    const isBuyableType = !!action && ["land", "railway", "utility"].includes(action);
    return !isOwned && isBuyableType ? square : null;
  }, [landedPositionForBuy, me?.position, properties, gameProperties]);

  const positions = useMemo(() => {
    if (!isLiveGame) return {};
    const merged: Record<number, number> = {};
    livePlayers.forEach((p) => {
      merged[p.user_id] = liveMovementOverride[p.user_id] ?? liveAnimatedPositions[p.user_id] ?? p.position ?? 0;
    });
    return merged;
  }, [isLiveGame, liveAnimatedPositions, liveMovementOverride, livePlayers]);

  const { tradeRequests: incomingTrades } = useGameTrades({
    gameId: game?.id,
    myUserId: me?.user_id,
    players: livePlayers,
  });

  const buyGuard = usePreventDoubleSubmit();
  const jailGuard = usePreventDoubleSubmit();

  const showToast = useCallback((message: string, type?: "success" | "error" | "default") => {
    if (type === "success") toast.success(message);
    else if (type === "error") toast.error(message);
    else toast(message);
  }, []);

  const fetchUpdatedGame = useCallback(async () => {
    await refetchGame();
    await refetchGameProperties();
  }, [refetchGame, refetchGameProperties]);

  const END_TURN = useCallback(async () => {
    if (currentPlayerId == null || !game?.id || turnEndInProgressRef.current) return;
    turnEndInProgressRef.current = true;
    try {
      await apiClient.post("/game-players/end-turn", {
        user_id: currentPlayerId,
        game_id: game.id,
      });
      setBuyPrompted(false);
      setTurnEndScheduled(false);
      setJailChoiceRequired(false);
      setLandedPositionForBuy(null);
      setLastRollResultLive(null);
      landedPositionThisTurnRef.current = null;
      await refetchGame();
    } catch (err) {
      toast.error(getContractErrorMessage(err, "Failed to end turn"));
      setTurnEndScheduled(false);
    } finally {
      turnEndInProgressRef.current = false;
    }
  }, [currentPlayerId, game?.id, refetchGame]);

  const runMovementAnimation = useCallback(
    async (playerId: number, currentPos: number, totalSteps: number) => {
      if (totalSteps <= 0) return;
      for (let step = 1; step <= totalSteps; step++) {
        await new Promise((r) => setTimeout(r, MOVE_ANIMATION_MS_PER_SQUARE));
        setLiveMovementOverride((prev) => ({
          ...prev,
          [playerId]: (currentPos + step) % 40,
        }));
      }
      await new Promise((r) => setTimeout(r, 50));
    },
    []
  );

  const calculateBuyScore = useCallback(
    (property: Property, player: Player, gameProps: GameProperty[], allProperties: Property[]): number => {
      if (!property.price || property.type !== "property") return 0;
      const price = property.price;
      const baseRent = property.rent_site_only || 0;
      const cash = player.balance ?? 0;
      let score = 30;
      if (cash < price * 1.5) score -= 80;
      else if (cash < price * 2) score -= 40;
      else if (cash > price * 4) score += 35;
      else if (cash > price * 3) score += 15;
      const group = Object.values(MONOPOLY_STATS.colorGroups).find((g: number[]) => g.includes(property.id));
      if (group && property.color && !["railroad", "utility"].includes(property.color)) {
        const owned = group.filter(
          (id: number) => gameProps.find((gp) => gp.property_id === id)?.address === player.address
        ).length;
        if (owned === group.length - 1) score += 120;
        else if (owned === group.length - 2) score += 60;
        else if (owned >= 1) score += 25;
      }
      if (property.color === "railroad") {
        const owned = gameProps.filter(
          (gp) =>
            gp.address === player.address &&
            allProperties.find((p) => p.id === gp.property_id)?.color === "railroad"
        ).length;
        score += owned * 22;
      }
      if (property.color === "utility") {
        const owned = gameProps.filter(
          (gp) =>
            gp.address === player.address &&
            allProperties.find((p) => p.id === gp.property_id)?.type === "utility"
        ).length;
        score += owned * 28;
      }
      const rank = (MONOPOLY_STATS.landingRank as Record<number, number>)[property.id] ?? 25;
      score += 35 - rank;
      const roi = baseRent / price;
      if (roi > 0.14) score += 30;
      else if (roi > 0.1) score += 15;
      if (group && group.length <= 3) {
        const opponentOwns = group.filter((id: number) => {
          const gp = gameProps.find((g) => g.property_id === id);
          return gp && gp.address !== player.address && gp.address != null;
        }).length;
        if (opponentOwns === group.length - 1) score += 70;
      }
      return Math.max(0, Math.min(95, score));
    },
    []
  );

  const handleAiStrategy = useCallback(async () => {
    if (!currentPlayer || !isAITurn || strategyRanThisTurn || !game || !isLiveGame) return;

    const getPlayerOwnedProperties = (
      playerAddress: string | undefined,
      game_props: GameProperty[],
      props: Property[]
    ) => {
      if (!playerAddress) return [];
      return game_props
        .filter((gp) => gp.address?.toLowerCase() === playerAddress.toLowerCase())
        .map((gp) => ({ gp, prop: props.find((p) => p.id === gp.property_id)! }))
        .filter((item) => !!item.prop);
    };

    const getCompleteMonopolies = (
      playerAddress: string | undefined,
      game_props: GameProperty[],
      props: Property[]
    ) => {
      const owned = getPlayerOwnedProperties(playerAddress, game_props, props);
      const monopolies: string[] = [];
      Object.entries(MONOPOLY_STATS.colorGroups).forEach(([groupName, ids]) => {
        if (groupName === "railroad" || groupName === "utility") return;
        const ownedInGroup = owned.filter((o) => ids.includes(o.prop.id));
        if (ownedInGroup.length === ids.length) {
          const allUnmortgaged = ownedInGroup.every((o) => !o.gp.mortgaged);
          if (allUnmortgaged) monopolies.push(groupName);
        }
      });
      return monopolies.sort((a, b) => BUILD_PRIORITY.indexOf(a) - BUILD_PRIORITY.indexOf(b));
    };

    const getNearCompleteOpportunities = (
      playerAddress: string | undefined,
      game_props: GameProperty[],
      props: Property[],
      plrs: Player[]
    ) => {
      const owned = getPlayerOwnedProperties(playerAddress, game_props, props);
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
              const gp = game_props.find((g) => g.property_id === id);
              const prop = props.find((p) => p.id === id)!;
              const ownerName = gp?.address
                ? plrs.find((p) => p.address?.toLowerCase() === gp.address?.toLowerCase())?.username ??
                  gp.address.slice(0, 8)
                : "Bank";
              return { id, name: prop.name, ownerAddress: gp?.address ?? null, ownerName };
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
            (gid) => gameProperties.find((gp) => gp.property_id === gid && gp.address === receiverAddress)
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
    };

    const calculateFairCashOffer = (propertyId: number, completesSet: boolean, basePrice: number) =>
      completesSet ? Math.floor(basePrice * 1.6) : Math.floor(basePrice * 1.3);

    const getPropertyToOffer = (playerAddress: string, excludeGroups: string[]) => {
      const owned = getPlayerOwnedProperties(playerAddress, gameProperties, properties);
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
    };

    const opportunities = getNearCompleteOpportunities(
      currentPlayer.address ?? undefined,
      gameProperties,
      properties,
      livePlayers
    );
    let maxTradeAttempts = 1;

    for (const opp of opportunities) {
      if (maxTradeAttempts <= 0) break;
      for (const missing of opp.missing) {
        if (!missing.ownerAddress || missing.ownerAddress === "bank") continue;
        const targetPlayer = livePlayers.find(
          (p) => p.address?.toLowerCase() === missing.ownerAddress?.toLowerCase()
        );
        if (!targetPlayer) continue;

        const basePrice = properties.find((p) => p.id === missing.id)?.price ?? 200;
        const cashOffer = calculateFairCashOffer(missing.id, opp.needs === 1, basePrice);

        let offerProperties: number[] = [];
        if ((currentPlayer.balance ?? 0) < cashOffer + 300) {
          const toOffer = getPropertyToOffer(currentPlayer.address!, [opp.group]);
          if (toOffer) offerProperties = [toOffer.prop.id];
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
            maxTradeAttempts--;
            if (isAIPlayer(targetPlayer)) {
              await new Promise((r) => setTimeout(r, 800));
              const favorability = calculateTradeFavorability(
                { ...payload, requested_amount: 0 },
                targetPlayer.address!
              );
              if (favorability >= 50) {
                await apiClient.post("/game-trade-requests/accept", { id: res.data.data.id });
                await refetchGame();
              } else {
                await apiClient.post("/game-trade-requests/decline", { id: res.data.data.id });
              }
            }
          }
        } catch (err) {
          console.error("Trade failed", err);
        }
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    const handleAiBuilding = async (player: Player) => {
      if (!player.address) return;
      const monopolies = getCompleteMonopolies(player.address, gameProperties, properties);
      if (monopolies.length === 0) return;

      for (const groupName of monopolies) {
        const ids = MONOPOLY_STATS.colorGroups[groupName as keyof typeof MONOPOLY_STATS.colorGroups];
        const groupGps = gameProperties.filter(
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
            await new Promise((r) => setTimeout(r, 600));
            break;
          } catch (err) {
            console.error("Build failed", err);
            break;
          }
        }
      }
    };

    await handleAiBuilding(currentPlayer);
    setStrategyRanThisTurn(true);
  }, [
    game,
    properties,
    gameProperties,
    livePlayers,
    currentPlayer,
    isAITurn,
    strategyRanThisTurn,
    isLiveGame,
    refetchGame,
  ]);

  const { handleBuild, handleSellBuilding, handleMortgageToggle, handleSellToBank } = useMobilePropertyActions(
    game?.id ?? 0,
    me?.user_id,
    isMyTurn,
    fetchUpdatedGame,
    showToast
  );

  const handlePropertyClick = useCallback(
    (square: Property) => {
      const gp = gameProperties.find((g) => g.property_id === square.id);
      setSelectedProperty(square);
      setSelectedGameProperty(gp);
    },
    [gameProperties]
  );

  const handleRollForLive = useCallback(() => {
    if (rollingDice || !game || !me) return;
    const value = getDiceValues() ?? { die1: 6, die2: 6, total: 12 };
    pendingRollRef.current = value;
    rollingForPlayerIdRef.current = me.user_id;
    setRollingDice({ die1: value.die1, die2: value.die2 });
  }, [rollingDice, game, me]);

  const handleDiceCompleteForLive = useCallback(async () => {
    const value = pendingRollRef.current;
    if (!game?.id || !me) {
      setRollingDice(null);
      rollingForPlayerIdRef.current = null;
      return;
    }
    const currentPos = me.position ?? 0;
    const isInJail = !!(me.in_jail && currentPos === JAIL_POSITION);
    const rolledDouble = value.die1 === value.die2;
    const newPos = (isInJail && !rolledDouble) ? currentPos : (currentPos + value.total) % 40;
    const totalSteps = isInJail && !rolledDouble ? 0 : value.total;

    try {
      await runMovementAnimation(me.user_id, currentPos, totalSteps);
      const res = await apiClient.post<{ data?: { still_in_jail?: boolean; new_position?: number } }>(
        "/game-players/change-position",
        {
          user_id: me.user_id,
          game_id: game.id,
          position: newPos,
          rolled: value.total,
          is_double: rolledDouble,
        }
      );
      const data = res?.data?.data ?? (res as { data?: { still_in_jail?: boolean; new_position?: number } })?.data;
      if (data?.still_in_jail) {
        setJailChoiceRequired(true);
      }
      setLastRollResultLive(value);
      const finalPosition = data?.new_position != null ? data.new_position : newPos;
      landedPositionThisTurnRef.current = finalPosition;
      await Promise.all([refetchGame(), refetchGameProperties()]);
      setLiveMovementOverride((prev) => {
        const next = { ...prev };
        if (finalPosition !== newPos) next[me.user_id] = finalPosition;
        else delete next[me.user_id];
        return next;
      });
      setLandedPositionForBuy(finalPosition);
      const square = properties.find((p) => p.id === finalPosition);
      const freshGameProperties = gameProperties;
      const isOwned = freshGameProperties.some((gp: GameProperty) => gp.property_id === finalPosition);
      const action = PROPERTY_ACTION(finalPosition);
      const isBuyableType = !!action && ["land", "railway", "utility"].includes(action);
      const needBuyPrompt = !!square && square.price != null && !isOwned && isBuyableType;
      if (needBuyPrompt) setBuyPrompted(true);
    } catch (err) {
      setLiveMovementOverride((prev) => {
        const next = { ...prev };
        delete next[me.user_id];
        return next;
      });
      toast.error(getContractErrorMessage(err, "Roll failed"));
    } finally {
      setRollingDice(null);
      rollingForPlayerIdRef.current = null;
    }
  }, [
    game?.id,
    me,
    refetchGame,
    refetchGameProperties,
    properties,
    gameProperties,
    runMovementAnimation,
  ]);

  const handleDiceCompleteForAI = useCallback(async () => {
    const value = pendingRollRef.current;
    if (!game?.id || !currentPlayer) {
      setRollingDice(null);
      rollingForPlayerIdRef.current = null;
      return;
    }
    const playerId = currentPlayer.user_id;
    const currentPos = currentPlayer.position ?? 0;
    const isInJail = !!(currentPlayer.in_jail && currentPos === JAIL_POSITION);
    const rolledDouble = value.die1 === value.die2;
    const newPos = (isInJail && !rolledDouble) ? currentPos : (currentPos + value.total) % 40;
    const totalSteps = isInJail && !rolledDouble ? 0 : value.total;

    try {
      await runMovementAnimation(playerId, currentPos, totalSteps);
      const res = await apiClient.post<{ data?: { still_in_jail?: boolean } }>(
        "/game-players/change-position",
        {
          user_id: playerId,
          game_id: game.id,
          position: newPos,
          rolled: value.total,
          is_double: rolledDouble,
        }
      );
      const data = res?.data?.data ?? (res as { data?: { still_in_jail?: boolean } })?.data;
      if (data?.still_in_jail) {
        await apiClient.post("/game-players/stay-in-jail", { user_id: playerId, game_id: game.id });
        await refetchGame();
        setRollingDice(null);
        rollingForPlayerIdRef.current = null;
        setTimeout(() => END_TURN(), 500);
        return;
      }
      setLastRollResultLive(value);
      landedPositionThisTurnRef.current = newPos;
      rolledForPlayerIdRef.current = playerId;
      const refetchResult = await refetchGame();
      const updatedGame = refetchResult?.data;
      const updatedPlayer =
        updatedGame?.players?.find((p: Player) => p.user_id === playerId) ?? currentPlayer;
      const balanceAfterMove = updatedPlayer?.balance ?? currentPlayer.balance ?? 0;
      setLiveMovementOverride((prev) => {
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
      const square = properties.find((p) => p.id === newPos);
      const isOwned = gameProperties.some((gp: GameProperty) => gp.property_id === newPos);
      const action = PROPERTY_ACTION(newPos);
      const isBuyableType = !!action && ["land", "railway", "utility"].includes(action);
      const needBuyPrompt = !!square && square.price != null && !isOwned && isBuyableType;

      if (needBuyPrompt && square) {
        const playerForScore = { ...currentPlayer, balance: balanceAfterMove };
        const buyScore = calculateBuyScore(square, playerForScore, gameProperties, properties);
        let shouldBuy: boolean;
        try {
          const slot = getAiSlotFromPlayer(currentPlayer) ?? 2;
          const groupIds =
            Object.values(MONOPOLY_STATS.colorGroups).find((ids: number[]) => ids.includes(square.id)) ?? [];
          const ownedInGroup = groupIds.filter((id: number) =>
            gameProperties.some(
              (gp) =>
                gp.property_id === id &&
                gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase()
            )
          ).length;
          const completesMonopoly = groupIds.length > 0 && ownedInGroup === groupIds.length - 1;
          const landingRank = (MONOPOLY_STATS.landingRank as Record<number, number>)[square.id] ?? 99;
          const agentRes = await apiClient.post<{
            success?: boolean;
            data?: { action?: string; reasoning?: string };
            useBuiltIn?: boolean;
          }>("/agent-registry/decision", {
            gameId: game.id,
            slot,
            decisionType: "property",
            context: {
              myBalance: balanceAfterMove,
              myProperties: gameProperties
                .filter(
                  (gp) => gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase()
                )
                .map((gp) => ({ ...properties.find((p) => p.id === gp.property_id), ...gp })),
              opponents: (game.players ?? []).filter((p) => p.user_id !== currentPlayer.user_id),
              landedProperty: { ...square, completesMonopoly, landingRank },
            },
          });
          if (
            agentRes?.data?.success &&
            agentRes.data.useBuiltIn === false &&
            agentRes.data.data?.action
          ) {
            shouldBuy = agentRes.data.data.action.toLowerCase() === "buy";
          } else {
            shouldBuy =
              buyScore >= 72 && balanceAfterMove > (square.price ?? 0) * 1.8;
          }
        } catch {
          shouldBuy = buyScore >= 72 && balanceAfterMove > (square.price ?? 0) * 1.8;
        }
        if (shouldBuy) {
          await apiClient.post("/game-properties/buy", {
            user_id: playerId,
            game_id: game.id,
            property_id: square.id,
          });
        }
        await refetchGame();
        setTimeout(() => END_TURN(), 900);
      } else {
        setTimeout(() => END_TURN(), 1000);
      }
    } catch (err) {
      setLiveMovementOverride((prev) => {
        const next = { ...prev };
        delete next[currentPlayer.user_id];
        return next;
      });
      toast.error(getContractErrorMessage(err, "AI move failed"));
      setTimeout(() => END_TURN(), 500);
    } finally {
      setRollingDice(null);
      rollingForPlayerIdRef.current = null;
    }
  }, [
    game,
    currentPlayer,
    refetchGame,
    properties,
    gameProperties,
    runMovementAnimation,
    calculateBuyScore,
    END_TURN,
  ]);

  const onRollClick = useCallback(() => {
    if (isLiveGame && playerCanRoll) handleRollForLive();
  }, [isLiveGame, playerCanRoll, handleRollForLive]);

  const onDiceCompleteClick = useCallback(() => {
    if (!isLiveGame) return;
    if (rollingForPlayerIdRef.current !== null && me && rollingForPlayerIdRef.current !== me.user_id) {
      handleDiceCompleteForAI();
    } else {
      handleDiceCompleteForLive();
    }
  }, [isLiveGame, handleDiceCompleteForLive, handleDiceCompleteForAI, me]);

  const handleBuy = useCallback(async () => {
    if (!game?.id || !me || !justLandedProperty) return;
    try {
      await apiClient.post("/game-properties/buy", {
        user_id: me.user_id,
        game_id: game.id,
        property_id: justLandedProperty.id,
      });
      toast.success(`You bought ${justLandedProperty.name}!`);
      setBuyPrompted(false);
      setLandedPositionForBuy(null);
      landedPositionThisTurnRef.current = null;
      await refetchGame();
      setTimeout(() => END_TURN(), 800);
    } catch (err) {
      toast.error(getContractErrorMessage(err, "Purchase failed"));
    }
  }, [game?.id, me, justLandedProperty, refetchGame, END_TURN]);

  const handleSkip = useCallback(() => {
    setTurnEndScheduled(true);
    setBuyPrompted(false);
    setLandedPositionForBuy(null);
    landedPositionThisTurnRef.current = null;
    setTimeout(() => END_TURN(), 900);
  }, [END_TURN]);

  const handlePayToLeaveJail = useCallback(async () => {
    if (!me || !game?.id) return;
    try {
      await apiClient.post("/game-players/pay-to-leave-jail", { game_id: game.id, user_id: me.user_id });
      setJailChoiceRequired(false);
      toast.success("Paid $50. You may now roll.");
      await refetchGame();
    } catch (err) {
      toast.error(getContractErrorMessage(err, "Pay jail fine failed"));
    }
  }, [me, game?.id, refetchGame]);

  const handleUseGetOutOfJailFree = useCallback(
    async (cardType: "chance" | "community_chest"): Promise<void> => {
      if (!me || !game?.id) return;
      try {
        await apiClient.post("/game-players/use-get-out-of-jail-free", {
          game_id: game.id,
          user_id: me.user_id,
          card_type: cardType,
        });
        setJailChoiceRequired(false);
        toast.success("Used Get Out of Jail Free. You may now roll.");
        await refetchGame();
      } catch (err) {
        toast.error(getContractErrorMessage(err, "Use card failed"));
      }
    },
    [me, game?.id, refetchGame]
  );

  const handleStayInJail = useCallback(async () => {
    if (!me || !game?.id) return;
    try {
      await apiClient.post("/game-players/stay-in-jail", { user_id: me.user_id, game_id: game.id });
      setJailChoiceRequired(false);
      await refetchGame();
      setTimeout(() => END_TURN(), 500);
    } catch (err) {
      toast.error(getContractErrorMessage(err, "Stay in jail failed"));
    }
  }, [me, game?.id, refetchGame, END_TURN]);

  const toggleFullscreen = useCallback(() => {
    const el = fullscreenRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  const toggleAiTips = useCallback(() => {
    setAiTipsOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(AI_TIPS_STORAGE_KEY, String(next));
      } catch {}
      if (!next) setAiTipText(null);
      return next;
    });
  }, []);

  const getCurrentRent = useCallback(
    (prop: Property, gp: GameProperty | undefined): number => {
      if (!gp || !gp.address) return prop.rent_site_only ?? 0;
      if (gp.mortgaged) return 0;
      if (gp.development === 5) return prop.rent_hotel ?? 0;
      switch (gp.development ?? 0) {
        case 1:
          return prop.rent_one_house ?? 0;
        case 2:
          return prop.rent_two_houses ?? 0;
        case 3:
          return prop.rent_three_houses ?? 0;
        case 4:
          return prop.rent_four_houses ?? 0;
        default:
          return prop.rent_site_only ?? 0;
      }
    },
    []
  );

  const triggerLandingLogic = useCallback(
    (newPosition: number, isSpecial = false) => {
      if (landedPositionThisTurnRef.current !== null) return;
      landedPositionThisTurnRef.current = newPosition;
      setLandedPositionForBuy(newPosition);
      if (me?.user_id != null) {
        setLiveMovementOverride((prev) => ({ ...prev, [me.user_id]: newPosition }));
      }
      setTimeout(() => {
        const square = properties.find((p) => p.id === newPosition);
        if (square?.price != null) {
          const isOwned = gameProperties.some((gp) => gp.property_id === newPosition);
          const action = PROPERTY_ACTION(newPosition);
          if (!isOwned && action && ["land", "railway", "utility"].includes(action)) {
            setBuyPrompted(true);
          }
        }
      }, 300);
    },
    [properties, gameProperties, me?.user_id]
  );

  const endTurnAfterSpecialMove = useCallback(() => {
    setBuyPrompted(false);
    setLandedPositionForBuy(null);
    landedPositionThisTurnRef.current = null;
    setTimeout(END_TURN, 800);
  }, [END_TURN]);

  useEffect(() => {
    setStrategyRanThisTurn(false);
    rolledForPlayerIdRef.current = null;
  }, [currentPlayerId]);

  useEffect(() => {
    if (!isAITurn || !currentPlayer || strategyRanThisTurn || !isLiveGame) return;
    const t = setTimeout(handleAiStrategy, 1000);
    return () => clearTimeout(t);
  }, [isAITurn, currentPlayer, strategyRanThisTurn, isLiveGame, handleAiStrategy]);

  useEffect(() => {
    if (
      !isLiveGame ||
      !isAITurn ||
      !strategyRanThisTurn ||
      rollingDice ||
      !currentPlayerId ||
      !currentPlayer
    )
      return;
    if (me != null && currentPlayerId === me.user_id) return;
    if (rolledForPlayerIdRef.current === currentPlayerId) return;
    const balance = currentPlayer.balance != null ? Number(currentPlayer.balance) : 0;
    if (balance < 0) return;
    const t = setTimeout(() => {
      if (me != null && currentPlayerId === me.user_id) return;
      const value = getDiceValues() ?? { die1: 6, die2: 6, total: 12 };
      pendingRollRef.current = value;
      rollingForPlayerIdRef.current = currentPlayerId;
      setRollingDice({ die1: value.die1, die2: value.die2 });
    }, 1500);
    return () => clearTimeout(t);
  }, [isLiveGame, isAITurn, strategyRanThisTurn, rollingDice, currentPlayerId, currentPlayer, me]);

  useEffect(() => {
    if (!isLiveGame || !isMyTurn || !lastRollResultLive || buyPrompted || jailChoiceRequired || rollingDice) {
      hasScheduledTurnEndRef.current = false;
      return;
    }
    if (hasScheduledTurnEndRef.current) return;
    hasScheduledTurnEndRef.current = true;
    setTurnEndScheduled(true);
    const timer = setTimeout(() => {
      END_TURN();
      hasScheduledTurnEndRef.current = false;
    }, 1500);
    return () => {
      clearTimeout(timer);
      hasScheduledTurnEndRef.current = false;
    };
  }, [isLiveGame, isMyTurn, lastRollResultLive, buyPrompted, jailChoiceRequired, rollingDice, END_TURN]);

  useEffect(() => {
    const history = game?.history ?? [];
    if (history.length === 0) return;
    const first =
      typeof history[0] === "object" && history[0] !== null
        ? (history[0] as { id?: number; comment?: string; player_name?: string })
        : null;
    const topId = first?.id ?? 0;
    if (lastTopHistoryIdRef.current === null) {
      lastTopHistoryIdRef.current = topId;
      return;
    }
    if (topId === lastTopHistoryIdRef.current) return;
    lastTopHistoryIdRef.current = topId;
    if (!first?.comment) return;
    const cardRegex = /drew\s+(chance|community\s+chest):\s*(.+)/i;
    const match = first.comment.match(cardRegex);
    if (!match || !match[2]) return;
    const [, typeStr, text] = match;
    const cardText = text.replace(/\s*\[Rolled\s+\d+\].*$/i, "").trim();
    if (!cardText) return;
    const type = typeStr.toLowerCase().includes("chance") ? "chance" : "community";
    const lowerText = cardText.toLowerCase();
    const isGood =
      lowerText.includes("collect") ||
      lowerText.includes("receive") ||
      lowerText.includes("advance") ||
      lowerText.includes("get out of jail") ||
      lowerText.includes("matures") ||
      lowerText.includes("refund") ||
      lowerText.includes("prize") ||
      lowerText.includes("inherit");
    const effectMatch = cardText.match(/([+-]?\$\d+)|go to jail|move to .+|get out of jail free/i);
    const effect = effectMatch ? effectMatch[0] : undefined;
    setCardData({ type, text: cardText, effect, isGood });
    setCardPlayerName(String(first.player_name ?? "").trim() || "Player");
    setShowCardModal(true);
  }, [game?.history]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!buyPrompted) {
      setAiTipText(null);
      lastTipPropertyIdRef.current = null;
    }
  }, [buyPrompted]);

  useEffect(() => {
    if (
      !aiTipsOn ||
      !isMyTurn ||
      !buyPrompted ||
      !justLandedProperty ||
      !currentPlayer ||
      currentPlayer?.user_id !== me?.user_id
    )
      return;
    const propId = justLandedProperty.id;
    if (lastTipPropertyIdRef.current === propId) return;
    lastTipPropertyIdRef.current = propId;
    setAiTipLoading(true);
    const groupIds =
      Object.values(MONOPOLY_STATS.colorGroups).find((ids) => ids.includes(justLandedProperty.id)) ?? [];
    const ownedInGroup = groupIds.filter((id) =>
      gameProperties.some(
        (gp) => gp.property_id === id && gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase()
      )
    ).length;
    const completesMonopoly = groupIds.length > 0 && ownedInGroup === groupIds.length - 1;
    const landingRank = (MONOPOLY_STATS.landingRank as Record<number, number>)[justLandedProperty.id] ?? 99;
    apiClient
      .post<{ success?: boolean; data?: { reasoning?: string } }>("/agent-registry/decision", {
        gameId: game?.id,
        slot: 1,
        decisionType: "tip",
        context: {
          myBalance: currentPlayer.balance ?? 0,
          myProperties: gameProperties
            .filter((gp) => gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase())
            .map((gp) => ({ ...properties.find((p) => p.id === gp.property_id), ...gp })),
          opponents: (game?.players ?? []).filter((p) => p.user_id !== currentPlayer.user_id),
          situation: "buy_property",
          property: { ...justLandedProperty, completesMonopoly, landingRank },
        },
      })
      .then((res) => {
        const text = res?.data?.data?.reasoning ?? null;
        if (text) setAiTipText(text);
      })
      .catch(() => setAiTipText(null))
      .finally(() => setAiTipLoading(false));
  }, [
    aiTipsOn,
    isMyTurn,
    buyPrompted,
    justLandedProperty,
    currentPlayer,
    me?.user_id,
    game?.id,
    game?.players,
    gameProperties,
    properties,
  ]);

  useEffect(() => {
    if (!game || game.status !== "FINISHED" || game.winner_id == null) return;
    const winnerPlayer =
      livePlayers.find((p) => p.user_id === game.winner_id) ??
      (me?.user_id === game.winner_id ? me : null);
    if (!winnerPlayer) return;
    setWinner(winnerPlayer);
    const turnCount = winnerPlayer.turn_count ?? 0;
    const validWin = turnCount >= 20;
    setEndGameCandidate({
      winner: winnerPlayer,
      position: winnerPlayer.position ?? 0,
      balance: BigInt(winnerPlayer.balance ?? 0),
      validWin,
    });
  }, [game?.status, game?.winner_id, livePlayers, me]);

  const handleGameTimeUp = useCallback(async () => {
    if (timeUpHandledRef.current || game?.status !== "RUNNING") return;
    timeUpHandledRef.current = true;
    setGameTimeUpLocal(true);
    try {
      const res = await apiClient.post<{
        success?: boolean;
        data?: { winner_id: number; game?: { players?: Player[] }; valid_win?: boolean };
      }>(`/games/${game!.id}/finish-by-time`);
      const data = res?.data?.data;
      const winnerId = data?.winner_id;
      if (winnerId != null) {
        const updatedPlayers = data?.game?.players ?? game?.players ?? [];
        const winnerPlayer = updatedPlayers.find((p: Player) => p.user_id === winnerId) ?? null;
        setWinner(winnerPlayer);
        const myPosition = me?.position ?? 0;
        const myBalance = BigInt(me?.balance ?? 0);
        const validWin = data?.valid_win !== false;
        if (winnerId === me?.user_id) {
          setEndGameCandidate({ winner: me!, position: myPosition, balance: myBalance, validWin });
        } else {
          setEndGameCandidate({
            winner: null,
            position: myPosition,
            balance: myBalance,
            validWin: true,
          });
        }
      }
      await refetchGame();
    } catch (e) {
      console.error("Finish by time failed:", e);
      timeUpHandledRef.current = false;
      setGameTimeUpLocal(false);
    }
  }, [game?.id, game?.status, game?.players, me, refetchGame]);

  const { data: contractGame } = useGetGameByCode(game?.code ?? "");
  const endGameFinalPosition = endGameCandidate.winner ? 1 : 2;
  const onChainGameId =
    contractGame?.id ??
    (game?.contract_game_id != null && game?.contract_game_id !== ""
      ? BigInt(game.contract_game_id)
      : undefined);
  const {
    write: endGame,
    isPending: endGamePending,
    reset: endGameReset,
  } = useEndAIGameAndClaim(
    onChainGameId ?? BigInt(0),
    endGameFinalPosition,
    endGameCandidate.balance,
    endGameCandidate.winner ? endGameCandidate.validWin !== false : false
  );

  const handleDeclareBankruptcy = useCallback(async () => {
    if (!game?.id || !me) return;
    toast("Declaring bankruptcy...", { icon: "…" });
    try {
      if (!isGuest && contractGame?.id && contractGame.id !== BigInt(0) && contractGame.ai) {
        setEndGameCandidate({
          winner: null,
          position: 2,
          balance: BigInt(me?.balance ?? 0),
          validWin: true,
        });
        await endGame();
      }
      const opponent = livePlayers.find((p) => p.user_id !== me.user_id);
      await apiClient.put(`/games/${game.id}`, {
        status: "FINISHED",
        winner_id: opponent?.user_id ?? null,
      });
      toast.error("Game over! You have declared bankruptcy.");
      setShowBankruptcyModal(true);
    } catch (err) {
      toast.error(getContractErrorMessage(err, "Failed to end game"));
    }
  }, [game?.id, me, livePlayers, isGuest, contractGame, endGame]);

  const handleClaimAndGoHome = useCallback(async () => {
    setClaimAndLeaveInProgress(true);
    const isHumanWinner = winner?.user_id === me?.user_id;
    try {
      if (!isGuest) {
        if (!contractGame?.id || contractGame.id === BigInt(0) || !contractGame.ai) {
          toast.error(
            "Could not claim: this game isn't an AI game on-chain. Make sure your wallet is on the same network you used when creating the game (e.g. Celo)."
          );
          setClaimAndLeaveInProgress(false);
          return;
        }
        await endGame();
      }
      try {
        await refetchGame();
      } catch (_) {
        /* ignore */
      }
      toast.success(isHumanWinner ? "Prize claimed! 🎉" : "Consolation collected — thanks for playing!");
      try {
        await apiClient.post(`/games/${game?.id}/erc8004-feedback`);
      } catch (_) {
        /* best-effort */
      }
      window.location.href = "/";
    } catch (err) {
      toast.error(getContractErrorMessage(err as Error, "Something went wrong — try again later"));
      setClaimAndLeaveInProgress(false);
    } finally {
      endGameReset?.();
    }
  }, [
    winner?.user_id,
    me?.user_id,
    isGuest,
    game?.id,
    refetchGame,
    endGame,
    endGameReset,
    contractGame,
  ]);

  const historyToShow = isLiveGame && game?.history?.length ? game.history : [];
  const lastRollResultToShow = lastRollResultLive;
  const showRollUi = !isLiveGame || (playerCanRoll && !(meInJail && !jailChoiceRequired));

  const players = isLiveGame ? livePlayers : [];
  const emptyPlayers = useMemo(() => [], []);

  return (
    <div
      ref={fullscreenRef}
      className="fixed inset-0 w-full bg-[#010F10] overflow-hidden"
      style={{ height: "100dvh" }}
    >
      {/* Balance — visible in normal and fullscreen */}
      {isLiveGame && me && (
        <div
          className="fixed left-3 z-[100] px-3 py-2 rounded-xl bg-slate-800/95 border border-cyan-500/50 text-cyan-200 text-sm font-bold shadow-lg"
          style={{ top: "max(0.5rem, env(safe-area-inset-top))", zIndex: 2147483646 }}
        >
          ${Number(me.balance ?? 0).toLocaleString()}
        </div>
      )}

      {/* Timer */}
      {isLiveGame && game && !isUntimed && game.duration && (
        <GameDurationCountdown
          game={game}
          onTimeUp={handleGameTimeUp}
          className="fixed top-2 left-1/2 -translate-x-1/2 z-30 text-slate-200 text-sm bg-slate-800/90 px-3 py-1.5 rounded-lg"
        />
      )}

      <main
        className="w-full relative overflow-hidden"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: `${BOARD_HEIGHT_PCT}%`,
          zIndex: 0,
          isolation: "isolate",
        }}
      >
        {isLoading || (gameCode && gameLoading) ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-slate-400">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-500/50 border-t-cyan-400 animate-spin" />
            <p className="text-sm">{gameCode ? "Loading game…" : "Loading board…"}</p>
          </div>
        ) : (
          <div
            className="absolute inset-0 w-full h-full overflow-hidden"
            style={{ touchAction: "none", zIndex: 0, isolation: "isolate" }}
          >
            <Canvas
              camera={{ position: [0, 12, 12], fov: 45 }}
              shadows
              gl={{ antialias: true, alpha: false }}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                display: "block",
              }}
            >
              <BoardScene
                properties={properties}
                players={isLiveGame ? players : emptyPlayers}
                animatedPositions={isLiveGame ? positions : {}}
                currentPlayerId={isLiveGame ? currentPlayerId : null}
                developmentByPropertyId={liveDevelopmentByPropertyId}
                ownerByPropertyId={isLiveGame ? ownerByPropertyId : undefined}
                ownerSymbolByPropertyId={isLiveGame ? ownerSymbolByPropertyId : undefined}
                onSquareClick={handlePropertyClick}
                rollingDice={rollingDice ?? undefined}
                onDiceComplete={isLiveGame ? onDiceCompleteClick : undefined}
                lastRollResult={lastRollResultToShow}
                onRoll={showRollUi ? onRollClick : undefined}
                history={historyToShow}
                hideCenterActionLog={true}
                hideOwnerBadges={false}
                smallTokens={true}
                aiThinking={isLiveGame && !isMyTurn && currentPlayerId != null}
                resetViewTrigger={resetViewTrigger}
              />
            </Canvas>
          </div>
        )}
      </main>

      {/* Action log — between board and bottom bar */}
      {isLiveGame && (
        <div
          className="absolute left-2 right-2 z-10 flex flex-col"
          style={{
            top: `${BOARD_HEIGHT_PCT}%`,
            bottom: "72px",
          }}
        >
          <ActionLog
            history={historyToShow}
            className="h-full min-h-0 flex-1 !mt-0 !max-w-none"
          />
        </div>
      )}

      {/* Reset view + Fullscreen — visible in normal and fullscreen */}
      {!(gameCode && gameError) && !(isLoading || (gameCode && gameLoading)) && (
        <div
          className="absolute top-2 right-3 z-[100] flex items-center gap-2"
          style={{ top: "max(0.5rem, env(safe-area-inset-top))" }}
        >
          <button
            type="button"
            onClick={() => setResetViewTrigger((t) => t + 1)}
            className="px-3 py-2 rounded-lg bg-slate-700/95 hover:bg-slate-600 border border-slate-500/60 text-slate-200 text-sm font-medium shadow-lg"
            title="Reset board view to default"
            aria-label="Reset board view"
          >
            Reset view
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-3 py-2 rounded-lg bg-slate-700/95 hover:bg-slate-600 border border-slate-500/60 text-slate-200 text-sm font-medium shadow-lg"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? "Exit" : "Fullscreen"}
          </button>
        </div>
      )}

      <Mobile3DGameUI
        game={game ?? null}
        properties={properties}
        game_properties={gameProperties}
        my_properties={my_properties}
        me={me ?? null}
        currentPlayer={currentPlayer ?? null}
        positions={positions}
        isAITurn={isAITurn}
        isLoading={!!gameCode && gameLoading}
        onPropertySelect={(prop: Property, gp?: GameProperty) => {
          setSelectedProperty(prop);
          setSelectedGameProperty(gp ?? undefined);
        }}
        viewTradesRequested={viewTradesRequested}
        onViewTrades={() => setViewTradesRequested(true)}
        onTradeSectionOpened={() => setViewTradesRequested(false)}
        incomingTradeCount={incomingTrades?.length ?? 0}
        showPerksModal={showPerksModal}
        setShowPerksModal={setShowPerksModal}
        isMyTurn={isMyTurn}
        onRollDice={playerCanRoll ? handleRollForLive : undefined}
        onEndTurn={END_TURN}
        triggerSpecialLanding={triggerLandingLogic}
        endTurnAfterSpecial={endTurnAfterSpecialMove}
      />

      {/* Buy / Skip overlay */}
      {isLiveGame && buyPrompted && justLandedProperty && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/60 p-4 z-[2147483647]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border-2 border-amber-500/50 bg-slate-900 p-6 max-w-sm w-full shadow-2xl"
          >
            <h3 className="text-lg font-bold text-amber-200 mb-2">
              You landed on {justLandedProperty.name}
            </h3>
            <p className="text-slate-300 text-sm mb-4">
              ${justLandedProperty.price?.toLocaleString()} — Buy or skip?
            </p>
            {aiTipsOn && (
              <div className="mb-4 p-3 rounded-lg bg-cyan-900/30 border border-cyan-500/30 text-left">
                <p className="text-xs text-cyan-300/90 mb-1">AI tip</p>
                {aiTipLoading ? (
                  <p className="text-sm text-slate-400">Thinking…</p>
                ) : aiTipText ? (
                  <p className="text-sm text-slate-200">{aiTipText}</p>
                ) : null}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => buyGuard.submit(handleBuy)}
                disabled={(me?.balance ?? 0) < (justLandedProperty.price ?? 0) || buyGuard.isSubmitting}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold"
              >
                {buyGuard.isSubmitting ? "…" : "Buy"}
              </button>
              <button
                onClick={handleSkip}
                disabled={buyGuard.isSubmitting}
                className="flex-1 py-3 rounded-xl bg-slate-600 hover:bg-slate-500 text-white font-bold"
              >
                Skip
              </button>
            </div>
            <label className="flex items-center gap-2 mt-3 text-sm text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={aiTipsOn}
                onChange={toggleAiTips}
                className="rounded border-slate-500"
              />
              AI tips
            </label>
          </motion.div>
        </div>
      )}

      {/* Jail: before roll */}
      {isLiveGame &&
        isMyTurn &&
        meInJail &&
        !jailChoiceRequired &&
        !rollingDice &&
        !lastRollResultLive && (
          <div
            className="fixed inset-0 flex items-center justify-center bg-black/60 p-4 z-[2147483647]"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border-2 border-slate-500/50 bg-slate-900 p-6 max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-lg font-bold text-slate-200 mb-2">You&apos;re in jail</h3>
              <p className="text-slate-400 text-sm mb-4">
                Pay $50, use a Get Out of Jail Free card, or roll for doubles.
              </p>
              <div className="flex flex-col gap-2">
                {canPayToLeaveJail && (
                  <button
                    onClick={() => jailGuard.submit(handlePayToLeaveJail)}
                    disabled={jailGuard.isSubmitting}
                    className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold"
                  >
                    {jailGuard.isSubmitting ? "…" : "Pay $50"}
                  </button>
                )}
                {hasChanceJailCard && (
                  <button
                    onClick={() =>
                      jailGuard.submit(() => handleUseGetOutOfJailFree("chance"))
                    }
                    disabled={jailGuard.isSubmitting}
                    className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                  >
                    Use Chance Get Out of Jail Free
                  </button>
                )}
                {hasCommunityChestJailCard && (
                  <button
                    onClick={() =>
                      jailGuard.submit(() => handleUseGetOutOfJailFree("community_chest"))
                    }
                    disabled={jailGuard.isSubmitting}
                    className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                  >
                    Use Community Chest Get Out of Jail Free
                  </button>
                )}
                <button
                  onClick={handleRollForLive}
                  className="w-full py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-semibold"
                >
                  Roll for doubles
                </button>
              </div>
            </motion.div>
          </div>
        )}

      {/* Jail: after roll (no doubles) */}
      {isLiveGame && isMyTurn && jailChoiceRequired && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/60 p-4 z-[2147483647]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border-2 border-slate-500/50 bg-slate-900 p-6 max-w-sm w-full shadow-2xl"
          >
            <h3 className="text-lg font-bold text-slate-200 mb-2">No doubles — stay in jail or pay</h3>
            <div className="flex flex-col gap-2">
              {canPayToLeaveJail && (
                <button
                  onClick={() => jailGuard.submit(handlePayToLeaveJail)}
                  disabled={jailGuard.isSubmitting}
                  className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold"
                >
                  {jailGuard.isSubmitting ? "…" : "Pay $50"}
                </button>
              )}
              {hasChanceJailCard && (
                <button
                  onClick={() =>
                    jailGuard.submit(() => handleUseGetOutOfJailFree("chance"))
                  }
                  disabled={jailGuard.isSubmitting}
                  className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                >
                  Use Chance Get Out of Jail Free
                </button>
              )}
              {hasCommunityChestJailCard && (
                <button
                  onClick={() =>
                    jailGuard.submit(() => handleUseGetOutOfJailFree("community_chest"))
                  }
                  disabled={jailGuard.isSubmitting}
                  className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                >
                  Use Community Chest Get Out of Jail Free
                </button>
              )}
              <button
                onClick={() => jailGuard.submit(handleStayInJail)}
                disabled={jailGuard.isSubmitting}
                className="w-full py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-semibold"
              >
                {jailGuard.isSubmitting ? "…" : "Stay in jail"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <CardModal
        isOpen={showCardModal}
        onClose={() => setShowCardModal(false)}
        card={cardData}
        playerName={cardPlayerName}
      />

      {selectedProperty && (
        <PropertyDetailModal3D
          property={selectedProperty}
          gameProperty={selectedGameProperty}
          players={players}
          me={me}
          isMyTurn={isMyTurn}
          getCurrentRent={getCurrentRent}
          onClose={() => {
            setSelectedProperty(null);
            setSelectedGameProperty(undefined);
            fetchUpdatedGame();
          }}
          onBuild={handleBuild}
          onSellBuilding={handleSellBuilding}
          onMortgageToggle={handleMortgageToggle}
          onSellToBank={handleSellToBank}
        />
      )}

      <AnimatePresence>
        {winner && gameTimeUp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 z-[2147483647]"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/90 via-violet-950/60 to-cyan-950/70" />
            {winner.user_id === me?.user_id ? (
              <motion.div
                initial={{ scale: 0.88, y: 24, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                className="relative w-full max-w-md rounded-[2rem] overflow-hidden border-2 border-cyan-400/50 bg-gradient-to-b from-indigo-900/95 to-slate-950/95 shadow-2xl text-center p-8"
              >
                <Crown className="w-20 h-20 mx-auto text-cyan-300 mb-4" />
                <h1 className="text-4xl font-black text-white mb-2">YOU WIN</h1>
                <p className="text-slate-200 mb-6">
                  You had the highest net worth when time ran out.
                </p>
                {!isGuest && contractGame?.id && contractGame.id !== BigInt(0) && contractGame.ai ? (
                  <button
                    type="button"
                    onClick={handleClaimAndGoHome}
                    disabled={claimAndLeaveInProgress || endGamePending}
                    className="w-full py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-70 text-slate-900 font-bold"
                  >
                    {claimAndLeaveInProgress || endGamePending ? "Claiming…" : "Claim & go home"}
                  </button>
                ) : (
                  <Link
                    href="/"
                    className="inline-block w-full py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold"
                  >
                    Go home
                  </Link>
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ scale: 0.88, y: 24, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                className="relative w-full max-w-md rounded-[2rem] overflow-hidden border-2 border-slate-500/50 bg-gradient-to-b from-slate-900/95 to-black/95 shadow-2xl text-center p-8"
              >
                <Trophy className="w-16 h-16 mx-auto text-amber-400 mb-4" />
                <h1 className="text-2xl font-bold text-slate-200 mb-2">Time&apos;s up</h1>
                <p className="text-xl text-white mb-4">
                  {winner.username} <span className="text-amber-400">wins</span>
                </p>
                <HeartHandshake className="w-12 h-12 mx-auto text-cyan-400 mb-4" />
                <p className="text-slate-300 mb-6">You still get a consolation prize.</p>
                {!isGuest && contractGame?.id && contractGame.id !== BigInt(0) && contractGame.ai ? (
                  <button
                    type="button"
                    onClick={handleClaimAndGoHome}
                    disabled={claimAndLeaveInProgress || endGamePending}
                    className="w-full py-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-70 text-white font-bold"
                  >
                    {claimAndLeaveInProgress || endGamePending ? "Claiming…" : "Claim & go home"}
                  </button>
                ) : (
                  <Link
                    href="/"
                    className="inline-block w-full py-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
                  >
                    Go home
                  </Link>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <BankruptcyModal
        isOpen={showBankruptcyModal}
        onReturnHome={() => (window.location.href = "/")}
        tokensAwarded={0.5}
      />

      {isLiveGame && isMyTurn && (me?.balance ?? 0) <= 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={handleDeclareBankruptcy}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold"
          >
            Declare bankruptcy
          </button>
        </div>
      )}

      <Toaster position="top-center" />
    </div>
  );
}
