"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId } from "wagmi";
import { useGetUsername, useIsRegistered } from "@/context/ContractProvider";
import { toast } from "react-toastify";
import { BarChart2, Trophy, Wallet, Crown, Users, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import herobg from "@/public/heroBg.png";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";

function chainIdToLeaderboardChain(chainId: number): string {
  if (chainId === 137 || chainId === 80001) return "POLYGON";
  if (chainId === 42220 || chainId === 44787) return "CELO";
  if (chainId === 8453 || chainId === 84531) return "BASE";
  return "CELO";
}

interface PlayerStats {
  totalGames: number;
  wins: number;
  tokensEarned: number;
  ranking: number;
  winRate: string;
}

interface LeaderboardEntry {
  username: string;
  totalGames: number;
  wins: number;
  ranking: number;
  avatar?: string;
}

const GameStats: React.FC = () => {
  const router = useRouter();
  const { address, isConnecting } = useAccount();
  const chainId = useChainId();
  const { data: isUserRegistered, error: registeredError } = useIsRegistered(address);
  const { data: username } = useGetUsername(address);
  const [playerStats] = useState<PlayerStats>({
    totalGames: 42,
    wins: 15,
    tokensEarned: 2500,
    ranking: 3,
    winRate: "35.7%",
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [gameIdQuery, setGameIdQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [queriedGame, setQueriedGame] = useState<{
    code: string;
    status: string;
    players: Array<{ username: string; balance: number; position: number; user_id?: number }>;
    winner_id?: number | null;
  } | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  const chainParam = chainIdToLeaderboardChain(chainId);
  const fetchLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    setLeaderboardError(null);
    try {
      const res = await apiClient.get<unknown>("/users/leaderboard", {
        chain: chainParam,
        type: "wins",
        limit: 10,
      });
      const raw = Array.isArray(res?.data) ? res.data : (res as { data?: unknown[] })?.data;
      const list = (raw ?? []) as Array<{ username?: string; games_played?: number; game_won?: number }>;
      const filtered = list.filter((row) => !String(row?.username ?? "").includes("AI_"));
      setLeaderboard(
        filtered.map((row, i) => ({
          username: String(row?.username ?? "—"),
          totalGames: Number(row?.games_played ?? 0),
          wins: Number(row?.game_won ?? 0),
          ranking: i + 1,
        }))
      );
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Failed to load leaderboard";
      setLeaderboardError(msg);
      setLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }, [chainParam]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useEffect(() => {
    if (registeredError) {
      console.error("Registered error:", registeredError);
      toast.error(
        registeredError?.message || "Failed to check registration status",
        {
          position: "top-right",
          autoClose: 5000,
        }
      );
    }
  }, [registeredError]);

  const handleGameIdQuery = async () => {
    const code = gameIdQuery.trim().toUpperCase().replace(/^#/, "");
    if (!code || code.length !== 6) {
      toast.error("Enter a 6-character game code", { position: "top-right", autoClose: 3000 });
      setQueryError("Enter a 6-character game code.");
      setQueriedGame(null);
      return;
    }
    setLoading(true);
    setQueryError(null);
    setQueriedGame(null);
    try {
      const res = await apiClient.get<ApiResponse>(`/games/code/${encodeURIComponent(code)}`);
      const data = (res?.data as { success?: boolean; data?: unknown })?.data;
      if (!res?.data?.success || !data) {
        setQueryError("Game not found.");
        toast.error("Game not found", { position: "top-right", autoClose: 3000 });
        return;
      }
      const game = data as { code?: string; status?: string; players?: unknown[]; winner_id?: number | null };
      const players = (game.players ?? []) as Array<Record<string, unknown>>;
      setQueriedGame({
        code: game.code ?? code,
        status: game.status ?? "UNKNOWN",
        players: players.map((p) => ({
          username: String(p.username ?? p.address ?? "—"),
          balance: Number(p.balance ?? 0),
          position: Number(p.position ?? 0),
          user_id: p.user_id != null ? Number(p.user_id) : undefined,
        })),
        winner_id: game.winner_id ?? null,
      });
      toast.success("Game loaded", { position: "top-right", autoClose: 2000 });
    } catch {
      setQueryError("Could not load game. Check the code and try again.");
      toast.error("Could not load game", { position: "top-right", autoClose: 3000 });
    } finally {
      setLoading(false);
    }
  };

  if (isConnecting) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p className="font-orbitron text-[#00F0FF] text-[16px]">
          Connecting to wallet...
        </p>
      </div>
    );
  }

  if (!address || !isUserRegistered) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] flex flex-col items-center justify-center">
        <p className="font-orbitron text-[#00F0FF] text-[16px] mb-4 text-center">
          {address
            ? "Please register to view your game stats."
            : "Please connect your wallet to view game stats."}
        </p>
        <Link
          href="/"
          className="relative group w-[200px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
        >
          <svg
            width="200"
            height="40"
            viewBox="0 0 200 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute top-0 left-0 w-full h-full"
          >
            <path
              d="M6 1H194C198.373 1 200.996 5.85486 198.601 9.5127L180.167 37.5127C179.151 39.0646 177.42 40 175.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
              fill="#0E1415"
              stroke="#003B3E"
              strokeWidth={1}
              className="group-hover:stroke-[#00F0FF] transition-all duration-300 ease-in-out"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[#00F0FF] capitalize text-[12px] font-dmSans font-medium z-10">
            Back to Home
          </span>
        </Link>
      </div>
    );
  }

  return (
    <section className="z-0 w-full min-h-screen relative overflow-x-hidden bg-gradient-to-b from-[#010F10] to-[#0E1415]">
      {/* Background Image */}
      <div className="w-full h-full absolute inset-0 overflow-hidden">
        <Image
          src={herobg}
          alt="Hero Background"
          className="w-full h-full object-cover hero-bg-zoom opacity-50"
          width={1440}
          height={1024}
          priority
          quality={100}
        />
      </div>

      {/* Overlay for readability */}
      <div className="w-full h-full absolute inset-0 bg-gradient-to-b from-transparent via-[#010F10]/80 to-[#010F10]"></div>

      {/* Header */}
      <header className="w-full h-[87px] flex items-center justify-between px-4 md:px-8 bg-[linear-gradient(180deg,rgba(1,15,16,0.12)_0%,rgba(8,50,52,0.12)_100%)] backdrop-blur-sm relative z-[50] border-b border-[#003B3E]">
        <Link
          href="/"
          className="text-[#00F0FF] text-xl font-bold flex items-center gap-2 hover:text-[#0FF0FC] transition-colors"
        >
          ← Back to Tycoon
        </Link>
        <h1 className="text-2xl uppercase font-kronaOne text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-[#0FF0FC]">
          Game Stats
        </h1>
        <div className="w-10" /> {/* Spacer */}
      </header>

      {/* Content */}
      <main className="w-full relative z-20 flex flex-col items-center gap-8 py-8 px-4 md:px-8">
        <div className="text-center">
          <h2 className="font-orbitron text-[32px] md:text-[48px] lg:text-[64px] font-[900] text-[#00F0FF] uppercase tracking-[-0.02em] mb-2">
            Your Empire Stats
          </h2>
          <p className="font-orbitron text-[18px] md:text-[24px] text-[#F0F7F7] font-[700]">
            Welcome back, <span className="text-[#00F0FF]">{username || "Tycoon"}</span>!
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="font-orbitron text-[#00F0FF] text-[18px]">
              Loading empire data...
            </p>
          </div>
        ) : (
          <div className="w-full max-w-6xl flex flex-col gap-8">
            {/* Player Stats Grid */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-[#0E1415]/80 backdrop-blur-sm rounded-[16px] border border-[#003B3E] p-6 hover:border-[#00F0FF]/50 transition-all duration-300 group">
                <div className="flex items-center justify-center w-12 h-12 bg-[#00F0FF]/10 rounded-full mb-4 group-hover:bg-[#00F0FF]/20 transition-colors">
                  <BarChart2 className="w-6 h-6 text-[#00F0FF]" />
                </div>
                <h3 className="font-orbitron text-lg text-[#00F0FF] font-bold mb-2 text-center">Total Games</h3>
                <p className="text-3xl font-bold text-[#F0F7F7] text-center">{playerStats.totalGames}</p>
              </div>
              <div className="bg-[#0E1415]/80 backdrop-blur-sm rounded-[16px] border border-[#003B3E] p-6 hover:border-[#00F0FF]/50 transition-all duration-300 group">
                <div className="flex items-center justify-center w-12 h-12 bg-[#FFD700]/10 rounded-full mb-4 group-hover:bg-[#FFD700]/20 transition-colors">
                  <Trophy className="w-6 h-6 text-[#FFD700]" />
                </div>
                <h3 className="font-orbitron text-lg text-[#FFD700] font-bold mb-2 text-center">Wins</h3>
                <p className="text-3xl font-bold text-[#F0F7F7] text-center">{playerStats.wins}</p>
                <p className="text-sm text-[#AFBAC0] text-center mt-1">{playerStats.winRate} Win Rate</p>
              </div>
              <div className="bg-[#0E1415]/80 backdrop-blur-sm rounded-[16px] border border-[#003B3E] p-6 hover:border-[#00F0FF]/50 transition-all duration-300 group">
                <div className="flex items-center justify-center w-12 h-12 bg-[#00F0FF]/10 rounded-full mb-4 group-hover:bg-[#00F0FF]/20 transition-colors">
                  <Wallet className="w-6 h-6 text-[#00F0FF]" />
                </div>
                <h3 className="font-orbitron text-lg text-[#00F0FF] font-bold mb-2 text-center">BLOCK Tokens</h3>
                <p className="text-3xl font-bold text-[#F0F7F7] text-center">{playerStats.tokensEarned.toLocaleString()}</p>
              </div>
              <div className="bg-[#0E1415]/80 backdrop-blur-sm rounded-[16px] border border-[#003B3E] p-6 hover:border-[#00F0FF]/50 transition-all duration-300 group">
                <div className="flex items-center justify-center w-12 h-12 bg-[#FFD700]/10 rounded-full mb-4 group-hover:bg-[#FFD700]/20 transition-colors">
                  <Crown className="w-6 h-6 text-[#FFD700]" />
                </div>
                <h3 className="font-orbitron text-lg text-[#FFD700] font-bold mb-2 text-center">Tycoon Rank</h3>
                <p className="text-3xl font-bold text-[#F0F7F7] text-center">#{playerStats.ranking}</p>
              </div>
            </section>

            {/* Leaderboard (real data from API) */}
            <section className="bg-[#0E1415]/80 backdrop-blur-sm rounded-[16px] border border-[#003B3E] p-6">
              <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
                <h3 className="font-orbitron text-2xl text-[#00F0FF] font-bold flex items-center gap-2">
                  <Users className="w-6 h-6" />
                  Global Leaderboard
                </h3>
                <Link
                  href="/leaderboard"
                  className="text-sm font-semibold text-[#00F0FF] hover:text-[#0FF0FC] border border-[#00F0FF]/50 hover:border-[#00F0FF] rounded-lg px-4 py-2 transition-colors"
                >
                  View full leaderboard →
                </Link>
              </div>
              {leaderboardLoading ? (
                <div className="flex items-center justify-center gap-2 py-12">
                  <Loader2 className="w-6 h-6 text-[#00F0FF] animate-spin" />
                  <span className="text-[#F0F7F7]/70">Loading leaderboard…</span>
                </div>
              ) : leaderboardError ? (
                <div className="py-8 text-center">
                  <p className="text-red-400/90 mb-3">{leaderboardError}</p>
                  <button
                    type="button"
                    onClick={() => fetchLeaderboard()}
                    className="text-sm font-semibold text-[#00F0FF] hover:text-[#0FF0FC] border border-[#00F0FF]/50 hover:border-[#00F0FF] rounded-lg px-4 py-2 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[#F0F7F7] font-dmSans">
                    <thead>
                      <tr className="border-b border-[#003B3E]/50">
                        <th className="py-4 px-4 text-left font-semibold">Rank</th>
                        <th className="py-4 px-4 text-left font-semibold">Tycoon</th>
                        <th className="py-4 px-4 text-left font-semibold hidden md:table-cell">Games</th>
                        <th className="py-4 px-4 text-left font-semibold">Wins</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-[#F0F7F7]/60">
                            No leaderboard data yet. Play games to climb the board!
                          </td>
                        </tr>
                      ) : (
                        leaderboard.map((entry, index) => (
                          <tr
                            key={`${entry.username}-${index}`}
                            className={`border-b border-[#003B3E]/50 hover:bg-[#00F0FF]/5 transition-colors ${
                              entry.username === (username || "You") ? "bg-[#00F0FF]/10" : ""
                            }`}
                          >
                            <td className="py-4 px-4 font-bold text-[#FFD700]">{entry.ranking === 1 ? "🏆" : `#${entry.ranking}`}</td>
                            <td className="py-4 px-4 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#00F0FF]/20 flex items-center justify-center text-[#00F0FF] font-bold text-sm shrink-0">
                                {(entry.username || "?")[0].toUpperCase()}
                              </div>
                              <span className={entry.username === (username || "You") ? "text-[#00F0FF] font-bold" : ""}>
                                {entry.username}
                              </span>
                            </td>
                            <td className="py-4 px-4 hidden md:table-cell">{entry.totalGames}</td>
                            <td className="py-4 px-4 font-bold">{entry.wins}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Specific Game Stats Query */}
            <section className="bg-[#0E1415]/80 backdrop-blur-sm rounded-[16px] border border-[#003B3E] p-6">
              <h3 className="font-orbitron text-xl text-[#00F0FF] font-bold mb-4 flex items-center gap-2">
                <BarChart2 className="w-5 h-5" />
                Query specific game
              </h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  value={gameIdQuery}
                  onChange={(e) => setGameIdQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGameIdQuery()}
                  placeholder="Enter 6-character game code (e.g. ABC123)"
                  maxLength={7}
                  className="flex-1 h-[48px] bg-[#0E1415]/50 rounded-[12px] border border-[#003B3E] outline-none px-4 text-[#17ffff] font-orbitron font-[400] text-[16px] placeholder:text-[#455A64] placeholder:font-dmSans focus:border-[#00F0FF] transition-colors"
                />
                <button
                  type="button"
                  onClick={handleGameIdQuery}
                  disabled={loading}
                  className="relative group w-full sm:w-auto h-[48px] bg-transparent border-none p-0 overflow-hidden cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <svg
                    width="140"
                    height="48"
                    viewBox="0 0 140 48"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute top-0 left-0 w-full h-full"
                  >
                    <path
                      d="M6 1H134C138.373 1 140.996 5.85486 138.601 9.5127L120.167 45.5127C119.151 47.0646 117.42 48 115.565 48H6C2.96244 48 0.5 45.5376 0.5 42.5V5.5C0.5 2.46243 2.96243 1 6 1Z"
                      fill="#0E1415"
                      stroke="#003B3E"
                      strokeWidth={1}
                      className="group-hover:stroke-[#00F0FF] transition-all duration-300 ease-in-out"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center gap-2 text-[#00F0FF] capitalize text-[14px] font-dmSans font-medium z-10">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {loading ? "Loading…" : "Look up"}
                  </span>
                </button>
              </div>
              {queryError && (
                <p className="font-dmSans text-[14px] text-red-400 mt-3">{queryError}</p>
              )}
              {queriedGame && (
                <div className="mt-4 p-4 rounded-xl bg-[#0a1214] border border-[#003B3E]">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="font-orbitron text-[#00F0FF] font-semibold">Code: {queriedGame.code}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      queriedGame.status === "RUNNING" ? "bg-amber-500/20 text-amber-400" :
                      queriedGame.status === "FINISHED" ? "bg-emerald-500/20 text-emerald-400" :
                      "bg-[#455A64]/30 text-[#AFBAC0]"
                    }`}>
                      {queriedGame.status}
                    </span>
                  </div>
                  <p className="font-dmSans text-[14px] text-[#AFBAC0] mb-2">Players</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-[#00F0FF]/80 border-b border-[#003B3E]">
                          <th className="py-2 pr-4 font-orbitron">Player</th>
                          <th className="py-2 pr-4 font-orbitron">Balance</th>
                          <th className="py-2 font-orbitron">Position</th>
                        </tr>
                      </thead>
                      <tbody>
                        {queriedGame.players.map((p, i) => (
                          <tr key={i} className="border-b border-[#003B3E]/50">
                            <td className="py-2 pr-4 text-[#F0F7F7]">{p.username}</td>
                            <td className="py-2 pr-4 text-[#AFBAC0]">${p.balance.toLocaleString()}</td>
                            <td className="py-2 text-[#AFBAC0]">{p.position}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {queriedGame.status === "FINISHED" && queriedGame.winner_id != null && (
                    <p className="font-dmSans text-[14px] text-amber-400 mt-2">
                      Winner: {queriedGame.players.find((p) => p.user_id === queriedGame.winner_id)?.username ?? "—"}
                    </p>
                  )}
                </div>
              )}
              {!queriedGame && !queryError && (
                <p className="font-dmSans text-[14px] text-[#AFBAC0] mt-3">Enter a game code to see players, balances, and status.</p>
              )}
            </section>
          </div>
        )}

        {/* Back to Home Button */}
        <Link
          href="/"
          className="relative group w-[220px] h-[48px] bg-transparent border-none p-0 overflow-hidden cursor-pointer mb-8"
        >
          <svg
            width="220"
            height="48"
            viewBox="0 0 220 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute top-0 left-0 w-full h-full"
          >
            <path
              d="M10 1H210C214.373 1 216.996 5.85486 214.601 9.5127L196.167 45.5127C195.151 47.0646 193.42 48 191.565 48H10C6.96244 48 4.5 45.5376 4.5 42.5V5.5C4.5 2.46243 6.96243 1 10 1Z"
              fill="#0E1415"
              stroke="#003B3E"
              strokeWidth={1}
              className="group-hover:stroke-[#00F0FF] transition-all duration-300 ease-in-out"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[#00F0FF] capitalize text-[14px] font-dmSans font-medium z-10">
            Return to the Block
          </span>
        </Link>
      </main>
    </section>
  );
};

export default GameStats;