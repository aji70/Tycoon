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
  PieceTileSelector,
  PlayerSlots,
  CashPicker,
  DurationDial,
  PrivateLock,
  WARoomLaunchButton,
  BoardVariantPicker,
} from "@/components/game-setup";
import { BattleHeader } from "@/components/battle-setup/BattleHeader";
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
import { shouldUseBackendGuestGameFlow, getGuestUserPlayAddress } from "@/lib/minipayGuestFlow";
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

const PIECE_EMOJI: Record<string, string> = {
  hat: "🎩",
  car: "🚗",
  dog: "🐕",
  thimble: "🔧",
  wheelbarrow: "🛒",
  battleship: "🚢",
  boot: "👢",
  iron: "♨️",
  top_hat: "🎩",
};

interface GameSettingsOptimizedProps {
  /** After creating game, redirect to this waiting room (default: /game-waiting). e.g. /game-waiting-3d for 3D. */
  redirectToWaitingRoom?: string;
}

export default function GameSettingsOptimized({ redirectToWaitingRoom = "/game-waiting-3d" }: GameSettingsOptimizedProps = {}) {
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

  const [isFreeGame, setIsFreeGame] = useState(true);

  const [settings, setSettings] = useState({
    symbol: "hat",
    maxPlayers: 2,
    privateRoom: false,
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
  const [boardVariantId, setBoardVariantId] = useState("default");

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

  const extractGameId = (response: unknown): string | number | undefined => {
    if (typeof response === "string" || typeof response === "number") return response;
    const r = response as GameCreateResponse & {
      gameId?: string | number;
      data?: { game?: { id?: string | number } };
    };
    return (
      r?.data?.data?.id ??
      r?.data?.id ??
      r?.id ??
      r?.gameId ??
      r?.data?.game?.id
    );
  };

  const handlePlay = async () => {
    setCreateError(null);

    if (!canCreate) {
      toast.error("Please register and connect your wallet");
      return;
    }

    const toastId = toast.loading("Creating game...");

    if (isGuest) {
      try {
        toast.update(toastId, { render: "Creating game (guest)..." });
        const res = await apiClient.post<GameCreateResponse>("/games/create-as-guest", {
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
          board_id: boardVariantId,
          settings: {
            auction: settings.auction,
            rent_in_prison: settings.rentInPrison,
            mortgage: settings.mortgage,
            even_build: settings.evenBuild,
            starting_cash: settings.startingCash,
          },
        });
        const dbGameId = extractGameId(res);
        if (!dbGameId) throw new Error("Backend did not return game ID");
        toast.update(toastId, {
          render: `Game created! Share code: ${gameCode}`,
          type: "success",
          isLoading: false,
          autoClose: 5000,
          onClose: () => router.push(`${redirectToWaitingRoom}?gameCode=${gameCode}`),
        });
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
            ?.message ??
          (err as Error)?.message ??
          "Failed to create game";
        toast.update(toastId, { render: msg, type: "error", isLoading: false, autoClose: 8000 });
      }
      return;
    }

    const playAddress =
      address ??
      getGuestUserPlayAddress(guestAuth?.guestUser ?? null) ??
      undefined;

    if (!playAddress || !username || !isUserRegistered) {
      toast.error("Connect wallet and register first!", { autoClose: 5000 });
      return;
    }

    if (!contractAddress) {
      toast.error("Game contract not available on this network.");
      return;
    }

    if (!isFreeGame && !usdcTokenAddress) {
      toast.error("USDC not supported on current network.");
      return;
    }

    try {
      if (!isFreeGame) {
        toast.update(toastId, { render: "Checking USDC allowance..." });
        await refetchAllowance();
        const allowance = usdcAllowance ? BigInt(usdcAllowance.toString()) : 0n;
        if (allowance < stakeAmount) {
          toast.update(toastId, { render: "Approving USDC (one-time)..." });
          await approveUSDC(usdcTokenAddress!, contractAddress, stakeAmount);
          await new Promise((r) => setTimeout(r, 4000));
          await refetchAllowance();
        }
      }

      toast.update(toastId, { render: "Creating game on-chain..." });
      const txHash = await createGame();
      if (!txHash) throw new Error("Failed to create game on-chain");

      toast.update(toastId, { render: "Saving game to server..." });

      const saveRes = await apiClient.post<GameCreateResponse>("/games", {
        code: gameCode,
        mode: gameType,
        address: playAddress,
        symbol: settings.symbol,
        number_of_players: settings.maxPlayers,
        stake: finalStake,
        starting_cash: settings.startingCash,
        is_ai: false,
        is_minipay: isMiniPay,
        chain: chainName,
        duration: settings.duration,
        use_usdc: !isFreeGame,
        board_id: boardVariantId,
        settings: {
          auction: settings.auction,
          rent_in_prison: settings.rentInPrison,
          mortgage: settings.mortgage,
          even_build: settings.evenBuild,
          starting_cash: settings.startingCash,
        },
      });

      const dbGameId = extractGameId(saveRes);
      if (!dbGameId) throw new Error("Backend did not return game ID");

      toast.update(toastId, {
        render: `Game created! Share code: ${gameCode}`,
        type: "success",
        isLoading: false,
        autoClose: 5000,
        onClose: () => router.push(`${redirectToWaitingRoom}?gameCode=${gameCode}`),
      });
    } catch (err: unknown) {
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

  const houseRules = [
    { icon: RiAuctionFill, label: "Auction Unsold", key: "auction", desc: "Automatic property auctions" },
    { icon: GiPrisoner, label: "Rent in Jail", key: "rentInPrison", desc: "Pay rent while imprisoned" },
    { icon: GiBank, label: "Allow Mortgages", key: "mortgage", desc: "Mortgage property for cash" },
    { icon: IoBuild, label: "Even Building", key: "evenBuild", desc: "Balanced house distribution" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0E282A] via-slate-900 to-slate-950 relative overflow-hidden flex flex-col">
      {/* Scanline overlay */}
      <ScanlineOverlay />

      {/* Content */}
      <div className="relative z-10 flex-1 flex items-start justify-center p-3 sm:p-4 md:p-6 lg:p-8">
        <div className="w-full max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="font-orbitron text-2xl md:text-3xl font-bold text-cyan-300">⚔️ CREATE GAME</h1>
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 text-sm font-orbitron text-cyan-300 hover:text-cyan-100 transition-colors"
            >
              BACK
            </button>
          </div>

          {/* Desktop: Two-column layout | Mobile: Single column vertical */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
            {/* LEFT COLUMN */}
            <div className="space-y-4 md:space-y-6">
              {/* Select Piece */}
              <div>
                <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Your Piece</p>
                {/* Mobile: Horizontal scroll */}
                <div className="md:hidden overflow-x-auto pb-2">
                  <div className="flex gap-2 min-w-min">
                    {GamePieces.map((piece, idx) => (
                      <motion.button
                        key={piece.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: idx * 0.05 }}
                        onClick={() => setSettings((p) => ({ ...p, symbol: piece.id }))}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`relative p-2 rounded-lg transition-all duration-300 border-2 flex-shrink-0 w-24 h-28 flex flex-col items-center justify-center ${
                          settings.symbol === piece.id
                            ? "border-cyan-400 bg-cyan-500/20 shadow-lg shadow-cyan-500/50"
                            : "border-cyan-500/30 bg-slate-800/40 hover:border-cyan-400/60"
                        }`}
                      >
                        <div className="text-xl mb-1">{PIECE_EMOJI[piece.id]}</div>
                        <div className="text-[10px] font-orbitron text-cyan-300 font-bold text-center line-clamp-2 px-0.5 leading-tight">
                          {piece.name}
                        </div>
                        {settings.symbol === piece.id && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-cyan-500/60"
                          >
                            ✓
                          </motion.div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Desktop: 5-column grid */}
                <div className="hidden md:grid grid-cols-5 gap-2">
                  {GamePieces.map((piece, idx) => (
                    <motion.button
                      key={piece.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: idx * 0.05 }}
                      onClick={() => setSettings((p) => ({ ...p, symbol: piece.id }))}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`relative p-2 rounded-lg transition-all duration-300 border-2 flex flex-col items-center justify-center py-3 ${
                        settings.symbol === piece.id
                          ? "border-cyan-400 bg-cyan-500/20 shadow-lg shadow-cyan-500/50"
                          : "border-cyan-500/30 bg-slate-800/40 hover:border-cyan-400/60"
                      }`}
                    >
                      <div className="text-2xl mb-1">{PIECE_EMOJI[piece.id]}</div>
                      <div className="text-xs font-orbitron text-cyan-300 font-bold text-center truncate px-1">
                        {piece.name}
                      </div>
                      {settings.symbol === piece.id && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-cyan-500/60"
                        >
                          ✓
                        </motion.div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Max Players Formation */}
              <div>
                <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Max Players</p>

                {/* Number buttons row */}
                <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                  {[2, 3, 4, 5, 6, 7, 8].map((num) => (
                    <motion.button
                      key={num}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSettings((p) => ({ ...p, maxPlayers: num }))}
                      className={`py-2 rounded-lg font-orbitron font-bold text-sm transition-all duration-300 border-2 ${
                        settings.maxPlayers === num
                          ? "border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-lg shadow-cyan-500/40"
                          : "border-cyan-500/30 bg-slate-800/40 text-cyan-400/60 hover:border-cyan-400/60"
                      }`}
                    >
                      {num}
                    </motion.button>
                  ))}
                </div>

                {/* Avatar slots - Desktop only */}
                <div className="hidden md:grid grid-cols-8 gap-2 mt-3">
                  {[...Array(8)].map((_, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: idx < settings.maxPlayers ? 1 : 0.3, scale: 1 }}
                      transition={{ duration: 0.3, delay: idx * 0.05 }}
                      className={`aspect-square rounded-lg border-2 flex items-center justify-center transition-all ${
                        idx < settings.maxPlayers
                          ? "border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/30"
                          : "border-cyan-500/20 bg-slate-800/20"
                      }`}
                    >
                      <div className="text-lg">👤</div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <BoardVariantPicker value={boardVariantId} onChange={setBoardVariantId} className="mt-4" />

              {/* Private/Free Games */}
              <div className="space-y-3">
                {/* Private Room */}
                <div>
                  <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Room Access</p>
                  <div className="bg-black/60 rounded-xl md:rounded-2xl p-3 md:p-4 border border-gray-600">
                    <PrivateLock
                      checked={settings.privateRoom}
                      onCheckedChange={(v) => setSettings((p) => ({ ...p, privateRoom: v }))}
                    />
                  </div>
                </div>

                {/* Free Game Toggle - Non-guests only */}
                {!isGuest && (
                  <div>
                    <div className="bg-black/60 rounded-lg p-3 border border-yellow-600/50">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FaCoins className="w-4 h-4 text-yellow-400" />
                          <div>
                            <h3 className="text-xs font-bold text-yellow-300">Free Game</h3>
                            <p className="text-gray-400 text-[10px]">No stake</p>
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
                  <div className="bg-black/60 rounded-lg p-3 border border-yellow-600/50">
                    <div className="flex items-center gap-2">
                      <FaCoins className="w-4 h-4 text-yellow-400" />
                      <div>
                        <h3 className="text-xs font-bold text-yellow-300">Guest Games Free</h3>
                        <p className="text-gray-400 text-[10px]">Connect wallet for stakes</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-4 md:space-y-6">
              {/* Entry Stake - Non-guests only */}
              {!isGuest && (
                <div>
                  <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Entry Stake</p>
                  <div className={`bg-gradient-to-b from-green-900/60 to-emerald-900/60 rounded-xl md:rounded-2xl p-3 md:p-4 border border-green-500/40 transition-opacity duration-300 ${isFreeGame ? 'opacity-50' : ''}`}>
                    {isFreeGame ? (
                      <div className="py-3 text-center">
                        <p className="text-lg md:text-xl font-black text-yellow-400">FREE</p>
                        <p className="text-xs text-yellow-300/90">No entry fee</p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-1 mb-2">
                          {stakePresets.map((amount) => (
                            <button
                              key={amount}
                              onClick={() => handleStakeSelect(amount)}
                              className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all hover:scale-105 ${
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
                          placeholder="Custom"
                          value={customStake}
                          onChange={(e) => handleCustomStake(e.target.value)}
                          className="w-full px-2 py-1.5 bg-black/60 border border-green-500/50 rounded-lg text-white text-xs text-center focus:outline-none focus:border-green-400 disabled:opacity-50"
                          disabled={isFreeGame}
                        />

                        <p className="text-xs text-gray-400 text-center mt-1">
                          {settings.stake} USDC
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Starting Cash */}
              <div>
                <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-2">Starting Cash</p>
                <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/40 rounded-lg p-2 border border-amber-500/30">
                  <CashPicker
                    value={settings.startingCash}
                    onChange={(v) => setSettings((p) => ({ ...p, startingCash: v }))}
                  />
                </div>
              </div>

              {/* Game Duration */}
              <div>
                <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-2">Game Duration</p>
                <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 rounded-lg p-2 border border-indigo-500/30">
                  <DurationDial
                    value={settings.duration}
                    onChange={(v) => setSettings((p) => ({ ...p, duration: v }))}
                  />
                </div>
              </div>

              {/* Mission Parameters - Desktop: fits in right column, Mobile: below */}
              <div className="md:col-span-1">
                <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Mission Parameters</p>
                <div className="bg-black/60 rounded-xl md:rounded-2xl p-3 md:p-4 border border-cyan-500/30">
                  <div className="grid grid-cols-2 gap-2">
                    {houseRules.map((rule, idx) => {
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
              text="CREATE GAME"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
