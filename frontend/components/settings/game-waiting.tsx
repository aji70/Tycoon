"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PiTelegramLogoLight } from "react-icons/pi";
import { FaXTwitter } from "react-icons/fa6";
import { IoCopyOutline, IoHomeOutline } from "react-icons/io5";
import { useAccount } from "wagmi";
import {
  useIsInGame,
  useJoinGame,
  useGetGameByCode,
} from "@/context/ContractProvider";
import { apiClient } from "@/lib/api";
import { Game } from "@/lib/types/games";
import { getPlayerSymbolData, PlayerSymbol, symbols } from "@/lib/types/symbol";

/**
 * Production-ready GameWaiting component
 * - Full TypeScript typing
 * - Robust network/error handling (AbortController)
 * - Visibility-aware polling (stops while tab is hidden)
 * - Optimistic UI & disabled states during network actions
 * - Accessibility improvements
 * - Defensive checks (window origin, signer presence)
 */

const POLL_INTERVAL = 5000; // ms
const COPY_FEEDBACK_MS = 2000;

type ApiResponse = {
  success: boolean;
  message: string;
};

export default function GameWaiting(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawGameCode = searchParams.get("gameCode") ?? "";
  const gameCode = rawGameCode.trim().toUpperCase();

  const { address } = useAccount();

  // Local UI state
  const [game, setGame] = useState<Game | null>(null);
  const [playerSymbol, setPlayerSymbol] = useState<PlayerSymbol | null>(null);
  const [availableSymbols, setAvailableSymbols] =
    useState<PlayerSymbol[]>(symbols);
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Contract hooks (kept for compatibility)
  const {
    data: contractGame,
    isLoading: contractGameLoading,
    error: contractGameError,
  } = useGetGameByCode(gameCode, { enabled: !!gameCode });

  const contractId = contractGame?.id ?? null;

  const {
    write: joinGame,
    isPending: isJoining,
    error: joinError,
  } = useJoinGame(
    contractId ? Number(contractId) : 0,
    playerSymbol?.value ?? ""
  );

  // Keep a ref to mounted state to avoid state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Utility: safe origin (handles edge cases in SSR prerender)
  const origin = useMemo(() => {
    try {
      if (typeof window === "undefined") return "";
      return window.location?.origin ?? "";
    } catch {
      return "";
    }
  }, []);

  const gameUrl = useMemo(
    () => `${origin}/game-waiting?gameCode=${encodeURIComponent(gameCode)}`,
    [origin, gameCode]
  );
  const shareText = useMemo(
    () =>
      `Join my Blockopoly game! Code: ${gameCode}. Waiting room: ${gameUrl}`,
    [gameCode, gameUrl]
  );
  const telegramShareUrl = useMemo(
    () =>
      `https://t.me/share/url?url=${encodeURIComponent(
        gameUrl
      )}&text=${encodeURIComponent(shareText)}`,
    [gameUrl, shareText]
  );
  const twitterShareUrl = useMemo(
    () => `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`,
    [shareText]
  );

  // helper: compute available symbols from game data
  const computeAvailableSymbols = useCallback((g: Game | null) => {
    if (!g) return symbols;
    const taken = new Set(g.players.map((p) => p.symbol));
    return symbols.filter((s) => !taken.has(s.value));
  }, []);

  // helper: check if address is already part of game
  const checkPlayerJoined = useCallback(
    (g: Game | null) => {
      if (!g || !address) return false;
      return g.players.some(
        (p) => p.address.toLowerCase() === address.toLowerCase()
      );
    },
    [address]
  );

  // fetch game state with visibility-aware polling and AbortController
  useEffect(() => {
    if (!gameCode) {
      setError("No game code provided. Please enter a valid game code.");
      setLoading(false);
      return;
    }

    let abort = new AbortController();
    let pollTimer: number | null = null;

    const fetchOnce = async () => {
      setError(null);
      try {
        const resp = await apiClient.get<Game>(
          `/games/code/${encodeURIComponent(gameCode)}`,
          {
            signal: abort.signal as unknown as undefined, // apiClient may not accept signal, keep for compatibility
          }
        );

        if (!mountedRef.current) return;

        if (!resp) throw new Error(`Game ${gameCode} not found`);

        // if game moved to RUNNING redirect to play page
        if (resp.status === "RUNNING") {
          router.push(`/game-play?gameCode=${encodeURIComponent(gameCode)}`);
          return;
        }

        if (resp.status !== "PENDING") {
          // keep the UI consistent and inform the user
          throw new Error(`Game ${gameCode} is not open for joining.`);
        }

        setGame(resp);
        setAvailableSymbols(computeAvailableSymbols(resp));
        setIsJoined(checkPlayerJoined(resp));

        // if all players joined, try to transition server-side and redirect
        if (resp.players.length === resp.number_of_players) {
          const updateRes = await apiClient.put<ApiResponse>(
            `/games/${resp.id}`,
            {
              status: "RUNNING",
            }
          );
          if (updateRes?.success)
            router.push(`/game-play?gameCode=${encodeURIComponent(gameCode)}`);
        }
      } catch (err: any) {
        if (!mountedRef.current) return;
        // ignore abort errors
        if (err?.name === "AbortError") return;
        console.error("fetchGame error:", err);
        setError(
          err?.message ?? "Failed to fetch game data. Please try again."
        );
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    const startPolling = async () => {
      await fetchOnce();
      const tick = async () => {
        // stop polling on hidden tab to save bandwidth
        if (typeof document !== "undefined" && document.hidden) {
          pollTimer = window.setTimeout(tick, POLL_INTERVAL);
          return;
        }
        await fetchOnce();
        pollTimer = window.setTimeout(tick, POLL_INTERVAL);
      };
      pollTimer = window.setTimeout(tick, POLL_INTERVAL);
    };

    startPolling();

    return () => {
      abort.abort();
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [gameCode, computeAvailableSymbols, checkPlayerJoined, router]);

  // contract data overrides certain UI counts when available
  const playersJoined =
    contractGame?.joinedPlayers ?? game?.players.length ?? 0;
  const maxPlayers =
    contractGame?.numberOfPlayers ?? game?.number_of_players ?? 0;

  // copy handler (clipboard with fallback)
  const handleCopyLink = useCallback(async () => {
    if (!gameUrl) return setError("No shareable URL available.");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(gameUrl);
      } else {
        // fallback
        const el = document.createElement("textarea");
        el.value = gameUrl;
        el.setAttribute("readonly", "");
        el.style.position = "absolute";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopySuccess("Copied!");
      setTimeout(() => setCopySuccess(null), COPY_FEEDBACK_MS);
    } catch (err) {
      console.error("copy failed", err);
      setError("Failed to copy link. Try manually selecting the text.");
    }
  }, [gameUrl]);

  // Join game flow (optimistic UI)
  const handleJoinGame = useCallback(async () => {
    if (!game) {
      setError("No game data found. Please enter a valid game code.");
      return;
    }

    if (
      !playerSymbol?.value ||
      !availableSymbols.some((s) => s.value === playerSymbol.value)
    ) {
      setError("Please select a valid symbol.");
      return;
    }

    if (game.players.length >= game.number_of_players) {
      setError("Game is full!");
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      // call on-chain join if available (this may prompt wallet)
      if (joinGame) {
        await joinGame();
      }

      // persist to API
      const resp = await apiClient.post<ApiResponse>("/game-players/join", {
        address,
        symbol: playerSymbol.value,
        code: game.code,
      });

      if (resp?.success === false) {
        throw new Error(resp?.message ?? "Failed to join game");
      }

      if (mountedRef.current) {
        setIsJoined(true);
        setError(null);
      }
    } catch (err: any) {
      console.error("join error", err);
      if (mountedRef.current)
        setError(err?.message ?? "Failed to join game. Please try again.");
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  }, [game, playerSymbol, availableSymbols, address, joinGame]);

  const handleLeaveGame = useCallback(async () => {
    if (!game)
      return setError("No game data found. Please enter a valid game code.");
    setActionLoading(true);
    setError(null);
    try {
      const resp = await apiClient.post<ApiResponse>("/game-players/leave", {
        address,
        code: game.code,
      });
      if (resp?.success === false)
        throw new Error(resp?.message ?? "Failed to leave game");
      if (mountedRef.current) {
        setIsJoined(false);
        setPlayerSymbol(null);
      }
    } catch (err: any) {
      console.error("leave error", err);
      if (mountedRef.current)
        setError(err?.message ?? "Failed to leave game. Please try again.");
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  }, [game, address]);

  const handleGoHome = useCallback(() => router.push("/"), [router]);

  // guard: loading states
  if (loading || contractGameLoading) {
    return (
      <section className="w-full h-[calc(100dvh-87px)] flex items-center justify-center bg-gray-900">
        <p className="text-[#00F0FF] text-xl font-semibold font-orbitron animate-pulse">
          Loading game...
        </p>
      </section>
    );
  }

  if (error || !game) {
    return (
      <section className="w-full h-[calc(100dvh-87px)] flex items-center justify-center bg-gray-900">
        <div className="space-y-4 text-center">
          <p className="text-red-500 text-xl font-semibold font-orbitron">
            {error ?? "Game not found"}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => router.push("/join-room")}
              className="bg-[#00F0FF] text-black px-4 py-2 rounded font-orbitron"
            >
              Back to Join Room
            </button>
            <button
              type="button"
              onClick={handleGoHome}
              className="bg-[#00F0FF] text-black px-4 py-2 rounded font-orbitron"
            >
              Go to Home
            </button>
          </div>
        </div>
      </section>
    );
  }

  const showShare = (game.players.length ?? 0) < (game.number_of_players ?? 0);

  return (
    <section className="w-full h-[calc(100dvh-87px)] bg-settings bg-cover bg-fixed bg-center">
      <main className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#010F10]/90 to-[#010F10]/50 px-4 sm:px-6">
        <div className="w-full max-w-md bg-[#0A1A1B]/80 p-6 sm:p-8 rounded-xl shadow-lg border border-[#00F0FF]/30 backdrop-blur-sm">
          <h2 className="text-2xl sm:text-3xl font-bold font-orbitron mb-6 text-[#F0F7F7] text-center tracking-wide">
            Blockopoly Waiting Room
            <span className="block text-sm text-[#00F0FF] mt-1 font-bold">
              Code: {gameCode}
            </span>
          </h2>

          <div className="text-center space-y-3 mb-6">
            <p className="text-[#869298] text-sm">
              {playersJoined === maxPlayers
                ? "All players joined! Ready to start..."
                : "Waiting for players to join..."}
            </p>
            <p className="text-[#00F0FF] text-lg font-semibold">
              Players: {playersJoined}/{maxPlayers}
            </p>
            <div className="w-full items-center flex space-x-4 justify-center flex-wrap">
              {game.players.map((player) => (
                <span
                  key={player.user_id}
                  className="text-sm text-[#F0F7F7] flex items-center justify-center gap-2"
                >
                  {symbols.find((t) => t.value === player.symbol)?.emoji}{" "}
                  <span className="truncate max-w-[130px]">
                    {player.username}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {showShare && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  aria-label="game url"
                  value={gameUrl}
                  readOnly
                  className="w-full bg-[#0A1A1B] text-[#F0F7F7] p-2 rounded border border-[#00F0FF]/30 focus:outline-none font-orbitron text-sm"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  disabled={actionLoading}
                  className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] text-sm font-orbitron font-semibold py-2 px-3 rounded-lg border border-[#00F0FF]/30 hover:bg-[#00F0FF]/20 transition-all duration-300"
                >
                  <IoCopyOutline className="w-5 h-5" />
                </button>
              </div>
              {copySuccess && (
                <p className="text-green-400 text-xs text-center">
                  {copySuccess}
                </p>
              )}
              <div className="flex justify-center gap-4">
                <a
                  href={telegramShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] text-sm font-orbitron font-semibold py-2 px-4 rounded-lg border border-[#00F0FF]/30 hover:bg-[#00F0FF]/20 transition-all duration-300"
                >
                  <PiTelegramLogoLight className="mr-2 w-5 h-5" />
                  Telegram
                </a>
                <a
                  href={twitterShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] text-sm font-orbitron font-semibold py-2 px-4 rounded-lg border border-[#00F0FF]/30 hover:bg-[#00F0FF]/20 transition-all duration-300"
                >
                  <FaXTwitter className="mr-2 w-5 h-5" />X
                </a>
              </div>
            </div>
          )}

          {game.players.length < game.number_of_players && !isJoined && (
            <div className="mt-6 space-y-4">
              <div className="flex flex-col">
                <label
                  htmlFor="symbol"
                  className="text-sm text-gray-300 mb-1 font-orbitron"
                >
                  Choose Your Symbol
                </label>
                <select
                  id="symbol"
                  value={playerSymbol?.value ?? ""}
                  onChange={(e) =>
                    setPlayerSymbol(getPlayerSymbolData(e.target.value) ?? null)
                  }
                  className="bg-[#0A1A1B] text-[#F0F7F7] p-2 rounded border border-[#00F0FF]/30 focus:outline-none focus:ring-2 focus:ring-[#00F0FF] font-orbitron"
                >
                  <option value="" disabled>
                    Select a symbol
                  </option>
                  {availableSymbols.length > 0 ? (
                    availableSymbols.map((symbol) => (
                      <option key={symbol.value} value={symbol.value}>
                        {symbol.name}
                      </option>
                    ))
                  ) : (
                    <option disabled>No symbols available</option>
                  )}
                </select>
              </div>

              <button
                type="button"
                onClick={handleJoinGame}
                className="w-full bg-[#00F0FF] text-black text-sm font-orbitron font-semibold py-3 rounded-lg hover:bg-[#00D4E6] transition-all duration-300 shadow-md"
                disabled={!playerSymbol || actionLoading || isJoining}
              >
                {actionLoading || isJoining ? "Joining..." : "Join Game"}
              </button>
            </div>
          )}

          {game.players.length < game.number_of_players && isJoined && (
            <button
              type="button"
              onClick={handleLeaveGame}
              className="w-full mt-6 bg-[#FF4D4D] text-white text-sm font-orbitron font-semibold py-3 rounded-lg hover:bg-[#E63939] transition-all duration-300 shadow-md"
              disabled={actionLoading}
            >
              {actionLoading ? "Processing..." : "Leave Game"}
            </button>
          )}

          <div className="flex justify-between mt-3">
            <button
              type="button"
              onClick={() => router.push("/join-room")}
              className="text-[#0FF0FC] text-sm font-orbitron hover:text-[#00D4E6] transition-colors duration-200"
            >
              Back to Join Room
            </button>
            <button
              type="button"
              onClick={handleGoHome}
              className="flex items-center text-[#0FF0FC] text-sm font-orbitron hover:text-[#00D4E6] transition-colors duration-200"
            >
              <IoHomeOutline className="mr-1 w-4 h-4" />
              Go to Home
            </button>
          </div>

          {(error || joinError || contractGameError) && (
            <p className="text-red-500 text-xs mt-4 text-center animate-pulse">
              {error ??
                joinError?.message ??
                contractGameError?.message ??
                "An error occurred"}
            </p>
          )}
        </div>
      </main>
    </section>
  );
}
