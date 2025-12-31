'use client';

import React, { useMemo, useState, useEffect } from "react";
import { useAccount, useChainId, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useBalance } from "wagmi";
import { formatUnits, type Address, type Abi } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import Image from "next/image";

import {
  Zap, Crown, Coins, Sparkles, Gem, Shield, ShoppingBag, Loader2, X, Wallet
} from "lucide-react";

import RewardABI from "@/context/abi/rewardabi.json";
import { REWARD_CONTRACT_ADDRESSES, TYC_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS } from "@/constants/contracts";

const COLLECTIBLE_ID_START = 2_000_000_000;

interface CollectibleInventoryBarProps {
  onUseCollectible?: (tokenId: bigint, name: string) => Promise<void>;
  isMyTurn: boolean;
}

const perkMetadata: Record<number, { name: string; icon: React.ReactNode; gradient: string; image?: string }> = {
  1: { name: "Extra Turn", icon: <Zap className="w-6 h-6" />, gradient: "from-yellow-500 to-amber-600", image: "/game/shop/a.jpeg" },
  2: { name: "Jail Free Card", icon: <Crown className="w-6 h-6" />, gradient: "from-purple-600 to-pink-600", image: "/game/shop/b.jpeg" },
  3: { name: "Double Rent", icon: <Coins className="w-6 h-6" />, gradient: "from-green-600 to-emerald-600", image: "/game/shop/c.jpeg" },
  4: { name: "Roll Boost", icon: <Sparkles className="w-6 h-6" />, gradient: "from-blue-600 to-cyan-600", image: "/game/shop/a.jpeg" },
  5: { name: "Instant Cash", icon: <Gem className="w-6 h-6" />, gradient: "from-cyan-600 to-teal-600", image: "/game/shop/b.jpeg" },
  6: { name: "Teleport", icon: <Zap className="w-6 h-6" />, gradient: "from-pink-600 to-rose-600", image: "/game/shop/c.jpeg" },
  7: { name: "Shield", icon: <Shield className="w-6 h-6" />, gradient: "from-indigo-600 to-blue-600", image: "/game/shop/a.jpeg" },
  8: { name: "Property Discount", icon: <Coins className="w-6 h-6" />, gradient: "from-orange-600 to-red-600", image: "/game/shop/b.jpeg" },
  9: { name: "Tax Refund", icon: <Gem className="w-6 h-6" />, gradient: "from-teal-600 to-cyan-600", image: "/game/shop/c.jpeg" },
  10: { name: "Exact Roll", icon: <Sparkles className="w-6 h-6" />, gradient: "from-amber-600 to-yellow-500", image: "/game/shop/a.jpeg" },
};

