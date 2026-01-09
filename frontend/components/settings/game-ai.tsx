"use client";

import React, { useState } from "react";
import { FaUser, FaRobot, FaBrain, FaCoins } from "react-icons/fa6";
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
import { useAppKitNetwork } from "@reown/appkit/react";
import { toast } from "react-toastify";
import { generateGameCode } from "@/lib/utils/games";
import { GamePieces } from "@/lib/constants/games";
import { apiClient } from "@/lib/api";
import {
  useIsRegistered,
  useGetUsername,
  useCreateAIGame,
} from "@/context/ContractProvider";
import { TYCOON_CONTRACT_ADDRESSES, MINIPAY_CHAIN_IDS } from "@/constants/contracts";
import { Address } from "viem";

interface GameCreateResponse {
  data?: {
    data?: { id: string | number };
    id?: string | number;
  };
  id?: string | number;
}

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
  const { caipNetwork } = useAppKitNetwork();

  const { data: username } = useGetUsername(address);
  const { data: isUserRegistered, isLoading: isRegisteredLoading } = useIsRegistered(address);

  const isMiniPay = !!caipNetwork?.id && MINIPAY_CHAIN_IDS.includes(Number(caipNetwork.id));
  const chainName = caipNetwork?.name?.toLowerCase().replace(" ", "") || `chain-${caipNetwork?.id ?? "unknown"}`;

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
    duration: 60, // minutes
  });

  const contractAddress = TYCOON_CONTRACT_ADDRESSES[caipNetwork?.id as keyof typeof TYCOON_CONTRACT_ADDRESSES] as Address | undefined;

  const gameCode = generateGameCode();
  const totalPlayers = settings.aiCount + 1;

  const { write: createAiGame, isPending: isCreatePending } = useCreateAIGame(
    username || "",
    "PRIVATE",
    settings.symbol,
    settings.aiCount,           // ← number of AI opponents
    gameCode,
    BigInt(settings.startingCash)
  );

  const handlePlay = async () => {
    if (!address || !username || !isUserRegistered) {
      toast.error("Please connect your wallet and register first!", { autoClose: 5000 });
      return;
    }

    if (!contractAddress) {
      toast.error("Game contract not deployed on this network.");
      return;
    }

    const toastId = toast.loading(`Summoning ${settings.aiCount} AI opponent${settings.aiCount > 1 ? "s" : ""}...`);

    try {
      toast.update(toastId, { render: "Creating AI game on-chain..." });
      const onChainGameId = await createAiGame();
      if (!onChainGameId) throw new Error("Failed to create game on-chain");

      toast.update(toastId, { render: "Saving game to server..." });

      let dbGameId: string | number | undefined;
      try {
        const saveRes: GameCreateResponse = await apiClient.post("/games", {
          id: onChainGameId.toString(),
          code: gameCode,
          mode: "PRIVATE",
          address: address,
          symbol: settings.symbol,
          number_of_players: totalPlayers,
          ai_opponents: settings.aiCount,
          ai_difficulty: settings.aiDifficulty,
          starting_cash: settings.startingCash,
          is_ai: true,
          is_minipay: isMiniPay,
          chain: chainName,
          duration: settings.duration,
          settings: {
            auction: settings.auction,
            rent_in_prison: settings.rentInPrison,
            mortgage: settings.mortgage,
            even_build: settings.evenBuild,
            randomize_play_order: settings.randomPlayOrder,
          },
        });

        dbGameId =
          typeof saveRes === "string" || typeof saveRes === "number"
            ? saveRes
            : saveRes?.data?.data?.id ?? saveRes?.data?.id ?? saveRes?.id;

        if (!dbGameId) throw new Error("Backend did not return game ID");
      } catch (backendError: any) {
        console.error("Backend save error:", backendError);
        throw new Error(backendError.response?.data?.message || "Failed to save game on server");
      }

      toast.update(toastId, { render: "Adding AI opponents..." });

      let availablePieces = GamePieces.filter((p) => p.id !== settings.symbol);
      for (let i = 0; i < settings.aiCount; i++) {
        if (availablePieces.length === 0) availablePieces = [...GamePieces];
        const randomIndex = Math.floor(Math.random() * availablePieces.length);
        const aiSymbol = availablePieces[randomIndex].id;
        availablePieces.splice(randomIndex, 1);

        const aiAddress = ai_address[i];

        try {
          await apiClient.post("/game-players/join", {
            address: aiAddress,
            symbol: aiSymbol,
            code: gameCode,
          });
        } catch (joinErr) {
          console.warn(`AI player ${i + 1} failed to join:`, joinErr);
        }
      }

      try {
        await apiClient.put(`/games/${dbGameId}`, { status: "RUNNING" });
      } catch (statusErr) {
        console.warn("Failed to set game status to RUNNING:", statusErr);
      }

      toast.update(toastId, {
        render: "Battle begins! Good luck, Tycoon!",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });

      router.push(`/ai-play?gameCode=${gameCode}`);
    } catch (err: any) {
      console.error("handlePlay error:", err);

      let message = "Something went wrong. Please try again.";

      if (err.message?.includes("user rejected")) {
        message = "Transaction rejected by user.";
      }

      toast.update(toastId, {
        render: message,
        type: "error",
        isLoading: false,
        autoClose: 8000,
      });
    }
  };

  if (isRegisteredLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-settings bg-cover">
        <p className="text-[#00F0FF] text-4xl font-orbitron animate-pulse tracking-wider">
          LOADING ARENA...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-settings bg-cover bg-fixed flex items-center justify-center p-6">
      <div className="w-full max-w-5xl bg-black/80 backdrop-blur-3xl rounded-3xl border border-cyan-500/30 shadow-2xl p-8 md:p-12">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-3 text-cyan-400 hover:text-cyan-300 transition group"
          >
            <House className="w-6 h-6 group-hover:-translate-x-1 transition" />
            <span className="font-bold text-lg">BACK</span>
          </button>
          <h1 className="text-5xl font-orbitron font-extrabold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            AI DUEL
          </h1>
          <div className="w-24" />
        </div>

        {/* Main Grid - Adjusted layout after stake removal */}
        <div className="grid lg:grid-cols-3 gap-8 mb-10">
          {/* Column 1 */}
          <div className="space-y-6">
            {/* Your Piece */}
            <div className="bg-gradient-to-br from-cyan-900/40 to-blue-900/40 rounded-2xl p-6 border border-cyan-500/30">
              <div className="flex items-center gap-3 mb-4">
                <FaUser className="w-7 h-7 text-cyan-400" />
                <h3 className="text-xl font-bold text-cyan-300">Your Piece</h3>
              </div>
              <Select value={settings.symbol} onValueChange={(v) => setSettings((p) => ({ ...p, symbol: v }))}>
                <SelectTrigger className="h-14 bg-black/60 border-cyan-500/40 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GamePieces.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
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
              <Select
                value={settings.aiCount.toString()}
                onValueChange={(v) => setSettings((p) => ({ ...p, aiCount: +v }))}
              >
                <SelectTrigger className="h-14 bg-black/60 border-purple-500/40 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} AI
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Difficulty */}
            <div className="bg-gradient-to-br from-red-900/40 to-orange-900/40 rounded-2xl p-6 border border-red-500/30">
              <div className="flex items-center gap-3 mb-4">
                <FaBrain className="w-7 h-7 text-red-400" />
                <h3 className="text-xl font-bold text-red-300">AI Difficulty</h3>
              </div>
              <Select
                value={settings.aiDifficulty}
                onValueChange={(v) => setSettings((p) => ({ ...p, aiDifficulty: v as any }))}
              >
                <SelectTrigger className="h-14 bg-black/60 border-red-500/40 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                  <SelectItem value="boss" className="text-pink-400 font-bold">
                    BOSS MODE
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Column 2 - Starting Cash (moved here to fill space) */}
          <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/40 rounded-2xl p-6 border border-amber-500/30">
            <div className="flex items-center gap-3 mb-4">
              <FaCoins className="w-7 h-7 text-amber-400" />
              <h3 className="text-xl font-bold text-amber-300">Starting Cash</h3>
            </div>
            <Select
              value={settings.startingCash.toString()}
              onValueChange={(v) => setSettings((p) => ({ ...p, startingCash: +v }))}
            >
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

            {/* Game Duration - placed here as secondary option */}
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-4">
                <FaBrain className="w-7 h-7 text-indigo-400" />
                <h3 className="text-xl font-bold text-indigo-300">Game Duration</h3>
              </div>
              <Select
                value={settings.duration.toString()}
                onValueChange={(v) => setSettings((p) => ({ ...p, duration: +v }))}
              >
                <SelectTrigger className="h-14 bg-black/60 border-indigo-500/40 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                  <SelectItem value="90">90 minutes</SelectItem>
                  <SelectItem value="0">No limit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Column 3 - House Rules */}
          <div className="space-y-6">
            <div className="bg-black/60 rounded-2xl p-6 border border-cyan-500/30 h-full">
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
                      onCheckedChange={(v) => setSettings((p) => ({ ...p, [item.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Start Button */}
        <div className="flex justify-center mt-12">
          <button
            onClick={handlePlay}
            disabled={isCreatePending}
            className="relative px-24 py-6 text-3xl font-orbitron font-black tracking-widest
                     bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600
                     hover:from-pink-600 hover:via-purple-600 hover:to-cyan-500
                     rounded-2xl shadow-2xl transform hover:scale-105 active:scale-100
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