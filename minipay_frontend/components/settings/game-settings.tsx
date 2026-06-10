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

interface GameCreateResponse {
  data?: {
    data?: { id: string | number };
    id?: string | number;
  };
  id?: string | number;
}

const USDC_DECIMALS = 6;
const stakePresets = [1, 5, 10, 25, 50, 100];

interface GameSettingsProps {
  /** After creating game, redirect to this waiting room (default: /game-waiting). e.g. /game-waiting-3d for 3D. */
  redirectToWaitingRoom?: string;
}

export default function GameSettings({ redirectToWaitingRoom = "/game-waiting-3d" }: GameSettingsProps = {}) {
  const router = useRouter();
  const { address } = useAccount();
  const wagmiChainId = useChainId();
  const { caipNetwork } = useAppKitNetwork();
  const guestAuth = useGuestAuthOptional();
  /** Backend-paid create when JWT guest has no wallet, or MiniPay local address ≠ account play address. */
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
    if (isGuest) {
      const toastId = toast.loading("Creating your game room...");
      try {
        toast.update(toastId, { render: "Creating game (guest)..." });
        const res = await apiClient.post<any>("/games/create-as-guest", {
          code: gameCode,
          mode: gameType,
          symbol: settings.symbol,
          number_of_players: settings.maxPlayers,
          stake: 0,
          starting_cash: settings.startingCash,
          is_ai: false,
          is_minipay: isMiniPay,
          chain: chainName,
          duration: settings.duration,
          use_usdc: false,
          settings: {
            auction: settings.auction,
            rent_in_prison: settings.rentInPrison,
            mortgage: settings.mortgage,
            even_build: settings.evenBuild,
            starting_cash: settings.startingCash,
          },
        });
        const data = (res as any)?.data;
        const dbGameId = data?.data?.id ?? data?.id;
        if (!dbGameId) throw new Error("Backend did not return game ID");
        toast.update(toastId, {
          render: `Game created! Share code: ${gameCode}`,
          type: "success",
          isLoading: false,
          autoClose: 5000,
          onClose: () => router.push(`${redirectToWaitingRoom}?gameCode=${gameCode}`),
        });
      } catch (err: any) {
        const msg = err?.response?.data?.message || err?.message || "Failed to create game";
        toast.update(toastId, { render: msg, type: "error", isLoading: false, autoClose: 8000 });
      }
      return;
    }

    if (!address || !username || !isUserRegistered) {
      toast.error("Please connect wallet and register first!", { autoClose: 5000 });
      return;
    }

    if (!contractAddress) {
      toast.error("Contract not deployed on this network.");
      return;
    }

    if (!usdcTokenAddress && !isFreeGame) {
      toast.error("USDC not available on this network.");
      return;
    }

    const toastId = toast.loading("Creating your game room...");

    try {
      if (!isFreeGame) {
        let needsApproval = false;
        await refetchAllowance();
        const currentAllowance = usdcAllowance ? BigInt(usdcAllowance.toString()) : BigInt(0);
        if (currentAllowance < stakeAmount) needsApproval = true;

        if (needsApproval) {
          toast.update(toastId, { render: "Approving USDC spend..." });
          await approveUSDC(usdcTokenAddress!, contractAddress, stakeAmount);
          await new Promise(r => setTimeout(r, 3000));
        }
      }

      toast.update(toastId, { render: "Creating game on-chain..." });
      const onChainGameId = await createGame();
      if (!onChainGameId) throw new Error("Failed to create game on-chain");

      toast.update(toastId, { render: "Saving game to server..." });

      let dbGameId: string | number | undefined;
      try {
        const saveRes: GameCreateResponse = await apiClient.post<any>("/games", {
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
      <div className="w-full h-screen flex items-center justify-center bg-settings bg-cover">
        <p className="text-[#00F0FF] text-4xl font-orbitron animate-pulse tracking-wider">
          LOADING ARENA...
        </p>
      </div>
    );
  }

  const canCreate = isGuest || (address && username && isUserRegistered);

  return (
    <div className="min-h-screen bg-settings bg-cover bg-fixed flex items-center justify-center p-6">
      <div className="w-full max-w-5xl bg-black/80 backdrop-blur-3xl rounded-3xl border border-cyan-500/30 shadow-2xl p-8 md:p-12">
        <WARoomHeader />

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-8 mb-10">
          {/* Column 1 */}
          <div className="space-y-6">
            {/* Your Piece */}
            <div className="bg-gradient-to-br from-cyan-900/40 to-blue-900/40 rounded-2xl p-6 border border-cyan-500/30">
              <PieceTileSelector
                value={settings.symbol}
                onChange={(v) => setSettings((p) => ({ ...p, symbol: v }))}
              />
            </div>

            {/* Max Players */}
            <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-2xl p-6 border border-purple-500/30">
              <PlayerSlots
                count={settings.maxPlayers}
                onChange={(n) => setSettings((p) => ({ ...p, maxPlayers: n }))}
                max={8}
              />
            </div>

            {/* Private Room */}
            <div className="bg-black/60 rounded-2xl p-6 border border-gray-600">
              <PrivateLock
                checked={settings.privateRoom}
                onCheckedChange={(v) => setSettings((p) => ({ ...p, privateRoom: v }))}
              />
            </div>

            {/* Free Game Toggle - hidden for guests (guest games are free only) */}
            {!isGuest && (
            <div className="bg-black/60 rounded-2xl p-6 border border-yellow-600/50 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FaCoins className="w-7 h-7 text-yellow-400" />
                  <div>
                    <h3 className="text-xl font-bold text-yellow-300">Free Game</h3>
                    <p className="text-gray-400 text-sm">Play for fun — 0 USDC</p>
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
            )}
            {isGuest && (
              <div className="bg-black/60 rounded-2xl p-6 border border-yellow-600/50 mt-4">
                <div className="flex items-center gap-3">
                  <FaCoins className="w-7 h-7 text-yellow-400" />
                  <div>
                    <h3 className="text-xl font-bold text-yellow-300">Guest games are free</h3>
                    <p className="text-gray-400 text-sm">Connect a wallet to create staked games</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Column 2 - Stake (hidden for guests) */}
          {!isGuest && (
          <div className={`bg-gradient-to-b from-green-900/60 to-emerald-900/60 rounded-2xl p-8 border border-green-500/40 shadow-xl transition-opacity duration-300 ${isFreeGame ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-3 mb-6">
              <FaCoins className="w-8 h-8 text-green-400" />
              <h3 className="text-2xl font-bold text-green-300">Entry Stake</h3>
            </div>

            {isFreeGame ? (
              <div className="h-64 flex items-center justify-center text-center">
                <div>
                  <p className="text-4xl font-black text-yellow-400 mb-4">FREE</p>
                  <p className="text-lg text-yellow-300/90">No entry fee required</p>
                  <p className="text-sm text-gray-400 mt-3">Pure fun • No crypto at risk</p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {stakePresets.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => handleStakeSelect(amount)}
                      className={`py-4 rounded-xl font-bold transition-all hover:scale-105 ${
                        settings.stake === amount
                          ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-lg"
                          : "bg-black/60 border border-gray-600 text-gray-300"
                      }`}
                    >
                      {amount} USDC
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
                  className="w-full px-4 py-4 bg-black/60 border border-green-500/50 rounded-xl text-white text-center text-lg focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-500/50 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50"
                  disabled={isFreeGame}
                />

                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-400">Current Stake</p>
                  <p className="text-3xl font-bold text-green-400">
                    {settings.stake} USDC
                  </p>
                </div>
              </>
            )}
          </div>
          )}

          {/* Column 3 */}
          <div className="space-y-6">
            {/* Starting Cash */}
            <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/40 rounded-2xl p-6 border border-amber-500/30">
              <CashPicker
                value={settings.startingCash}
                onChange={(v) => setSettings((p) => ({ ...p, startingCash: v }))}
              />
            </div>

            {/* Game Duration */}
            <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 rounded-2xl p-6 border border-indigo-500/30">
              <DurationDial
                value={settings.duration}
                onChange={(v) => setSettings((p) => ({ ...p, duration: v }))}
              />
            </div>

            {/* House Rules */}
            <div className="bg-black/60 rounded-2xl p-6 border border-cyan-500/30">
              <h3 className="text-xl font-bold text-cyan-400 mb-5 text-center uppercase tracking-wider">MISSION PARAMETERS</h3>
              <div className="space-y-3">
                {[
                  { icon: RiAuctionFill, label: "Auction Unsold Properties", desc: "Property auctions enabled", key: "auction" },
                  { icon: GiPrisoner, label: "Pay Rent in Jail", desc: "Rent payable while in jail", key: "rentInPrison" },
                  { icon: GiBank, label: "Allow Mortgages", desc: "Properties can be mortgaged", key: "mortgage" },
                  { icon: IoBuild, label: "Even Building Rule", desc: "Fair building distribution", key: "evenBuild" },
                ].map((item) => {
                  const isActive = settings[item.key as keyof typeof settings] as boolean;
                  return (
                    <motion.button
                      key={item.key}
                      onClick={() => setSettings(p => ({ ...p, [item.key]: !isActive }))}
                      className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                        isActive
                          ? "border-cyan-500/60 bg-cyan-500/15"
                          : "border-cyan-500/20 bg-slate-800/30"
                      }`}
                      whileHover={{ scale: 1.01 }}
                    >
                      <div className="flex items-center gap-3">
                        <motion.div
                          animate={{ rotate: isActive ? 10 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <item.icon className={`w-5 h-5 ${isActive ? "text-cyan-400" : "text-cyan-500/50"}`} />
                        </motion.div>
                        <div className="text-left">
                          <p className="text-xs font-orbitron font-bold text-white uppercase">{item.label}</p>
                          <p className="text-xs text-cyan-300/60 font-dmSans">{item.desc}</p>
                        </div>
                      </div>

                      {/* Military toggle */}
                      <motion.div
                        className={`w-14 h-7 rounded-full border-2 flex items-center p-1 transition-all flex-shrink-0 ${
                          isActive
                            ? "border-cyan-500 bg-cyan-600/40"
                            : "border-cyan-500/30 bg-slate-700/60"
                        }`}
                      >
                        <motion.div
                          animate={{ x: isActive ? 24 : 2 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          className={`w-5 h-5 rounded-full ${
                            isActive ? "bg-cyan-300" : "bg-slate-500"
                          } shadow-lg`}
                        />
                      </motion.div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Create error — inline above submit */}
        {createError && (
          <div className="mt-8 p-4 rounded-xl bg-red-950/30 border border-red-500/30" role="alert">
            <p className="text-red-400 text-sm font-medium text-center">{createError}</p>
            <p className="text-slate-500 text-xs text-center mt-1">Fix any issues above or try again.</p>
          </div>
        )}

        {/* Guest Banner - Announcement style */}
        {isGuest && (
          <motion.div
            className="mt-8 p-4 rounded-lg bg-yellow-900/30 border border-yellow-500/50 flex items-center justify-center gap-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="text-2xl"
            >
              💛
            </motion.span>
            <div className="text-center">
              <p className="text-yellow-300 font-orbitron font-bold text-sm">GUEST GAMES ARE FREE</p>
              <p className="text-yellow-300/70 text-xs mt-1">Connect a wallet to create staked games</p>
            </div>
          </motion.div>
        )}

        {/* Launch Button */}
        <WARoomLaunchButton
          onClick={() => {
            setCreateError(null);
            playGuard.submit(() => handlePlay());
          }}
          disabled={!canCreate || playGuard.isSubmitting || (!isGuest && (isCreatePending || ((approvePending || approveConfirming) && !isFreeGame)))}
          isSubmitting={playGuard.isSubmitting}
          isFreeGame={isFreeGame}
          approvePending={approvePending}
          approveConfirming={approveConfirming}
          isCreatePending={isCreatePending}
          canCreate={canCreate}
        />
      </div>
    </div>
  );
}