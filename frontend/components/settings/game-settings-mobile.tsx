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
  } = useCreateGame(username ?? "", gameType, playerSymbol, numberOfPlayers, gameCode, Number(settings.startingCash));

  const handleSettingChange = (
    key: keyof Settings,
    value: string | boolean
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
            CREATE GAME
          </h1>
          <div className="w-16 xs:w-20" />
        </div>

        {/* Settings - Horizontal rows (mobile-friendly) */}
        <div className="space-y-6 mb-8">

          {/* Your Piece */}
          <div className="bg-gradient-to-r from-cyan-900/60 to-blue-900/60 rounded-xl p-4 border border-cyan-500/40">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FaUser className="w-6 h-6 text-cyan-400" />
                <span className="text-cyan-300 font-bold text-base xs:text-lg">Your Piece</span>
              </div>
              <div className="w-40 xs:w-48">
                <Select value={settings.symbol} onValueChange={v => handleSettingChange("symbol", v)}>
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
            </div>
          </div>

          {/* Max Players */}
          <div className="bg-gradient-to-r from-purple-900/60 to-pink-900/60 rounded-xl p-4 border border-purple-500/40">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FaUsers className="w-6 h-6 text-purple-400" />
                <span className="text-purple-300 font-bold text-base xs:text-lg">Max Players</span>
              </div>
              <div className="w-40 xs:w-48">
                <Select value={settings.maxPlayers} onValueChange={v => handleSettingChange("maxPlayers", v)}>
                  <SelectTrigger className="h-10 xs:h-11 text-sm xs:text-base bg-black/50 border-purple-500/60 text-white">
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
                <MdPrivateConnectivity className="w-6 h-6 text-emerald-400" />
                <div>
                  <span className="text-emerald-300 font-bold text-base xs:text-lg">Private Room</span>
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
                <FaHandHoldingDollar className="w-6 h-6 text-yellow-400" />
                <span className="text-yellow-300 font-bold text-base xs:text-lg">Starting Cash</span>
              </div>
              <div className="w-40 xs:w-48">
                <Select value={settings.startingCash} onValueChange={v => handleSettingChange("startingCash", v)}>
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
            ].map(item => (
              <div key={item.key} className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <item.icon className="w-6 h-6 text-cyan-400" />
                  <span className="text-white text-base xs:text-lg font-medium">{item.label}</span>
                </div>
                <Switch
                  checked={settings[item.key as keyof Settings] as boolean}
                  onCheckedChange={v => handleSettingChange(item.key as keyof Settings, v)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Create Game Button - Smaller & centered */}
        <div className="flex justify-center">
          <button
            onClick={handlePlay}
            disabled={isPending}
            className="relative px-10 xs:px-14 py-4 xs:py-5 text-2xl xs:text-3xl font-orbitron font-bold tracking-wider
                       bg-gradient-to-r from-cyan-500 to-purple-600 
                       hover:from-purple-600 hover:to-pink-600
                       rounded-full shadow-2xl transform hover:scale-110 active:scale-105 transition-all duration-300
                       disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100
                       border-4 border-cyan-400/80 overflow-hidden group"
          >
            <span className="relative z-10 text-black drop-shadow-lg">
              {isPending ? "CREATING..." : "CREATE GAME"}
            </span>
            <div className="absolute inset-0 bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </button>
        </div>

      </div>
    </div>
  );
};

export default GameSettingsMobile;