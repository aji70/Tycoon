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

// Same stake presets as the multiplayer create page
const stakePresets = [1000, 5000, 10000, 25000, 50000, 100000];

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
    stake: 1000,
  });

  const [customStake, setCustomStake] = useState<string>("");

  const gameCode = generateGameCode();
  const totalPlayers = settings.aiCount + 1;

  const { write: createAiGame, isPending: isCreatePending } = useCreateAIGame(
    username || "",
    "PRIVATE",
    settings.symbol,
    totalPlayers,
    gameCode,
    BigInt(settings.startingCash),
    BigInt(settings.stake)
  );

  const handleSettingChange = (key: keyof typeof settings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleStakeSelect = (value: number) => {
    setSettings((prev) => ({ ...prev, stake: value }));
    setCustomStake("");
  };

  const handleCustomStake = (value: string) => {
    setCustomStake(value);
    const num = Number(value);
    if (!isNaN(num) && num >= 1000) {
      setSettings((prev) => ({ ...prev, stake: num }));
    }
  };

  const handlePlay = async () => {
    if (!address || !username || !isUserRegistered) {
      toast.error("Please connect your wallet and register first!", { autoClose: 5000 });
      return;
    }

    const toastId = toast.loading(`Summoning ${settings.aiCount} AI rival${settings.aiCount > 1 ? "s" : ""}...`);

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
        stake: settings.stake,
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

      let availablePieces = [...GamePieces.filter(p => p.id !== settings.symbol)];

      for (let i = 0; i < settings.aiCount; i++) {
        if (availablePieces.length === 0) availablePieces = [...GamePieces];
        const randomIndex = Math.floor(Math.random() * availablePieces.length);
        const aiSymbol = availablePieces[randomIndex].id;
        availablePieces.splice(randomIndex, 1);

        const aiAddress = ai_address[i];

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
      if (err?.message?.includes("insufficient funds")) message = "Not enough funds for gas fees";
      else if (err?.shortMessage) message = err.shortMessage;
      else if (err?.reason) message = err.reason;

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
      <div className="w-full h-screen flex items-center justify-center bg-settings bg-cover bg-center">
        <p className="text-[#00F0FF] text-3xl font-orbitron animate-pulse text-center px-6">
          LOADING ARENA...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-settings bg-cover bg-fixed flex flex-col">
      {/* Header */}
      <div className="px-6 pt-8 pb-6">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-3 text-cyan-400 hover:text-cyan-300 transition group"
          >
            <House className="w-7 h-7 group-hover:-translate-x-1 transition" />
            <span className="font-bold text-lg">BACK</span>
          </button>
          <h1 className="text-4xl font-orbitron font-extrabold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            AI DUEL
          </h1>
          <div className="w-20" />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-32">
        <div className="max-w-md mx-auto space-y-6">
          {/* Your Piece */}
          <div className="bg-gradient-to-br from-cyan-900/40 to-blue-900/40 rounded-2xl p-6 border border-cyan-500/30">
            <div className="flex items-center gap-3 mb-4">
              <FaUser className="w-7 h-7 text-cyan-400" />
              <h3 className="text-xl font-bold text-cyan-300">Your Piece</h3>
            </div>
            <Select value={settings.symbol} onValueChange={(v) => handleSettingChange("symbol", v)}>
              <SelectTrigger className="h-14 bg-black/60 border-cyan-500/40 text-white">
                <SelectValue placeholder="Choose your piece" />
              </SelectTrigger>
              <SelectContent>
                {GamePieces.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* AI Opponents */}
          <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-2xl p-6 border border-purple-500/30">
            <div className="flex items-center gap-3 mb-4">
              <FaRobot className="w-7 h-7 text-purple-400" />
              <h3 className="text-xl font-bold text-purple-300">AI Opponents</h3>
            </div>
            <Select value={settings.aiCount.toString()} onValueChange={(v) => handleSettingChange("aiCount", +v)}>
              <SelectTrigger className="h-14 bg-black/60 border-purple-500/40 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 AI</SelectItem>
                <SelectItem value="2">2 AI</SelectItem>
                <SelectItem value="3">3 AI</SelectItem>
                <SelectItem value="6">6 AI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Difficulty */}
          <div className="bg-gradient-to-br from-red-900/40 to-orange-900/40 rounded-2xl p-6 border border-red-500/30">
            <div className="flex items-center gap-3 mb-4">
              <FaBrain className="w-7 h-7 text-red-400" />
              <h3 className="text-xl font-bold text-red-300">AI Difficulty</h3>
            </div>
            <Select value={settings.aiDifficulty} onValueChange={(v) => handleSettingChange("aiDifficulty", v as any)}>
              <SelectTrigger className="h-14 bg-black/60 border-red-500/40 text-white">
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
          <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/40 rounded-2xl p-6 border border-amber-500/30">
            <div className="flex items-center gap-3 mb-4">
              <FaCoins className="w-7 h-7 text-amber-400" />
              <h3 className="text-xl font-bold text-amber-300">Starting Cash</h3>
            </div>
            <Select value={settings.startingCash.toString()} onValueChange={(v) => handleSettingChange("startingCash", +v)}>
              <SelectTrigger className="h-14 bg-black/60 border-amber-500/40 text-white">
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

          {/* Entry Stake - EXACT SAME as desktop Create Game */}
          <div className="bg-gradient-to-b from-green-900/60 to-emerald-900/60 rounded-2xl p-8 border border-green-500/40 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <FaCoins className="w-8 h-8 text-green-400" />
              <h3 className="text-2xl font-bold text-green-300">Entry Stake</h3>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {stakePresets.map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleStakeSelect(amount)}
                  className={`py-3 rounded-xl font-bold text-sm transition-all hover:scale-105 ${
                    settings.stake === amount
                      ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-lg"
                      : "bg-black/60 border border-gray-600 text-gray-300"
                  }`}
                >
                  {amount.toLocaleString()}
                </button>
              ))}
            </div>

            <input
              type="number"
              min="1000"
              placeholder="Custom ≥1000"
              value={customStake}
              onChange={(e) => handleCustomStake(e.target.value)}
              className="w-full px-4 py-4 bg-black/60 border border-green-500/50 rounded-xl text-white text-center text-lg focus:outline-none focus:border-green-400"
            />

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400">Current Stake</p>
              <p className="text-2xl font-bold text-green-400">
                {settings.stake.toLocaleString()} WEI
              </p>
            </div>
          </div>

          {/* House Rules */}
          <div className="bg-black/60 rounded-2xl p-6 border border-cyan-500/30">
            <h3 className="text-xl font-bold text-cyan-400 mb-5 text-center">House Rules</h3>
            <div className="space-y-4">
              {[
                { icon: RiAuctionFill, label: "Auction Unsold Properties", key: "auction" },
                { icon: GiPrisoner, label: "Pay Rent in Jail", key: "rentInPrison" },
                { icon: GiBank, label: "Allow Mortgages", key: "mortgage" },
                { icon: IoBuild, label: "Even Building Rule", key: "evenBuild" },
                { icon: FaRandom, label: "Random Play Order", key: "randomPlayOrder" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5 text-cyan-400" />
                    <span className="text-gray-300 text-sm">{item.label}</span>
                  </div>
                  <Switch
                    checked={settings[item.key as keyof typeof settings] as boolean}
                    onCheckedChange={(v) => handleSettingChange(item.key as keyof typeof settings, v)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Button - Smaller but still bold */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/80 to-transparent">
        <div className="max-w-md mx-auto">
          <button
            onClick={handlePlay}
            disabled={isCreatePending}
            className="w-full relative py-4 text-2xl font-orbitron font-bold tracking-wider
                       bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600
                       hover:from-pink-600 hover:via-purple-600 hover:to-cyan-500
                       rounded-2xl shadow-2xl transform hover:scale-105 active:scale-95
                       transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
                       border-4 border-white/20"
          >
            <span className="relative z-10 text-white drop-shadow-2xl">
              {isCreatePending ? "SUMMONING..." : "START BATTLE"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}