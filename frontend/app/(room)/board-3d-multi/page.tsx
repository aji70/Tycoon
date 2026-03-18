"use client";

import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { apiClient } from "@/lib/api";
import { normalizeAiTip, AI_TIP_FALLBACK } from "@/lib/simplifyAiTip";
import { reportAiAction } from "@/lib/agentFeedback";
import { socketService } from "@/lib/socket";
import { ApiResponse } from "@/types/api";
import type { Property, Player, History, Game, GameProperty } from "@/types/game";
import { PROPERTY_ACTION } from "@/types/game";
import { getSquareName, getSquareNameFromProperties } from "@/components/game/board3d/squareNames";
import { getCornersPassed } from "@/components/game/board3d/positions";
import { getPlayerSymbol } from "@/lib/types/symbol";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { getDiceValues, JAIL_POSITION, MONOPOLY_STATS } from "@/components/game/constants";
import { getContractErrorMessage } from "@/lib/utils/contractErrors";
import { useRewardBurnCollectible, useGetGameByCode } from "@/context/ContractProvider";
import { usePreventDoubleSubmit } from "@/hooks/usePreventDoubleSubmit";
import { useGameTrades } from "@/hooks/useGameTrades";
import TradeAlertPill from "@/components/game/TradeAlertPill";
import CollectibleInventoryBar from "@/components/collectibles/collectibles-invetory";
import { Toaster, toast } from "react-hot-toast";
import { CardModal } from "@/components/game/modals/cards";
import { BankruptcyModal } from "@/components/game/modals/bankruptcy";
import RaiseFundsPanel from "@/components/game/modals/RaiseFundsPanel";
import { useAgentAutoLiquidate } from "@/hooks/useAgentAutoLiquidate";
import PropertyDetailModal3D from "@/components/game/board3d/PropertyDetailModal3D";
import { useMobilePropertyActions } from "@/hooks/useMobilePropertyActions";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Trophy, Sparkles, HeartHandshake, Loader2, X, HelpCircle } from "lucide-react";
import { GameDurationCountdown } from "@/components/game/GameDurationCountdown";
import PlayerSection3D from "@/components/game/board3d/PlayerSection3D";
import PerksBar from "@/components/game/board3d/PerksBar";
import GameyChatRoom from "@/components/game/board3d/GameyChatRoom";
import { MyAgentToggle } from "@/components/game/MyAgentToggle";
import { useAgentBindings } from "@/hooks/useAgentBindings";
import { getStoredAgentApiKey, setStoredAgentApiKey } from "@/lib/agentApiKeySession";

const MOVE_ANIMATION_MS_PER_SQUARE = 250;

const PERK_CASH_TIERS = [0, 100, 250, 500, 700, 1000];
const PERK_REFUND_TIERS = [0, 60, 150, 300, 420, 600];
const PERK_DISCOUNT_TIERS = [0, 100, 200, 300, 400, 500];

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

const Canvas = dynamic(
  () => import("@react-three/fiber").then((m) => m.Canvas),
  { ssr: false }
);
const BoardScene = dynamic(
  () => import("@/components/game/board3d/BoardScene").then((m) => m.default),
  { ssr: false }
);

// Same as 2D boards: fetch properties from backend for names and grid layout
function useBoardProperties() {
  const { data: apiProperties = [], isLoading, isError } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse>("/properties");
      return res.data?.success ? res.data.data : [];
    },
    staleTime: Infinity,
  });

  if (apiProperties.length >= 40) {
    return { properties: [...apiProperties].sort((a, b) => a.id - b.id), isLoading: false, fromApi: true };
  }
  return { properties: buildMockProperties(), isLoading, fromApi: false };
}

// Fallback when API fails or returns no data (same structure as backend: id, name, type, grid_row, grid_col)
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

// Game tokens from lib/types/symbol: hat, car, dog, thimble, iron, battleship, boot, wheelbarrow
const SYMBOLS = ["hat", "car", "dog", "thimble", "iron", "battleship", "boot", "wheelbarrow"];

// 8 dummy players spread around the board; user_id 1 = "Me" (current player)
function buildMockPlayers(): Player[] {
  const positions = [0, 5, 10, 15, 20, 25, 30, 35];
  return Array.from({ length: 8 }, (_, i) => ({
    user_id: i + 1,
    address: `0x${i + 1}`,
    balance: 1500,
    position: positions[i],
    symbol: SYMBOLS[i],
    username: i === 0 ? "Me" : `Player ${i + 1}`,
    rolls: 0,
    turn_order: i,
    joined_date: "",
    chance_jail_card: 0,
    community_chest_jail_card: 0,
    circle: 0,
    in_jail: false,
    in_jail_rolls: 0,
  })) as Player[];
}

const mockPlayers = buildMockPlayers();

// Demo: show developable property with 0, 1, 2, 3, 4 houses and hotel (first 6 color-group properties)
const demoDevelopmentByPropertyId: Record<number, number> = {
  1: 0,  // 0 houses
  3: 1,  // 1 house
  6: 2,  // 2 houses
  8: 3,  // 3 houses
  9: 4,  // 4 houses
  11: 5, // hotel
};

/** Initial positions: 8 players spread around the board */
const initialPositions: Record<number, number> = Object.fromEntries(
  mockPlayers.map((p, i) => [p.user_id, [0, 5, 10, 15, 20, 25, 30, 35][i]])
);

/**
 * 3D board demo. With ?gameCode=XXX loads that game from backend (players, positions, development).
 * Without gameCode uses mock data. Route: /board-3d or /board-3d?gameCode=ABC123
 */
const SOCKET_URL =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_SOCKET_URL ||
      (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "")
    : "";

