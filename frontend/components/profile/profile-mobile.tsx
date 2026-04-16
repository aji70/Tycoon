'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { 
  BarChart2, Crown, Coins, Wallet, Ticket, ShoppingBag, 
  Loader2, Send, ChevronDown, ChevronUp, ArrowLeft, Camera, Copy, Check, User, FileText, Pencil 
} from 'lucide-react';
import Link from 'next/link';
import avatar from '@/public/avatar.jpg';
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { type Address } from 'viem';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { useProfileForAddress } from '@/context/ProfileContext';
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
import { useMergedProfileRewardAssets } from '@/hooks/useMergedProfileRewardAssets';
import { getPerkShopAsset } from '@/lib/perkShopAssets';
import { ProfilePerkCardImage } from '@/components/profile/ProfilePerkCardImage';
import ProfileReferralCard from '@/components/profile/ProfileReferralCard';

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

const CELO_CHAIN_ID = 42220;

function chainIdToLeaderboardChain(chainId: number): string {
  switch (chainId) {
    case 137:
    case 80001:
      return 'POLYGON';
    case 42220:
    case 44787:
      return 'CELO';
    case 8453:
    case 84531:
      return 'BASE';
    default:
      return 'CELO';
  }
}

const zeroAddress = '0x0000000000000000000000000000000000000000' as Address;
const isValidWallet = (a: unknown): a is Address => {
  if (!a || typeof a !== 'string') return false;
  const s = a.trim();
  if (!s) return false;
  return s.toLowerCase() !== zeroAddress.toLowerCase();
};

/** DB row key for `/users/by-address` — must match guest profile (linked or account address, not smart wallet alone). */
function backendUserStatsLookupAddress(
  guestUser: { address?: string; linked_wallet_address?: string | null } | null | undefined,
  gameLookupAddress: string | undefined | null,
  walletAddress: string | undefined | null
): string | undefined {
  if (guestUser) {
    if (guestUser.linked_wallet_address && isValidWallet(guestUser.linked_wallet_address)) {
      return guestUser.linked_wallet_address.trim();
    }
    if (guestUser.address) return guestUser.address.trim();
  }
  return (gameLookupAddress ?? walletAddress) ?? undefined;
}

