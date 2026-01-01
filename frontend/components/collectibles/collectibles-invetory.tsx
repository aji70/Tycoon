'use client';

import React, { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useBalance } from "wagmi";
import { formatUnits, type Address, type Abi, erc20Abi } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Image from "next/image";

import {
  Zap, Crown, Coins, Sparkles, Gem, Shield, ShoppingBag, Loader2, X, Wallet, Clock
} from "lucide-react";

import RewardABI from "@/context/abi/rewardabi.json";
import { REWARD_CONTRACT_ADDRESSES, TYC_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS } from "@/constants/contracts";
import { Game, GameProperty } from "@/types/game";
import { useRewardBurnCollectible } from "@/context/ContractProvider";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";

const COLLECTIBLE_ID_START = 2_000_000_000;

const BOARD_POSITIONS = [
  "GO", "Mediterranean Avenue", "Community Chest", "Baltic Avenue", "Income Tax",
  "Reading Railroad", "Oriental Avenue", "Chance", "Vermont Avenue", "Connecticut Avenue",
  "Jail / Just Visiting", "St. Charles Place", "Electric Company", "States Avenue", "Virginia Avenue",
  "Pennsylvania Railroad", "St. James Place", "Community Chest", "Tennessee Avenue", "New York Avenue",
  "Free Parking", "Kentucky Avenue", "Chance", "Indiana Avenue", "Illinois Avenue",
  "B. & O. Railroad", "Atlantic Avenue", "Ventnor Avenue", "Water Works", "Marvin Gardens",
  "Go To Jail", "Pacific Avenue", "North Carolina Avenue", "Community Chest", "Pennsylvania Avenue",
  "Short Line Railroad", "Chance", "Park Place", "Luxury Tax", "Boardwalk"
];

const CASH_TIERS = [0, 100, 250, 500, 700, 1000];
const REFUND_TIERS = [0, 60, 150, 300, 420, 600];
const DISCOUNT_TIERS = [0, 100, 200, 300, 400, 500];

interface CollectibleInventoryBarProps {
  game: Game;
  game_properties: GameProperty[];
  isMyTurn: boolean;
  ROLL_DICE?: () => void;
  END_TURN: () => void;
  triggerSpecialLanding?: (position: number, isSpecial: boolean) => void;
  endTurnAfterSpecial?: () => void;
}

const perkMetadata: Record<number, {
  name: string;
  icon: React.ReactNode;
  gradient: string;
  image?: string;
  canBeActivated: boolean;
  fakeDescription?: string;
}> = {
  1: { name: "Extra Turn", icon: <Zap className="w-6 h-6" />, gradient: "from-yellow-500 to-amber-600", image: "/game/shop/a.jpeg", canBeActivated: true },
  2: { name: "Jail Free Card", icon: <Crown className="w-6 h-6" />, gradient: "from-purple-600 to-pink-600", image: "/game/shop/b.jpeg", canBeActivated: true },
  3: { name: "Double Rent", icon: <Coins className="w-6 h-6" />, gradient: "from-green-600 to-emerald-600", image: "/game/shop/c.jpeg", canBeActivated: false, fakeDescription: "Not Available Yet" },
  4: { name: "Roll Boost", icon: <Sparkles className="w-6 h-6" />, gradient: "from-blue-600 to-cyan-600", image: "/game/shop/a.jpeg", canBeActivated: false, fakeDescription: "Coming Soon" },
  5: { name: "Instant Cash", icon: <Gem className="w-6 h-6" />, gradient: "from-cyan-600 to-teal-600", image: "/game/shop/b.jpeg", canBeActivated: true },
  6: { name: "Teleport", icon: <Zap className="w-6 h-6" />, gradient: "from-pink-600 to-rose-600", image: "/game/shop/c.jpeg", canBeActivated: true },
  7: { name: "Shield", icon: <Shield className="w-6 h-6" />, gradient: "from-indigo-600 to-blue-600", image: "/game/shop/a.jpeg", canBeActivated: false, fakeDescription: "Coming Soon" },
  8: { name: "Property Discount", icon: <Coins className="w-6 h-6" />, gradient: "from-orange-600 to-red-600", image: "/game/shop/b.jpeg", canBeActivated: true },
  9: { name: "Tax Refund", icon: <Gem className="w-6 h-6" />, gradient: "from-teal-600 to-cyan-600", image: "/game/shop/c.jpeg", canBeActivated: true },
  10: { name: "Exact Roll", icon: <Sparkles className="w-6 h-6" />, gradient: "from-amber-600 to-yellow-500", image: "/game/shop/a.jpeg", canBeActivated: true },
};

