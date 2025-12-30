'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { BarChart2, Crown, Coins, Dice1, ShoppingBag, AlertTriangle, Wallet, Send, Zap, Sparkles, Gem, Shield } from 'lucide-react';
import Link from 'next/link';
import avatar from '@/public/avatar.jpg';
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits } from 'viem';
import { REWARD_CONTRACT_ADDRESSES, TYC_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS } from '@/constants/contracts';
import RewardABI from '@/context/abi/rewardabi.json';
import TycoonABI from '@/context/abi/tycoonabi.json';
import { TYCOON_CONTRACT_ADDRESSES } from '@/constants/contracts';

const COLLECTIBLE_START = 2000000000;
const MAX_PERKS_TO_CHECK = 100;

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
    <Zap className="w-8 h-8" />,
    <Crown className="w-8 h-8" />,
    <Coins className="w-8 h-8" />,
    <Sparkles className="w-8 h-8" />,
    <Gem className="w-8 h-8" />,
    <Zap className="w-8 h-8" />,
    <Shield className="w-8 h-8" />,
    <Coins className="w-8 h-8" />,
    <Gem className="w-8 h-8" />,
    <Sparkles className="w-8 h-8" />,
  ];
  return icons[perk] || <Gem className="w-8 h-8" />;
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

export default function ProfilePage() {
  const { address: walletAddress, isConnected } = useAccount();
  const chainId = useAccount().chainId;

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendAddress, setSendAddress] = useState<string>('');
  const [sendingTokenId, setSendingTokenId] = useState<bigint | null>(null);

  const { writeContract, data: txHash, isPending: isWriting, reset } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  const { data: ethBalance } = useBalance({ address: walletAddress });

  const tycTokenAddress = TYC_TOKEN_ADDRESS[chainId as keyof typeof TYC_TOKEN_ADDRESS];
  const usdcTokenAddress = USDC_TOKEN_ADDRESS[chainId as keyof typeof USDC_TOKEN_ADDRESS];

  const tycBalance = useReadContract({
    address: tycTokenAddress,
    abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }],
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress && !!tycTokenAddress },
  });

  const usdcBalance = useReadContract({
    address: usdcTokenAddress,
    abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] }],
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress && !!usdcTokenAddress },
  });

  const tycoonAddress = TYCOON_CONTRACT_ADDRESSES[chainId as keyof typeof TYCOON_CONTRACT_ADDRESSES];

  const usernameResult = useReadContract({
    address: tycoonAddress,
    abi: TycoonABI,
    functionName: 'addressToUsername',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress && !!tycoonAddress },
  });

  const username = usernameResult.data as string | undefined;

  const playerData = useReadContract({
    address: tycoonAddress,
    abi: TycoonABI,
    functionName: 'getUser',
    args: username ? [username] : undefined,
    query: { enabled: !!username && !!tycoonAddress },
  });

  const rewardAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES];

  const tokenIds = Array.from({ length: MAX_PERKS_TO_CHECK }, (_, i) => BigInt(COLLECTIBLE_START) + BigInt(i + 1));

  const balancesResult = useReadContract({
    address: rewardAddress,
    abi: RewardABI,
    functionName: 'balanceOfBatch',
    args: walletAddress && rewardAddress ? [Array(MAX_PERKS_TO_CHECK).fill(walletAddress), tokenIds] : undefined,
    query: { enabled: !!walletAddress && !!rewardAddress },
  });

  const infoResults = tokenIds.map((tokenId) =>
    useReadContract({
      address: rewardAddress,
      abi: RewardABI,
      functionName: 'getCollectibleInfo',
      args: [tokenId],
      query: { enabled: !!rewardAddress },
    })
  );

  const ownedCollectibles = tokenIds
    .map((tokenId, i) => {
      const balance = (balancesResult.data as bigint[] | undefined)?.[i] ?? 0;
      if (balance === 0) return null;

      const info = infoResults[i].data as any;
      if (!info || info.perk === 0) return null;

      const perk = Number(info.perk);
      const strength = Number(info.strength);
      const shopStock = Number(info.shopStock || 0);

      const rarityKey = ((i % 10) + 1) as keyof typeof rarityStyles;

      return {
        tokenId,
        name: getPerkName(perk),
        icon: getIcon(perk),
        color: getColor(i),
        image: getImage(i),
        count: Number(balance),
        strength,
        shopStock,
        isTiered: perk === 5 || perk === 9,
        rarityStyle: rarityStyles[rarityKey],
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  useEffect(() => {
    if (playerData.data && !playerData.isLoading) {
      const data = playerData.data as any;
      setUserData({
        username: username || 'Unknown',
        address: walletAddress?.slice(0, 6) + '...' + walletAddress?.slice(-4),
        gamesPlayed: Number(data.gamesPlayed || 0),
        wins: Number(data.gamesWon || 0),
        losses: Number(data.gamesLost || 0),
        winRate: data.gamesPlayed > 0 ? ((Number(data.gamesWon) / Number(data.gamesPlayed)) * 100).toFixed(1) + '%' : '0%',
        totalEarned: Number(data.totalEarned || 0),
      });
      setLoading(false);
    } else if (playerData.error) {
      setError('Failed to load player data');
      setLoading(false);
    }
  }, [playerData.data, playerData.isLoading, playerData.error, username, walletAddress]);

  const handleSend = (tokenId: bigint) => {
    if (!sendAddress || !/^0x[a-fA-F0-9]{40}$/i.test(sendAddress)) {
      alert('Please enter a valid wallet address');
      return;
    }
    if (!walletAddress || !rewardAddress) return;

    setSendingTokenId(tokenId);

    writeContract({
      address: rewardAddress,
      abi: RewardABI,
      functionName: 'safeTransferFrom',
      args: [walletAddress as `0x${string}`, sendAddress as `0x${string}`, tokenId, BigInt(1), '0x'],
    });
  };

  useEffect(() => {
    if (txHash && !isConfirming && !isWriting) {
      alert('Perk sent successfully!');
      reset();
      setSendAddress('');
      setSendingTokenId(null);
    }
  }, [txHash, isConfirming, isWriting, reset]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] flex items-center justify-center">
        <div className="text-center p-10 bg-red-950/60 rounded-3xl border border-red-700/50">
          <AlertTriangle className="w-16 h-16 mx-auto mb-6 text-red-400" />
          <h2 className="text-3xl font-bold">Wallet Not Connected</h2>
          <p className="mt-4 text-lg">Connect your wallet to view your profile</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#00F0FF] border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-xl">Loading your Tycoon profile...</p>
        </div>
      </div>
    );
  }

  if (error || !userData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] flex items-center justify-center text-red-400 text-2xl">
        Error loading profile: {error || 'No data found'}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] text-[#F0F7F7] font-orbitron">
      <header className="w-full h-[87px] flex items-center justify-between px-4 md:px-8 bg-[linear-gradient(180deg,rgba(1,15,16,0.12)_0%,rgba(8,50,52,0.12)_100%)] backdrop-blur-sm relative z-[50] border-b border-[#003B3E]">
        <Link href="/" className="text-[#00F0FF] text-xl font-bold">
          ← Back to Tycoon
        </Link>
        <h1 className="text-2xl uppercase font-kronaOne text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-[#0FF0FC]">
          Profile
        </h1>
        <div className="w-10" />
      </header>

      <main className="w-full max-w-6xl mx-auto p-4 md:p-8">
        <section className="text-center mb-12">
          <div className="relative mx-auto w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-[#00F0FF] mb-6 shadow-2xl">
            <Image
              src={avatar}
              alt="Player Avatar"
              width={200}
              height={200}
              className="object-cover w-full h-full"
            />
            <div className="absolute bottom-2 right-2 bg-[#00F0FF] p-2 rounded-full shadow-lg">
              <Crown className="w-6 h-6 text-[#010F10]" />
            </div>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-[#00F0FF] mb-2">
            {userData.username}
          </h2>
          <p className="text-lg text-[#AFBAC0] mb-4">
            Wallet: <span className="text-[#00F0FF] font-mono">{userData.address}</span>
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-[#0E1415]/80 border border-[#003B3E] rounded-xl p-6 text-center hover:border-[#00F0FF] transition">
            <Coins className="w-10 h-10 text-[#FFD700] mx-auto mb-3" />
            <h3 className="text-xl font-bold text-[#FFD700]">TYC Balance</h3>
            <p className="text-3xl font-bold mt-2">
              {tycBalance.data ? Number(formatUnits(tycBalance.data as bigint, 18)).toFixed(2) : '0.00'}
            </p>
          </div>
          <div className="bg-[#0E1415]/80 border border-[#003B3E] rounded-xl p-6 text-center hover:border-[#00F0FF] transition">
            <Wallet className="w-10 h-10 text-[#00F0FF] mx-auto mb-3" />
            <h3 className="text-xl font-bold text-[#00F0FF]">USDC Balance</h3>
            <p className="text-3xl font-bold mt-2">
              {usdcBalance.data ? Number(formatUnits(usdcBalance.data as bigint, 6)).toFixed(2) : '0.00'}
            </p>
          </div>
          <div className="bg-[#0E1415]/80 border border-[#003B3E] rounded-xl p-6 text-center hover:border-[#00F0FF] transition">
            <div className="w-10 h-10 bg-gradient-to-r from-[#00F0FF] to-[#0FF0FC] rounded-full mx-auto mb-3 flex items-center justify-center text-black font-bold">ETH</div>
            <h3 className="text-xl font-bold text-[#0FF0FC]">Base ETH</h3>
            <p className="text-3xl font-bold mt-2">
              {ethBalance ? Number(ethBalance.formatted).toFixed(4) : '0.0000'}
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-[#0E1415]/80 border border-[#003B3E] rounded-xl p-6 text-center hover:border-[#00F0FF] transition">
            <BarChart2 className="w-8 h-8 text-[#00F0FF] mx-auto mb-2" />
            <h3 className="text-xl font-bold text-[#00F0FF]">Games Played</h3>
            <p className="text-2xl font-bold">{userData.gamesPlayed}</p>
          </div>
          <div className="bg-[#0E1415]/80 border border-[#003B3E] rounded-xl p-6 text-center hover:border-[#00F0FF] transition">
            <Crown className="w-8 h-8 text-[#FFD700] mx-auto mb-2" />
            <h3 className="text-xl font-bold text-[#FFD700]">Wins</h3>
            <p className="text-2xl font-bold">{userData.wins}</p>
            <p className="text-sm text-[#AFBAC0]">{userData.winRate} Win Rate</p>
          </div>
          <div className="bg-[#0E1415]/80 border border-[#003B3E] rounded-xl p-6 text-center hover:border-[#00F0FF] transition">
            <Dice1 className="w-8 h-8 text-[#0FF0FC] mx-auto mb-2" />
            <h3 className="text-xl font-bold text-[#0FF0FC]">Losses</h3>
            <p className="text-2xl font-bold">{userData.losses}</p>
          </div>
          <div className="bg-[#0E1415]/80 border border-[#003B3E] rounded-xl p-6 text-center hover:border-[#00F0FF] transition">
            <Coins className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <h3 className="text-xl font-bold text-emerald-400">Total Earned</h3>
            <p className="text-2xl font-bold">{userData.totalEarned} BLOCK</p>
          </div>
        </section>

        <section className="mb-12">
          <h3 className="text-3xl font-bold text-[#00F0FF] mb-8 flex items-center gap-3">
            <ShoppingBag className="w-8 h-8" />
            Collectibles Owned ({ownedCollectibles.length})
          </h3>

          {ownedCollectibles.length === 0 ? (
            <p className="text-center text-gray-400 py-16 text-xl">
              No collectibles yet. Play games or visit the shop!
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {ownedCollectibles.map((item) => (
                <div
                  key={item.tokenId.toString()}
                  className={`rounded-2xl p-6 border-2 bg-gradient-to-br ${item.rarityStyle} backdrop-blur-sm text-center relative overflow-hidden transition-all hover:scale-105 hover:shadow-2xl`}
                >
                  <div className="flex justify-center mb-4 text-white">
                    {item.icon}
                  </div>

                  <h4 className="font-bold text-xl mb-2">{item.name}</h4>

                  {item.isTiered && item.strength > 0 && (
                    <p className="text-sm text-cyan-300 mb-2">Tier {item.strength}</p>
                  )}

                  <p className="text-3xl font-bold text-[#00F0FF] my-3">×{item.count}</p>

                  <p className="text-xs text-gray-300 mb-3">
                    Shop Stock:{' '}
                    <span className={item.shopStock < 50 && item.shopStock > 0 ? 'text-orange-400' : item.shopStock > 0 ? 'text-emerald-300' : 'text-gray-500'}>
                      {item.shopStock > 0 ? item.shopStock : 'N/A'}
                    </span>
                  </p>

                  <div className="mt-4 space-y-2">
                    <input
                      type="text"
                      placeholder="0x... friend address"
                      value={sendAddress}
                      onChange={(e) => setSendAddress(e.target.value.trim())}
                      className="w-full px-3 py-2 bg-gray-800/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                    <button
                      onClick={() => handleSend(item.tokenId)}
                      disabled={isWriting || isConfirming || sendingTokenId === item.tokenId || item.count === 0}
                      className="w-full py-2 bg-gradient-to-r from-pink-600 to-purple-600 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition"
                    >
                      <Send className="w-4 h-4" />
                      {sendingTokenId === item.tokenId && (isWriting || isConfirming) ? 'Sending...' : 'Send 1 to Friend'}
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 mt-4">ID: {item.tokenId.toString()}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}