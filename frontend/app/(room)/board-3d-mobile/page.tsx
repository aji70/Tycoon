"use client";

import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { apiClient } from "@/lib/api";
import { normalizeAiTip, AI_TIP_FALLBACK } from "@/lib/simplifyAiTip";
import { socketService } from "@/lib/socket";
import { ApiResponse } from "@/types/api";
import type { Property, Player, History, Game, GameProperty } from "@/types/game";
import { PROPERTY_ACTION } from "@/types/game";
import { getSquareName } from "@/components/game/board3d/squareNames";
import { getCornersPassed } from "@/components/game/board3d/positions";
import { getDiceValues } from "@/components/game/constants";
import { JAIL_POSITION, MOVE_ANIMATION_MS_PER_SQUARE } from "@/components/game/constants";
import { getContractErrorMessage } from "@/lib/utils/contractErrors";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { usePreventDoubleSubmit } from "@/hooks/usePreventDoubleSubmit";
import { useGameTrades } from "@/hooks/useGameTrades";
import { useAiBankruptcy } from "@/hooks/useAiBankruptcy";
import { useAgentAutoLiquidate } from "@/hooks/useAgentAutoLiquidate";
import { useAgentBindings } from "@/hooks/useAgentBindings";
import { useMobilePropertyActions } from "@/hooks/useMobilePropertyActions";
import { useGetGameByCode, useRewardBurnCollectible } from "@/context/ContractProvider";
import { Toaster, toast } from "react-hot-toast";
import { isAIPlayer, getAiSlotFromPlayer, TRADE_FAVORABILITY_ACCEPT_RAW, calculateAiFavorability, TRADE_ACCEPT_THRESHOLD } from "@/utils/gameUtils";
import { reportAiAction } from "@/lib/agentFeedback";
import { MONOPOLY_STATS, BUILD_PRIORITY } from "@/components/game/constants";
import { CardModal } from "@/components/game/modals/cards";
import { BankruptcyModal } from "@/components/game/modals/bankruptcy";
import RaiseFundsPanel from "@/components/game/modals/RaiseFundsPanel";
import PropertyDetailModal3D from "@/components/game/board3d/PropertyDetailModal3D";
import { MyAgentToggle } from "@/components/game/MyAgentToggle";
import { getStoredAgentApiKey, setStoredAgentApiKey } from "@/lib/agentApiKeySession";
import { GameDurationCountdown } from "@/components/game/GameDurationCountdown";
const Mobile3DGameUI = dynamic(
  () => import("@/components/game/board3d/Mobile3DGameUI").then((m) => m.default),
  { ssr: false }
);
import ActionLog from "@/components/game/ai-board/action-log";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Trophy, HeartHandshake, MessageCircle, X } from "lucide-react";
import GameyChatRoom from "@/components/game/board3d/GameyChatRoom";

const Canvas = dynamic(
  () => import("@react-three/fiber").then((m) => m.Canvas),
  { ssr: false }
);
const BoardScene = dynamic(
  () => import("@/components/game/board3d/BoardScene").then((m) => m.default),
  { ssr: false }
);

const PERK_CASH_TIERS = [0, 100, 250, 500, 700, 1000];
const PERK_REFUND_TIERS = [0, 60, 150, 300, 420, 600];
const PERK_DISCOUNT_TIERS = [0, 100, 200, 300, 400, 500];

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

const SOCKET_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_SOCKET_URL ||
        (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, ""))
    : "";

