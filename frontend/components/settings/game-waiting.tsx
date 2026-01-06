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
import { FaXTwitter, FaCoins } from "react-icons/fa6";
import { SiFarcaster } from "react-icons/si";
import { IoCopyOutline, IoHomeOutline } from "react-icons/io5";
import { useAccount } from "wagmi";
import {
  useGetUsername,
  useJoinGame,
  useGetGameByCode,
} from "@/context/ContractProvider";
import { apiClient } from "@/lib/api";
import { Game } from "@/lib/types/games";
import { getPlayerSymbolData, PlayerSymbol, symbols } from "@/lib/types/symbol";
import { ApiResponse } from "@/types/api";

const POLL_INTERVAL = 5000; // ms
const COPY_FEEDBACK_MS = 2000;

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
  const [copySuccessFarcaster, setCopySuccessFarcaster] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Contract hooks
   const {
    data: contractGame,
    isLoading: contractGameLoading,
    error: contractGameError,
  } = useGetGameByCode(gameCode, { enabled: !!gameCode });

  const contractId = contractGame?.id ?? null;
  const { data: username } = useGetUsername(address);

  const {
    write: joinGame,
    isPending: isJoining,
    error: joinError,
  } = useJoinGame(
    contractId ? BigInt(contractId) : BigInt(0),
    username ?? "",
    playerSymbol?.value ?? "",
    gameCode,
    contractGame?.stakePerPlayer ? BigInt(contractGame.stakePerPlayer) : BigInt(0) // ← Pass stakePerPlayer to join game
  );


  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Safe origin for SSR
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

  const farcasterMiniappUrl = useMemo(
    () =>
      `https://farcaster.xyz/miniapps/bylqDd2BdAR5/tycoon/game-waiting?gameCode=${encodeURIComponent(gameCode)}`,
    [gameCode]
  );

  const shareText = useMemo(
    () =>
      `Join my Tycoon game! Code: ${gameCode}. Waiting room: ${gameUrl}`,
    [gameCode, gameUrl]
  );

  const farcasterShareText = useMemo(
    () => `Join my Tycoon game! Code: ${gameCode}.`,
    [gameCode]
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

  const farcasterShareUrl = useMemo(
    () =>
      `https://warpcast.com/~/compose?text=${encodeURIComponent(farcasterShareText)}&embeds[]=${encodeURIComponent(farcasterMiniappUrl)}`,
    [farcasterShareText, farcasterMiniappUrl]
  );

  // Helpers
  const computeAvailableSymbols = useCallback((g: Game | null) => {
    if (!g) return symbols;
    const taken = new Set(g.players.map((p) => p.symbol));
    return symbols.filter((s) => !taken.has(s.value));
  }, []);

  const checkPlayerJoined = useCallback(
    (g: Game | null) => {
      if (!g || !address) return false;
      return g.players.some(
        (p) => p.address.toLowerCase() === address.toLowerCase()
      );
    },
    [address]
  );

  // Determine if current user is the creator
  const isCreator = useMemo(() => {
    if (!game || !address) return false;
    return address.toLowerCase() === String(contractGame?.creator).toLowerCase();
  }, [game, address]);

  // Show share section if there are open slots OR if user is the creator
  const showShare = useMemo(() => {
    if (!game) return false;
    return game.players.length < game.number_of_players || isCreator;
  }, [game, isCreator]);

  // Copy handlers with fallback
  const handleCopyLink = useCallback(async () => {
    if (!gameUrl) {
      setError("No shareable URL available.");
      return;
    }
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

  const handleCopyFarcasterLink = useCallback(async () => {
    if (!farcasterMiniappUrl) {
      setError("No shareable Farcaster URL available.");
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(farcasterMiniappUrl);
      } else {
        // fallback
        const el = document.createElement("textarea");
        el.value = farcasterMiniappUrl;
        el.setAttribute("readonly", "");
        el.style.position = "absolute";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopySuccessFarcaster("Farcaster link copied!");
      setTimeout(() => setCopySuccessFarcaster(null), COPY_FEEDBACK_MS);
    } catch (err) {
      console.error("copy farcaster failed", err);
      setError("Failed to copy Farcaster link. Try manually selecting the text.");
    }
  }, [farcasterMiniappUrl]);

  // Polling effect
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
        const res = await apiClient.get<ApiResponse>(
          `/games/code/${encodeURIComponent(gameCode)}`
        );

        if (!mountedRef.current) return;

        if (!res?.data?.success || !res?.data?.data) {
          throw new Error(`Game ${gameCode} not found`);
        }

        const gameData = res.data.data;

        if (gameData.status === "RUNNING") {
          router.push(`/game-play?gameCode=${encodeURIComponent(gameCode)}`);
          return;
        }

        if (gameData.status !== "PENDING") {
          throw new Error(`Game ${gameCode} is not open for joining.`);
        }

        setGame(gameData);
        setAvailableSymbols(computeAvailableSymbols(gameData));
        setIsJoined(checkPlayerJoined(gameData));

        if (gameData.players.length === gameData.number_of_players) {
          const updateRes = await apiClient.put<ApiResponse>(
            `/games/${gameData.id}`,
            { status: "RUNNING" }
          );
          if (updateRes?.data?.success)
            router.push(`/game-play?gameCode=${gameCode}`);
        }
      } catch (err: any) {
        if (!mountedRef.current) return;
        if (err?.name === "AbortError") return;
        console.error("fetchGame error:", err);
        setError(err?.message ?? "Failed to fetch game data. Please try again.");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    const startPolling = async () => {
      await fetchOnce();
      const tick = async () => {
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

  const playersJoined =
    contractGame?.joinedPlayers ? Number(contractGame.joinedPlayers) : (game?.players.length ?? 0);
  const maxPlayers =
    contractGame?.numberOfPlayers ? Number(contractGame.numberOfPlayers) : (game?.number_of_players ?? 0);
  const stakePerPlayer = contractGame?.stakePerPlayer ? Number(contractGame.stakePerPlayer) : 0; 

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
      if (joinGame) {
        await joinGame();
      }

      const res = await apiClient.post<ApiResponse>("/game-players/join", {
        address,
        symbol: playerSymbol.value,
        code: game.code,
      });

      if (res?.data?.success === false) {
        throw new Error(res?.data?.message ?? "Failed to join game");
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
      const res = await apiClient.post<ApiResponse>("/game-players/leave", {
        address,
        code: game.code,
      });
      if (res?.data?.success === false)
        throw new Error(res?.data?.message ?? "Failed to leave game");
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

  // Loading / Error guards
  if (loading || contractGameLoading) {
    return (
      <section className="w-full h-[calc(100dvh-87px)] flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-t-3 border-[#00F0FF] border-opacity-50"></div>
          <p className="text-[#00F0FF] text-lg font-semibold font-orbitron animate-pulse">
            Entering the Lobby...
          </p>
        </div>
      </section>
    );
  }

  if (error || !game) {
    return (
      <section className="w-full h-[calc(100dvh-87px)] flex items-center justify-center bg-gray-900">
        <div className="space-y-3 text-center bg-[#0A1A1B]/80 p-6 rounded-xl shadow-lg border border-red-500/50">
          <p className="text-red-400 text-lg font-bold font-orbitron animate-pulse">
            {error ?? "Game Portal Closed"}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => router.push("/join-room")}
              className="bg-[#00F0FF]/20 text-[#00F0FF] px-5 py-2 rounded-lg font-orbitron font-bold border border-[#00F0FF]/50 hover:bg-[#00F0FF]/30 transition-all shadow-md hover:shadow-[#00F0FF]/50"
            >
              Retry Join
            </button>
            <button
              type="button"
              onClick={handleGoHome}
              className="bg-[#00F0FF]/20 text-[#00F0FF] px-5 py-2 rounded-lg font-orbitron font-bold border border-[#00F0FF]/50 hover:bg-[#00F0FF]/30 transition-all shadow-md hover:shadow-[#00F0FF]/50"
            >
              Return to Base
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full h-[calc(100dvh-87px)] bg-settings bg-cover bg-fixed bg-center">
      <main className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#010F10]/90 to-[#010F10]/50 px-4 sm:px-6">
        <div className="w-full max-w-xl bg-[#0A1A1B]/80 p-5 sm:p-6 rounded-2xl shadow-2xl border border-[#00F0FF]/50 backdrop-blur-md">
          <h2 className="text-2xl sm:text-3xl font-bold font-orbitron mb-6 text-[#F0F7F7] text-center tracking-widest bg-gradient-to-r from-[#00F0FF] to-[#FF00FF] bg-clip-text text-transparent animate-pulse">
            Tycoon Lobby
            <span className="block text-base text-[#00F0FF] mt-1 font-extrabold shadow-text">
              Code: {gameCode}
            </span>
          </h2>

          <div className="text-center space-y-3 mb-6">
            <p className="text-[#869298] text-sm font-semibold">
              {playersJoined === maxPlayers
                ? "Full House! Game Starting Soon..."
                : "Assemble Your Rivals..."}
            </p>
            <div className="w-full bg-[#003B3E]/50 h-2 rounded-full overflow-hidden shadow-inner">
              <div
                className="bg-gradient-to-r from-[#00F0FF] to-[#00FFAA] h-full transition-all duration-500 ease-out"
                style={{ width: `${(playersJoined / maxPlayers) * 100}%` }}
              ></div>
            </div>
            <p className="text-[#00F0FF] text-lg font-bold">
              Players Ready: {playersJoined}/{maxPlayers}
            </p>
            {stakePerPlayer > 0 ? (
              <p className="text-yellow-400 text-lg font-bold flex items-center justify-center gap-2 animate-pulse">
                <FaCoins className="w-6 h-6" />
                Entry Stake: {stakePerPlayer}
                WEI
              </p>
            ) : (
              <p className="text-green-400 text-base font-bold">
                Free Practice Game – No Stake Required
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 justify-center">
              {Array.from({ length: maxPlayers }).map((_, index) => {
                const player = game.players[index];
                return (
                  <div
                    key={index}
                    className="bg-[#010F10]/70 p-3 rounded-lg border border-[#00F0FF]/30 flex flex-col items-center justify-center shadow-md hover:shadow-[#00F0FF]/50 transition-shadow duration-300"
                  >
                    <span className="text-4xl mb-1 animate-bounce-slow">
                      {player
                        ? symbols.find((s) => s.value === player.symbol)?.emoji
                        : "❓"}
                    </span>
                    <p className="text-[#F0F7F7] text-xs font-semibold truncate max-w-[80px]">
                      {player?.username || "Slot Open"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {showShare && (
            <div className="mt-6 space-y-5 bg-[#010F10]/50 p-5 rounded-xl border border-[#00F0FF]/30 shadow-lg">
              <h3 className="text-lg font-bold text-[#00F0FF] text-center mb-3">
                Summon Allies!
              </h3>

              {/* Web Link */}
              <div className="space-y-2">
                <p className="text-[#869298] text-xs text-center">Web Link</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    aria-label="game url"
                    value={gameUrl}
                    readOnly
                    className="w-full bg-[#0A1A1B] text-[#F0F7F7] p-2 rounded-lg border border-[#00F0FF]/50 focus:outline-none focus:ring-2 focus:ring-[#00F0FF] font-orbitron text-xs shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    disabled={actionLoading}
                    className="flex items-center justify-center bg-gradient-to-r from-[#00F0FF] to-[#00FFAA] text-black p-2 rounded-lg hover:opacity-90 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105"
                  >
                    <IoCopyOutline className="w-5 h-5" />
                  </button>
                </div>
                {copySuccess && (
                  <p className="text-green-400 text-xs text-center animate-fade-in">
                    {copySuccess}
                  </p>
                )}
              </div>

              {/* Farcaster Miniapp Link */}
              <div className="space-y-2">
                <p className="text-[#869298] text-xs text-center">Farcaster Miniapp Link</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    aria-label="farcaster miniapp url"
                    value={farcasterMiniappUrl}
                    readOnly
                    className="w-full bg-[#0A1A1B] text-[#F0F7F7] p-2 rounded-lg border border-[#00F0FF]/50 focus:outline-none focus:ring-2 focus:ring-[#00F0FF] font-orbitron text-xs shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={handleCopyFarcasterLink}
                    disabled={actionLoading}
                    className="flex items-center justify-center bg-gradient-to-r from-[#A100FF] to-[#00F0FF] text-white p-2 rounded-lg hover:opacity-90 transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105"
                  >
                    <IoCopyOutline className="w-5 h-5" />
                  </button>
                </div>
                {copySuccessFarcaster && (
                  <p className="text-green-400 text-xs text-center animate-fade-in">
                    {copySuccessFarcaster}
                  </p>
                )}
              </div>

              {/* Social share buttons */}
              <div className="flex justify-center gap-5 pt-3">
                <a
                  href={telegramShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] p-3 rounded-full border border-[#00F0FF]/50 hover:bg-[#00F0FF]/20 transition-all duration-300 shadow-md hover:shadow-[#00F0FF]/50 transform hover:scale-110"
                >
                  <PiTelegramLogoLight className="w-6 h-6" />
                </a>
                <a
                  href={twitterShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] p-3 rounded-full border border-[#00F0FF]/50 hover:bg-[#00F0FF]/20 transition-all duration-300 shadow-md hover:shadow-[#00F0FF]/50 transform hover:scale-110"
                >
                  <FaXTwitter className="w-6 h-6" />
                </a>
                <a
                  href={farcasterShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center bg-[#0A1A1B] text-[#0FF0FC] p-3 rounded-full border border-[#00F0FF]/50 hover:bg-[#00F0FF]/20 transition-all duration-300 shadow-md hover:shadow-[#00F0FF]/50 transform hover:scale-110"
                >
                  <SiFarcaster className="w-6 h-6" />
                </a>
              </div>
            </div>
          )}

          {game.players.length < game.number_of_players && !isJoined && (
            <div className="mt-6 space-y-5">
              <div className="flex flex-col bg-[#010F10]/50 p-5 rounded-xl border border-[#00F0FF]/30 shadow-lg">
                <label
                  htmlFor="symbol"
                  className="text-sm text-[#00F0FF] mb-1 font-orbitron font-bold"
                >
                  Pick Your Token
                </label>
                <select
                  id="symbol"
                  value={playerSymbol?.value ?? ""}
                  onChange={(e) =>
                    setPlayerSymbol(getPlayerSymbolData(e.target.value) ?? null)
                  }
                  className="bg-[#0A1A1B] text-[#F0F7F7] p-2 rounded-lg border border-[#00F0FF]/50 focus:outline-none focus:ring-2 focus:ring-[#00F0FF] font-orbitron text-sm shadow-inner"
                >
                  <option value="" disabled>
                    Select Token
                  </option>
                  {availableSymbols.length > 0 ? (
                    availableSymbols.map((symbol) => (
                      <option key={symbol.value} value={symbol.value}>
                        {symbol.emoji} {symbol.name}
                      </option>
                    ))
                  ) : (
                    <option disabled>No Tokens Left</option>
                  )}
                </select>
              </div>

              <button
                type="button"
                onClick={handleJoinGame}
                className="w-full bg-gradient-to-r from-[#00F0FF] to-[#FF00FF] text-black text-sm font-orbitron font-extrabold py-3 rounded-xl hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-[#00F0FF]/50 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!playerSymbol || actionLoading || isJoining}
              >
                {actionLoading || isJoining ? "Entering..." : "Join the Battle"}
              </button>
            </div>
          )}

          {game.players.length < game.number_of_players && isJoined && (
            <button
              type="button"
              onClick={handleLeaveGame}
              className="w-full mt-6 bg-gradient-to-r from-[#FF4D4D] to-[#FF00AA] text-white text-sm font-orbitron font-extrabold py-3 rounded-xl hover:opacity-90 transition-all duration-300 shadow-lg hover:shadow-red-500/50 transform hover:scale-105 disabled:opacity-50"
              disabled={actionLoading}
            >
              {actionLoading ? "Exiting..." : "Abandon Ship"}
            </button>
          )}

          <div className="flex justify-between mt-5 px-3">
            <button
              type="button"
              onClick={() => router.push("/join-room")}
              className="text-[#0FF0FC] text-sm font-orbitron hover:text-[#00D4E6] transition-colors duration-200 hover:underline"
            >
              Switch Portal
            </button>
            <button
              type="button"
              onClick={handleGoHome}
              className="flex items-center text-[#0FF0FC] text-sm font-orbitron hover:text-[#00D4E6] transition-colors duration-200 hover:underline"
            >
              <IoHomeOutline className="mr-1 w-4 h-4" />
              Back to HQ
            </button>
          </div>

          {(error || joinError || contractGameError) && (
            <p className="text-red-400 text-xs mt-3 text-center bg-red-900/50 p-2 rounded-lg animate-pulse">
              {error ??
                joinError?.message ??
                contractGameError?.message ??
                "System Glitch Detected"}
            </p>
          )}
        </div>
      </main>
    </section>
  );
}