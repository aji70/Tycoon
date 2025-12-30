'use client';

import React, { useState } from 'react';
import { Zap, Crown, Coins, Sparkles, Gem, Shield } from 'lucide-react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits } from 'viem';
import { REWARD_CONTRACT_ADDRESSES } from '@/constants/contracts';
import RewardABI from '@/context/rewardabi.json';

const COLLECTIBLE_START = BigInt(2000000000);
const MAX_PERKS = 100;

const getPerkName = (perk: number): string => {
  const names: Record<number, string> = {
    1: 'Extra Turn',
    2: 'Get Out of Jail Free',
    3: 'Double Rent',
    4: 'Roll Boost',
    5: 'Instant Cash',
    6: 'Teleport',
    7: 'Shield',
    8: 'Property Discount',
    9: 'Tax Refund',
    10: 'Exact Roll',
  };
  return names[perk] || `Perk #${perk}`;
};

const getIcon = (perk: number) => {
  const icons = [
    null,
    <Zap className="w-12 h-12" />,
    <Crown className="w-12 h-12" />,
    <Coins className="w-12 h-12" />,
    <Sparkles className="w-12 h-12" />,
    <Gem className="w-12 h-12" />,
    <Zap className="w-12 h-12" />,
    <Shield className="w-12 h-12" />,
    <Coins className="w-12 h-12" />,
    <Gem className="w-12 h-12" />,
    <Sparkles className="w-12 h-12" />,
  ];
  return icons[perk] || <Gem className="w-12 h-12" />;
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

const rarityStyles = {
  1: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/40',
  2: 'from-purple-500/20 to-purple-600/10 border-purple-500/40',
  3: 'from-blue-500/20 to-blue-600/10 border-blue-500/40',
  4: 'from-yellow-500/20 to-amber-600/10 border-yellow-500/40',
  5: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/40',
  6: 'from-pink-500/20 to-pink-600/10 border-pink-500/40',
  7: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/40',
  8: 'from-orange-500/20 to-orange-600/10 border-orange-500/40',
  9: 'from-teal-500/20 to-teal-600/10 border-teal-500/40',
  10: 'from-amber-500/20 to-amber-600/10 border-amber-500/40',
} as const;

export default function ShopPage() {
  const { address: walletAddress, isConnected } = useAccount();
  const chainId = useAccount().chainId;
  const rewardAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES];

  const [buyingTokenId, setBuyingTokenId] = useState<bigint | null>(null);

  const { writeContract, data: txHash, isPending: isWriting } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  const tokenIds = Array.from({ length: MAX_PERKS }, (_, i) => COLLECTIBLE_START + BigInt(i + 1));

  const infoResults = tokenIds.map((tokenId) =>
    useReadContract({
      address: rewardAddress,
      abi: RewardABI,
      functionName: 'getCollectibleInfo',
      args: [tokenId],
      query: { enabled: !!rewardAddress },
    })
  );

  const availablePerks = tokenIds
    .map((tokenId, i) => {
      const info = infoResults[i].data as any;
      if (!info || info.perk === 0 || Number(info.shopStock || 0) === 0) return null;

      const perk = Number(info.perk);
      const strength = Number(info.strength || 0);
      const rarityKey = ((i % 10) + 1) as keyof typeof rarityStyles;

      return {
        tokenId,
        name: getPerkName(perk),
        icon: getIcon(perk),
        color: getColor(i),
        image: getImage(i),
        tycPrice: info.tycPrice > 0 ? Number(formatUnits(info.tycPrice, 18)).toFixed(2) : null,
        usdcPrice: info.usdcPrice > 0 ? Number(formatUnits(info.usdcPrice, 6)).toFixed(2) : null,
        shopStock: Number(info.shopStock),
        strength,
        isTiered: perk === 5 || perk === 9,
        rarityStyle: rarityStyles[rarityKey],
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const handleBuy = (tokenId: bigint) => {
    if (!isConnected || !walletAddress || !rewardAddress) {
      alert('Please connect your wallet and try again');
      return;
    }

    setBuyingTokenId(tokenId);

    writeContract({
      address: rewardAddress,
      abi: RewardABI,
      functionName: 'buyCollectible',
      args: [tokenId],
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] text-[#F0F7F7] py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-5xl md:text-6xl font-extrabold text-center mb-12 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
          Tycoon Shop
        </h1>

        {availablePerks.length === 0 ? (
          <p className="text-center text-gray-400 text-2xl py-20">
            Shop is currently empty or loading...
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {availablePerks.map((item) => (
              <div
                key={item.tokenId.toString()}
                className={`rounded-2xl p-8 border-2 bg-gradient-to-br ${item.rarityStyle} backdrop-blur-sm text-center transition-all hover:scale-105 hover:shadow-2xl`}
              >
                <div className="flex justify-center mb-6 text-white">
                  {item.icon}
                </div>

                <h3 className="text-2xl font-bold mb-3">{item.name}</h3>

                {item.isTiered && item.strength > 0 && (
                  <p className="text-lg text-cyan-300 mb-4">Tier {item.strength}</p>
                )}

                <p className="text-4xl font-bold text-[#00F0FF] mb-4">
                  Stock: {item.shopStock}
                </p>

                <div className="space-y-2 mb-6 text-sm">
                  {item.tycPrice !== null && <p>TYC: {item.tycPrice}</p>}
                  {item.usdcPrice !== null && <p>USDC: ${item.usdcPrice}</p>}
                  {item.tycPrice === null && item.usdcPrice === null && (
                    <p className="text-green-400 font-bold">FREE!</p>
                  )}
                </div>

                <button
                  onClick={() => handleBuy(item.tokenId)}
                  disabled={isWriting || isConfirming || buyingTokenId === item.tokenId}
                  className="w-full py-4 bg-gradient-to-r from-cyan-600 to-purple-600 rounded-xl font-bold text-lg disabled:opacity-50 transition"
                >
                  {buyingTokenId === item.tokenId && (isWriting || isConfirming)
                    ? 'Buying...'
                    : 'Buy Now'}
                </button>

                <p className="text-xs text-gray-500 mt-4">
                  ID: {item.tokenId.toString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}