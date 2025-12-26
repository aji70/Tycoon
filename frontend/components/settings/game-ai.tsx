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
  useCreateAiGame,
} from "@/context/ContractProvider";

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

export default function PlayWithAI() {
  const router = useRouter();
  const { address } = useAccount();
  const { data: username } = useGetUsername(address, { enabled: !!address });
  const { data: isUserRegistered, isLoading: isRegisteredLoading } = useIsRegistered(address, { enabled: !!address });

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

  const { write: createAiGame, isPending: isCreatePending } = useCreateAiGame(
    username || "",
    "PRIVATE",
    settings.symbol,
    totalPlayers,
    gameCode,
    settings.startingCash
  );

  const handlePlay = async () => {
    if (!address || !username || !isUserRegistered) {
      toast.error("Please connect your wallet and register first!", { autoClose: 5000 });
      return;
    }

    const toastId = toast.loading(`Summoning ${settings.aiCount} AI rival${settings.aiCount > 1 ? "s" : ""}...`, {
      position: "top-right",
    });

    try {
      const onChainGameId = await createAiGame();
      if (!onChainGameId) throw new Error("Failed to create game on-chain");

      toast.update(toastId, { render: "Preparing the battlefield..." });

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
      if (!dbGameId) throw new Error("Failed to save game");

      // FIXED: Properly assign unique symbols to AI players (TypeScript-safe)
      let availableSymbols = [...GamePieces].filter(p => p.id !== settings.symbol);
      const assignedAiSymbols: string[] = [];

      for (let i = 0; i < settings.aiCount; i++) {
        const aiAddress = ai_address[i];

        if (availableSymbols.length === 0) {
          // Bonus fallback: reset pool excluding only the player's symbol
          availableSymbols = [...GamePieces].filter(p => p.id !== settings.symbol);
        }

        const randomIndex = Math.floor(Math.random() * availableSymbols.length);
        const aiSymbol = availableSymbols[randomIndex].id;

        availableSymbols.splice(randomIndex, 1); // Safe: mutable copy
        assignedAiSymbols.push(aiSymbol);

        await apiClient.post("/game-players/join", {
          address: aiAddress,
          symbol: aiSymbol,
          code: gameCode,
        });
      }

      await apiClient.put(`/games/${dbGameId}`, { status: "RUNNING" });

      toast.update(toastId, {
        render: "Battle begins! Good luck, Tycoon!",
        type: "success",
        isLoading: false,
        autoClose: 4000,
      });

      router.push(`/ai-play?gameCode=${gameCode}`);
    } catch (err: any) {
      if (
        err?.code === 4001 ||
        err?.message?.includes("User rejected") ||
        err?.message?.includes("User denied") ||
        err?.message?.includes("ACTION_REJECTED")
      ) {
        toast.update(toastId, {
          render: "You cancelled the action – no worries!",
          type: "info",
          isLoading: false,
          autoClose: 4000,
        });
        return;
      }

      let message = "Something went wrong. Please try again.";
      if (err?.message?.includes("insufficient funds")) {
        message = "Not enough funds for gas fees";
      } else if (err?.shortMessage) {
        message = err.shortMessage;
      } else if (err?.reason) {
        message = err.reason;
      }

      toast.update(toastId, {
        render: message,
        type: "error",
        isLoading: false,
        autoClose: 6000,
      });
    }
  };

  if (isRegisteredLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-settings bg-cover">
        <p className="text-[#00F0FF] text-2xl xs:text-3xl font-orbitron animate-pulse text-center px-4">LOADING ARENA...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-settings bg-cover bg-fixed flex items-center justify-center p-2 xs:p-3">
      {/* Shrunk container by ~10% */}
      <div className="w-full max-w-3xl bg-black/70 backdrop-blur-2xl rounded-2xl border border-cyan-500/60 shadow-xl p-4 xs:p-5 sm:p-7">

        {/* Header - slightly smaller */}
        <div className="flex justify-between items-center mb-5 xs:mb-6">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1 xs:gap-2 text-cyan-400 hover:text-cyan-300 transition text-xs xs:text-sm"
          >
            <House className="w-4 h-4 xs:w-5 xs:h-5" />
            <span className="font-medium">BACK</span>
          </button>
          <h1 className="text-3xl xs:text-4xl sm:text-5xl font-orbitron font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
            AI DUEL
          </h1>
          <div className="w-10 xs:w-16" />
        </div>

        {/* Main Grid - tighter spacing */}
        <div className="grid md:grid-cols-2 gap-4 xs:gap-5 mb-5 xs:mb-6">

          {/* Left Column */}
          <div className="space-y-3 xs:space-y-4">
            {/* Your Piece */}
            <div className="bg-gradient-to-br from-cyan-900/60 to-blue-900/60 rounded-xl p-3 xs:p-4 border border-cyan-500/40">
              <div className="flex items-center gap-2 mb-2">
                <FaUser className="w-5 h-5 xs:w-6 text-cyan-400" />
                <h3 className="text-lg xs:text-xl font-bold text-cyan-300">Your Piece</h3>
              </div>
              <Select value={settings.symbol} onValueChange={v => setSettings(p => ({ ...p, symbol: v }))}>
                <SelectTrigger className="h-10 xs:h-11 text-sm xs:text-base bg-black/50 border-cyan-500/60 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GamePieces.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* AI Count */}
            <div className="bg-gradient-to-br from-purple-900/60 to-pink-900/60 rounded-xl p-3 xs:p-4 border border-purple-500/40">
              <div className="flex items-center gap-2 mb-2">
                <FaRobot className="w-5 h-5 xs:w-6 text-purple-400" />
                <h3 className="text-lg xs:text-xl font-bold text-purple-300">AI Opponents</h3>
              </div>
              <Select value={settings.aiCount.toString()} onValueChange={v => setSettings(p => ({ ...p, aiCount: +v }))}>
                <SelectTrigger className="h-10 xs:h-11 text-sm xs:text-base bg-black/50 border-purple-500/60 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 AI</SelectItem>
                  <SelectItem value="2">2 AI</SelectItem>
                  <SelectItem value="3">3 AI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Difficulty */}
            <div className="bg-gradient-to-br from-red-900/60 to-orange-900/60 rounded-xl p-3 xs:p-4 border border-red-500/40">
              <div className="flex items-center gap-2 mb-2">
                <FaBrain className="w-5 h-5 xs:w-6 text-red-400" />
                <h3 className="text-lg xs:text-xl font-bold text-red-300">Difficulty</h3>
              </div>
              <Select value={settings.aiDifficulty} onValueChange={v => setSettings(p => ({ ...p, aiDifficulty: v as any }))}>
                <SelectTrigger className="h-10 xs:h-11 text-sm xs:text-base bg-black/50 border-red-500/60 text-white">
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

            {/* Starting Cash */}
            <div className="bg-gradient-to-br from-yellow-900/60 to-amber-900/60 rounded-xl p-3 xs:p-4 border border-yellow-500/40">
              <div className="flex items-center gap-2 mb-2">
                <FaCoins className="w-5 h-5 xs:w-6 text-yellow-400" />
                <h3 className="text-lg xs:text-xl font-bold text-yellow-300">Starting Cash</h3>
              </div>
              <Select value={settings.startingCash.toString()} onValueChange={v => setSettings(p => ({ ...p, startingCash: +v }))}>
                <SelectTrigger className="h-10 xs:h-11 text-sm xs:text-base bg-black/50 border-yellow-500/60 text-white">
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

          {/* Right Column - House Rules */}
          <div className="bg-black/70 rounded-xl p-3 xs:p-4 border border-cyan-500/50">
            <h3 className="text-xl xs:text-2xl font-orbitron font-bold text-cyan-300 mb-3 xs:mb-4 text-center">HOUSE RULES</h3>
            <div className="space-y-3">
              {[
                { icon: RiAuctionFill, label: "Auction", key: "auction" },
                { icon: GiPrisoner, label: "Rent in Jail", key: "rentInPrison" },
                { icon: GiBank, label: "Mortgage", key: "mortgage" },
                { icon: IoBuild, label: "Even Build", key: "evenBuild" },
                { icon: FaRandom, label: "Random Order", key: "randomPlayOrder" },
              ].map(r => (
                <div key={r.key} className="flex justify-between items-center py-1">
                  <div className="flex items-center gap-2">
                    <r.icon className="w-5 h-5 xs:w-6 text-cyan-400" />
                    <span className="text-white text-sm xs:text-base font-medium">{r.label}</span>
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

        {/* Play Button - slightly smaller */}
        <div className="flex justify-center mt-5 xs:mt-6">
          <button
            onClick={handlePlay}
            disabled={isCreatePending}
            className="relative px-8 xs:px-10 sm:px-12 py-3 xs:py-4 text-xl xs:text-2xl font-orbitron font-bold tracking-wider
                       bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 
                       hover:from-purple-600 hover:via-pink-600 hover:to-red-600
                       rounded-xl shadow-xl transform hover:scale-105 active:scale-100 transition-all duration-300
                       disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100
                       border-2 xs:border-3 border-cyan-300/80 overflow-hidden group"
          >
            <span className="relative z-10 text-black drop-shadow-md">
              {isCreatePending ? "SUMMONING..." : "START BATTLE"}
            </span>
            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </button>
        </div>

      </div>
    </div>
  );
}