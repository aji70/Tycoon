'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Image from 'next/image';
import { 
  BarChart2, Crown, Coins, Wallet, Ticket, ShoppingBag, 
  Loader2, Send, ChevronDown, ChevronUp, ArrowLeft, Camera, Copy, Check, User, FileText, Pencil 
} from 'lucide-react';
import Link from 'next/link';
import avatar from '@/public/avatar.jpg';
import { useAccount, useBalance, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, type Address, type Abi } from 'viem';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { useProfile } from '@/context/ProfileContext';
import { useGuestAuthOptional } from '@/context/GuestAuthContext';
import AccountLinkWallet from '@/components/auth/AccountLinkWallet';

import { apiClient } from '@/lib/api';
import { ApiResponse } from '@/types/api';
import { useQuery } from '@tanstack/react-query';
import { REWARD_CONTRACT_ADDRESSES, TYCOON_CONTRACT_ADDRESSES } from '@/constants/contracts';
import { useProfileOwner, useRewardTokenAddresses, useUserRegistryWallet } from '@/context/ContractProvider';
import RewardABI from '@/context/abi/rewardabi.json';
import TycoonABI from '@/context/abi/tycoonabi.json';
import { getLevelFromActivity } from '@/lib/level';
import { DailyClaim } from '@/components/rewards/DailyClaim';
import { SkeletonPerkGrid, SkeletonCard } from '@/components/ui/SkeletonCard';
import EmptyState from '@/components/ui/EmptyState';
import FirstTimeHint from '@/components/ui/FirstTimeHint';

const VOUCHER_ID_START = 1_000_000_000;
const COLLECTIBLE_ID_START = 2_000_000_000;

const isVoucherToken = (tokenId: bigint): boolean =>
  tokenId >= VOUCHER_ID_START && tokenId < COLLECTIBLE_ID_START;

const MAX_AVATAR_SIZE = 1024 * 1024; // 1MB
const MAX_AVATAR_DIM = 512;

function parseUserFromContract(data: unknown, username: string, walletAddress: string | undefined): {
  username: string;
  shortAddress: string;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  winRate: string;
  totalStaked: number;
  totalEarned: number;
  totalWithdrawn: number;
  propertiesBought: number;
  propertiesSold: number;
  registeredAt: number;
} | null {
  if (!data) return null;
  const d = data as Record<string, unknown> | unknown[];
  const gamesPlayed = Array.isArray(d) ? Number(d[4] ?? 0) : Number((d as Record<string, unknown>).gamesPlayed ?? 0);
  const gamesWon = Array.isArray(d) ? Number(d[5] ?? 0) : Number((d as Record<string, unknown>).gamesWon ?? 0);
  const gamesLost = Array.isArray(d) ? Number(d[6] ?? 0) : Number((d as Record<string, unknown>).gamesLost ?? 0);
  const totalStaked = Array.isArray(d) ? Number(d[7] ?? 0) : Number((d as Record<string, unknown>).totalStaked ?? 0);
  const totalEarned = Array.isArray(d) ? Number(d[8] ?? 0) : Number((d as Record<string, unknown>).totalEarned ?? 0);
  const totalWithdrawn = Array.isArray(d) ? Number(d[9] ?? 0) : Number((d as Record<string, unknown>).totalWithdrawn ?? 0);
  const propertiesBought = Array.isArray(d) ? Number(d[10] ?? 0) : Number((d as Record<string, unknown>).propertiesbought ?? 0);
  const propertiesSold = Array.isArray(d) ? Number(d[11] ?? 0) : Number((d as Record<string, unknown>).propertiesSold ?? 0);
  const registeredAt = Array.isArray(d) ? Number(d[3] ?? 0) : Number((d as Record<string, unknown>).registeredAt ?? 0);
  return {
    username: username || (Array.isArray(d) ? String(d[1] ?? '') : String((d as Record<string, unknown>).username ?? '')) || 'Unknown',
    shortAddress: walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : '',
    gamesPlayed,
    gamesWon,
    gamesLost,
    winRate: gamesPlayed > 0 ? ((gamesWon / gamesPlayed) * 100).toFixed(1) + '%' : '0%',
    totalStaked,
    totalEarned,
    totalWithdrawn,
    propertiesBought,
    propertiesSold,
    registeredAt,
  };
}

function formatStakeOrEarned(value: number): string {
  if (value >= 1e18) return (value / 1e18).toFixed(2);
  if (value >= 1e15) return (value / 1e18).toFixed(4);
  return String(value);
}

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

