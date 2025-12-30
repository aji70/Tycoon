// components/collectibles/CollectibleInventoryBar.tsx
"use client";

import React, { useState } from "react";
import { useAccount, useReadContract, useChainId } from "wagmi";
import Image from "next/image";
import { Zap, Crown, Coins, Sparkles, Gem, Shield, ShoppingBag, X } from "lucide-react";
import RewardABI from "@/context/rewardabi.json";
import { REWARD_CONTRACT_ADDRESSES } from "@/constants/contracts";

const FIXED_TOKEN_IDS = {
  EXTRA_TURN: BigInt(2000000001),
  JAIL_FREE: BigInt(2000000002),
  DOUBLE_RENT: BigInt(2000000003),
  ROLL_BOOST: BigInt(2000000004),
  CASH_TIERED: BigInt(2000000005),
  TELEPORT: BigInt(2000000006),
  SHIELD: BigInt(2000000007),
  PROPERTY_DISCOUNT: BigInt(2000000008),
  TAX_REFUND: BigInt(2000000009),
  ROLL_EXACT: BigInt(2000000010),
} as const;

const PERK_INFO = [
  { id: FIXED_TOKEN_IDS.EXTRA_TURN, name: "Extra Turn", icon: <Zap className="w-5 h-5" />, color: "text-yellow-400", image: "/game/shop/a.jpeg", priceTyc: "5 TYC", priceUsdc: "$0.10" },
  { id: FIXED_TOKEN_IDS.JAIL_FREE, name: "Get Out of Jail Free", icon: <Crown className="w-5 h-5" />, color: "text-purple-400", image: "/game/shop/b.jpeg", priceTyc: "10 TYC", priceUsdc: "$0.30" },
  { id: FIXED_TOKEN_IDS.DOUBLE_RENT, name: "Double Rent", icon: <Coins className="w-5 h-5" />, color: "text-green-400", image: "/game/shop/c.jpeg", priceTyc: "12 TYC", priceUsdc: "$0.40" },
  { id: FIXED_TOKEN_IDS.ROLL_BOOST, name: "Roll Boost", icon: <Sparkles className="w-5 h-5" />, color: "text-blue-400", image: "/game/shop/a.jpeg", priceTyc: "8 TYC", priceUsdc: "$0.25" },
  { id: FIXED_TOKEN_IDS.CASH_TIERED, name: "Instant Cash", icon: <Gem className="w-5 h-5" />, color: "text-cyan-400", image: "/game/shop/b.jpeg", priceTyc: "Varies", priceUsdc: "Varies" },
  { id: FIXED_TOKEN_IDS.TELEPORT, name: "Teleport", icon: <Zap className="w-5 h-5" />, color: "text-pink-400", image: "/game/shop/c.jpeg", priceTyc: "15 TYC", priceUsdc: "$0.60" },
  { id: FIXED_TOKEN_IDS.SHIELD, name: "Shield", icon: <Shield className="w-5 h-5" />, color: "text-indigo-400", image: "/game/shop/a.jpeg", priceTyc: "12 TYC", priceUsdc: "$0.50" },
  { id: FIXED_TOKEN_IDS.PROPERTY_DISCOUNT, name: "Property Discount", icon: <Coins className="w-5 h-5" />, color: "text-orange-400", image: "/game/shop/b.jpeg", priceTyc: "10 TYC", priceUsdc: "$0.40" },
  { id: FIXED_TOKEN_IDS.TAX_REFUND, name: "Tax Refund", icon: <Gem className="w-5 h-5" />, color: "text-teal-400", image: "/game/shop/c.jpeg", priceTyc: "Varies", priceUsdc: "Varies" },
  { id: FIXED_TOKEN_IDS.ROLL_EXACT, name: "Exact Roll", icon: <Sparkles className="w-5 h-5" />, color: "text-amber-400", image: "/game/shop/a.jpeg", priceTyc: "20 TYC", priceUsdc: "$1.00" },
];

interface CollectibleInventoryBarProps {
  onUseCollectible: (tokenId: bigint, name: string) => void;
  isMyTurn: boolean;
}

