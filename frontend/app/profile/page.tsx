'use client';

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { BarChart2, Crown, Coins, Dice1, ShoppingBag, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useAccount } from '@starknet-react/core';
import { usePlayerActions } from '@/hooks/usePlayerActions';
import { shortString } from 'starknet';
import avatar from '@/public/avatar.jpg';

// Dummy NFTs (always displayed)
const dummyNfts = [
  {
    id: 1,
    name: "Lucky Roll",
    description: "Exclusive mystery NFT – discover its tycoon powers!",
    image: "/game/shop/a.jpeg",
    price: "6 STRK",
    type: "upgrade",
  },
  {
    id: 2,
    name: "Tax Refund",
    description: "Premium token for advanced players seeking edge.",
    image: "/game/shop/b.jpeg",
    price: "3.5 STRK",
    type: "token",
  },
  {
    id: 3,
    name: "Extra Roll",
    description: "Rare card pack for massive in-game fortune boosts.",
    image: "/game/shop/c.jpeg",
    price: "4.5 STRK",
    type: "card",
  },
];

// Initial empty user data (will be populated from retrievePlayer)
const initialUserData = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0, // New: games lost
  winRate: '0%',
  tokenBalance: 0,
  nftsOwned: dummyNfts, // Always use dummies
  totalRentCollected: 0,
  longestWinStreak: 0,
  rank: 0,
  friendsOnline: 0,
  username: '',
  address: '',
};

