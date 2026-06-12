"use client";

import React, { useState } from "react";
import { FaCoins } from "react-icons/fa6";
import { motion } from "framer-motion";
import { RiAuctionFill } from "react-icons/ri";
import { GiBank, GiPrisoner } from "react-icons/gi";
import { IoBuild } from "react-icons/io5";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useChainId,
  useReadContract,
} from 'wagmi';
import { resolveChainForBackend } from '@/lib/utils/chain';
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
  useStakeTokenAddress,
} from "@/context/ContractProvider";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { TYCOON_CONTRACT_ADDRESSES, MINIPAY_CHAIN_IDS } from "@/constants/contracts";
import { shouldUseBackendGuestGameFlow, ensureMiniPayWalletReady } from "@/lib/minipayGuestFlow";
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

interface GameSettingsMobileProps {
  /** After creating game, redirect to this waiting room (default: /game-waiting-3d). */
  redirectToWaitingRoom?: string;
}

export default function CreateGameMobile({ redirectToWaitingRoom = "/game-waiting-3d" }: GameSettingsMobileProps = {}) {
  const router = useRouter();
  const { address } = useAccount();
  const wagmiChainId = useChainId();
  const guestAuth = useGuestAuthOptional();
  const isGuest = shouldUseBackendGuestGameFlow(guestAuth?.guestUser ?? null, address, wagmiChainId);

  const { data: username } = useGetUsername(address);
  const { data: isUserRegistered, isLoading: isRegisteredLoading } = useIsRegistered(address);

  const isMiniPay = MINIPAY_CHAIN_IDS.includes(wagmiChainId);
  const chainName = resolveChainForBackend(wagmiChainId);

  const [isFreeGame, setIsFreeGame] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  const [settings, setSettings] = useState({
    symbol: "hat",
    maxPlayers: 2,
    includeStakedGames: false,
    auction: true,
    rentInPrison: false,
    mortgage: true,
    evenBuild: true,
    startingCash: 1500,
    stake: 0,
    duration: 30,
  });

  const [customStake, setCustomStake] = useState<string>("");
  const [createError, setCreateError] = useState<string | null>(null);

  const contractAddress = TYCOON_CONTRACT_ADDRESSES[wagmiChainId as keyof typeof TYCOON_CONTRACT_ADDRESSES] as Address | undefined;
  const { stakeTokenAddress, isLoading: stakeTokenLoading } = useStakeTokenAddress();

  const { data: stakeAllowance, refetch: refetchAllowance } = useReadContract({
    address: stakeTokenAddress,
    abi: Erc20Abi,
    functionName: 'allowance',
    args: address && contractAddress ? [address, contractAddress] : undefined,
    query: { enabled: !!address && !!stakeTokenAddress && !!contractAddress && !isFreeGame },
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
    if (isStarting) return;
    setIsStarting(true);
    setCreateError(null);
    const toastId = toast.loading("Creating game...");

    try {
      await ensureMiniPayWalletReady();
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? "Connect your wallet in MiniPay, then try again.";
      toast.update(toastId, { render: msg, type: "error", isLoading: false, autoClose: 8000 });
      setIsStarting(false);
      return;
    }

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
          render: `Game created! Code: ${gameCode}`,
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
          "Failed to create game.";
        toast.update(toastId, { render: msg, type: "error", isLoading: false, autoClose: 8000 });
      }
      setIsStarting(false);
      return;
    }

    if (!address || !username || !isUserRegistered) {
      toast.update(toastId, {
        render: "Connect your wallet and complete on-chain registration on the home page, then try again.",
        type: "error",
        isLoading: false,
        autoClose: 8000,
      });
      setIsStarting(false);
      return;
    }

    if (!contractAddress) {
      toast.update(toastId, { render: "Game contract not available on this network.", type: "error", isLoading: false });
      setIsStarting(false);
      return;
    }

    if (!isFreeGame && (stakeTokenLoading || !stakeTokenAddress)) {
      toast.update(toastId, { render: "USDT not supported on current network.", type: "error", isLoading: false });
      setIsStarting(false);
      return;
    }

    try {
      if (!isFreeGame) {
        toast.update(toastId, { render: "Checking USDT allowance..." });
        const allowanceResult = await refetchAllowance();
        const allowance = allowanceResult.data
          ? BigInt(allowanceResult.data.toString())
          : stakeAllowance
            ? BigInt(stakeAllowance.toString())
            : 0n;
        if (allowance < stakeAmount) {
          toast.update(toastId, { render: "Approving USDT (one-time)..." });
          await approveUSDC(stakeTokenAddress!, contractAddress, stakeAmount);
          await new Promise((r) => setTimeout(r, 4000));
          await refetchAllowance();
        }
      }

      toast.update(toastId, { render: "Creating game on-chain (sign in wallet)..." });
      const onChainGameId = await createGame();
      if (onChainGameId == null) throw new Error("Failed to create game on-chain");

      toast.update(toastId, { render: "Saving game to server..." });

      const saveRes = await apiClient.post<GameCreateResponse>("/games", {
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
          starting_cash: settings.startingCash,
        },
      });

      const dbGameId = extractGameId(saveRes);
      if (!dbGameId) throw new Error("Backend did not return game ID");

      toast.update(toastId, {
        render: `Game created! Code: ${gameCode}`,
        type: "success",
        isLoading: false,
        autoClose: 5000,
        onClose: () => router.push(`${redirectToWaitingRoom}?gameCode=${gameCode}`),
      });
    } catch (err: unknown) {
      const message = getContractErrorMessage(err, "Failed to create game. Please try again.");
      setCreateError(message);
      toast.update(toastId, {
        render: message,
        type: "error",
        isLoading: false,
        autoClose: 8000,
      });
    }
    setIsStarting(false);
  };

  const canCreate = isGuest || (address && username && isUserRegistered);

  const houseRules = [
    { icon: RiAuctionFill, label: "Auction Unsold", key: "auction" },
    { icon: GiPrisoner, label: "Rent in Jail", key: "rentInPrison" },
    { icon: GiBank, label: "Allow Mortgages", key: "mortgage" },
    { icon: IoBuild, label: "Even Building", key: "evenBuild" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0E282A] via-slate-900 to-slate-950 relative overflow-hidden flex flex-col">
      {/* Content */}
      <div className="relative z-10 flex-1 flex items-start justify-center p-4">
        <div className="w-full max-w-md mx-auto">
          {/* HEADER */}
          <div className="relative mb-8">
            {/* Glowing background */}
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 via-purple-500/10 to-cyan-500/20 rounded-lg blur-3xl opacity-60" />

            <div className="relative">
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
                onClick={() => router.push("/")}
                className="mb-4 flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-orbitron text-xs font-bold transition"
              >
                ← BACK TO BASE
              </motion.button>

              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center"
              >
                <h1 className="text-3xl font-black font-orbitron uppercase tracking-wider mb-2">
                  <span className="text-2xl">⚡</span>
                  <br />
                  <span
                    className="bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent"
                    style={{
                      textShadow: `
                        0 0 20px rgba(0, 240, 255, 0.5),
                        0 0 40px rgba(0, 240, 255, 0.3)
                      `,
                    }}
                  >
                    CREATE GAME
                  </span>
                </h1>
                <p className="text-cyan-300/70 font-dmSans text-xs tracking-widest uppercase mt-2">
                  Load Your Warrior • Configure Your Match • Prepare For Battle
                </p>
              </motion.div>
            </div>
          </div>

          {/* MAIN CONTENT - Single column stack */}
          <div className="space-y-6">
            {/* SELECT PIECE */}
            <div>
              <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Your Piece</p>
              <div className="overflow-x-auto pb-2">
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
                      className={`relative p-2 rounded-lg transition-all duration-300 border-2 flex-shrink-0 w-20 h-24 flex flex-col items-center justify-center ${
                        settings.symbol === piece.id
                          ? "border-cyan-400 bg-cyan-500/20 shadow-lg shadow-cyan-500/50"
                          : "border-cyan-500/30 bg-slate-800/40 hover:border-cyan-400/60"
                      }`}
                    >
                      <div className="text-xl mb-1">{PIECE_EMOJI[piece.id]}</div>
                      <div className="text-[9px] font-orbitron text-cyan-300 font-bold text-center line-clamp-2 px-0.5 leading-tight">
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
            </div>

            {/* MAX PLAYERS / OPPONENT SLOTS */}
            <div>
              <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Max Players</p>
              <div className="grid grid-cols-6 gap-2 mb-3">
                {[2, 3, 4, 5, 6, 7].map((num) => (
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

              {/* Avatar slots */}
              <div className="grid grid-cols-6 gap-2">
                {[...Array(7)].map((_, idx) => (
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

            {/* STARTING CASH */}
            <div>
              <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Starting Cash</p>
              <div className="grid grid-cols-2 gap-2">
                {[500, 1000, 1500, 2000].map((amount) => (
                  <motion.button
                    key={amount}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSettings((p) => ({ ...p, startingCash: amount }))}
                    className={`py-2 px-2 rounded-lg font-orbitron text-xs font-bold transition-all border-2 flex items-center justify-center gap-1 ${
                      settings.startingCash === amount
                        ? "border-cyan-400 bg-cyan-500/20 text-cyan-300"
                        : "border-cyan-500/30 bg-slate-800/40 text-cyan-400/60 hover:border-cyan-400/60"
                    }`}
                  >
                    💰 ${amount}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* GAME DURATION */}
            <div>
              <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Game Duration</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 30, label: "30m" },
                  { value: 45, label: "45m" },
                  { value: 60, label: "60m" },
                  { value: 90, label: "90m" },
                  { value: 0, label: "No Limit" },
                ].map((duration) => (
                  <motion.button
                    key={duration.value}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSettings((p) => ({ ...p, duration: duration.value }))}
                    className={`py-2 px-3 rounded-full font-orbitron text-xs font-bold transition-all border-2 ${
                      settings.duration === duration.value
                        ? "border-cyan-400 bg-cyan-500/20 text-cyan-300"
                        : "border-cyan-500/30 bg-slate-800/40 text-cyan-400/60 hover:border-cyan-400/60"
                    }`}
                  >
                    {duration.label}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* ROOM ACCESS - Always Public */}
            <div>
              <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Room Access</p>
              <motion.div
                className="relative p-3 rounded-lg border-2 border-cyan-500/30 bg-slate-800/40"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🔓</span>
                    <div>
                      <span className="text-xs font-orbitron font-bold text-white">
                        PUBLIC
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className="relative w-12 h-6 rounded-full transition-all duration-300 border-2 mt-2 border-cyan-500/30 bg-slate-700/60 cursor-not-allowed opacity-60"
                >
                  <div
                    className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-slate-500"
                  />
                </div>
              </motion.div>
            </div>

            {/* FREE GAMES TOGGLE - Non-guests only */}
            {!isGuest && (
              <div>
                <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Game Type</p>
                <motion.div
                  className={`relative p-3 rounded-lg border-2 transition-all ${
                    isFreeGame
                      ? "border-yellow-600/50 bg-yellow-900/20"
                      : "border-green-500/40 bg-green-900/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{isFreeGame ? "🎮" : "💰"}</span>
                      <div>
                        <span className="text-xs font-orbitron font-bold text-white">
                          {isFreeGame ? "FREE GAMES" : "STAKED GAMES"}
                        </span>
                        <p className="text-[10px] text-gray-400">{isFreeGame ? "No stake" : "Entry fee required"}</p>
                      </div>
                    </div>
                  </div>

                  <motion.button
                    onClick={() => {
                      setIsFreeGame(!isFreeGame);
                      if (!isFreeGame) {
                        setSettings((prev) => ({ ...prev, stake: 0 }));
                        setCustomStake("");
                      }
                    }}
                    className={`relative w-12 h-6 rounded-full transition-all duration-300 border-2 mt-2 ${
                      isFreeGame
                        ? "border-yellow-600 bg-gradient-to-r from-yellow-600 to-yellow-500 shadow-lg shadow-yellow-500/40"
                        : "border-green-500 bg-gradient-to-r from-green-600 to-green-500 shadow-lg shadow-green-500/40"
                    }`}
                  >
                    <motion.div
                      animate={{ x: isFreeGame ? 24 : 2 }}
                      transition={{ type: "spring", stiffness: 600, damping: 25 }}
                      className={`absolute top-0.5 w-5 h-5 rounded-full transition-colors ${
                        isFreeGame ? "bg-white shadow-lg shadow-yellow-400/50" : "bg-white shadow-lg shadow-green-400/50"
                      }`}
                    />
                  </motion.button>
                </motion.div>
              </div>
            )}

            {/* ENTRY STAKE (Non-guests only) */}
            {!isGuest && (
              <div>
                <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Entry Stake</p>
                <div
                  className={`p-3 rounded-lg border-2 transition-opacity duration-300 ${
                    isFreeGame
                      ? "border-yellow-600/50 bg-yellow-900/20 opacity-60"
                      : "border-green-500/40 bg-green-900/20"
                  }`}
                >
                  {isFreeGame ? (
                    <div className="py-3 text-center">
                      <p className="text-lg font-black text-yellow-400">FREE</p>
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
                        placeholder="Custom USDT"
                        value={customStake}
                        onChange={(e) => handleCustomStake(e.target.value)}
                        className="w-full px-2 py-1.5 bg-black/60 border border-green-500/50 rounded-lg text-white text-xs text-center focus:outline-none focus:border-green-400 disabled:opacity-50"
                        disabled={isFreeGame}
                      />
                      <p className="text-xs text-cyan-400 text-center mt-1">
                        {settings.stake} USDT
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* INCLUDE STAKED GAMES TOGGLE */}
            <div>
              <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Game Pool</p>
              <motion.div
                className={`relative p-3 rounded-lg border-2 transition-all ${
                  settings.includeStakedGames
                    ? "border-cyan-500/60 bg-cyan-500/15"
                    : "border-cyan-500/30 bg-slate-800/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{settings.includeStakedGames ? "💰" : "🎮"}</span>
                    <div>
                      <span className="text-xs font-orbitron font-bold text-white">
                        {settings.includeStakedGames ? "STAKED GAMES" : "FREE GAMES"}
                      </span>
                    </div>
                  </div>
                </div>

                <motion.button
                  onClick={() => setSettings((p) => ({ ...p, includeStakedGames: !p.includeStakedGames }))}
                  className={`relative w-12 h-6 rounded-full transition-all duration-300 border-2 mt-2 ${
                    settings.includeStakedGames
                      ? "border-cyan-500 bg-gradient-to-r from-cyan-600 to-cyan-500 shadow-lg shadow-cyan-500/40"
                      : "border-cyan-500/30 bg-slate-700/60"
                  }`}
                >
                  <motion.div
                    animate={{ x: settings.includeStakedGames ? 24 : 2 }}
                    transition={{ type: "spring", stiffness: 600, damping: 25 }}
                    className={`absolute top-0.5 w-5 h-5 rounded-full transition-colors ${
                      settings.includeStakedGames ? "bg-white shadow-lg shadow-cyan-400/50" : "bg-slate-500"
                    }`}
                  />
                </motion.button>
              </motion.div>
            </div>

            {/* GUEST GAMES FREE BANNER */}
            {isGuest && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-gradient-to-r from-yellow-900/40 to-amber-900/40 rounded-lg p-3 border border-yellow-600/50 animate-pulse"
              >
                <div className="flex items-center gap-2">
                  <FaCoins className="w-4 h-4 text-yellow-400" />
                  <div>
                    <h3 className="text-xs font-bold text-yellow-300">Guest Games Free</h3>
                    <p className="text-gray-400 text-[10px]">Connect wallet for stakes</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* HOUSE RULES */}
            <div>
              <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest mb-3">Mission Parameters</p>
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
                      <div className="flex items-center gap-1 text-center">
                        <span className="text-lg text-cyan-400 flex-shrink-0">{<rule.icon />}</span>
                        <span className="text-xs font-orbitron font-bold text-white uppercase text-center">
                          {rule.label}
                        </span>
                      </div>

                      <motion.button
                        onClick={() =>
                          setSettings((p) => ({ ...p, [rule.key]: !(p[rule.key as keyof typeof p] as boolean) }))
                        }
                        className={`relative w-10 h-5 rounded-full transition-all duration-300 border-2 ${
                          isActive
                            ? "border-cyan-500 bg-gradient-to-r from-cyan-600 to-cyan-500 shadow-lg shadow-cyan-500/40"
                            : "border-cyan-500/30 bg-slate-700/60"
                        }`}
                      >
                        <motion.div
                          animate={{ x: isActive ? 20 : 2 }}
                          transition={{ type: "spring", stiffness: 600, damping: 25 }}
                          className={`absolute top-0.5 w-4 h-4 rounded-full transition-colors ${
                            isActive ? "bg-white shadow-lg shadow-cyan-400/50" : "bg-slate-500"
                          }`}
                        />
                      </motion.button>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* LAUNCH BUTTON */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              onClick={() => playGuard.submit(() => handlePlay())}
              disabled={!canCreate || playGuard.isSubmitting || (!isGuest && isCreatePending)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 mt-4 text-base font-bold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-cyan-400/60 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-900 shadow-lg shadow-cyan-500/40"
            >
              {playGuard.isSubmitting || (!isGuest && isCreatePending)
                ? "⏳ LOADING..."
                : "⚡ INITIATE MATCH"}
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}