export default function CollectibleInventoryBar({ onUseCollectible, isMyTurn }: CollectibleInventoryBarProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES];

  const [showShopModal, setShowShopModal] = useState(false);

  const balances = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: "balanceOfBatch",
    args: isConnected && address && contractAddress
      ? [Array(PERK_INFO.length).fill(address), PERK_INFO.map(p => p.id)]
      : undefined,
    query: { enabled: !!address && !!contractAddress },
  });

  const owned = PERK_INFO.map((perk, i) => {
    const balance = balances.data && Array.isArray(balances.data)
      ? (balances.data[i] ?? 0)
      : 0;

    return {
      ...perk,
      count: Number(balance),
    };
  });

  const totalOwned = owned.reduce((sum, item) => sum + item.count, 0);

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
        <div className="bg-gradient-to-br from-black/95 via-gray-900/90 to-black/95 rounded-2xl border border-cyan-600/40 p-4 shadow-2xl backdrop-blur-md pointer-events-auto max-h-[80vh] overflow-y-auto">
          <p className="text-center text-cyan-300 text-sm mb-3 font-bold">
            Your Power-Ups ({totalOwned})
          </p>

          {totalOwned > 0 ? (
            <div className="flex flex-col gap-3">
              {owned
                .filter(item => item.count > 0)
                .map((item) => (
                  <button
                    key={item.id.toString()}
                    onClick={() => onUseCollectible(item.id, item.name)}
                    disabled={!isMyTurn}
                    className={`relative group rounded-xl overflow-hidden border-2 transition-all duration-300 w-32 ${
                      isMyTurn
                        ? "border-cyan-400 hover:border-cyan-200 hover:scale-105 shadow-xl shadow-cyan-500/50"
                        : "border-gray-700 opacity-60 cursor-not-allowed"
                    }`}
                  >
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={128}
                      height={170}
                      className="w-full h-40 object-cover brightness-75 group-hover:brightness-100 transition"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2">
                      <div className={`flex justify-center mb-1 ${item.color}`}>
                        {item.icon}
                      </div>
                      <p className="text-white text-xs font-bold text-center truncate">{item.name}</p>
                      <p className="text-cyan-300 text-lg font-bold text-center drop-shadow-md">×{item.count}</p>
                    </div>
                    {!isMyTurn && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-xl">
                        <p className="text-gray-400 text-xs text-center px-2">Wait for turn</p>
                      </div>
                    )}
                  </button>
                ))}
            </div>
          ) : (
            // Empty state — trigger modal
            <div className="text-center py-6">
              <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-cyan-400" />
              <p className="text-white text-base font-bold mb-2">No Power-Ups Yet!</p>
              <p className="text-gray-400 text-xs mb-4 max-w-xs mx-auto">
                Get powerful perks to dominate the game!
              </p>
              <button
                onClick={() => setShowShopModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-black font-bold text-sm rounded-lg hover:from-cyan-400 hover:to-purple-500 transition shadow-md"
              >
                <ShoppingBag className="w-4 h-4" />
                Buy Perks
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Small Shop Modal on the Right */}
      {showShopModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex justify-end items-start pt-24 pr-4" onClick={() => setShowShopModal(false)}>
          <div 
            className="bg-gradient-to-br from-gray-900/95 to-black/95 rounded-2xl border border-cyan-600/50 p-6 shadow-2xl backdrop-blur-md w-96 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold text-cyan-300">Perk Shop</h3>
              <button
                onClick={() => setShowShopModal(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {PERK_INFO.map((perk) => (
                <div
                  key={perk.id.toString()}
                  className="relative group rounded-xl overflow-hidden border border-gray-700 hover:border-cyan-400 transition"
                >
                  <Image
                    src={perk.image}
                    alt={perk.name}
                    width={200}
                    height={250}
                    className="w-full object-cover brightness-75 group-hover:brightness-100 transition"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent p-3 flex flex-col justify-end">
                    <div className={`flex justify-center mb-1 ${perk.color}`}>
                      {perk.icon}
                    </div>
                    <p className="text-white text-xs font-bold text-center">{perk.name}</p>
                    <div className="text-center text-xs mt-1">
                      <p className="text-cyan-300">{perk.priceTyc}</p>
                      <p className="text-gray-400">{perk.priceUsdc}</p>
                    </div>
                    <button className="mt-2 bg-cyan-600 hover:bg-cyan-500 text-black font-bold py-1 rounded text-xs">
                      Buy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}