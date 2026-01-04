"use client";

import React, { useState } from "react";
import { FaUsers, FaUser, FaCoins } from "react-icons/fa6";
import { House } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/game-switch";
import { MdPrivateConnectivity } from "react-icons/md";
import { RiAuctionFill } from "react-icons/ri";
import { GiBank, GiPrisoner } from "react-icons/gi";
import { IoBuild } from "react-icons/io5";
import { FaHandHoldingDollar } from "react-icons/fa6";
import { FaRandom } from "react-icons/fa";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { toast } from "react-toastify";
import { generateGameCode } from "@/lib/utils/games";
import { GamePieces } from "@/lib/constants/games";
import { apiClient } from "@/lib/api";
import { useIsRegistered, useGetUsername, useCreateGame } from "@/context/ContractProvider";
import { ApiResponse } from "@/types/api";

interface Settings {
  code: string;
  symbol: string;
  maxPlayers: string;
  privateRoom: boolean;
  auction: boolean;
  rentInPrison: boolean;
  mortgage: boolean;
  evenBuild: boolean;
  startingCash: string;
  randomPlayOrder: boolean;
  stake: number; // ← NEW: Stake
}

const GameSettingsMobile = () => {
  const router = useRouter();
  const { address } = useAccount();
  const [settings, setSettings] = useState<Settings>({
    code: generateGameCode(),
    symbol: "hat",
    maxPlayers: "2",
    privateRoom: false,
    auction: false,
    rentInPrison: false,
    mortgage: false,
    evenBuild: false,
    startingCash: "1500",
    randomPlayOrder: false,
    stake: 1, // ← Default stake = 1
  });

  const { data: isUserRegistered, isLoading: isRegisteredLoading } =
    useIsRegistered(address);

  const gameType = settings.privateRoom ? "PRIVATE" : "PUBLIC";
  const gameCode = settings.code;
  const playerSymbol = settings.symbol;
  const numberOfPlayers = Number.parseInt(settings.maxPlayers, 10);

  const { data: username } = useGetUsername(address);

  // Updated: pass stake to contract
  const {
    write: createGame,
    isPending,
  } = useCreateGame(
    username ?? "",
    gameType,
    playerSymbol,
    numberOfPlayers,
    gameCode,
    BigInt(settings.startingCash),
    BigInt(settings.stake) // ← Stake on-chain
  );

  const handleSettingChange = (
    key: keyof Settings,
    value: string | boolean | number
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handlePlay = async () => {
    if (!address) {
      toast.error("Please connect your wallet first!", { autoClose: 5000 });
      return;
    }

    if (!isUserRegistered) {
      toast.warn("You need to register before creating a game", { autoClose: 5000 });
      router.push("/");
      return;
    }

    const toastId = toast.loading("Creating your game room...", {
      position: "top-center",
    });

    try {
      const gameId = await createGame();
      if (!gameId) {
        throw new Error("Failed to get game ID from contract");
      }

      await apiClient.post<ApiResponse>("/games", {
        id: gameId,
        code: gameCode,
        mode: gameType,
        address,
        symbol: playerSymbol,
        number_of_players: numberOfPlayers,
        stake: settings.stake, // ← Save stake to backend
        settings: {
          auction: settings.auction,
          rent_in_prison: settings.rentInPrison,
          mortgage: settings.mortgage,
          even_build: settings.evenBuild,
          starting_cash: Number(settings.startingCash),
          randomize_play_order: settings.randomPlayOrder,
        },
      });

      toast.update(toastId, {
        render: `Game created! Share code: ${gameCode}`,
        type: "success",
        isLoading: false,
        autoClose: 4000,
        onClose: () => {
          router.push(`/game-waiting?gameCode=${gameCode}`);
        },
      });
    } catch (err: any) {
      if (
        err?.code === 4001 ||
        err?.message?.includes("User rejected") ||
        err?.message?.includes("User denied") ||
        err?.message?.includes("ACTION_REJECTED")
      ) {
        toast.update(toastId, {
          render: "You cancelled the transaction – no worries!",
          type: "info",
          isLoading: false,
          autoClose: 4000,
        });
        return;
      }

      let message = "Failed to create game. Please try again.";
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
        <p className="text-[#00F0FF] text-2xl xs:text-3xl sm:text-4xl font-orbitron animate-pulse text-center px-4">
          LOADING ARENA...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-settings bg-cover bg-fixed flex flex-col pt-safe pb-safe">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex justify-between items-center">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-cyan-400 hover:text-cyan-200 transition text-sm"
        >
          <House className="w-6 h-6" />
          <span className="font-medium">BACK</span>
        </button>
        <h1 className="text-4xl font-orbitron font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
          CREATE GAME
        </h1>
        <div className="w-12" />
      </div>

      {/* Scrollable Settings */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <div className="max-w-md mx-auto space-y-5">

          {/* Your Piece */}
          <div className="bg-gradient-to-r from-cyan-900/60 to-blue-900/60 rounded-xl p-4 border border-cyan-500/40">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FaUser className="w-7 h-7 text-cyan-400" />
                <span className="text-cyan-300 font-bold text-lg">Your Piece</span>
              </div>
              <div className="w-44">
                <Select value={settings.symbol} onValueChange={v => handleSettingChange("symbol", v)}>
                  <SelectTrigger className="h-11 bg-black/50 border-cyan-500/60 text-white">
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

          {/* Max Players */}
          <div className="bg-gradient-to-r from-purple-900/60 to-pink-900/60 rounded-xl p-4 border border-purple-500/40">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FaUsers className="w-7 h-7 text-purple-400" />
                <span className="text-purple-300 font-bold text-lg">Max Players</span>
              </div>
              <div className="w-44">
                <Select value={settings.maxPlayers} onValueChange={v => handleSettingChange("maxPlayers", v)}>
                  <SelectTrigger className="h-11 bg-black/50 border-purple-500/60 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2,3,4,5,6,7,8].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n} Players</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Private Room */}
          <div className="bg-gradient-to-r from-emerald-900/60 to-teal-900/60 rounded-xl p-4 border border-emerald-500/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MdPrivateConnectivity className="w-7 h-7 text-emerald-400" />
                <div>
                  <span className="text-emerald-300 font-bold text-lg">Private Room</span>
                  <p className="text-gray-400 text-xs">Only joinable via code</p>
                </div>
              </div>
              <Switch
                checked={settings.privateRoom}
                onCheckedChange={v => handleSettingChange("privateRoom", v)}
              />
            </div>
          </div>

          {/* Starting Cash */}
          <div className="bg-gradient-to-r from-yellow-900/60 to-amber-900/60 rounded-xl p-4 border border-yellow-500/40">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FaHandHoldingDollar className="w-7 h-7 text-yellow-400" />
                <span className="text-yellow-300 font-bold text-lg">Starting Cash</span>
              </div>
              <div className="w-44">
                <Select value={settings.startingCash} onValueChange={v => handleSettingChange("startingCash", v)}>
                  <SelectTrigger className="h-11 bg-black/50 border-yellow-500/60 text-white">
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

          {/* NEW: Stake */}
          <div className="bg-gradient-to-r from-green-900/60 to-emerald-900/60 rounded-xl p-4 border border-green-500/40">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FaCoins className="w-7 h-7 text-green-400" />
                <span className="text-green-300 font-bold text-lg">Entry Stake in WEI</span>
              </div>
              <div className="w-44">
                <Select value={settings.stake.toString()} onValueChange={v => handleSettingChange("stake", Number(v))}>
                  <SelectTrigger className="h-11 bg-black/50 border-green-500/60 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* House Rules */}
          <div className="bg-black/70 rounded-2xl p-6 border border-cyan-500/50">
            <h3 className="text-2xl font-orbitron font-bold text-cyan-300 mb-6 text-center">
              HOUSE RULES
            </h3>
            <div className="space-y-5">
              {[
                { icon: RiAuctionFill, label: "Auction", key: "auction" },
                { icon: GiPrisoner, label: "Rent in Jail", key: "rentInPrison" },
                { icon: GiBank, label: "Mortgage", key: "mortgage" },
                { icon: IoBuild, label: "Even Build", key: "evenBuild" },
                { icon: FaRandom, label: "Random Order", key: "randomPlayOrder" },
              ].map(item => (
                <div key={item.key} className="flex justify-between items-center py-2">
                  <div className="flex items-center gap-4">
                    <item.icon className="w-6 h-6 text-cyan-400" />
                    <span className="text-white text-base font-medium">{item.label}</span>
                  </div>
                  <Switch
                    checked={settings[item.key as keyof Settings] as boolean}
                    onCheckedChange={v => handleSettingChange(item.key as keyof Settings, v)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Button */}
      <div className="px-4 pb-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <button
          onClick={handlePlay}
          disabled={isPending}
          className="w-full py-5 text-2xl font-orbitron font-bold tracking-wider
                     bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600
                     hover:from-purple-600 hover:via-pink-600 hover:to-red-600
                     rounded-2xl shadow-2xl transform hover:scale-105 active:scale-95 transition-all duration-300
                     disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100
                     border-4 border-cyan-300/80 overflow-hidden group"
        >
          <span className="relative z-10 text-black drop-shadow-lg">
            {isPending ? "CREATING..." : "CREATE GAME"}
          </span>
          <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </button>
      </div>
    </div>
  );
};

export default GameSettingsMobile;