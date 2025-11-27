"use client";
import React, { useState } from "react";
import { FaUsers, FaUser } from "react-icons/fa6";
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
}

const GameSettings = () => {
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
  });

  const { data: isUserRegistered, isLoading: isRegisteredLoading } =
    useIsRegistered(address, { enabled: !!address });

  const gameType = settings.privateRoom ? "PRIVATE" : "PUBLIC";
  const gameCode = settings.code;
  const playerSymbol = settings.symbol;
  const numberOfPlayers = Number.parseInt(settings.maxPlayers, 10);

  const { data: username } = useGetUsername(address);
  const {
    write: createGame,
    isPending,
    error: contractError,
  } = useCreateGame(username ?? "", gameType, playerSymbol, numberOfPlayers, gameCode, Number(settings.startingCash));

  const handleSettingChange = (
    key: keyof Settings,
    value: string | boolean
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handlePlay = async () => {
    if (!address) {
      toast.error("Please connect your wallet", {
        position: "top-right",
        autoClose: 5000,
      });
      return;
    }

    if (!isUserRegistered) {
      toast.error("Please register before creating a game", {
        position: "top-right",
        autoClose: 5000,
      });
      router.push("/");
      return;
    }

    const toastId = toast.loading("Creating game...", {
      position: "top-right",
    });

    try {
      console.log("Calling createGame with settings:", settings);
      const gameId = await createGame();
      if (!gameId) {
        throw new Error("Invalid game ID retrieved");
      }
      const gameIdStr = gameId.toString();
      console.log("Game created with ID:", gameIdStr);

      const response = await apiClient.post<ApiResponse>("/games", {
        id: gameId,
        code: gameCode,
        mode: gameType,
        address,
        symbol: playerSymbol,
        number_of_players: numberOfPlayers,
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
        render: `Game created! Code: ${gameCode}`,
        type: "success",
        isLoading: false,
        autoClose: 3000,
        onClose: () => {
          setTimeout(
            () => router.push(`/game-waiting?gameCode=${gameCode}`),
            100
          );
        },
      });
    } catch (err: any) {
      console.error("Error creating game:", err);
      toast.update(toastId, {
        render:
          contractError?.message ||
          err.message ||
          "Failed to create game. Please try again.",
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    }
  };

  if (isRegisteredLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-settings bg-cover">
        <p className="text-[#00F0FF] text-3xl font-orbitron animate-pulse">LOADING ARENA...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-settings bg-cover bg-fixed flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-black/60 backdrop-blur-xl rounded-2xl border border-cyan-500/50 shadow-2xl p-6 md:p-10">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition"
          >
            <House className="w-4 h-4" />
            <span className="font-medium text-sm">BACK</span>
          </button>
          <h1 className="text-3xl md:text-4xl font-orbitron font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            CREATE GAME
          </h1>
          <div className="w-16" />
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Left Column – Core Settings */}
          <div className="space-y-5">

            {/* Avatar */}
            <div className="bg-gradient-to-br from-cyan-900/50 to-blue-900/50 rounded-xl p-5 border border-cyan-500/30">
              <div className="flex items-center gap-2 mb-3">
                <FaUser className="w-6 h-6 text-cyan-400" />
                <h3 className="text-xl font-bold text-cyan-300">Your Piece</h3>
              </div>
              <Select value={settings.symbol} onValueChange={v => handleSettingChange("symbol", v)}>
                <SelectTrigger className="h-12 bg-black/40 border-cyan-500/50 text-white text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GamePieces.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Max Players */}
            <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-xl p-5 border border-purple-500/30">
              <div className="flex items-center gap-2 mb-3">
                <FaUsers className="w-6 h-6 text-purple-400" />
                <h3 className="text-xl font-bold text-purple-300">Max Players</h3>
              </div>
              <Select value={settings.maxPlayers} onValueChange={v => handleSettingChange("maxPlayers", v)}>
                <SelectTrigger className="h-12 bg-black/40 border-purple-500/50 text-white text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2,3,4,5,6,7,8].map(n => (
                    <SelectItem key={n} value={n.toString()}>{n} Players</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Private Room */}
            <div className="bg-gradient-to-br from-emerald-900/50 to-teal-900/50 rounded-xl p-5 border border-emerald-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MdPrivateConnectivity className="w-6 h-6 text-emerald-400" />
                  <h3 className="text-xl font-bold text-emerald-300">Private Room</h3>
                </div>
                <Switch
                  checked={settings.privateRoom}
                  onCheckedChange={v => handleSettingChange("privateRoom", v)}
                />
              </div>
              <p className="text-gray-400 text-xs mt-1">Only joinable via link</p>
            </div>

            {/* Starting Cash */}
            <div className="bg-gradient-to-br from-yellow-900/50 to-amber-900/50 rounded-xl p-5 border border-yellow-500/30">
              <div className="flex items-center gap-2 mb-3">
                <FaHandHoldingDollar className="w-6 h-6 text-yellow-400" />
                <h3 className="text-xl font-bold text-yellow-300">Starting Cash</h3>
              </div>
              <Select value={settings.startingCash} onValueChange={v => handleSettingChange("startingCash", v)}>
                <SelectTrigger className="h-12 bg-black/40 border-yellow-500/50 text-white text-base">
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

          {/* Right Column – House Rules */}
          <div className="bg-black/70 rounded-xl p-6 border border-cyan-500/40">
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
                <div key={item.key} className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <item.icon className="w-7 h-7 text-cyan-400" />
                    <span className="text-white text-lg font-medium">{item.label}</span>
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

        {/* Create Game Button */}
        <div className="flex justify-center mt-10">
          <button
            onClick={handlePlay}
            disabled={isPending || isRegisteredLoading}
            className="px-16 py-5 text-2xl font-orbitron font-bold tracking-wider
                       bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-purple-600 hover:to-pink-600
                       rounded-xl shadow-2xl transform hover:scale-105 transition-all duration-300
                       disabled:opacity-60 disabled:cursor-not-allowed
                       border-4 border-cyan-400/80 relative overflow-hidden"
          >
            <span className="relative z-10 text-black drop-shadow-lg">
              {isPending ? "CREATING..." : "CREATE GAME"}
            </span>
            <div className="absolute inset-0 bg-white opacity-0 hover:opacity-30 transition-opacity" />
          </button>
        </div>

      </div>
    </div>
  );
};

export default GameSettings;