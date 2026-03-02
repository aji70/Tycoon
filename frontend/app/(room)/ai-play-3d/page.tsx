"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { ApiResponse } from "@/types/api";
import { Game, GameProperty, Player, Property } from "@/types/game";
import { apiClient } from "@/lib/api";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { useMediaQuery } from "@/components/useMediaQuery";
import AiBoard from "@/components/game/ai-board/ai-board";
import GamePlayers from "@/components/game/ai-player/ai-player";
import { useIsRegistered } from "@/context/ContractProvider";
import { Loader2, AlertCircle } from "lucide-react";
import { usePreventDoubleSubmit } from "@/hooks/usePreventDoubleSubmit";

/**
 * AI game on 3D board. Step-by-step minimal flow:
 * - No game code → "Create AI game" (play-ai) or enter code
 * - AI game + code → play on 3D board (AiBoard use3D)
 */
export default function AiPlay3DPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [gameCode, setGameCode] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const { address } = useAccount();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const isGuest = !!guestUser;
  const { data: isUserRegistered, isLoading: isRegisteredLoading } = useIsRegistered(address);

  useEffect(() => {
    const code = searchParams.get("gameCode") || localStorage.getItem("gameCode");
    if (code && code.length === 6) {
      setGameCode(code.trim().toUpperCase());
      localStorage.setItem("gameCode", code.trim().toUpperCase());
    }
  }, [searchParams]);

  // Redirect mobile to the dedicated mobile 3D board as soon as we have a code (so we never show desktop layout)
  useEffect(() => {
    if (isMobile && gameCode && gameCode.length === 6) {
      router.replace(`/board-3d-mobile?gameCode=${encodeURIComponent(gameCode)}`);
    }
  }, [isMobile, gameCode, router]);

  const handleGoWithCode = useCallback(() => {
    const trimmed = codeInput.trim().toUpperCase();
    if (trimmed.length === 6) {
      setGameCode(trimmed);
      localStorage.setItem("gameCode", trimmed);
      router.replace(`/ai-play-3d?gameCode=${encodeURIComponent(trimmed)}`);
    }
  }, [codeInput, router]);

  const {
    data: game,
    isLoading: gameLoading,
    isError: gameError,
    error: gameQueryError,
    refetch: refetchGame,
  } = useQuery<Game>({
    queryKey: ["game", gameCode],
    queryFn: async () => {
      if (!gameCode) throw new Error("No game code");
      const res = await apiClient.get<ApiResponse>(`/games/code/${gameCode}`);
      if (!res.data?.success) throw new Error((res.data as { error?: string })?.error ?? "Game not found");
      return res.data.data;
    },
    enabled: !!gameCode && (isUserRegistered === true || isGuest),
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!game || !gameCode) return;
    if (game.is_ai === false || game.is_ai === undefined) {
      router.replace(`/game-play?gameCode=${encodeURIComponent(gameCode)}`);
    }
  }, [game, gameCode, router]);

  const me = useMemo<Player | null>(() => {
    const myAddress = guestUser?.address ?? address;
    if (!game?.players || !myAddress) return null;
    return game.players.find((pl: Player) => pl.address?.toLowerCase() === myAddress.toLowerCase()) || null;
  }, [game, address, guestUser?.address]);

  const { data: properties = [], isLoading: propertiesLoading } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse>("/properties");
      return res.data?.success ? res.data.data : [];
    },
  });

  const { data: game_properties = [] } = useQuery<GameProperty[]>({
    queryKey: ["game_properties", game?.id],
    queryFn: async () => {
      if (!game?.id) return [];
      const res = await apiClient.get<ApiResponse>(`/game-properties/game/${game.id}`);
      return res.data?.success ? res.data.data : [];
    },
    enabled: !!game?.id,
  });

  const my_properties: Property[] = useMemo(() => {
    const myAddress = guestUser?.address ?? address;
    if (!game_properties.length || !properties.length || !myAddress) return [];
    const propertyMap = new Map(properties.map((p) => [p.id, p]));
    return game_properties
      .filter((gp) => gp.address?.toLowerCase() === myAddress.toLowerCase())
      .map((gp) => propertyMap.get(gp.property_id))
      .filter((p): p is Property => !!p)
      .sort((a, b) => a.id - b.id);
  }, [game_properties, properties, address, guestUser?.address]);

  const currentPlayer = useMemo(() => {
    if (!game?.next_player_id || !game?.players) return null;
    return game.players.find((p) => p.user_id === game.next_player_id) || null;
  }, [game]);

  const isAITurn = useMemo(() => {
    if (!currentPlayer) return false;
    const u = (currentPlayer.username ?? "").toLowerCase();
    return u.includes("ai_") || u.includes("bot") || u.includes("computer");
  }, [currentPlayer]);

  const finishGameByTime = useCallback(async () => {
    if (!game?.id || !game?.is_ai || game?.status !== "RUNNING") return;
    try {
      await apiClient.post(`/games/${game.id}/finish-by-time`);
      await refetchGame();
    } catch (e) {
      console.error(e);
    }
  }, [game?.id, game?.is_ai, game?.status, refetchGame]);

  const finishByTimeGuard = usePreventDoubleSubmit();
  const onFinishGameByTime = useCallback(() => finishByTimeGuard.submit(() => finishGameByTime()), [finishGameByTime, finishByTimeGuard]);

  // Not registered (and not guest)
  if (!isRegisteredLoading && isUserRegistered === false && !isGuest) {
    return (
      <div className="w-full min-h-screen bg-[#010F10] flex flex-col items-center justify-center gap-8 px-8 text-center">
        <AlertCircle className="w-20 h-20 text-red-400" />
        <h2 className="text-3xl font-bold text-white">Registration required</h2>
        <p className="text-gray-300 max-w-md">Register your wallet to play, or continue as guest from the home page.</p>
        <Link href="/" className="px-8 py-4 bg-[#00F0FF] text-[#010F10] font-bold rounded-lg hover:opacity-90">
          Go home
        </Link>
      </div>
    );
  }

  // Mobile with game code: always send to board-3d-mobile (redirect runs in useEffect); never show desktop layout
  if (isMobile && gameCode && gameCode.length === 6) {
    return (
      <div className="w-full min-h-screen bg-[#010F10] flex flex-col items-center justify-center gap-4 text-cyan-300">
        <Loader2 className="w-12 h-12 animate-spin" />
        <p className="text-xl">Opening mobile 3D board…</p>
      </div>
    );
  }

  // No game code: create or enter code
  if (!gameCode) {
    return (
      <div className="w-full min-h-screen bg-[#010F10] flex flex-col items-center justify-center gap-6 p-6 text-white">
        <h1 className="text-2xl font-bold text-cyan-400">Play AI in 3D</h1>
        <p className="text-gray-400 text-center max-w-md">
          Create an AI game, then you’ll be sent here. Or enter a game code if you have one.
        </p>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <Link
            href="/play-ai-3d"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#00FFAA] to-[#00F0FF] text-black font-semibold text-center hover:opacity-90"
          >
            Create AI game
          </Link>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Game code"
              maxLength={6}
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              className="flex-1 px-4 py-3 rounded-lg bg-black/30 border border-cyan-500/50 text-white placeholder-gray-500"
            />
            <button
              onClick={handleGoWithCode}
              disabled={codeInput.trim().length !== 6}
              className="px-4 py-3 rounded-lg bg-cyan-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Go
            </button>
          </div>
        </div>
        <Link href="/" className="text-sm text-gray-500 hover:text-cyan-400 mt-4">
          Back to home
        </Link>
      </div>
    );
  }

  if (isRegisteredLoading || gameLoading || propertiesLoading) {
    return (
      <div className="w-full min-h-screen bg-[#010F10] flex flex-col items-center justify-center gap-4 text-cyan-300">
        <Loader2 className="w-12 h-12 animate-spin" />
        <p className="text-xl">Loading game...</p>
      </div>
    );
  }

  if (gameError || !game) {
    return (
      <div className="w-full min-h-screen bg-[#010F10] flex flex-col items-center justify-center gap-6 p-6 text-center text-white">
        <p className="text-red-400">{gameQueryError?.message ?? "Game not found"}</p>
        <div className="flex gap-4">
          <button onClick={() => { setGameCode(""); setCodeInput(""); }} className="px-6 py-3 rounded-lg bg-cyan-600 text-white font-semibold">
            Enter another code
          </button>
          <Link href="/play-ai" className="px-6 py-3 rounded-lg border border-cyan-500/50 text-cyan-300 font-semibold">
            Create AI game
          </Link>
        </div>
        <Link href="/" className="text-sm text-gray-500 hover:text-cyan-400 mt-4">Back to home</Link>
      </div>
    );
  }

  if (game.is_ai === false || game.is_ai === undefined) {
    return (
      <div className="w-full min-h-screen bg-[#010F10] flex items-center justify-center text-cyan-300">
        <Loader2 className="w-12 h-12 animate-spin" />
        <p className="ml-4">Redirecting...</p>
      </div>
    );
  }

  // AI game: 3D board (desktop only; mobile is redirected above)
  return (
    <main className="w-full h-screen overflow-hidden relative flex flex-row bg-[#010F10] lg:gap-4 p-4">
      <div className="hidden lg:block w-80 flex-shrink-0">
        <GamePlayers
          game={game}
          properties={properties}
          game_properties={game_properties}
          my_properties={my_properties}
          me={me}
          currentPlayer={currentPlayer}
          roll={null}
          isAITurn={isAITurn}
          focusTrades={false}
          onViewedTrades={() => {}}
          isGuest={isGuest}
        />
      </div>
      <div className="flex-1 min-w-0">
        <AiBoard
          game={game}
          properties={properties}
          game_properties={game_properties}
          me={me}
          isGuest={isGuest}
          onFinishGameByTime={onFinishGameByTime}
          onViewTrades={() => {}}
          onRefetchGame={async () => { await refetchGame(); }}
        />
      </div>
      <Link
        href={`/ai-play?gameCode=${encodeURIComponent(gameCode)}`}
        className="absolute top-2 right-2 z-10 px-3 py-1.5 rounded-lg bg-slate-800/90 text-cyan-300 text-sm border border-cyan-500/50 hover:bg-slate-700"
      >
        2D board
      </Link>
    </main>
  );
}
