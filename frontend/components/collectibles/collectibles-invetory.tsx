// components/collectibles/CollectibleInventoryBar.tsx
"use client";

import React from "react";
import { useAccount, useReadContract, useChainId } from "wagmi";
import Image from "next/image";
import { Zap, Crown, Coins, Sparkles, Gem, Shield } from "lucide-react";
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
  { id: FIXED_TOKEN_IDS.EXTRA_TURN, name: "Extra Turn", icon: <Zap className="w-5 h-5" />, color: "text-yellow-400", image: "/game/shop/a.jpeg" },
  { id: FIXED_TOKEN_IDS.JAIL_FREE, name: "Get Out of Jail Free", icon: <Crown className="w-5 h-5" />, color: "text-purple-400", image: "/game/shop/b.jpeg" },
  { id: FIXED_TOKEN_IDS.DOUBLE_RENT, name: "Double Rent", icon: <Coins className="w-5 h-5" />, color: "text-green-400", image: "/game/shop/c.jpeg" },
  { id: FIXED_TOKEN_IDS.ROLL_BOOST, name: "Roll Boost", icon: <Sparkles className="w-5 h-5" />, color: "text-blue-400", image: "/game/shop/a.jpeg" },
  { id: FIXED_TOKEN_IDS.CASH_TIERED, name: "Instant Cash", icon: <Gem className="w-5 h-5" />, color: "text-cyan-400", image: "/game/shop/b.jpeg" },
  { id: FIXED_TOKEN_IDS.TELEPORT, name: "Teleport", icon: <Zap className="w-5 h-5" />, color: "text-pink-400", image: "/game/shop/c.jpeg" },
  { id: FIXED_TOKEN_IDS.SHIELD, name: "Shield", icon: <Shield className="w-5 h-5" />, color: "text-indigo-400", image: "/game/shop/a.jpeg" },
  { id: FIXED_TOKEN_IDS.PROPERTY_DISCOUNT, name: "Property Discount", icon: <Coins className="w-5 h-5" />, color: "text-orange-400", image: "/game/shop/b.jpeg" },
  { id: FIXED_TOKEN_IDS.TAX_REFUND, name: "Tax Refund", icon: <Gem className="w-5 h-5" />, color: "text-teal-400", image: "/game/shop/c.jpeg" },
  { id: FIXED_TOKEN_IDS.ROLL_EXACT, name: "Exact Roll", icon: <Sparkles className="w-5 h-5" />, color: "text-amber-400", image: "/game/shop/a.jpeg" },
];

interface CollectibleInventoryBarProps {
  onUseCollectible: (tokenId: bigint, name: string) => void;
  isMyTurn: boolean;
}

export default function CollectibleInventoryBar({ onUseCollectible, isMyTurn }: CollectibleInventoryBarProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES];

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
}).filter(item => item.count > 0);

  if (!isConnected ) {
    return null; // Hide bar if no collectibles
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-4 z-40 pointer-events-none">
      <div className="max-w-5xl mx-auto">
        <p className="text-center text-cyan-300 text-sm mb-2 font-semibold">
          Your Collectibles ({owned.reduce((sum, i) => sum + i.count, 0)})
        </p>
        <div className="flex justify-center gap-3 flex-wrap pointer-events-auto">
          {owned.map((item) => (
            <button
              key={item.id.toString()}
              onClick={() => onUseCollectible(item.id, item.name)}
              disabled={!isMyTurn}
              className={`relative group rounded-xl overflow-hidden border-2 transition-all ${
                isMyTurn
                  ? "border-cyan-400 hover:border-cyan-300 hover:scale-105 shadow-lg shadow-cyan-500/30"
                  : "border-gray-600 opacity-70 cursor-not-allowed"
              }`}
            >
              <Image
                src={item.image}
                alt={item.name}
                width={120}
                height={160}
                className="w-28 h-40 object-cover brightness-90 group-hover:brightness-110 transition"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-2 text-center">
                <div className={`flex justify-center mb-1 ${item.color}`}>
                  {item.icon}
                </div>
                <p className="text-white text-xs font-bold truncate px-1">{item.name}</p>
                <p className="text-cyan-300 text-lg font-bold">×{item.count}</p>
              </div>
              {!isMyTurn && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <p className="text-gray-400 text-sm">Wait for turn</p>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}