/** Guest/Privy profile when wallet is not connected, or when a connected extension wallet is not the Tycoon-registered address (notice only if wallet not registered — smart/linked users see no banner). */
function GuestProfileViewMobile({
  guestUser,
  connectedWalletMismatchNotice,
}: {
  guestUser: {
    address: string;
    username: string;
    linked_wallet_address?: string | null;
    smart_wallet_address?: string | null;
    legacy_smart_wallet_address?: string | null;
    smart_wallet_migration_status?: string | null;
    smart_wallet_migration_report?: string | null;
  };
  /** Shown when the connected extension wallet is not registered for this account yet (prompt to link). Omitted when user already has smart/linked wallet — perks use those silently. */
  connectedWalletMismatchNotice?: string | null;
}) {
  const username = guestUser.username;
  // When wallet is not connected: use Wallet linked (Account & login) for on-chain stats when available.
  const linkedWalletAddress =
    guestUser.linked_wallet_address && isValidWallet(guestUser.linked_wallet_address)
      ? (guestUser.linked_wallet_address as Address)
      : null;
  const smartWalletAddress =
    guestUser.smart_wallet_address && isValidWallet(guestUser.smart_wallet_address)
      ? (guestUser.smart_wallet_address as Address)
      : null;

  const guestOnChainAddress = linkedWalletAddress ?? smartWalletAddress ?? null;
  const guestGameLookupAddress = smartWalletAddress ?? linkedWalletAddress ?? null;
  const profileKeyAddress = linkedWalletAddress ?? smartWalletAddress ?? guestUser.address;
  const { profile, setAvatar, setDisplayName, setBio, setProfile } = useProfileForAddress(profileKeyAddress);

  const [profileTab, setProfileTab] = useState<'stats' | 'about' | 'perks' | 'vouchers'>('stats');
  const [localDisplayName, setLocalDisplayName] = useState('');
  const [localBio, setLocalBio] = useState('');
  const [editingBio, setEditingBio] = useState(false);
  const [redeemingId, setRedeemingId] = useState<bigint | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
          toast.success('Profile photo updated!');
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
  const tycoonAddress = TYCOON_CONTRACT_ADDRESSES[CELO_CHAIN_ID];
  const rewardAddress = REWARD_CONTRACT_ADDRESSES[CELO_CHAIN_ID] as Address | undefined;

  const shortLinkedWalletAddress = linkedWalletAddress
    ? `${linkedWalletAddress.slice(0, 6)}...${linkedWalletAddress.slice(-4)}`
    : null;
  const shortSmartWalletAddress = smartWalletAddress
    ? `${smartWalletAddress.slice(0, 6)}...${smartWalletAddress.slice(-4)}`
    : null;
  const showSmartBalances =
    !!smartWalletAddress &&
    (!linkedWalletAddress || smartWalletAddress.toLowerCase() !== linkedWalletAddress.toLowerCase());
  const showDualGuestBalances = !!linkedWalletAddress && showSmartBalances;
  const [guestBalanceTab, setGuestBalanceTab] = useState<'connected' | 'smart'>('smart');
  useEffect(() => {
    if (!showSmartBalances) setGuestBalanceTab('connected');
    else if (!linkedWalletAddress) setGuestBalanceTab('smart');
  }, [linkedWalletAddress, showSmartBalances]);
  const viewingConnected =
    !!linkedWalletAddress && (!showDualGuestBalances || guestBalanceTab === 'connected');
  const viewingSmart = showSmartBalances && (!showDualGuestBalances || guestBalanceTab === 'smart');

  const { data: tycTokenAddress } = useReadContract({
    address: rewardAddress,
    abi: RewardABI,
    functionName: 'tycToken',
    chainId: CELO_CHAIN_ID,
    query: { enabled: !!rewardAddress },
  });
  const { data: usdcTokenAddress } = useReadContract({
    address: rewardAddress,
    abi: RewardABI,
    functionName: 'usdc',
    chainId: CELO_CHAIN_ID,
    query: { enabled: !!rewardAddress },
  });

  const tycBalanceLinked = useBalance({
    address: linkedWalletAddress ?? undefined,
    token: (tycTokenAddress as Address | undefined) ?? undefined,
    chainId: CELO_CHAIN_ID,
    query: { enabled: !!linkedWalletAddress && !!tycTokenAddress },
  });
  const usdcBalanceLinked = useBalance({
    address: linkedWalletAddress ?? undefined,
    token: (usdcTokenAddress as Address | undefined) ?? undefined,
    chainId: CELO_CHAIN_ID,
    query: { enabled: !!linkedWalletAddress && !!usdcTokenAddress },
  });
  const nativeBalanceLinked = useBalance({
    address: linkedWalletAddress ?? undefined,
    chainId: CELO_CHAIN_ID,
    query: { enabled: !!linkedWalletAddress },
  });

  const tycBalanceSmart = useBalance({
    address: smartWalletAddress ?? undefined,
    token: (tycTokenAddress as Address | undefined) ?? undefined,
    chainId: CELO_CHAIN_ID,
    query: { enabled: !!smartWalletAddress && !!tycTokenAddress },
  });
  const usdcBalanceSmart = useBalance({
    address: smartWalletAddress ?? undefined,
    token: (usdcTokenAddress as Address | undefined) ?? undefined,
    chainId: CELO_CHAIN_ID,
    query: { enabled: !!smartWalletAddress && !!usdcTokenAddress },
  });
  const nativeBalanceSmart = useBalance({
    address: smartWalletAddress ?? undefined,
    chainId: CELO_CHAIN_ID,
    query: { enabled: !!smartWalletAddress },
  });

  const { data: onChainUsername } = useReadContract({
    address: tycoonAddress,
    abi: TycoonABI,
    functionName: 'addressToUsername',
    args: guestGameLookupAddress ? [guestGameLookupAddress] : undefined,
    query: { enabled: !!guestGameLookupAddress && !!tycoonAddress },
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

  const { data: offChainUserData } = useQuery({
    queryKey: ['off-chain-user', guestUser?.address, guestUser?.linked_wallet_address],
    queryFn: async () => {
      try {
        const addr = guestUser!.linked_wallet_address || guestUser!.address;
        const res = await apiClient.get(`/users/by-address/${addr}`, { params: { chain: 'CELO' } });
        return res.data;
      } catch (e) {
        return null;
      }
    },
    enabled: !!(guestUser?.address || guestUser?.linked_wallet_address),
  });

  const displayStats = React.useMemo(() => {
    const offChain = offChainUserData as {
      id?: number; games_played?: number; game_won?: number; game_lost?: number;
      celo_games_played?: number; celo_games_won?: number;
      total_staked?: number; total_earned?: number; total_withdrawn?: number;
      properties_bought?: number; properties_sold?: number;
      username?: string;
      created_at?: string;
    } | undefined;
    const gpBackend = Number(offChain?.celo_games_played) > 0 ? Number(offChain.celo_games_played) : Number(offChain?.games_played) ?? 0;
    const backendHasStats = offChain?.id && (gpBackend > 0 || Number(offChain.total_earned) > 0);
    const contractEmpty = userData && userData.gamesPlayed === 0 && userData.totalStaked === 0 && userData.totalEarned === 0;
    // When contract returns all zeros but backend has stats (leaderboard source), prefer backend.
    if (contractEmpty && backendHasStats) {
      const gp = gpBackend;
      const gw = Number(offChain.celo_games_won) > 0 ? Number(offChain.celo_games_won) : Number(offChain.game_won) || 0;
      const gl = Number(offChain.game_lost) || 0;
      return {
         ...userData!,
         gamesPlayed: gp,
         gamesWon: gw,
         gamesLost: gl,
         winRate: gp > 0 ? ((gw / gp) * 100).toFixed(1) + '%' : '0%',
         totalStaked: Number(offChain.total_staked) || 0,
         totalEarned: Number(offChain.total_earned) || 0,
         totalWithdrawn: Number(offChain.total_withdrawn) || 0,
         propertiesBought: Number(offChain.properties_bought ?? userData!.propertiesBought),
         propertiesSold: Number(offChain.properties_sold ?? userData!.propertiesSold),
         isOnChain: false,
      };
    }
    if (userData) {
      if (offChain?.id != null) {
        return {
          ...userData,
          propertiesBought: Number(offChain.properties_bought ?? userData.propertiesBought),
          propertiesSold: Number(offChain.properties_sold ?? userData.propertiesSold),
          isOnChain: true,
        };
      }
      return { ...userData, isOnChain: true };
    }
    if (backendHasStats) {
      const gp = gpBackend;
      const gw = Number(offChain!.celo_games_won) > 0 ? Number(offChain!.celo_games_won) : Number(offChain!.game_won) || 0;
      const gl = Number(offChain.game_lost) || 0;
      const chainName =
        typeof onChainUsername === 'string' && onChainUsername.trim() ? onChainUsername.trim() : '';
      return {
         username: chainName || offChain.username || guestUser!.username,
         shortAddress: guestUser!.address ? `${guestUser!.address.slice(0, 6)}...${guestUser!.address.slice(-4)}` : '',
         gamesPlayed: gp,
         gamesWon: gw,
         gamesLost: gl,
         winRate: gp > 0 ? ((gw / gp) * 100).toFixed(1) + '%' : '0%',
         totalStaked: Number(offChain.total_staked) || 0,
         totalEarned: Number(offChain.total_earned) || 0,
         totalWithdrawn: Number(offChain.total_withdrawn) || 0,
         propertiesBought: Number(offChain.properties_bought ?? 0),
         propertiesSold: Number(offChain.properties_sold ?? 0),
         registeredAt: offChain.created_at ? new Date(offChain.created_at).getTime() / 1000 : 0,
         isOnChain: false,
      };
    }
    return null;
  }, [userData, offChainUserData, guestUser, onChainUsername]);

  const statsForDisplay = React.useMemo(() => {
    if (displayStats) return displayStats;
    return {
      username: guestUser.username,
      shortAddress: guestUser.address ? `${guestUser.address.slice(0, 6)}...${guestUser.address.slice(-4)}` : '',
      gamesPlayed: 0,
      gamesWon: 0,
      gamesLost: 0,
      winRate: '0%',
      totalStaked: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
      propertiesBought: 0,
      propertiesSold: 0,
      registeredAt: 0,
      isOnChain: false,
    };
  }, [displayStats, guestUser.username, guestUser.address]);

  const heroOnChainUsername = useMemo(() => {
    const u = statsForDisplay.username?.trim();
    return u || username;
  }, [statsForDisplay.username, username]);

  const {
    ownedCollectibles: mergedCollectibleRows,
    myVouchers,
    isLoadingPerks,
    isLoadingVouchers,
    refetchVouchers,
  } = useMergedProfileRewardAssets(rewardAddress, CELO_CHAIN_ID, [linkedWalletAddress, smartWalletAddress]);

  const ownedCollectibles = useMemo(
    () =>
      mergedCollectibleRows.map((row) => {
        const asset = getPerkShopAsset(row.perk);
        return {
          ...row,
          name: asset?.name ?? `Perk #${row.perk}`,
          icon: <ProfilePerkCardImage perk={row.perk} className="w-14 h-14" />,
          isTiered: row.perk === 5 || row.perk === 9,
        };
      }),
    [mergedCollectibleRows]
  );

  const groupedCollectibles = useMemo(() => {
    const byKey = new Map<string, { item: (typeof ownedCollectibles)[0]; count: number }>();
    for (const item of ownedCollectibles) {
      const key = `${item.perk}-${item.strength}-${item.heldBy.toLowerCase()}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        byKey.set(key, { item, count: 1 });
      }
    }
    return Array.from(byKey.values()).map(({ item, count }) => ({ ...item, count }));
  }, [ownedCollectibles]);

  const walletEoa = linkedWalletAddress ?? undefined;
  const smartWallet = smartWalletAddress ?? undefined;

  useEffect(() => {
    setLocalDisplayName(profile?.displayName ?? '');
    setLocalBio(profile?.bio ?? '');
  }, [profile?.displayName, profile?.bio]);

  const handleRedeemVoucherViaApi = useCallback(async (tokenId: bigint, voucherOwner?: Address) => {
    try {
      setRedeemingId(tokenId);
      await apiClient.post<ApiResponse>('/auth/redeem-voucher', {
        tokenId: tokenId.toString(),
        chain: 'CELO',
        ...(voucherOwner ? { voucher_owner: voucherOwner } : {}),
      });
      await tycBalanceLinked.refetch?.();
      await tycBalanceSmart.refetch?.();
      await refetchVouchers();
      toast.success('Voucher redeemed successfully!');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string; voucher_owner?: string | null } }; message?: string };
      const owner = err?.response?.data?.voucher_owner;
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to redeem voucher';
      toast.error(owner ? `${msg} (Owner: ${owner})` : msg);
    } finally {
      setRedeemingId(null);
    }
  }, [tycBalanceLinked, tycBalanceSmart, refetchVouchers]);

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

  const displayName = profile?.displayName?.trim() || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#010F10] via-[#0A1C1E] to-[#0E1415] px-4 pb-24 profile-page">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#030c0d]/90 backdrop-blur-xl py-4">
        <Link href="/" className="flex items-center gap-2 text-cyan-300/90 text-sm font-medium">
          <ArrowLeft className="w-5 h-5" /> Back
        </Link>
      </header>
      <main className="py-6 space-y-5">
        {connectedWalletMismatchNotice ? (
          <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100/90">
            {connectedWalletMismatchNotice}
          </div>
        ) : null}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        <div className="rounded-2xl border border-cyan-500/20 bg-[#011112]/80 p-4">
          <div className="relative group mb-3 flex items-center justify-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative w-20 h-20 rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(0,240,255,0.12)] border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-[#011112] block"
              aria-label="Update avatar"
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
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg border-2 border-[#011112]">
              <Crown className="w-4 h-4 text-black" />
            </div>
          </div>

          <h2 className="text-lg font-bold text-white mb-2 text-center">{heroOnChainUsername}</h2>
          {displayName && <p className="text-cyan-300/80 text-xs text-center mb-1">"{displayName}"</p>}
          {statsForDisplay.registeredAt > 0 ? (
            <p className="text-slate-500 text-[11px] text-center mb-2">
              Member since{' '}
              {new Date(statsForDisplay.registeredAt * 1000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </p>
          ) : null}
          {!guestOnChainAddress && (
            <p className="text-cyan-300/80 text-sm mb-4">Your progress is saved. Connect your wallet from the nav to link this account.</p>
          )}
          {(shortLinkedWalletAddress || shortSmartWalletAddress) && (
            <div className="flex flex-wrap items-center gap-2 mt-2 text-sm">
              {shortLinkedWalletAddress ? (
                <>
                  <span className="text-cyan-400 font-semibold text-xs">Connected wallet</span>
                  <span className="text-slate-300 font-mono text-xs truncate max-w-full">{shortLinkedWalletAddress}</span>
                </>
              ) : null}
              {shortSmartWalletAddress ? (
                <>
                  <span className="text-cyan-400 font-semibold text-xs">Smart wallet:</span>
                  <span className="text-slate-300 font-mono text-xs truncate max-w-full">{shortSmartWalletAddress}</span>
                </>
              ) : null}
            </div>
          )}

          {(linkedWalletAddress || showSmartBalances) && (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-2 py-2">
              {showDualGuestBalances ? (
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <button
                    type="button"
                    onClick={() => setGuestBalanceTab('connected')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition ${
                      guestBalanceTab === 'connected'
                        ? 'bg-cyan-500/20 border-cyan-500/45 text-cyan-200'
                        : 'bg-white/5 border-white/10 text-white/55'
                    }`}
                  >
                    Connected
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuestBalanceTab('smart')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition ${
                      guestBalanceTab === 'smart'
                        ? 'bg-cyan-500/20 border-cyan-500/45 text-cyan-200'
                        : 'bg-white/5 border-white/10 text-white/55'
                    }`}
                  >
                    Smart
                  </button>
                </div>
              ) : (
                <p className="text-[9px] font-medium uppercase tracking-wider text-white/40 mb-1.5 text-center">
                  {linkedWalletAddress ? 'Balances · connected' : 'Balances · smart wallet'}
                </p>
              )}
              {viewingConnected ? (
                <div className="flex gap-1.5">
                  {[
                    { label: 'TYC', value: tycBalanceLinked.isLoading ? '…' : Number(tycBalanceLinked.data?.formatted || 0).toFixed(2) },
                    { label: 'USDC', value: usdcBalanceLinked.isLoading ? '…' : Number(usdcBalanceLinked.data?.formatted || 0).toFixed(2) },
                    { label: 'Celo', value: nativeBalanceLinked.isLoading ? '…' : (nativeBalanceLinked.data ? Number(nativeBalanceLinked.data.formatted).toFixed(4) : '0') },
                  ].map(({ label, value }) => (
                    <div key={`gc-${label}`} className="flex-1 min-w-0 rounded-lg px-2 py-1.5 border border-white/10 bg-white/[0.04] text-center">
                      <p className="text-[8px] font-medium uppercase tracking-wider text-white/45 leading-none">{label}</p>
                      <p className="text-xs font-bold text-white truncate mt-0.5 tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {viewingSmart ? (
                <div className="flex gap-1.5">
                  {[
                    { label: 'TYC', value: tycBalanceSmart.isLoading ? '…' : Number(tycBalanceSmart.data?.formatted || 0).toFixed(2) },
                    { label: 'USDC', value: usdcBalanceSmart.isLoading ? '…' : Number(usdcBalanceSmart.data?.formatted || 0).toFixed(2) },
                    { label: 'Celo', value: nativeBalanceSmart.isLoading ? '…' : (nativeBalanceSmart.data ? Number(nativeBalanceSmart.data.formatted).toFixed(4) : '0') },
                  ].map(({ label, value }) => (
                    <div key={`gs-${label}`} className="flex-1 min-w-0 rounded-lg px-2 py-1.5 border border-white/10 bg-white/[0.04] text-center">
                      <p className="text-[8px] font-medium uppercase tracking-wider text-white/45 leading-none">{label}</p>
                      <p className="text-xs font-bold text-white truncate mt-0.5 tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {showSmartBalances && shortSmartWalletAddress ? (
            <Link
              href="/profile/smart-wallet"
              className="mt-2 inline-flex w-full items-center justify-center px-3 py-2 rounded-lg bg-cyan-500/12 hover:bg-cyan-500/20 border border-cyan-500/35 text-cyan-200 text-xs font-semibold transition"
            >
              Manage smart wallet
            </Link>
          ) : null}
        </div>

        {(guestUser.smart_wallet_migration_status || guestUser.legacy_smart_wallet_address) && (
          <div className="rounded-2xl border border-amber-500/20 bg-[#011112]/80 p-4">
            <h3 className="text-xs font-semibold text-amber-300 uppercase tracking-wider mb-2">Wallet migration</h3>
            <p className="text-xs text-white/70">
              Status: <span className="font-semibold text-white">{guestUser.smart_wallet_migration_status ?? 'unknown'}</span>
            </p>
            {guestUser.legacy_smart_wallet_address ? (
              <p className="text-[11px] text-white/60 mt-1 break-all">
                Legacy wallet: {guestUser.legacy_smart_wallet_address}
              </p>
            ) : null}
          </div>
        )}

        {/* Game stats | About you | My Perks | Reward Vouchers — tabs (visible without wallet connection) */}
        <section className="pb-4">
          <div className="flex gap-1 mb-3 flex-wrap">
            {[
              { id: 'stats' as const, label: 'Game stats', icon: BarChart2 },
              { id: 'about' as const, label: 'About you', icon: User },
              { id: 'perks' as const, label: 'My Perks', icon: ShoppingBag, badge: ownedCollectibles.length },
              { id: 'vouchers' as const, label: 'Reward Vouchers', icon: Ticket, badge: myVouchers.length },
            ].map(({ id, label, icon: Icon, badge }) => (
              <button
                key={id}
                type="button"
                onClick={() => setProfileTab(id)}
                className={`flex-1 min-w-[calc(50%-4px)] sm:min-w-0 sm:flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 rounded-xl font-semibold text-[10px] transition-all ${
                  profileTab === id
                    ? 'bg-cyan-500/20 border-2 border-cyan-500/50 text-cyan-200'
                    : 'bg-white/5 border border-white/10 text-white/70'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="flex items-center gap-1 min-w-0 justify-center flex-wrap text-center leading-tight">
                  <span className="break-words">{label}</span>
                  {badge !== undefined && (
                    <span className="shrink-0 min-w-[1rem] h-4 px-1 rounded text-[10px] flex items-center justify-center bg-white/10">{badge}</span>
                  )}
                </span>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 overflow-hidden min-h-[220px] max-h-[50vh] overflow-y-auto bg-[#011112]/80">
            {profileTab === 'stats' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
                <FirstTimeHint
                  storageKey="profile_stats_guest"
                  message="Your stats and level progress live here. Claim rewards after games from the results screen."
                  link={{ href: '/how-to-play', label: 'How to Play' }}
                  compact
                  className="mb-4"
                />
                <ProfileReferralCard className="mb-4" />
                <div className="mb-4">
                  <DailyClaim chain="CELO" />
                </div>
                {displayStats && !displayStats.isOnChain && (
                  <div className="mb-4 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 flex flex-col gap-1 text-orange-200">
                    <span className="text-xs font-semibold">Showing off-chain stats</span>
                    <span className="text-[10px] text-orange-200/80">Link your wallet to secure your progress on-chain.</span>
                  </div>
                )}
                {statsForDisplay && (() => {
                  const levelInfo = getLevelFromActivity({ gamesPlayed: statsForDisplay.gamesPlayed, gamesWon: statsForDisplay.gamesWon });
                  return (
                    <>
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
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                        <div className="profile-card rounded-xl p-3 flex flex-col items-center gap-0.5 border border-white/10">
                          <BarChart2 className="w-4 h-4 text-cyan-400" />
                          <p className="text-[10px] text-white/50">Games</p>
                          <p className="text-sm font-bold text-white">{statsForDisplay.gamesPlayed}</p>
                        </div>
                        <div className="profile-card rounded-xl p-3 flex flex-col items-center gap-0.5 border border-white/10">
                          <Crown className="w-4 h-4 text-amber-400" />
                          <p className="text-[10px] text-white/50">Wins</p>
                          <p className="text-sm font-bold text-amber-300">{statsForDisplay.gamesWon}</p>
                        </div>
                        <div className="profile-card rounded-xl p-3 flex flex-col items-center gap-0.5 border border-white/10">
                          <Coins className="w-4 h-4 text-slate-400" />
                          <p className="text-[10px] text-white/50">Losses</p>
                          <p className="text-sm font-bold text-slate-300">{statsForDisplay.gamesLost}</p>
                        </div>
                        <div className="profile-card rounded-xl p-3 flex flex-col items-center gap-0.5 border border-white/10">
                          <BarChart2 className="w-4 h-4 text-emerald-400" />
                          <p className="text-[10px] text-white/50">Win rate</p>
                          <p className="text-sm font-bold text-emerald-300">{statsForDisplay.winRate}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div className="profile-card rounded-xl p-2.5 text-center border border-white/10">
                          <p className="text-[9px] text-white/50">Staked</p>
                          <p className="text-xs font-bold text-white truncate">{formatStakeOrEarned(statsForDisplay.totalStaked)}</p>
                        </div>
                        <div className="profile-card rounded-xl p-2.5 text-center border border-white/10">
                          <p className="text-[9px] text-white/50">Earned</p>
                          <p className="text-xs font-bold text-emerald-300 truncate">{formatStakeOrEarned(statsForDisplay.totalEarned)}</p>
                        </div>
                        <div className="profile-card rounded-xl p-2.5 text-center border border-white/10">
                          <p className="text-[9px] text-white/50">Withdrawn</p>
                          <p className="text-xs font-bold text-slate-300 truncate">{formatStakeOrEarned(statsForDisplay.totalWithdrawn)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="profile-card rounded-xl p-2.5 flex items-center justify-center gap-2 border border-white/10">
                          <p className="text-[9px] text-white/50">Props bought</p>
                          <p className="text-sm font-bold text-cyan-300">{statsForDisplay.propertiesBought}</p>
                        </div>
                        <div className="profile-card rounded-xl p-2.5 flex items-center justify-center gap-2 border border-white/10">
                          <p className="text-[9px] text-white/50">Props sold</p>
                          <p className="text-sm font-bold text-amber-300">{statsForDisplay.propertiesSold}</p>
                        </div>
                      </div>
                    </>
                  );
                })()}
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
                <p className="text-[10px] text-white/50 mb-3 text-center">Connect a wallet from the menu to transfer perks on-chain.</p>
                {isLoadingPerks ? (
                  <>
                    <p className="text-slate-400 text-sm text-center mb-3">Loading perks…</p>
                    <SkeletonPerkGrid count={4} gridClass="grid grid-cols-2 gap-3" />
                  </>
                ) : groupedCollectibles.length === 0 ? (
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
                    {groupedCollectibles.map((item) => {
                      const rowKey = `${item.heldBy.toLowerCase()}-${item.perk}-${item.strength}`;
                      return (
                        <motion.div
                          key={rowKey}
                          whileTap={{ scale: 0.98 }}
                          className="rounded-xl p-4 text-center border transition-all bg-black/20 border-white/10"
                        >
                          <div className="relative inline-block">
                            {item.icon}
                            {item.count > 1 && (
                              <span className="absolute -top-1 -right-1 min-w-[1.125rem] h-4 px-1 flex items-center justify-center rounded-full bg-purple-500/90 text-white text-[10px] font-bold">
                                ×{item.count}
                              </span>
                            )}
                          </div>
                          <h4 className="mt-2 font-semibold text-white text-sm">{item.name}</h4>
                          {item.isTiered && item.strength > 0 && <p className="text-cyan-300/90 text-[10px] mt-0.5">Tier {item.strength}</p>}
                          {smartWallet && item.heldBy.toLowerCase() === smartWallet.toLowerCase() ? (
                            <p className="text-[9px] text-cyan-300/80 mt-1">Smart wallet</p>
                          ) : walletEoa && item.heldBy.toLowerCase() === walletEoa.toLowerCase() ? (
                            <p className="text-[9px] text-white/45 mt-1">Linked wallet</p>
                          ) : null}
                          <button
                            type="button"
                            disabled
                            className="mt-3 w-full py-2 rounded-lg font-medium text-xs bg-white/10 text-white/45 cursor-not-allowed flex items-center justify-center gap-1"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Connect wallet to transfer
                          </button>
                        </motion.div>
                      );
                    })}
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
                        key={`${voucher.heldBy}-${voucher.tokenId.toString()}`}
                        className="profile-card rounded-xl p-4 border border-amber-500/20 text-center"
                      >
                        <Ticket className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                        <p className="text-lg font-bold text-amber-200 mb-3">{voucher.value} TYC</p>
                        {smartWallet && voucher.heldBy.toLowerCase() === smartWallet.toLowerCase() ? (
                          <p className="text-[9px] text-amber-200/70 mb-2">Smart wallet</p>
                        ) : walletEoa && voucher.heldBy.toLowerCase() === walletEoa.toLowerCase() ? (
                          <p className="text-[9px] text-white/45 mb-2">Linked wallet</p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleRedeemVoucherViaApi(voucher.tokenId, voucher.heldBy)}
                          disabled={redeemingId === voucher.tokenId}
                          className="w-full py-2 rounded-lg font-medium text-xs bg-gradient-to-r from-amber-600 to-orange-600 disabled:opacity-50 flex items-center justify-center gap-1 text-black"
                        >
                          {redeemingId === voucher.tokenId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
                          {redeemingId === voucher.tokenId ? 'Redeeming...' : 'Redeem'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </section>

        <AccountLinkWallet />
      </main>

      <style jsx global>{`
        .profile-page .profile-card {
          background: rgba(15, 23, 42, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(12px);
        }
      `}</style>
    </div>
  );
}

export default function ProfilePageMobile() {
  const { address: walletAddress, isConnected, chainId } = useAccount();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendAddress, setSendAddress] = useState('');
  const [sendingTokenId, setSendingTokenId] = useState<bigint | null>(null);
  const [selectedPerkKey, setSelectedPerkKey] = useState<string | null>(null);
  const [redeemingId, setRedeemingId] = useState<bigint | null>(null);
  const [showVouchers, setShowVouchers] = useState(false);
  const [profileTab, setProfileTab] = useState<'stats' | 'about' | 'perks' | 'vouchers'>('stats');
  const [copied, setCopied] = useState(false);
  const [localDisplayName, setLocalDisplayName] = useState('');
  const [localBio, setLocalBio] = useState('');
  const [editingBio, setEditingBio] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { writeContract, data: txHash, isPending: isWriting, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const { data: ethBalance } = useBalance({ address: walletAddress });

  const { tycAddress: tycTokenAddress, usdcAddress: usdcTokenAddress } = useRewardTokenAddresses();
  const tycoonAddress = TYCOON_CONTRACT_ADDRESSES[chainId as keyof typeof TYCOON_CONTRACT_ADDRESSES];
  const rewardAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES] as Address | undefined;
  const guestAuth = useGuestAuthOptional();
  const { guestUser } = guestAuth ?? {};
  const refetchGuest = guestAuth?.refetchGuest;
  const { data: registrySmartWallet, refetch: refetchRegistryWallet } = useUserRegistryWallet(walletAddress);
  const connectedWalletIsLinked =
    !!guestUser &&
    !!walletAddress &&
    !!guestUser.linked_wallet_address &&
    isValidWallet(guestUser.linked_wallet_address) &&
    walletAddress.toLowerCase() === (guestUser.linked_wallet_address as string).toLowerCase();
  const accountSmartWallet = isValidWallet(guestUser?.smart_wallet_address)
    ? (guestUser!.smart_wallet_address as Address)
    : undefined;
  const smartWalletAddress =
    connectedWalletIsLinked && isValidWallet(accountSmartWallet)
      ? accountSmartWallet
      : isValidWallet(registrySmartWallet)
        ? (registrySmartWallet as Address)
        : accountSmartWallet;
  const smartWallet = smartWalletAddress;
  const hasSmartWalletFromCurrentRegistry =
    isValidWallet(registrySmartWallet) && (registrySmartWallet as string) !== "0x0000000000000000000000000000000000000000";
  const { data: smartWalletOwner } = useProfileOwner(smartWallet);
  const tycoonProfileOwnerAddress =
    (isValidWallet(smartWalletOwner) ? smartWalletOwner : null) ??
    walletAddress;
  const gameLookupAddress = smartWallet ?? tycoonProfileOwnerAddress;

  // Local avatar/displayName/bio should be keyed by the profile owner (linked EOA),
  // not by whichever wallet is currently connected (smart wallet).
  const { profile, setAvatar, setDisplayName, setBio, setProfile } = useProfileForAddress(tycoonProfileOwnerAddress);

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
    args: gameLookupAddress ? [gameLookupAddress] : undefined,
    query: { enabled: !!gameLookupAddress && !!tycoonAddress },
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

  const chainParam = chainIdToLeaderboardChain(chainId as number);
  const backendStatsAddress = backendUserStatsLookupAddress(guestUser, gameLookupAddress, walletAddress);
  const { data: backendUser } = useQuery({
    queryKey: ['user-by-address', backendStatsAddress, chainParam],
    queryFn: async () => {
      if (!backendStatsAddress) return null;
      try {
        const res = await apiClient.get(`/users/by-address/${backendStatsAddress}`, { params: { chain: chainParam } });
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: !!backendStatsAddress,
  });

  const {
    ownedCollectibles: mergedCollectibleRows,
    myVouchers,
    isLoadingPerks,
    isLoadingVouchers,
    refetchVouchers,
  } = useMergedProfileRewardAssets(rewardAddress, chainId, [walletAddress, smartWallet]);

  const ownedCollectibles = useMemo(
    () =>
      mergedCollectibleRows.map((row) => {
        const asset = getPerkShopAsset(row.perk);
        return {
          ...row,
          name: asset?.name ?? `Perk #${row.perk}`,
          icon: <ProfilePerkCardImage perk={row.perk} className="w-14 h-14" />,
          isTiered: row.perk === 5 || row.perk === 9,
        };
      }),
    [mergedCollectibleRows]
  );

  const groupedCollectibles = useMemo(() => {
    const byKey = new Map<string, { item: (typeof ownedCollectibles)[0]; count: number }>();
    for (const item of ownedCollectibles) {
      const key = `${item.perk}-${item.strength}-${item.heldBy.toLowerCase()}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        byKey.set(key, { item, count: 1 });
      }
    }
    return Array.from(byKey.values()).map(({ item, count }) => ({ ...item, count }));
  }, [ownedCollectibles]);

  useEffect(() => {
    setError(null);
    setUserData(null);
    setLoading(true);
  }, [walletAddress, smartWallet]);

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
      const parsed = parseUserFromContract(playerData, username as string, tycoonProfileOwnerAddress);
      if (parsed) setUserData(parsed);
      setLoading(false);
      return;
    }

    if (username && !playerDataLoading && (playerData == null)) {
      setError('No player data found');
      setLoading(false);
      return;
    }
  }, [isConnected, username, usernameLoading, usernameReadError, playerData, playerDataLoading, playerDataReadError, walletAddress, tycoonProfileOwnerAddress]);

  const effectiveUserData = useMemo(() => {
    if (!userData) return null;
    const backend = backendUser as {
      id?: number;
      games_played?: number; game_won?: number; game_lost?: number;
      celo_games_played?: number; celo_games_won?: number;
      base_games_played?: number; base_games_won?: number;
      total_staked?: number; total_earned?: number; total_withdrawn?: number;
      properties_bought?: number;
      properties_sold?: number;
    } | undefined;
    const applyBackendPropertyStats = (base: NonNullable<typeof userData>) => {
      if (backend == null || backend.id == null) return base;
      return {
        ...base,
        propertiesBought: Number(backend.properties_bought ?? base.propertiesBought),
        propertiesSold: Number(backend.properties_sold ?? base.propertiesSold),
      };
    };
    const contractEmpty =
      userData.gamesPlayed === 0 && userData.totalStaked === 0 && userData.totalEarned === 0;
    const isCelo = chainParam === 'CELO';
    const gp = isCelo && Number(backend?.celo_games_played) > 0 ? Number(backend.celo_games_played) : Number(backend?.games_played) ?? 0;
    const gw = isCelo && Number(backend?.celo_games_won) > 0 ? Number(backend.celo_games_won) : Number(backend?.game_won) ?? 0;
    const hasBackendStats = backend && (gp > 0 || Number(backend.total_earned) > 0);
    if (contractEmpty && hasBackendStats) {
      const gl = Number(backend!.game_lost) ?? 0;
      return applyBackendPropertyStats({
        ...userData,
        gamesPlayed: gp,
        gamesWon: gw,
        gamesLost: gl,
        winRate: gp > 0 ? ((gw / gp) * 100).toFixed(1) + '%' : '0%',
        totalStaked: Number(backend!.total_staked) ?? 0,
        totalEarned: Number(backend!.total_earned) ?? 0,
        totalWithdrawn: Number(backend!.total_withdrawn) ?? 0,
      });
    }
    return applyBackendPropertyStats(userData);
  }, [userData, backendUser, chainParam]);

  const statsUser = effectiveUserData ?? userData;

  const handleSend = (tokenId: bigint, fromAddress: Address) => {
    if (!rewardAddress) return toast.error("Wallet or contract not available");
    if (!sendAddress || !/^0x[a-fA-F0-9]{40}$/i.test(sendAddress)) return toast.error('Invalid wallet address');

    setSendingTokenId(tokenId);
    writeContract({
      address: rewardAddress,
      abi: RewardABI,
      functionName: 'safeTransferFrom',
      args: [fromAddress as `0x${string}`, sendAddress as `0x${string}`, tokenId, 1, '0x'],
    });
  };

  const handleRedeemVoucherViaApi = React.useCallback(async (tokenId: bigint) => {
    try {
      setRedeemingId(tokenId);
      await apiClient.post<ApiResponse>('/auth/redeem-voucher', { tokenId: tokenId.toString(), chain: 'CELO' });
      tycBalanceSmart.refetch();
      tycBalance.refetch();
      await refetchVouchers();
      toast.success('Voucher redeemed successfully!');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string; voucher_owner?: string | null } }; message?: string };
      const owner = err?.response?.data?.voucher_owner;
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to redeem voucher';
      toast.error(owner ? `${msg} (Owner: ${owner})` : msg);
    } finally {
      setRedeemingId(null);
    }
  }, [tycBalanceSmart, tycBalance, refetchVouchers]);

  const handleRedeemVoucher = (tokenId: bigint, voucherHolder: Address) => {
    if (!rewardAddress) return toast.error("Contract not available");
    const isSmartWalletVoucher =
      !!walletAddress && voucherHolder.toLowerCase() !== walletAddress.toLowerCase();

    if (isSmartWalletVoucher) {
      setRedeemingId(tokenId);
      writeContract({
        address: rewardAddress,
        abi: RewardABI,
        functionName: 'redeemVoucherFor',
        args: [voucherHolder, tokenId],
      });
    } else {
      setRedeemingId(tokenId);
      writeContract({
        address: rewardAddress,
        abi: RewardABI,
        functionName: 'redeemVoucher',
        args: [tokenId],
      });
    }
  };

  useEffect(() => {
    if (txSuccess && txHash) {
      toast.success('Success! 🎉');
      reset();
      setSendingTokenId(null);
      setRedeemingId(null);
      setSelectedPerkKey(null);
      tycBalance.refetch();
      tycBalanceSmart.refetch();
    }
  }, [txSuccess, txHash, reset, tycBalance, tycBalanceSmart]);

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

  const guestHasPerkHolderAddresses =
    !!guestUser &&
    ((guestUser.smart_wallet_address && isValidWallet(guestUser.smart_wallet_address)) ||
      (guestUser.linked_wallet_address && isValidWallet(guestUser.linked_wallet_address)));

  // Show guest view when connected wallet has no on-chain profile (e.g. first-time link) so user can still see "Link this wallet"
  const showGuestProfileForConnectedWalletMismatch =
    Boolean(guestUser) && isConnected && !loading && (!!error || !userData);

  if (!isConnected || loading || error || !userData) {
    if (guestUser && !isConnected) {
      return (
        <GuestProfileViewMobile guestUser={guestUser} />
      );
    }
    if (showGuestProfileForConnectedWalletMismatch && guestUser) {
      return (
        <GuestProfileViewMobile
          guestUser={guestUser}
          connectedWalletMismatchNotice={
            guestHasPerkHolderAddresses
              ? undefined
              : "Your connected wallet isn't registered on-chain yet. Link it below to use this account when you connect with that wallet (staked games, same stats)."
          }
        />
      );
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
            <p className="mt-3 text-slate-500 text-[10px] text-center">Connected wallet</p>
            <button
              type="button"
              onClick={copyAddress}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-xs w-full max-w-[260px] mx-auto justify-center hover:border-cyan-500/20 hover:text-cyan-300/80 transition"
            >
              <span className="font-mono truncate">{userData.shortAddress || walletAddress}</span>
              {copied ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
            </button>
            <div className="mt-2 space-y-2">
              <p className="text-slate-500 text-[10px] flex items-center justify-center gap-1.5 flex-wrap">
                <span>Smart wallet:</span>
                {smartWalletAddress && smartWalletAddress !== '0x0000000000000000000000000000000000000000' ? (
                  <>
                    <span className="font-mono text-cyan-300/90">{`${smartWalletAddress.slice(0, 6)}...${smartWalletAddress.slice(-4)}`}</span>
                    {accountSmartWallet && isValidWallet(registrySmartWallet) && accountSmartWallet.toLowerCase() !== (registrySmartWallet as string).toLowerCase() ? (
                      <span className="text-[9px] text-slate-500">
                        (account: {accountSmartWallet.slice(0, 6)}...{accountSmartWallet.slice(-4)})
                      </span>
                    ) : null}
                    <button type="button" onClick={() => { navigator.clipboard.writeText(smartWalletAddress); toast.success('Copied'); }} aria-label="Copy"><Copy className="w-3 h-3" /></button>
                  </>
                ) : (
                  <span className="italic">— (register in-game to get one)</span>
                )}
              </p>
              {isConnected && smartWalletAddress && smartWalletAddress !== '0x0000000000000000000000000000000000000000' && (
                <Link
                  href="/profile/smart-wallet"
                  className="w-full max-w-[260px] mx-auto flex justify-center px-4 py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-200 text-sm font-semibold transition"
                >
                  Manage smart wallet
                </Link>
              )}
            </div>
            {(guestUser?.smart_wallet_migration_status || guestUser?.legacy_smart_wallet_address) && (
              <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-left">
                <p className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold">Wallet migration</p>
                <p className="text-xs text-white/70 mt-1">
                  Status: <span className="font-semibold text-white">{guestUser?.smart_wallet_migration_status ?? 'unknown'}</span>
                </p>
                {guestUser?.legacy_smart_wallet_address ? (
                  <p className="text-[11px] text-white/60 mt-1 break-all">
                    Legacy wallet: {guestUser.legacy_smart_wallet_address}
                  </p>
                ) : null}
              </div>
            )}
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

        {/* Game stats | About you | My Perks | Reward Vouchers — tabs, content below */}
        <section className="pb-4">
          <div className="flex gap-1 mb-3 flex-wrap">
            {[
              { id: 'stats' as const, label: 'Game stats', icon: BarChart2 },
              { id: 'about' as const, label: 'About you', icon: User },
              { id: 'perks' as const, label: 'My Perks', icon: ShoppingBag, badge: ownedCollectibles.length },
              { id: 'vouchers' as const, label: 'Reward Vouchers', icon: Ticket, badge: myVouchers.length },
            ].map(({ id, label, icon: Icon, badge }) => (
              <button
                key={id}
                type="button"
                onClick={() => setProfileTab(id)}
                className={`flex-1 min-w-[calc(50%-4px)] sm:min-w-0 sm:flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 rounded-xl font-semibold text-[10px] transition-all ${
                  profileTab === id
                    ? 'bg-cyan-500/20 border-2 border-cyan-500/50 text-cyan-200'
                    : 'bg-white/5 border border-white/10 text-white/70'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="flex items-center gap-1 min-w-0 justify-center flex-wrap text-center leading-tight">
                  <span className="break-words">{label}</span>
                  {badge !== undefined && (
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
                <ProfileReferralCard className="mb-4" />
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
                {statsUser && (() => {
                  const levelInfo = getLevelFromActivity({ gamesPlayed: statsUser.gamesPlayed, gamesWon: statsUser.gamesWon });
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
                    <p className="text-sm font-bold text-white">{statsUser?.gamesPlayed ?? '—'}</p>
                  </div>
                  <div className="profile-card rounded-xl p-3 flex flex-col items-center gap-0.5 border border-white/10">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <p className="text-[10px] text-white/50">Wins</p>
                    <p className="text-sm font-bold text-amber-300">{statsUser?.gamesWon ?? '—'}</p>
                  </div>
                  <div className="profile-card rounded-xl p-3 flex flex-col items-center gap-0.5 border border-white/10">
                    <Coins className="w-4 h-4 text-slate-400" />
                    <p className="text-[10px] text-white/50">Losses</p>
                    <p className="text-sm font-bold text-slate-300">{statsUser?.gamesLost ?? '—'}</p>
                  </div>
                  <div className="profile-card rounded-xl p-3 flex flex-col items-center gap-0.5 border border-white/10">
                    <BarChart2 className="w-4 h-4 text-emerald-400" />
                    <p className="text-[10px] text-white/50">Win rate</p>
                    <p className="text-sm font-bold text-emerald-300">{statsUser?.winRate ?? '—'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="profile-card rounded-xl p-2.5 text-center border border-white/10">
                    <p className="text-[9px] text-white/50">Staked</p>
                    <p className="text-xs font-bold text-white truncate">{statsUser ? formatStakeOrEarned(statsUser.totalStaked) : '—'}</p>
                  </div>
                  <div className="profile-card rounded-xl p-2.5 text-center border border-white/10">
                    <p className="text-[9px] text-white/50">Earned</p>
                    <p className="text-xs font-bold text-emerald-300 truncate">{statsUser ? formatStakeOrEarned(statsUser.totalEarned) : '—'}</p>
                  </div>
                  <div className="profile-card rounded-xl p-2.5 text-center border border-white/10">
                    <p className="text-[9px] text-white/50">Withdrawn</p>
                    <p className="text-xs font-bold text-slate-300 truncate">{statsUser ? formatStakeOrEarned(statsUser.totalWithdrawn) : '—'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="profile-card rounded-xl p-2.5 flex items-center justify-center gap-2 border border-white/10">
                    <p className="text-[9px] text-white/50">Props bought</p>
                    <p className="text-sm font-bold text-cyan-300">{statsUser?.propertiesBought ?? '—'}</p>
                  </div>
                  <div className="profile-card rounded-xl p-2.5 flex items-center justify-center gap-2 border border-white/10">
                    <p className="text-[9px] text-white/50">Props sold</p>
                    <p className="text-sm font-bold text-amber-300">{statsUser?.propertiesSold ?? '—'}</p>
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
                ) : groupedCollectibles.length === 0 ? (
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
                    {groupedCollectibles.map((item) => {
                      const rowKey = `${item.heldBy.toLowerCase()}-${item.perk}-${item.strength}`;
                      return (
                      <motion.div
                        key={rowKey}
                        whileTap={{ scale: 0.98 }}
                        className={`rounded-xl p-4 text-center border transition-all bg-black/20 ${
                          selectedPerkKey === rowKey ? 'border-purple-500/50 ring-2 ring-purple-500/20' : 'border-white/10'
                        }`}
                      >
                        <div className="relative inline-block">
                          {item.icon}
                          {item.count > 1 && (
                            <span className="absolute -top-1 -right-1 min-w-[1.125rem] h-4 px-1 flex items-center justify-center rounded-full bg-purple-500/90 text-white text-[10px] font-bold">
                              ×{item.count}
                            </span>
                          )}
                        </div>
                        <h4 className="mt-2 font-semibold text-white text-sm">{item.name}</h4>
                        {item.isTiered && item.strength > 0 && <p className="text-cyan-300/90 text-[10px] mt-0.5">Tier {item.strength}</p>}
                        {smartWallet && item.heldBy.toLowerCase() === smartWallet.toLowerCase() ? (
                          <p className="text-[9px] text-cyan-300/80 mt-1">Smart wallet</p>
                        ) : walletAddress && item.heldBy.toLowerCase() === walletAddress.toLowerCase() ? (
                          <p className="text-[9px] text-white/45 mt-1">Connected</p>
                        ) : null}
                        {selectedPerkKey === rowKey ? (
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
                                onClick={() => handleSend(item.tokenId, item.heldBy)}
                                disabled={!sendAddress || !/^0x[a-fA-F0-9]{40}$/i.test(sendAddress) || sendingTokenId === item.tokenId || isWriting || isConfirming}
                                className="flex-1 py-2 rounded-lg font-medium text-[11px] bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-50 flex items-center justify-center gap-1 text-white"
                              >
                                {sendingTokenId === item.tokenId && (isWriting || isConfirming) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                {sendingTokenId === item.tokenId && (isWriting || isConfirming) ? '...' : 'Send'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedPerkKey(null)}
                                className="px-2.5 py-2 rounded-lg font-medium text-[11px] bg-white/10 text-white/80"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedPerkKey(rowKey)}
                            className="mt-3 w-full py-2 rounded-lg font-medium text-xs bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center gap-1 text-white"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Transfer
                          </button>
                        )}
                      </motion.div>
                    );
                    })}
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
                        key={`${voucher.heldBy}-${voucher.tokenId.toString()}`}
                        className="profile-card rounded-xl p-4 border border-amber-500/20 text-center"
                      >
                        <Ticket className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                        <p className="text-lg font-bold text-amber-200 mb-3">{voucher.value} TYC</p>
                        {smartWallet && voucher.heldBy.toLowerCase() === smartWallet.toLowerCase() ? (
                          <p className="text-[9px] text-amber-200/70 mb-2">Smart wallet</p>
                        ) : walletAddress && voucher.heldBy.toLowerCase() === walletAddress.toLowerCase() ? (
                          <p className="text-[9px] text-white/45 mb-2">Connected</p>
                        ) : null}
                        <button
                          onClick={() => handleRedeemVoucher(voucher.tokenId, voucher.heldBy)}
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