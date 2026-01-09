"use client";

import React, { useState } from "react";
import { FaUsers, FaUser, FaCoins, FaBrain } from "react-icons/fa6";
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
import { FaRandom } from "react-icons/fa";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useChainId,
  useReadContract,
} from 'wagmi';
import { useAppKitNetwork } from '@reown/appkit/react';
import { toast } from "react-toastify";
import { generateGameCode } from "@/lib/utils/games";
import { GamePieces } from "@/lib/constants/games";
import { apiClient } from "@/lib/api";
import Erc20Abi from '@/context/abi/ERC20abi.json';
import {
  useIsRegistered,
  useGetUsername,
  useCreateGame,
  useApprove,
} from "@/context/ContractProvider";
import { TYCOON_CONTRACT_ADDRESSES, USDC_TOKEN_ADDRESS, MINIPAY_CHAIN_IDS } from "@/constants/contracts";
import { Address, parseUnits } from "viem";

interface GameCreateResponse {
  data?: {
    data?: { id: string | number };
    id?: string | number;
  };
  id?: string | number;
}

const USDC_DECIMALS = 6;

export default function CreateGameMobile() {
  const router = useRouter();
  const { address } = useAccount();
  const wagmiChainId = useChainId();
  const { caipNetwork } = useAppKitNetwork();

  const { data: username } = useGetUsername(address);
  const { data: isUserRegistered, isLoading: isRegisteredLoading } = useIsRegistered(address);

  const isMiniPay = MINIPAY_CHAIN_IDS.includes(wagmiChainId);
  const chainName = caipNetwork?.name?.toLowerCase().replace(" ", "") || `chain-${wagmiChainId}` || "unknown";

  const [isFreeGame, setIsFreeGame] = useState(false);

  const [settings, setSettings] = useState({
    symbol: "hat",
    maxPlayers: 4,
    privateRoom: true,
    auction: true,
    rentInPrison: false,
    mortgage: true,
    evenBuild: true,
    randomPlayOrder: true,
    startingCash: 1500,
    stake: 10,
    duration: 60,
  });

  const [customStake, setCustomStake] = useState<string>("");

  const contractAddress = TYCOON_CONTRACT_ADDRESSES[wagmiChainId as keyof typeof TYCOON_CONTRACT_ADDRESSES] as Address | undefined;
  const usdcTokenAddress = USDC_TOKEN_ADDRESS[wagmiChainId as keyof typeof USDC_TOKEN_ADDRESS] as Address | undefined;

  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: usdcTokenAddress,
    abi: Erc20Abi,
    functionName: 'allowance',
    args: address && contractAddress ? [address, contractAddress] : undefined,
    query: { enabled: !!address && !!usdcTokenAddress && !!contractAddress && !isFreeGame },
  });

  const gameCode = generateGameCode();
  const gameType = settings.privateRoom ? "PRIVATE" : "PUBLIC";

  const {
    approve: approveUSDC,
    isPending: approvePending,
    isConfirming: approveConfirming,
  } = useApprove();

  const finalStake = isFreeGame ? 0 : settings.stake;
  const stakeAmount = parseUnits(finalStake.toString(), USDC_DECIMALS);

  const { write: createGame, isPending: isCreatePending } = useCreateGame(
    username || "",
    gameType,
    settings.symbol,
    settings.maxPlayers,
    gameCode,
    BigInt(settings.startingCash),
    stakeAmount
  );

  const handleStakeSelect = (value: number) => {
    if (isFreeGame) return;
    setSettings((prev) => ({ ...prev, stake: value }));
    setCustomStake("");
  };

  const handleCustomStake = (value: string) => {
    if (isFreeGame) return;
    setCustomStake(value);
    const num = Number(value);
    if (!isNaN(num) && num >= 0.01) {
      setSettings((prev) => ({ ...prev, stake: num }));
    }
  };

  const handlePlay = async () => {
    if (!address || !username || !isUserRegistered) {
      toast.error("Please connect wallet and register first!");
      return;
    }

    if (!contractAddress) {
      toast.error("Contract not deployed on this network.");
      return;
    }

    const toastId = toast.loading("Creating your game room...");

    try {
      // Approval only needed for paid games
      if (!isFreeGame) {
        let needsApproval = false;
        await refetchAllowance();
        const currentAllowance = usdcAllowance ? BigInt(usdcAllowance.toString()) : BigInt(0);
        if (currentAllowance < stakeAmount) needsApproval = true;

        if (needsApproval) {
          toast.update(toastId, { render: "Approving USDC spend..." });
          await approveUSDC(usdcTokenAddress!, contractAddress, stakeAmount);
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      toast.update(toastId, { render: "Creating game on-chain..." });
      const onChainGameId = await createGame();
      if (!onChainGameId) throw new Error("Failed to create game on-chain");

      toast.update(toastId, { render: "Saving game to server..." });

      const saveRes: GameCreateResponse = await apiClient.post("/games", {
        id: onChainGameId.toString(),
        code: gameCode,
        mode: gameType,
        address,
        symbol: settings.symbol,
        number_of_players: settings.maxPlayers,
        stake: finalStake,
        starting_cash: settings.startingCash,
        is_ai: false,
        is_minipay: isMiniPay,
        chain: chainName,
        duration: settings.duration,
        use_usdc: !isFreeGame,
        settings: {
          auction: settings.auction,
          rent_in_prison: settings.rentInPrison,
          mortgage: settings.mortgage,
          even_build: settings.evenBuild,
          randomize_play_order: settings.randomPlayOrder,
        },
      });

      const dbGameId = saveRes?.data?.id ?? saveRes?.id;
      if (!dbGameId) throw new Error("Backend did not return game ID");

      toast.update(toastId, {
        render: `Game created! Share code: ${gameCode}`,
        type: "success",
        isLoading: false,
        autoClose: 5000,
        onClose: () => router.push(`/game-waiting?gameCode=${gameCode}`),
      });
    } catch (err: any) {
      console.error(err);
      let message = "Failed to create game.";
      if (err.message?.includes("user rejected")) message = "Transaction cancelled.";
      else if (err.message?.includes("insufficient")) message = "Insufficient balance or gas.";
      else if (err.message) message = err.message;

      toast.update(toastId, {
        render: message,
        type: "error",
        isLoading: false,
        autoClose: 7000,
      });
    }
  };

  if (isRegisteredLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-settings bg-cover">
        <p className="text-[#00F0FF] text-3xl font-orbitron animate-pulse text-center px-8">
          LOADING ARENA...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-settings bg-cover bg-fixed flex flex-col">
      {/* Header */}
      <div className="px-5 pt-8 pb-5">
        <div className="flex justify-between items-center">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition"
          >
            <House className="w-6 h-6" />
            <span className="font-bold">BACK</span>
          </button>
          <h1 className="text-3xl font-orbitron font-extrabold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            CREATE
          </h1>
          <div className="w-16" />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-32">
        <div className="space-y-5">

          {/* Free Game Toggle */}
          <div className="bg-black/65 rounded-2xl p-5 border border-yellow-600/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FaCoins className="w-6 h-6 text-yellow-400" />
                <div>
                  <h3 className="text-lg font-bold text-yellow-300">Free Game</h3>
                  <p className="text-gray-400 text-xs">No entry fee • Pure fun</p>
                </div>
              </div>
              <Switch
                checked={isFreeGame}
                onCheckedChange={(checked) => {
                  setIsFreeGame(checked);
                  if (checked) {
                    setSettings(p => ({ ...p, stake: 0 }));
                    setCustomStake("0");
                  }
                }}
              />
            </div>
          </div>

          {/* Your Piece */}
          <div className="bg-gradient-to-br from-cyan-900/35 to-blue-900/35 rounded-2xl p-5 border border-cyan-500/25">
            <div className="flex items-center gap-3 mb-3">
              <FaUser className="w-6 h-6 text-cyan-400" />
              <h3 className="text-lg font-bold text-cyan-300">Your Piece</h3>
            </div>
            <Select value={settings.symbol} onValueChange={(v) => setSettings(p => ({ ...p, symbol: v }))}>
              <SelectTrigger className="h-12 bg-black/60 border-cyan-500/30 text-white text-base">
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
          <div className="bg-gradient-to-br from-purple-900/35 to-pink-900/35 rounded-2xl p-5 border border-purple-500/25">
            <div className="flex items-center gap-3 mb-3">
              <FaUsers className="w-6 h-6 text-purple-400" />
              <h3 className="text-lg font-bold text-purple-300">Players</h3>
            </div>
            <Select value={settings.maxPlayers.toString()} onValueChange={(v) => setSettings(p => ({ ...p, maxPlayers: +v }))}>
              <SelectTrigger className="h-12 bg-black/60 border-purple-500/30 text-white text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2,3,4,5,6,7,8].map(n => (
                  <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Private Room */}
          <div className="bg-black/60 rounded-2xl p-5 border border-gray-600/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MdPrivateConnectivity className="w-6 h-6 text-emerald-400" />
                <div>
                  <h3 className="text-lg font-bold text-white">Private</h3>
                  <p className="text-gray-400 text-xs">Code only</p>
                </div>
              </div>
              <Switch
                checked={settings.privateRoom}
                onCheckedChange={(v) => setSettings(p => ({ ...p, privateRoom: v }))}
              />
            </div>
          </div>

          {/* Stake Section */}
          <div className={`bg-gradient-to-b from-green-900/55 to-emerald-900/55 rounded-2xl p-6 border ${isFreeGame ? 'border-yellow-600/40 opacity-75' : 'border-green-500/40'}`}>
            <div className="flex items-center gap-3 mb-5">
              <FaCoins className="w-7 h-7 text-green-400" />
              <h3 className="text-xl font-bold text-green-300">Entry Stake</h3>
            </div>

            {isFreeGame ? (
              <div className="py-10 text-center">
                <p className="text-5xl font-black text-yellow-400 mb-3">FREE</p>
                <p className="text-green-300 text-lg">No crypto needed</p>
                <p className="text-gray-400 text-sm mt-2">Just for fun!</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[1, 5, 10, 25, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => handleStakeSelect(amt)}
                      className={`py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                        settings.stake === amt
                          ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-lg"
                          : "bg-black/65 border border-gray-600 text-gray-300"
                      }`}
                    >
                      {amt}
                    </button>
                  ))}
                </div>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Custom ≥ 0.01 USDC"
                  value={customStake}
                  onChange={(e) => handleCustomStake(e.target.value)}
                  className="w-full px-4 py-4 bg-black/60 border border-green-500/50 rounded-xl text-white text-center text-lg focus:outline-none focus:border-green-400 mb-5"
                />

                <div className="text-center">
                  <p className="text-sm text-gray-400">Current Stake</p>
                  <p className="text-3xl font-bold text-green-400">
                    {settings.stake} USDC
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Starting Cash & Duration - side by side on larger phones */}
          <div className="grid grid-cols-2 gap-4">
            {/* Starting Cash */}
            <div className="bg-gradient-to-br from-amber-900/35 to-orange-900/35 rounded-2xl p-5 border border-amber-500/25">
              <div className="flex items-center gap-2 mb-3">
                <FaCoins className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-amber-300">Cash</h3>
              </div>
              <Select value={settings.startingCash.toString()} onValueChange={(v) => setSettings(p => ({ ...p, startingCash: +v }))}>
                <SelectTrigger className="h-11 bg-black/60 border-amber-500/30 text-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="500">$500</SelectItem>
                  <SelectItem value="1500">$1,500</SelectItem>
                  <SelectItem value="2000">$2,000</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Duration */}
            <div className="bg-gradient-to-br from-indigo-900/35 to-purple-900/35 rounded-2xl p-5 border border-indigo-500/25">
              <div className="flex items-center gap-2 mb-3">
                <FaBrain className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-indigo-300">Time</h3>
              </div>
              <Select value={settings.duration.toString()} onValueChange={(v) => setSettings(p => ({ ...p, duration: +v }))}>
                <SelectTrigger className="h-11 bg-black/60 border-indigo-500/30 text-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30m</SelectItem>
                  <SelectItem value="60">60m</SelectItem>
                  <SelectItem value="90">90m</SelectItem>
                  <SelectItem value="0">∞</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* House Rules */}
          <div className="bg-black/60 rounded-2xl p-5 border border-cyan-500/25">
            <h3 className="text-lg font-bold text-cyan-400 mb-4 text-center">House Rules</h3>
            <div className="space-y-4">
              {[
                { icon: RiAuctionFill, label: "Auction", key: "auction" },
                { icon: GiPrisoner, label: "Rent in Jail", key: "rentInPrison" },
                { icon: GiBank, label: "Mortgages", key: "mortgage" },
                { icon: IoBuild, label: "Even Build", key: "evenBuild" },
                { icon: FaRandom, label: "Random Order", key: "randomPlayOrder" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5 text-cyan-400" />
                    <span className="text-gray-300 text-sm">{item.label}</span>
                  </div>
                  <Switch
                    checked={settings[item.key as keyof typeof settings] as boolean}
                    onCheckedChange={(v) => setSettings(p => ({ ...p, [item.key]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Action */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/95 via-black/80 to-transparent">
        <button
          onClick={handlePlay}
          disabled={isCreatePending || (approvePending || approveConfirming) && !isFreeGame}
          className="w-full py-5 text-2xl font-orbitron font-black tracking-wider
                     bg-gradient-to-r from-cyan-600 via-purple-700 to-pink-600
                     hover:brightness-110 active:scale-98
                     rounded-2xl shadow-2xl transition-all duration-300
                     disabled:opacity-60 disabled:cursor-not-allowed border-2 border-white/10"
        >
          {approvePending || approveConfirming
            ? "APPROVING..."
            : isCreatePending
            ? "CREATING..."
            : isFreeGame
            ? "START FREE GAME"
            : "CREATE GAME"}
        </button>
      </div>
    </div>
  );
}