'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Image from 'next/image';
import { 
  BarChart2, Crown, Coins, Wallet, Ticket, ShoppingBag, 
  Loader2, Send, ChevronDown, ChevronUp, ArrowLeft, Camera, Copy, Check, User, FileText 
} from 'lucide-react';
import Link from 'next/link';
import avatar from '@/public/avatar.jpg';
import { useAccount, useBalance, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, type Address, type Abi } from 'viem';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { useProfile } from '@/context/ProfileContext';

import { REWARD_CONTRACT_ADDRESSES, TYC_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS, TYCOON_CONTRACT_ADDRESSES } from '@/constants/contracts';
import RewardABI from '@/context/abi/rewardabi.json';
import TycoonABI from '@/context/abi/tycoonabi.json';

const VOUCHER_ID_START = 1_000_000_000;
const COLLECTIBLE_ID_START = 2_000_000_000;

const isVoucherToken = (tokenId: bigint): boolean =>
  tokenId >= VOUCHER_ID_START && tokenId < COLLECTIBLE_ID_START;

const MAX_AVATAR_SIZE = 1024 * 1024; // 1MB
const MAX_AVATAR_DIM = 512;

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
  const { profile, setAvatar, setDisplayName, setBio, setProfile } = useProfile();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendAddress, setSendAddress] = useState('');
  const [sendingTokenId, setSendingTokenId] = useState<bigint | null>(null);
  const [redeemingId, setRedeemingId] = useState<bigint | null>(null);
  const [showVouchers, setShowVouchers] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localDisplayName, setLocalDisplayName] = useState(profile?.displayName ?? '');
  const [localBio, setLocalBio] = useState(profile?.bio ?? '');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    setLocalDisplayName(profile?.displayName ?? '');
    setLocalBio(profile?.bio ?? '');
  }, [profile?.displayName, profile?.bio]);

  const displayName = profile?.displayName?.trim() || null;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (PNG, JPG, etc.)');
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error('Image must be under 1MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_AVATAR_DIM / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setAvatar(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        setAvatar(canvas.toDataURL('image/jpeg', 0.85));
        toast.success('Profile photo updated!');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const copyAddress = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    toast.success('Address copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const saveDisplayName = () => {
    const trimmed = localDisplayName.trim() || null;
    setDisplayName(trimmed);
    setProfile({ displayName: trimmed });
    toast.success('Display name saved');
  };

  const saveBio = () => {
    const trimmed = localBio.trim() || null;
    setBio(trimmed);
    setProfile({ bio: trimmed });
    toast.success('Bio saved');
  };

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
    <div className="min-h-screen bg-gradient-to-br from-[#010F10] via-[#0A1C1E] to-[#0E1415] text-[#F0F7F7] pb-24">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />

      <header className="sticky top-0 z-30 bg-[#010F10]/95 backdrop-blur-xl border-b border-[#003B3E]/60">
        <div className="flex items-center justify-between px-4 py-4 max-w-xl mx-auto">
          <Link href="/" className="p-2 -ml-2 text-[#00F0FF] hover:text-cyan-300 transition">
            <ArrowLeft size={26} />
          </Link>
          <h1 className="text-xl font-bold bg-gradient-to-r from-[#00F0FF] to-cyan-400 bg-clip-text text-transparent">
            Profile
          </h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="px-4 pt-5 max-w-xl mx-auto space-y-5">
        {/* Hero: Avatar + Username + Wallet */}
        <div className="glass-card rounded-2xl p-5 border border-cyan-500/20">
          <div className="flex flex-col items-center text-center">
            <div className="relative group mb-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative w-20 h-20 rounded-full overflow-hidden ring-4 ring-[#00F0FF]/50 ring-offset-4 ring-offset-[#0A1C1E] block"
              >
                {profile?.avatar ? (
                  <img src={profile.avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <Image src={avatar} alt="Avatar" width={80} height={80} className="w-full h-full object-cover" />
                )}
                <span className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  <Camera className="w-7 h-7 text-white" />
                </span>
              </button>
              <div className="absolute -bottom-1 -right-1 bg-gradient-to-br from-yellow-400 to-amber-500 p-1.5 rounded-lg border-2 border-[#0A1C1E]">
                <Crown className="w-5 h-5 text-black" />
              </div>
            </div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-[#00F0FF] to-cyan-300 bg-clip-text text-transparent">
              {userData.username}
            </h2>
            {displayName && <p className="text-gray-500 text-xs mt-0.5">Nickname: {displayName}</p>}
            <button
              type="button"
              onClick={copyAddress}
              className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-xs w-full max-w-[260px] justify-center"
            >
              <span className="font-mono truncate">{walletAddress}</span>
              {copied ? <Check className="w-4 h-4 text-green-400 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
            </button>
          </div>
        </div>

        {/* Balances + Stats in one grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="glass-card rounded-xl p-3 text-center border border-white/10">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">TYC</p>
            <p className="text-base font-bold text-[#00F0FF] truncate">
              {tycBalance.isLoading ? '...' : Number(tycBalance.data?.formatted || 0).toFixed(2)}
            </p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center border border-white/10">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">USDC</p>
            <p className="text-base font-bold text-[#00F0FF] truncate">
              {usdcBalance.isLoading ? '...' : Number(usdcBalance.data?.formatted || 0).toFixed(2)}
            </p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center border border-white/10">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">ETH</p>
            <p className="text-base font-bold text-[#00F0FF] truncate">
              {ethBalance ? Number(ethBalance.formatted).toFixed(4) : '0'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="glass-card rounded-xl p-3 flex flex-col items-center gap-1 border border-white/10">
            <BarChart2 className="w-5 h-5 text-cyan-400" />
            <p className="text-[10px] text-gray-400">Games</p>
            <p className="text-sm font-bold">{userData.gamesPlayed}</p>
          </div>
          <div className="glass-card rounded-xl p-3 flex flex-col items-center gap-1 border border-white/10">
            <Crown className="w-5 h-5 text-amber-400" />
            <p className="text-[10px] text-gray-400">Wins</p>
            <p className="text-sm font-bold text-green-400">{userData.wins}</p>
            <p className="text-[10px] text-green-400/80">{userData.winRate}</p>
          </div>
          <div className="glass-card rounded-xl p-3 flex flex-col items-center gap-1 border border-white/10">
            <Coins className="w-5 h-5 text-emerald-400" />
            <p className="text-[10px] text-gray-400">Earned</p>
            <p className="text-sm font-bold text-emerald-400">{userData.totalEarned}</p>
          </div>
        </div>

        {/* About: Nickname + Bio */}
        <div className="glass-card rounded-2xl p-4 border border-cyan-500/10">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">About</p>
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
              <User className="w-4 h-4 text-cyan-400 shrink-0" />
              <input
                type="text"
                placeholder="Nickname (optional)"
                value={localDisplayName}
                onChange={(e) => setLocalDisplayName(e.target.value)}
                onBlur={saveDisplayName}
                className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm min-w-0"
              />
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
              <textarea
                placeholder="Short bio (optional)"
                value={localBio}
                onChange={(e) => setLocalBio(e.target.value)}
                onBlur={saveBio}
                rows={2}
                className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm resize-none"
              />
            </div>
          </div>
        </div>

        {/* Perks */}
        <section>
          <h3 className="text-base font-bold mb-3 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#00F0FF]" />
            My Perks <span className="text-gray-400 font-normal text-sm">({ownedCollectibles.length})</span>
          </h3>

          {ownedCollectibles.length > 0 && (
            <div className="glass-card rounded-xl p-3 mb-4 border border-purple-500/20">
              <p className="text-xs text-gray-400 mb-2">Transfer to</p>
              <input
                type="text"
                placeholder="0x0000...0000"
                value={sendAddress}
                onChange={(e) => setSendAddress(e.target.value.trim())}
                className="w-full px-3 py-2.5 bg-black/40 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-xs"
              />
            </div>
          )}

          {ownedCollectibles.length === 0 ? (
            <div className="glass-card rounded-2xl py-10 text-center border border-[#003B3E]/50">
              <ShoppingBag className="w-14 h-14 text-gray-600 mx-auto mb-3 opacity-40" />
              <p className="text-gray-400 text-sm">No perks yet — visit the shop.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {ownedCollectibles.map((item) => (
                <motion.div
                  key={item.tokenId.toString()}
                  whileTap={{ scale: 0.98 }}
                  className="glass-card rounded-xl p-4 border border-[#003B3E] text-center"
                >
                  {item.icon}
                  <h4 className="mt-2 font-bold text-sm">{item.name}</h4>
                  {item.isTiered && item.strength > 0 && <p className="text-cyan-300 text-[10px] mt-0.5">Tier {item.strength}</p>}
                  <button
                    onClick={() => handleSend(item.tokenId)}
                    disabled={!sendAddress || !/^0x[a-fA-F0-9]{40}$/i.test(sendAddress) || sendingTokenId === item.tokenId || isWriting || isConfirming}
                    className="mt-3 w-full py-2 rounded-lg font-medium text-xs bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {sendingTokenId === item.tokenId && (isWriting || isConfirming) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {sendingTokenId === item.tokenId && (isWriting || isConfirming) ? 'Sending...' : 'Send'}
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Vouchers */}
        <section className="pb-4">
          <button
            onClick={() => setShowVouchers(!showVouchers)}
            className="w-full glass-card rounded-2xl p-4 border border-amber-600/30 flex items-center justify-between hover:border-amber-500/50 transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <Ticket className="w-8 h-8 text-amber-400 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-amber-300">Vouchers</h3>
                <p className="text-gray-400 text-xs">{myVouchers.length} · {showVouchers ? 'Hide' : 'View'}</p>
              </div>
            </div>
            {showVouchers ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
          </button>

          <AnimatePresence>
            {showVouchers && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden mt-3"
              >
                {myVouchers.length === 0 ? (
                  <div className="glass-card rounded-xl py-8 text-center border border-amber-600/20">
                    <Ticket className="w-12 h-12 text-gray-600 mx-auto mb-2 opacity-50" />
                    <p className="text-gray-500 text-sm">No vouchers yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {myVouchers.map((voucher) => (
                      <div
                        key={voucher.tokenId.toString()}
                        className="glass-card rounded-xl p-4 border border-amber-600/40 text-center"
                      >
                        <Ticket className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                        <p className="text-lg font-bold text-amber-300 mb-3">{voucher.value} TYC</p>
                        <button
                          onClick={() => handleRedeemVoucher(voucher.tokenId)}
                          disabled={redeemingId === voucher.tokenId || isWriting || isConfirming}
                          className="w-full py-2 rounded-lg font-medium text-xs bg-gradient-to-r from-amber-600 to-orange-600 disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          {redeemingId === voucher.tokenId && (isWriting || isConfirming) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
                          {redeemingId === voucher.tokenId && (isWriting || isConfirming) ? 'Redeeming...' : 'Redeem'}
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
          background: rgba(14, 20, 21, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
      `}</style>
    </div>
  );
}