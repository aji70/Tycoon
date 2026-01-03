"use client";

import React, { useState } from "react";
import { FaUser, FaBrain, FaCoins, FaRobot } from "react-icons/fa6";
import { House } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/game-switch";
import { RiAuctionFill } from "react-icons/ri";
import { GiPrisoner, GiBank } from "react-icons/gi";
import { IoBuild } from "react-icons/io5";
import { FaRandom } from "react-icons/fa";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { toast } from "react-toastify";
import { generateGameCode } from "@/lib/utils/games";
import { GamePieces } from "@/lib/constants/games";
import { apiClient } from "@/lib/api";
import {
  useIsRegistered,
  useGetUsername,
  useCreateAIGame,
} from "@/context/ContractProvider";
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";
import { checksumAddress } from "viem";

const ai_address = [
  "0xA1FF1c93600c3487FABBdAF21B1A360630f8bac6",
  "0xB2EE17D003e63985f3648f6c1d213BE86B474B11",
  "0xC3FF882E779aCbc112165fa1E7fFC093e9353B21",
  "0xD4FFDE5296C3EE6992bAf871418CC3BE84C99C32",
  "0xE5FF75Fcf243C4cE05B9F3dc5Aeb9F901AA361D1",
  "0xF6FF469692a259eD5920C15A78640571ee845E8",
  "0xA7FFE1f969Fa6029Ff2246e79B6A623A665cE69",
  "0xB8FF2cEaCBb67DbB5bc14D570E7BbF339cE240F6",
];

