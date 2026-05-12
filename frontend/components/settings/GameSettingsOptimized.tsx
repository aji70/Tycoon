"use client";

import React, { useState } from "react";
import { FaCoins } from "react-icons/fa6";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/game-switch";
import { RiAuctionFill } from "react-icons/ri";
import { GiBank, GiPrisoner } from "react-icons/gi";
import { IoBuild } from "react-icons/io5";
import { useRouter } from "next/navigation";
import {
  WARoomHeader,
  PieceTileSelector,
  PlayerSlots,
  CashPicker,
  DurationDial,
  PrivateLock,
  WARoomLaunchButton,
} from "@/components/game-setup";
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
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { TYCOON_CONTRACT_ADDRESSES, USDC_TOKEN_ADDRESS, MINIPAY_CHAIN_IDS } from "@/constants/contracts";
import { shouldUseBackendGuestGameFlow } from "@/lib/minipayGuestFlow";
import { Address, parseUnits } from "viem";
import { getContractErrorMessage } from "@/lib/utils/contractErrors";
import { usePreventDoubleSubmit } from "@/hooks/usePreventDoubleSubmit";
import { ScanlineOverlay } from "@/components/hero/ScanlineOverlay";

interface GameCreateResponse {
  data?: {
    data?: { id: string | number };
    id?: string | number;
  };
  id?: string | number;
}

const USDC_DECIMALS = 6;
const stakePresets = [1, 5, 10, 25, 50, 100];

interface GameSettingsOptimizedProps {
  /** After creating game, redirect to this waiting room (default: /game-waiting). e.g. /game-waiting-3d for 3D. */
  redirectToWaitingRoom?: string;
}