function Board3DMobileLoading() {
  return (
    <div
      className="fixed inset-0 w-full flex items-center justify-center bg-[#010F10]"
      style={{ height: "100dvh" }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-500/50 border-t-cyan-400 animate-spin" />
        <p className="text-sm text-slate-400">Loading board…</p>
      </div>
    </div>
  );
}

function Board3DMobileContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const gameCode = searchParams.get("gameCode")?.trim().toUpperCase() || null;

  const { address } = useAccount();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const isGuest = !!guestUser;

  const { properties, isLoading } = useBoardProperties();
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

  // Multiplayer: socket for live updates
  useEffect(() => {
    if (!gameCode || !SOCKET_URL || !game || game.is_ai !== false) return;
    const socket = socketService.connect(SOCKET_URL);
    socketService.joinGameRoom(gameCode);
    const onGameUpdate = (data: { gameCode: string }) => {
      if (data.gameCode === gameCode) {
        refetchGame();
        queryClient.invalidateQueries({ queryKey: ["game_properties"] });
        refetchGameProperties();
      }
    };
    const onGameStarted = () => {
      refetchGame();
      queryClient.invalidateQueries({ queryKey: ["game_properties"] });
      refetchGameProperties();
    };
    const onVoteCast = (data: { target_user_id: number; voter_user_id: number; vote_count: number; required_votes: number; removed: boolean }) => {
      if (data.removed) {
        setVotedOutTargetUserId(data.target_user_id);
        refetchGame();
      } else {
        setVoteStatuses((prev) => ({
          ...prev,
          [data.target_user_id]: { vote_count: data.vote_count, required_votes: data.required_votes, voters: [] },
        }));
      }
    };
    socketService.onGameUpdate(onGameUpdate);
    socketService.onGameStarted(onGameStarted);
    socketService.onVoteCast(onVoteCast);
    return () => {
      socketService.removeListener("game-update", onGameUpdate);
      socketService.removeListener("game-started", onGameStarted);
      socketService.removeListener("vote-cast", onVoteCast);
      socketService.leaveGameRoom(gameCode);
    };
  }, [gameCode, game?.is_ai, queryClient, refetchGame, refetchGameProperties]);

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
  const [viewTradesRequested, setViewTradesRequested] = useState(false);
  const [showPerksModal, setShowPerksModal] = useState(false);
  const [pendingBarPerk, setPendingBarPerk] = useState<{
    tokenId: bigint;
    perk: number;
    strength: number;
    name: string;
  } | null>(null);
  const { burn: burnCollectible, isSuccess: burnSuccess } = useRewardBurnCollectible();
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
  const [endByNetWorthStatus, setEndByNetWorthStatus] = useState<{
    vote_count: number;
    required_votes: number;
    voters: Array<{ user_id: number; username: string }>;
  } | null>(null);
  const [endByNetWorthLoading, setEndByNetWorthLoading] = useState(false);
  const [showEndByNetWorthConfirm, setShowEndByNetWorthConfirm] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [voteStatuses, setVoteStatuses] = useState<Record<number, { vote_count: number; required_votes: number; voters: Array<{ user_id: number; username: string }> }>>({});
  const [votingLoading, setVotingLoading] = useState<Record<number, boolean>>({});
  const [showVotedOutModal, setShowVotedOutModal] = useState(false);
  const [votedOutTargetUserId, setVotedOutTargetUserId] = useState<number | null>(null);

  useEffect(() => {
    if (votedOutTargetUserId != null && me?.user_id === votedOutTargetUserId) {
      setShowVotedOutModal(true);
      setVotedOutTargetUserId(null);
    }
  }, [votedOutTargetUserId, me?.user_id]);

  // Multiplayer: "Start now" ready window
  const [requestStartLoading, setRequestStartLoading] = useState(false);
  const READY_WINDOW_SECONDS = 30;
  const isWaitingForStart =
    isMultiplayer &&
    game?.status === "PENDING" &&
    !!game?.ready_window_opens_at &&
    (game?.players?.length ?? 0) >= (game?.number_of_players ?? 0);
  const readyOpensAt = game?.ready_window_opens_at ? new Date(game.ready_window_opens_at).getTime() : 0;
  const readyClosesAt = readyOpensAt + READY_WINDOW_SECONDS * 1000;
  const [readySecondsLeft, setReadySecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!isWaitingForStart || !readyOpensAt) {
      setReadySecondsLeft(null);
      return;
    }
    const tick = () => {
      const now = Date.now();
      if (now >= readyClosesAt) setReadySecondsLeft(0);
      else setReadySecondsLeft(Math.ceil((readyClosesAt - now) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isWaitingForStart, readyOpensAt, readyClosesAt]);
  const requestStart = useCallback(async () => {
    if (!game?.id || requestStartLoading) return;
    setRequestStartLoading(true);
    try {
      const res = await apiClient.post<ApiResponse>(`/games/${game.id}/request-start`);
      const data = res.data as { success?: boolean; started?: boolean; message?: string };
      if (data?.started) await refetchGame();
      if (data?.message) toast.success(data.message);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err?.response?.data?.message || err?.message || "Failed to request start");
    } finally {
      setRequestStartLoading(false);
    }
  }, [game?.id, requestStartLoading, refetchGame]);
  const startGuard = usePreventDoubleSubmit();

  const AI_TIPS_STORAGE_KEY = "tycoon_ai_tips_on_3d_mobile";
  // Always start false to avoid hydration mismatch; sync from localStorage in useEffect
  const [aiTipsOn, setAiTipsOn] = useState(false);
  const [aiTipText, setAiTipText] = useState<string | null>(null);
  useEffect(() => {
    try {
      setAiTipsOn(localStorage.getItem(AI_TIPS_STORAGE_KEY) === "true");
    } catch {
      /* ignore */
    }
  }, []);
  const [aiTipLoading, setAiTipLoading] = useState(false);
  const lastTipPropertyIdRef = useRef<number | null>(null);
  const lastTipActionRef = useRef<"buy" | "skip" | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resetViewTrigger, setResetViewTrigger] = useState(0);
  const [canvasKey, setCanvasKey] = useState(0);
  const [canvasReady, setCanvasReady] = useState(false);
  const [canvasMounted, setCanvasMounted] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const pendingShowCardModalRef = useRef(false);
  const pendingBuyPromptRef = useRef(false);

  // When user navigates away and back: reset so we remount Canvas only after container is in DOM (avoids R3F connect() reading .style on undefined).
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
  // Phase 1: after a short delay, show the container div (so ref can attach).
  useEffect(() => {
    if (!canvasReady) {
      const t = window.setTimeout(() => {
        setCanvasKey((k) => k + 1);
        setCanvasReady(true);
      }, 100);
      return () => window.clearTimeout(t);
    }
  }, [canvasReady]);
  // Phase 2: mount Canvas only after the container is in the DOM (we show container when !loading and canvasReady). Re-run when loading finishes so ref is set.
  const showCanvasArea = canvasReady && !isLoading && !(gameCode && gameLoading);
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

  const timeUpHandledRef = useRef(false);
  const rollingForPlayerIdRef = useRef<number | null>(null);
  const rolledForPlayerIdRef = useRef<number | null>(null);
  const pendingRollRef = useRef<{ die1: number; die2: number; total: number }>({ die1: 0, die2: 0, total: 0 });
  const doublesCountRef = useRef(0);
  const runningTotalRef = useRef(0);
  const expectingDoublesRollAgainRef = useRef(false);
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

  const { myAgentOn, refetch: refetchAgentBindings } = useAgentBindings(game?.id);
  const [myAgentApiKey, setMyAgentApiKeyState] = useState<{ provider: string; apiKey: string } | null>(() => getStoredAgentApiKey());
  const setMyAgentApiKey = useCallback((value: { provider: string; apiKey: string } | null) => {
    setMyAgentApiKeyState(value);
    setStoredAgentApiKey(value);
  }, []);
  const agentOn = myAgentOn || !!myAgentApiKey;

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
          await fetchUpdatedGame();
        } else {
          toast.success(`${data.vote_count}/${data.required_votes} voted to end by net worth`);
        }
      }
    } catch (err) {
      toast.error(getContractErrorMessage(err, "Failed to vote"));
    } finally {
      setEndByNetWorthLoading(false);
    }
  }, [game?.id, me?.user_id, isUntimed, fetchUpdatedGame]);

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
            (gid) => gameProperties.find((gp) => gp.property_id === gid && gp.address?.toLowerCase() === receiverAddress?.toLowerCase())
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

    // Respond to any pending incoming trades before proposing new ones
    try {
      const incomingRes = await apiClient.get<ApiResponse>(`/game-trade-requests/incoming/${game.id}/player/${currentPlayer.user_id}`);
      const pendingIncoming = ((incomingRes?.data?.data ?? []) as { id: number; status: string; offer_properties: number[]; offer_amount: number; requested_properties: number[]; requested_amount: number }[]).filter((t) => t.status === "pending");
      for (const trade of pendingIncoming) {
        let handled = false;
        try {
          const slot = getAiSlotFromPlayer(currentPlayer) ?? 2;
          const agentRes = await apiClient.post<{ success?: boolean; data?: { action?: string; reasoning?: string }; useBuiltIn?: boolean }>("/agent-registry/decision", {
            gameId: game.id,
            slot,
            decisionType: "trade",
            context: {
              myBalance: currentPlayer.balance ?? 0,
              myProperties: gameProperties.filter((gp) => gp.address?.toLowerCase() === currentPlayer.address?.toLowerCase()).map((gp) => ({ ...properties.find((p) => p.id === gp.property_id), ...gp })),
              opponents: livePlayers.filter((p) => p.user_id !== currentPlayer.user_id),
              tradeOffer: trade,
            },
          });
          if (agentRes?.data?.success && agentRes.data.useBuiltIn === false) {
            const action = String(agentRes.data.data?.action ?? "").toLowerCase();
            if (action === "accept") {
              await apiClient.post("/game-trade-requests/accept", { id: trade.id });
              reportAiAction(game.id, slot, "acceptTrade");
            } else {
              await apiClient.post("/game-trade-requests/decline", { id: trade.id });
            }
            handled = true;
          }
        } catch (_) { /* fallback */ }
        if (!handled) {
          const fav = calculateAiFavorability(trade, properties);
          if (fav >= TRADE_ACCEPT_THRESHOLD) {
            await apiClient.post("/game-trade-requests/accept", { id: trade.id });
            reportAiAction(game.id, getAiSlotFromPlayer(currentPlayer) ?? 2, "acceptTrade");
          } else {
            await apiClient.post("/game-trade-requests/decline", { id: trade.id });
          }
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      if (pendingIncoming.length > 0) await refetchGame();
    } catch (err) {
      console.error("AI incoming trade handling failed", err);
    }

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
            reportAiAction(game.id, getAiSlotFromPlayer(currentPlayer) ?? 2, "proposeTrade");
            if (isAIPlayer(targetPlayer)) {
              await new Promise((r) => setTimeout(r, 800));
              const favorability = calculateTradeFavorability(
                { ...payload, requested_amount: 0 },
                targetPlayer.address!
              );
              if (favorability >= TRADE_FAVORABILITY_ACCEPT_RAW) {
                await apiClient.post("/game-trade-requests/accept", { id: res.data.data.id });
                reportAiAction(game.id, getAiSlotFromPlayer(targetPlayer) ?? 3, "acceptTrade");
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
          (gp) => ids.includes(gp.property_id) && gp.address?.toLowerCase() === player.address?.toLowerCase()
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
            reportAiAction(game.id, getAiSlotFromPlayer(player) ?? 2, minHouses >= 4 ? "buildHotel" : "buildHouse");
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
            const res = await apiClient.post<{ success?: boolean }>("/perks/use-jail-free", {
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
            const res = await apiClient.post<{ success?: boolean }>("/perks/activate", {
              game_id: game.id,
              perk_id: perk,
            });
            success = res?.data?.success ?? false;
            if (success) toast.success(`${name} activated for next use!`, { id: toastId });
            break;
          }
          case 5: {
            const amount = PERK_CASH_TIERS[Math.min(strength, PERK_CASH_TIERS.length - 1)];
            const res = await apiClient.post<{ success?: boolean; reward?: number }>("/perks/burn-cash", {
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
              const res = await apiClient.post<{ success?: boolean }>("/perks/apply-cash", {
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
              const res = await apiClient.post<{ success?: boolean }>("/perks/apply-cash", {
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
    const totalSteps = isInJail && !rolledDouble ? 0 : totalMove;

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
      });
      const data = res?.data?.data ?? (res as { data?: { still_in_jail?: boolean; new_position?: number; requires_buy?: boolean; property_for_buy?: Property; card?: { instruction?: string; display_instruction?: string }; passed_turn?: boolean } })?.data;
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
      const cornersPassed = getCornersPassed(currentPos, finalPosition);
      if (cornersPassed.length > 0) {
        setSpinOrbitDegrees(cornersPassed.length * 90);
        setTimeout(() => setSpinOrbitDegrees(0), 3000);
      }
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
      if (data?.requires_buy && data?.property_for_buy) {
        pendingBuyPromptRef.current = true;
        setBuyPrompted(true);
      } else {
        const square = properties.find((p) => p.id === finalPosition);
        const freshGameProperties = gameProperties;
        const isOwned = freshGameProperties.some((gp: GameProperty) => gp.property_id === finalPosition);
        const action = PROPERTY_ACTION(finalPosition);
        const isBuyableType = !!action && ["land", "railway", "utility"].includes(action);
        const needBuyPrompt = !!square && square.price != null && !isOwned && isBuyableType;
        if (needBuyPrompt) {
          pendingBuyPromptRef.current = true;
          setBuyPrompted(true);
        }
      }
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
            toast.error(getContractErrorMessage(e, "Failed to pass turn"));
            await refetchGame();
          }
        } else {
          toast.error(getContractErrorMessage(err, "Roll failed"));
        }
      } catch (toastErr) {
        toast.error("Roll failed");
      }
    } finally {
      doublesCountRef.current = 0;
      runningTotalRef.current = 0;
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
    END_TURN,
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
            const balanceAfterBuy2 = balanceAfterMove - (square.price ?? 0);
            shouldBuy = completesMonopoly || (balanceAfterMove >= (square.price ?? 0) && balanceAfterBuy2 >= 500);
          }
        } catch {
          const balanceAfterBuy = balanceAfterMove - (square.price ?? 0);
          shouldBuy = completesMonopoly || (balanceAfterMove >= (square.price ?? 0) && balanceAfterBuy >= 500);
        }
        if (shouldBuy) {
          await apiClient.post("/game-properties/buy", {
            user_id: playerId,
            game_id: game.id,
            property_id: square.id,
          });
          reportAiAction(game.id, getAiSlotFromPlayer(currentPlayer) ?? 2, "buyProperty");
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
    const newPos = (isInJail && !rolledDouble) ? currentPos : (currentPos + value.total) % 40;
    const totalSteps = (isInJail && !rolledDouble) ? 0 : value.total;
    try {
      await runMovementAnimation(playerId, currentPos, totalSteps);
      const res = await apiClient.post<{ data?: { still_in_jail?: boolean } }>(
        "/game-players/change-position",
        { user_id: playerId, game_id: game.id, position: newPos, rolled: value.total, is_double: rolledDouble }
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
      const [refetchGameResult, refetchGpResult] = await Promise.all([refetchGame(), refetchGameProperties()]);
      const updatedGame = refetchGameResult?.data as Game | undefined;
      const updatedGameProperties = Array.isArray(refetchGpResult?.data) ? (refetchGpResult.data as GameProperty[]) : gameProperties;
      const updatedMe = updatedGame?.players?.find((p: Player) => p.user_id === playerId) ?? me;
      const balanceAfterMove = updatedMe?.balance ?? me.balance ?? 0;
      setLiveMovementOverride((prev) => {
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
      const square = properties.find((p) => p.id === newPos);
      const isOwned = updatedGameProperties.some((gp: GameProperty) => gp.property_id === newPos);
      const action = PROPERTY_ACTION(newPos);
      const isBuyableType = !!action && ["land", "railway", "utility"].includes(action);
      const needBuyPrompt = !!square && square.price != null && !isOwned && isBuyableType;
      if (needBuyPrompt && square) {
        const groupIds =
          Object.values(MONOPOLY_STATS.colorGroups).find((ids: number[]) => ids.includes(square.id)) ?? [];
        const ownedInGroup = groupIds.filter((id: number) =>
          updatedGameProperties.some(
            (gp) => gp.property_id === id && gp.address?.toLowerCase() === me.address?.toLowerCase()
          )
        ).length;
        const completesMonopoly = groupIds.length > 0 && ownedInGroup === groupIds.length - 1;
        const landingRank = (MONOPOLY_STATS.landingRank as Record<number, number>)[square.id] ?? 99;
        const decisionContext = {
          myBalance: balanceAfterMove,
          myProperties: updatedGameProperties
            .filter((gp) => gp.address?.toLowerCase() === me.address?.toLowerCase())
            .map((gp) => ({ ...properties.find((p) => p.id === gp.property_id), ...gp })),
          opponents: (updatedGame?.players ?? game?.players ?? []).filter((p: Player) => p.user_id !== me.user_id),
          landedProperty: { ...square, completesMonopoly, landingRank },
        };
        const balanceAfterBuy = balanceAfterMove - (square.price ?? 0);
        const builtInShouldBuy = completesMonopoly || (balanceAfterMove >= (square.price ?? 0) && balanceAfterBuy >= 500);
        try {
          let shouldBuy: boolean = builtInShouldBuy;
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
            const agentRes = await apiClient.post<{ success?: boolean; data?: { action?: string }; useBuiltIn?: boolean }>(
              "/agent-registry/decision",
              { gameId: game.id, slot: 1, decisionType: "property", context: decisionContext }
            );
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
        delete next[me.user_id];
        return next;
      });
      toast.error(getContractErrorMessage(err, "Agent move failed"));
      setTimeout(() => END_TURN(), 500);
    } finally {
      setRollingDice(null);
      rollingForPlayerIdRef.current = null;
    }
  }, [game, me, myAgentApiKey, refetchGame, refetchGameProperties, properties, gameProperties, runMovementAnimation, END_TURN]);

  const onRollClick = useCallback(() => {
    if (isLiveGame && playerCanRoll) handleRollForLive();
  }, [isLiveGame, playerCanRoll, handleRollForLive]);

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
    if (!isLiveGame) return;
    if (rollingForPlayerIdRef.current !== null && me && rollingForPlayerIdRef.current === me.user_id && agentOn) {
      handleDiceCompleteForMyAgent();
    } else if (rollingForPlayerIdRef.current !== null && me && rollingForPlayerIdRef.current !== me.user_id) {
      handleDiceCompleteForAI();
    } else {
      handleDiceCompleteForLive();
    }
  }, [isLiveGame, handleDiceCompleteForLive, handleDiceCompleteForAI, handleDiceCompleteForMyAgent, me, agentOn]);

  const handleBuy = useCallback(async () => {
    if (!game?.id || !me || !justLandedProperty) return;
    if (lastTipActionRef.current === "buy") {
      apiClient.post(`/games/${game.id}/erc8004-tip-feedback`).catch(() => {});
      lastTipActionRef.current = null;
    }
    try {
      await apiClient.post("/game-properties/buy", {
        user_id: me.user_id,
        game_id: game.id,
        property_id: justLandedProperty.id,
      });
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
    if (lastTipActionRef.current === "skip") {
      apiClient.post(`/games/${game?.id}/erc8004-tip-feedback`).catch(() => {});
      lastTipActionRef.current = null;
    }
    setTurnEndScheduled(true);
    setBuyPrompted(false);
    setLandedPositionForBuy(null);
    landedPositionThisTurnRef.current = null;
    setTimeout(() => END_TURN(), 900);
  }, [END_TURN, game?.id]);

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
      const square = properties.find((p) => p.id === newPosition);
      if (square?.price != null) {
        const isOwned = gameProperties.some((gp) => gp.property_id === newPosition);
        const action = PROPERTY_ACTION(newPosition);
        if (!isOwned && action && ["land", "railway", "utility"].includes(action)) {
          pendingBuyPromptRef.current = true;
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

  useEffect(() => {
    setStrategyRanThisTurn(false);
    rolledForPlayerIdRef.current = null;
  }, [currentPlayerId]);

  useEffect(() => {
    if (!isAITurn || !currentPlayer || strategyRanThisTurn || !isLiveGame) return;
    const t = setTimeout(handleAiStrategy, 1000);
    return () => clearTimeout(t);
  }, [isAITurn, currentPlayer, strategyRanThisTurn, isLiveGame, handleAiStrategy]);

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
        await apiClient.post("/game-properties/development", {
          game_id: game.id,
          user_id: me.user_id,
          property_id: agentRes.data.data.propertyId,
        });
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
      .post<{ success?: boolean; data?: { reasoning?: string }; fallbackReason?: string }>("/agent-registry/decision", {
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
          setAiTipText(fallbackReason);
          lastTipActionRef.current = "skip";
          return;
        }
        const data = res?.data?.data;
        const text = data?.reasoning ?? null;
        setAiTipText(normalizeAiTip(text) ?? AI_TIP_FALLBACK);
        lastTipActionRef.current = data?.action === "buy" ? "buy" : "skip";
      })
      .catch((e: unknown) => {
        const err = e as { response?: { data?: { message?: string; error?: string } }; message?: string };
        const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? err?.message ?? "Request failed";
        setAiTipText(`Error: ${msg}`);
      })
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

  const handleDeclareBankruptcy = useCallback(async () => {
    if (!game?.id || !me) return;
    toast("Declaring bankruptcy...", { icon: "…" });
    try {
      // Backend signs endAIGameByBackend when we PUT FINISHED (gasless for user)
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
  }, [game?.id, me, livePlayers]);

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

  const handleClaimAndGoHome = useCallback(async () => {
    setClaimAndLeaveInProgress(true);
    const isHumanWinner = winner?.user_id === me?.user_id;
    try {
      try {
        await refetchGame();
      } catch (_) {
        /* ignore */
      }
      toast.success(isHumanWinner ? "Prize already distributed! 🎉" : "Thanks for playing!");
      try {
        await apiClient.post(`/games/${game?.id}/erc8004-feedback`);
      } catch (_) {
        /* best-effort */
      }
      window.location.href = "/";
    } catch (err) {
      toast.error(getContractErrorMessage(err as Error, "Something went wrong. Try again or refresh the page."));
      setClaimAndLeaveInProgress(false);
    } finally {
      setClaimAndLeaveInProgress(false);
    }
  }, [winner?.user_id, me?.user_id, game?.id, refetchGame]);

  const historyToShow = isLiveGame && game?.history?.length ? game.history : [];
  const lastRollResultToShow = lastRollResultLive;
  const showRollUi = !isLiveGame || (playerCanRoll && !(meInJail && !jailChoiceRequired));

  const players = isLiveGame ? livePlayers : [];
  const emptyPlayers = useMemo(() => [], []);

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
    <div
      ref={fullscreenRef}
      className="fixed inset-0 w-full bg-[#010F10] overflow-hidden"
      style={{ height: "100dvh" }}
    >
      {/* Multiplayer: "All players have joined" / Start now overlay */}
      {isWaitingForStart && (
        <div className="absolute inset-0 z-[2147483647] flex items-center justify-center bg-black/80 backdrop-blur-sm" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="bg-[#0d1f23] border border-cyan-500/30 rounded-xl p-6 mx-4 max-w-sm text-center shadow-xl">
            <h2 className="text-lg font-semibold text-white mb-2">All players have joined</h2>
            <p className="text-gray-300 text-sm mb-3">
              Click &quot;Start now&quot; to begin. All players must click within the window.
            </p>
            {readySecondsLeft !== null && (
              <p className="text-cyan-400 font-mono text-xl mb-4">
                {readySecondsLeft > 0 ? `${readySecondsLeft}s left` : "Window closed"}
              </p>
            )}
            <button
              type="button"
              onClick={() => startGuard.submit(() => requestStart())}
              disabled={requestStartLoading || startGuard.isSubmitting || readySecondsLeft === 0}
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-colors"
            >
              {requestStartLoading || startGuard.isSubmitting ? "..." : "Start now"}
            </button>
          </div>
        </div>
      )}

      {/* Top bar: all game controls start from the left; right side left clear for main nav hamburger */}
      <div
        className="fixed left-0 right-0 z-[100] flex items-center justify-start gap-1.5 pl-2 pr-16 py-1.5 bg-slate-800/95 border-b border-slate-600/50"
        style={{ top: 0, paddingTop: "max(0.375rem, env(safe-area-inset-top))", zIndex: 2147483646 }}
      >
        {isLiveGame && game && !isUntimed && game.duration && game.status === "RUNNING" && (
          <GameDurationCountdown game={game} onTimeUp={handleGameTimeUp} compact className="text-slate-200 text-xs shrink-0" />
        )}
        {isLiveGame && isUntimed && endByNetWorthStatus != null && !showEndByNetWorthConfirm && (
          <button
            type="button"
            onClick={() => {
              if (endByNetWorthStatus.voters?.some((v) => v.user_id === me?.user_id)) return;
              if (!endByNetWorthLoading) setShowEndByNetWorthConfirm(true);
            }}
            disabled={endByNetWorthLoading || (endByNetWorthStatus.voters?.some((v) => v.user_id === me?.user_id) ?? false)}
            className="px-2 py-1.5 rounded-md text-xs font-bold bg-red-600/90 border border-red-400/60 text-white hover:bg-red-500 shrink-0 disabled:opacity-50 disabled:pointer-events-none"
            title={endByNetWorthStatus.voters?.some((v) => v.user_id === me?.user_id) ? `Voted ${endByNetWorthStatus.vote_count}/${endByNetWorthStatus.required_votes}` : `End by net worth · ${endByNetWorthStatus.vote_count}/${endByNetWorthStatus.required_votes}`}
          >
            X
          </button>
        )}
        {!(gameCode && gameError) && !(isLoading || (gameCode && gameLoading)) && (
          <>
            <button
              type="button"
              onClick={() => setResetViewTrigger((t) => t + 1)}
              className="px-2 py-1.5 rounded-md bg-slate-700/90 hover:bg-slate-600 border border-slate-500/50 text-slate-200 text-xs font-medium shrink-0"
              title="Reset board view"
              aria-label="Reset view"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="px-2 py-1.5 rounded-md bg-slate-700/90 hover:bg-slate-600 border border-slate-500/50 text-slate-200 text-xs font-medium shrink-0"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? "Exit" : "FS"}
            </button>
          </>
        )}
        {isLiveGame && me && (
          <div
            className="px-2 py-1.5 rounded-md bg-slate-700/90 border border-cyan-500/40 text-cyan-200 text-xs font-bold shrink-0"
            title={`Balance: $${Number(me.balance ?? 0).toLocaleString()}`}
          >
            ${Number(me.balance ?? 0).toLocaleString()}
          </div>
        )}
        {isLiveGame && game && me && (
          <div className="shrink-0">
            <MyAgentToggle
              gameId={game.id}
              myAgentOn={myAgentOn}
              myAgentApiKey={myAgentApiKey}
              onStopApiKey={() => setMyAgentApiKey(null)}
              onBindingsChange={refetchAgentBindings}
              compact
            />
          </div>
        )}
        {isLiveGame && isMultiplayer && gameCode && (
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="px-2 py-1.5 rounded-md bg-amber-600/80 hover:bg-amber-500/90 border border-amber-400/40 text-amber-100 text-xs font-semibold shrink-0 flex items-center gap-1"
            title="Open Tavern Chat"
            aria-label="Open chat"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Chat
          </button>
        )}
        {/* Vote player out — same as 2D board */}
        {isLiveGame && game && !game.is_ai && voteablePlayersList.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto shrink min-w-0">
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
                  className={`shrink-0 text-xs font-semibold rounded-xl px-3 py-2 border-2 ${
                    hasVoted ? "bg-emerald-900/70 text-emerald-100 border-emerald-400/50" : isLoading ? "bg-amber-900/70 text-amber-100 border-amber-400/50" : "bg-rose-900/60 text-rose-100 border-rose-400/50"
                  }`}
                >
                  {hasVoted ? `✓ Voted${voteRatio}` : isLoading ? "…" : `Vote ${(p.username ?? "P").slice(0, 8)} out`}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <main
        className="w-full relative overflow-hidden"
        style={{
          position: "absolute",
          top: "calc(2.5rem + env(safe-area-inset-top, 0px))",
          left: 0,
          right: 0,
          height: `calc(${BOARD_HEIGHT_PCT}% - 2.5rem - env(safe-area-inset-top, 0px))`,
          zIndex: 0,
          isolation: "isolate",
        }}
      >
        {isLoading || (gameCode && gameLoading) ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-slate-400">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-500/50 border-t-cyan-400 animate-spin" />
            <p className="text-sm">{gameCode ? "Loading game…" : "Loading board…"}</p>
          </div>
        ) : canvasReady ? (
          <div
            ref={canvasContainerRef}
            className="absolute inset-0 w-full h-full overflow-hidden"
            style={{ touchAction: "none", zIndex: 0, isolation: "isolate" }}
          >
            {canvasMounted ? (
            <Canvas
              key={canvasKey}
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
            <p className="text-sm">Reconnecting board…</p>
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
        onUsePerk={handleUsePerkFromBar}
        isMyTurn={isMyTurn}
        onRollDice={playerCanRoll ? handleRollForLive : undefined}
        onEndTurn={END_TURN}
        triggerSpecialLanding={triggerLandingLogic}
        endTurnAfterSpecial={endTurnAfterSpecialMove}
      />

      {/* End game by net worth — confirm modal */}
      <AnimatePresence>
        {showEndByNetWorthConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            onClick={() => setShowEndByNetWorthConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-gradient-to-b from-slate-800 to-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl p-6 max-w-sm w-full"
            >
              <button
                type="button"
                onClick={() => setShowEndByNetWorthConfirm(false)}
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-cyan-300 hover:text-cyan-100 hover:bg-cyan-500/20"
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
                  className="px-4 py-2 rounded-xl text-sm font-medium text-cyan-200 hover:text-cyan-100 border border-cyan-500/40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    voteEndByNetWorth();
                    setShowEndByNetWorthConfirm(false);
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-cyan-600/90 text-white hover:bg-cyan-500 border border-cyan-400/50"
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
            className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            onClick={() => setPendingBarPerk(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-800 border border-violet-500/50 rounded-xl p-6 max-w-sm w-full shadow-xl"
            >
              <p className="text-lg font-semibold text-white mb-1">Use {pendingBarPerk?.name ?? "perk"}?</p>
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
              className="rounded-2xl border-2 border-cyan-500/50 bg-slate-900 p-6 max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-lg font-bold text-cyan-200 mb-2">You&apos;re in jail</h3>
              <p className="text-slate-400 text-sm mb-4">
                Pay $50, use a Get Out of Jail Free card, or roll for doubles.
              </p>
              <div className="flex flex-col gap-2">
                {canPayToLeaveJail && (
                  <button
                    onClick={() => jailGuard.submit(handlePayToLeaveJail)}
                    disabled={jailGuard.isSubmitting}
                    className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold border border-cyan-400/30"
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
                    className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold border border-cyan-400/30"
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
                    className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold border border-cyan-400/30"
                  >
                    Use Community Chest Get Out of Jail Free
                  </button>
                )}
                <button
                  onClick={handleRollForLive}
                  className="w-full py-2.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-semibold border border-slate-500/50"
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
            className="rounded-2xl border-2 border-cyan-500/50 bg-slate-900 p-6 max-w-sm w-full shadow-2xl"
          >
            <h3 className="text-lg font-bold text-cyan-200 mb-2">No doubles — stay or pay</h3>
            <p className="text-slate-400 text-sm mb-4">Pay $50, use a card, or stay in jail.</p>
            <div className="flex flex-col gap-2">
              {canPayToLeaveJail && (
                <button
                  onClick={() => jailGuard.submit(handlePayToLeaveJail)}
                  disabled={jailGuard.isSubmitting}
                  className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold border border-cyan-400/30"
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
                  className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold border border-cyan-400/30"
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
                  className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold border border-cyan-400/30"
                >
                  Use Community Chest Get Out of Jail Free
                </button>
              )}
              <button
                onClick={() => jailGuard.submit(handleStayInJail)}
                disabled={jailGuard.isSubmitting}
                className="w-full py-2.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-semibold border border-slate-500/50"
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
        isCurrentPlayerDrawer={cardIsCurrentPlayerDrawer}
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
                    disabled={claimAndLeaveInProgress}
                    className="w-full py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-70 text-slate-900 font-bold"
                  >
                    {claimAndLeaveInProgress ? "Finalizing…" : "Finalize & go home"}
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
                    disabled={claimAndLeaveInProgress}
                    className="w-full py-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-70 text-white font-bold"
                  >
                    {claimAndLeaveInProgress ? "Finalizing…" : "Finalize & go home"}
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
            style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="voted-out-title-mobile"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-800/95 border border-cyan-500/30 rounded-2xl p-6 max-w-sm w-full shadow-xl text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <p id="voted-out-title-mobile" className="text-lg font-semibold text-cyan-100 mb-1">You were voted out</p>
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

      {/* Multiplayer: Tavern chat slide-up panel (mobile) */}
      <AnimatePresence>
        {chatOpen && isLiveGame && isMultiplayer && gameCode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2147483645] flex flex-col bg-black/60 backdrop-blur-sm"
            style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
            onClick={() => setChatOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="flex-1 min-h-0 flex flex-col mt-auto rounded-t-2xl overflow-hidden border-t border-amber-500/30 bg-[#0a1214] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-amber-500/20 bg-gradient-to-r from-amber-950/50 to-amber-900/30">
                <h3 className="font-bold text-amber-100 text-sm uppercase tracking-wide">Tavern Chat</h3>
                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  className="p-2 rounded-lg text-amber-400/80 hover:text-amber-200 hover:bg-amber-500/20 transition-colors"
                  aria-label="Close chat"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <GameyChatRoom gameId={gameCode} me={me} isMobile showHeader={false} />
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
          bottomClass="bottom-24"
        />
      )}

      <Toaster position="top-center" />
    </div>
  );
}

export default function Board3DMobilePage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) {
    return <Board3DMobileLoading />;
  }
  return (
    <Suspense fallback={<Board3DMobileLoading />}>
      <Board3DMobileContent />
    </Suspense>
  );
}