const ProfilePage: React.FC = () => {
  const { address } = useAccount();
  const player = usePlayerActions();
  const [userData, setUserData] = useState(initialUserData);
  const [loading, setLoading] = useState(true);
  const hasFetchedRef = useRef(false); // Track if we've fetched for the current address

  useEffect(() => {
    // Reset fetch flag if address changes (e.g., wallet reconnect)
    if (address && address !== userData.address) {
      hasFetchedRef.current = false;
    }

    const checkRegistration = async () => {
      if (!address) {
        setLoading(false);
        return;
      }

      // Skip if already fetched for this address
      if (hasFetchedRef.current) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        hasFetchedRef.current = true; // Mark as fetching now

        const registered = await player.isRegistered(address);
        let decodedUsername = '';
        let shortAddress = '';

        if (registered) {
          // Fetch full player data
          const playerData = await player.retrievePlayer(address);
          
          // Decode username from raw shortString (maintain existing logic)
          decodedUsername = shortString.decodeShortString(playerData.username) || 'Unknown';
          
          // Parse stats
          const gamesPlayed = parseInt(playerData.total_games_played || '0', 10);
          const wins = parseInt(playerData.total_games_won || '0', 10);
          const completed = parseInt(playerData.total_games_completed || '0', 10);
          const losses = gamesPlayed - wins; // Infer losses as played minus wins
          
          // Calculate win rate
          const winRate = gamesPlayed > 0 ? ((wins / gamesPlayed) * 100).toFixed(1) + '%' : '0%';
          
          // Token balance
          const tokenBalance = parseInt(playerData.balance || '0', 10);
          
          setUserData({
            gamesPlayed,
            wins,
            losses, // New stat
            winRate,
            tokenBalance,
            nftsOwned: dummyNfts, // Always use dummies
            totalRentCollected: 0, // No data; placeholder
            longestWinStreak: 0, // No data; placeholder
            rank: 0, // No data; placeholder (could query leaderboard)
            friendsOnline: 0, // No data; placeholder
            username: decodedUsername,
            address: `${address.slice(0, 6)}...${address.slice(-4)}`,
          });
        } else {
          // Fallback to placeholder if not registered (maintain existing logic)
          shortAddress = `${address.slice(2, 8)}...${address.slice(-4)}`;
          decodedUsername = `Tycoon${shortAddress.toUpperCase()}`;
          setUserData({
            ...initialUserData,
            username: decodedUsername,
            address: `${address.slice(0, 6)}...${address.slice(-4)}`,
          });
        }
      } catch (err: any) {
        console.error('Failed to fetch user data:', err);
        // Fallback to placeholder on error (maintain existing logic)
        const shortAddress = `${address.slice(2, 8)}...${address.slice(-4)}`;
        const placeholderUsername = `Tycoon${shortAddress.toUpperCase()}`;
        setUserData({
          ...initialUserData,
          username: placeholderUsername,
          address: `${address.slice(0, 6)}...${address.slice(-4)}`,
        });
      } finally {
        setLoading(false);
      }
    };

    checkRegistration();
  }, [address]); // Depend only on address (stable). Ignore player instability.

  // If no wallet connected, show connect message
  if (!address) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] flex items-center justify-center text-[#F0F7F7] font-orbitron">
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-[#00F0FF] mb-4">
            Connect Your Wallet
          </h1>
          <p className="text-lg text-[#AFBAC0] mb-6">
            Please connect your Starknet wallet to view your profile.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#00F0FF] text-[#010F10] rounded-lg font-bold hover:bg-[#0FF0FC] transition-colors"
          >
            ← Back to Tycoon
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00F0FF]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#010F10] via-[#0E1415]/50 to-[#1A1F2E] text-[#F0F7F7] font-orbitron overflow-hidden">
      {/* Header */}
      <header className="w-full h-[70px] flex items-center justify-between px-4 md:px-6 bg-[linear-gradient(180deg,rgba(1,15,16,0.12)_0%,rgba(8,50,52,0.12)_100%)] backdrop-blur-sm relative z-[50] border-b border-[#003B3E]/50 shadow-lg">
        <Link href="/" className="text-[#00F0FF] text-lg font-bold hover:text-[#0FF0FC] transition-colors">
          ← Back to Tycoon
        </Link>
        <h1 className="text-xl uppercase font-kronaOne text-transparent bg-clip-text bg-gradient-to-r from-[#00F0FF] to-[#0FF0FC] drop-shadow-md">
          Profile
        </h1>
        <div className="w-8" /> {/* Spacer */}
      </header>

      <main className="w-full max-w-6xl mx-auto p-4 md:p-6 pb-4">
        {/* Profile Header */}
        <section className="text-center mb-6 md:mb-8 animate-fade-in">
          <div className="relative mx-auto w-28 h-28 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-[#00F0FF] mb-4 shadow-2xl shadow-[#00F0FF]/20 hover:scale-105 transition-transform duration-300 inline-block">
            <Image
              src={avatar}
              alt="User Avatar"
              fill
              className="object-cover"
            />
            <div className="absolute bottom-1 right-1 bg-[#00F0FF] p-1.5 rounded-full shadow-md">
              <Crown className="w-5 h-5 text-[#010F10]" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#00F0FF]/20 to-transparent rounded-full" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-[#00F0FF] mb-2 bg-gradient-to-r from-[#00F0FF] to-[#0FF0FC] bg-clip-text">
            {userData.username}
          </h2>
          <p className="text-base md:text-lg text-[#AFBAC0] mb-3">
            Wallet: <span className="text-[#00F0FF] font-mono">{userData.address}</span>
          </p>
          <p className="text-sm text-[#455A64] font-medium">Tycoon Rank #{userData.rank || 'N/A'}</p>
        </section>

        {/* Stats Grid - Added Losses */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-6 md:mb-8">
          <div className="bg-[#0E1415]/80 border border-[#003B3E]/50 rounded-xl p-4 md:p-5 text-center hover:border-[#00F0FF] hover:shadow-lg hover:shadow-[#00F0FF]/10 transition-all duration-300 group">
            <BarChart2 className="w-7 h-7 text-[#00F0FF] mx-auto mb-1 group-hover:scale-110 transition-transform" />
            <h3 className="text-lg font-bold text-[#00F0FF] mb-1">Games Played</h3>
            <p className="text-xl md:text-2xl font-bold text-[#F0F7F7]">{userData.gamesPlayed}</p>
          </div>
          <div className="bg-[#0E1415]/80 border border-[#003B3E]/50 rounded-xl p-4 md:p-5 text-center hover:border-[#FFD700] hover:shadow-lg hover:shadow-[#FFD700]/10 transition-all duration-300 group">
            <Crown className="w-7 h-7 text-[#FFD700] mx-auto mb-1 group-hover:scale-110 transition-transform" />
            <h3 className="text-lg font-bold text-[#FFD700] mb-1">Wins</h3>
            <p className="text-xl md:text-2xl font-bold text-[#F0F7F7]">{userData.wins}</p>
            <p className="text-xs md:text-sm text-[#AFBAC0]">{userData.winRate} Win Rate</p>
          </div>
          <div className="bg-[#0E1415]/80 border border-[#003B3E]/50 rounded-xl p-4 md:p-5 text-center hover:border-[#FF6B6B] hover:shadow-lg hover:shadow-[#FF6B6B]/10 transition-all duration-300 group">
            <AlertTriangle className="w-7 h-7 text-[#FF6B6B] mx-auto mb-1 group-hover:scale-110 transition-transform" />
            <h3 className="text-lg font-bold text-[#FF6B6B] mb-1">Losses</h3>
            <p className="text-xl md:text-2xl font-bold text-[#F0F7F7]">{userData.losses}</p>
          </div>
          <div className="bg-[#0E1415]/80 border border-[#003B3E]/50 rounded-xl p-4 md:p-5 text-center hover:border-[#00F0FF] hover:shadow-lg hover:shadow-[#00F0FF]/10 transition-all duration-300 group">
            <Coins className="w-7 h-7 text-[#00F0FF] mx-auto mb-1 group-hover:scale-110 transition-transform" />
            <h3 className="text-lg font-bold text-[#00F0FF] mb-1">Tycoon Tokens</h3>
            <p className="text-xl md:text-2xl font-bold text-[#F0F7F7]">{userData.tokenBalance}</p>
          </div>
          <div className="bg-[#0E1415]/80 border border-[#003B3E]/50 rounded-xl p-4 md:p-5 text-center hover:border-[#0FF0FC] hover:shadow-lg hover:shadow-[#0FF0FC]/10 transition-all duration-300 group">
            <Dice1 className="w-7 h-7 text-[#0FF0FC] mx-auto mb-1 group-hover:scale-110 transition-transform" />
            <h3 className="text-lg font-bold text-[#0FF0FC] mb-1">Win Streak</h3>
            <p className="text-xl md:text-2xl font-bold text-[#F0F7F7]">{userData.longestWinStreak || 'N/A'}</p>
          </div>
        </section>

        {/* NFTs Owned */}
        <section className="mb-4 md:mb-6">
          <h3 className="text-xl md:text-2xl font-bold text-[#00F0FF] mb-4 md:mb-6 flex items-center justify-center gap-2 bg-gradient-to-r from-[#00F0FF] to-[#0FF0FC] bg-clip-text">
            <ShoppingBag className="w-5 h-5" />
            NFTs Owned ({userData.nftsOwned.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {userData.nftsOwned.map((nft) => (
              <div
                key={nft.id}
                className="bg-[#0E1415]/80 border border-[#003B3E]/50 rounded-xl p-3 md:p-4 hover:border-[#00F0FF] hover:shadow-xl hover:shadow-[#00F0FF]/15 transition-all duration-300 group cursor-pointer"
              >
                <div className="relative mb-2 md:mb-3 overflow-hidden rounded-lg">
                  <Image
                    src={nft.image}
                    alt={nft.name}
                    width={150}
                    height={150}
                    className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-1 right-1 bg-[#00F0FF]/20 text-[#00F0FF] px-1.5 py-0.5 rounded text-xs font-medium backdrop-blur-sm">
                    {nft.type.toUpperCase()}
                  </div>
                </div>
                <h4 className="font-bold text-[#F0F7F7] mb-1 text-sm md:text-base">{nft.name}</h4>
                <p className="text-[#455A64] text-xs md:text-sm mb-2 line-clamp-2">{nft.description}</p>
                <p className="text-[#00F0FF] text-xs md:text-sm font-medium">Minted for: {nft.price}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default ProfilePage;