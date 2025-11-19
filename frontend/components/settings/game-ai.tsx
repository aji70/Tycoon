"use client";

import React, { useState } from "react";
import { FaRobot, FaUser, FaBrain } from "react-icons/fa6";
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
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";
import { checksumAddress } from "viem";

function generateAiAddress(): `0x${string}` {
  const pk = generatePrivateKey();
  const addr = privateKeyToAddress(pk);
  return checksumAddress(("0xA1FF" + addr.slice(6)) as `0x${string}`);
}

async function generateUniqueAiUsername(): Promise<string> {
  const names = [
    "DeepLord", "NeuralKing", "AI_Tycoon", "Bot_X9", "Quantum",
    "AlgoBoss", "CyberMogul", "ChainRival", "NodeBeast", "ZeroForge"
  ];

  for (const name of names) {
    try {
      const res = await apiClient.get<any>(`/users/check-username/${name}`);
      if (res.data && !res.data.exists && !res.data.data?.exists) {
        return name;
      }
    } catch {
      continue;
    }
  }
  return `AI_${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
}

export default function PlayWithAI() {
  const router = useRouter();
  const { address } = useAccount();
  const { data: username } = useGetUsername(address, { enabled: !!address });
  const { data: isUserRegistered, isLoading: isRegisteredLoading } = useIsRegistered(address, { enabled: !!address });

  const [settings, setSettings] = useState({
    symbol: "hat",
    aiDifficulty: "boss" as "easy" | "medium" | "hard" | "boss",
    auction: true,
    rentInPrison: false,
    mortgage: true,
    evenBuild: true,
    randomPlayOrder: true,
  });

  const gameCode = generateGameCode();

  const { write: createAiGame, isPending: isCreatePending } = useCreateAiGame(
    username || "",
    "PRIVATE",
    settings.symbol,
    2,
    gameCode,
    1500
  );

  const handlePlay = async () => {
    if (!address || !username || !isUserRegistered) {
      toast.error("Connect wallet & register first");
      return;
    }

    const toastId = toast.loading("Summoning AI rival...", { position: "top-right" });

    try {
      // 1. On-chain game
      const onChainGameId = await createAiGame();
      if (!onChainGameId) throw new Error("On-chain failed");

      toast.update(toastId, { render: "Saving game..." });

      // 2. Save to DB
      const saveRes = await apiClient.post<any>("/games", {
        id: onChainGameId,
        code: gameCode,
        mode: "PRIVATE",
        address,
        symbol: settings.symbol,
        number_of_players: 2,
        ai_opponents: 1,
        ai_difficulty: settings.aiDifficulty,
        settings: {
          auction: settings.auction,
          rent_in_prison: settings.rentInPrison,
          mortgage: settings.mortgage,
          even_build: settings.evenBuild,
          starting_cash: 1500,
          randomize_play_order: settings.randomPlayOrder,
        },
      });

      // Works no matter what your backend returns
      const dbGameId = saveRes.data?.data?.id ?? saveRes.data?.id ?? saveRes.data;
      if (!dbGameId) throw new Error("No game ID returned");
      
      // 4. AI joins
      const aiAddress = generateAiAddress();
      const aiName = await generateUniqueAiUsername();

      await apiClient.post("/users", {
        username: aiName,
        address: aiAddress,
        chain: "Base",
      });

      const available = GamePieces.filter(p => p.id !== settings.symbol);
      const aiSymbol = available.length > 0 ? available[Math.floor(Math.random() * available.length)].id : "dog";

      await apiClient.post("/game-players/join", {
        address: aiAddress,
        symbol: aiSymbol,
        code: gameCode,
      });

      // 5. Start game
      await apiClient.put(`/games/${dbGameId}`, { status: "RUNNING" });

      toast.update(toastId, {
        render: `${aiName} is ready! Battle begins!`,
        type: "success",
        isLoading: false,
        autoClose: 3000,
      });

      router.push(`/game-play?gameCode=${gameCode}`);
    } catch (err: any) {
      toast.update(toastId, {
        render: `Failed: ${err.message || "Try again"}`,
        type: "error",
        isLoading: false,
        autoClose: 8000,
      });
    }
  };

  if (isRegisteredLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-settings bg-cover">
        <p className="text-[#00F0FF] text-3xl font-orbitron animate-pulse">Loading...</p>
      </div>
    );
  }

  return (
    <section className="w-full min-h-screen bg-settings bg-cover bg-fixed bg-center">
      <main className="w-full h-auto py-20 flex flex-col items-center justify-start bg-[#010F101F] backdrop-blur-[12px] px-4">

        {/* Back Button */}
        <div className="w-full max-w-[792px] flex justify-start mb-6">
          <button onClick={() => router.push("/")} className="relative group w-[227px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer">
            <svg width="227" height="40" viewBox="0 0 227 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute top-0 left-0 w-full h-full">
              <path d="M6 1H221C225.373 1 227.996 5.85486 225.601 9.5127L207.167 37.5127C206.151 39.0646 204.42 40 202.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z" fill="#0E1415" stroke="#003B3E" strokeWidth={1} className="group-hover:stroke-[#00F0FF] transition-all duration-300" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[#0FF0FC] text-[13px] font-dmSans font-medium z-10">
              <House className="mr-1 w-[14px] h-[14px]" /> Go Back Home
            </span>
          </button>
        </div>

        <div className="w-full flex flex-col items-center mb-8">
          <h2 className="text-[#F0F7F7] font-orbitron text-[32px] font-bold text-center">1v1 AI Duel</h2>
          <p className="text-[#869298] text-[16px] font-dmSans text-center mt-2">Instant start • No waiting • Pure skill</p>
        </div>

        {/* Avatar & Difficulty */}
        <div className="w-full max-w-[792px] bg-[#010F10] rounded-[12px] border border-[#003B3E] p-[40px] space-y-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <FaUser className="w-8 h-8 text-[#F0F7F7]" />
              <div>
                <h4 className="text-[#F0F7F7] text-[22px] font-[600]">Your Avatar</h4>
                <p className="text-[#455A64] text-[16px]">Choose your game piece</p>
              </div>
            </div>
            <Select value={settings.symbol} onValueChange={(v) => setSettings(p => ({ ...p, symbol: v }))}>
              <SelectTrigger className="w-[180px] h-[40px] border-[#263238] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GamePieces.map(piece => (
                  <SelectItem key={piece.id} value={piece.id}>
                    {piece.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <FaBrain className="w-8 h-8 text-[#F0F7F7]" />
              <div>
                <h4 className="text-[#F0F7F7] text-[22px] font-[600]">AI Difficulty</h4>
                <p className="text-[#455A64] text-[16px]">How hard do you want it?</p>
              </div>
            </div>
            <Select value={settings.aiDifficulty} onValueChange={(v: any) => setSettings(p => ({ ...p, aiDifficulty: v }))}>
              <SelectTrigger className="w-[180px] h-[40px] border-[#263238] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
                <SelectItem value="boss">BOSS MODE</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Rules */}
        <div className="w-full mt-16 mb-6 text-center">
          <h2 className="text-[#F0F7F7] font-orbitron text-[24px] font-bold">Gameplay Rules</h2>
        </div>

        <div className="w-full max-w-[792px] bg-[#010F10] rounded-[12px] border border-[#003B3E] p-[40px] space-y-6">
          {[
            { icon: RiAuctionFill, label: "Auction", key: "auction" },
            { icon: GiPrisoner, label: "Rent in Prison", key: "rentInPrison" },
            { icon: GiBank, label: "Mortgage", key: "mortgage" },
            { icon: IoBuild, label: "Even Build", key: "evenBuild" },
            { icon: FaRandom, label: "Random Play Order", key: "randomPlayOrder" },
          ].map(r => (
            <div key={r.key} className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <r.icon className="w-8 h-8 text-[#F0F7F7]" />
                <span className="text-[#F0F7F7] text-[20px]">{r.label}</span>
              </div>
              <Switch
                checked={settings[r.key as keyof typeof settings] as boolean}
                onCheckedChange={v => setSettings(p => ({ ...p, [r.key]: v }))}
              />
            </div>
          ))}
        </div>

        {/* Play Button */}
        <div className="w-full max-w-[792px] flex justify-end mt-12">
          <button
            onClick={handlePlay}
            disabled={isCreatePending}
            className="relative group w-[260px] h-[52px] bg-transparent border-none p-0 overflow-hidden cursor-pointer disabled:opacity-60"
          >
            <svg width="260" height="52" viewBox="0 0 260 52" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]">
              <path d="M10 1H250C254.373 1 256.996 6.85486 254.601 10.5127L236.167 49.5127C235.151 51.0646 233.42 52 231.565 52H10C6.96244 52 4.5 49.5376 4.5 46.5V9.5C4.5 6.46243 6.96243 4 10 4Z" fill="#00F0FF" stroke="#0E282A" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-[18px] font-orbitron font-bold z-10">
              {isCreatePending ? "SUMMONING..." : "DUEL THE AI"}
            </span>
          </button>
        </div>
      </main>
    </section>
  );
}