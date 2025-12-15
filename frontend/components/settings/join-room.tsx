"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IoHomeOutline, IoArrowForwardOutline } from "react-icons/io5";
import { useAccount } from "wagmi";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";
import { Game } from "@/lib/types/games";

export default function JoinRoom(): JSX.Element {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  const [code, setCode] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [fetchingRecent, setFetchingRecent] = useState<boolean>(true);

  // Uppercase and trim code input
  const normalizedCode = useMemo(() => code.trim().toUpperCase(), [code]);

  // Fetch recent games where user is a player (for "Continue Game" section)
  useEffect(() => {
    if (!isConnected || !address) {
      setFetchingRecent(false);
      return;
    }

    const fetchRecent = async () => {
      try {
        const res = await apiClient.get<ApiResponse>("/games/my-games");
        if (res?.data?.success && Array.isArray(res.data.data)) {
          setRecentGames(res.data.data as Game[]);
        }
      } catch (err) {
        console.error("Failed to fetch recent games:", err);
      } finally {
        setFetchingRecent(false);
      }
    };

    fetchRecent();
  }, [address, isConnected]);

  const handleJoinByCode = useCallback(async () => {
    if (!normalizedCode) {
      setError("Please enter a game code.");
      return;
    }

    if (!isConnected) {
      setError("Please connect your wallet to join a game.");
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
        // Game already started — go directly to play if player is in it
        const isPlayerInGame = game.players.some(
          (p) => p.address.toLowerCase() === address?.toLowerCase()
        );

        if (isPlayerInGame) {
          router.push(`/game-play?gameCode=${encodeURIComponent(normalizedCode)}`);
        } else {
          throw new Error("This game has already started and you are not a player.");
        }
      } else if (game.status === "PENDING") {
        // Game waiting — go to waiting room
        router.push(`/game-waiting?gameCode=${encodeURIComponent(normalizedCode)}`);
      } else {
        throw new Error("This game is no longer active.");
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to join game. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [normalizedCode, address, isConnected, router]);

  const handleContinueGame = useCallback(
    (game: Game) => {
      if (game.status === "RUNNING") {
        router.push(`/game-play?gameCode=${encodeURIComponent(game.code)}`);
      } else if (game.status === "PENDING") {
        router.push(`/game-waiting?gameCode=${encodeURIComponent(game.code)}`);
      }
    },
    [router]
  );

  const handleCreateNew = () => router.push("/create-room");

  return (
    <section className="w-full h-[calc(100dvh-87px)] bg-settings bg-cover bg-fixed bg-center">
      <main className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#010F10]/90 to-[#010F10]/50 px-4 sm:px-6">
        <div className="w-full max-w-xl bg-[#0A1A1B]/80 p-6 sm:p-8 rounded-2xl shadow-2xl border border-[#00F0FF]/50 backdrop-blur-md">
          <h2 className="text-3xl sm:text-4xl font-bold font-orbitron mb-8 text-center tracking-widest bg-gradient-to-r from-[#00F0FF] to-[#FF00FF] bg-clip-text text-transparent animate-pulse">
            Join Tycoon
          </h2>

          {/* Join by Code Section */}
          <div className="space-y-6 mb-10">
            <h3 className="text-xl font-bold text-[#00F0FF] text-center font-orbitron">
              Enter Game Code
            </h3>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
                placeholder="ABCD1234"
                className="flex-1 bg-[#0A1A1B] text-[#F0F7F7] px-5 py-4 rounded-xl border border-[#00F0FF]/50 focus:outline-none focus:ring-2 focus:ring-[#00F0FF] font-orbitron text-lg uppercase tracking-wider shadow-inner"
                maxLength={12}
              />
              <button
                onClick={handleJoinByCode}
                disabled={loading || !normalizedCode}
                className="bg-gradient-to-r from-[#00F0FF] to-[#FF00FF] text-black font-orbitron font-extrabold px-8 py-4 rounded-xl hover:opacity-90 transition-all shadow-lg hover:shadow-[#00F0FF]/50 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? "Checking..." : "Join"}
                <IoArrowForwardOutline className="w-6 h-6" />
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center bg-red-900/50 p-3 rounded-lg animate-pulse font-orbitron">
                {error}
              </p>
            )}
          </div>

          {/* Continue Existing Games */}
          {isConnected && recentGames.length > 0 && (
            <div className="space-y-6 mb-10">
              <h3 className="text-xl font-bold text-[#00F0FF] text-center font-orbitron">
                Continue Game
              </h3>

              <div className="grid gap-4">
                {recentGames.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => handleContinueGame(game)}
                    className="bg-[#010F10]/70 p-5 rounded-xl border border-[#00F0FF]/40 hover:border-[#00F0FF] transition-all shadow-md hover:shadow-[#00F0FF]/50 flex items-center justify-between group"
                  >
                    <div className="text-left">
                      <p className="text-[#F0F7F7] font-orbitron font-bold text-lg">
                        Code: {game.code}
                      </p>
                      <p className="text-[#869298] text-sm">
                        Players: {game.players.length}/{game.number_of_players} •{" "}
                        {game.status === "PENDING" ? "Waiting" : "In Progress"}
                      </p>
                    </div>
                    <IoArrowForwardOutline className="w-8 h-8 text-[#00F0FF] group-hover:translate-x-2 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Create New Game */}
          <div className="text-center">
            <p className="text-[#869298] text-sm mb-4">Want to host?</p>
            <button
              onClick={handleCreateNew}
              className="bg-gradient-to-r from-[#00FFAA] to-[#00F0FF] text-black font-orbitron font-extrabold px-8 py-4 rounded-xl hover:opacity-90 transition-all shadow-lg hover:shadow-[#00FFAA]/50 transform hover:scale-105"
            >
              Create New Game
            </button>
          </div>

          {/* Footer Links */}
          <div className="flex justify-center mt-10">
            <button
              onClick={() => router.push("/")}
              className="flex items-center text-[#0FF0FC] text-base font-orbitron hover:text-[#00D4E6] transition-colors hover:underline gap-2"
            >
              <IoHomeOutline className="w-5 h-5" />
              Back to HQ
            </button>
          </div>

          {/* Wallet Warning */}
          {!isConnected && (
            <p className="text-yellow-400 text-sm text-center mt-6 bg-yellow-900/30 p-3 rounded-lg font-orbitron">
              Connect your wallet to join or continue games.
            </p>
          )}
        </div>
      </main>
    </section>
  );
}