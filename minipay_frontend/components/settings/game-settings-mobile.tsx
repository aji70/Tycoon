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
  [key: string]: any;
}

const USDC_DECIMALS = 6;
const stakePresets = [1, 5, 10, 25, 50, 100];

interface GameSettingsMobileProps {
  /** After creating game, redirect to this waiting room (default: /game-waiting). e.g. /game-waiting-3d for 3D. */
  redirectToWaitingRoom?: string;
}

export default function CreateGameMobile({ redirectToWaitingRoom = "/game-waiting-3d" }: GameSettingsMobileProps = {}) {
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
  const [isStarting, setIsStarting] = useState(false); // prevents double clicks

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
    if (!isNaN(num) && num >= 0.01) {
      setSettings((prev) => ({ ...prev, stake: num }));
    }
  };

  const extractGameId = (response: any): string | number | undefined => {
    if (typeof response === 'string' || typeof response === 'number') return response;
    return (
      response?.data?.data?.id ??
      response?.data?.id ??
      response?.id ??
      response?.gameId ??
      response?.data?.game?.id
    );
  };

  const handlePlay = async () => {
    if (isStarting) return;
    setIsStarting(true);
    const toastId = toast.loading("Preparing game...");

    if (isGuest) {
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
          render: `Game created! Code: ${gameCode}`,
          type: "success",
          isLoading: false,
          autoClose: 5000,
          onClose: () => router.push(`${redirectToWaitingRoom}?gameCode=${gameCode}`),
        });
      } catch (err: any) {
        const msg = err?.response?.data?.message ?? err?.message ?? "Failed to create game.";
        toast.update(toastId, { render: msg, type: "error", isLoading: false, autoClose: 8000 });
      }
      setIsStarting(false);
      return;
    }

    if (!address || !username || !isUserRegistered) {
      toast.error("Connect wallet & register first!", { autoClose: 5000 });
      setIsStarting(false);
      return;
    }

    if (!contractAddress) {
      toast.error("Game contract not available on this network.");
      setIsStarting(false);
      return;
    }

    if (!isFreeGame && !usdcTokenAddress) {
      toast.error("USDC not supported on current network.");
      setIsStarting(false);
      return;
    }

    try {
      if (!isFreeGame) {
        toast.update(toastId, { render: "Checking USDC allowance..." });
        await refetchAllowance();

        const allowance = usdcAllowance ? BigInt(usdcAllowance.toString()) : 0;
        if (allowance < stakeAmount) {
          toast.update(toastId, { render: "Approving USDC (one-time)..." });
          await approveUSDC(usdcTokenAddress!, contractAddress, stakeAmount);

          await new Promise(r => setTimeout(r, 4000));
          await refetchAllowance();
        }
      }

      toast.update(toastId, { render: "Creating game on-chain..." });
      const onChainGameId = await createGame();
      if (!onChainGameId) throw new Error("No game ID received from contract");

      toast.update(toastId, { render: "Saving game to server..." });

      const saveRes = await apiClient.post<any>("/games", {
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

      const dbGameId = extractGameId(saveRes);

      if (!dbGameId) {
        console.error("Backend response without ID:", JSON.stringify(saveRes, null, 2));
        throw new Error("Server didn't return game ID");
      }

      toast.update(toastId, {
        render: `Game created! Code: ${gameCode}`,
        type: "success",
        isLoading: false,
        autoClose: 5000,
        onClose: () => router.push(`${redirectToWaitingRoom}?gameCode=${gameCode}`),
      });
    } catch (err: any) {
      console.error("Game creation failed:", err);

      const message = getContractErrorMessage(err, "Failed to create game. Try again.");
      setCreateError(message);

      toast.update(toastId, {
        render: message,
        type: "error",
        isLoading: false,
        autoClose: 9000,
      });
    } finally {
      setIsStarting(false);
    }
  };

  const canCreate = isGuest || (address && username && isUserRegistered);

  if (!isGuest && isRegisteredLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-settings bg-cover">
        <p className="text-[#00F0FF] text-3xl font-orbitron animate-pulse text-center px-8">
          LOADING ARENA...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-settings bg-cover bg-fixed flex flex-col pb-10 pt-[70px]">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <WARoomHeader />
      </div>

      {/* Main content */}
      <div className="flex-1 px-5 space-y-4 pb-6 overflow-y-auto">
        {/* Free Game Toggle - hidden for guests (guest games are free only) */}
        {!isGuest && (
        <div className="bg-black/65 rounded-xl p-4 border border-yellow-600/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaCoins className="w-5 h-5 text-yellow-400" />
              <div>
                <h3 className="text-sm font-bold text-yellow-300">Free Game</h3>
                <p className="text-gray-400 text-[10px]">No entry fee • Pure fun</p>
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
        )}
        {isGuest && (
          <div className="bg-black/65 rounded-xl p-4 border border-yellow-600/40">
            <div className="flex items-center gap-2">
              <FaCoins className="w-5 h-5 text-yellow-400" />
              <div>
                <h3 className="text-sm font-bold text-yellow-300">Guest games are free</h3>
                <p className="text-gray-400 text-[10px]">Connect a wallet to create staked games</p>
              </div>
            </div>
          </div>
        )}

        {/* Your Piece - Mobile version */}
        <div className="bg-gradient-to-br from-cyan-900/35 to-blue-900/35 rounded-xl p-4 border border-cyan-500/25">
          <PieceTileSelector
            value={settings.symbol}
            onChange={(v) => setSettings((p) => ({ ...p, symbol: v }))}
          />
        </div>

        {/* Max Players - Mobile version */}
        <div className="bg-gradient-to-br from-purple-900/35 to-pink-900/35 rounded-xl p-4 border border-purple-500/25">
          <PlayerSlots
            count={settings.maxPlayers}
            onChange={(n) => setSettings((p) => ({ ...p, maxPlayers: n }))}
            max={8}
          />
        </div>

        {/* Private Room */}
        <div className="bg-black/60 rounded-xl p-4 border border-gray-600/60">
          <PrivateLock
            checked={settings.privateRoom}
            onCheckedChange={(v) => setSettings((p) => ({ ...p, privateRoom: v }))}
          />
        </div>

        {/* Stake - hidden for guests */}
        {!isGuest && (
        <div className={`bg-gradient-to-b from-green-900/55 to-emerald-900/55 rounded-xl p-4 border ${isFreeGame ? 'border-yellow-600/40 opacity-75' : 'border-green-500/40'}`}>
          <div className="flex items-center gap-2 mb-3">
            <FaCoins className="w-5 h-5 text-green-400" />
            <h3 className="text-sm font-bold text-green-300">Entry Stake</h3>
          </div>

          {isFreeGame ? (
            <div className="py-6 text-center">
              <p className="text-3xl font-black text-yellow-400 mb-1">FREE</p>
              <p className="text-green-300 text-sm">No crypto needed</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {stakePresets.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => handleStakeSelect(amt)}
                    className={`py-2 rounded-lg font-bold text-xs transition-all active:scale-95 ${
                      settings.stake === amt
                        ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow"
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
                placeholder="Custom ≥ 0.01"
                value={customStake}
                onChange={(e) => handleCustomStake(e.target.value)}
                className="w-full px-3 py-2.5 bg-black/60 border border-green-500/50 rounded-lg text-white text-center text-sm focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-500/50 focus:ring-offset-2 focus:ring-offset-black mb-3"
              />

              <div className="text-center">
                <p className="text-xs text-gray-400">Current Stake</p>
                <p className="text-xl font-bold text-green-400">
                  {settings.stake} USDC
                </p>
              </div>
            </>
          )}
        </div>
        )}

        {/* Starting Cash */}
        <div className="bg-gradient-to-br from-amber-900/35 to-orange-900/35 rounded-xl p-4 border border-amber-500/25">
          <CashPicker
            value={settings.startingCash}
            onChange={(v) => setSettings((p) => ({ ...p, startingCash: v }))}
          />
        </div>

        {/* Duration */}
        <div className="bg-gradient-to-br from-indigo-900/35 to-purple-900/35 rounded-xl p-4 border border-indigo-500/25">
          <DurationDial
            value={settings.duration}
            onChange={(v) => setSettings((p) => ({ ...p, duration: v }))}
          />
        </div>

        {/* House Rules */}
        <div className="bg-black/60 rounded-xl p-4 border border-cyan-500/30">
          <h3 className="text-base font-bold text-cyan-400 mb-3 text-center uppercase tracking-wider">MISSION PARAMETERS</h3>
          <div className="space-y-2">
            {[
              { icon: RiAuctionFill, label: "Auction Unsold", desc: "Property auctions enabled", key: "auction" },
              { icon: GiPrisoner, label: "Rent in Jail", desc: "Rent payable in jail", key: "rentInPrison" },
              { icon: GiBank, label: "Mortgages", desc: "Mortgaging allowed", key: "mortgage" },
              { icon: IoBuild, label: "Even Build", desc: "Fair building rule", key: "evenBuild" },
            ].map((item) => {
              const isActive = settings[item.key as keyof typeof settings] as boolean;
              return (
                <motion.button
                  key={item.key}
                  onClick={() => setSettings(p => ({ ...p, [item.key]: !isActive }))}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                    isActive
                      ? "border-cyan-500/60 bg-cyan-500/15"
                      : "border-cyan-500/20 bg-slate-800/30"
                  }`}
                  whileHover={{ scale: 1.01 }}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <motion.div
                      animate={{ rotate: isActive ? 10 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <item.icon className={`w-4 h-4 ${isActive ? "text-cyan-400" : "text-cyan-500/50"}`} />
                    </motion.div>
                    <div className="text-left">
                      <p className="text-xs font-orbitron font-bold text-white uppercase">{item.label}</p>
                      <p className="text-[10px] text-cyan-300/60">{item.desc}</p>
                    </div>
                  </div>

                  {/* Military toggle - compact for mobile */}
                  <motion.div
                    className={`w-12 h-6 rounded-full border-2 flex items-center p-0.5 transition-all flex-shrink-0 ${
                      isActive
                        ? "border-cyan-500 bg-cyan-600/40"
                        : "border-cyan-500/30 bg-slate-700/60"
                    }`}
                  >
                    <motion.div
                      animate={{ x: isActive ? 20 : 2 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className={`w-4 h-4 rounded-full ${
                        isActive ? "bg-cyan-300" : "bg-slate-500"
                      } shadow-lg`}
                    />
                  </motion.div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Create error — inline above submit */}
        {createError && (
          <div className="mt-4 p-4 rounded-xl bg-red-950/30 border border-red-500/30" role="alert">
            <p className="text-red-400 text-sm font-medium text-center">{createError}</p>
            <p className="text-slate-500 text-xs text-center mt-1">Fix any issues above or try again.</p>
          </div>
        )}

        {/* Guest Banner - Announcement style */}
        {isGuest && (
          <motion.div
            className="mt-4 p-4 rounded-lg bg-yellow-900/30 border border-yellow-500/50 flex items-center justify-center gap-3"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="text-xl"
            >
              💛
            </motion.span>
            <div className="text-center">
              <p className="text-yellow-300 font-orbitron font-bold text-xs">GUEST GAMES ARE FREE</p>
              <p className="text-yellow-300/70 text-[10px] mt-0.5">Connect a wallet to stake</p>
            </div>
          </motion.div>
        )}

        {/* Launch Button */}
        <div className="pt-4 pb-6">
          <WARoomLaunchButton
            onClick={() => {
              setCreateError(null);
              playGuard.submit(() => handlePlay());
            }}
            disabled={!canCreate || playGuard.isSubmitting || isStarting || (!isGuest && (isCreatePending || approvePending || approveConfirming))}
            isSubmitting={playGuard.isSubmitting || isStarting}
            isFreeGame={isFreeGame}
            approvePending={approvePending}
            approveConfirming={approveConfirming}
            isCreatePending={isCreatePending}
            canCreate={canCreate}
          />
        </div>
      </div>
    </div>
  );
}