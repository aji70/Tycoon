'use client';

import React, { useState } from "react";
import { useAccount, useReadContract, useChainId } from "wagmi";
import Image from "next/image";
import { Zap, Crown, Coins, Sparkles, Gem, Shield, ShoppingBag, X } from "lucide-react";
import RewardABI from "@/context/abi/rewardabi.json";
import { REWARD_CONTRACT_ADDRESSES } from "@/constants/contracts";
import { formatUnits } from "viem";

const COLLECTIBLE_START = BigInt(2000000000);
const MAX_PERKS_TO_CHECK = 100;

const getPerkName = (perk: number): string => {
  const names: Record<number, string> = {
    1: "Extra Turn",
    2: "Get Out of Jail Free",
    3: "Double Rent",
    4: "Roll Boost",
    5: "Instant Cash",
    6: "Teleport",
    7: "Shield",
    8: "Property Discount",
    9: "Tax Refund",
    10: "Exact Roll",
  };
  return names[perk] || `Perk #${perk}`;
};

const getIcon = (perk: number) => {
  const icons = [
    null,
    <Zap className="w-5 h-5" />,
    <Crown className="w-5 h-5" />,
    <Coins className="w-5 h-5" />,
    <Sparkles className="w-5 h-5" />,
    <Gem className="w-5 h-5" />,
    <Zap className="w-5 h-5" />,
    <Shield className="w-5 h-5" />,
    <Coins className="w-5 h-5" />,
    <Gem className="w-5 h-5" />,
    <Sparkles className="w-5 h-5" />,
  ];
  return icons[perk] || <Gem className="w-5 h-5" />;
};

const getColor = (index: number): string => {
  const colors = [
    "text-yellow-400",
    "text-purple-400",
    "text-green-400",
    "text-blue-400",
    "text-cyan-400",
    "text-pink-400",
    "text-indigo-400",
    "text-orange-400",
    "text-teal-400",
    "text-amber-400"
  ];
  return colors[index % 10];
};

const getImage = (index: number): string => {
  const images = ["/game/shop/a.jpeg", "/game/shop/b.jpeg", "/game/shop/c.jpeg"];
  return images[index % 3];
};

interface CollectibleInventoryBarProps {
  onUseCollectible: (tokenId: bigint, name: string) => void;
  isMyTurn: boolean;
}

export default function CollectibleInventoryBar({ onUseCollectible, isMyTurn }: CollectibleInventoryBarProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES];

  const [showShopModal, setShowShopModal] = useState(false);

  const tokenIds = Array.from({ length: MAX_PERKS_TO_CHECK }, (_, i) => COLLECTIBLE_START + BigInt(i + 1));

  const balancesResult = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: "balanceOfBatch",
    args: isConnected && address && contractAddress
      ? [Array(MAX_PERKS_TO_CHECK).fill(address), tokenIds]
      : undefined,
    query: { enabled: !!address && !!contractAddress },
  });

  const infoResults = tokenIds.map((tokenId) =>
    useReadContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: "getCollectibleInfo",
      args: [tokenId],
      query: { enabled: !!contractAddress },
    })
  );

  const ownedCollectibles = tokenIds
    .map((tokenId, i) => {
      const balance = (balancesResult.data as bigint[] | undefined)?.[i] ?? 0;
      if (balance === 0) return null;

      const info = infoResults[i].data as any;
      if (!info || info.perk === 0) return null;

      const perk = Number(info.perk);
      const strength = Number(info.strength || 0);

      return {
        tokenId,
        name: getPerkName(perk),
        icon: getIcon(perk),
        color: getColor(i),
        image: getImage(i),
        count: Number(balance),
        strength,
        isTiered: perk === 5 || perk === 9,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const totalOwned = ownedCollectibles.reduce((sum, item) => sum + item.count, 0);

  const shopPerks = tokenIds
    .map((tokenId, i) => {
      const info = infoResults[i].data as any;
      if (!info || info.perk === 0 || Number(info.shopStock || 0) === 0) return null;

      const perk = Number(info.perk);
      const strength = Number(info.strength || 0);

      return {
        tokenId,
        name: getPerkName(perk),
        icon: getIcon(perk),
        color: getColor(i),
        image: getImage(i),
        tycPrice: info.tycPrice > 0 ? `${Number(formatUnits(info.tycPrice, 18)).toFixed(2)} TYC` : "",
        usdcPrice: info.usdcPrice > 0 ? `$${Number(formatUnits(info.usdcPrice, 6)).toFixed(2)}` : "",
        shopStock: Number(info.shopStock),
        strength,
        isTiered: perk === 5 || perk === 9,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
        <div className="bg-gradient-to-br from-black/95 via-gray-900/90 to-black/95 rounded-2xl border border-cyan-600/40 p-4 shadow-2xl backdrop-blur-md pointer-events-auto max-h-[80vh] overflow-y-auto w-40">
          <p className="text-center text-cyan-300 text-sm mb-3 font-bold">
            Power-Ups ({totalOwned})
          </p>

          {totalOwned > 0 ? (
            <div className="flex flex-col gap-3">
              {ownedCollectibles.map((item) => (
                <button
                  key={item.tokenId.toString()}
                  onClick={() => onUseCollectible(item.tokenId, item.name)}
                  disabled={!isMyTurn}
                  className={`relative group rounded-xl overflow-hidden border-2 transition-all duration-300 ${
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
                    <p className="text-white text-xs font-bold text-center truncate px-1">{item.name}</p>
                    {item.isTiered && item.strength > 0 && (
                      <p className="text-cyan-300 text-xs text-center">Tier {item.strength}</p>
                    )}
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
            <div className="text-center py-6">
              <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-cyan-400" />
              <p className="text-white text-base font-bold mb-2">No Power-Ups!</p>
              <p className="text-gray-400 text-xs mb-4">Get perks to dominate!</p>
              <button
                onClick={() => setShowShopModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-black font-bold text-sm rounded-lg hover:from-cyan-400 hover:to-purple-500 transition shadow-md"
              >
                <ShoppingBag className="w-4 h-4" />
                Shop
              </button>
            </div>
          )}
        </div>
      </div>

      {showShopModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex justify-end items-start pt-24 pr-4" onClick={() => setShowShopModal(false)}>
          <div
            className="bg-gradient-to-br from-gray-900/95 to-black/95 rounded-2xl border border-cyan-600/50 p-6 shadow-2xl backdrop-blur-md w-96 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-cyan-300">Perk Shop</h3>
              <button onClick={() => setShowShopModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {shopPerks.length === 0 ? (
                <p className="col-span-2 text-center text-gray-400 py-8">Shop is empty</p>
              ) : (
                shopPerks.map((perk) => (
                  <div
                    key={perk.tokenId.toString()}
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
                      {perk.isTiered && perk.strength > 0 && (
                        <p className="text-cyan-300 text-xs text-center">Tier {perk.strength}</p>
                      )}
                      <div className="text-center text-xs mt-1 space-y-1">
                        {perk.tycPrice && <p className="text-cyan-300 font-medium">{perk.tycPrice}</p>}
                        {perk.usdcPrice && <p className="text-gray-300">{perk.usdcPrice}</p>}
                        {!perk.tycPrice && !perk.usdcPrice && <p className="text-green-400 font-bold">FREE</p>}
                        <p className="text-gray-400 text-xs">Stock: {perk.shopStock}</p>
                      </div>
                      <button
                        disabled={perk.shopStock === 0}
                        className="mt-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold py-1.5 rounded text-xs transition"
                      >
                        {perk.shopStock === 0 ? "Sold Out" : "Buy"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}