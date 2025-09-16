"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useGetUsername, useIsRegistered } from "@/context/ContractProvider";
import { toast } from "react-toastify";
import { BarChart2, Trophy, Wallet } from "lucide-react";
import Image from "next/image";
import herobg from "@/public/heroBg.png";

interface PlayerStats {
  totalGames: number;
  wins: number;
  tokensEarned: number;
  ranking: number;
}

interface LeaderboardEntry {
  username: string;
  totalGames: number;
  wins: number;
  ranking: number;
}

const GameStats: React.FC = () => {
  const router = useRouter();
  const { address, isConnecting } = useAccount();
  const { data: isUserRegistered, error: registeredError } = useIsRegistered(address, {
    enabled: !!address,
  });
  const { data: username } = useGetUsername(address, { enabled: !!address });
  const [playerStats] = useState<PlayerStats>({
    totalGames: 42,
    wins: 15,
    tokensEarned: 2500,
    ranking: 3,
  });
  const [leaderboard] = useState<LeaderboardEntry[]>([
    { username: "Player1", totalGames: 100, wins: 50, ranking: 1 },
    { username: "Player2", totalGames: 80, wins: 40, ranking: 2 },
    { username: "Player3", totalGames: 60, wins: 30, ranking: 3 },
    { username: "You", totalGames: 42, wins: 15, ranking: 4 },
  ]);
  const [gameIdQuery, setGameIdQuery] = useState("");
  const [loading, setLoading] = useState(false);

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

  const handleGameIdQuery = () => {
    // Placeholder for querying specific game stats (no validation to avoid errors)
    toast.info("Specific game stats feature coming soon!", {
      position: "top-right",
      autoClose: 3000,
    });
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
      <div className="w-full h-screen flex flex-col items-center justify-center">
        <p className="font-orbitron text-[#00F0FF] text-[16px] mb-4">
          {address
            ? "Please register to view your game stats."
            : "Please connect your wallet to view game stats."}
        </p>
        <button
          type="button"
          onClick={() => router.push("/")} // Redirect to home
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
        </button>
      </div>
    );
  }

  return (
    <section className="z-0 w-full lg:h-screen md:h-[calc(100vh-87px)] h-screen relative overflow-x-hidden md:mb-20 mb-10">
      {/* Background Image */}
      <div className="w-full h-full overflow-hidden">
        <Image
          src={herobg}
          alt="Hero Background"
          className="w-full h-full object-cover hero-bg-zoom"
          width={1440}
          height={1024}
          priority
          quality={100}
        />
      </div>

      {/* Content */}
      <main className="w-full h-full absolute top-0 left-0 z-20 bg-transparent flex flex-col lg:justify-center items-center gap-6">
        <h1 className="font-orbitron text-[40px] md:text-[60px] lg:text-[80px] font-[900] text-[#00F0FF] uppercase tracking-[-0.02em] text-center">
          Game Stats
        </h1>
        <p className="font-orbitron text-[16px] md:text-[20px] text-[#00F0FF] font-[700] text-center">
          Welcome back, {username || "Player"}!
        </p>

        {loading ? (
          <div className="flex items-center justify-center">
            <p className="font-orbitron text-[#00F0FF] text-[16px]">
              Loading stats...
            </p>
          </div>
        ) : (
          <div className="w-full max-w-[800px] px-4 flex flex-col gap-6">
            {/* Player Stats Card */}
            <div className="bg-[#0E1415]/80 rounded-[12px] border-[1px] border-[#003B3E] p-6">
              <h2 className="font-orbitron text-[24px] text-[#00F0FF] font-[700] mb-4">
                Your Overall Stats
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-[24px] h-[24px] text-[#00F0FF]" />
                  <p className="font-dmSans text-[16px] text-[#F0F7F7]">
                    Wins: <span className="font-bold">{playerStats.wins}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-[24px] h-[24px] text-[#00F0FF]" />
                  <p className="font-dmSans text-[16px] text-[#F0F7F7]">
                    Total Games: <span className="font-bold">{playerStats.totalGames}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Wallet className="w-[24px] h-[24px] text-[#00F0FF]" />
                  <p className="font-dmSans text-[16px] text-[#F0F7F7]">
                    Tokens Earned: <span className="font-bold">{playerStats.tokensEarned}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Trophy className="w-[24px] h-[24px] text-[#00F0FF]" />
                  <p className="font-dmSans text-[16px] text-[#F0F7F7]">
                    Ranking: <span className="font-bold">#{playerStats.ranking}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Leaderboard */}
            <div className="bg-[#0E1415]/80 rounded-[12px] border-[1px] border-[#003B3E] p-6">
              <h2 className="font-orbitron text-[24px] text-[#00F0FF] font-[700] mb-4">
                Leaderboard
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-[#F0F7F7] font-dmSans text-[14px]">
                  <thead>
                    <tr className="border-b border-[#003B3E]">
                      <th className="py-2 px-4 text-left">Rank</th>
                      <th className="py-2 px-4 text-left">Player</th>
                      <th className="py-2 px-4 text-left">Total Games</th>
                      <th className="py-2 px-4 text-left">Wins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, index) => (
                      <tr
                        key={index}
                        className={`border-b border-[#003B3E] ${
                          entry.username === (username || "You") ? "bg-[#00F0FF]/10" : ""
                        }`}
                      >
                        <td className="py-2 px-4">#{entry.ranking}</td>
                        <td className="py-2 px-4">{entry.username}</td>
                        <td className="py-2 px-4">{entry.totalGames}</td>
                        <td className="py-2 px-4">{entry.wins}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Specific Game Stats Query (Placeholder) */}
            <div className="bg-[#0E1415]/80 rounded-[12px] border-[1px] border-[#003B3E] p-6">
              <h2 className="font-orbitron text-[24px] text-[#00F0FF] font-[700] mb-4">
                Specific Game Stats
              </h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={gameIdQuery}
                  onChange={(e) => setGameIdQuery(e.target.value)}
                  placeholder="Enter Game ID"
                  className="w-[200px] h-[40px] bg-[#0E1415] rounded-[8px] border-[1px] border-[#003B3E] outline-none px-3 text-[#17ffff] font-orbitron font-[400] text-[14px] placeholder:text-[#455A64] placeholder:font-dmSans"
                />
                <button
                  type="button"
                  onClick={handleGameIdQuery}
                  className="relative group w-[120px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
                >
                  <svg
                    width="120"
                    height="40"
                    viewBox="0 0 120 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute top-0 left-0 w-full h-full"
                  >
                    <path
                      d="M6 1H114C118.373 1 120.996 5.85486 118.601 9.5127L100.167 37.5127C99.151 39.0646 97.42 40 95.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                      fill="#0E1415"
                      stroke="#003B3E"
                      strokeWidth={1}
                      className="group-hover:stroke-[#00F0FF] transition-all duration-300 ease-in-out"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[#00F0FF] capitalize text-[12px] font-dmSans font-medium z-10">
                    Query Game
                  </span>
                </button>
              </div>
              <p className="font-dmSans text-[14px] text-[#F0F7F7] mt-2">
                Enter a game ID to view specific game stats (feature coming soon).
              </p>
            </div>
          </div>
        )}

        {/* Back to Home Button */}
        <button
          type="button"
          onClick={() => router.push("/")} // Redirect to home
          className="relative group w-[200px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer mt-4"
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
        </button>
      </main>
    </section>
  );
};

export default GameStats;