const CELO_CHAIN_ID = 42220;

const zeroAddress = '0x0000000000000000000000000000000000000000' as Address;
const isValidWallet = (a: unknown): a is Address => {
  if (!a || typeof a !== 'string') return false;
  const s = a.trim();
  if (!s) return false;
  return s.toLowerCase() !== zeroAddress.toLowerCase();
};

/** Guest/Privy profile when wallet is not connected: username, Account & login, game count; full on-chain stats when user has linked wallet. */
function GuestProfileViewMobile({ guestUser }: { guestUser: { username: string; linked_wallet_address?: string | null; smart_wallet_address?: string | null } }) {
  const username = guestUser.username;
  const guestOnChainAddress =
    (isValidWallet(guestUser.smart_wallet_address) ? (guestUser.smart_wallet_address as Address) : null) ??
    (guestUser.linked_wallet_address && String(guestUser.linked_wallet_address).trim()
      ? (guestUser.linked_wallet_address as Address)
      : null);
  const tycoonAddress = TYCOON_CONTRACT_ADDRESSES[CELO_CHAIN_ID];

  const { data: onChainUsername } = useReadContract({
    address: tycoonAddress,
    abi: TycoonABI,
    functionName: 'addressToUsername',
    args: guestOnChainAddress ? [guestOnChainAddress] : undefined,
    query: { enabled: !!guestOnChainAddress && !!tycoonAddress },
  });

  const { data: playerData } = useReadContract({
    address: tycoonAddress,
    abi: TycoonABI,
    functionName: 'getUser',
    args: onChainUsername ? [onChainUsername as string] : undefined,
    query: { enabled: !!onChainUsername && !!tycoonAddress },
  });

  const userData = React.useMemo(() => {
    if (!playerData || !onChainUsername) return null;
    return parseUserFromContract(playerData, onChainUsername as string, guestOnChainAddress ?? undefined);
  }, [playerData, onChainUsername, guestOnChainAddress]);

  const { data: games = [] } = useQuery({
    queryKey: ['guest-my-games'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse>('/games/my-games', { params: { limit: 100 } });
      if (!res?.data?.success || !Array.isArray(res.data.data)) return [];
      return res.data.data as { code: string; status: string; is_ai?: boolean }[];
    },
  });
  const gameCount = games.length;
  const runningCount = games.filter((g) => g.status === 'RUNNING').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#010F10] via-[#0A1C1E] to-[#0E1415] px-4 pb-24">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#030c0d]/90 backdrop-blur-xl py-4">
        <Link href="/" className="flex items-center gap-2 text-cyan-300/90 text-sm font-medium">
          <ArrowLeft className="w-5 h-5" /> Back
        </Link>
      </header>
      <main className="py-6 space-y-5">
        <div className="rounded-2xl border border-cyan-500/20 bg-[#011112]/80 p-5">
          <h2 className="text-lg font-bold text-white mb-2">{username}</h2>
          {!guestOnChainAddress && (
            <p className="text-cyan-300/80 text-sm mb-4">Your progress is saved. Connect your wallet from the nav to link this account.</p>
          )}
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-cyan-400 font-semibold">{gameCount}</span>
              <span className="text-white/70 ml-1">games</span>
            </div>
            {runningCount > 0 && (
              <div>
                <span className="text-amber-400 font-semibold">{runningCount}</span>
                <span className="text-white/70 ml-1">in progress</span>
              </div>
            )}
          </div>
        </div>

        {userData && (
          <div className="rounded-2xl border border-cyan-500/20 bg-[#011112]/80 p-5">
            <h3 className="text-sm font-semibold text-cyan-400 mb-3">On-chain stats</h3>
            {(() => {
              const levelInfo = getLevelFromActivity({ gamesPlayed: userData.gamesPlayed, gamesWon: userData.gamesWon });
              return (
                <>
                  <div className="mb-3 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-medium text-cyan-400/90 uppercase tracking-widest">Level</span>
                      <span className="font-bold text-cyan-300 text-sm">Level {levelInfo.level} · {levelInfo.label}</span>
                    </div>
                    {levelInfo.level < 99 && levelInfo.xpForNextLevel > 0 && (
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-cyan-500/80 transition-all duration-500" style={{ width: `${Math.round(levelInfo.progress * 100)}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                    <div className="profile-card rounded-xl p-3 flex flex-col items-center gap-0.5 border border-white/10">
                      <BarChart2 className="w-4 h-4 text-cyan-400" />
                      <p className="text-[10px] text-white/50">Games</p>
                      <p className="text-sm font-bold text-white">{userData.gamesPlayed}</p>
                    </div>
                    <div className="profile-card rounded-xl p-3 flex flex-col items-center gap-0.5 border border-white/10">
                      <Crown className="w-4 h-4 text-amber-400" />
                      <p className="text-[10px] text-white/50">Wins</p>
                      <p className="text-sm font-bold text-amber-300">{userData.gamesWon}</p>
                    </div>
                    <div className="profile-card rounded-xl p-3 flex flex-col items-center gap-0.5 border border-white/10">
                      <Coins className="w-4 h-4 text-slate-400" />
                      <p className="text-[10px] text-white/50">Losses</p>
                      <p className="text-sm font-bold text-slate-300">{userData.gamesLost}</p>
                    </div>
                    <div className="profile-card rounded-xl p-3 flex flex-col items-center gap-0.5 border border-white/10">
                      <BarChart2 className="w-4 h-4 text-emerald-400" />
                      <p className="text-[10px] text-white/50">Win rate</p>
                      <p className="text-sm font-bold text-emerald-300">{userData.winRate}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="profile-card rounded-xl p-2.5 text-center border border-white/10">
                      <p className="text-[9px] text-white/50">Staked</p>
                      <p className="text-xs font-bold text-white truncate">{formatStakeOrEarned(userData.totalStaked)}</p>
                    </div>
                    <div className="profile-card rounded-xl p-2.5 text-center border border-white/10">
                      <p className="text-[9px] text-white/50">Earned</p>
                      <p className="text-xs font-bold text-emerald-300 truncate">{formatStakeOrEarned(userData.totalEarned)}</p>
                    </div>
                    <div className="profile-card rounded-xl p-2.5 text-center border border-white/10">
                      <p className="text-[9px] text-white/50">Withdrawn</p>
                      <p className="text-xs font-bold text-slate-300 truncate">{formatStakeOrEarned(userData.totalWithdrawn)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="profile-card rounded-xl p-2.5 flex items-center justify-center gap-2 border border-white/10">
                      <p className="text-[9px] text-white/50">Props bought</p>
                      <p className="text-sm font-bold text-cyan-300">{userData.propertiesBought}</p>
                    </div>
                    <div className="profile-card rounded-xl p-2.5 flex items-center justify-center gap-2 border border-white/10">
                      <p className="text-[9px] text-white/50">Props sold</p>
                      <p className="text-sm font-bold text-amber-300">{userData.propertiesSold}</p>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        <AccountLinkWallet />
      </main>
    </div>
  );
}

export default function ProfilePageMobile() {
  const { address: walletAddress, isConnected, chainId } = useAccount();
  const { profile, setAvatar, setDisplayName, setBio, setProfile } = useProfile();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendAddress, setSendAddress] = useState('');
  const [sendingTokenId, setSendingTokenId] = useState<bigint | null>(null);
  const [selectedPerkForTransfer, setSelectedPerkForTransfer] = useState<bigint | null>(null);
  const [redeemingId, setRedeemingId] = useState<bigint | null>(null);
  const [showVouchers, setShowVouchers] = useState(false);
  const [profileTab, setProfileTab] = useState<'stats' | 'about' | 'perks' | 'vouchers'>('stats');
  const [copied, setCopied] = useState(false);
  const [localDisplayName, setLocalDisplayName] = useState(profile?.displayName ?? '');
  const [localBio, setLocalBio] = useState(profile?.bio ?? '');
  const [editingBio, setEditingBio] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { writeContract, data: txHash, isPending: isWriting, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const { data: ethBalance } = useBalance({ address: walletAddress });

  const { tycAddress: tycTokenAddress, usdcAddress: usdcTokenAddress } = useRewardTokenAddresses();
  const tycoonAddress = TYCOON_CONTRACT_ADDRESSES[chainId as keyof typeof TYCOON_CONTRACT_ADDRESSES];
  const rewardAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES] as Address | undefined;
  const { data: smartWalletAddress } = useUserRegistryWallet(walletAddress);
  const smartWallet = isValidWallet(smartWalletAddress) ? smartWalletAddress : undefined;
  const { data: smartWalletOwner } = useProfileOwner(smartWallet);
  const tycoonProfileOwnerAddress =
    (isValidWallet(smartWalletOwner) ? smartWalletOwner : null) ??
    walletAddress;

  const tycBalance = useBalance({ address: walletAddress, token: tycTokenAddress, query: { enabled: !!walletAddress && !!tycTokenAddress } });
  const usdcBalance = useBalance({ address: walletAddress, token: usdcTokenAddress, query: { enabled: !!walletAddress && !!usdcTokenAddress } });
  const showDualBalances = !!smartWallet && !!walletAddress && smartWallet.toLowerCase() !== walletAddress.toLowerCase();
  const { data: ethBalanceSmart } = useBalance({ address: smartWallet, query: { enabled: !!smartWallet } });
  const tycBalanceSmart = useBalance({ address: smartWallet, token: tycTokenAddress, query: { enabled: !!smartWallet && !!tycTokenAddress } });
  const usdcBalanceSmart = useBalance({ address: smartWallet, token: usdcTokenAddress, query: { enabled: !!smartWallet && !!usdcTokenAddress } });

  const showDualWallets = showDualBalances;
  const [activeWalletView, setActiveWalletView] = useState<'connected' | 'smart'>(() => (smartWallet ? 'smart' : 'connected'));
  React.useEffect(() => {
    if (!smartWallet) setActiveWalletView('connected');
  }, [smartWallet]);

  const {
    data: username,
    isLoading: usernameLoading,
    error: usernameReadError,
  } = useReadContract({
    address: tycoonAddress,
    abi: TycoonABI,
    functionName: 'addressToUsername',
    args: tycoonProfileOwnerAddress ? [tycoonProfileOwnerAddress] : undefined,
    query: { enabled: !!tycoonProfileOwnerAddress && !!tycoonAddress },
  });

  const {
    data: playerData,
    isLoading: playerDataLoading,
    error: playerDataReadError,
  } = useReadContract({
    address: tycoonAddress,
    abi: TycoonABI,
    functionName: 'getUser',
    args: username ? [username as string] : undefined,
    query: { enabled: !!username && !!tycoonAddress },
  });

  // Owned Collectibles
  const rewardOwnerAddress = (activeWalletView === 'smart' ? smartWallet : walletAddress) ?? walletAddress;
  const ownedCount = useReadContract({
    address: rewardAddress,
    abi: RewardABI,
    functionName: 'ownedTokenCount',
    args: rewardOwnerAddress ? [rewardOwnerAddress] : undefined,
    query: { enabled: !!rewardOwnerAddress && !!rewardAddress },
  });

  const ownedCountNum = Number(ownedCount.data ?? 0);

  const tokenCalls = useMemo(() =>
    Array.from({ length: ownedCountNum }, (_, i) => ({
      address: rewardAddress!,
      abi: RewardABI as Abi,
      functionName: 'tokenOfOwnerByIndex',
      args: [rewardOwnerAddress!, BigInt(i)],
    } as const)),
  [rewardAddress, rewardOwnerAddress, ownedCountNum]);

  const tokenResults = useReadContracts({
    contracts: tokenCalls,
    query: { enabled: ownedCountNum > 0 && !!rewardAddress && !!rewardOwnerAddress },
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
      functionName: 'voucherRedeemValue',
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
      return {
        tokenId: voucherTokenIds[i],
        value: formatUnits(res.result as bigint, 18),
      };
    }).filter((v): v is NonNullable<typeof v> => v !== null) ?? [];
  }, [voucherInfoResults.data, voucherTokenIds]);

  const isLoadingPerks =
    ownedCount.isLoading ||
    (ownedCountNum > 0 && tokenResults.isLoading) ||
    (allOwnedTokenIds.length > 0 && infoResults.isLoading);
  const isLoadingVouchers =
    ownedCount.isLoading ||
    (ownedCountNum > 0 && tokenResults.isLoading) ||
    (voucherTokenIds.length > 0 && voucherInfoResults.isLoading);

  useEffect(() => {
    setError(null);
    setUserData(null);
    setLoading(true);
  }, [walletAddress]);

  useEffect(() => {
    if (!isConnected) return;

    if (usernameReadError) {
      setError(usernameReadError instanceof Error ? usernameReadError.message : 'Failed to load username');
      setLoading(false);
      return;
    }
    if (playerDataReadError) {
      setError(playerDataReadError instanceof Error ? playerDataReadError.message : 'Failed to load player data');
      setLoading(false);
      return;
    }

    if (!usernameLoading && !username) {
      setError('No on-chain profile found for this address. Ensure you are on the correct network and registered.');
      setLoading(false);
      return;
    }

    if (username && playerData) {
      const parsed = parseUserFromContract(playerData, username as string, walletAddress);
      if (parsed) setUserData(parsed);
      setLoading(false);
      return;
    }

    if (username && !playerDataLoading && (playerData == null)) {
      setError('No player data found');
      setLoading(false);
      return;
    }
  }, [isConnected, username, usernameLoading, usernameReadError, playerData, playerDataLoading, playerDataReadError, walletAddress]);

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
      setSelectedPerkForTransfer(null);
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

  const { guestUser } = useGuestAuthOptional() ?? {};
  if (!isConnected || loading || error || !userData) {
    if (guestUser && !isConnected) {
      return <GuestProfileViewMobile guestUser={guestUser} />;
    }
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
    <div className="min-h-screen text-[#F0F7F7] pb-24 profile-page">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />

      <div className="fixed inset-0 -z-10 bg-[#030c0d]" />
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-cyan-950/20 via-transparent to-transparent" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(0,240,255,0.06),transparent_50%)]" />

      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#030c0d]/95 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-4 max-w-xl mx-auto">
          <Link href="/" className="flex items-center gap-2 text-cyan-300/90 hover:text-cyan-200 transition text-sm font-medium">
            <span className="w-9 h-9 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <ArrowLeft size={20} />
            </span>
            Back
          </Link>
          <h1 className="text-base font-semibold text-white/90 tracking-tight">My Profile</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="px-4 pt-6 max-w-xl mx-auto space-y-5">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative rounded-2xl overflow-hidden profile-hero-mobile"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-teal-500/10" />
          <div className="absolute inset-0 border border-cyan-500/15 rounded-2xl" />
          <div className="relative p-5 flex flex-col items-center text-center">
            <div className="relative group mb-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative w-24 h-24 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,240,255,0.12)] block"
              >
                {profile?.avatar ? (
                  <img src={profile.avatar} alt="Profile" className="w-full h-full object-cover aspect-square" />
                ) : (
                  <Image src={avatar} alt="Avatar" width={88} height={88} className="w-full h-full object-cover aspect-square" />
                )}
                <span className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="w-10 h-10 rounded-full bg-cyan-500/30 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-white" />
                  </span>
                </span>
              </button>
              <div className="absolute -bottom-1.5 -right-1.5 w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow border-2 border-[#030c0d]">
                <Crown className="w-4 h-4 text-black" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {userData.username}
            </h2>
            {displayName && <p className="text-cyan-300/80 text-xs mt-0.5">"{displayName}"</p>}
            {userData.registeredAt > 0 && (
              <p className="text-slate-500 text-[10px] mt-1">
                Member since {new Date(userData.registeredAt * 1000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
              </p>
            )}
            <button
              type="button"
              onClick={copyAddress}
              className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-xs w-full max-w-[260px] justify-center hover:border-cyan-500/20 hover:text-cyan-300/80 transition"
            >
              <span className="font-mono truncate">{userData.shortAddress || walletAddress}</span>
              {copied ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
            </button>
            <p className="mt-2 text-slate-500 text-[10px] flex items-center justify-center gap-1.5 flex-wrap">
              <span>Smart wallet:</span>
              {smartWalletAddress && smartWalletAddress !== '0x0000000000000000000000000000000000000000' ? (
                <>
                  <span className="font-mono text-cyan-300/90">{`${smartWalletAddress.slice(0, 6)}...${smartWalletAddress.slice(-4)}`}</span>
                  <button type="button" onClick={() => { navigator.clipboard.writeText(smartWalletAddress); toast.success('Copied'); }} aria-label="Copy"><Copy className="w-3 h-3" /></button>
                </>
              ) : (
                <span className="italic">— (register in-game to get one)</span>
              )}
            </p>
          </div>
        </motion.div>

        {/* Balances */}
        {showDualWallets ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setActiveWalletView('connected')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  activeWalletView === 'connected'
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white/80'
                }`}
              >
                Connected
              </button>
              <button
                type="button"
                onClick={() => setActiveWalletView('smart')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  activeWalletView === 'smart'
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white/80'
                }`}
              >
                Smart
              </button>
            </div>
            <div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: 'TYC',
                    value:
                      activeWalletView === 'smart'
                        ? (tycBalanceSmart.isLoading ? '...' : Number(tycBalanceSmart.data?.formatted || 0).toFixed(2))
                        : (tycBalance.isLoading ? '...' : Number(tycBalance.data?.formatted || 0).toFixed(2)),
                  },
                  {
                    label: 'USDC',
                    value:
                      activeWalletView === 'smart'
                        ? (usdcBalanceSmart.isLoading ? '...' : Number(usdcBalanceSmart.data?.formatted || 0).toFixed(2))
                        : (usdcBalance.isLoading ? '...' : Number(usdcBalance.data?.formatted || 0).toFixed(2)),
                  },
                  {
                    label: chainId === 137 || chainId === 80001 ? 'Polygon' : chainId === 42220 || chainId === 44787 ? 'Celo' : chainId === 8453 || chainId === 84531 ? 'Base' : 'Native',
                    value:
                      activeWalletView === 'smart'
                        ? (ethBalanceSmart ? Number(ethBalanceSmart.formatted).toFixed(4) : '0')
                        : (ethBalance ? Number(ethBalance.formatted).toFixed(4) : '0'),
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="profile-card rounded-xl p-3 text-center border border-white/10">
                    <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">{label}</p>
                    <p className="text-sm font-bold text-white truncate mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'TYC', value: tycBalance.isLoading ? '...' : Number(tycBalance.data?.formatted || 0).toFixed(2) },
              { label: 'USDC', value: usdcBalance.isLoading ? '...' : Number(usdcBalance.data?.formatted || 0).toFixed(2) },
              { label: chainId === 137 || chainId === 80001 ? 'Polygon' : chainId === 42220 || chainId === 44787 ? 'Celo' : chainId === 8453 || chainId === 84531 ? 'Base' : 'Native', value: ethBalance ? Number(ethBalance.formatted).toFixed(4) : '0' },
            ].map(({ label, value }) => (
              <div key={label} className="profile-card rounded-xl p-3 text-center border border-white/10">
                <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-bold text-white truncate mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Game stats | About | Perks | Vouchers — one line of tabs, content below */}
        <section className="pb-4">
          <div className="flex gap-1.5 mb-3">
            {[
              { id: 'stats' as const, label: 'Stats', icon: BarChart2 },
              { id: 'about' as const, label: 'About', icon: User },
              { id: 'perks' as const, label: 'Perks', icon: ShoppingBag, badge: ownedCollectibles.length },
              { id: 'vouchers' as const, label: 'Vouchers', icon: Ticket, badge: myVouchers.length },
            ].map(({ id, label, icon: Icon, badge }) => (
              <button
                key={id}
                type="button"
                onClick={() => setProfileTab(id)}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2.5 px-1.5 rounded-xl font-semibold text-[11px] transition-all ${
                  profileTab === id
                    ? 'bg-cyan-500/20 border-2 border-cyan-500/50 text-cyan-200'
                    : 'bg-white/5 border border-white/10 text-white/70'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="flex items-center gap-1 min-w-0 justify-center flex-wrap">
                  <span className="text-center leading-tight break-words">{label}</span>
                  {badge !== undefined && badge > 0 && (
                    <span className="shrink-0 min-w-[1rem] h-4 px-1 rounded text-[10px] flex items-center justify-center bg-white/10">{badge}</span>
                  )}
                </span>
              </button>
            ))}
          </div>

          <div className="profile-card rounded-2xl border border-white/10 overflow-hidden min-h-[220px] max-h-[50vh] overflow-y-auto">
            {profileTab === 'stats' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
                <FirstTimeHint
                  storageKey="profile_stats"
                  message="Your stats and level progress live here. Claim rewards after games from the results screen."
                  link={{ href: '/how-to-play', label: 'How to Play' }}
                  compact
                  className="mb-4"
                />
                <div className="mb-4">
                  <DailyClaim
                    chain={
                      chainId === 137 || chainId === 80001
                        ? 'POLYGON'
                        : chainId === 42220 || chainId === 44787
                          ? 'CELO'
                          : 'BASE'
                    }
                  />
                </div>
                {userData && (() => {
                  const levelInfo = getLevelFromActivity({ gamesPlayed: userData.gamesPlayed, gamesWon: userData.gamesWon });
                  return (
                    <div className="mb-3 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] font-medium text-cyan-400/90 uppercase tracking-widest">Level</span>
                        <span className="font-bold text-cyan-300 text-sm">Level {levelInfo.level} · {levelInfo.label}</span>
                      </div>
                      {levelInfo.level < 99 && levelInfo.xpForNextLevel > 0 && (
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-cyan-500/80 transition-all duration-500"
                            style={{ width: `${Math.round(levelInfo.progress * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                  <div className="profile-card rounded-xl p-3 flex flex-col items-center gap-0.5 border border-white/10">
                    <BarChart2 className="w-4 h-4 text-cyan-400" />
                    <p className="text-[10px] text-white/50">Games</p>
                    <p className="text-sm font-bold text-white">{userData.gamesPlayed}</p>
                  </div>
                  <div className="profile-card rounded-xl p-3 flex flex-col items-center gap-0.5 border border-white/10">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <p className="text-[10px] text-white/50">Wins</p>
                    <p className="text-sm font-bold text-amber-300">{userData.gamesWon}</p>
                  </div>
                  <div className="profile-card rounded-xl p-3 flex flex-col items-center gap-0.5 border border-white/10">
                    <Coins className="w-4 h-4 text-slate-400" />
                    <p className="text-[10px] text-white/50">Losses</p>
                    <p className="text-sm font-bold text-slate-300">{userData.gamesLost}</p>
                  </div>
                  <div className="profile-card rounded-xl p-3 flex flex-col items-center gap-0.5 border border-white/10">
                    <BarChart2 className="w-4 h-4 text-emerald-400" />
                    <p className="text-[10px] text-white/50">Win rate</p>
                    <p className="text-sm font-bold text-emerald-300">{userData.winRate}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="profile-card rounded-xl p-2.5 text-center border border-white/10">
                    <p className="text-[9px] text-white/50">Staked</p>
                    <p className="text-xs font-bold text-white truncate">{formatStakeOrEarned(userData.totalStaked)}</p>
                  </div>
                  <div className="profile-card rounded-xl p-2.5 text-center border border-white/10">
                    <p className="text-[9px] text-white/50">Earned</p>
                    <p className="text-xs font-bold text-emerald-300 truncate">{formatStakeOrEarned(userData.totalEarned)}</p>
                  </div>
                  <div className="profile-card rounded-xl p-2.5 text-center border border-white/10">
                    <p className="text-[9px] text-white/50">Withdrawn</p>
                    <p className="text-xs font-bold text-slate-300 truncate">{formatStakeOrEarned(userData.totalWithdrawn)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="profile-card rounded-xl p-2.5 flex items-center justify-center gap-2 border border-white/10">
                    <p className="text-[9px] text-white/50">Props bought</p>
                    <p className="text-sm font-bold text-cyan-300">{userData.propertiesBought}</p>
                  </div>
                  <div className="profile-card rounded-xl p-2.5 flex items-center justify-center gap-2 border border-white/10">
                    <p className="text-[9px] text-white/50">Props sold</p>
                    <p className="text-sm font-bold text-amber-300">{userData.propertiesSold}</p>
                  </div>
                </div>
              </motion.div>
            )}
            {profileTab === 'about' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
                <p className="text-[10px] font-medium text-cyan-400/90 uppercase tracking-widest mb-4">About you</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1.5">Display name</label>
                    <div className="flex gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 focus-within:border-cyan-500/30 transition-colors">
                      <User className="w-4 h-4 text-cyan-400/80 shrink-0 mt-0.5" />
                      <input
                        type="text"
                        placeholder="How should we call you?"
                        value={localDisplayName}
                        onChange={(e) => setLocalDisplayName(e.target.value)}
                        onBlur={saveDisplayName}
                        className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1819] rounded text-sm min-w-0"
                      />
                      <button type="button" onClick={saveDisplayName} className="shrink-0 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 text-xs font-semibold">Save</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/70 mb-1.5">Short bio</label>
                    {editingBio ? (
                      <div className="rounded-xl bg-white/5 border border-cyan-500/30 px-3 py-2.5">
                        <textarea
                          placeholder="A line or two about you."
                          value={localBio}
                          onChange={(e) => setLocalBio(e.target.value)}
                          rows={3}
                          className="w-full bg-transparent text-white placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1819] rounded text-sm resize-none leading-relaxed"
                          autoFocus
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <button type="button" onClick={() => setEditingBio(false)} className="px-3 py-1.5 rounded-lg bg-white/10 text-white/80 text-xs font-semibold">Cancel</button>
                          <button type="button" onClick={() => { saveBio(); setEditingBio(false); }} className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 text-xs font-semibold">Save bio</button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 flex items-start justify-between gap-2">
                        <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap break-words flex-1 min-w-0">
                          {localBio.trim() || <span className="text-slate-500">No bio yet.</span>}
                        </p>
                        <button type="button" onClick={() => setEditingBio(true)} className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 text-white/80 hover:bg-cyan-500/20 hover:text-cyan-300 text-xs font-medium">
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {profileTab === 'perks' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
                {isLoadingPerks ? (
                  <>
                    <p className="text-slate-400 text-sm text-center mb-3">Loading perks…</p>
                    <SkeletonPerkGrid count={4} gridClass="grid grid-cols-2 gap-3" />
                  </>
                ) : ownedCollectibles.length === 0 ? (
                  <EmptyState
                    icon={<ShoppingBag className="w-12 h-12 text-purple-400/70" />}
                    title="No perks yet"
                    description="Perks give you in-game advantages. Buy them in the Perk Shop or during a game from My Perks."
                    action={{ label: 'Visit Perk Shop', href: '/game-shop' }}
                    compact
                    className="border-purple-500/20 bg-black/20 py-6"
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {ownedCollectibles.map((item) => (
                      <motion.div
                        key={item.tokenId.toString()}
                        whileTap={{ scale: 0.98 }}
                        className={`rounded-xl p-4 text-center border transition-all bg-black/20 ${
                          selectedPerkForTransfer === item.tokenId ? 'border-purple-500/50 ring-2 ring-purple-500/20' : 'border-white/10'
                        }`}
                      >
                        {item.icon}
                        <h4 className="mt-2 font-semibold text-white text-sm">{item.name}</h4>
                        {item.isTiered && item.strength > 0 && <p className="text-cyan-300/90 text-[10px] mt-0.5">Tier {item.strength}</p>}
                        {selectedPerkForTransfer === item.tokenId ? (
                          <div className="mt-3 space-y-2 text-left">
                            <p className="text-[10px] text-white/50 uppercase tracking-wider">Send to</p>
                            <input
                              type="text"
                              placeholder="0x0000...0000"
                              value={sendAddress}
                              onChange={(e) => setSendAddress(e.target.value.trim())}
                              className="w-full px-2.5 py-2 rounded-lg bg-black/40 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-[11px] border border-white/10"
                            />
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleSend(item.tokenId)}
                                disabled={!sendAddress || !/^0x[a-fA-F0-9]{40}$/i.test(sendAddress) || sendingTokenId === item.tokenId || isWriting || isConfirming}
                                className="flex-1 py-2 rounded-lg font-medium text-[11px] bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-50 flex items-center justify-center gap-1 text-white"
                              >
                                {sendingTokenId === item.tokenId && (isWriting || isConfirming) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                {sendingTokenId === item.tokenId && (isWriting || isConfirming) ? '...' : 'Send'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedPerkForTransfer(null)}
                                className="px-2.5 py-2 rounded-lg font-medium text-[11px] bg-white/10 text-white/80"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedPerkForTransfer(item.tokenId)}
                            className="mt-3 w-full py-2 rounded-lg font-medium text-xs bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center gap-1 text-white"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Transfer
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {profileTab === 'vouchers' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
                {isLoadingVouchers ? (
                  <>
                    <p className="text-slate-400 text-sm text-center mb-3">Loading vouchers…</p>
                    <div className="grid grid-cols-2 gap-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <SkeletonCard key={i} hasImage={false} lines={2} className="rounded-xl p-4 border border-amber-500/20" />
                      ))}
                    </div>
                  </>
                ) : myVouchers.length === 0 ? (
                  <EmptyState
                    icon={<Ticket className="w-12 h-12 text-amber-400/70" />}
                    title="No vouchers yet"
                    description="Win games to earn reward vouchers and redeem them here."
                    compact
                    className="border-amber-500/20 bg-black/20 py-6"
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {myVouchers.map((voucher) => (
                      <div
                        key={voucher.tokenId.toString()}
                        className="profile-card rounded-xl p-4 border border-amber-500/20 text-center"
                      >
                        <Ticket className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                        <p className="text-lg font-bold text-amber-200 mb-3">{voucher.value} TYC</p>
                        <button
                          onClick={() => handleRedeemVoucher(voucher.tokenId)}
                          disabled={redeemingId === voucher.tokenId || isWriting || isConfirming}
                          className="w-full py-2 rounded-lg font-medium text-xs bg-gradient-to-r from-amber-600 to-orange-600 disabled:opacity-50 flex items-center justify-center gap-1 text-black"
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
          </div>
        </section>
      </main>

      <style jsx global>{`
        .profile-page .profile-hero-mobile {
          background: linear-gradient(135deg, rgba(6, 78, 89, 0.2) 0%, rgba(4, 47, 46, 0.15) 50%, rgba(15, 23, 42, 0.35) 100%);
          backdrop-filter: blur(14px);
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 240, 255, 0.08);
        }
        .profile-page .profile-card {
          background: rgba(15, 23, 42, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(12px);
        }
      `}</style>
    </div>
  );
}