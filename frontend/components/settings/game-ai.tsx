"use client";

import React, { useState } from "react";
import { FaUser, FaRobot, FaBrain, FaCoins } from "react-icons/fa6";
import { FaRandom } from "react-icons/fa";
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
import { TYCOON_CONTRACT_ADDRESSES } from "@/constants/contracts";
import { Address } from "viem";

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

interface GameCreateResponse {
  data?: {
    data?: { id: string | number };
    id?: string | number;
  };
  id?: string | number;
}

export default function PlayWithAI() {
  const router = useRouter();
  const { address } = useAccount();
  const { caipNetwork } = useAppKitNetwork();

  const { data: username } = useGetUsername(address);
  const { data: isUserRegistered, isLoading: isRegisteredLoading } = useIsRegistered(address);

  const contractAddress = TYCOON_CONTRACT_ADDRESSES[caipNetwork?.id as keyof typeof TYCOON_CONTRACT_ADDRESSES] as Address | undefined;

  const gameCode = generateGameCode();
  const chainName = caipNetwork?.name?.toLowerCase().replace(" ", "") || `chain-${caipNetwork?.id ?? "unknown"}`;

  const { write: createAiGame, isPending: isCreatePending } = useCreateAIGame(
    username || "",
    "PRIVATE",
    "hat", // will be overridden anyway
    1,     // will be overridden
    gameCode,
    BigInt(1500) // placeholder
  );

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

    const totalPlayers = settings.aiCount + 1;

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
          is_minipay: false,
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-4xl font-orbitron text-cyan-400 animate-pulse tracking-widest">
          LOADING ARENA...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-settings bg-cover bg-fixed flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-5xl bg-black/65 backdrop-blur-xl rounded-2xl border border-cyan-500/40 shadow-2xl p-6 md:p-10">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6 mb-10">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <House className="w-6 h-6" />
            <span className="font-medium tracking-wide">BACK</span>
          </button>

          <h1 className="text-5xl md:text-6xl font-orbitron font-black bg-gradient-to-r from-cyan-400 via-cyan-300 to-purple-500 bg-clip-text text-transparent">
            AI DUEL
          </h1>

          <div className="w-24 hidden sm:block" />
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">

          {/* Left – Settings */}
          <div className="space-y-5">

            {/* Your Piece */}
            <div className="p-6 rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/60 to-blue-950/40">
              <div className="flex items-center gap-3 mb-4">
                <FaUser className="w-7 h-7 text-cyan-400" />
                <h3 className="text-xl md:text-2xl text-cyan-300 font-bold">Your Piece</h3>
              </div>
              <Select
                value={settings.symbol}
                onValueChange={(v) => setSettings((s) => ({ ...s, symbol: v }))}
              >
                <SelectTrigger className="h-12 bg-black/50 border-cyan-600/60 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-950 border-cyan-800">
                  {GamePieces.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* AI Count */}
            <div className="p-6 rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-950/60 to-pink-950/40">
              <div className="flex items-center gap-3 mb-4">
                <FaRobot className="w-7 h-7 text-purple-400" />
                <h3 className="text-xl md:text-2xl text-purple-300 font-bold">AI Opponents</h3>
              </div>
              <Select
                value={String(settings.aiCount)}
                onValueChange={(v) => setSettings((s) => ({ ...s, aiCount: Number(v) }))}
              >
                <SelectTrigger className="h-12 bg-black/50 border-purple-600/60 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-950 border-purple-800">
                  {[1, 2, 3].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} AI
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Difficulty */}
            <div className="p-6 rounded-xl border border-red-500/30 bg-gradient-to-br from-red-950/60 to-orange-950/40">
              <div className="flex items-center gap-3 mb-4">
                <FaBrain className="w-7 h-7 text-red-400" />
                <h3 className="text-xl md:text-2xl text-red-300 font-bold">Difficulty</h3>
              </div>
              <Select
                value={settings.aiDifficulty}
                onValueChange={(v) =>
                  setSettings((s) => ({ ...s, aiDifficulty: v as typeof settings.aiDifficulty }))
                }
              >
                <SelectTrigger className="h-12 bg-black/50 border-red-600/60 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-950 border-red-800">
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                  <SelectItem value="boss">BOSS MODE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Starting Cash */}
            <div className="p-6 rounded-xl border border-yellow-500/30 bg-gradient-to-br from-yellow-950/60 to-amber-950/40">
              <div className="flex items-center gap-3 mb-4">
                <FaCoins className="w-7 h-7 text-yellow-400" />
                <h3 className="text-xl md:text-2xl text-yellow-300 font-bold">Starting Cash</h3>
              </div>
              <Select
                value={String(settings.startingCash)}
                onValueChange={(v) => setSettings((s) => ({ ...s, startingCash: Number(v) }))}
              >
                <SelectTrigger className="h-12 bg-black/50 border-yellow-600/60 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-950 border-yellow-800">
                  {[500, 1000, 1500, 2000, 5000].map((v) => (
                    <SelectItem key={v} value={String(v)}>
                      ${v.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Right – House Rules */}
          <div className="p-6 md:p-8 rounded-xl border border-cyan-500/40 bg-black/70">
            <h3 className="text-2xl md:text-3xl font-orbitron font-bold text-cyan-300 mb-6 text-center tracking-wide">
              HOUSE RULES
            </h3>

            <div className="space-y-5">
              {[
                { icon: RiAuctionFill, label: "Auction Unsold Properties", key: "auction" },
                { icon: GiPrisoner, label: "Pay Rent in Jail", key: "rentInPrison" },
                { icon: GiBank, label: "Allow Mortgages", key: "mortgage" },
                { icon: IoBuild, label: "Even Building Rule", key: "evenBuild" },
                { icon: FaRandom, label: "Random Play Order", key: "randomPlayOrder" },
              ].map((rule) => (
                <div key={rule.key} className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <rule.icon className="w-6 h-6 text-cyan-400" />
                    <span className="text-gray-100 text-lg">{rule.label}</span>
                  </div>
                  <Switch
                    checked={settings[rule.key as keyof typeof settings] as boolean}
                    onCheckedChange={(v) => setSettings((s) => ({ ...s, [rule.key]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* START BUTTON */}
        <div className="flex justify-center mt-10 md:mt-12">
          <button
            onClick={handlePlay}
            disabled={isCreatePending}
            className={`
              px-16 md:px-24 py-6 text-2xl md:text-3xl font-orbitron font-black tracking-wider
              bg-gradient-to-r from-cyan-600 to-purple-700 hover:from-purple-600 hover:to-pink-600
              rounded-xl shadow-2xl transform hover:scale-105 transition-all duration-300
              border-4 border-cyan-400/70 relative overflow-hidden
              disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed
            `}
          >
            {isCreatePending ? "SUMMONING..." : "START BATTLE"}
          </button>
        </div>
      </div>
    </div>
  );
}