export default function CollectibleInventoryBar({
  game,
  game_properties,
  isMyTurn,
  ROLL_DICE,
  triggerSpecialLanding,
}: CollectibleInventoryBarProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES] as Address | undefined;

  const tycToken = TYC_TOKEN_ADDRESS[chainId as keyof typeof TYC_TOKEN_ADDRESS] as Address | undefined;
  const usdcToken = USDC_TOKEN_ADDRESS[chainId as keyof typeof USDC_TOKEN_ADDRESS] as Address | undefined;

  const [showMiniShop, setShowMiniShop] = useState(false);
  const [useUsdc, setUseUsdc] = useState(false);
  const [buyingId, setBuyingId] = useState<bigint | null>(null);
  const [approvingId, setApprovingId] = useState<bigint | null>(null);

  const [pendingPerkTokenId, setPendingPerkTokenId] = useState<bigint | null>(null);
  const [selectedPositionIndex, setSelectedPositionIndex] = useState<number | null>(null);
  const [selectedRollTotal, setSelectedRollTotal] = useState<number | null>(null);

  const selectedToken = useUsdc ? usdcToken : tycToken;
  const selectedDecimals = useUsdc ? 6 : 18;

  const { writeContract: writeBuy, data: buyHash, isPending: buyingPending } = useWriteContract();
  const { writeContract: writeApprove, data: approveHash, isPending: approving } = useWriteContract();

  const { isLoading: confirmingBuy } = useWaitForTransactionReceipt({ hash: buyHash });
  const { isLoading: confirmingApprove, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });

  const { data: tycBal } = useBalance({ address, token: tycToken });
  const { data: usdcBal } = useBalance({ address, token: usdcToken });

  const { data: allowance } = useReadContract({
    address: selectedToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && contractAddress ? [address, contractAddress] : undefined,
    query: { enabled: !!address && !!contractAddress && !!selectedToken },
  });

  const currentAllowance = allowance ?? 0;

  const { burn: burnCollectible, isPending: isBurning } = useRewardBurnCollectible();

  const currentPlayer = useMemo(() => {
    if (!address || !game?.players) return null;
    return game.players.find(p => p.address?.toLowerCase() === address.toLowerCase()) || null;
  }, [address, game?.players]);

  useEffect(() => {
    if (currentPlayer) {
      console.log("%c[DEBUG] Current Game Player:", "color: #00ffff; font-weight: bold;", currentPlayer);
    } else if (address && game?.players) {
      console.log("%c[DEBUG] No player found for connected wallet:", "color: #ff6b6b;", address);
    }
  }, [currentPlayer, address, game?.players]);

  const getRealPlayerId = (walletAddress: string | undefined): number | null => {
    if (!walletAddress) return null;
    const owned = game_properties.find(gp => gp.address?.toLowerCase() === walletAddress.toLowerCase());
    return owned?.player_id ?? null;
  };

  const applyCashAdjustment = async (playerId: number, amount: number): Promise<boolean> => {
    if (amount === 0) return true;
    const targetPlayer = game.players.find(p => p.user_id === playerId);
    if (!targetPlayer?.address) return false;
    const realPlayerId = getRealPlayerId(targetPlayer.address);
    if (!realPlayerId) {
      toast.error("Must own a property");
      return false;
    }
    try {
      const res = await apiClient.put<ApiResponse>(`/game-players/${realPlayerId}`, {
        game_id: game.id,
        user_id: targetPlayer.user_id,
        balance: (targetPlayer.balance ?? 0) + amount,
      });
      return res?.success ?? false;
    } catch {
      toast.error("Cash adjustment failed");
      return false;
    }
  };

  const applyPositionChange = async (playerId: number, newPos: number): Promise<boolean> => {
    if (newPos < 0 || newPos > 39) return false;
    const targetPlayer = game.players.find(p => p.user_id === playerId);
    if (!targetPlayer?.address) return false;
    const realPlayerId = getRealPlayerId(targetPlayer.address);
    if (!realPlayerId) return false;
    try {
      const res = await apiClient.put<ApiResponse>(`/game-players/${realPlayerId}`, {
        game_id: game.id,
        user_id: playerId,
        position: newPos,
      });
      return res?.success ?? false;
    } catch {
      toast.error("Position change failed");
      return false;
    }


  };

  const escapeJail = async (playerId: number): Promise<boolean> => {
    const targetPlayer = game.players.find(p => p.user_id === playerId);
    if (!targetPlayer?.address) return false;
    const realPlayerId = getRealPlayerId(targetPlayer.address);
    if (!realPlayerId) return false;
    try {
      const res = await apiClient.put<ApiResponse>(`/game-players/${realPlayerId}`, {
        game_id: game.id,
        user_id: playerId,
        in_jail: false,
      });
      return res?.success ?? false;
    } catch {
      toast.error("Failed to escape jail");
      return false;
    }
  };

  // === OWNED COLLECTIBLES ===
  const { data: ownedCountRaw } = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: "ownedTokenCount",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });

  const ownedCount = Number(ownedCountRaw ?? 0);

  const tokenCalls = useMemo(() => Array.from({ length: ownedCount }, (_, i) => ({
    address: contractAddress!,
    abi: RewardABI as Abi,
    functionName: "tokenOfOwnerByIndex" as const,
    args: [address!, BigInt(i)],
  })), [contractAddress, address, ownedCount]);

  const { data: tokenResults } = useReadContracts({
    contracts: tokenCalls,
    query: { enabled: ownedCount > 0 && !!contractAddress && !!address },
  });

  const ownedTokenIds = tokenResults
    ?.map(r => r.status === "success" ? r.result as bigint : null)
    .filter((id): id is bigint => id !== null && id >= COLLECTIBLE_ID_START) ?? [];

  const infoCalls = useMemo(() => ownedTokenIds.map(id => ({
    address: contractAddress!,
    abi: RewardABI as Abi,
    functionName: "getCollectibleInfo" as const,
    args: [id],
  })), [contractAddress, ownedTokenIds]);

  const { data: infoResults } = useReadContracts({
    contracts: infoCalls,
    query: { enabled: ownedTokenIds.length > 0 },
  });

  const ownedCollectibles = useMemo(() => {
    if (!infoResults) return [];

    return infoResults
      .map((res, i) => {
        if (res?.status !== "success") return null;
        const [perkBig, strengthBig] = res.result as [bigint, bigint];
        const perk = Number(perkBig);
        const strength = Number(strengthBig);
        const meta = perkMetadata[perk] ?? perkMetadata[10];

        const displayName = (perk === 5 || perk === 8 || perk === 9)
          ? `${meta.name} (Tier ${strength})`
          : meta.name;

        return {
          tokenId: ownedTokenIds[i],
          perk,
          name: displayName,
          icon: meta.icon,
          gradient: meta.gradient,
          canBeActivated: meta.canBeActivated,
          fakeDescription: meta.fakeDescription,
          strength,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }, [infoResults, ownedTokenIds]);

  const totalOwned = ownedCollectibles.length;

  // === SHOP ITEMS ===
  const { data: shopCountRaw } = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: "ownedTokenCount",
    args: contractAddress ? [contractAddress] : undefined,
    query: { enabled: !!contractAddress },
  });

  const shopCount = Number(shopCountRaw ?? 0);

  const shopTokenCalls = useMemo(() => Array.from({ length: shopCount }, (_, i) => ({
    address: contractAddress!,
    abi: RewardABI as Abi,
    functionName: "tokenOfOwnerByIndex" as const,
    args: [contractAddress!, BigInt(i)],
  })), [contractAddress, shopCount]);

  const { data: shopTokenResults } = useReadContracts({
    contracts: shopTokenCalls,
    query: { enabled: shopCount > 0 && !!contractAddress },
  });

  const shopTokenIds = shopTokenResults
    ?.map(r => r.status === "success" ? r.result as bigint : null)
    .filter((id): id is bigint => id !== null && id >= COLLECTIBLE_ID_START) ?? [];

  const shopInfoCalls = useMemo(() => shopTokenIds.map(id => ({
    address: contractAddress!,
    abi: RewardABI as Abi,
    functionName: "getCollectibleInfo" as const,
    args: [id],
  })), [contractAddress, shopTokenIds]);

  const { data: shopInfoResults } = useReadContracts({
    contracts: shopInfoCalls,
    query: { enabled: shopTokenIds.length > 0 },
  });

  const shopItems = useMemo(() => {
    if (!shopInfoResults) return [];

    return shopInfoResults
      .map((res, i) => {
        if (res?.status !== "success") return null;
        const [perkBig, , tycPriceBig, usdcPriceBig, stockBig] = res.result as [bigint, bigint, bigint, bigint, bigint];
        const perk = Number(perkBig);
        const stock = Number(stockBig);
        if (stock === 0) return null;

        const meta = perkMetadata[perk] ?? perkMetadata[10];

        return {
          tokenId: shopTokenIds[i],
          perk,
          tycPrice: formatUnits(tycPriceBig, 18),
          usdcPrice: formatUnits(usdcPriceBig, 6),
          stock,
          name: meta.name,
          icon: meta.icon,
          gradient: meta.gradient,
          image: meta.image,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [shopInfoResults, shopTokenIds]);

  // === BUY & APPROVE LOGIC ===
  const handleBuy = async (item: typeof shopItems[number]) => {
    if (!contractAddress || !address) {
      toast.error("Wallet not connected");
      return;
    }

    const priceStr = useUsdc ? item.usdcPrice : item.tycPrice;
    const priceBig = BigInt(Math.round(parseFloat(priceStr) * 10 ** selectedDecimals));

    if (currentAllowance < priceBig) {
      setApprovingId(item.tokenId);
      toast.loading(`Approving ${useUsdc ? "USDC" : "TYC"}...`, { id: "approve" });
      writeApprove({
        address: selectedToken!,
        abi: erc20Abi,
        functionName: "approve",
        args: [contractAddress, priceBig],
      });
      return;
    }

    setBuyingId(item.tokenId);
    toast.loading("Purchasing...", { id: "buy" });
    writeBuy({
      address: contractAddress,
      abi: RewardABI,
      functionName: "buyCollectible",
      args: [item.tokenId, useUsdc],
    });
  };

  useEffect(() => {
    if (approveSuccess && approvingId !== null) {
      toast.dismiss("approve");
      toast.success("Approved! Completing purchase...");
      const item = shopItems.find(i => i.tokenId === approvingId);
      if (item) handleBuy(item);
      setApprovingId(null);
    }
  }, [approveSuccess, approvingId, shopItems]);

  useEffect(() => {
    if (buyHash && !buyingPending && !confirmingBuy) {
      toast.success("Purchase complete! 🎉");
      setBuyingId(null);
    }
  }, [buyHash, buyingPending, confirmingBuy]);

  // === PERK ACTIVATION ===
  const handleUsePerk = async (
    tokenId: bigint,
    perkId: number,
    name: string,
    canBeActivated: boolean,
    strength: number = 1
  ) => {
    if (!isMyTurn) {
      toast("Wait for your turn!", { icon: "⏳" });
      return;
    }

    if (!currentPlayer) {
      toast.error("Player data not found");
      return;
    }

    if (!canBeActivated) {
      toast(`${name} — ${perkMetadata[perkId]?.fakeDescription || "Coming Soon"}`, {
        icon: <Clock className="w-5 h-5" />,
        duration: 5000
      });
      return;
    }

    if (perkId === 6 || perkId === 10) {
      setPendingPerkTokenId(tokenId);
      return;
    }

    const confirmed = window.confirm(`Use ${name}? This will BURN your collectible.`);
    if (!confirmed) return;

    const toastId = toast.loading("Activating perk...");

    try {
      let success = false;
      let amount = 0;

      switch (perkId) {
        case 5:
          amount = CASH_TIERS[Math.min(strength, CASH_TIERS.length - 1)];
          success = await applyCashAdjustment(currentPlayer.user_id, amount);
          break;
        case 9:
          amount = REFUND_TIERS[Math.min(strength, REFUND_TIERS.length - 1)];
          success = await applyCashAdjustment(currentPlayer.user_id, amount);
          break;
        case 8:
          amount = DISCOUNT_TIERS[Math.min(strength, DISCOUNT_TIERS.length - 1)];
          success = await applyCashAdjustment(currentPlayer.user_id, amount);
          if (success && amount > 0) toast.success(`+$${amount} Property Discount!`, { id: toastId });
          break;
        case 2:
          success = await escapeJail(currentPlayer.user_id);
          if (success) toast.success("Escaped jail! 🚔➡️🛤️", { id: toastId });
          break;
        case 1:
          if (ROLL_DICE) {
            toast.success("Extra Turn! Roll again!", { id: toastId });
            setTimeout(() => ROLL_DICE(), 800);
            success = true;
          } else {
            toast.error("Extra Turn not supported", { id: toastId });
          }
          break;
      }

      if (success || amount === 0) {
        toast.success(`${name} activated! 🎉`, { id: toastId });
      }
    } catch {
      toast.error("Activation failed", { id: toastId });
    }
  };

const handleConfirmSpecialPerk = async () => {
  if (!pendingPerkTokenId || !currentPlayer || !triggerSpecialLanding) {
    toast.error("Cannot activate right now");
    return;
  }

  const perkItem = ownedCollectibles.find(c => c.tokenId === pendingPerkTokenId);
  if (!perkItem) return;

  let targetPosition: number;

  if (perkItem.perk === 6) { // Teleport
    if (selectedPositionIndex === null) return toast.error("Choose destination");
    targetPosition = selectedPositionIndex;
  } else if (perkItem.perk === 10) { // Exact Roll
    if (selectedRollTotal === null) return toast.error("Choose roll value");
    targetPosition = (currentPlayer.position + selectedRollTotal) % 40;
  } else {
    return;
  }

  const confirmed = window.confirm(`Burn and activate ${perkItem.name}?`);
  if (!confirmed) return;

  const toastId = toast.loading("Activating...");

  try {
    const success = await applyPositionChange(currentPlayer.user_id, targetPosition);

    if (success) {
      toast.success(`${perkItem.name} activated! Moving...`, { id: toastId });

      // This is the key line — hand over control to AiBoard
      triggerSpecialLanding(targetPosition, true);

      // Reset UI
      setPendingPerkTokenId(null);
      setSelectedPositionIndex(null);
      setSelectedRollTotal(null);
    } else {
      throw new Error("Position update failed");
    }
  } catch (e) {
    toast.error("Activation failed", { id: toastId });
  }
};

  if (!isConnected || totalOwned === 0) return null;

  return (
    <>
      {/* Inventory Bar */}
      <div className="fixed bottom-6 right-6 z-50 pointer-events-auto">
        <div className="bg-black/90 backdrop-blur-xl rounded-2xl border border-cyan-500/40 p-5 shadow-2xl max-h-[70vh] overflow-y-auto w-72">
          <div className="flex items-center justify-between mb-4">
            <p className="text-cyan-300 text-sm font-bold uppercase tracking-wider">
              Your Perks ({totalOwned})
            </p>
            <button
              onClick={() => setShowMiniShop(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-lg text-black text-xs font-bold hover:shadow-lg hover:shadow-cyan-500/50 transition"
            >
              <ShoppingBag className="w-4 h-4" /> Shop
            </button>
          </div>

          <div className="space-y-3">
            {ownedCollectibles.map((item) => (
              <button
                key={item.tokenId.toString()}
                onClick={() => handleUsePerk(item.tokenId, item.perk, item.name, item.canBeActivated, item.strength)}
                disabled={!isMyTurn || !item.canBeActivated}
                className={`w-full relative rounded-xl overflow-hidden transition-all ${
                  isMyTurn && item.canBeActivated ? "hover:scale-105 cursor-pointer" : "opacity-60 cursor-not-allowed"
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-90`} />
                <div className="relative p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-white">{item.icon}</div>
                    <div>
                      <p className="text-white text-base font-bold">{item.name}</p>
                      {!item.canBeActivated && (
                        <p className="text-xs text-gray-300 mt-1">{item.fakeDescription || "Coming Soon"}</p>
                      )}
                    </div>
                  </div>
                </div>
                {!isMyTurn && (
                  <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                    <p className="text-sm text-gray-300">Wait for turn</p>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mini Shop Modal */}
      <AnimatePresence>
        {showMiniShop && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMiniShop(false)}
              className="fixed inset-0 bg-black/70 z-50"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-x-4 top-20 bottom-20 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-4xl z-50 bg-[#0A1C1E] rounded-3xl border border-cyan-500/50 overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-cyan-900/50 flex justify-between items-center">
                <h2 className="text-3xl font-bold flex items-center gap-3">
                  <ShoppingBag className="w-10 h-10 text-[#00F0FF]" />
                  Quick Perk Shop
                </h2>
                <button onClick={() => setShowMiniShop(false)} className="text-gray-400 hover:text-white">
                  <X className="w-8 h-8" />
                </button>
              </div>

              <div className="p-6 flex items-center justify-between mb-6">
                <div className="flex gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-[#00F0FF]" />
                    <span>TYC: {tycBal ? Number(tycBal.formatted).toFixed(2) : "0.00"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-[#00F0FF]" />
                    <span>USDC: {usdcBal ? Number(usdcBal.formatted).toFixed(2) : "0.00"}</span>
                  </div>
                </div>
                <button
                  onClick={() => setUseUsdc(!useUsdc)}
                  className="px-4 py-2 bg-cyan-900/50 rounded-lg border border-cyan-500 text-sm font-medium"
                >
                  Pay with {useUsdc ? "USDC" : "TYC"}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 px-6 pb-8 overflow-y-auto max-h-full">
                {shopItems.length === 0 ? (
                  <p className="col-span-full text-center text-gray-400 py-12">
                    No items available right now...
                  </p>
                ) : (
                  shopItems.map((item) => (
                    <motion.div
                      key={item.tokenId.toString()}
                      whileHover={{ scale: 1.05 }}
                      className="bg-gradient-to-br from-[#0E1415] to-[#0A1C1E] rounded-2xl border border-cyan-900/50 overflow-hidden"
                    >
                      <div className="relative h-40">
                        <Image
                          src={item.image || "/game/shop/placeholder.jpg"}
                          alt={item.name}
                          fill
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <div className="absolute bottom-4 left-4 flex items-center gap-2">
                          <div className="text-white">{item.icon}</div>
                          <span className="text-white font-bold">{item.name}</span>
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-xs text-gray-400 mb-2">Stock: {item.stock}</p>
                        <p className="text-lg text-cyan-300 mb-4 font-medium">
                          {useUsdc ? `$${item.usdcPrice}` : `${item.tycPrice} TYC`}
                        </p>
                        <button
                          onClick={() => handleBuy(item)}
                          disabled={item.stock === 0 || buyingId === item.tokenId || approvingId === item.tokenId}
                          className="w-full py-3 rounded-lg bg-gradient-to-r from-[#00F0FF] to-cyan-400 text-black font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                          {buyingId === item.tokenId || approvingId === item.tokenId ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            "Buy Now"
                          )}
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Special Perk Modal (Teleport & Exact Roll) */}
      <AnimatePresence>
        {pendingPerkTokenId && currentPlayer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-50"
              onClick={() => {
                setPendingPerkTokenId(null);
                setSelectedPositionIndex(null);
                setSelectedRollTotal(null);
              }}
            />
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0A1C1E] rounded-2xl border border-cyan-500/50 p-8 z-50 w-[520px] max-h-[85vh] overflow-y-auto shadow-2xl"
            >
              <h3 className="text-2xl font-bold text-cyan-300 mb-6 text-center">
                {ownedCollectibles.find(c => c.tokenId === pendingPerkTokenId)?.perk === 6 ? "Teleport Destination" : "Choose Exact Roll"}
              </h3>

              {ownedCollectibles.find(c => c.tokenId === pendingPerkTokenId)?.perk === 6 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8 max-h-96 overflow-y-auto pr-2">
                  {BOARD_POSITIONS.map((name, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedPositionIndex(index)}
                      className={`py-3 px-4 rounded-lg text-sm transition-all ${
                        selectedPositionIndex === index
                          ? "bg-cyan-600 text-black font-bold shadow-lg shadow-cyan-500/50"
                          : "bg-gray-800 hover:bg-gray-700"
                      }`}
                    >
                      {index}. {name}
                    </button>
                  ))}
                </div>
              )}

              {ownedCollectibles.find(c => c.tokenId === pendingPerkTokenId)?.perk === 10 && (
                <div className="grid grid-cols-4 gap-4 mb-8">
                  {[2,3,4,5,6,7,8,9,10,11,12].map((total) => (
                    <button
                      key={total}
                      onClick={() => setSelectedRollTotal(total)}
                      className={`py-4 rounded-lg font-bold text-lg transition ${
                        selectedRollTotal === total
                          ? "bg-cyan-600 text-black shadow-lg shadow-cyan-500/50"
                          : "bg-gray-800 hover:bg-gray-700"
                      }`}
                    >
                      {total}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => {
                    setPendingPerkTokenId(null);
                    setSelectedPositionIndex(null);
                    setSelectedRollTotal(null);
                  }}
                  className="flex-1 py-4 rounded-xl bg-gray-800 hover:bg-gray-700 transition text-white font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSpecialPerk}
                  disabled={isBurning}
                  className="flex-1 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-black font-bold disabled:opacity-60 transition flex items-center justify-center gap-2"
                >
                  {isBurning ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Activate Perk"
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}