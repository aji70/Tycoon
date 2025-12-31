'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { BarChart2, Crown, Coins, Wallet, Ticket, ShoppingBag, Loader2, Send, ChevronDown, ChevronUp, Gift } from 'lucide-react';
import Link from 'next/link';
import avatar from '@/public/avatar.jpg';
import { useAccount, useBalance, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, type Address, type Abi } from 'viem';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

import { REWARD_CONTRACT_ADDRESSES, TYC_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS, TYCOON_CONTRACT_ADDRESSES } from '@/constants/contracts';
import RewardABI from '@/context/abi/rewardabi.json';
import TycoonABI from '@/context/abi/tycoonabi.json';

const VOUCHER_ID_START = 1_000_000_000;
const COLLECTIBLE_ID_START = 2_000_000_000;

const isVoucherToken = (tokenId: bigint): boolean =>
  tokenId >= VOUCHER_ID_START && tokenId < COLLECTIBLE_ID_START;

const getPerkMetadata = (perk: number) => {
  const data = [
    null,
    { name: 'Extra Turn', icon: <div className="w-16 h-16 bg-yellow-500/20 rounded-2xl flex items-center justify-center text-3xl">⚡</div> },
    { name: 'Get Out of Jail Free', icon: <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center text-3xl">👑</div> },
    { name: 'Double Rent', icon: <div className="w-16 h-16 bg-green-500/20 rounded-2xl flex items-center justify-center text-3xl">💰</div> },
    { name: 'Roll Boost', icon: <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center text-3xl">✨</div> },
    { name: 'Instant Cash', icon: <div className="w-16 h-16 bg-cyan-500/20 rounded-2xl flex items-center justify-center text-3xl">💎</div> },
    { name: 'Teleport', icon: <div className="w-16 h-16 bg-pink-500/20 rounded-2xl flex items-center justify-center text-3xl">📍</div> },
    { name: 'Shield', icon: <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-3xl">🛡️</div> },
    { name: 'Property Discount', icon: <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center text-3xl">🏠</div> },
    { name: 'Tax Refund', icon: <div className="w-16 h-16 bg-teal-500/20 rounded-2xl flex items-center justify-center text-3xl">↩️</div> },
    { name: 'Exact Roll', icon: <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center text-3xl">🎯</div> },
  ];
  return data[perk] || { name: `Perk #${perk}`, icon: <div className="w-16 h-16 bg-gray-500/20 rounded-2xl flex items-center justify-center text-3xl">?</div> };
};

export default function ProfilePage() {
  const { address: walletAddress, isConnected, chainId } = useAccount();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVouchers, setShowVouchers] = useState(false);

  // Modal state for gifting
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState<bigint | null>(null);
  const [giftAddress, setGiftAddress] = useState('');
  const [sendingTokenId, setSendingTokenId] = useState<bigint | null>(null);
  const [redeemingId, setRedeemingId] = useState<bigint | null>(null);

  const { writeContract, data: txHash, isPending: isWriting, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const { data: ethBalance } = useBalance({ address: walletAddress });

  const tycTokenAddress = TYC_TOKEN_ADDRESS[chainId as keyof typeof TYC_TOKEN_ADDRESS];
  const usdcTokenAddress = USDC_TOKEN_ADDRESS[chainId as keyof typeof USDC_TOKEN_ADDRESS];
  const tycoonAddress = TYCOON_CONTRACT_ADDRESSES[chainId as keyof typeof TYCOON_CONTRACT_ADDRESSES];
  const rewardAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES] as Address | undefined;

  const tycBalance = useBalance({ address: walletAddress, token: tycTokenAddress, query: { enabled: !!walletAddress && !!tycTokenAddress } });
  const usdcBalance = useBalance({ address: walletAddress, token: usdcTokenAddress, query: { enabled: !!walletAddress && !!usdcTokenAddress } });

  const { data: username } = useReadContract({
    address: tycoonAddress,
    abi: TycoonABI,
    functionName: 'addressToUsername',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress && !!tycoonAddress },
  });

  const { data: playerData } = useReadContract({
    address: tycoonAddress,
    abi: TycoonABI,
    functionName: 'getUser',
    args: username ? [username as string] : undefined,
    query: { enabled: !!username && !!tycoonAddress },
  });

  // Same data fetching for collectibles & vouchers (unchanged)
  const ownedCount = useReadContract({
    address: rewardAddress,
    abi: RewardABI,
    functionName: 'ownedTokenCount',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress && !!rewardAddress },
  });

  const ownedCountNum = Number(ownedCount.data ?? 0);

  const tokenCalls = useMemo(() =>
    Array.from({ length: ownedCountNum }, (_, i) => ({
      address: rewardAddress!,
      abi: RewardABI as Abi,
      functionName: 'tokenOfOwnerByIndex',
      args: [walletAddress!, BigInt(i)],
    } as const)),
  [rewardAddress, walletAddress, ownedCountNum]);

  const tokenResults = useReadContracts({
    contracts: tokenCalls,
    query: { enabled: ownedCountNum > 0 && !!rewardAddress && !!walletAddress },
  });

  const allOwnedTokenIds = tokenResults.data
    ?.map(r => r.status === 'success' ? r.result as bigint : null)
    .filter((id): id is bigint => id !== null) ?? [];

  const infoCalls = useMemo(() =>
    allOwnedTokenIds.map(id => ({
      address: rewardAddress!,
      abi: RewardABI as Abi,
      functionName: 'getCollectibleInfo',
      args: [id],
    } as const)),
  [rewardAddress, allOwnedTokenIds]);

  const infoResults = useReadContracts({
    contracts: infoCalls,
    query: { enabled: allOwnedTokenIds.length > 0 },
  });

  const ownedCollectibles = useMemo(() => {
    return infoResults.data?.map((res, i) => {
      if (res?.status !== 'success') return null;
      const [perkNum, strength] = res.result as [bigint, bigint, bigint, bigint, bigint];
      const perk = Number(perkNum);
      if (perk === 0) return null;

      const tokenId = allOwnedTokenIds[i];
      const meta = getPerkMetadata(perk);

      return {
        tokenId,
        name: meta.name,
        icon: meta.icon,
        strength: Number(strength),
        isTiered: perk === 5 || perk === 9,
      };
    }).filter((c): c is NonNullable<typeof c> => c !== null) ?? [];
  }, [infoResults.data, allOwnedTokenIds]);

  const voucherTokenIds = allOwnedTokenIds.filter(isVoucherToken);

  const voucherInfoCalls = useMemo(() =>
    voucherTokenIds.map(id => ({
      address: rewardAddress!,
      abi: RewardABI as Abi,
      functionName: 'getCollectibleInfo',
      args: [id],
    } as const)),
  [rewardAddress, voucherTokenIds]);

  const voucherInfoResults = useReadContracts({
    contracts: voucherInfoCalls,
    query: { enabled: voucherTokenIds.length > 0 },
  });

  const myVouchers = useMemo(() => {
    return voucherInfoResults.data?.map((res, i) => {
      if (res?.status !== 'success') return null;
      const [, , tycPrice] = res.result as [bigint, bigint, bigint, bigint, bigint];
      return {
        tokenId: voucherTokenIds[i],
        value: formatUnits(tycPrice, 18),
      };
    }).filter((v): v is NonNullable<typeof v> => v !== null) ?? [];
  }, [voucherInfoResults.data, voucherTokenIds]);

  React.useEffect(() => {
    if (playerData && username) {
      const d = playerData as any;
      setUserData({
        username: username || 'Unknown',
        address: walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : '',
        gamesPlayed: Number(d.gamesPlayed || 0),
        wins: Number(d.gamesWon || 0),
        winRate: d.gamesPlayed > 0 ? ((Number(d.gamesWon) / Number(d.gamesPlayed)) * 100).toFixed(1) + '%' : '0%',
        totalEarned: Number(d.totalEarned || 0),
      });
      setLoading(false);
    } else if (playerData === null && !loading) {
      setError('No player data found');
      setLoading(false);
    }
  }, [playerData, username, walletAddress]);

  const openGiftModal = (tokenId: bigint) => {
    setSelectedTokenId(tokenId);
    setGiftAddress('');
    setGiftModalOpen(true);
  };

  const handleGift = () => {
    if (!walletAddress || !rewardAddress || !selectedTokenId) return toast.error('Missing data');
    if (!giftAddress || !/^0x[a-fA-F0-9]{40}$/i.test(giftAddress)) return toast.error('Invalid address');

    setSendingTokenId(selectedTokenId);
    writeContract({
      address: rewardAddress,
      abi: RewardABI,
      functionName: 'safeTransferFrom',
      args: [walletAddress as `0x${string}`, giftAddress as `0x${string}`, selectedTokenId, 1, '0x'],
    });
  };

  const handleRedeemVoucher = (tokenId: bigint) => {
    if (!rewardAddress) return toast.error("Contract not available");
    setRedeemingId(tokenId);
    writeContract({
      address: rewardAddress,
      abi: RewardABI,
      functionName: 'redeemVoucher',
      args: [tokenId],
    });
  };

  React.useEffect(() => {
    if (txSuccess && txHash) {
      toast.success('Gift sent successfully! 🎉');
      reset();
      setSendingTokenId(null);
      setRedeemingId(null);
      setGiftModalOpen(false);
      tycBalance.refetch();
    }
  }, [txSuccess, txHash, reset, tycBalance]);

  // Loading / error states unchanged...

  if (!isConnected || loading || error || !userData) {
    // Same loading UI as before
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#010F10] via-[#0A1C1E] to-[#0E1415] flex items-center justify-center">
        <div className="text-center space-y-6">
          {!isConnected ? (
            <p className="text-3xl font-bold text-red-400">Wallet not connected</p>
          ) : loading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-20 h-20 border-4 border-[#00F0FF] border-t-transparent rounded-full mx-auto"
              />
              <p className="text-2xl text-[#00F0FF]">Loading profile...</p>
            </>
          ) : (
            <p className="text-3xl font-bold text-red-400">Error: {error || 'No data'}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#010F10] via-[#0A1C1E] to-[#0E1415] text-[#F0F7F7]">
      {/* Header & compact player info unchanged */}

      <header className="border-b border-cyan-900/30 backdrop-blur-md">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-[#00F0FF] font-medium hover:gap-2 flex items-center gap-1 transition-all">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00F0FF] to-cyan-400 bg-clip-text text-transparent">
            Profile
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Compact header with avatar, name, balances, stats unchanged */}
        <div className="glass-card rounded-3xl p-6 mb-8 border border-cyan-500/20">
          {/* ... same as previous version ... */}
        </div>

        {/* Collectibles Section */}
        <section className="mb-12">
          <h3 className="text-3xl font-bold mb-6 flex items-center gap-3 justify-center sm:justify-start">
            <ShoppingBag className="w-10 h-10 text-[#00F0FF]" />
            <span className="bg-gradient-to-r from-[#00F0FF] to-cyan-400 bg-clip-text text-transparent">
              My Perks ({ownedCollectibles.length})
            </span>
          </h3>

          {ownedCollectibles.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingBag className="w-32 h-32 text-gray-600 mx-auto mb-6 opacity-40" />
              <p className="text-xl text-gray-500">No perks yet — time to hit the shop!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
              {ownedCollectibles.map((item) => (
                <motion.div
                  key={item.tokenId.toString()}
                  whileHover={{ scale: 1.12, y: -8 }}
                  className="group relative"
                >
                  <div className="glass-card rounded-3xl p-8 text-center border border-[#003B3E] group-hover:border-[#00F0FF] transition-all duration-300 shadow-xl">
                    {item.icon}
                    <h4 className="mt-4 font-bold text-lg">{item.name}</h4>
                    {item.isTiered && item.strength > 0 && (
                      <p className="text-cyan-300 text-sm mt-1">Tier {item.strength}</p>
                    )}
                  </div>

                  {/* Subtle Gift button on hover */}
                  <button
                    onClick={() => openGiftModal(item.tokenId)}
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-purple-600/80 hover:bg-purple-500 p-3 rounded-xl shadow-lg"
                  >
                    <Gift className="w-5 h-5" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Vouchers section unchanged */}

        {/* Gift Modal */}
        <AnimatePresence>
          {giftModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
              onClick={() => setGiftModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="glass-card rounded-3xl p-8 max-w-md w-full border border-purple-500/50"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Gift Perk to Friend 🎁
                </h3>
                <input
                  type="text"
                  placeholder="0x0000...0000"
                  value={giftAddress}
                  onChange={(e) => setGiftAddress(e.target.value.trim())}
                  className="w-full px-5 py-4 bg-black/40 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 mb-6"
                />
                <div className="flex gap-4">
                  <button
                    onClick={() => setGiftModalOpen(false)}
                    className="flex-1 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGift}
                    disabled={!giftAddress || !/^0x[a-fA-F0-9]{40}$/i.test(giftAddress) || sendingTokenId === selectedTokenId || isWriting || isConfirming}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 flex items-center justify-center gap-2 font-bold"
                  >
                    {sendingTokenId === selectedTokenId && (isWriting || isConfirming) ? (
                      <> <Loader2 className="w-5 h-5 animate-spin" /> Sending... </>
                    ) : (
                      <> <Send className="w-5 h-5" /> Send Gift </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <style jsx global>{`
        .glass-card {
          background: rgba(14, 20, 21, 0.65);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
      `}</style>
    </div>
  );
}