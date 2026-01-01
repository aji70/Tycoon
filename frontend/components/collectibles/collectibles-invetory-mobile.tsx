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

interface CollectibleInventoryBarProps {
  game: Game;
  game_properties: GameProperty[];
  isMyTurn: boolean;
}

const perkMetadata: Record<number, { 
  name: string; 
  icon: React.ReactNode; 
  gradient: string; 
  image?: string;
  canBeActivated: boolean;
  fakeDescription?: string;
}> = {
  1: { name: "Extra Turn", icon: <Zap className="w-10 h-10" />, gradient: "from-yellow-500 to-amber-600", image: "/game/shop/a.jpeg", canBeActivated: false, fakeDescription: "Coming Soon" },
  2: { name: "Jail Free Card", icon: <Crown className="w-10 h-10" />, gradient: "from-purple-600 to-pink-600", image: "/game/shop/b.jpeg", canBeActivated: false, fakeDescription: "Coming Soon" },
  3: { name: "Double Rent", icon: <Coins className="w-10 h-10" />, gradient: "from-green-600 to-emerald-600", image: "/game/shop/c.jpeg", canBeActivated: false, fakeDescription: "Not Available Yet" },
  4: { name: "Roll Boost", icon: <Sparkles className="w-10 h-10" />, gradient: "from-blue-600 to-cyan-600", image: "/game/shop/a.jpeg", canBeActivated: false, fakeDescription: "Coming Soon" },
  5: { name: "Instant Cash", icon: <Gem className="w-10 h-10" />, gradient: "from-cyan-600 to-teal-600", image: "/game/shop/b.jpeg", canBeActivated: true },
  6: { name: "Teleport", icon: <Zap className="w-10 h-10" />, gradient: "from-pink-600 to-rose-600", image: "/game/shop/c.jpeg", canBeActivated: true },
  7: { name: "Shield", icon: <Shield className="w-10 h-10" />, gradient: "from-indigo-600 to-blue-600", image: "/game/shop/a.jpeg", canBeActivated: false, fakeDescription: "Coming Soon" },
  8: { name: "Property Discount", icon: <Coins className="w-10 h-10" />, gradient: "from-orange-600 to-red-600", image: "/game/shop/b.jpeg", canBeActivated: false, fakeDescription: "Not Available Yet" },
  9: { name: "Tax Refund", icon: <Gem className="w-10 h-10" />, gradient: "from-teal-600 to-cyan-600", image: "/game/shop/c.jpeg", canBeActivated: true },
  10: { name: "Exact Roll", icon: <Sparkles className="w-10 h-10" />, gradient: "from-amber-600 to-yellow-500", image: "/game/shop/a.jpeg", canBeActivated: false, fakeDescription: "Coming Soon" },
};

