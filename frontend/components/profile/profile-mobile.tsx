'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { 
  BarChart2, Crown, Coins, Wallet, Ticket, ShoppingBag, 
  Loader2, Send, ChevronDown, ChevronUp, ArrowLeft 
} from 'lucide-react';
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
    { name: 'Extra Turn', icon: <div className="w-14 h-14 bg-yellow-500/20 rounded-2xl flex items-center justify-center text-2xl">⚡</div> },
    { name: 'Jail Free', icon: <div className="w-14 h-14 bg-purple-500/20 rounded-2xl flex items-center justify-center text-2xl">👑</div> },
    { name: 'Double Rent', icon: <div className="w-14 h-14 bg-green-500/20 rounded-2xl flex items-center justify-center text-2xl">💰</div> },
    { name: 'Roll Boost', icon: <div className="w-14 h-14 bg-blue-500/20 rounded-2xl flex items-center justify-center text-2xl">✨</div> },
    { name: 'Instant Cash', icon: <div className="w-14 h-14 bg-cyan-500/20 rounded-2xl flex items-center justify-center text-2xl">💎</div> },
    { name: 'Teleport', icon: <div className="w-14 h-14 bg-pink-500/20 rounded-2xl flex items-center justify-center text-2xl">📍</div> },
    { name: 'Shield', icon: <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-2xl">🛡️</div> },
    { name: 'Property Discount', icon: <div className="w-14 h-14 bg-orange-500/20 rounded-2xl flex items-center justify-center text-2xl">🏠</div> },
    { name: 'Tax Refund', icon: <div className="w-14 h-14 bg-teal-500/20 rounded-2xl flex items-center justify-center text-2xl">↩️</div> },
    { name: 'Exact Roll', icon: <div className="w-14 h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center text-2xl">🎯</div> },
  ];
  return data[perk] || { name: `Perk #${perk}`, icon: <div className="w-14 h-14 bg-gray-500/20 rounded-2xl flex items-center justify-center text-2xl">?</div> };
};