export default function CollectibleInventoryBar({
  onUseCollectible,
  isMyTurn,
}: CollectibleInventoryBarProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES] as Address | undefined;

  const [showMiniShop, setShowMiniShop] = useState(false);
  const [useUsdc, setUseUsdc] = useState(false);
  const [buyingId, setBuyingId] = useState<bigint | null>(null);

  const { writeContract, data: txHash, isPending: writing } = useWriteContract();
  const { isLoading: confirmingTx } = useWaitForTransactionReceipt({ hash: txHash });

  const tycToken = TYC_TOKEN_ADDRESS[chainId as keyof typeof TYC_TOKEN_ADDRESS];
  const usdcToken = USDC_TOKEN_ADDRESS[chainId as keyof typeof USDC_TOKEN_ADDRESS];

  // === USER OWNED PERKS ===
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

    const collectibles: {
      tokenId: bigint;
      perk: number;
      strength: number;
      name: string;
      icon: React.ReactNode;
      gradient: string;
    }[] = [];

    infoResults.forEach((res, i) => {
      if (res?.status !== "success") return;
      const [perkBig, strengthBig] = res.result as [bigint, bigint];
      const perk = Number(perkBig);
      const strength = Number(strengthBig);
      const meta = perkMetadata[perk] || perkMetadata[10];
      const displayName = (perk === 5 || perk === 9) ? `${meta.name} (Tier ${strength})` : meta.name;

      collectibles.push({
        tokenId: ownedTokenIds[i],
        perk,
        strength,
        name: displayName,
        icon: meta.icon,
        gradient: meta.gradient,
      });
    });

    return collectibles;
  }, [infoResults, ownedTokenIds]);

  const totalOwned = ownedCollectibles.length;

  // === MINI SHOP DATA ===
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

    const items: {
      tokenId: bigint;
      perk: number;
      strength: number;
      stock: number;
      name: string;
      icon: React.ReactNode;
      gradient: string;
      image?: string;
    }[] = [];

    shopInfoResults.forEach((res, i) => {
      if (res?.status !== "success") return;
      const [perkBig, strengthBig, , , stockBig] = res.result as [bigint, bigint, bigint, bigint, bigint];
      const perk = Number(perkBig);
      const stock = Number(stockBig);
      if (stock === 0) return;

      const meta = perkMetadata[perk] || perkMetadata[10];
      items.push({
        tokenId: shopTokenIds[i],
        perk,
        strength: Number(strengthBig),
        stock,
        name: meta.name,
        icon: meta.icon,
        gradient: meta.gradient,
        image: meta.image,
      });
    });

    return items;
  }, [shopInfoResults, shopTokenIds]);

  // === BALANCES ===
  const { data: tycBal } = useBalance({ address, token: tycToken });
  const { data: usdcBal } = useBalance({ address, token: usdcToken });

  // === BUY LOGIC ===
  const handleBuy = async (item: {
    tokenId: bigint;
  }) => {
    if (!contractAddress || !address) {
      toast.error("Wallet not connected");
      return;
    }
    setBuyingId(item.tokenId);
    writeContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: "buyCollectible",
      args: [item.tokenId, useUsdc],
    });
  };

  useEffect(() => {
    if (txHash && !writing && !confirmingTx) {
      toast.success("Purchase complete! 🎉");
      setBuyingId(null);
    }
  }, [txHash, writing, confirmingTx]);

  if (!isConnected || totalOwned === 0) return null;

  return (
    <>
      {/* Main Perk Tray */}
      <div className="fixed bottom-6 right-6 z-50 pointer-events-auto">
        <div className="bg-black/90 backdrop-blur-xl rounded-2xl border border-cyan-500/40 p-5 shadow-2xl max-h-[70vh] overflow-y-auto w-64">
          <div className="flex items-center justify-between mb-4">
            <p className="text-cyan-300 text-sm font-bold uppercase tracking-wider">
              Perks ({totalOwned})
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
                onClick={() => onUseCollectible?.(item.tokenId, item.name)}
                disabled={!isMyTurn}
                className={`w-full relative rounded-xl overflow-hidden transition-all ${
                  isMyTurn ? "hover:scale-105 cursor-pointer" : "opacity-70 cursor-not-allowed"
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-90`} />
                <div className="relative p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-white">{item.icon}</div>
                    <p className="text-white text-sm font-bold">{item.name}</p>
                  </div>
                </div>
                {!isMyTurn && (
                  <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                    <p className="text-xs text-gray-300">Wait for turn</p>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MINI SHOP OVERLAY */}
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
                  Quick Shop
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

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 px-6 pb-6 overflow-y-auto max-h-full">
                {shopItems.length === 0 ? (
                  <p className="col-span-full text-center text-gray-400 py-10">No items in shop right now.</p>
                ) : (
                  shopItems.map((item) => (
                    <motion.div
                      key={item.tokenId.toString()}
                      whileHover={{ scale: 1.05 }}
                      className="bg-gradient-to-br from-[#0E1415] to-[#0A1C1E] rounded-2xl border border-cyan-900/50 overflow-hidden"
                    >
                      <div className="relative h-32">
                        <Image
                          src={item.image || "/game/shop/placeholder.jpg"}
                          alt={item.name}
                          fill
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <div className="absolute bottom-3 left-3 flex items-center gap-2">
                          <div className="text-white">{item.icon}</div>
                          <span className="text-white font-bold">{item.name}</span>
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-xs text-gray-400 mb-2">Stock: {item.stock}</p>
                        <button
                          onClick={() => handleBuy(item)}
                          disabled={buyingId === item.tokenId || writing || confirmingTx}
                          className="w-full py-3 rounded-lg bg-gradient-to-r from-[#00F0FF] to-cyan-400 text-black font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2 transition"
                        >
                          {buyingId === item.tokenId && (writing || confirmingTx) ? (
                            <> <Loader2 className="w-5 h-5 animate-spin" /> Buying... </>
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
    </>
  );
}