export default function CollectibleInventoryBar({
  game,
  game_properties,
  isMyTurn,
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

  const getRealPlayerId = (walletAddress: string | undefined): number | null => {
    if (!walletAddress) return null;
    const owned = game_properties.find(
      gp => gp.address?.toLowerCase() === walletAddress.toLowerCase()
    );
    return owned?.player_id ?? null;
  };

  const applyCashAdjustment = async (playerId: number, amount: number): Promise<boolean> => {
    if (amount === 0) return true;

    const targetPlayer = game.players.find(p => p.user_id === playerId);
    if (!targetPlayer?.address) return false;

    const realPlayerId = getRealPlayerId(targetPlayer.address);
    if (!realPlayerId) return false;

    try {
      const res = await apiClient.put<ApiResponse>(`/game-players/${realPlayerId}`, {
        game_id: game.id,
        user_id: targetPlayer.user_id,
        balance: (targetPlayer.balance ?? 0) + amount,
      });
      return res?.success ?? false;
    } catch {
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
        user_id: targetPlayer.user_id,
        position: newPos,
      });
      return res?.success ?? false;
    } catch {
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

  const tokenCalls = useMemo(() =>
    Array.from({ length: ownedCount }, (_, i) => ({
      address: contractAddress!,
      abi: RewardABI as Abi,
      functionName: "tokenOfOwnerByIndex",
      args: [address!, BigInt(i)],
    } as const)),
    [contractAddress, address, ownedCount]
  );

  const { data: tokenResults } = useReadContracts({
    contracts: tokenCalls,
    query: { enabled: ownedCount > 0 && !!contractAddress && !!address },
  });

  const ownedTokenIds = tokenResults
    ?.map(r => r.status === "success" ? r.result as bigint : null)
    .filter((id): id is bigint => id !== null && id >= COLLECTIBLE_ID_START) ?? [];

  const infoCalls = useMemo(() =>
    ownedTokenIds.map(id => ({
      address: contractAddress!,
      abi: RewardABI as Abi,
      functionName: "getCollectibleInfo",
      args: [id],
    } as const)),
    [contractAddress, ownedTokenIds]
  );

  const { data: infoResults } = useReadContracts({
    contracts: infoCalls,
    query: { enabled: ownedTokenIds.length > 0 },
  });

  const ownedCollectibles = useMemo(() => {
    if (!infoResults) return [];

    return infoResults.map((res, i) => {
      if (res?.status !== "success") return null;
      const [perkBig, strengthBig] = res.result as [bigint, bigint];
      const perk = Number(perkBig);
      const meta = perkMetadata[perk] || perkMetadata[10];
      const displayName = (perk === 5 || perk === 9) 
        ? `${meta.name} (Tier ${Number(strengthBig)})` 
        : meta.name;

      return {
        tokenId: ownedTokenIds[i],
        perk,
        name: displayName,
        icon: meta.icon,
        gradient: meta.gradient,
        canBeActivated: meta.canBeActivated,
        fakeDescription: meta.fakeDescription,
        strength: Number(strengthBig),
      };
    }).filter((item): item is NonNullable<typeof item> => !!item);
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

  const shopTokenCalls = useMemo(() =>
    Array.from({ length: shopCount }, (_, i) => ({
      address: contractAddress!,
      abi: RewardABI as Abi,
      functionName: "tokenOfOwnerByIndex",
      args: [contractAddress!, BigInt(i)],
    } as const)),
    [contractAddress, shopCount]
  );

  const { data: shopTokenResults } = useReadContracts({
    contracts: shopTokenCalls,
    query: { enabled: shopCount > 0 && !!contractAddress },
  });

  const shopTokenIds = shopTokenResults
    ?.map(r => r.status === "success" ? r.result as bigint : null)
    .filter((id): id is bigint => id !== null && id >= COLLECTIBLE_ID_START) ?? [];

  const shopInfoCalls = useMemo(() =>
    shopTokenIds.map(id => ({
      address: contractAddress!,
      abi: RewardABI as Abi,
      functionName: "getCollectibleInfo",
      args: [id],
    } as const)),
    [contractAddress, shopTokenIds]
  );

  const { data: shopInfoResults } = useReadContracts({
    contracts: shopInfoCalls,
    query: { enabled: shopTokenIds.length > 0 },
  });

  const shopItems = useMemo(() => {
    if (!shopInfoResults) return [];

    return shopInfoResults.map((res, i) => {
      if (res?.status !== "success") return null;
      const [perkBig, strengthBig, tycPriceBig, usdcPriceBig, stockBig] = res.result as [bigint, bigint, bigint, bigint, bigint];
      const perk = Number(perkBig);
      const stock = Number(stockBig);
      if (stock === 0) return null;

      const meta = perkMetadata[perk] || perkMetadata[10];

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
    }).filter((item): item is NonNullable<typeof item> => !!item);
  }, [shopInfoResults, shopTokenIds]);

  // === BUY LOGIC ===
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
      const item = shopItems.find(i => i?.tokenId === approvingId);
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

    // Perks that require selection
    if (perkId === 6 || perkId === 10) {
      setPendingPerkTokenId(tokenId);
      return;
    }

    const confirmed = window.confirm(`Use ${name}? This will BURN your collectible.`);
    if (!confirmed) return;

    const toastId = toast.loading("Activating perk...", { duration: 10000 });

    try {
      await burnCollectible(tokenId); // ← still commented out

      let success = false;
      let amount = 0;

      if (perkId === 5) {
        // Instant Cash – using fixed tier array
        amount = CASH_TIERS[Math.min(strength, CASH_TIERS.length - 1)] || 0;
        success = await applyCashAdjustment(currentPlayer.user_id, amount);
        if (success && amount > 0) {
          toast.success(`+$${amount.toLocaleString()} instant cash added!`, { id: toastId });
        } else if (amount === 0) {
          toast("Instant Cash activated (Tier 0 - no cash added)", { id: toastId });
        }
      } 
      else if (perkId === 9) {
        // Tax Refund – smaller fixed tiers
        amount = REFUND_TIERS[Math.min(strength, REFUND_TIERS.length - 1)] || 0;
        success = await applyCashAdjustment(currentPlayer.user_id, amount);
        if (success && amount > 0) {
          toast.success(`+$${amount.toLocaleString()} tax refund received!`, { id: toastId });
        } else if (amount === 0) {
          toast("Tax Refund activated (Tier 0 - no refund)", { id: toastId });
        }
      }

      if (success || amount === 0) {
        toast.success(`${name} activated! 🎉`, { id: toastId });
      } else {
        throw new Error("Perk effect failed");
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err.message || "Failed to activate perk";
      toast.error(errorMsg, { id: toastId });
      console.error("Perk activation error:", err);
    }
  };

 const handleConfirmSpecialPerk = async () => {
    if (!pendingPerkTokenId || !currentPlayer) return;

    const perkItem = ownedCollectibles.find(c => c?.tokenId === pendingPerkTokenId);
    if (!perkItem) return;

    const { perk } = perkItem;

    if (perk === 6 && selectedPositionIndex === null) {
      toast.error("Select a position to teleport to");
      return;
    }

    if (perk === 10 && selectedRollTotal === null) {
      toast.error("Select your exact roll value");
      return;
    }

    const confirmed = window.confirm(`Burn collectible and activate ${perkItem.name}?`);
    if (!confirmed) return;

    const toastId = toast.loading("Activating...", { duration: 10000 });

    try {
      await burnCollectible(pendingPerkTokenId); // ← commented out

      if (perk === 6) {
        const success = await applyPositionChange(
          currentPlayer.user_id,
          selectedPositionIndex!
        );
        if (success) {
          toast.success(`Teleported to ${BOARD_POSITIONS[selectedPositionIndex!]}! 🚀`, { id: toastId });
        } else {
          throw new Error("Teleport failed");
        }
      } else if (perk === 10) {
        toast.success(`Next roll set to ${selectedRollTotal} (preview only)`, { id: toastId });
      }

      setPendingPerkTokenId(null);
      setSelectedPositionIndex(null);
      setSelectedRollTotal(null);
    } catch (err) {
      const errorMsg =  "Failed to activate perk";
      toast.error(errorMsg, { id: toastId });
    }
  };

  if (!isConnected || totalOwned === 0) return null;

  return (
    <>
      {/* Your Perks - Vertical Full-Width Cards in Popup */}
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-cyan-300">Your Perks ({totalOwned})</h3>
          <button
            onClick={() => setShowMiniShop(true)}
            className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-xl text-black font-bold shadow-lg hover:shadow-cyan-500/50"
          >
            <ShoppingBag className="w-6 h-6" />
            Open Shop
          </button>
        </div>

        {ownedCollectibles.map((item) => (
          <motion.button
            key={item.tokenId.toString()}
            whileTap={{ scale: 0.97 }}
            onClick={() => handleUsePerk(item.tokenId, item.perk, item.name, item.canBeActivated, item.strength)}
            disabled={!isMyTurn || !item.canBeActivated}
            className={`w-full p-6 rounded-2xl overflow-hidden relative transition-all ${
              !isMyTurn || !item.canBeActivated
                ? "opacity-60"
                : "hover:shadow-2xl hover:shadow-cyan-500/30 active:scale-98"
            }`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-90`} />
            <div className="relative flex items-center gap-6">
              <div className="text-white">{item.icon}</div>
              <div className="text-left flex-1">
                <p className="text-2xl font-bold text-white">{item.name}</p>
                {!item.canBeActivated && (
                  <p className="text-sm text-gray-200 mt-1">
                    {item.fakeDescription || "Coming Soon"}
                  </p>
                )}
              </div>
              {!isMyTurn && (
                <p className="text-sm text-gray-300">Wait for turn</p>
              )}
            </div>
          </motion.button>
        ))}
      </div>

      {/* Shop Modal */}
      <AnimatePresence>
        {showMiniShop && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMiniShop(false)}
              className="fixed inset-0 bg-black/80 z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 top-16 z-50 bg-[#0A1C1E] rounded-t-3xl border-t border-cyan-500/50 overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-cyan-900/50 flex items-center justify-between">
                <h2 className="text-3xl font-bold flex items-center gap-4">
                  <ShoppingBag className="w-10 h-10 text-[#00F0FF]" />
                  Perk Shop
                </h2>
                <button onClick={() => setShowMiniShop(false)} className="p-2">
                  <X className="w-8 h-8 text-gray-400" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex justify-between text-lg">
                  <div className="flex items-center gap-3">
                    <Wallet className="w-6 h-6 text-cyan-400" />
                    <span>TYC: {tycBal ? Number(tycBal.formatted).toFixed(2) : "0.00"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Wallet className="w-6 h-6 text-cyan-400" />
                    <span>USDC: {usdcBal ? Number(usdcBal.formatted).toFixed(2) : "0.00"}</span>
                  </div>
                </div>

                <button
                  onClick={() => setUseUsdc(!useUsdc)}
                  className="w-full py-4 bg-cyan-900/50 rounded-xl border border-cyan-500 text-lg font-medium"
                >
                  Pay with {useUsdc ? "USDC" : "TYC"}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-6">
                {shopItems.length === 0 ? (
                  <p className="text-center text-gray-400 text-xl py-20">
                    No items available right now...
                  </p>
                ) : (
                  shopItems.map((item) => (
                    <motion.div
                      key={item.tokenId.toString()}
                      whileTap={{ scale: 0.97 }}
                      className="bg-gradient-to-br from-[#0E1415] to-[#0A1C1E] rounded-2xl border border-cyan-900/50 overflow-hidden shadow-xl"
                    >
                      <div className="relative h-56">
                        <Image
                          src={item.image || "/game/shop/placeholder.jpg"}
                          alt={item.name}
                          fill
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                        <div className="absolute bottom-6 left-6 flex items-center gap-4">
                          <div className="text-white text-5xl">{item.icon}</div>
                          <div>
                            <h3 className="text-3xl font-bold text-white">{item.name}</h3>
                            <p className="text-gray-300">Stock: {item.stock}</p>
                          </div>
                        </div>
                      </div>

                      <div className="p-6">
                        <p className="text-3xl font-bold text-cyan-300 mb-6">
                          {useUsdc ? `$${item.usdcPrice}` : `${item.tycPrice} TYC`}
                        </p>
                        <button
                          onClick={() => handleBuy(item)}
                          disabled={buyingId === item.tokenId || approvingId === item.tokenId}
                          className="w-full py-5 rounded-xl bg-gradient-to-r from-[#00F0FF] to-cyan-400 text-black text-xl font-bold disabled:opacity-60 flex items-center justify-center gap-3"
                        >
                          {buyingId === item.tokenId || approvingId === item.tokenId ? (
                            <>
                              <Loader2 className="w-7 h-7 animate-spin" />
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

      {/* Special Perk Selection Modal */}
      <AnimatePresence>
        {pendingPerkTokenId && currentPlayer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-50"
              onClick={() => {
                setPendingPerkTokenId(null);
                setSelectedPositionIndex(null);
                setSelectedRollTotal(null);
              }}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 top-20 bg-[#0A1C1E] rounded-t-3xl border-t border-cyan-500/50 p-6 z-50 overflow-y-auto shadow-2xl"
            >
              <h3 className="text-3xl font-bold text-cyan-300 mb-8 text-center">
                {ownedCollectibles.find(c => c?.tokenId === pendingPerkTokenId)?.perk === 6
                  ? "Choose Teleport Destination"
                  : "Choose Exact Roll"}
              </h3>

              {ownedCollectibles.find(c => c?.tokenId === pendingPerkTokenId)?.perk === 6 && (
                <div className="grid grid-cols-2 gap-4 mb-10">
                  {BOARD_POSITIONS.map((name, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedPositionIndex(index)}
                      className={`py-4 px-4 rounded-xl text-base font-medium transition-all ${
                        selectedPositionIndex === index
                          ? "bg-cyan-600 text-black shadow-lg shadow-cyan-500/50"
                          : "bg-gray-800 hover:bg-gray-700"
                      }`}
                    >
                      {index}. {name}
                    </button>
                  ))}
                </div>
              )}

              {ownedCollectibles.find(c => c?.tokenId === pendingPerkTokenId)?.perk === 10 && (
                <div className="grid grid-cols-4 gap-5 mb-10">
                  {[2,3,4,5,6,7,8,9,10,11,12].map((total) => (
                    <button
                      key={total}
                      onClick={() => setSelectedRollTotal(total)}
                      className={`py-8 rounded-2xl text-3xl font-bold transition-all ${
                        selectedRollTotal === total
                          ? "bg-cyan-600 text-black shadow-2xl shadow-cyan-500/60"
                          : "bg-gray-800 hover:bg-gray-700"
                      }`}
                    >
                      {total}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-5">
                <button
                  onClick={() => {
                    setPendingPerkTokenId(null);
                    setSelectedPositionIndex(null);
                    setSelectedRollTotal(null);
                  }}
                  className="py-5 rounded-xl bg-gray-800 hover:bg-gray-700 text-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSpecialPerk}
                  disabled={isBurning}
                  className="py-5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 text-black text-xl font-bold disabled:opacity-60 flex items-center justify-center gap-3"
                >
                  {isBurning ? (
                    <>
                      <Loader2 className="w-7 h-7 animate-spin" />
                      Activating...
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