export default function PlayWithAIMobile() {
  const router = useRouter();
  const { address } = useAccount();
  const { data: username } = useGetUsername(address);
  const { data: isUserRegistered, isLoading: isRegisteredLoading } = useIsRegistered(address);

  const [settings, setSettings] = useState({
    symbol: "hat",
    aiCount: 1,
    startingCash: 1500,
    aiDifficulty: "boss" as "easy" | "medium" | "hard" | "boss",
    auction: true,
    rentInPrison: false,
    mortgage: true,
    evenBuild: true,
    randomPlayOrder: true,
  });

  const gameCode = generateGameCode();
  const totalPlayers = settings.aiCount + 1;

  const { write: createAiGame, isPending: isCreatePending } = useCreateAIGame(
    username || "",
    "PRIVATE",
    settings.symbol,
    totalPlayers,
    gameCode,
    BigInt(settings.startingCash)
  );

const handlePlay = async () => {
  if (!address || !username || !isUserRegistered) {
    toast.error("Connect wallet & register first");
    return;
  }

  const toastId = toast.loading(`Summoning ${settings.aiCount} AI rival${settings.aiCount > 1 ? "s" : ""}...`);

  try {
    const onChainGameId = await createAiGame();
    if (!onChainGameId) throw new Error("On-chain failed");

    toast.update(toastId, { render: "Saving arena..." });

    const saveRes = await apiClient.post<any>("/games", {
      id: onChainGameId,
      code: gameCode,
      mode: "PRIVATE",
      address,
      symbol: settings.symbol,
      number_of_players: totalPlayers,
      ai_opponents: settings.aiCount,
      ai_difficulty: settings.aiDifficulty,
      settings: {
        auction: settings.auction,
        rent_in_prison: settings.rentInPrison,
        mortgage: settings.mortgage,
        even_build: settings.evenBuild,
        starting_cash: settings.startingCash,
        randomize_play_order: settings.randomPlayOrder,
      },
    });

    const dbGameId = saveRes.data?.data?.id ?? saveRes.data?.id ?? saveRes.data;
    if (!dbGameId) throw new Error("No game ID");

    const usedSymbols = [settings.symbol];
    for (let i = 0; i < settings.aiCount; i++) {
      try {
        const aiAddress = ai_address[i];
  
        const available = GamePieces.filter(p => !usedSymbols.includes(p.id));
        const aiSymbol = available.length > 0
          ? available[Math.floor(Math.random() * available.length)].id
          : "dog";  // Consider making this a random valid fallback if "dog" is invalid
        usedSymbols.push(aiSymbol);

        await apiClient.post("/game-players/join", {
          address: aiAddress,
          symbol: aiSymbol,
          code: gameCode,
        });
      } catch (innerErr: any) {
        toast.error(`Failed to create AI player ${i + 1}: ${innerErr.message || "Unknown error"}`);
        throw innerErr;  // Abort the whole process if an AI fails
      }
    }

    await apiClient.put(`/games/${dbGameId}`, { status: "RUNNING" });

    toast.update(toastId, {
      render: "Battle begins!",
      type: "success",
      isLoading: false,
      autoClose: 3000,
    });

    router.push(`/ai-play?gameCode=${gameCode}`);
  } catch (err: any) {
    toast.update(toastId, {
      render: `Error: ${err.message || "Try again"}`,
      type: "error",
      isLoading: false,
      autoClose: 6000,
    });
  }
};

  if (isRegisteredLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-settings bg-cover">
        <p className="text-[#00F0FF] text-3xl md:text-4xl font-orbitron animate-pulse">LOADING ARENA...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-settings bg-cover bg-fixed flex items-center justify-center p-2 md:p-4">
      <div className="w-full max-w-4xl bg-black/60 backdrop-blur-xl rounded-2xl border border-cyan-500/50 shadow-2xl p-4 md:p-8">

        {/* Header */}
        <div className="flex justify-between items-center mb-6 md:mb-8">
          <button onClick={() => router.push("/")} className="flex items-center gap-1 md:gap-2 text-cyan-400 hover:text-cyan-300 transition text-sm md:text-base">
            <House className="w-4 h-4 md:w-5 md:h-5" />
            <span className="font-medium">BACK</span>
          </button>
          <h1 className="text-3xl md:text-5xl font-orbitron font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            AI DUEL
          </h1>
          <div className="w-16 md:w-24" />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">

          {/* Left Column - Settings */}
          <div className="space-y-4 md:space-y-5">
            <div className="bg-gradient-to-br from-cyan-900/50 to-blue-900/50 rounded-xl p-4 md:p-5 border border-cyan-500/30">
              <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                <FaUser className="w-5 h-5 md:w-6 md:h-6 text-cyan-400" />
                <h3 className="text-lg md:text-xl font-bold text-cyan-300">Your Piece</h3>
              </div>
              <Select value={settings.symbol} onValueChange={v => setSettings(p => ({ ...p, symbol: v }))}>
                <SelectTrigger className="h-10 md:h-12 bg-black/40 border-cyan-500/50 text-white text-sm md:text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GamePieces.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-xl p-4 md:p-5 border border-purple-500/30">
              <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                <FaRobot className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
                <h3 className="text-lg md:text-xl font-bold text-purple-300">AI Count</h3>
              </div>
              <Select value={settings.aiCount.toString()} onValueChange={v => setSettings(p => ({ ...p, aiCount: +v }))}>
                <SelectTrigger className="h-10 md:h-12 bg-black/40 border-purple-500/50 text-white text-sm md:text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 AI</SelectItem>
                  <SelectItem value="2">2 AI</SelectItem>
                  <SelectItem value="3">3 AI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-gradient-to-br from-red-900/50 to-orange-900/50 rounded-xl p-4 md:p-5 border border-red-500/30">
              <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                <FaBrain className="w-5 h-5 md:w-6 md:h-6 text-red-400" />
                <h3 className="text-lg md:text-xl font-bold text-red-300">Difficulty</h3>
              </div>
              <Select value={settings.aiDifficulty} onValueChange={v => setSettings(p => ({ ...p, aiDifficulty: v as "easy" | "medium" | "hard" | "boss" }))}>
                <SelectTrigger className="h-10 md:h-12 bg-black/40 border-red-500/50 text-white text-sm md:text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                  <SelectItem value="boss" className="text-pink-400 font-bold">BOSS MODE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-gradient-to-br from-yellow-900/50 to-amber-900/50 rounded-xl p-4 md:p-5 border border-yellow-500/30">
              <div className="flex items-center gap-2 md:gap-3 mb-2 md:mb-3">
                <FaCoins className="w-5 h-5 md:w-6 md:h-6 text-yellow-400" />
                <h3 className="text-lg md:text-xl font-bold text-yellow-300">Starting Cash</h3>
              </div>
              <Select value={settings.startingCash.toString()} onValueChange={v => setSettings(p => ({ ...p, startingCash: +v }))}>
                <SelectTrigger className="h-10 md:h-12 bg-black/40 border-yellow-500/50 text-white text-sm md:text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="500">$500</SelectItem>
                  <SelectItem value="1000">$1,000</SelectItem>
                  <SelectItem value="1500">$1,500</SelectItem>
                  <SelectItem value="2000">$2,000</SelectItem>
                  <SelectItem value="5000">$5,000</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Right Column - Rules */}
          <div className="bg-black/70 rounded-xl p-4 md:p-6 border border-cyan-500/40">
            <h3 className="text-xl md:text-2xl font-orbitron font-bold text-cyan-300 mb-4 md:mb-5 text-center">HOUSE RULES</h3>
            <div className="space-y-3 md:space-y-4">
              {[
                { icon: RiAuctionFill, label: "Auction", key: "auction" },
                { icon: GiPrisoner, label: "Rent in Jail", key: "rentInPrison" },
                { icon: GiBank, label: "Mortgage", key: "mortgage" },
                { icon: IoBuild, label: "Even Build", key: "evenBuild" },
                { icon: FaRandom, label: "Random Order", key: "randomPlayOrder" },
              ].map(r => (
                <div key={r.key} className="flex justify-between items-center">
                  <div className="flex items-center gap-2 md:gap-3">
                    <r.icon className="w-5 h-5 md:w-6 md:h-6 text-cyan-400" />
                    <span className="text-white text-base md:text-lg">{r.label}</span>
                  </div>
                  <Switch
                    checked={settings[r.key as keyof typeof settings] as boolean}
                    onCheckedChange={v => setSettings(p => ({ ...p, [r.key]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Play Button */}
        <div className="flex justify-center mt-6 md:mt-8">
          <button
            onClick={handlePlay}
            disabled={isCreatePending}
            className="px-12 md:px-16 py-4 md:py-5 text-xl md:text-2xl font-orbitron font-bold tracking-wider
                       bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-purple-600 hover:to-pink-600
                       rounded-xl shadow-xl transform hover:scale-105 transition-all duration-300
                       disabled:opacity-60 disabled:cursor-not-allowed
                       border-4 border-cyan-400/80 relative overflow-hidden w-full md:w-auto"
          >
            <span className="relative z-10 text-black drop-shadow">
              {isCreatePending ? "SUMMONING..." : "START BATTLE"}
            </span>
            <div className="absolute inset-0 bg-white opacity-0 hover:opacity-30 transition-opacity" />
          </button>
        </div>

      </div>
    </div>
  );
}