function Board3DPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const gameCode = searchParams.get("gameCode")?.trim().toUpperCase() || null;
  const queryClient = useQueryClient();

  const { address } = useAccount();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;

  const { properties, isLoading, fromApi } = useBoardProperties();
  const { data: game, isLoading: gameLoading, isError: gameError, error: gameQueryError, refetch: refetchGame } = useQuery<Game>({
    queryKey: ["game", gameCode ?? ""],
    queryFn: async () => {
      if (!gameCode) throw new Error("No code");
      const res = await apiClient.get<ApiResponse>(`/games/code/${gameCode}`);
      if (!res.data?.success) throw new Error((res.data as { error?: string })?.error ?? (res.data as { message?: string })?.message ?? "Game not found");
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
  const isMultiplayer = !!game && game.is_ai === false;

  useEffect(() => {
    if (!gameCode || !SOCKET_URL || !game || game.is_ai !== false) return;
    socketService.connect(SOCKET_URL);
    socketService.joinGameRoom(gameCode);
    const onGameUpdate = (data: { gameCode?: string }) => {
      if (data?.gameCode === gameCode) {
        refetchGame();
        queryClient.invalidateQueries({ queryKey: ["game_properties", game.id] });
        refetchGameProperties();
      }
    };
    const onGameStarted = () => {
      refetchGame();
      queryClient.invalidateQueries({ queryKey: ["game_properties", game?.id] });
      refetchGameProperties();
    };
    socketService.onGameUpdate(onGameUpdate);
    socketService.onGameStarted(onGameStarted);
    return () => {
      socketService.removeListener("game-update", onGameUpdate);
      socketService.removeListener("game-started", onGameStarted);
      socketService.leaveGameRoom(gameCode);
    };
  }, [gameCode, game?.id, game?.is_ai, queryClient, refetchGame, refetchGameProperties]);

  const me = useMemo<Player | null>(() => {
    const addrs = [
      guestUser?.address,
      guestUser?.linked_wallet_address,
      guestUser?.smart_wallet_address,
      address,
    ].filter((a): a is string => !!a && String(a).trim().length > 0);
    const lower = addrs.map((a) => a.toLowerCase());
    if (!game?.players || lower.length === 0) return null;
    return game.players.find((p: Player) => p.address && lower.includes(p.address.toLowerCase())) ?? null;
  }, [game?.players, address, guestUser?.address, guestUser?.linked_wallet_address, guestUser?.smart_wallet_address]);

  const [buyPrompted, setBuyPrompted] = useState(false);
  const [jailChoiceRequired, setJailChoiceRequired] = useState(false);
  const [turnEndScheduled, setTurnEndScheduled] = useState(false);
  const [gameTimeUpLocal, setGameTimeUpLocal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardData, setCardData] = useState<{ type: "chance" | "community"; text: string; effect?: string; isGood: boolean } | null>(null);
  const [cardPlayerName, setCardPlayerName] = useState("");
  const [cardIsCurrentPlayerDrawer, setCardIsCurrentPlayerDrawer] = useState(false);
  const [showBankruptcyModal, setShowBankruptcyModal] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [landedPositionForBuy, setLandedPositionForBuy] = useState<number | null>(null);
  const [spinOrbitDegrees, setSpinOrbitDegrees] = useState(0);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedGameProperty, setSelectedGameProperty] = useState<GameProperty | undefined>(undefined);
  const [endByNetWorthStatus, setEndByNetWorthStatus] = useState<{
    vote_count: number;
    required_votes: number;
    voters: Array<{ user_id: number; username: string }>;
  } | null>(null);
  const [endByNetWorthLoading, setEndByNetWorthLoading] = useState(false);
  const [showEndByNetWorthConfirm, setShowEndByNetWorthConfirm] = useState(false);
  const [endGameCandidate, setEndGameCandidate] = useState<{
    winner: Player | null;
    position: number;
    balance: bigint;
    validWin: boolean;
  }>({ winner: null, position: 0, balance: BigInt(0), validWin: true });
  const [claimAndLeaveInProgress, setClaimAndLeaveInProgress] = useState(false);
  const [hasLeftGame, setHasLeftGame] = useState(false);
  const timeUpHandledRef = useRef(false);
  const [viewTradesRequested, setViewTradesRequested] = useState(false);
  const [showPerksModal, setShowPerksModal] = useState(false);
  const [pendingBarPerk, setPendingBarPerk] = useState<{
    tokenId: bigint;
    perk: number;
    strength: number;
    name: string;
  } | null>(null);
  const { burn: burnCollectible, isSuccess: burnSuccess } = useRewardBurnCollectible();
  const BUY_TIPS_STORAGE_KEY = "tycoon_buy_tips_3d_multi";
  const [buyTipsOn, setBuyTipsOn] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem(BUY_TIPS_STORAGE_KEY) !== "false";
    } catch {
      return true;
    }
  });
  const [buyTipText, setBuyTipText] = useState<string | null>(null);
  const [buyTipLoading, setBuyTipLoading] = useState(false);
  const lastTipPropertyIdRef = useRef<number | null>(null);
  const [auctionBidAmount, setAuctionBidAmount] = useState("");
  const [auctionSubmitting, setAuctionSubmitting] = useState(false);
  const [voteStatuses, setVoteStatuses] = useState<Record<number, { vote_count: number; required_votes: number; voters: Array<{ user_id: number; username: string }> }>>({});
  const [votingLoading, setVotingLoading] = useState<Record<number, boolean>>({});
  const [showVotedOutModal, setShowVotedOutModal] = useState(false);
  const { myAgentOn, refetch: refetchAgentBindings } = useAgentBindings(game?.id);
  const [myAgentApiKey, setMyAgentApiKeyState] = useState<{ provider: string; apiKey: string } | null>(() => getStoredAgentApiKey());
  const setMyAgentApiKey = useCallback((value: { provider: string; apiKey: string } | null) => {
    setMyAgentApiKeyState(value);
    setStoredAgentApiKey(value);
  }, []);
  const agentOn = myAgentOn || !!myAgentApiKey;

  const currentPlayerId = game?.next_player_id ?? null;
  const isUntimed = !game?.duration || Number(game.duration) === 0;
  const isMyTurn = !!(me && currentPlayerId !== null && me.user_id === currentPlayerId);
  const isGuest = !!guestUser;
  const gameTimeUp = game?.status === "FINISHED" || gameTimeUpLocal;
  const meInJail = !!(me && Number(me.position) === JAIL_POSITION && me.in_jail);
  const canPayToLeaveJail = meInJail && (me?.balance ?? 0) >= 50;
  const hasChanceJailCard = (me?.chance_jail_card ?? 0) >= 1;
  const hasCommunityChestJailCard = (me?.community_chest_jail_card ?? 0) >= 1;
  const playerCanRoll = isLiveGame && isMyTurn && (me?.balance ?? 0) > 0 && !gameTimeUp && !turnEndScheduled && !buyPrompted && !(meInJail && jailChoiceRequired);

  const livePlayers = useMemo(() => game?.players ?? [], [game?.players]);
  const liveAnimatedPositions = useMemo(() => {
    const out: Record<number, number> = {};
    livePlayers.forEach((p) => {
      out[p.user_id] = p.position ?? 0;
    });
    return out;
  }, [livePlayers]);

  const [liveMovementOverride, setLiveMovementOverride] = useState<Record<number, number>>({});
  const rollingForPlayerIdRef = useRef<number | null>(null);
  const rolledForPlayerIdRef = useRef<number | null>(null);

  const currentPlayer = useMemo(() => {
    if (!game?.players || currentPlayerId == null) return null;
    return game.players.find((p: Player) => p.user_id === currentPlayerId) ?? null;
  }, [game?.players, currentPlayerId]);

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
        const owner = livePlayers.find(
          (p) => p.address?.toLowerCase() === gp.address?.toLowerCase()
        );
        if (owner?.username) out[gp.property_id] = owner.username;
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

  const [animatedPositions, setAnimatedPositions] = useState<Record<number, number>>(initialPositions);
  const [lastRollResult, setLastRollResult] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [lastRollResultLive, setLastRollResultLive] = useState<{ die1: number; die2: number; total: number } | null>(null);
  /** When set, all players see this roll (set by roller locally or by opponent via socket "player-rolled"). */
  const [lastVisibleRoll, setLastVisibleRoll] = useState<{ user_id: number; username: string; die1: number; die2: number; total: number } | null>(null);
  const [rollingDice, setRollingDice] = useState<{ die1: number; die2: number } | null>(null);
  const [demoHistory, setDemoHistory] = useState<History[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resetViewTrigger, setResetViewTrigger] = useState(0);
  const [canvasKey, setCanvasKey] = useState(0);
  const [canvasReady, setCanvasReady] = useState(false);
  const [canvasMounted, setCanvasMounted] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const pendingShowCardModalRef = useRef(false);
  const pendingBuyPromptRef = useRef(false);
  const pendingRollRef = useRef<{ die1: number; die2: number; total: number }>({ die1: 0, die2: 0, total: 0 });

  // When navigating back: remount Canvas only after container is in DOM (avoids R3F connect() .style on undefined).
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setCanvasMounted(false);
        setCanvasReady(false);
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setCanvasMounted(false);
        setCanvasReady(false);
      }
    };
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
  useEffect(() => {
    if (!canvasReady) {
      const t = window.setTimeout(() => {
        setCanvasKey((k) => k + 1);
        setCanvasReady(true);
      }, 100);
      return () => window.clearTimeout(t);
    }
  }, [canvasReady]);
  const showCanvasArea = canvasReady && !(isLoading || (gameCode && gameLoading));
  useLayoutEffect(() => {
    if (!showCanvasArea) {
      setCanvasMounted(false);
      return;
    }
    const container = canvasContainerRef.current;
    if (!container) return;
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setCanvasMounted(true);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [showCanvasArea]);
  const doublesCountRef = useRef(0);
  const runningTotalRef = useRef(0);
  const expectingDoublesRollAgainRef = useRef(false);
  const moveStartPositionsRef = useRef<Record<number, number>>({});
  const historyIdRef = useRef(0);
  const lastTopHistoryIdRef = useRef<number | null>(null);
  const turnEndInProgressRef = useRef(false);
  const timeLeftFrozenAtRollRef = useRef<number | null>(null);
  const recordTimeoutCalledForTurnRef = useRef<number | null>(null);

  const [turnTimeLeft, setTurnTimeLeft] = useState<number | null>(null);
  const landedPositionThisTurnRef = useRef<number | null>(null);
  const hasScheduledTurnEndRef = useRef(false);

  const { data: contractGame } = useGetGameByCode(game?.code ?? "");
  const { tradeRequests: incomingTrades } = useGameTrades({
    gameId: game?.id,
    myUserId: me?.user_id,
    players: livePlayers,
  });
  const buyGuard = usePreventDoubleSubmit();
  const jailGuard = usePreventDoubleSubmit();

  const handleUsePerkFromBar = useCallback(
    (tokenId: bigint, perk: number, _strength: number, name: string) => {
      if (perk === 6 || perk === 10) {
        setShowPerksModal(true);
        return;
      }
      setPendingBarPerk({ tokenId, perk, strength: _strength, name });
    },
    []
  );

  const handleRoll = useCallback(() => {
    if (rollingDice) return;
    const value = getDiceValues() ?? { die1: 6, die2: 6, total: 12 };
    pendingRollRef.current = value;
    setRollingDice({ die1: value.die1, die2: value.die2 });
  }, [rollingDice]);

  const handleRollForLive = useCallback(() => {
    if (rollingDice || !game || !me) return;
    const value = getDiceValues();
    pendingRollRef.current = value;
    rollingForPlayerIdRef.current = me.user_id;
    setRollingDice({ die1: value.die1, die2: value.die2 });
  }, [rollingDice, game, me]);

  useEffect(() => {
    if (!isMyTurn) {
      doublesCountRef.current = 0;
      runningTotalRef.current = 0;
    }
  }, [isMyTurn]);

  useEffect(() => {
    if (!burnSuccess || !pendingBarPerk || !game?.id || !me) return;

    const { perk, strength, name } = pendingBarPerk;
    const toastId = toast.loading("Applying perk...");

    (async () => {
      try {
        let success = false;
        switch (perk) {
          case 1:
            if (playerCanRoll) {
              toast.success("Extra Turn! Roll again.", { id: toastId });
              handleRollForLive();
              success = true;
            }
            break;
          case 2: {
            const res = await apiClient.post<ApiResponse>("/perks/use-jail-free", {
              game_id: game.id,
              from_collectible: true,
            });
            success = res?.data?.success ?? false;
            if (success) toast.success("Escaped jail!", { id: toastId });
            break;
          }
          case 3:
          case 4:
          case 7: {
            const res = await apiClient.post<ApiResponse>("/perks/activate", {
              game_id: game.id,
              perk_id: perk,
            });
            success = res?.data?.success ?? false;
            if (success) toast.success(`${name} activated for next use!`, { id: toastId });
            break;
          }
          case 5: {
            const amount = PERK_CASH_TIERS[Math.min(strength, PERK_CASH_TIERS.length - 1)];
            const res = await apiClient.post<ApiResponse & { reward?: number }>("/perks/burn-cash", {
              game_id: game.id,
              from_collectible: true,
              amount,
            });
            success = res?.data?.success ?? false;
            const reward = res?.data?.reward ?? amount;
            if (success) toast.success(`+$${reward} Instant Cash!`, { id: toastId });
            break;
          }
          case 8: {
            const discount = PERK_DISCOUNT_TIERS[Math.min(strength, PERK_DISCOUNT_TIERS.length - 1)];
            if (discount > 0) {
              const res = await apiClient.post<ApiResponse>("/perks/apply-cash", {
                game_id: game.id,
                perk_id: 8,
                amount: discount,
                from_collectible: true,
              });
              success = res?.data?.success ?? false;
              if (success) toast.success(`+$${discount} Property Discount!`, { id: toastId });
            }
            break;
          }
          case 9: {
            const refund = PERK_REFUND_TIERS[Math.min(strength, PERK_REFUND_TIERS.length - 1)];
            if (refund > 0) {
              const res = await apiClient.post<ApiResponse>("/perks/apply-cash", {
                game_id: game.id,
                perk_id: 9,
                amount: refund,
                from_collectible: true,
              });
              success = res?.data?.success ?? false;
              if (success) toast.success(`+$${refund} Tax Refund!`, { id: toastId });
            }
            break;
          }
          default:
            break;
        }
        if (success || perk === 1) {
          toast.success("Perk used & collectible burned!", { id: toastId });
        } else if (perk !== 6 && perk !== 10) {
          toast.error("Effect failed", { id: toastId });
        }
        await refetchGame();
      } catch {
        toast.error("Activation failed", { id: toastId });
      } finally {
        setPendingBarPerk(null);
      }
    })();
  }, [
    burnSuccess,
    pendingBarPerk,
    game?.id,
    me,
    playerCanRoll,
    handleRollForLive,
    refetchGame,
  ]);

  const players = isLiveGame ? livePlayers : mockPlayers;
  const positions = useMemo(() => {
    if (!isLiveGame) return animatedPositions;
    const merged: Record<number, number> = {};
    livePlayers.forEach((p) => {
      merged[p.user_id] = liveMovementOverride[p.user_id] ?? liveAnimatedPositions[p.user_id] ?? p.position ?? 0;
    });
    return merged;
  }, [isLiveGame, animatedPositions, liveAnimatedPositions, liveMovementOverride, livePlayers]);
  const developmentByPropertyId = isLiveGame ? liveDevelopmentByPropertyId : demoDevelopmentByPropertyId;
  const showRollUi = !isLiveGame || (playerCanRoll && !(meInJail && !jailChoiceRequired));

  const showToast = useCallback((message: string, type?: "success" | "error" | "default") => {
    if (type === "success") toast.success(message);
    else if (type === "error") toast.error(message);
    else toast(message);
  }, []);

  const getCurrentRent = useCallback(
    (prop: Property, gp: GameProperty | undefined): number => {
      if (!gp || !gp.address) return prop.rent_site_only ?? 0;
      if (gp.mortgaged) return 0;
      if (gp.development === 5) return prop.rent_hotel ?? 0;
      switch (gp.development ?? 0) {
        case 1: return prop.rent_one_house ?? 0;
        case 2: return prop.rent_two_houses ?? 0;
        case 3: return prop.rent_three_houses ?? 0;
        case 4: return prop.rent_four_houses ?? 0;
        default: return prop.rent_site_only ?? 0;
      }
    },
    []
  );

  const fetchUpdatedGame = useCallback(async () => {
    await refetchGame();
    await refetchGameProperties();
  }, [refetchGame, refetchGameProperties]);

  const fetchEndByNetWorthStatus = useCallback(async () => {
    if (!game?.id || !isUntimed) return;
    try {
      const res = await apiClient.post<ApiResponse & { data?: { vote_count: number; required_votes: number; voters?: Array<{ user_id: number; username: string }> } }>(
        "/game-players/end-by-networth-status",
        { game_id: game.id }
      );
      if (res?.data?.success && res.data.data) {
        setEndByNetWorthStatus({
          vote_count: res.data.data.vote_count,
          required_votes: res.data.data.required_votes,
          voters: res.data.data.voters ?? [],
        });
      } else {
        setEndByNetWorthStatus(null);
      }
    } catch {
      setEndByNetWorthStatus(null);
    }
  }, [game?.id, isUntimed]);

  const voteEndByNetWorth = useCallback(async () => {
    if (!me?.user_id || !game?.id || !isUntimed) return;
    setEndByNetWorthLoading(true);
    try {
      const res = await apiClient.post<ApiResponse & { data?: { vote_count: number; required_votes: number; voters?: Array<{ user_id: number; username: string }>; all_voted?: boolean } }>(
        "/game-players/vote-end-by-networth",
        { game_id: game.id, user_id: me.user_id }
      );
      if (res?.data?.success && res.data.data) {
        const data = res.data.data;
        setEndByNetWorthStatus({
          vote_count: data.vote_count,
          required_votes: data.required_votes,
          voters: data.voters ?? [],
        });
        if (data.all_voted) {
          toast.success("Game ended by net worth");
          await refetchGame();
        } else {
          toast.success(`${data.vote_count}/${data.required_votes} voted to end by net worth`);
        }
      }
    } catch (err) {
      toast.error(getContractErrorMessage(err, "Failed to vote"));
    } finally {
      setEndByNetWorthLoading(false);
    }
  }, [game?.id, game?.players, me?.user_id, isUntimed, refetchGame]);

  useEffect(() => {
    if (!isUntimed || !game?.id) {
      setEndByNetWorthStatus(null);
      return;
    }
    fetchEndByNetWorthStatus();
  }, [game?.id, isUntimed, fetchEndByNetWorthStatus, game?.history?.length]);

  const voteablePlayersList = useMemo(() => {
    if (!game?.players || !me?.user_id) return [];
    return game.players.filter((p: Player) => {
      if (p.user_id === me.user_id) return false;
      const strikes = (p as Player & { consecutive_timeouts?: number }).consecutive_timeouts ?? 0;
      const otherPlayers = game.players.filter((pl: Player) => pl.user_id !== me?.user_id);
      if (otherPlayers.length === 1) return strikes >= 3;
      return strikes > 0;
    });
  }, [game?.players, me?.user_id]);

  const fetchVoteStatus = useCallback(
    async (targetUserId: number) => {
      if (!game?.id) return;
      try {
        const res = await apiClient.post<ApiResponse>("/game-players/vote-status", {
          game_id: game.id,
          target_user_id: targetUserId,
        });
        const data = res?.data?.data;
        if (res?.data?.success && data) {
          setVoteStatuses((prev) => ({ ...prev, [targetUserId]: data }));
        }
      } catch {
        // ignore
      }
    },
    [game?.id]
  );

  const voteToRemove = useCallback(
    async (targetUserId: number) => {
      if (!me?.user_id || !game?.id) return;
      setVotingLoading((prev) => ({ ...prev, [targetUserId]: true }));
      try {
        const res = await apiClient.post<ApiResponse & { data?: { vote_count: number; required_votes: number; voters?: Array<{ user_id: number; username: string }>; removed?: boolean } }>(
          "/game-players/vote-to-remove",
          { game_id: game.id, user_id: me.user_id, target_user_id: targetUserId }
        );
        if (res?.data?.success && res.data.data) {
          const data = res.data.data;
          setVoteStatuses((prev) => ({
            ...prev,
            [targetUserId]: { vote_count: data.vote_count, required_votes: data.required_votes, voters: data.voters ?? [] },
          }));
          if (data.removed) {
            toast.success(`${(game?.players ?? []).find((p: Player) => p.user_id === targetUserId)?.username ?? "Player"} has been removed`);
            await fetchUpdatedGame();
          } else {
            toast.success(`Vote recorded. ${data.vote_count}/${data.required_votes} votes.`);
            await fetchVoteStatus(targetUserId);
          }
        }
      } catch (err) {
        toast.error(getContractErrorMessage(err, "Failed to vote"));
      } finally {
        setVotingLoading((prev) => ({ ...prev, [targetUserId]: false }));
      }
    },
    [game?.id, me?.user_id, game?.players, fetchUpdatedGame, fetchVoteStatus]
  );

  useEffect(() => {
    if (!game?.id || !me?.user_id || voteablePlayersList.length === 0) return;
    voteablePlayersList.forEach((p) => fetchVoteStatus(p.user_id));
  }, [game?.id, me?.user_id, game?.players?.length, fetchVoteStatus, voteablePlayersList.length]);

  useEffect(() => {
    if (!gameCode || !game || game.is_ai !== false) return;
    const onVoteCast = (data: { target_user_id: number; voter_user_id: number; vote_count: number; required_votes: number; removed: boolean }) => {
      if (data.removed) {
        if (data.target_user_id === me?.user_id) setShowVotedOutModal(true);
        fetchUpdatedGame();
      } else {
        setVoteStatuses((prev) => ({
          ...prev,
          [data.target_user_id]: { vote_count: data.vote_count, required_votes: data.required_votes, voters: [] },
        }));
        fetchVoteStatus(data.target_user_id);
      }
    };
    socketService.onVoteCast(onVoteCast);
    return () => socketService.removeListener("vote-cast", onVoteCast);
  }, [gameCode, game?.id, game?.is_ai, me?.user_id, fetchUpdatedGame, fetchVoteStatus]);

  useEffect(() => {
    if (!gameCode || !SOCKET_URL || !game || game.is_ai !== false) return;
    const onPlayerRolled = (data: { user_id: number; username: string; die1: number; die2: number; total: number }) => {
      setLastVisibleRoll({ user_id: data.user_id, username: data.username || "Player", die1: data.die1, die2: data.die2, total: data.total });
    };
    socketService.onPlayerRolled(onPlayerRolled);
    return () => socketService.removeListener("player-rolled", onPlayerRolled);
  }, [gameCode, SOCKET_URL, game?.id, game?.is_ai]);

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

  const handleDiceComplete = useCallback(() => {
    const { die1, die2, total } = pendingRollRef.current;
    setLastRollResult({ die1, die2, total });
    setRollingDice(null);
    historyIdRef.current += 1;
    setDemoHistory((prev) => [
      ...prev,
      makeHistoryEntry(historyIdRef.current, "Me", `rolled ${die1} + ${die2} = ${total}; all players advanced`, total),
    ]);
    setAnimatedPositions((prev) => {
      moveStartPositionsRef.current = { ...prev };
      return prev;
    });
    for (let step = 1; step <= total; step++) {
      setTimeout(() => {
        setAnimatedPositions(() => {
          const start = moveStartPositionsRef.current;
          const next: Record<number, number> = {};
          mockPlayers.forEach((p) => {
            const from = start[p.user_id] ?? p.position;
            next[p.user_id] = (from + step) % 40;
          });
          return next;
        });
      }, step * MOVE_ANIMATION_MS_PER_SQUARE);
    }
  }, []);

  const END_TURN = useCallback(async (timedOut?: boolean) => {
    if (currentPlayerId == null || !game?.id || turnEndInProgressRef.current) return;
    turnEndInProgressRef.current = true;
    try {
      await apiClient.post("/game-players/end-turn", {
        user_id: currentPlayerId,
        game_id: game.id,
        ...(timedOut === true && { timed_out: true }),
      });
      setBuyPrompted(false);
      setTurnEndScheduled(false);
      setJailChoiceRequired(false);
      setLandedPositionForBuy(null);
      setLastRollResultLive(null);
      setLastVisibleRoll(null);
      landedPositionThisTurnRef.current = null;
      await refetchGame();
    } catch (err) {
      toast.error(getContractErrorMessage(err, "Failed to end turn"));
      setTurnEndScheduled(false);
    } finally {
      turnEndInProgressRef.current = false;
    }
  }, [currentPlayerId, game?.id, refetchGame]);

  // 90-second roll timer: must roll within 90s; when time hits 0, pass turn on backend for all player counts
  const TURN_ROLL_SECONDS = 90;
  const hasRolled = isMyTurn && lastRollResultLive != null;
  useEffect(() => {
    if (!isLiveGame || !currentPlayer?.turn_start) {
      setTurnTimeLeft(null);
      timeLeftFrozenAtRollRef.current = null;
      return;
    }
    const raw = currentPlayer.turn_start;
    const turnStartSec = typeof raw === "number" ? raw : parseInt(String(raw), 10);
    if (Number.isNaN(turnStartSec)) {
      setTurnTimeLeft(null);
      return;
    }
    timeLeftFrozenAtRollRef.current = null;
    const tick = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const elapsed = nowSec - turnStartSec;
      const liveRemaining = Math.max(0, TURN_ROLL_SECONDS - elapsed);
      if (hasRolled) {
        if (timeLeftFrozenAtRollRef.current === null) {
          timeLeftFrozenAtRollRef.current = liveRemaining;
        }
        setTurnTimeLeft(timeLeftFrozenAtRollRef.current);
      } else {
        setTurnTimeLeft(liveRemaining);
      }
      if (liveRemaining <= 0 && recordTimeoutCalledForTurnRef.current !== turnStartSec) {
        recordTimeoutCalledForTurnRef.current = turnStartSec;
        END_TURN(true);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isLiveGame, currentPlayer?.turn_start, currentPlayer?.user_id, me?.user_id, game?.id, END_TURN, hasRolled]);

  const triggerLandingLogic = useCallback(
    (newPosition: number, isSpecial = false) => {
      if (landedPositionThisTurnRef.current !== null) return;
      landedPositionThisTurnRef.current = newPosition;
      setLandedPositionForBuy(newPosition);
      if (me?.user_id != null) {
        setLiveMovementOverride((prev) => ({ ...prev, [me.user_id]: newPosition }));
      }
      const square = properties.find((p) => p.id === newPosition);
      if (square?.price != null) {
        const isOwned = gameProperties.some((gp) => gp.property_id === newPosition);
        const action = PROPERTY_ACTION(newPosition);
        if (!isOwned && action && ["land", "railway", "utility"].includes(action)) {
          pendingBuyPromptRef.current = true;
          setBuyPrompted(true);
        }
      }
    },
    [properties, gameProperties, me?.user_id]
  );

  const endTurnAfterSpecialMove = useCallback(() => {
    setBuyPrompted(false);
    setLandedPositionForBuy(null);
    landedPositionThisTurnRef.current = null;
    setTimeout(END_TURN, 800);
  }, [END_TURN]);

  // Auto-end turn when movement is done and no buy/jail choice (matches 2D; avoids turn break on Chance/CC)
  useEffect(() => {
    if (!isLiveGame || !isMyTurn || !lastRollResultLive || buyPrompted || jailChoiceRequired || rollingDice) {
      hasScheduledTurnEndRef.current = false;
      return;
    }
    if (expectingDoublesRollAgainRef.current) return;
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

  const toggleBuyTips = useCallback(() => {
    setBuyTipsOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(BUY_TIPS_STORAGE_KEY, String(next));
      } catch {}
      if (!next) setBuyTipText(null);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!buyPrompted) {
      setBuyTipText(null);
      lastTipPropertyIdRef.current = null;
    }
  }, [buyPrompted]);

  useEffect(() => {
    if (!buyTipsOn || !isMyTurn || !buyPrompted || !justLandedProperty || !me || !game?.id) return;
    const propId = justLandedProperty.id;
    if (lastTipPropertyIdRef.current === propId) return;
    lastTipPropertyIdRef.current = propId;
    setBuyTipLoading(true);
    const groupIds = Object.values(MONOPOLY_STATS.colorGroups).find((ids) => ids.includes(justLandedProperty.id)) ?? [];
    const ownedInGroup = groupIds.filter((id) =>
      gameProperties.some(
        (gp) => gp.property_id === id && gp.address?.toLowerCase() === me.address?.toLowerCase()
      )
    ).length;
    const completesMonopoly = groupIds.length > 0 && ownedInGroup === groupIds.length - 1;
    const landingRank = (MONOPOLY_STATS.landingRank as Record<number, number>)[justLandedProperty.id] ?? 99;
    apiClient
      .post<{ success?: boolean; data?: { reasoning?: string }; fallbackReason?: string }>("/agent-registry/decision", {
        gameId: game.id,
        slot: 1,
        decisionType: "tip",
        context: {
          myBalance: me.balance ?? 0,
          myProperties: gameProperties
            .filter((gp) => gp.address?.toLowerCase() === me.address?.toLowerCase())
            .map((gp) => ({ ...properties.find((p) => p.id === gp.property_id), ...gp })),
          opponents: (game?.players ?? []).filter((p) => p.user_id !== me.user_id),
          situation: "buy_property",
          property: {
            ...justLandedProperty,
            completesMonopoly,
            landingRank,
            ownedInGroup,
            groupSize: groupIds.length,
          },
        },
      })
      .then((res) => {
        const fallbackReason = res?.data?.fallbackReason;
        if (fallbackReason) {
          setBuyTipText(fallbackReason);
          return;
        }
        const text = res?.data?.data?.reasoning ?? null;
        setBuyTipText(normalizeAiTip(text) ?? AI_TIP_FALLBACK);
      })
      .catch((e: unknown) => {
        const err = e as { response?: { data?: { message?: string; error?: string } }; message?: string };
        const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? err?.message ?? "Request failed";
        setBuyTipText(`Error: ${msg}`);
      })
      .finally(() => setBuyTipLoading(false));
  }, [
    buyTipsOn,
    isMyTurn,
    buyPrompted,
    justLandedProperty,
    me,
    game?.id,
    game?.players,
    gameProperties,
    properties,
  ]);

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

  const handleDiceCompleteForLive = useCallback(async () => {
    expectingDoublesRollAgainRef.current = false;
    const value = pendingRollRef.current;
    if (!game?.id || !me) {
      setRollingDice(null);
      rollingForPlayerIdRef.current = null;
      return;
    }
    const currentPos = me.position ?? 0;
    const isInJail = !!(me.in_jail && currentPos === JAIL_POSITION);
    const rolledDouble = value.die1 === value.die2;

    // Classic Monopoly: doubles = roll again (accumulate move). Three doubles in a row = go to jail.
    if (!isInJail && rolledDouble) {
      doublesCountRef.current += 1;
      if (doublesCountRef.current >= 3) {
        try {
          await apiClient.post("/game-players/three-doubles-to-jail", {
            game_id: game.id,
            user_id: me.user_id,
          });
          toast.success("Three doubles! Go to jail.");
          await refetchGame();
          END_TURN();
        } catch (err) {
          toast.error(getContractErrorMessage(err as Error, "Failed to process three doubles"));
        } finally {
          doublesCountRef.current = 0;
          runningTotalRef.current = 0;
          setRollingDice(null);
          rollingForPlayerIdRef.current = null;
        }
        return;
      }
      runningTotalRef.current += value.total;
      setLastRollResultLive(null);
      expectingDoublesRollAgainRef.current = true;
      toast.success("Doubles! Roll again.");
      setRollingDice(null);
      rollingForPlayerIdRef.current = null;
      return;
    }

    const totalMove = isInJail ? (rolledDouble ? value.total : 0) : runningTotalRef.current + value.total;
    if (!isInJail) runningTotalRef.current += value.total;
    const newPos = (isInJail && !rolledDouble) ? currentPos : (currentPos + totalMove) % 40;
    const totalSteps = (isInJail && !rolledDouble) ? 0 : totalMove;

    try {
      await runMovementAnimation(me.user_id, currentPos, totalSteps);
      const res = await apiClient.post<{
        data?: {
          still_in_jail?: boolean;
          new_position?: number;
          requires_buy?: boolean;
          property_for_buy?: Property;
          card?: { instruction?: string; display_instruction?: string };
          passed_turn?: boolean;
        };
      }>("/game-players/change-position", {
        user_id: me.user_id,
        game_id: game.id,
        position: newPos,
        rolled: totalMove,
        is_double: isInJail ? rolledDouble : false,
        die1: value.die1,
        die2: value.die2,
      });
      const data = res?.data?.data ?? (res as any)?.data;
      if (data?.passed_turn) {
        toast.success("Turn passed to next player.");
        await refetchGame();
        setRollingDice(null);
        rollingForPlayerIdRef.current = null;
        return;
      }
      if (data?.still_in_jail) {
        setJailChoiceRequired(true);
      }
      setLastRollResultLive(value);
      setLastVisibleRoll({ user_id: me.user_id, username: (me?.username ?? "Player").trim() || "Player", die1: value.die1, die2: value.die2, total: value.total });
      const finalPosition = data?.new_position != null ? data.new_position : newPos;
      landedPositionThisTurnRef.current = finalPosition;
      const [_, gpRes] = await Promise.all([refetchGame(), refetchGameProperties()]);
      const freshGameProperties = (gpRes?.data as GameProperty[] | undefined) ?? gameProperties;
      setLiveMovementOverride((prev) => {
        const next = { ...prev };
        if (finalPosition !== newPos) next[me.user_id] = finalPosition;
        else delete next[me.user_id];
        return next;
      });
      setLandedPositionForBuy(finalPosition);
      const cornersPassed = getCornersPassed(currentPos, finalPosition);
      if (cornersPassed.length > 0) {
        setSpinOrbitDegrees(cornersPassed.length * 90);
        setTimeout(() => setSpinOrbitDegrees(0), 3000);
      }
      // Show Chance/Community Chest card modal from API response (so it works even before history refetch)
      if (data?.card) {
        const cardText = (data.card.display_instruction ?? data.card.instruction ?? "Card drawn").trim() || "Card drawn";
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
        const isChanceSquare = [7, 22, 36].includes(newPos);
        setCardData({
          type: isChanceSquare ? "chance" : "community",
          text: cardText,
          effect,
          isGood,
        });
        setCardPlayerName(String(me?.username ?? "").trim() || "Player");
        setCardIsCurrentPlayerDrawer(true);
        pendingShowCardModalRef.current = true;
      }
      // After a Chance/Community Chest card move, backend may require rent (already applied) or buy prompt
      if (data?.requires_buy && data?.property_for_buy) {
        pendingBuyPromptRef.current = true;
        setBuyPrompted(true);
      } else {
        const square = properties.find((p) => p.id === finalPosition);
        const isOwned = freshGameProperties.some((gp: GameProperty) => gp.property_id === finalPosition);
        const action = PROPERTY_ACTION(finalPosition);
        const isBuyableType = !!action && ["land", "railway", "utility"].includes(action);
        const needBuyPrompt = !!square && square.price != null && !isOwned && isBuyableType;
        if (needBuyPrompt) {
          pendingBuyPromptRef.current = true;
          setBuyPrompted(true);
        }
      }
      // Don't call END_TURN here — let the useEffect below handle auto end (matches 2D; avoids turn break on Chance/CC)
    } catch (err) {
      try {
        setLiveMovementOverride((prev) => {
          const next = { ...prev };
          if (me?.user_id != null) delete next[me.user_id];
          return next;
        });
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "";
        if (msg.includes("You already rolled this round") && me?.user_id != null && game?.id != null) {
          try {
            const endRes = await apiClient.post<{ data?: { success?: boolean; message?: string }; success?: boolean; message?: string }>(
              "/game-players/end-turn",
              { user_id: me.user_id, game_id: game.id }
            );
            const ok = (endRes?.data as { success?: boolean })?.success ?? (endRes as { success?: boolean })?.success;
            const endMsg = (endRes?.data as { message?: string })?.message ?? (endRes as { message?: string })?.message ?? "";
            if (ok || (typeof endMsg === "string" && endMsg.includes("cannot end another player"))) {
              toast.success("Turn passed to next player.");
              await refetchGame();
            } else if (!ok && endMsg) {
              toast.error(endMsg);
              await refetchGame();
            } else {
              await refetchGame();
            }
          } catch (e) {
            toast.error(getContractErrorMessage(e, "Failed to pass turn. Try again or refresh the game if the board looks stuck."));
            await refetchGame();
          }
        } else {
          toast.error(getContractErrorMessage(err, "Roll failed. Try again or refresh if it persists."));
        }
      } catch (toastErr) {
        toast.error(getContractErrorMessage(toastErr as unknown, "Roll failed. Check your connection and try again."));
      }
    } finally {
      doublesCountRef.current = 0;
      runningTotalRef.current = 0;
      setRollingDice(null);
      rollingForPlayerIdRef.current = null;
    }
  }, [game?.id, me, refetchGame, refetchGameProperties, properties, gameProperties, runMovementAnimation, END_TURN]);

  /** When "my agent plays for me" is on: move then agent decision for buy/skip (multi board). */
  const handleDiceCompleteForMyAgent = useCallback(async () => {
    const value = pendingRollRef.current;
    if (!game?.id || !me) {
      setRollingDice(null);
      rollingForPlayerIdRef.current = null;
      return;
    }
    const playerId = me.user_id;
    const currentPos = me.position ?? 0;
    const isInJail = !!(me.in_jail && currentPos === JAIL_POSITION);
    const rolledDouble = value.die1 === value.die2;
    const totalMove = isInJail ? (rolledDouble ? value.total : 0) : value.total;
    const newPos = (isInJail && !rolledDouble) ? currentPos : (currentPos + totalMove) % 40;
    const totalSteps = (isInJail && !rolledDouble) ? 0 : totalMove;

    try {
      await runMovementAnimation(playerId, currentPos, totalSteps);
      const res = await apiClient.post<{
        data?: {
          still_in_jail?: boolean;
          new_position?: number;
          requires_buy?: boolean;
          property_for_buy?: Property;
          passed_turn?: boolean;
        };
      }>("/game-players/change-position", {
        user_id: playerId,
        game_id: game.id,
        position: newPos,
        rolled: totalMove,
        is_double: isInJail ? rolledDouble : false,
        die1: value.die1,
        die2: value.die2,
      });
      const data = res?.data?.data ?? (res as { data?: { passed_turn?: boolean; still_in_jail?: boolean; new_position?: number } })?.data;
      if (data?.passed_turn) {
        await refetchGame();
        setRollingDice(null);
        rollingForPlayerIdRef.current = null;
        setTimeout(() => END_TURN(), 500);
        return;
      }
      if (data?.still_in_jail) {
        try {
          await apiClient.post("/game-players/stay-in-jail", { user_id: playerId, game_id: game.id });
        } catch {
          /* ignore */
        }
        await refetchGame();
        setRollingDice(null);
        rollingForPlayerIdRef.current = null;
        setTimeout(() => END_TURN(), 500);
        return;
      }
      const finalPosition = data?.new_position != null ? data.new_position : newPos;
      setLastRollResultLive(value);
      setLastVisibleRoll({ user_id: me.user_id, username: (me?.username ?? "Player").trim() || "Player", die1: value.die1, die2: value.die2, total: value.total });
      landedPositionThisTurnRef.current = finalPosition;
      setLiveMovementOverride((prev) => {
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
      const [, gpRes] = await Promise.all([refetchGame(), refetchGameProperties()]);
      const freshGameProperties = (gpRes?.data as GameProperty[] | undefined) ?? gameProperties;
      const square = properties.find((p) => p.id === finalPosition);
      const isOwned = freshGameProperties.some((gp: GameProperty) => gp.property_id === finalPosition);
      const action = PROPERTY_ACTION(finalPosition);
      const isBuyableType = !!action && ["land", "railway", "utility"].includes(action);
      const needBuyPrompt = !!square && square.price != null && !isOwned && isBuyableType;

      if (needBuyPrompt && square) {
        const refetchResult = await refetchGame();
        const updatedGame = refetchResult?.data as Game | undefined;
        const updatedMe = updatedGame?.players?.find((p: Player) => p.user_id === playerId) ?? me;
        const balanceAfterMove = updatedMe?.balance ?? me.balance ?? 0;
        const groupIds = Object.values(MONOPOLY_STATS.colorGroups).find((ids: number[]) => ids.includes(square.id)) ?? [];
        const ownedInGroup = groupIds.filter((id: number) =>
          freshGameProperties.some(
            (gp) => gp.property_id === id && gp.address?.toLowerCase() === me.address?.toLowerCase()
          )
        ).length;
        const completesMonopoly = groupIds.length > 0 && ownedInGroup === groupIds.length - 1;
        const landingRank = (MONOPOLY_STATS.landingRank as Record<number, number>)[square.id] ?? 99;
        const decisionContext = {
          myBalance: balanceAfterMove,
          myProperties: freshGameProperties
            .filter((gp) => gp.address?.toLowerCase() === me.address?.toLowerCase())
            .map((gp) => ({ ...properties.find((p) => p.id === gp.property_id), ...gp })),
          opponents: (updatedGame?.players ?? game?.players ?? []).filter((p: Player) => p.user_id !== me.user_id),
          landedProperty: { ...square, completesMonopoly, landingRank },
        };
        const balanceAfterBuy = balanceAfterMove - (square.price ?? 0);
        const builtInShouldBuy = completesMonopoly || (balanceAfterMove >= (square.price ?? 0) && balanceAfterBuy >= 500);
        try {
          let shouldBuy = builtInShouldBuy;
          if (myAgentApiKey) {
            const proxyRes = await apiClient.post<{ success?: boolean; data?: { action?: string }; useBuiltIn?: boolean }>(
              "/agent-registry/decision-with-key",
              {
                gameId: game.id,
                decisionType: "property",
                context: decisionContext,
                provider: myAgentApiKey.provider,
                apiKey: myAgentApiKey.apiKey,
              }
            );
            if (proxyRes?.data?.success && proxyRes.data.data?.action) {
              shouldBuy = proxyRes.data.data.action.toLowerCase() === "buy";
            }
          } else {
            const agentRes = await apiClient.post<{
              success?: boolean;
              data?: { action?: string };
              useBuiltIn?: boolean;
            }>("/agent-registry/decision", {
              gameId: game.id,
              slot: 1,
              decisionType: "property",
              context: decisionContext,
            });
            if (agentRes?.data?.success && agentRes.data.useBuiltIn === false && agentRes.data.data?.action) {
              shouldBuy = agentRes.data.data.action.toLowerCase() === "buy";
            }
          }
          if (shouldBuy) {
            await apiClient.post("/game-properties/buy", {
              user_id: playerId,
              game_id: game.id,
              property_id: square.id,
            });
            reportAiAction(game.id, 1, "buyProperty");
            toast.success(`Your agent bought ${square.name}.`);
          } else {
            toast(`Your agent skipped buying ${square.name}.`);
          }
        } catch (err) {
          if (builtInShouldBuy) {
            try {
              await apiClient.post("/game-properties/buy", {
                user_id: playerId,
                game_id: game.id,
                property_id: square.id,
              });
              reportAiAction(game.id, 1, "buyProperty");
              toast.success(`Your agent bought ${square.name}.`);
            } catch (_) { /* ignore */ }
          }
        }
        await Promise.all([refetchGame(), refetchGameProperties()]);
        setTimeout(() => END_TURN(), 900);
      } else {
        setTimeout(() => END_TURN(), 1000);
      }
    } catch (err) {
      setLiveMovementOverride((prev) => {
        const next = { ...prev };
        if (me?.user_id != null) delete next[me.user_id];
        return next;
      });
      toast.error(getContractErrorMessage(err as Error, "Agent move failed"));
      setTimeout(() => END_TURN(), 500);
    } finally {
      doublesCountRef.current = 0;
      runningTotalRef.current = 0;
      setRollingDice(null);
      rollingForPlayerIdRef.current = null;
    }
  }, [
    game,
    me,
    myAgentApiKey,
    refetchGame,
    refetchGameProperties,
    properties,
    gameProperties,
    runMovementAnimation,
    END_TURN,
  ]);

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
    [gameProperties, properties]
  );

  const onRollClick = useCallback(() => {
    if (isLiveGame && playerCanRoll) handleRollForLive();
    else if (!isLiveGame) handleRoll();
  }, [isLiveGame, playerCanRoll, handleRollForLive, handleRoll]);

  // Pre-roll perks: when "my agent plays for me", use owner's active perks (jail free, instant cash, lucky 7)
  const runMyAgentPreRollPerks = useCallback(async () => {
    if (!game?.id || !me) return;
    const [gameResult] = await Promise.all([refetchGame(), refetchGameProperties()]);
    const freshGame = gameResult?.data as Game | undefined;
    const freshMe = freshGame?.players?.find((p: Player) => p.user_id === me.user_id) ?? me;
    const raw = freshMe?.active_perks;
    const activePerks: { id: number }[] = Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? (() => {
            try {
              const parsed = JSON.parse(raw as string);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          })()
        : [];
    const hasPerk = (id: number) => activePerks.some((p) => p.id === id);
    const pos = freshMe?.position ?? 0;
    const inJail = !!(freshMe?.in_jail && pos === JAIL_POSITION);
    const balance = freshMe?.balance ?? 0;
    if (inJail && hasPerk(2)) {
      try {
        await apiClient.post("/perks/use-jail-free", { game_id: game.id });
        toast.success("Your agent used Jail Free!");
        await Promise.all([refetchGame(), refetchGameProperties()]);
        return;
      } catch (_) {}
    }
    if (balance < 400 && hasPerk(5)) {
      try {
        await apiClient.post("/perks/burn-cash", { game_id: game.id });
        toast.success("Your agent used Instant Cash!");
        await Promise.all([refetchGame(), refetchGameProperties()]);
        return;
      } catch (_) {}
    }
    if (hasPerk(13)) {
      try {
        await apiClient.post("/perks/activate", { game_id: game.id, perk_id: 13 });
        toast.success("Your agent activated Lucky 7!");
        await Promise.all([refetchGame(), refetchGameProperties()]);
        return;
      } catch (_) {}
    }
  }, [game?.id, me?.user_id, refetchGame, refetchGameProperties]);

  // Pre-roll build: when "my agent plays for me" and we have a monopoly, ask agent to build (or use rule-based fallback)
  const runMyAgentPreRollBuild = useCallback(async () => {
    if (!game?.id || !me) return;
    const [gameResult, gpResult] = await Promise.all([refetchGame(), refetchGameProperties()]);
    const freshGame = gameResult?.data as Game | undefined;
    const freshGameProperties = Array.isArray(gpResult?.data) ? (gpResult.data as GameProperty[]) : gameProperties;
    const freshMe = freshGame?.players?.find((p: Player) => p.user_id === me.user_id) ?? me;
    const balance = freshMe?.balance ?? 0;
    if (balance < 300) return;
    const aiOwnedIds = freshGameProperties
      .filter((gp) => gp.address?.toLowerCase() === freshMe?.address?.toLowerCase())
      .map((gp) => gp.property_id);
    const hasMonopoly = Object.values(MONOPOLY_STATS.colorGroups).some((ids: number[]) =>
      ids.every((id) => aiOwnedIds.includes(id))
    );
    if (!hasMonopoly) return;
    const myProperties = freshGameProperties
      .filter((gp) => gp.address?.toLowerCase() === freshMe?.address?.toLowerCase())
      .map((gp) => ({ ...properties.find((p) => p.id === gp.property_id), ...gp }));
    let didBuild = false;
    const buildContext = {
      myBalance: balance,
      myProperties,
      opponents: (freshGame?.players ?? []).filter((p: Player) => p.user_id !== me.user_id),
    };
    try {
      type DecisionRes = { success?: boolean; data?: { action?: string; propertyId?: number; reasoning?: string }; useBuiltIn?: boolean };
      const agentRes = myAgentApiKey
        ? await apiClient.post<DecisionRes>("/agent-registry/decision-with-key", {
            gameId: game.id,
            decisionType: "building",
            context: buildContext,
            provider: myAgentApiKey.provider,
            apiKey: myAgentApiKey.apiKey,
          })
        : await apiClient.post<DecisionRes>("/agent-registry/decision", {
            gameId: game.id,
            slot: 1,
            decisionType: "building",
            context: buildContext,
          });
      if (
        agentRes?.data?.success &&
        agentRes.data.data?.action?.toLowerCase() === "build" &&
        agentRes.data.data.propertyId
      ) {
        const prop = properties.find((p) => p.id === agentRes.data!.data!.propertyId);
        const devLevel = gameProperties.find((gp) => gp.property_id === agentRes.data!.data!.propertyId)?.development ?? 0;
        await apiClient.post("/game-properties/development", {
          game_id: game.id,
          user_id: me.user_id,
          property_id: agentRes.data.data.propertyId,
        });
        if (devLevel >= 4) reportAiAction(game.id, 1, "buildHotel");
        toast.success(prop ? `Your agent built on ${prop.name}.` : "Your agent built a house.");
        didBuild = true;
      } else if (
        agentRes?.data?.success &&
        agentRes.data.data?.action?.toLowerCase() !== "build" &&
        agentRes.data.data?.reasoning
      ) {
        toast.info(`Agent chose not to build: ${agentRes.data.data.reasoning}`);
      } else if (agentRes?.data?.success && agentRes.data.useBuiltIn === true) {
        toast("Using built-in rules for building (no agent or no credits).", { id: "agent-built-in-building" });
      }
    } catch (_) {
      /* try fallback */
    }
    if (!didBuild && balance >= 300) {
      const buildable = myProperties
        .filter((p) => (p.development ?? 0) < 5 && (p as Property & { cost_of_house?: number }).cost_of_house)
        .map((p) => ({ p, cost: (p as Property & { cost_of_house?: number }).cost_of_house ?? 9999 }));
      const byDev = buildable.sort((a, b) => (a.p.development ?? 0) - (b.p.development ?? 0));
      const target = byDev.find((x) => balance >= (x.cost ?? 9999));
      if (target && target.p.property_id != null) {
        try {
          await apiClient.post("/game-properties/development", {
            game_id: game.id,
            user_id: me.user_id,
            property_id: target.p.property_id,
          });
          if ((target.p.development ?? 0) >= 4) reportAiAction(game.id, 1, "buildHotel");
          const propName = properties.find((p) => p.id === target.p.property_id)?.name;
          toast.success(propName ? `Your agent built on ${propName}.` : "Your agent built a house.");
          didBuild = true;
        } catch (_) {
          /* ignore */
        }
      }
    }
    if (didBuild) await Promise.all([refetchGame(), refetchGameProperties()]);
  }, [game?.id, me, gameProperties, properties, refetchGame, refetchGameProperties, myAgentApiKey]);

  // When "my agent" is on and it's my turn: pre-roll perks → build (if monopoly) → auto-roll
  // Use me?.user_id in deps so refetches don't reset the timer; omit playerCanRoll so in-jail still runs (perks can use Jail Free)
  useEffect(() => {
    if (!isLiveGame || !isMyTurn || !agentOn || rollingDice || !me) return;
    // Do not roll while bankrupt — useAgentAutoLiquidate will handle debt resolution first
    if ((me.balance ?? 0) < 0) return;
    let cancelled = false;
    const t = setTimeout(() => {
      runMyAgentPreRollPerks()
        .then(() => runMyAgentPreRollBuild())
        .then(() => {
          if (!cancelled) handleRollForLive();
        })
        .catch(() => {
          if (!cancelled) handleRollForLive();
        });
    }, 1200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isLiveGame, isMyTurn, agentOn, rollingDice, me?.user_id, handleRollForLive, runMyAgentPreRollPerks, runMyAgentPreRollBuild]);

  const onFocusComplete = useCallback(() => {
    if (pendingShowCardModalRef.current) {
      pendingShowCardModalRef.current = false;
      setShowCardModal(true);
    }
    if (pendingBuyPromptRef.current) {
      pendingBuyPromptRef.current = false;
      setBuyPrompted(true);
    }
  }, []);

  const onDiceCompleteClick = useCallback(() => {
    if (!isLiveGame) {
      handleDiceComplete();
      return;
    }
    if (rollingForPlayerIdRef.current !== null && me && rollingForPlayerIdRef.current === me.user_id && agentOn) {
      handleDiceCompleteForMyAgent();
    } else {
      handleDiceCompleteForLive();
    }
  }, [isLiveGame, handleDiceComplete, handleDiceCompleteForLive, handleDiceCompleteForMyAgent, me, agentOn]);

  const handleBuy = useCallback(async () => {
    if (!game?.id || !me || !justLandedProperty) return;
    try {
      await apiClient.post("/game-properties/buy", {
        user_id: me.user_id,
        game_id: game.id,
        property_id: justLandedProperty.id,
      });
      setBuyPrompted(false);
      setLandedPositionForBuy(null);
      landedPositionThisTurnRef.current = null;
      await Promise.all([refetchGame(), refetchGameProperties()]);
      setTimeout(() => END_TURN(), 800);
    } catch (err) {
      toast.error(getContractErrorMessage(err, "Purchase failed"));
    }
  }, [game?.id, me, justLandedProperty, refetchGame, refetchGameProperties, END_TURN]);

  const handleSkip = useCallback(async () => {
    const auctionOn = (game?.settings as unknown as { auction?: boolean })?.auction === true;
    if (auctionOn && game?.id && me?.user_id && justLandedProperty?.id) {
      try {
        const res = await apiClient.post<{ data?: { requires_auction?: boolean; auction?: unknown }; success?: boolean }>(
          "/game-players/decline-buy",
          { game_id: game.id, user_id: me.user_id, property_id: justLandedProperty.id }
        );
        const data = (res as { data?: { requires_auction?: boolean } })?.data;
        setBuyPrompted(false);
        setLandedPositionForBuy(null);
        landedPositionThisTurnRef.current = null;
        if (data?.requires_auction) {
          await refetchGame();
          return;
        }
      } catch (err) {
        toast.error(getContractErrorMessage(err, "Could not start auction"));
      }
    }
    setTurnEndScheduled(true);
    setBuyPrompted(false);
    setLandedPositionForBuy(null);
    landedPositionThisTurnRef.current = null;
    setTimeout(() => END_TURN(), 900);
  }, [END_TURN, game?.id, game?.settings, me?.user_id, justLandedProperty?.id, refetchGame]);

  const activeAuction = (game as { active_auction?: { id: number; property?: { name: string }; current_high: number | null; next_bidder_player_id: number | null; bids: Array<{ user_id: number; amount: number | null }> } })?.active_auction;
  const isMyTurnToBid = !!me && !!activeAuction && activeAuction.next_bidder_player_id === me.id;

  const handleAuctionBid = useCallback(async () => {
    if (!game?.id || !me?.user_id || !activeAuction?.id || auctionSubmitting) return;
    const amount = auctionBidAmount.trim() ? parseInt(auctionBidAmount, 10) : null;
    if (amount != null && (isNaN(amount) || amount <= (activeAuction.current_high ?? 0))) {
      toast.error("Enter a bid higher than current high");
      return;
    }
    setAuctionSubmitting(true);
    try {
      await apiClient.post("/games/auction/bid", {
        game_id: game.id,
        auction_id: activeAuction.id,
        user_id: me.user_id,
        amount: amount ?? undefined,
      });
      setAuctionBidAmount("");
      await refetchGame();
      await refetchGameProperties();
      if (amount != null) toast.success(`Bid $${amount} submitted`);
      else toast.success("Passed");
    } catch (err) {
      toast.error(getContractErrorMessage(err, "Bid failed"));
    } finally {
      setAuctionSubmitting(false);
    }
  }, [game?.id, me?.user_id, activeAuction?.id, activeAuction?.current_high, auctionBidAmount, auctionSubmitting, refetchGame, refetchGameProperties]);

  const handleAuctionPass = useCallback(async () => {
    if (!game?.id || !me?.user_id || !activeAuction?.id || auctionSubmitting) return;
    setAuctionSubmitting(true);
    try {
      await apiClient.post("/games/auction/bid", {
        game_id: game.id,
        auction_id: activeAuction.id,
        user_id: me.user_id,
      });
      setAuctionBidAmount("");
      await refetchGame();
      await refetchGameProperties();
      toast.success("Passed");
    } catch (err) {
      toast.error(getContractErrorMessage(err, "Pass failed"));
    } finally {
      setAuctionSubmitting(false);
    }
  }, [game?.id, me?.user_id, activeAuction?.id, auctionSubmitting, refetchGame, refetchGameProperties]);

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

  const handleUseGetOutOfJailFree = useCallback(async (cardType: "chance" | "community_chest") => {
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
  }, [me, game?.id, refetchGame]);

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

  // Bankruptcy: align with 2D — transfer properties, end turn, then POST leave (backend does on-chain removal for both guest and wallet)
  const handleDeclareBankruptcy = useCallback(async () => {
    if (!game?.id || !me?.address || !game?.code) return;
    toast("Declaring bankruptcy...", { icon: "…" });
    try {
      const myOwnedProperties = gameProperties.filter(
        (gp) => gp.address?.toLowerCase() === me.address?.toLowerCase()
      );
      // Creditor: owner of property we're on (if any), else in 2-player the opponent
      let creditorGamePlayerId: number | null = null;
      const landedGameProp = gameProperties.find((gp) => gp.property_id === me.position && gp.address && gp.address !== "bank");
      if (landedGameProp?.player_id) {
        creditorGamePlayerId = landedGameProp.player_id;
      } else if (livePlayers.length === 2) {
        const opponent = livePlayers.find((p) => p.user_id !== me.user_id);
        creditorGamePlayerId = opponent?.id ?? null;
      }
      if (myOwnedProperties.length > 0) {
        if (creditorGamePlayerId != null) {
          toast.loading("Transferring properties to the player who bankrupted you…", { id: "bankruptcy-transfer" });
          for (const gp of myOwnedProperties) {
            try {
              await apiClient.put(`/game-properties/${gp.id}`, { game_id: game.id, player_id: creditorGamePlayerId });
            } catch (err) {
              console.error("Transfer property failed", err);
            }
          }
        } else {
          toast.loading("Returning properties to the bank…", { id: "bankruptcy-transfer" });
          for (const gp of myOwnedProperties) {
            try {
              await apiClient.delete(`/game-properties/${gp.id}`, { data: { game_id: game.id } });
            } catch (err) {
              console.error("Return property failed", err);
            }
          }
        }
      }
      await END_TURN();
      await apiClient.post("/game-players/leave", {
        address: me.address,
        code: game.code,
        reason: "bankruptcy",
      });
      setHasLeftGame(true);
      await refetchGame();
      toast.error("Game over! You have declared bankruptcy.");
      setShowBankruptcyModal(true);
    } catch (err) {
      toast.error(getContractErrorMessage(err, "Failed to end game"));
    }
  }, [game?.id, game?.code, me, livePlayers, gameProperties, END_TURN, refetchGame]);

  // "My agent" with negative balance: auto-liquidate then declare bankruptcy
  // Placed here (after handleDeclareBankruptcy) to avoid TDZ reference error
  useAgentAutoLiquidate({
    agentOn: isLiveGame && agentOn,
    isMyTurn: isLiveGame && isMyTurn,
    me,
    game: game ?? null,
    gameProperties,
    properties,
    refetchGame: async () => refetchGame(),
    refetchGameProperties: async () => refetchGameProperties(),
    onDeclare: handleDeclareBankruptcy,
  });

  const toggleFullscreen = useCallback(() => {
    const el = fullscreenRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    const history = game?.history ?? [];
    if (history.length === 0) return;
    const first = typeof history[0] === "object" && history[0] !== null ? history[0] as { id?: number; comment?: string; player_name?: string } : null;
    const topId = first?.id ?? 0;
    if (lastTopHistoryIdRef.current === null) {
      lastTopHistoryIdRef.current = topId;
      return;
    }
    if (topId === lastTopHistoryIdRef.current) return;
    lastTopHistoryIdRef.current = topId;
    if (!first?.comment) return;
    const cardRegex = /drew\s+(chance|community\s+chest):\s*(.*)/i;
    const match = first.comment.match(cardRegex);
    if (!match) return;
    const [, typeStr, text] = match;
    const cardText = (text ?? "").replace(/\s*\[Rolled\s+\d+\].*$/i, "").trim() || "Card drawn";
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
    const drawerName = String(first.player_name ?? "").trim() || "Player";
    setCardPlayerName(drawerName);
    setCardIsCurrentPlayerDrawer(me?.username?.trim() === drawerName);
    setShowCardModal(true);
  }, [game?.history, me?.username]);

  useEffect(() => {
    if (!game || game.status !== "FINISHED" || game.winner_id == null) return;
    const winnerPlayer = livePlayers.find((p) => p.user_id === game.winner_id) ?? (me?.user_id === game.winner_id ? me : null);
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
          setEndGameCandidate({ winner: null, position: myPosition, balance: myBalance, validWin: true });
        }
      }
      await refetchGame();
    } catch (e) {
      console.error("Finish by time failed:", e);
      timeUpHandledRef.current = false;
      setGameTimeUpLocal(false);
    }
  }, [game?.id, game?.status, game?.players, me, refetchGame]);

  // Multiplayer game end: backend already settled on-chain when the game ended (finish-by-time or vote). We only sync DB and leave — no wallet signing (same as 2D board).
  const handleFinalizeAndLeave = useCallback(async () => {
    if (!game?.id || claimAndLeaveInProgress) return;
    setClaimAndLeaveInProgress(true);
    const toastId = toast.loading(
      winner?.user_id === me?.user_id ? "Finalizing..." : "Finalizing game..."
    );
    try {
      await apiClient.put(`/games/${game.id}`, {
        status: "FINISHED",
        winner_id: game.winner_id ?? winner?.user_id ?? me?.user_id ?? null,
      });
      toast.success(
        winner?.user_id === me?.user_id
          ? "You won! Prize already distributed."
          : "Game completed — thanks for playing!",
        { id: toastId, duration: 5000 }
      );
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch (err: unknown) {
      toast.error(
        getContractErrorMessage(err, "Something went wrong. Try again or refresh the page."),
        { id: toastId, duration: 8000 }
      );
      setClaimAndLeaveInProgress(false);
    }
  }, [game?.id, game?.winner_id, winner?.user_id, me?.user_id, claimAndLeaveInProgress]);

  const historyToShow = isLiveGame && game?.history?.length ? game.history : demoHistory;
  // Live game: show last visible roll for all players (roller sets it locally; opponents get it via socket "player-rolled")
  const lastRollResultToShow = isLiveGame
    ? (lastVisibleRoll ? { die1: lastVisibleRoll.die1, die2: lastVisibleRoll.die2, total: lastVisibleRoll.total } : null)
    : lastRollResult;
  const rollLabel = isLiveGame && lastVisibleRoll
    ? (lastVisibleRoll.user_id === me?.user_id ? "You rolled" : `${lastVisibleRoll.username} rolled`)
    : undefined;

  const gameEnded = gameError && (gameQueryError as Error)?.message === "Game ended";
  if (gameEnded) {
    return (
      <div className="w-full min-h-screen bg-[#010F10] flex flex-col items-center justify-center text-center px-8">
        <h2 className="text-2xl font-bold text-cyan-400 mb-2">Game over</h2>
        <p className="text-gray-400 mb-6">This game has ended.</p>
        <button onClick={() => router.push("/")} className="px-8 py-4 bg-[#00F0FF] text-[#010F10] font-bold rounded-lg hover:bg-[#00F0FF]/80 transition-all">Go home</button>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#010F10] flex flex-row gap-4 p-4">
      {/* Wrapper for fullscreen: sidebar + board + all modals so modals show in fullscreen mode */}
      <div
        ref={fullscreenRef}
        className={`flex flex-row gap-4 flex-1 min-w-0 min-h-0 overflow-hidden ${isFullscreen ? "p-4 bg-[#010F10]" : ""}`}
      >
      {/* Sidebar: Perks + X + notification bell + Players — fixed on desktop so it never scrolls out */}
      <div className="hidden lg:flex flex-col w-72 flex-shrink-0 gap-5 fixed left-4 top-[100px] z-20 max-h-[calc(100vh-100px-1rem)] overflow-y-auto">
        {/* Perks bar + Shop link; X + notification bell on the next line */}
        {isLiveGame && game && (
          <div className="flex flex-col gap-3 shrink-0">
            <PerksBar
              onOpenModal={() => setShowPerksModal(true)}
              onUsePerk={handleUsePerkFromBar}
              className="shrink-0"
            />
            <div className="flex items-center gap-2 flex-wrap">
              {isUntimed && endByNetWorthStatus != null && !showEndByNetWorthConfirm && (
                <button
                  type="button"
                  onClick={() => {
                    if (endByNetWorthStatus.voters?.some((v) => v.user_id === me?.user_id)) return;
                    if (!endByNetWorthLoading) setShowEndByNetWorthConfirm(true);
                  }}
                  disabled={endByNetWorthLoading || (endByNetWorthStatus.voters?.some((v) => v.user_id === me?.user_id) ?? false)}
                  className="w-10 h-10 shrink-0 rounded-xl text-lg font-bold bg-red-600/90 border border-red-400/60 text-white hover:bg-red-500 hover:border-red-300 transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center"
                  title={endByNetWorthStatus.voters?.some((v) => v.user_id === me?.user_id) ? `Voted ${endByNetWorthStatus.vote_count}/${endByNetWorthStatus.required_votes}` : `End game by net worth · ${endByNetWorthStatus.vote_count}/${endByNetWorthStatus.required_votes}`}
                  aria-label="Vote to end game by net worth"
                >
                  ×
                </button>
              )}
              <TradeAlertPill
                incomingCount={incomingTrades?.length ?? 0}
                onViewTrades={() => setViewTradesRequested(true)}
              />
            </div>
          </div>
        )}
        {isLiveGame && game && me && (
          <MyAgentToggle
            gameId={game.id}
            myAgentOn={myAgentOn}
            myAgentApiKey={myAgentApiKey}
            onUseApiKey={setMyAgentApiKey}
            onStopApiKey={() => setMyAgentApiKey(null)}
            onBindingsChange={refetchAgentBindings}
            compact
          />
        )}
        {/* Vote player out — same as 2D board */}
        {isLiveGame && game && voteablePlayersList.length > 0 && (
          <div className="rounded-xl border-2 border-amber-500/40 bg-slate-900/90 p-4 space-y-3">
            <p className="text-amber-200/90 text-xs font-semibold uppercase tracking-wide">Timed out — vote to remove</p>
            {voteablePlayersList.map((p) => {
              const status = voteStatuses[p.user_id];
              const hasVoted = status?.voters?.some((v) => v.user_id === me?.user_id) ?? false;
              const voteRatio = status ? ` (${status.vote_count}/${status.required_votes})` : "";
              const isLoading = votingLoading[p.user_id];
              return (
                <button
                  key={p.user_id}
                  type="button"
                  onClick={() => voteToRemove(p.user_id)}
                  disabled={isLoading || hasVoted}
                  className={`w-full text-center text-sm font-semibold rounded-xl px-4 py-3 border-2 transition-all shadow-lg ${
                    hasVoted
                      ? "bg-emerald-900/70 text-emerald-100 border-emerald-400/50 cursor-default"
                      : isLoading
                      ? "bg-amber-900/70 text-amber-100 border-amber-400/50 cursor-wait"
                      : "bg-rose-900/60 text-rose-100 border-rose-400/50 hover:bg-rose-800/70 hover:border-rose-300/60"
                  }`}
                >
                  {hasVoted ? `✓ Voted out${voteRatio}` : isLoading ? "Voting…" : `Vote ${p.username ?? "Player"} out${voteRatio}`}
                </button>
              );
            })}
          </div>
        )}
        {gameCode && gameLoading ? (
          <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500/30 bg-slate-900/80 shadow-xl">
            <div className="p-6 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <p className="text-amber-200/90 text-sm font-medium">Loading players…</p>
            </div>
          </div>
        ) : isLiveGame && game ? (
          <PlayerSection3D
            game={game}
            properties={properties}
            game_properties={gameProperties}
            my_properties={my_properties}
            me={me}
            currentPlayer={currentPlayer}
            positions={positions}
            isAITurn={false}
            isLoading={false}
            onPropertySelect={(prop, gp) => {
              setSelectedProperty(prop);
              setSelectedGameProperty(gp ?? undefined);
            }}
            openTradeSection={viewTradesRequested}
            onTradeSectionOpened={() => setViewTradesRequested(false)}
          />
        ) : (
          <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500/50 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="absolute inset-0 rounded-2xl border border-amber-400/20 pointer-events-none" />
            <div className="relative">
              <div className="px-4 py-3 bg-gradient-to-r from-amber-900/40 to-amber-800/30 border-b-2 border-amber-500/40">
                <h3 className="text-base font-black text-amber-200 tracking-widest uppercase drop-shadow-sm flex items-center gap-2">
                  <span className="text-lg">🎲</span> Players
                </h3>
              </div>
              <div className="p-2.5 space-y-2 max-h-64 overflow-y-auto">
                {players.map((p) => {
                  const pos = positions[p.user_id] ?? p.position ?? 0;
                  const isMe = p.user_id === 1;
                  return (
                    <div
                      key={p.user_id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl border-2 transition-all ${
                        isMe ? "bg-amber-500/25 border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.2)]" : "bg-slate-800/60 border-slate-600/50 hover:border-slate-500/70"
                      }`}
                    >
                      <span
                        className={`flex items-center justify-center w-10 h-10 rounded-full text-2xl shrink-0 ${
                          isMe ? "bg-amber-500/30 ring-2 ring-amber-400/50" : "bg-slate-700/80"
                        }`}
                        title={p.symbol ?? ""}
                      >
                        {getPlayerSymbol(p.symbol)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${isMe ? "text-amber-100" : "text-slate-200"}`}>
                          {p.username ?? `Player ${p.user_id}`}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          <span className="text-emerald-400 font-semibold">${Number(p.balance ?? 0)}</span>
                          <span className="text-slate-500 mx-1">·</span>
                          {getSquareNameFromProperties(properties, pos)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Spacer so board doesn't sit under fixed sidebar on desktop */}
      <div className="hidden lg:block w-72 flex-shrink-0" aria-hidden="true" />

      {/* Board area */}
      <div
        className="flex flex-col items-center justify-center bg-[#010F10] rounded-xl min-h-0 flex-1 min-w-0 relative"
      >
        {/* Balance — visible in normal and fullscreen */}
        {isLiveGame && me && (
          <div
            className="absolute top-3 left-3 z-[100] px-4 py-2 rounded-xl bg-slate-800/95 border border-cyan-500/50 text-cyan-200 font-bold shadow-lg"
            style={{ zIndex: 2147483646 }}
          >
            ${Number(me.balance ?? 0).toLocaleString()}
          </div>
        )}

        {/* 2-min turn timer — same as 2D board */}
        {isLiveGame && turnTimeLeft != null && game?.status === "RUNNING" && (
          <div
            className={`absolute top-3 right-3 z-[100] px-4 py-2 rounded-xl bg-slate-800/95 border border-cyan-500/50 font-mono font-bold shadow-lg ${(turnTimeLeft ?? 120) <= 10 ? "text-red-400 animate-pulse" : "text-cyan-200"}`}
            style={{ zIndex: 2147483646 }}
            title={isMyTurn ? "Your turn: roll or complete actions" : `${currentPlayer?.username ?? "Player"} has 2 min to roll`}
          >
            {isMyTurn
              ? (turnTimeLeft <= 10 ? "Roll!" : `${Math.floor((turnTimeLeft ?? 120) / 60)}:${((turnTimeLeft ?? 120) % 60).toString().padStart(2, "0")}`)
              : `${currentPlayer?.username ?? "?"} ${Math.floor((turnTimeLeft ?? 120) / 60)}:${((turnTimeLeft ?? 120) % 60).toString().padStart(2, "0")}`}
          </div>
        )}

        {/* Reset view + Fullscreen + How to Play — above the board */}
        {!(gameCode && gameError) && !(isLoading || (gameCode && gameLoading)) && (
          <div className="flex items-center justify-center gap-2 w-full max-w-[1200px] py-2 shrink-0">
            <button
              type="button"
              onClick={() => setResetViewTrigger((t) => t + 1)}
              className="px-4 py-2 rounded-lg bg-slate-700/95 hover:bg-slate-600 border border-slate-500/60 text-slate-200 font-medium shadow-lg"
              title="Reset board view to default"
            >
              Reset view
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="px-4 py-2 rounded-lg bg-slate-700/95 hover:bg-slate-600 border border-slate-500/60 text-slate-200 font-medium shadow-lg"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            </button>
            <Link
              href="/how-to-play"
              className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg bg-slate-700/95 hover:bg-slate-600 border border-slate-500/60 text-slate-200 font-medium shadow-lg"
              title="How to Play"
              aria-label="How to Play"
            >
              <HelpCircle className="w-5 h-5" />
            </Link>
          </div>
        )}

        {isLiveGame && game?.duration != null && Number(game.duration) > 0 && game?.status === "RUNNING" ? (
          <div className="flex flex-col items-center gap-2 mb-2 shrink-0">
            <GameDurationCountdown game={game} onTimeUp={handleGameTimeUp} />
          </div>
        ) : null}
        {gameCode && gameError ? (
          <div className="mt-4 text-center">
            <p className="text-amber-400 mb-2">Game not found: {gameCode}</p>
            <Link href="/board-3d" className="text-cyan-400 underline hover:no-underline">Board without game</Link>
            <span className="text-slate-500 mx-2">·</span>
            <Link href="/board-3d-mobile" className="text-cyan-400 underline hover:no-underline">Mobile 3D</Link>
            <span className="text-slate-500 mx-2">·</span>
            <Link href="/join-room-3d" className="text-cyan-400 underline hover:no-underline">Create or join game</Link>
          </div>
        ) : isLoading || (gameCode && gameLoading) ? (
          <p className="text-slate-400 mt-4">{gameCode ? "Loading game..." : "Loading board..."}</p>
        ) : (
          <div className="flex flex-col items-center w-full max-w-[1200px] flex-1 min-h-0">
            <div
              className={`rounded-xl overflow-hidden border border-cyan-500/30 shadow-2xl w-full relative ${
                isFullscreen ? "flex-1 min-h-0" : "aspect-square max-w-[1200px]"
              }`}
              style={{ zIndex: 0, isolation: "isolate" }}
            >
              {canvasReady ? (
                <div ref={canvasContainerRef} className="absolute inset-0 w-full h-full min-h-0">
                  {canvasMounted ? (
                    <Canvas
                      key={canvasKey}
                      camera={{ position: [0, 12, 12], fov: 45 }}
                      shadows
                      gl={{ antialias: true, alpha: false }}
                    >
                      <BoardScene
                        properties={properties}
                        players={players}
                        animatedPositions={positions}
                        currentPlayerId={isLiveGame ? currentPlayerId : 1}
                        developmentByPropertyId={developmentByPropertyId}
                        ownerByPropertyId={isLiveGame ? ownerByPropertyId : undefined}
                        onSquareClick={handlePropertyClick}
                        rollingDice={rollingDice ?? undefined}
                        onDiceComplete={isLiveGame ? onDiceCompleteClick : (showRollUi ? onDiceCompleteClick : undefined)}
                        lastRollResult={lastRollResultToShow}
                        rollLabel={rollLabel}
                        onRoll={showRollUi ? onRollClick : undefined}
                        history={historyToShow}
                        aiThinking={isLiveGame && !isMyTurn && currentPlayerId != null}
                        thinkingLabel={isLiveGame && !isMyTurn && currentPlayer ? `${currentPlayer.username || "Player"} is thinking...` : undefined}
                        resetViewTrigger={resetViewTrigger}
                        focusTilePosition={landedPositionForBuy}
                        onFocusComplete={onFocusComplete}
                        spinOrbitDegrees={spinOrbitDegrees}
                      />
                    </Canvas>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center gap-2 text-slate-400">
                      <div className="w-8 h-8 rounded-full border-2 border-cyan-500/50 border-t-cyan-400 animate-spin" />
                      <p className="text-sm">Loading 3D board…</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-slate-400">
                  <div className="w-8 h-8 rounded-full border-2 border-cyan-500/50 border-t-cyan-400 animate-spin" />
                  <p className="text-sm">Loading 3D board…</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Buy / Skip + Jail overlays inside fullscreen container so they show in fullscreen mode */}
        {isLiveGame && buyPrompted && justLandedProperty && (
          <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-4" style={{ zIndex: 2147483647 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border-2 border-amber-500/50 bg-slate-900 p-6 max-w-sm w-full shadow-2xl"
          >
            <h3 className="text-lg font-bold text-amber-200 mb-2">You landed on {justLandedProperty.name}</h3>
            <p className="text-slate-300 text-sm mb-4">
              ${justLandedProperty.price?.toLocaleString()} — Buy or skip?
            </p>
            {buyTipsOn && (
              <div className="mb-4 p-3 rounded-lg bg-cyan-900/30 border border-cyan-500/30 text-left">
                <p className="text-xs text-cyan-300/90 mb-1">AI tip</p>
                {buyTipLoading ? (
                  <p className="text-sm text-slate-400">Thinking…</p>
                ) : buyTipText ? (
                  <p className="text-sm text-slate-200">{buyTipText}</p>
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
                checked={buyTipsOn}
                onChange={toggleBuyTips}
                className="rounded border-slate-500"
              />
              AI tips
            </label>
          </motion.div>
        </div>
      )}

      {/* Auction: unsold property — all players bid in turn or pass */}
      {isLiveGame && activeAuction && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-4" style={{ zIndex: 2147483647 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border-2 border-amber-500/50 bg-slate-900 p-6 max-w-sm w-full shadow-2xl"
          >
            <h3 className="text-lg font-bold text-amber-200 mb-1">Auction</h3>
            <p className="text-slate-300 text-sm mb-3">
              {activeAuction.property?.name ?? "Property"} — high bid: ${(activeAuction.current_high ?? 0).toLocaleString()}
            </p>
            {isMyTurnToBid ? (
              <>
                <div className="flex gap-2 mb-3">
                  <input
                    type="number"
                    min={(activeAuction.current_high ?? 0) + 1}
                    max={me?.balance ?? 0}
                    value={auctionBidAmount}
                    onChange={(e) => setAuctionBidAmount(e.target.value)}
                    placeholder="Your bid"
                    className="flex-1 rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-white"
                  />
                  <button
                    onClick={() => handleAuctionBid()}
                    disabled={auctionSubmitting || (!!auctionBidAmount.trim() && (isNaN(parseInt(auctionBidAmount, 10)) || parseInt(auctionBidAmount, 10) <= (activeAuction.current_high ?? 0)))}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold"
                  >
                    {auctionSubmitting ? "…" : "Bid"}
                  </button>
                  <button
                    onClick={handleAuctionPass}
                    disabled={auctionSubmitting}
                    className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-semibold"
                  >
                    Pass
                  </button>
                </div>
                <p className="text-xs text-slate-400">Your balance: ${(me?.balance ?? 0).toLocaleString()}</p>
              </>
            ) : (
              <p className="text-slate-400 text-sm">Waiting for another player to bid or pass…</p>
            )}
          </motion.div>
        </div>
      )}

      {/* Jail: before roll — Pay $50 / Use card / Roll for doubles */}
      {isLiveGame && isMyTurn && meInJail && !jailChoiceRequired && !rollingDice && !lastRollResultLive && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-4" style={{ zIndex: 2147483647 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border-2 border-cyan-500/50 bg-slate-900 p-6 max-w-sm w-full shadow-2xl"
          >
            <h3 className="text-lg font-bold text-cyan-200 mb-2">You&apos;re in jail</h3>
            <p className="text-slate-400 text-sm mb-4">Pay $50, use a Get Out of Jail Free card, or roll for doubles.</p>
            <div className="flex flex-col gap-2">
              {canPayToLeaveJail && (
                <button onClick={() => jailGuard.submit(handlePayToLeaveJail)} disabled={jailGuard.isSubmitting} className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold border border-cyan-400/30">
                  {jailGuard.isSubmitting ? "…" : "Pay $50"}
                </button>
              )}
              {hasChanceJailCard && (
                <button onClick={() => jailGuard.submit(() => handleUseGetOutOfJailFree("chance"))} disabled={jailGuard.isSubmitting} className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold border border-cyan-400/30">
                  Use Chance Get Out of Jail Free
                </button>
              )}
              {hasCommunityChestJailCard && (
                <button onClick={() => jailGuard.submit(() => handleUseGetOutOfJailFree("community_chest"))} disabled={jailGuard.isSubmitting} className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold border border-cyan-400/30">
                  Use Community Chest Get Out of Jail Free
                </button>
              )}
              <button onClick={handleRollForLive} className="w-full py-2.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-semibold border border-slate-500/50">
                Roll for doubles
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Jail: after roll (no doubles) — Pay / Use card / Stay */}
      {isLiveGame && isMyTurn && jailChoiceRequired && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-4" style={{ zIndex: 2147483647 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border-2 border-cyan-500/50 bg-slate-900 p-6 max-w-sm w-full shadow-2xl"
          >
            <h3 className="text-lg font-bold text-cyan-200 mb-2">No doubles — stay or pay</h3>
            <p className="text-slate-400 text-sm mb-4">Pay $50, use a card, or stay in jail.</p>
            <div className="flex flex-col gap-2">
              {canPayToLeaveJail && (
                <button onClick={() => jailGuard.submit(handlePayToLeaveJail)} disabled={jailGuard.isSubmitting} className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold border border-cyan-400/30">
                  {jailGuard.isSubmitting ? "…" : "Pay $50"}
                </button>
              )}
              {hasChanceJailCard && (
                <button onClick={() => jailGuard.submit(() => handleUseGetOutOfJailFree("chance"))} disabled={jailGuard.isSubmitting} className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold border border-cyan-400/30">
                  Use Chance Get Out of Jail Free
                </button>
              )}
              {hasCommunityChestJailCard && (
                <button onClick={() => jailGuard.submit(() => handleUseGetOutOfJailFree("community_chest"))} disabled={jailGuard.isSubmitting} className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold border border-cyan-400/30">
                  Use Community Chest Get Out of Jail Free
                </button>
              )}
              <button onClick={() => jailGuard.submit(handleStayInJail)} disabled={jailGuard.isSubmitting} className="w-full py-2.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-semibold border border-slate-500/50">
                {jailGuard.isSubmitting ? "…" : "Stay in jail"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

        {/* Chance / Community Chest card modal */}
        <CardModal
          isOpen={showCardModal}
          onClose={() => {
            setShowCardModal(false);
            fetchUpdatedGame();
          }}
          card={cardData}
          playerName={cardPlayerName}
          isCurrentPlayerDrawer={cardIsCurrentPlayerDrawer}
        />

        {/* End game by net worth — confirm modal (inside fullscreen so visible in fullscreen) */}
        <AnimatePresence>
          {showEndByNetWorthConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowEndByNetWorthConfirm(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", duration: 0.3 }}
                onClick={(e) => e.stopPropagation()}
                className="relative bg-gradient-to-b from-slate-800 to-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-900/30 p-6 max-w-sm w-full"
              >
                <button
                  type="button"
                  onClick={() => setShowEndByNetWorthConfirm(false)}
                  className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-cyan-300 hover:text-cyan-100 hover:bg-cyan-500/20 transition-colors"
                  aria-label="Close"
                >
                  <span className="text-xl leading-none">×</span>
                </button>
                <p className="text-lg font-semibold text-cyan-100 mb-1 pr-8">End game by net worth?</p>
                <p className="text-sm text-cyan-200/80 mb-6">The game will end and the player with the highest net worth will win.</p>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowEndByNetWorthConfirm(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-cyan-200 hover:text-cyan-100 border border-cyan-500/40 hover:bg-cyan-500/10 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      voteEndByNetWorth();
                      setShowEndByNetWorthConfirm(false);
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-cyan-600/90 text-white hover:bg-cyan-500 border border-cyan-400/50 transition-colors"
                  >
                    Yes, vote to end
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirm use perk from bar (burn + apply) */}
        <AnimatePresence>
          {pendingBarPerk && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[2147483646] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
              onClick={() => setPendingBarPerk(null)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-slate-800 border border-violet-500/50 rounded-xl p-6 max-w-sm w-full shadow-xl"
              >
                <p className="text-lg font-semibold text-white mb-1">Use {pendingBarPerk.name}?</p>
                <p className="text-sm text-slate-400 mb-6">This will burn one collectible. The effect will apply immediately.</p>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setPendingBarPerk(null)}
                    className="px-4 py-2 rounded-lg bg-slate-600 text-slate-200 hover:bg-slate-500 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await burnCollectible(pendingBarPerk.tokenId);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Burn failed");
                        setPendingBarPerk(null);
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition"
                  >
                    Use
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Perks / collectibles modal (inside fullscreen so visible in fullscreen) */}
        <AnimatePresence>
          {showPerksModal && game && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[2147483646] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
              onClick={() => {
                setShowPerksModal(false);
                fetchUpdatedGame();
              }}
            >
              <motion.div
                initial={{ scale: 0.92, opacity: 0, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 8 }}
                transition={{ type: "spring", damping: 26, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-2xl max-h-[88vh] overflow-hidden rounded-2xl border border-violet-400/40 bg-gradient-to-b from-slate-900 via-violet-950/30 to-slate-900 shadow-2xl shadow-violet-950/50 ring-1 ring-white/5"
              >
                <div className="flex items-center justify-between shrink-0 px-5 py-4 bg-gradient-to-r from-violet-900/80 via-fuchsia-900/40 to-violet-900/80 border-b border-violet-500/30">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/30 border border-violet-400/40">
                      <Sparkles className="w-5 h-5 text-violet-200" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white tracking-tight">Perks & collectibles</h2>
                      <p className="text-xs text-violet-200/80">Use perks to boost your game</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPerksModal(false);
                      fetchUpdatedGame();
                    }}
                    className="w-9 h-9 flex items-center justify-center rounded-full text-violet-200/90 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="overflow-y-auto max-h-[calc(88vh-5.5rem)] p-5 bg-slate-900/50">
                  <CollectibleInventoryBar
                    game={game}
                    game_properties={gameProperties}
                    isMyTurn={isMyTurn}
                    ROLL_DICE={playerCanRoll ? handleRollForLive : undefined}
                    END_TURN={END_TURN}
                    triggerSpecialLanding={triggerLandingLogic}
                    endTurnAfterSpecial={endTurnAfterSpecialMove}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
              className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
              style={{ zIndex: 2147483647 }}
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
                  <p className="text-slate-200 mb-6">You had the highest net worth when time ran out. Prizes were distributed when the game ended.</p>
                  <button
                    type="button"
                    onClick={() => handleFinalizeAndLeave()}
                    disabled={claimAndLeaveInProgress}
                    className="w-full py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-70 text-slate-900 font-bold"
                  >
                    {claimAndLeaveInProgress ? "Finalizing…" : "Finalize & go home"}
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ scale: 0.88, y: 24, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  className="relative w-full max-w-md rounded-[2rem] overflow-hidden border-2 border-slate-500/50 bg-gradient-to-b from-slate-900/95 to-black/95 shadow-2xl text-center p-8"
                >
                  <Trophy className="w-16 h-16 mx-auto text-amber-400 mb-4" />
                  <h1 className="text-2xl font-bold text-slate-200 mb-2">Time&apos;s up</h1>
                  <p className="text-xl text-white mb-4">{winner.username} <span className="text-amber-400">wins</span></p>
                  <HeartHandshake className="w-12 h-12 mx-auto text-cyan-400 mb-4" />
                  <p className="text-slate-300 mb-6">You still get a consolation prize. Prizes were distributed when the game ended.</p>
                  <button
                    type="button"
                    onClick={() => handleFinalizeAndLeave()}
                    disabled={claimAndLeaveInProgress}
                    className="w-full py-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-70 text-white font-bold"
                  >
                    {claimAndLeaveInProgress ? "Finalizing…" : "Finalize & go home"}
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <BankruptcyModal
          isOpen={showBankruptcyModal}
          onClose={() => setShowBankruptcyModal(false)}
          onReturnHome={() => (window.location.href = "/")}
          tokensAwarded={0.5}
        />

        {/* You were voted out — same as 2D board */}
        <AnimatePresence>
          {showVotedOutModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="voted-out-title"
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="bg-slate-800/95 border border-cyan-500/30 rounded-2xl p-6 max-w-sm w-full shadow-xl text-center"
                onClick={(e) => e.stopPropagation()}
              >
                <p id="voted-out-title" className="text-lg font-semibold text-cyan-100 mb-1">You were voted out</p>
                <p className="text-slate-300 text-sm mb-4">You can continue watching or leave the game.</p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setShowVotedOutModal(false)}
                    className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
                  >
                    Continue watching
                  </button>
                  <Link
                    href="/"
                    className="block w-full py-3 rounded-xl border border-slate-500 text-slate-300 hover:bg-slate-700/50 font-medium"
                  >
                    Leave
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {isLiveGame && isMyTurn && (me?.balance ?? 0) <= 0 && me && game && !agentOn && (
          <RaiseFundsPanel
            me={me}
            game={game}
            gameProperties={gameProperties}
            properties={properties}
            onRefetch={async () => { await refetchGame(); await refetchGameProperties(); }}
            onDeclareBankruptcy={handleDeclareBankruptcy}
            bottomClass="bottom-4"
          />
        )}
      </div>

      {/* Spacer so board doesn't sit under fixed chat sidebar */}
      <div className="hidden lg:block w-96 flex-shrink-0" aria-hidden="true" />

      {/* Tavern (game) chat only — general chat is in Rooms from nav */}
      <aside className="hidden lg:flex flex-col w-96 fixed right-4 top-[60px] z-20 h-[calc(100vh-60px-1rem)] max-h-[calc(100vh-60px-1rem)] border border-amber-500/20 rounded-xl bg-gradient-to-b from-[#0a1214] to-[#061012] overflow-hidden shadow-xl">
        <div className="flex-1 min-h-0 p-2 flex flex-col overflow-hidden">
          <GameyChatRoom
            gameId={gameCode ?? game?.code ?? ""}
            me={me}
            isMobile={false}
            showHeader={true}
            disableSend={hasLeftGame}
            fallbackAddress={guestUser?.address ?? address ?? undefined}
            fallbackUserId={me?.user_id ?? undefined}
          />
        </div>
      </aside>
      </div>

      <Toaster position="top-center" />
    </div>
  );
}

export default function Board3DDemoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#010F10] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
            <p className="text-slate-400">Loading board…</p>
          </div>
        </div>
      }
    >
      <Board3DPageContent />
    </Suspense>
  );
}
