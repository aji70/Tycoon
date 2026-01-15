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
    duration: 60,
  });

  const contractAddress = TYCOON_CONTRACT_ADDRESSES[caipNetwork?.id as keyof typeof TYCOON_CONTRACT_ADDRESSES] as Address | undefined;

  const gameCode = generateGameCode();

  const { write: createAiGame, isPending: isCreatePending } = useCreateAIGame(
    username || "",
    "PRIVATE",
    settings.symbol,
    settings.aiCount,
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
          number_of_players: settings.aiCount + 1,
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
      <div className="w-full h-screen flex items-center justify-center bg-[#010F10]">
        <p className="font-orbitron text-[#00F0FF] text-4xl animate-pulse tracking-wider">
          LOADING ARENA...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#010F10] py-12 px-5 md:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-12 gap-6">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-3 text-[#00F0FF] hover:text-[#17ffff] transition group text-lg"
          >
            <House className="w-7 h-7 group-hover:-translate-x-1 transition" />
            <span className="font-orbitron font-bold tracking-wide">BACK</span>
          </button>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-orbitron font-black text-[#00F0FF] tracking-[-0.02em]">
            AI DUEL
          </h1>

          <div className="w-32 hidden sm:block" />
        </div>

        <div className="grid lg:grid-cols-3 gap-7">
          {/* Column 1 */}
          <div className="space-y-7">
            {[
              {
                icon: FaUser,
                title: "YOUR PIECE",
                value: settings.symbol,
                onChange: (v: string) => setSettings((p) => ({ ...p, symbol: v })),
                options: GamePieces.map((p) => ({ value: p.id, label: p.name })),
              },
              {
                icon: FaRobot,
                title: "AI OPPONENTS",
                value: settings.aiCount.toString(),
                onChange: (v: string) => setSettings((p) => ({ ...p, aiCount: +v })),
                options: [1, 2, 3, 4, 5, 6].map((n) => ({ value: n.toString(), label: `${n} AI` })),
              },
              {
                icon: FaBrain,
                title: "AI DIFFICULTY",
                value: settings.aiDifficulty,
                onChange: (v: string) => setSettings((p) => ({ ...p, aiDifficulty: v as any })),
                options: [
                  { value: "easy", label: "Easy" },
                  { value: "medium", label: "Medium" },
                  { value: "hard", label: "Hard" },
                  { value: "boss", label: "BOSS MODE" },
                ],
              },
            ].map((section, i) => (
              <div
                key={i}
                className="bg-[#0E1415]/70 backdrop-blur-sm rounded-2xl p-7 border border-[#004B4F]"
              >
                <div className="flex items-center gap-4 mb-5">
                  <section.icon className="w-8 h-8 text-[#00F0FF]" />
                  <h3 className="text-2xl font-orbitron font-bold text-[#00F0FF] tracking-wide">
                    {section.title}
                  </h3>
                </div>

                <Select value={section.value} onValueChange={section.onChange}>
                  <SelectTrigger className="h-14 bg-[#0E1415]/80 border-[#004B4F] text-[#17ffff] font-orbitron focus:ring-0 focus:ring-offset-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0E1415] border-[#004B4F] text-[#DDEEEE]">
                    {section.options.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="focus:bg-[#004B4F]/40 text-[#17ffff] font-orbitron py-3"
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {/* Column 2 */}
          <div className="space-y-7">
            {[
              {
                icon: FaCoins,
                title: "STARTING CASH",
                value: settings.startingCash.toString(),
                onChange: (v: string) => setSettings((p) => ({ ...p, startingCash: +v })),
                options: [500, 1000, 1500, 2000, 5000].map((v) => ({
                  value: v.toString(),
                  label: `$${v.toLocaleString()}`,
                })),
              },
              {
                icon: FaBrain,
                title: "GAME DURATION",
                value: settings.duration.toString(),
                onChange: (v: string) => setSettings((p) => ({ ...p, duration: +v })),
                options: [
                  { value: "30", label: "30 minutes" },
                  { value: "45", label: "45 minutes" },
                  { value: "60", label: "60 minutes" },
                  { value: "90", label: "90 minutes" },
                  { value: "0", label: "No limit" },
                ],
              },
            ].map((section, i) => (
              <div
                key={i}
                className="bg-[#0E1415]/70 backdrop-blur-sm rounded-2xl p-7 border border-[#004B4F]"
              >
                <div className="flex items-center gap-4 mb-5">
                  <section.icon className="w-8 h-8 text-[#00F0FF]" />
                  <h3 className="text-2xl font-orbitron font-bold text-[#00F0FF] tracking-wide">
                    {section.title}
                  </h3>
                </div>

                <Select value={section.value} onValueChange={section.onChange}>
                  <SelectTrigger className="h-14 bg-[#0E1415]/80 border-[#004B4F] text-[#17ffff] font-orbitron focus:ring-0 focus:ring-offset-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0E1415] border-[#004B4F] text-[#DDEEEE]">
                    {section.options.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="focus:bg-[#004B4F]/40 text-[#17ffff] font-orbitron py-3"
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {/* Column 3 - House Rules */}
          <div className="bg-[#0E1415]/70 backdrop-blur-sm rounded-2xl p-7 border border-[#004B4F] h-full">
            <h3 className="text-2xl font-orbitron font-bold text-[#00F0FF] mb-8 text-center tracking-wide">
              HOUSE RULES
            </h3>
            <div className="space-y-6">
              {[
                { icon: RiAuctionFill, label: "Auction Unsold Properties", key: "auction" },
                { icon: GiPrisoner, label: "Pay Rent in Jail", key: "rentInPrison" },
                { icon: GiBank, label: "Allow Mortgages", key: "mortgage" },
                { icon: IoBuild, label: "Even Building Rule", key: "evenBuild" },
                { icon: FaRandom, label: "Random Play Order", key: "randomPlayOrder" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <item.icon className="w-7 h-7 text-[#00F0FF]" />
                    <span className="text-[#DDEEEE] font-dmSans text-lg">{item.label}</span>
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

        {/* START BATTLE Button */}
        <div className="flex justify-center mt-16 mb-10">
          <button
            onClick={handlePlay}
            disabled={isCreatePending}
            className="relative w-full max-w-xl h-20 transition-transform active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 360 80"
              fill="none"
              preserveAspectRatio="none"
            >
              <path
                d="M20 4H340C346.627 4 349.5 11.0728 346.824 16.16L332.176 63.84C329.824 68.9272 325.373 72 320.824 72H20C13.373 72 10 64.9272 10 59.84V20.16C10 15.0728 13.373 8 20 8Z"
                fill="#00F0FF"
                stroke="#0E282A"
                strokeWidth="4"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-3xl md:text-4xl font-orbitron font-black tracking-wider">
              {isCreatePending ? "SUMMONING..." : "START BATTLE"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}