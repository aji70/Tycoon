'use client';

import React from 'react';
import Image from 'next/image';
import { BarChart2, Crown, Coins, Users, Dice1, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import avatar from '@/public/avatar.jpg';

// Dummy user data for Tycoon game
const dummyUserData = {
  username: 'BlockTycoon42',
  address: '0x1234...5678',
  gamesPlayed: 42,
  wins: 15,
  winRate: '35.7%',
  tokenBalance: 1250,
  nftsOwned: [
    {
      id: 1,
      name: "Lucky Roll",
      description: "Exclusive mystery NFT – discover its tycoon powers!",
      image: "/game/shop/a.jpeg",
      price: "0.06 ETH",
      type: "upgrade",
    },
    {
      id: 2,
      name: "Tax Refund",
      description: "Premium token for advanced players seeking edge.",
      image: "/game/shop/b.jpeg",
      price: "0.035 ETH",
      type: "token",
    },
    {
      id: 3,
      name: "Extra Roll",
      description: "Rare card pack for massive in-game fortune boosts.",
      image: "/game/shop/c.jpeg",
      price: "0.045 ETH",
      type: "card",
    },
  ],
  totalRentCollected: 8500,
  longestWinStreak: 5,
  rank: 247,
  friendsOnline: 3,
};

const ProfilePage: React.FC = () => {
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
        <div className="w-10" /> {/* Spacer */}
      </header>

      <main className="w-full max-w-6xl mx-auto p-4 md:p-8">
        {/* Profile Header */}
        <section className="text-center mb-12">
          <div className="relative mx-auto w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-[#00F0FF] mb-6">
            <Image
              src={avatar}
              alt="User Avatar"
              width={200}
              height={200}
              className="object-cover w-full h-full"
            />
            <div className="absolute bottom-2 right-2 bg-[#00F0FF] p-2 rounded-full">
              <Crown className="w-6 h-6 text-[#010F10]" />
            </div>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-[#00F0FF] mb-2">
            {dummyUserData.username}
          </h2>
          <p className="text-lg text-[#AFBAC0] mb-4">
            Wallet: <span className="text-[#00F0FF] font-mono">{dummyUserData.address}</span>
          </p>
          <p className="text-sm text-[#455A64]">Tycoon Rank #{dummyUserData.rank}</p>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-[#0E1415]/80 border border-[#003B3E] rounded-xl p-6 text-center hover:border-[#00F0FF] transition-colors">
            <BarChart2 className="w-8 h-8 text-[#00F0FF] mx-auto mb-2" />
            <h3 className="text-xl font-bold text-[#00F0FF]">Games Played</h3>
            <p className="text-2xl font-bold">{dummyUserData.gamesPlayed}</p>
          </div>
          <div className="bg-[#0E1415]/80 border border-[#003B3E] rounded-xl p-6 text-center hover:border-[#00F0FF] transition-colors">
            <Crown className="w-8 h-8 text-[#FFD700] mx-auto mb-2" />
            <h3 className="text-xl font-bold text-[#FFD700]">Wins</h3>
            <p className="text-2xl font-bold">{dummyUserData.wins}</p>
            <p className="text-sm text-[#AFBAC0]">{dummyUserData.winRate} Win Rate</p>
          </div>
          <div className="bg-[#0E1415]/80 border border-[#003B3E] rounded-xl p-6 text-center hover:border-[#00F0FF] transition-colors">
            <Coins className="w-8 h-8 text-[#00F0FF] mx-auto mb-2" />
            <h3 className="text-xl font-bold text-[#00F0FF]">Tycoon Tokens</h3>
            <p className="text-2xl font-bold">{dummyUserData.tokenBalance}</p>
          </div>
          <div className="bg-[#0E1415]/80 border border-[#003B3E] rounded-xl p-6 text-center hover:border-[#00F0FF] transition-colors">
            <Dice1 className="w-8 h-8 text-[#0FF0FC] mx-auto mb-2" />
            <h3 className="text-xl font-bold text-[#0FF0FC]">Win Streak</h3>
            <p className="text-2xl font-bold">{dummyUserData.longestWinStreak}</p>
          </div>
        </section>

        {/* NFTs Owned */}
        <section className="mb-12">
          <h3 className="text-2xl font-bold text-[#00F0FF] mb-6 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6" />
            NFTs Owned ({dummyUserData.nftsOwned.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dummyUserData.nftsOwned.map((nft) => (
              <div
                key={nft.id}
                className="bg-[#0E1415]/80 border border-[#003B3E] rounded-xl p-4 hover:border-[#00F0FF] transition-colors"
              >
                <div className="relative mb-3">
                  <Image
                    src={nft.image}
                    alt={nft.name}
                    width={150}
                    height={150}
                    className="w-full aspect-square object-cover rounded-lg"
                  />
                  <div className="absolute top-2 right-2 bg-[#00F0FF]/20 text-[#00F0FF] px-2 py-1 rounded text-xs font-medium">
                    {nft.type.toUpperCase()}
                  </div>
                </div>
                <h4 className="font-bold text-[#F0F7F7] mb-1">{nft.name}</h4>
                <p className="text-[#455A64] text-sm mb-2">{nft.description}</p>
                <p className="text-[#00F0FF] text-sm">Minted for: {nft.price}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Additional Stats */}
        <section className="bg-[#0E1415]/80 border border-[#003B3E] rounded-xl p-6">
          <h3 className="text-xl font-bold text-[#00F0FF] mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Social & More
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-[#AFBAC0]">Total Rent Collected</p>
              <p className="text-2xl font-bold text-[#00F0FF]">{dummyUserData.totalRentCollected} BLOCK</p>
            </div>
            <div>
              <p className="text-[#AFBAC0]">Friends Online</p>
              <p className="text-2xl font-bold text-[#0FF0FC]">{dummyUserData.friendsOnline}</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ProfilePage;