export default function ProfilePageMobile() {
  const { address: walletAddress, isConnected, chainId } = useAccount();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendAddress, setSendAddress] = useState('');
  const [sendingTokenId, setSendingTokenId] = useState<bigint | null>(null);
  const [redeemingId, setRedeemingId] = useState<bigint | null>(null);
  const [showVouchers, setShowVouchers] = useState(false);

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

  // Owned Collectibles
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
      const [perkNum, strength, , , shopStock] = res.result as [bigint, bigint, bigint, bigint, bigint];
      const perk = Number(perkNum);
      if (perk === 0) return null;

      const tokenId = allOwnedTokenIds[i];
      const meta = getPerkMetadata(perk);

      return {
        tokenId,
        name: meta.name,
        icon: meta.icon,
        strength: Number(strength),
        shopStock: Number(shopStock),
        isTiered: perk === 5 || perk === 9,
      };
    }).filter((c): c is NonNullable<typeof c> => c !== null) ?? [];
  }, [infoResults.data, allOwnedTokenIds]);

  // Vouchers
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

  useEffect(() => {
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
  }, [playerData, username, walletAddress, loading]);

  const handleSend = (tokenId: bigint) => {
    if (!walletAddress || !rewardAddress) return toast.error("Wallet or contract not available");
    if (!sendAddress || !/^0x[a-fA-F0-9]{40}$/i.test(sendAddress)) return toast.error('Invalid wallet address');

    setSendingTokenId(tokenId);
    writeContract({
      address: rewardAddress,
      abi: RewardABI,
      functionName: 'safeTransferFrom',
      args: [walletAddress as `0x${string}`, sendAddress as `0x${string}`, tokenId, 1, '0x'],
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

  useEffect(() => {
    if (txSuccess && txHash) {
      toast.success('Success! 🎉');
      reset();
      setSendingTokenId(null);
      setRedeemingId(null);
      tycBalance.refetch();
    }
  }, [txSuccess, txHash, reset, tycBalance]);

  if (!isConnected || loading || error || !userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#010F10] via-[#0A1C1E] to-[#0E1415] flex items-center justify-center px-4">
        <div className="text-center space-y-6">
          {!isConnected ? (
            <p className="text-2xl font-bold text-red-400">Connect Wallet</p>
          ) : loading ? (
            <>
              <Loader2 className="w-12 h-12 animate-spin text-[#00F0FF] mx-auto" />
              <p className="text-xl text-[#00F0FF]">Loading profile...</p>
            </>
          ) : (
            <p className="text-xl font-bold text-red-400">Error: {error || 'No data'}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#010F10] via-[#0A1C1E] to-[#0E1415] text-[#F0F7F7] pb-20">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-[#010F10]/90 backdrop-blur-lg border-b border-[#003B3E]/60">
        <div className="flex items-center justify-between px-4 py-4 max-w-xl mx-auto">
          <Link href="/" className="p-2 -ml-2 text-[#00F0FF] hover:text-[#0FF0FC]">
            <ArrowLeft size={28} />
          </Link>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#00F0FF] to-cyan-400 bg-clip-text text-transparent">
            Profile
          </h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="px-4 pt-6 max-w-xl mx-auto space-y-8">
        {/* Player Card */}
        <div className="bg-[#0E1415]/70 backdrop-blur-md rounded-2xl p-6 border border-[#003B3E]/60">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-[#00F0FF]/50 ring-offset-4 ring-offset-transparent">
                <Image src={avatar} alt="Avatar" fill className="object-cover" />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-gradient-to-br from-yellow-400 to-amber-500 p-2 rounded-xl border-2 border-black/30">
                <Crown className="w-6 h-6 text-black" />
              </div>
            </div>

            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-[#00F0FF] to-cyan-300 bg-clip-text text-transparent">
                {userData.username}
              </h2>
              <p className="text-gray-400 font-mono text-sm mt-1 break-all">{userData.address}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-8">
            <div className="text-center">
              <p className="text-xs text-gray-400">Games</p>
              <p className="text-xl font-bold">{userData.gamesPlayed}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">Wins</p>
              <p className="text-xl font-bold text-green-400">{userData.wins}</p>
              <p className="text-xs text-green-400/80">{userData.winRate}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">Earned</p>
              <p className="text-xl font-bold text-emerald-400">{userData.totalEarned}</p>
            </div>
          </div>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#0E1415]/60 rounded-xl p-4 text-center border border-[#003B3E]/50">
            <p className="text-xs text-gray-400 mb-1">TYC</p>
            <p className="text-lg font-bold text-[#00F0FF]">
              {tycBalance.isLoading ? '...' : Number(tycBalance.data?.formatted || 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-[#0E1415]/60 rounded-xl p-4 text-center border border-[#003B3E]/50">
            <p className="text-xs text-gray-400 mb-1">USDC</p>
            <p className="text-lg font-bold text-[#00F0FF]">
              {usdcBalance.isLoading ? '...' : Number(usdcBalance.data?.formatted || 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-[#0E1415]/60 rounded-xl p-4 text-center border border-[#003B3E]/50">
            <p className="text-xs text-gray-400 mb-1">ETH</p>
            <p className="text-lg font-bold text-[#00F0FF]">
              {ethBalance ? Number(ethBalance.formatted).toFixed(4) : '0'}
            </p>
          </div>
        </div>

        {/* Perks Section */}
        <section>
          <h3 className="text-2xl font-bold mb-5 flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-[#00F0FF]" />
            My Perks ({ownedCollectibles.length})
          </h3>

          {ownedCollectibles.length === 0 ? (
            <div className="text-center py-12 bg-[#0E1415]/50 rounded-2xl border border-[#003B3E]/50">
              <ShoppingBag className="w-16 h-16 text-gray-600 mx-auto mb-4 opacity-50" />
              <p className="text-lg text-gray-400">No perks yet</p>
              <p className="text-sm text-gray-500 mt-2">Visit the shop to collect powerful advantages!</p>
            </div>
          ) : (
            <>
              {/* Transfer Input - compact */}
              <div className="bg-[#0E1415]/60 rounded-xl p-4 mb-6 border border-purple-500/30">
                <p className="text-sm text-gray-400 mb-2">Send a perk to:</p>
                <input
                  type="text"
                  placeholder="0x0000...0000"
                  value={sendAddress}
                  onChange={(e) => setSendAddress(e.target.value.trim())}
                  className="w-full px-4 py-3 bg-black/40 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {ownedCollectibles.map((item) => (
                  <motion.div
                    key={item.tokenId.toString()}
                    whileTap={{ scale: 0.96 }}
                    className="bg-[#0E1415]/70 rounded-2xl p-4 border border-[#003B3E]/70"
                  >
                    <div className="flex flex-col items-center text-center">
                      {item.icon}
                      <h4 className="mt-3 font-bold text-base">{item.name}</h4>
                      {item.isTiered && item.strength > 0 && (
                        <p className="text-cyan-300 text-xs mt-1">Tier {item.strength}</p>
                      )}
                      <button
                        onClick={() => handleSend(item.tokenId)}
                        disabled={!sendAddress || !/^0x[a-fA-F0-9]{40}$/i.test(sendAddress) || sendingTokenId === item.tokenId || isWriting || isConfirming}
                        className="mt-4 w-full py-2.5 rounded-lg font-medium text-sm transition-all
                          bg-gradient-to-r from-purple-600 to-pink-600 hover:brightness-110 disabled:opacity-50"
                      >
                        {sendingTokenId === item.tokenId && (isWriting || isConfirming) ? (
                          <Loader2 className="inline animate-spin mr-2" size={16} />
                        ) : 'Send'}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Vouchers Section - Collapsible */}
        <section className="mt-10">
          <button
            onClick={() => setShowVouchers(!showVouchers)}
            className="w-full bg-gradient-to-r from-amber-900/40 to-orange-900/30 rounded-2xl p-5 border border-amber-600/40 flex items-center justify-between hover:border-amber-500/60 transition-all"
          >
            <div className="flex items-center gap-4">
              <Ticket className="w-10 h-10 text-amber-400" />
              <div className="text-left">
                <h3 className="text-xl font-bold text-amber-300">
                  Vouchers ({myVouchers.length})
                </h3>
                <p className="text-sm text-amber-400/80">
                  {showVouchers ? 'Hide' : 'View & Redeem'}
                </p>
              </div>
            </div>
            {showVouchers ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
          </button>

          <AnimatePresence>
            {showVouchers && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.4 }}
                className="overflow-hidden mt-4"
              >
                {myVouchers.length === 0 ? (
                  <div className="text-center py-10 bg-[#0E1415]/50 rounded-2xl border border-amber-600/20">
                    <Ticket className="w-16 h-16 text-gray-600 mx-auto mb-4 opacity-50" />
                    <p className="text-lg text-gray-400">No vouchers yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {myVouchers.map((voucher) => (
                      <div
                        key={voucher.tokenId.toString()}
                        className="bg-gradient-to-br from-amber-950/40 to-orange-950/30 rounded-2xl p-5 border border-amber-800/40 text-center"
                      >
                        <Ticket className="w-16 h-16 text-amber-400 mx-auto mb-3" />
                        <p className="text-2xl font-black text-amber-300 mb-4">{voucher.value} TYC</p>
                        <button
                          onClick={() => handleRedeemVoucher(voucher.tokenId)}
                          disabled={redeemingId === voucher.tokenId || isWriting || isConfirming}
                          className="w-full py-3 rounded-xl font-medium transition-all text-sm
                            bg-gradient-to-r from-amber-600 to-orange-600 hover:brightness-110 disabled:opacity-50"
                        >
                          {redeemingId === voucher.tokenId && (isWriting || isConfirming) ? (
                            <Loader2 className="inline animate-spin mr-2" size={16} />
                          ) : 'Redeem'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
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