export default function GameSettingsOptimized({ redirectToWaitingRoom = "/game-waiting" }: GameSettingsOptimizedProps = {}) {
  const router = useRouter();
  const { address } = useAccount();
  const wagmiChainId = useChainId();
  const { caipNetwork } = useAppKitNetwork();
  const guestAuth = useGuestAuthOptional();
  const isGuest = shouldUseBackendGuestGameFlow(guestAuth?.guestUser ?? null, address, wagmiChainId);

  const { data: username } = useGetUsername(address);
  const { data: isUserRegistered, isLoading: isRegisteredLoading } = useIsRegistered(address);

  const isMiniPay = MINIPAY_CHAIN_IDS.includes(wagmiChainId);
  const chainName = caipNetwork?.name?.toLowerCase().replace(" ", "") || `chain-${wagmiChainId}` || "unknown";

  const [isFreeGame, setIsFreeGame] = useState(false);

  const [settings, setSettings] = useState({
    symbol: "hat",
    maxPlayers: 2,
    privateRoom: true,
    auction: true,
    rentInPrison: false,
    mortgage: true,
    evenBuild: true,
    startingCash: 1500,
    stake: 10,
    duration: 30,
  });

  const [customStake, setCustomStake] = useState<string>("");
  const [createError, setCreateError] = useState<string | null>(null);

  const contractAddress = TYCOON_CONTRACT_ADDRESSES[wagmiChainId as keyof typeof TYCOON_CONTRACT_ADDRESSES] as Address | undefined;
  const usdcTokenAddress = USDC_TOKEN_ADDRESS[wagmiChainId as keyof typeof USDC_TOKEN_ADDRESS] as Address | undefined;

  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: usdcTokenAddress,
    abi: Erc20Abi,
    functionName: 'allowance',
    args: address && contractAddress ? [address, contractAddress] : undefined,
    query: { enabled: !!address && !!usdcTokenAddress && !!contractAddress },
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

  const playGuard = usePreventDoubleSubmit();

  const handleStakeSelect = (value: number) => {
    if (isFreeGame) return;
    setSettings((prev) => ({ ...prev, stake: value }));
    setCustomStake("");
  };

  const handleCustomStake = (value: string) => {
    if (isFreeGame) return;
    setCustomStake(value);
    const num = Number(value);
    const min = 0.01;
    if (!isNaN(num) && num >= min) {
      setSettings((prev) => ({ ...prev, stake: num }));
    }
  };

  const handlePlay = async () => {
    setCreateError(null);

    if (!canCreate) {
      toast.error("Please register and connect your wallet");
      return;
    }

    const toastId = toast.loading("Creating game...");

    try {
      if (!isGuest) {
        const allowanceNeeded = stakeAmount > 0n;

        if (allowanceNeeded) {
          if (!usdcAllowance || usdcAllowance < stakeAmount) {
            toast.update(toastId, {
              render: "Approving USDC...",
              type: "info",
              isLoading: true,
            });

            await approveUSDC?.();
            await refetchAllowance();
          }
        }
      }

      toast.update(toastId, {
        render: "Creating your game on chain...",
        type: "info",
        isLoading: true,
      });

      await createGame?.();

      let dbGameId: string | number | null = null;

      try {
        const saveRes = await apiClient.post<GameCreateResponse>("/games", {
          code: gameCode,
          creator_address: address,
          max_players: settings.maxPlayers,
          starting_cash: settings.startingCash,
          symbol: settings.symbol,
          stake: finalStake,
          is_private: settings.privateRoom,
          chain: chainName,
          game_rules: {
            auction: settings.auction,
            rent_in_prison: settings.rentInPrison,
            mortgage: settings.mortgage,
            even_build: settings.evenBuild,
          },
        });

        dbGameId =
          typeof saveRes === 'string' || typeof saveRes === 'number'
            ? saveRes
            : saveRes?.data?.data?.id ?? saveRes?.data?.id ?? saveRes?.id;

        if (!dbGameId) throw new Error("Backend did not return game ID");
      } catch (err: any) {
        throw new Error(err.response?.data?.message || "Failed to save game");
      }

      toast.update(toastId, {
        render: `Game created! Share code: ${gameCode}`,
        type: "success",
        isLoading: false,
        autoClose: 5000,
        onClose: () => router.push(`${redirectToWaitingRoom}?gameCode=${gameCode}`),
      });
    } catch (err: any) {
      console.error("Create game error:", err);
      const message = getContractErrorMessage(err, "Failed to create game. Please try again.");
      setCreateError(message);
      toast.update(toastId, {
        render: message,
        type: "error",
        isLoading: false,
        autoClose: 8000,
      });
    }
  };

  if (!isGuest && isRegisteredLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-[#0E282A] to-slate-950">
        <p className="text-cyan-400 text-2xl font-medium animate-pulse">
          Initializing Game Setup...
        </p>
      </div>
    );
  }

  const canCreate = isGuest || (address && username && isUserRegistered);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0E282A] via-slate-900 to-slate-950 relative overflow-hidden flex flex-col">
      {/* Scanline overlay */}
      <ScanlineOverlay />

      {/* Content */}
      <div className="relative z-10 flex-1 flex items-start justify-center p-3 sm:p-4 md:p-6 lg:p-8">
        <div className="w-full max-w-7xl mx-auto">
          {/* Header */}
          <WARoomHeader />

          {/* Desktop: Two-column layout | Mobile: Single column vertical */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
            {/* LEFT COLUMN */}
            <div className="space-y-4 md:space-y-6">
              {/* Your Piece */}
              <div>
                <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Your Piece</p>
                <div className="bg-gradient-to-br from-cyan-900/40 to-blue-900/40 rounded-xl md:rounded-2xl p-3 md:p-6 border border-cyan-500/30">
                  <PieceTileSelector
                    value={settings.symbol}
                    onChange={(v) => setSettings((p) => ({ ...p, symbol: v }))}
                  />
                </div>
              </div>

              {/* Max Players */}
              <div>
                <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Max Players</p>
                <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-xl md:rounded-2xl p-3 md:p-6 border border-purple-500/30">
                  <PlayerSlots
                    count={settings.maxPlayers}
                    onChange={(n) => setSettings((p) => ({ ...p, maxPlayers: n }))}
                    max={8}
                  />
                </div>
              </div>

              {/* Private Room */}
              <div>
                <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Room Access</p>
                <div className="bg-black/60 rounded-xl md:rounded-2xl p-3 md:p-6 border border-gray-600">
                  <PrivateLock
                    checked={settings.privateRoom}
                    onCheckedChange={(v) => setSettings((p) => ({ ...p, privateRoom: v }))}
                  />
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-4 md:space-y-6">
              {/* Starting Cash */}
              <div>
                <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Starting Cash</p>
                <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/40 rounded-xl md:rounded-2xl p-3 md:p-6 border border-amber-500/30">
                  <CashPicker
                    value={settings.startingCash}
                    onChange={(v) => setSettings((p) => ({ ...p, startingCash: v }))}
                  />
                </div>
              </div>

              {/* Game Duration */}
              <div>
                <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Game Duration</p>
                <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 rounded-xl md:rounded-2xl p-3 md:p-6 border border-indigo-500/30">
                  <DurationDial
                    value={settings.duration}
                    onChange={(v) => setSettings((p) => ({ ...p, duration: v }))}
                  />
                </div>
              </div>

              {/* Entry Stake - Non-guests only */}
              {!isGuest && (
                <div>
                  <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Entry Stake</p>
                  <div className={`bg-gradient-to-b from-green-900/60 to-emerald-900/60 rounded-xl md:rounded-2xl p-3 md:p-6 border border-green-500/40 transition-opacity duration-300 ${isFreeGame ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <FaCoins className="w-5 h-5 md:w-6 md:h-6 text-green-400" />
                      <span className="text-green-300 font-orbitron font-bold text-sm">Stake</span>
                    </div>

                    {isFreeGame ? (
                      <div className="py-6 text-center">
                        <p className="text-2xl md:text-3xl font-black text-yellow-400">FREE</p>
                        <p className="text-xs text-yellow-300/90">No entry fee</p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-1 md:gap-2 mb-3">
                          {stakePresets.map((amount) => (
                            <button
                              key={amount}
                              onClick={() => handleStakeSelect(amount)}
                              className={`py-2 px-1 md:py-3 md:px-2 rounded-lg text-xs font-bold transition-all hover:scale-105 ${
                                settings.stake === amount
                                  ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-lg"
                                  : "bg-black/60 border border-gray-600 text-gray-300"
                              }`}
                            >
                              {amount}
                            </button>
                          ))}
                        </div>

                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="Custom ≥ 0.01"
                          value={customStake}
                          onChange={(e) => handleCustomStake(e.target.value)}
                          className="w-full px-2 py-2 md:px-3 md:py-2 bg-black/60 border border-green-500/50 rounded-lg text-white text-xs text-center focus:outline-none focus:border-green-400 disabled:opacity-50"
                          disabled={isFreeGame}
                        />

                        <div className="mt-2 text-center">
                          <p className="text-xs text-gray-400">Current</p>
                          <p className="text-lg md:text-xl font-bold text-green-400">
                            {settings.stake} USDC
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Free Game Toggle */}
              {!isGuest && (
                <div>
                  <div className="bg-black/60 rounded-xl md:rounded-2xl p-3 md:p-6 border border-yellow-600/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FaCoins className="w-5 h-5 md:w-6 md:h-6 text-yellow-400" />
                        <div>
                          <h3 className="text-sm md:text-base font-bold text-yellow-300">Free Game</h3>
                          <p className="text-gray-400 text-xs">No USDC cost</p>
                        </div>
                      </div>
                      <Switch
                        checked={isFreeGame}
                        onCheckedChange={(checked) => {
                          setIsFreeGame(checked);
                          if (checked) {
                            setSettings(prev => ({ ...prev, stake: 0 }));
                            setCustomStake("0");
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Guest Free Games Banner */}
              {isGuest && (
                <div className="bg-black/60 rounded-xl md:rounded-2xl p-3 md:p-6 border border-yellow-600/50">
                  <div className="flex items-center gap-2">
                    <FaCoins className="w-5 h-5 md:w-6 md:h-6 text-yellow-400" />
                    <div>
                      <h3 className="text-sm md:text-base font-bold text-yellow-300">Guest Games Free</h3>
                      <p className="text-gray-400 text-xs">Connect wallet for staked games</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* House Rules - Full width */}
          <div className="mb-8">
            <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Mission Parameters</p>
            <div className="bg-black/60 rounded-xl md:rounded-2xl p-3 md:p-6 border border-cyan-500/30">
              <div className="grid grid-cols-2 gap-2 md:gap-3">
                {[
                  { icon: RiAuctionFill, label: "Auction Unsold", key: "auction" },
                  { icon: GiPrisoner, label: "Rent in Jail", key: "rentInPrison" },
                  { icon: GiBank, label: "Allow Mortgages", key: "mortgage" },
                  { icon: IoBuild, label: "Even Building", key: "evenBuild" },
                ].map((rule, idx) => {
                  const isActive = settings[rule.key as keyof typeof settings];
                  return (
                    <motion.div
                      key={rule.key}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: idx * 0.05 }}
                      className={`flex flex-col items-center p-2 rounded-lg border-2 transition-all gap-2 ${
                        isActive
                          ? "border-cyan-500/60 bg-cyan-500/15"
                          : "border-cyan-500/20 bg-slate-800/30"
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        {typeof rule.icon === 'function' ? <rule.icon className="w-4 h-4 text-cyan-400" /> : <span className="text-lg text-cyan-400">{rule.icon}</span>}
                        <span className="text-xs font-orbitron font-bold text-white uppercase text-center">
                          {rule.label}
                        </span>
                      </div>

                      <motion.button
                        onClick={() =>
                          setSettings((p) => ({ ...p, [rule.key]: !(p[rule.key as keyof typeof p] as boolean) }))
                        }
                        className={`relative w-8 h-4 md:w-10 md:h-5 rounded-full transition-all duration-300 border-2 ${
                          isActive
                            ? "border-cyan-500 bg-gradient-to-r from-cyan-600 to-cyan-500 shadow-lg shadow-cyan-500/40"
                            : "border-cyan-500/30 bg-slate-700/60"
                        }`}
                      >
                        <motion.div
                          animate={{ x: isActive ? 16 : 2 }}
                          transition={{ type: "spring", stiffness: 600, damping: 25 }}
                          className={`absolute top-0.5 w-3 h-3 md:w-4 md:h-4 rounded-full transition-colors ${
                            isActive ? "bg-white shadow-lg shadow-cyan-400/50" : "bg-slate-500"
                          }`}
                        />
                      </motion.button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* LAUNCH BUTTON - Full width */}
          <div className="flex justify-center mt-8">
            <WARoomLaunchButton
              onClick={() => playGuard.submit(() => handlePlay())}
              disabled={!canCreate || playGuard.isSubmitting || (!isGuest && isCreatePending)}
              isSubmitting={playGuard.isSubmitting || (!isGuest && isCreatePending)}
              approvePending={approvePending}
              approveConfirming={approveConfirming}
              isFreeGame={isFreeGame}
              isCreatePending={isCreatePending}
              canCreate={canCreate}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
