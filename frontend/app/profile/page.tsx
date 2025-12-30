'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { BarChart2, Crown, Coins, Users, Dice1, ShoppingBag, AlertTriangle, Wallet } from 'lucide-react';
import Link from 'next/link';
import avatar from '@/public/avatar.jpg';
import { useAccount, useBalance, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { REWARD_CONTRACT_ADDRESSES, TYC_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS } from '@/constants/contracts';
import RewardABI from '@/context/rewardabi.json';
import TycoonABI from '@/context/tycoonabi.json';
import { TYCOON_CONTRACT_ADDRESSES } from '@/constants/contracts';

// Fixed constants – only 10 perks
const COLLECTIBLE_START = 2000000000;
const PERK_COUNT = 10;

export default function ProfilePage() {
  const { address: walletAddress, isConnected } = useAccount();
  const chainId = useAccount().chainId;

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Base ETH balance
  const { data: ethBalance } = useBalance({ address: walletAddress });

  // TYC & USDC token balances
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

  // Tycoon contract - get username → player data
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

  // Reward contract - collectibles owned (FIXED)
  const rewardAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES];

  const tokenIds = Array.from({ length: PERK_COUNT }, (_, i) => BigInt(COLLECTIBLE_START) + BigInt(i + 1));
  // → 2000000001n … 2000000010n

  const balancesResult = useReadContract({
    address: rewardAddress,
    abi: RewardABI,
    functionName: 'balanceOfBatch',
    args: walletAddress && rewardAddress
      ? [Array(PERK_COUNT).fill(walletAddress), tokenIds]
      : undefined,
    query: { enabled: !!walletAddress && !!rewardAddress },
  });

  const ownedCollectibles = Array.isArray(balancesResult.data)
    ? (balancesResult.data as bigint[])
        .map((bal, i) => ({
          tokenId: tokenIds[i],
          balance: Number(bal),
          perkIndex: i + 1,
        }))
        .filter(item => item.balance > 0)
    : [];

  const perkNames = [
    "Extra Turn",
    "Get Out of Jail Free",
    "Double Rent",
    "Roll Boost",
    "Instant Cash (Tiered)",
    "Teleport",
    "Shield",
    "Property Discount",
    "Tax Refund (Tiered)",
    "Exact Roll"
  ];

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
        totalStaked: Number(data.totalStaked || 0),
      });
      setLoading(false);
    } else if (playerData.error) {
      setError('Failed to load player data');
      setLoading(false);
    }
  }, [playerData.data, playerData.isLoading, playerData.error, username, walletAddress]);

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
      {/* Header */}
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
        {/* Profile Header */}
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

        {/* Token Balances */}
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

        {/* Game Stats */}
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

        {/* Collectibles Owned */}
        <section className="mb-12">
          <h3 className="text-2xl font-bold text-[#00F0FF] mb-6 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6" />
            Collectibles Owned ({ownedCollectibles.length})
          </h3>
          {ownedCollectibles.length === 0 ? (
            <p className="text-center text-gray-400 py-10">No collectibles yet. Play games or visit the shop!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ownedCollectibles.map((item) => (
                <div
                  key={item.tokenId.toString()}
                  className="bg-[#0E1415]/80 border border-[#003B3E] rounded-xl p-4 hover:border-[#00F0FF] transition-colors"
                >
                  <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-lg p-4 mb-3 text-center">
                    <p className="font-bold text-lg">{perkNames[item.perkIndex - 1]}</p>
                    <p className="text-3xl font-bold text-[#00F0FF] mt-2">×{item.balance}</p>
                  </div>
                  <p className="text-xs text-gray-400 text-center">Token ID: {item.tokenId.toString()}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}