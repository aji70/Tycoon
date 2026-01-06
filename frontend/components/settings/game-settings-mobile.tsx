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
  stake: number;
}

const stakePresets = [1000, 5000, 10000, 25000, 50000, 100000];

export default function CreateGameMobile() {
  const router = useRouter();
  const { address } = useAccount();
  const [settings, setSettings] = useState<Settings>({
    code: generateGameCode(),
    symbol: "hat",
    maxPlayers: "4",
    privateRoom: false,
    auction: false,
    rentInPrison: false,
    mortgage: false,
    evenBuild: false,
    startingCash: "1500",
    randomPlayOrder: false,
    stake: 1000,
  });

  const [customStake, setCustomStake] = useState<string>("");

  const { data: isUserRegistered, isLoading: isRegisteredLoading } = useIsRegistered(address);
  const { data: username } = useGetUsername(address);

  const gameType = settings.privateRoom ? "PRIVATE" : "PUBLIC";
  const gameCode = settings.code;
  const playerSymbol = settings.symbol;
  const numberOfPlayers = Number.parseInt(settings.maxPlayers, 10);

  const { write: createGame, isPending } = useCreateGame(
    username ?? "",
    gameType,
    playerSymbol,
    numberOfPlayers,
    gameCode,
    BigInt(settings.startingCash),
    BigInt(settings.stake)
  );

  const handleSettingChange = (key: keyof Settings, value: string | boolean | number) => {
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
    if (!address) {
      toast.error("Please connect your wallet first!", { autoClose: 5000 });
      return;
    }

    if (!isUserRegistered) {
      toast.warn("You need to register before creating a game", { autoClose: 5000 });
      router.push("/");
      return;
    }

    const toastId = toast.loading("Creating your game room...", { position: "top-center" });

    try {
      const gameId = await createGame();
      if (!gameId) throw new Error("Failed to get game ID");

      await apiClient.post("/games", {
        id: gameId,
        code: gameCode,
        mode: gameType,
        address,
        symbol: playerSymbol,
        number_of_players: numberOfPlayers,
        stake: settings.stake,
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
        onClose: () => router.push(`/game-waiting?gameCode=${gameCode}`),
      });
    } catch (err: any) {
      let message = "Failed to create game. Please try again.";
      if (err?.message?.includes("insufficient funds")) message = "Not enough funds for gas fees";

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
            CREATE GAME
          </h1>
          <div className="w-20" />
        </div>
      </div>

      {/* Scrollable Settings */}
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

          {/* Max Players */}
          <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-2xl p-6 border border-purple-500/30">
            <div className="flex items-center gap-3 mb-4">
              <FaUsers className="w-7 h-7 text-purple-400" />
              <h3 className="text-xl font-bold text-purple-300">Max Players</h3>
            </div>
            <Select value={settings.maxPlayers} onValueChange={(v) => handleSettingChange("maxPlayers", v)}>
              <SelectTrigger className="h-14 bg-black/60 border-purple-500/40 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <SelectItem key={n} value={n.toString()}>{n} Players</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Private Room */}
          <div className="bg-black/60 rounded-2xl p-6 border border-gray-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MdPrivateConnectivity className="w-7 h-7 text-emerald-400" />
                <div>
                  <h3 className="text-xl font-bold text-white">Private Room</h3>
                  <p className="text-gray-400 text-sm">Only joinable via code</p>
                </div>
              </div>
              <Switch checked={settings.privateRoom} onCheckedChange={(v) => handleSettingChange("privateRoom", v)} />
            </div>
          </div>

          {/* Starting Cash */}
          <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/40 rounded-2xl p-6 border border-amber-500/30">
            <div className="flex items-center gap-3 mb-4">
              <FaHandHoldingDollar className="w-7 h-7 text-amber-400" />
              <h3 className="text-xl font-bold text-amber-300">Starting Cash</h3>
            </div>
            <Select value={settings.startingCash} onValueChange={(v) => handleSettingChange("startingCash", v)}>
              <SelectTrigger className="h-14 bg-black/60 border-amber-500/40 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["500", "1000", "1500", "2000", "5000"].map((amt) => (
                  <SelectItem key={amt} value={amt}>${amt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Entry Stake - Full identical version */}
          <div className="bg-gradient-to-b from-green-900/60 to-emerald-900/60 rounded-2xl p-8 border border-green-500/40 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <FaCoins className="w-8 h-8 text-green-400" />
              <h3 className="text-2xl font-bold text-green-300">Entry Stake (WEI)</h3>
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
                    checked={settings[item.key as keyof Settings] as boolean}
                    onCheckedChange={(v) => handleSettingChange(item.key as keyof Settings, v)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Button - Mobile Optimized */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/80 to-transparent">
        <div className="max-w-md mx-auto">
          <button
            onClick={handlePlay}
            disabled={isPending}
            className="w-full relative py-5 text-2xl font-orbitron font-bold tracking-wider
                       bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600
                       hover:from-pink-600 hover:via-purple-600 hover:to-cyan-500
                       rounded-2xl shadow-2xl transform hover:scale-105 active:scale-95
                       transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
                       border-4 border-white/20"
          >
            <span className="relative z-10 text-white drop-shadow-2xl">
              {isPending ? "CREATING..." : "CREATE GAME"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}