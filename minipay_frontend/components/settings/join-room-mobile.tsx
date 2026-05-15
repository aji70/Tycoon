"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";
import { Game } from "@/lib/types/games";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { usePreventDoubleSubmit } from "@/hooks/usePreventDoubleSubmit";
import { SkeletonGameGrid } from "@/components/ui/SkeletonCard";
import { JoinRoomAuthModal, JoinRoomAuthStickyBar } from "@/components/settings/join-room-auth-ui";
import { useJoinRoomAuthContinuation } from "@/components/settings/useJoinRoomAuthContinuation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

interface JoinRoomMobileProps {
  /** When game is RUNNING, redirect here (default: /board-3d-multi-mobile). */
  redirectToBoard?: string;
  /** When game is PENDING, redirect to this waiting room (default: /game-waiting-3d). */
  redirectToWaiting?: string;
  /** "Create new game" link (default: /game-settings-3d). */
  redirectCreateNew?: string;
}

export default function JoinRoom({
  redirectToBoard = "/board-3d-multi-mobile",
  redirectToWaiting = "/game-waiting-3d",
  redirectCreateNew = "/game-settings-3d",
}: JoinRoomMobileProps = {}): JSX.Element {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const authLoading = guestAuth?.isLoading ?? true;
  const canAct = isConnected || !!guestUser;
  const { modalOpen, modalHint, queueAfterAuth, cancelModal } = useJoinRoomAuthContinuation(canAct);

  const [code, setCode] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [allPendingGames, setAllPendingGames] = useState<Game[]>([]);
  const [pendingGames, setPendingGames] = useState<Game[]>([]);
  const [fetchingRecent, setFetchingRecent] = useState<boolean>(true);
  const [fetchingPending, setFetchingPending] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<number>(5 * 60 * 1000); // Default: last 5 minutes in ms
  const joinByCodeGuard = usePreventDoubleSubmit();

  // Time filter options - prioritize recent games
  const timeOptions = [
    { label: "Last 5 minutes", value: 5 * 60 * 1000 },
    { label: "Last 10 minutes", value: 10 * 60 * 1000 },
    { label: "Last 30 minutes", value: 30 * 60 * 1000 },
    { label: "Last hour", value: 60 * 60 * 1000 },
    { label: "All pending", value: Infinity },
  ];

  // Uppercase and trim code input
  const normalizedCode = useMemo(() => code.trim().toUpperCase(), [code]);

  const fetchGames = useCallback(async () => {
    const addr = address ?? guestUser?.address;
    if (!canAct || !addr) {
      setFetchingRecent(false);
      setFetchingPending(false);
      return;
    }
    setFetchError(null);
    setFetchingRecent(true);
    setFetchingPending(true);

    let recentFailed = false;
    let pendingFailed = false;

    try {
      const resRecent = await apiClient.get<ApiResponse>("/games/my-games", {
        params: { address: addr },
      });
      if (resRecent?.data?.success && Array.isArray(resRecent.data.data)) {
        setRecentGames(resRecent.data.data as Game[]);
      }
    } catch (err) {
      console.error("Failed to fetch recent games:", err);
      recentFailed = true;
    } finally {
      setFetchingRecent(false);
    }

    try {
      const resPending = await apiClient.get<ApiResponse>("/games/open");
      if (resPending?.data?.success && Array.isArray(resPending.data.data)) {
        setAllPendingGames(resPending.data.data as Game[]);
      }
    } catch (err) {
      console.error("Failed to fetch open games:", err);
      pendingFailed = true;
    } finally {
      setFetchingPending(false);
    }

    if (recentFailed || pendingFailed) {
      setFetchError("Couldn't load games. Check your connection and try again.");
    }
  }, [address, canAct, guestUser?.address]);

  useEffect(() => {
    if (!canAct || !(address ?? guestUser?.address)) {
      setFetchingRecent(false);
      setFetchingPending(false);
      return;
    }
    fetchGames();
  }, [canAct, address, guestUser?.address, fetchGames]);

  // Only show games that are not finished (so "Continue Game" is never for ended games)
  const activeRecentGames = useMemo(
    () =>
      recentGames.filter(
        (g) => g.status !== "COMPLETED" && g.status !== "CANCELLED"
      ),
    [recentGames]
  );

  // Filter and sort pending games based on timeFilter
  useEffect(() => {
    const now = Date.now();
    let filtered = allPendingGames;

    if (timeFilter !== Infinity) {
      filtered = filtered.filter(
        (game) =>
          game.created_at && // Assume created_at is an ISO string or timestamp
          now - new Date(game.created_at).getTime() <= timeFilter
      );
    }

    // Sort by created_at descending (most recent first)
    const sorted = filtered.sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime()
    );

    setPendingGames(sorted);
  }, [allPendingGames, timeFilter]);

  const handleJoinByCode = useCallback(async () => {
    if (!normalizedCode) {
      setError("Please enter a game code.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiClient.get<ApiResponse>(
        `/games/code/${encodeURIComponent(normalizedCode)}`
      );

      if (!res?.data?.success || !res.data.data) {
        throw new Error("Game not found. Check the code and try again.");
      }

      const game: Game = res.data.data;

      if (game.status === "RUNNING") {
        const addr = address ?? guestUser?.address;
        const isPlayerInGame = addr && game.players.some(
          (p) => String(p.address || "").toLowerCase() === addr.toLowerCase()
        );

        if (isPlayerInGame) {
          setCode("");
          router.push(`${redirectToBoard}?gameCode=${encodeURIComponent(normalizedCode)}`);
        } else {
          throw new Error("This game has already started and you are not a player.");
        }
      } else if (game.status === "PENDING") {
        setCode("");
        router.push(`${redirectToWaiting}?gameCode=${encodeURIComponent(normalizedCode)}`);
      } else {
        throw new Error("This game is no longer active.");
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to join game. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [normalizedCode, address, guestUser?.address, router]);

  const handleContinueGame = useCallback(
    (game: Game) => {
      const go = () => {
        if (game.status === "RUNNING") {
          router.push(`${redirectToBoard}?gameCode=${encodeURIComponent(game.code)}`);
        } else if (game.status === "PENDING") {
          router.push(`${redirectToWaiting}?gameCode=${encodeURIComponent(game.code)}`);
        }
      };
      queueAfterAuth("Continue your saved game after you sign in.", go);
    },
    [router, redirectToBoard, redirectToWaiting, queueAfterAuth]
  );

  const handleJoinPublicGame = useCallback(
    (game: Game) => {
      if (game.status !== "PENDING") return;
      const go = () => {
        router.push(`${redirectToWaiting}?gameCode=${encodeURIComponent(game.code)}`);
      };
      queueAfterAuth("Join this lobby after you sign in so we know who is at the table.", go);
    },
    [router, redirectToWaiting, queueAfterAuth]
  );

  const handleCreateNew = useCallback(() => {
    queueAfterAuth("Host a new game after you sign in.", () => router.push(redirectCreateNew));
  }, [router, redirectCreateNew, queueAfterAuth]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0E282A] via-slate-900 to-slate-950 relative flex flex-col">
      <div className="relative z-10 flex-1 flex items-start justify-center p-4 pb-10 overflow-y-auto w-full">
        <div className="w-full max-w-md mx-auto">
          <div className="relative mb-8">
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 via-cyan-400/10 to-cyan-500/20 rounded-lg blur-3xl opacity-60" />
            <div className="relative text-center">
              <h1 className="text-3xl font-black font-orbitron uppercase tracking-wider mb-2">
                <span className="text-2xl">⚔️</span>
                <br />
                <span
                  className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-500 bg-clip-text text-transparent"
                  style={{
                    textShadow: `
                      0 0 20px rgba(0, 240, 255, 0.5),
                      0 0 40px rgba(0, 240, 255, 0.3)
                    `,
                  }}
                >
                  JOIN TYCOON
                </span>
              </h1>
              <p className="text-cyan-300/70 font-dmSans text-xs tracking-widest uppercase mt-2">
                Find Your Match · Enter The Arena · Dominate
              </p>
            </div>
          </div>

          <JoinRoomAuthStickyBar canAct={canAct} authLoading={authLoading} />
          <JoinRoomAuthModal open={modalOpen} hint={modalHint} onDismiss={cancelModal} />

          <div className="space-y-6">
            {/* ENTER ACCESS CODE */}
            <div>
              <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Enter Access Code</p>
              <div className="bg-black/60 rounded-xl p-3 border border-cyan-500/30 space-y-3">
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      if (error) setError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && !joinByCodeGuard.isSubmitting && joinByCodeGuard.submit(() => handleJoinByCode())}
                    placeholder="ABCD1234"
                    className="w-full bg-[#0A1A1B] text-cyan-300 font-mono px-3 py-2 rounded-lg border border-cyan-500/60 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 text-sm uppercase tracking-wide"
                    maxLength={12}
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => joinByCodeGuard.submit(() => handleJoinByCode())}
                    disabled={loading || joinByCodeGuard.isSubmitting || !normalizedCode}
                    className={`w-full px-4 py-2 rounded-lg font-orbitron font-bold text-sm transition-all border-2 flex items-center justify-center gap-1 whitespace-nowrap ${
                      !normalizedCode || loading || joinByCodeGuard.isSubmitting
                        ? "border-cyan-500/30 bg-slate-800/40 text-cyan-400/60"
                        : "border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-lg shadow-cyan-500/40 hover:shadow-cyan-500/60"
                    }`}
                  >
                    {loading || joinByCodeGuard.isSubmitting ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      <>⚡ JOIN MATCH</>
                    )}
                  </motion.button>
                </div>
                {error && (
                  <p className="text-red-400 text-xs bg-red-900/30 border border-red-500/30 p-2 rounded-lg font-orbitron" role="alert">
                    {error}
                  </p>
                )}
              </div>
            </div>

            {/* HOST BATTLE */}
            <div>
              <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Host Battle</p>
              <div className="bg-black/60 rounded-xl p-3 border border-cyan-500/30 h-full flex items-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCreateNew}
                  className="w-full px-4 py-2 rounded-lg font-orbitron font-bold text-sm transition-all border-2 border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-lg shadow-cyan-500/40 hover:shadow-cyan-500/60"
                >
                  🎮 HOST A MATCH
                </motion.button>
              </div>
            </div>

            {/* LIVE BATTLEGROUNDS */}
            {canAct && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest">Live Battlegrounds</p>
                  <div className="overflow-x-auto pb-1">
                    <div className="flex gap-1 min-w-min">
                      {timeOptions.map((opt) => (
                        <motion.button
                          key={opt.value}
                          whileHover={{ scale: 1.05 }}
                          onClick={() => setTimeFilter(opt.value)}
                          className={`px-2 py-1 rounded-lg font-orbitron text-xs transition-all border-2 whitespace-nowrap ${
                            timeFilter === opt.value
                              ? "border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-lg shadow-cyan-500/40"
                              : "border-cyan-500/20 bg-slate-800/40 text-cyan-400/60 hover:border-cyan-400/40"
                          }`}
                        >
                          {opt.label === "All pending" ? "ALL" : opt.label.replace("Last ", "")}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>

                {fetchingPending ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mx-auto mb-2" />
                    <p className="text-cyan-400/70 text-sm font-orbitron">SCANNING BATTLEGROUNDS...</p>
                  </div>
                ) : pendingGames.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {pendingGames.map((game) => (
                      <motion.div
                        key={game.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-black/60 rounded-lg p-3 border border-cyan-500/30 hover:border-cyan-400/60 transition-all"
                      >
                        <div className="space-y-2 mb-3">
                          <p className="font-mono font-bold text-cyan-300 text-sm">{game.code}</p>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex gap-1">
                              {[...Array(game.number_of_players)].map((_, i) => (
                                <span key={i} className={i < game.players.length ? "text-cyan-400" : "text-cyan-500/30"}>
                                  ●
                                </span>
                              ))}
                            </div>
                            <motion.span
                              animate={{ opacity: [1, 0.5, 1] }}
                              transition={{ repeat: Infinity, duration: 1.5 }}
                              className="px-2 py-0.5 rounded-full bg-green-900/40 border border-green-500/60 text-green-300 font-orbitron font-bold"
                            >
                              WAITING
                            </motion.span>
                          </div>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleJoinPublicGame(game)}
                          className="w-full py-1.5 rounded-lg font-orbitron font-bold text-xs border-2 border-cyan-400 bg-cyan-500/20 text-cyan-300 hover:shadow-lg hover:shadow-cyan-500/40 transition-all"
                        >
                          ▶ JOIN
                        </motion.button>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-amber-400/70 text-sm font-orbitron">⚠ NO ACTIVE BATTLEGROUNDS DETECTED</p>
                  </div>
                )}
              </div>
            )}

            {/* REJOIN BATTLE */}
            {canAct && (fetchingRecent || activeRecentGames.length > 0) && (
              <div>
                <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Rejoin Battle</p>
                {fetchingRecent ? (
                  <div className="text-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-cyan-400 mx-auto" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {activeRecentGames.map((game) => (
                      <motion.button
                        key={game.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => handleContinueGame(game)}
                        className="bg-black/60 rounded-lg p-3 border border-cyan-500/30 hover:border-cyan-400/60 transition-all text-left"
                      >
                        <div className="space-y-2 mb-3">
                          <p className="font-mono font-bold text-cyan-300 text-sm">{game.code}</p>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex gap-1">
                              {[...Array(game.number_of_players)].map((_, i) => (
                                <span key={i} className={i < game.players.length ? "text-cyan-400" : "text-cyan-500/30"}>
                                  ●
                                </span>
                              ))}
                            </div>
                            <span className={`px-2 py-0.5 rounded-full font-orbitron font-bold ${
                              game.status === "PENDING"
                                ? "bg-green-900/40 border border-green-500/60 text-green-300"
                                : "bg-amber-900/40 border border-amber-500/60 text-amber-300"
                            }`}>
                              {game.status === "PENDING" ? "WAITING" : "RUNNING"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-cyan-400/70">Ready?</span>
                          <span className="text-cyan-300">▶ RESUME</span>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!canAct && !authLoading && (
              <div className="text-center py-8">
                <p className="text-cyan-400/70 text-sm font-orbitron">Sign in or connect your wallet to browse and join battles.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}