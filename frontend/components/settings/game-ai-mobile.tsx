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

// All possible AI addresses (we'll pick randomly from this pool)
const AI_ADDRESSES = [
  "0xA1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t",
  "0xA1FF1c93600c3487FABBdAF21B1A360630f8bac6",
  "0xB2EE17D003e63985f3648f6c1d213BE86B474B11",
  "0xC3FF882E779aCbc112165fa1E7fFC093e9353B21",
  "0xD4FFDE5296C3EE6992bAf871418CC3BE84C99C32",
  "0xE5FF75Fcf243C4cE05B9F3dc5Aeb9F901AA361D1",
  "0xF6FF469692a259eD5920C15A78640571ee845E8",
  "0xA7FFE1f969Fa6029Ff2246e79B6A623A665cE69",
  "0xB8FF2cEaCBb67DbB5bc14D570E7BbF339cE240F6",
  "0x9a8b7c6d5e4f3g2h1i0j9k8l7m6n5o4p3q2r1s0t",
  "0x11223344556677889900aabbccddeeff00112233",
  "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
] as const;

function getRandomAIs(count: number) {
  const shuffled = [...AI_ADDRESSES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

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
      position: "top-center",
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

      // Randomize AI addresses every time
      const randomAiAddresses = getRandomAIs(settings.aiCount);

      const usedSymbols = [settings.symbol];
      for (let i = 0; i < settings.aiCount; i++) {
        const aiAddress = randomAiAddresses[i];
        const available = GamePieces.filter(p => !usedSymbols.includes(p.id));
        const aiSymbol = available.length > 0
          ? available[Math.floor(Math.random() * available.length)].id
          : "dog";
        usedSymbols.push(aiSymbol);

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
        <p className="text-[#00F0FF] text-2xl xs:text-3xl sm:text-4xl font-orbitron animate-pulse text-center px-4">LOADING ARENA...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-settings bg-cover bg-fixed flex items-center justify-center p-3 xs:p-4">
      <div className="w-full max-w-2xl bg-black/70 backdrop-blur-2xl rounded-2xl border border-cyan-500/60 shadow-2xl p-5 xs:p-6 sm:p-8">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition text-sm xs:text-base"
          >
            <House className="w-5 h-5 xs:w-6 xs:h-6" />
            <span className="font-medium">BACK</span>
          </button>
          <h1 className="text-4xl xs:text-5xl sm:text-6xl font-orbitron font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            AI DUEL
          </h1>
          <div className="w-16 xs:w-20" />
        </div>

        {/* Settings */}
        <div className="space-y-6 mb-8">
          {/* Your Piece */}
          <div className="bg-gradient-to-r from-cyan-900/60 to-blue-900/60 rounded-xl p-4 border border-cyan-500/40">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FaUser className="w-6 h-6 text-cyan-400" />
                <span className="text-cyan-300 font-bold text-base xs:text-lg">Your Piece</span>
              </div>
              <div className="w-36 xs:w-40">
                <Select value={settings.symbol} onValueChange={v => setSettings(p => ({ ...p, symbol: v }))}>
                  <SelectTrigger className="h-10 text-sm xs:text-base bg-black/50 border-cyan-500/60 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GamePieces.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* AI Opponents */}
          <div className="bg-gradient-to-r from-purple-900/60 to-pink-900/60 rounded-xl p-4 border border-purple-500/40">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FaRobot className="w-6 h-6 text-purple-400" />
                <span className="text-purple-300 font-bold text-base xs:text-lg">AI Opponents</span>
              </div>
              <div className="w-36 xs:w-40">
                <Select value={settings.aiCount.toString()} onValueChange={v => setSettings(p => ({ ...p, aiCount: +v }))}>
                  <SelectTrigger className="h-10 text-sm xs:text-base bg-black/50 border-purple-500/60 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 AI</SelectItem>
                    <SelectItem value="2">2 AI</SelectItem>
                    <SelectItem value="3">3 AI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Difficulty */}
          <div className="bg-gradient-to-r from-red-900/60 to-orange-900/60 rounded-xl p-4 border border-red-500/40">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FaBrain className="w-6 h-6 text-red-400" />
                <span className="text-red-300 font-bold text-base xs:text-lg">Difficulty</span>
              </div>
              <div className="w-36 xs:w-40">
                <Select value={settings.aiDifficulty} onValueChange={v => setSettings(p => ({ ...p, aiDifficulty: v as any }))}>
                  <SelectTrigger className="h-10 text-sm xs:text-base bg-black/50 border-red-500/60 text-white">
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
            </div>
          </div>

          {/* Starting Cash */}
          <div className="bg-gradient-to-r from-yellow-900/60 to-amber-900/60 rounded-xl p-4 border border-yellow-500/40">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FaCoins className="w-6 h-6 text-yellow-400" />
                <span className="text-yellow-300 font-bold text-base xs:text-lg">Starting Cash</span>
              </div>
              <div className="w-36 xs:w-40">
                <Select value={settings.startingCash.toString()} onValueChange={v => setSettings(p => ({ ...p, startingCash: +v }))}>
                  <SelectTrigger className="h-10 text-sm xs:text-base bg-black/50 border-yellow-500/60 text-white">
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
          </div>
        </div>

        {/* House Rules */}
        <div className="bg-black/70 rounded-2xl p-5 xs:p-6 border border-cyan-500/50 mb-8">
          <h3 className="text-xl xs:text-2xl font-orbitron font-bold text-cyan-300 mb-5 text-center">HOUSE RULES</h3>
          <div className="space-y-4">
            {[
              { icon: RiAuctionFill, label: "Auction", key: "auction" },
              { icon: GiPrisoner, label: "Rent in Jail", key: "rentInPrison" },
              { icon: GiBank, label: "Mortgage", key: "mortgage" },
              { icon: IoBuild, label: "Even Build", key: "evenBuild" },
              { icon: FaRandom, label: "Random Order", key: "randomPlayOrder" },
            ].map(r => (
              <div key={r.key} className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <r.icon className="w-6 h-6 text-cyan-400" />
                  <span className="text-white text-base xs:text-lg font-medium">{r.label}</span>
                </div>
                <Switch
                  checked={settings[r.key as keyof typeof settings] as boolean}
                  onCheckedChange={v => setSettings(p => ({ ...p, [r.key]: v }))}
                />
              </div>
            ))}
          </div>
        </div>

        {/* START BATTLE Button – smaller & perfectly centered */}
        <div className="flex justify-center">
          <button
            onClick={handlePlay}
            disabled={isCreatePending}
            className="mx-auto px-10 py-3.5 text-xl xs:text-2xl font-orbitron font-bold tracking-wider
                       bg-gradient-to-r from-cyan-500 to-purple-600 
                       hover:from-purple-600 hover:to-pink-600
                       rounded-full shadow-2xl transform hover:scale-105 active:scale-100 transition-all duration-300
                       disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100
                       border-4 border-cyan-400/80 overflow-hidden group"
          >
            <span className="relative z-10 text-black drop-shadow">
              {isCreatePending ? "SUMMONING..." : "START BATTLE"}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}