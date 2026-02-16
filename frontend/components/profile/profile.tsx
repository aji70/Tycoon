'use client';

import React, { useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import { BarChart2, Crown, Coins, Wallet, Ticket, ShoppingBag, Loader2, Send, ChevronDown, ChevronUp, Camera, Copy, Check, User, FileText } from 'lucide-react';
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

const MAX_AVATAR_SIZE = 1024 * 1024; // 1MB
const MAX_AVATAR_DIM = 512;

export default function Profile() {
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

  React.useEffect(() => {
    setLocalDisplayName(profile?.displayName ?? '');
    setLocalBio(profile?.bio ?? '');
  }, [profile?.displayName, profile?.bio]);

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

  // ... (same data fetching logic for ownedCollectibles and myVouchers as before)

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

  React.useEffect(() => {
    if (txSuccess && txHash) {
      toast.success('Success! 🎉');
      reset();
      setSendingTokenId(null);
      setRedeemingId(null);
      tycBalance.refetch();
    }
  }, [txSuccess, txHash, reset, tycBalance]);

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
        const resized = canvas.toDataURL('image/jpeg', 0.85);
        setAvatar(resized);
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
      {/* Compact Header */}
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
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />

        {/* Profile Hero Card */}
        <div className="glass-card rounded-3xl p-8 mb-8 border border-cyan-500/20 overflow-hidden">
          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8">
            {/* Avatar + Upload */}
            <div className="relative group shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative w-28 h-28 rounded-full overflow-hidden ring-4 ring-[#00F0FF] ring-offset-4 ring-offset-[#0A1C1E] focus:outline-none focus:ring-2 focus:ring-cyan-400 block"
              >
                {profile?.avatar ? (
                  <img src={profile.avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="absolute inset-0 [&>img]:object-cover">
                    <Image src={avatar} alt="Avatar" width={112} height={112} className="w-full h-full object-cover" />
                  </span>
                )}
                <span className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  <Camera className="w-10 h-10 text-white" />
                </span>
              </button>
              <div className="absolute -bottom-1 -right-1 bg-gradient-to-br from-yellow-400 to-amber-500 p-2 rounded-xl shadow-lg">
                <Crown className="w-5 h-5 text-black" />
              </div>
            </div>

            <div className="flex-1 w-full text-center lg:text-left space-y-6">
              {/* Names */}
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-[#00F0FF] to-cyan-300 bg-clip-text text-transparent">
                  {profile?.displayName || userData.username}
                </h2>
                {profile?.displayName && (
                  <p className="text-gray-500 font-mono text-sm mt-0.5">@{userData.username}</p>
                )}
              </div>

              {/* Wallet address - copyable */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                <span className="text-gray-400 font-mono text-sm break-all">{walletAddress}</span>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="p-2 rounded-lg bg-white/5 hover:bg-cyan-500/20 border border-white/10 text-[#00F0FF] transition"
                  title="Copy address"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {/* Display name & Bio */}
              <div className="space-y-4 max-w-xl">
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  <div className="flex-1 flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2">
                    <User className="w-4 h-4 text-cyan-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Display name"
                      value={localDisplayName}
                      onChange={(e) => setLocalDisplayName(e.target.value)}
                      onBlur={saveDisplayName}
                      className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={saveDisplayName}
                    className="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-sm font-medium hover:bg-cyan-500/30 transition"
                  >
                    Save name
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-start">
                  <div className="flex-1 flex gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3 min-h-[80px]">
                    <FileText className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <textarea
                      placeholder="Short bio (e.g. Monopoly enthusiast)"
                      value={localBio}
                      onChange={(e) => setLocalBio(e.target.value)}
                      onBlur={saveBio}
                      rows={2}
                      className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm resize-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={saveBio}
                    className="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-sm font-medium hover:bg-cyan-500/30 transition shrink-0"
                  >
                    Save bio
                  </button>
                </div>
              </div>
            </div>

            {/* Balances - right column on desktop */}
            <div className="flex sm:flex-row lg:flex-col gap-6 shrink-0">
              <div className="text-center min-w-[80px]">
                <p className="text-gray-500 text-xs uppercase tracking-wider">TYC</p>
                <p className="text-xl font-bold text-[#00F0FF]">
                  {tycBalance.isLoading ? '...' : Number(tycBalance.data?.formatted || 0).toFixed(2)}
                </p>
              </div>
              <div className="text-center min-w-[80px]">
                <p className="text-gray-500 text-xs uppercase tracking-wider">USDC</p>
                <p className="text-xl font-bold text-[#00F0FF]">
                  {usdcBalance.isLoading ? '...' : Number(usdcBalance.data?.formatted || 0).toFixed(2)}
                </p>
              </div>
              <div className="text-center min-w-[80px]">
                <p className="text-gray-500 text-xs uppercase tracking-wider">ETH</p>
                <p className="text-xl font-bold text-[#00F0FF]">
                  {ethBalance ? Number(ethBalance.formatted).toFixed(4) : '0'}
                </p>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t border-cyan-900/30 justify-center sm:justify-start">
            <div className="bg-white/5 rounded-xl px-5 py-3 border border-white/10 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-cyan-400" />
              <div>
                <p className="text-xs text-gray-400">Games played</p>
                <p className="font-bold text-lg">{userData.gamesPlayed}</p>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl px-5 py-3 border border-white/10 flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-xs text-gray-400">Wins</p>
                <p className="font-bold text-lg text-green-400">{userData.wins} <span className="text-sm font-normal text-gray-400">({userData.winRate})</span></p>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl px-5 py-3 border border-white/10 flex items-center gap-2">
              <Coins className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-xs text-gray-400">Total earned</p>
                <p className="font-bold text-lg text-emerald-400">{userData.totalEarned} BLOCK</p>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN: Collectibles (Prominent) */}
        <section className="mb-12">
          <h3 className="text-3xl font-bold mb-6 flex items-center gap-3 justify-center sm:justify-start">
            <ShoppingBag className="w-10 h-10 text-[#00F0FF]" />
            <span className="bg-gradient-to-r from-[#00F0FF] to-cyan-400 bg-clip-text text-transparent">
              My Perks ({ownedCollectibles.length})
            </span>
          </h3>

          {ownedCollectibles.length > 0 && (
            <div className="glass-card rounded-2xl p-6 mb-8 border border-purple-500/30 max-w-2xl mx-auto">
              <label className="text-sm text-gray-400 mb-2 block text-center">Transfer a perk</label>
              <input
                type="text"
                placeholder="0x0000...0000"
                value={sendAddress}
                onChange={(e) => setSendAddress(e.target.value.trim())}
                className="w-full px-5 py-3 bg-black/40 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
              />
            </div>
          )}

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
                  className="group"
                >
                  <div className="glass-card rounded-3xl p-8 text-center border border-[#003B3E] group-hover:border-[#00F0FF] transition-all duration-300 shadow-xl">
                    {item.icon}
                    <h4 className="mt-4 font-bold text-lg">{item.name}</h4>
                    {item.isTiered && item.strength > 0 && (
                      <p className="text-cyan-300 text-sm mt-1">Tier {item.strength}</p>
                    )}
                    <button
                      onClick={() => handleSend(item.tokenId)}
                      disabled={!sendAddress || !/^0x[a-fA-F0-9]{40}$/i.test(sendAddress) || sendingTokenId === item.tokenId || isWriting || isConfirming}
                      className="mt-5 w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      {sendingTokenId === item.tokenId && (isWriting || isConfirming) ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Collapsed Vouchers Section */}
        <section>
          <button
            onClick={() => setShowVouchers(!showVouchers)}
            className="w-full glass-card rounded-2xl p-6 mb-4 border border-amber-600/30 flex items-center justify-between hover:border-amber-500/50 transition-all"
          >
            <div className="flex items-center gap-4">
              <Ticket className="w-10 h-10 text-amber-400" />
              <div className="text-left">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                  Reward Vouchers ({myVouchers.length})
                </h3>
                <p className="text-gray-400 text-sm">
                  {showVouchers ? 'Hide' : 'Click to view and redeem'}
                </p>
              </div>
            </div>
            {showVouchers ? <ChevronUp className="w-8 h-8 text-amber-400" /> : <ChevronDown className="w-8 h-8 text-amber-400" />}
          </button>

          <AnimatePresence>
            {showVouchers && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.4 }}
                className="overflow-hidden"
              >
                {myVouchers.length === 0 ? (
                  <div className="text-center py-12 glass-card rounded-2xl border border-amber-600/20">
                    <Ticket className="w-20 h-20 text-gray-600 mx-auto mb-4 opacity-50" />
                    <p className="text-gray-500">No vouchers yet — keep winning games!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {myVouchers.map((voucher) => (
                      <motion.div
                        key={voucher.tokenId.toString()}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card rounded-3xl p-8 text-center border border-amber-600/40"
                      >
                        <Ticket className="w-20 h-20 text-amber-400 mx-auto mb-4" />
                        <p className="text-3xl font-black text-amber-300 mb-6">{voucher.value} TYC</p>
                        <button
                          onClick={() => handleRedeemVoucher(voucher.tokenId)}
                          disabled={redeemingId === voucher.tokenId || isWriting || isConfirming}
                          className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black disabled:opacity-60 flex items-center justify-center gap-2 transition-all"
                        >
                          {redeemingId === voucher.tokenId && (isWriting || isConfirming) ? (
                            <> <Loader2 className="w-5 h-5 animate-spin" /> Redeeming... </>
                          ) : (
                            <> <Coins className="w-5 h-5" /> Redeem </>
                          )}
                        </button>
                      </motion.div>
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