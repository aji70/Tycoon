'use client';

import React, { useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import { BarChart2, Crown, Coins, Wallet, Ticket, ShoppingBag, Loader2, Send, ChevronDown, ChevronUp, Camera, Copy, Check, User, FileText, Pencil } from 'lucide-react';
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

const zeroAddress = '0x0000000000000000000000000000000000000000' as Address;
const isValidWallet = (a: unknown): a is Address => {
  if (!a || typeof a !== 'string') return false;
  const s = a.trim();
  if (!s) return false;
  return s.toLowerCase() !== zeroAddress.toLowerCase();
};

const MAX_AVATAR_SIZE = 1024 * 1024; // 1MB
const MAX_AVATAR_DIM = 512;

/** Contract User struct: id, username, playerAddress, registeredAt, gamesPlayed, gamesWon, gamesLost, totalStaked, totalEarned, totalWithdrawn, propertiesbought, propertiesSold */
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

/** Celo chain id for contract reads when wallet is disconnected. */
const CELO_CHAIN_ID = 42220;

/** Guest/Privy profile when wallet is not connected, or when a connected extension wallet is not the Tycoon-registered address (notice only if wallet not registered — smart/linked users see no banner). */
function GuestProfileView({
  guestUser,
  onRecreateClick,
  recreatePending,
  connectedWalletMismatchNotice,
}: {
  guestUser: { address: string; username: string; linked_wallet_address?: string | null; smart_wallet_address?: string | null };
  onRecreateClick?: () => void | Promise<void>;
  recreatePending?: boolean;
  /** Shown when the connected extension wallet is not registered for this account yet (prompt to link). Omitted when user already has smart/linked wallet — perks use those silently. */
  connectedWalletMismatchNotice?: string | null;
}) {
  const username = guestUser.username;
  // When wallet is not connected:
  // - stats/username use the "wallet linked" address when available
  // - balances can be shown for both linked + smart wallets
  const linkedWalletAddress =
    guestUser.linked_wallet_address && isValidWallet(guestUser.linked_wallet_address)
      ? (guestUser.linked_wallet_address as Address)
      : null;
  const smartWalletAddress =
    guestUser.smart_wallet_address && isValidWallet(guestUser.smart_wallet_address)
      ? (guestUser.smart_wallet_address as Address)
      : null;
  const guestOnChainAddress = linkedWalletAddress ?? smartWalletAddress ?? null;
  // For game lookups: wallet-first users are registered under smart wallet, so use it when present
  const guestGameLookupAddress = smartWalletAddress ?? linkedWalletAddress ?? null;
  // Key local profile storage by whichever address represents this profile.
  // For Privy-only users, fall back to their guest `address` so avatar updates persist.
  const profileKeyAddress = linkedWalletAddress ?? smartWalletAddress ?? guestUser.address;

  const { profile, setAvatar, setDisplayName, setBio, setProfile } = useProfileForAddress(profileKeyAddress);
  const [profileTab, setProfileTab] = useState<'stats' | 'about' | 'perks' | 'vouchers'>('stats');
  const [localDisplayName, setLocalDisplayName] = useState(profile?.displayName ?? '');
  const [localBio, setLocalBio] = useState(profile?.bio ?? '');
  const [editingBio, setEditingBio] = useState(false);
  const [redeemingVoucherId, setRedeemingVoucherId] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setLocalDisplayName(profile?.displayName ?? '');
    setLocalBio(profile?.bio ?? '');
  }, [profile?.displayName, profile?.bio]);

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

  const { data: onChainUsername } = useReadContract({
    address: tycoonAddress,
    abi: TycoonABI,
    functionName: 'addressToUsername',
    args: guestGameLookupAddress ? [guestGameLookupAddress] : undefined,
    chainId: CELO_CHAIN_ID,
    query: { enabled: !!guestGameLookupAddress && !!tycoonAddress },
  });

  const { data: playerData } = useReadContract({
    address: tycoonAddress,
    abi: TycoonABI,
    functionName: 'getUser',
    args: onChainUsername ? [onChainUsername as string] : undefined,
    chainId: CELO_CHAIN_ID,
    query: { enabled: !!onChainUsername && !!tycoonAddress },
  });

  const userData = React.useMemo(() => {
    if (!playerData || !onChainUsername) return null;
    return parseUserFromContract(playerData, onChainUsername as string, guestOnChainAddress ?? undefined);
  }, [playerData, onChainUsername, guestOnChainAddress]);

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

  const {
    ownedCollectibles: mergedCollectibleRows,
    myVouchers,
    isLoadingPerks,
    isLoadingVouchers,
  } = useMergedProfileRewardAssets(rewardAddress, CELO_CHAIN_ID, [linkedWalletAddress, smartWalletAddress]);

  const ownedCollectibles = useMemo(
    () =>
      mergedCollectibleRows.map((row) => {
        const asset = getPerkShopAsset(row.perk);
        return {
          ...row,
          name: asset?.name ?? `Perk #${row.perk}`,
          icon: <ProfilePerkCardImage perk={row.perk} className="w-16 h-16" />,
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

  const { data: games = [] } = useQuery({
    queryKey: ['guest-my-games'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse>('/games/my-games', { params: { limit: 100 } });
      if (!res?.data?.success || !Array.isArray(res.data.data)) return [];
      return res.data.data as { code: string; status: string; is_ai?: boolean }[];
    },
  });
  const gameCount = games.length;

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
        const resized = canvas.toDataURL('image/jpeg', 0.85);
        setAvatar(resized);
        toast.success('Profile photo updated!');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRedeemVoucher = async (voucherId: bigint, voucherOwner?: Address) => {
    try {
      setRedeemingVoucherId(voucherId.toString());
      const res = await apiClient.post<ApiResponse>('/auth/redeem-voucher', {
        tokenId: voucherId.toString(),
        chain: 'CELO',
        ...(voucherOwner ? { voucher_owner: voucherOwner } : {}),
      });
      if (res?.data?.success) {
        toast.success('Voucher redeemed! Check your balance.');
      } else {
        toast.error(res?.data?.message || 'Failed to redeem voucher');
      }
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; voucher_owner?: string | null } }; message?: string };
      const owner = e?.response?.data?.voucher_owner;
      const msg = e?.response?.data?.message ?? e?.message ?? 'Failed to redeem voucher';
      toast.error(owner ? `${msg} (Owner: ${owner})` : msg);
    } finally {
      setRedeemingVoucherId(null);
    }
  };

  return (
    <div className="min-h-screen text-[#F0F7F7] profile-page">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
      {/* Ambient background */}
      <div className="fixed inset-0 -z-10 bg-[#030c0d]" />
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-cyan-950/25 via-transparent to-transparent" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,240,255,0.08),transparent_50%)]" />

      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#030c0d]/90 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between max-w-5xl">
          <Link href="/" className="flex items-center gap-2 text-cyan-300/90 hover:text-cyan-200 transition text-sm font-medium">
            <span className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">←</span>
            Back
          </Link>
          <h1 className="text-lg font-semibold text-white/90 tracking-tight">My Profile</h1>
          <div className="w-20" />
        </div>
      </header>
      <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-5xl">
        {connectedWalletMismatchNotice ? (
          <div className="mb-6 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
            {connectedWalletMismatchNotice}
          </div>
        ) : null}
        {/* Hero card — focal point */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative rounded-3xl overflow-hidden mb-8 sm:mb-10 profile-hero"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-teal-500/10" />
          <div className="absolute inset-0 border border-cyan-500/20 rounded-3xl" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
              <div className="relative group shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,240,255,0.15)] border border-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-[#030c0d] block"
                  aria-label="Update avatar"
                >
                  <span className="absolute inset-0 [&>img]:object-cover">
                    {profile?.avatar ? (
                      <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Image src={avatar} alt="Avatar" width={128} height={128} className="w-full h-full object-cover" />
                    )}
                  </span>
                  <span className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="w-12 h-12 rounded-full bg-cyan-500/30 flex items-center justify-center">
                      <Camera className="w-6 h-6 text-white" />
                    </span>
                  </span>
                </button>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg border-2 border-[#030c0d]">
                  <Crown className="w-5 h-5 text-black" />
                </div>
              </div>

              <div className="flex-1 w-full text-center sm:text-left min-w-0">
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight drop-shadow-sm">{username}</h2>
                {profile?.displayName?.trim() ? (
                  <p className="text-cyan-300/80 text-sm mt-1">"{profile.displayName.trim()}"</p>
                ) : null}

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-4">
                  {shortLinkedWalletAddress || shortSmartWalletAddress ? (
                    <>
                      {shortLinkedWalletAddress ? (
                        <>
                          <span className="text-slate-400 text-xs">Linked wallet:</span>
                          <span className="text-slate-400 font-mono text-xs sm:text-sm truncate max-w-full">{shortLinkedWalletAddress}</span>
                        </>
                      ) : null}
                      {shortSmartWalletAddress ? (
                        <>
                          <span className="text-slate-400 text-xs">Smart wallet:</span>
                          <span className="text-slate-400 font-mono text-xs sm:text-sm truncate max-w-full">{shortSmartWalletAddress}</span>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-cyan-300/80 text-sm">Your progress is saved. Link a wallet to sync stats on-chain.</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-4 text-sm">
                  <div>
                    <span className="text-cyan-400 font-semibold">{gameCount}</span>
                    <span className="text-white/70 ml-1">games played</span>
                  </div>
                </div>

                {/* Balances (same card area as avatar/identity) */}
                <div className="mt-5 w-full">
                  <div className="space-y-3">
                    {linkedWalletAddress ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-white/50 mb-2">
                          Linked wallet balances
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            {
                              label: 'TYC',
                              value: tycBalanceLinked.isLoading ? '...' : Number(tycBalanceLinked.data?.formatted || 0).toFixed(2),
                              color: 'cyan',
                            },
                            {
                              label: 'USDC',
                              value: usdcBalanceLinked.isLoading ? '...' : Number(usdcBalanceLinked.data?.formatted || 0).toFixed(2),
                              color: 'emerald',
                            },
                            {
                              label: 'Celo',
                              value: nativeBalanceLinked.isLoading
                                ? '...'
                                : nativeBalanceLinked.data
                                  ? Number(nativeBalanceLinked.data.formatted).toFixed(4)
                                  : '0',
                              color: 'slate',
                            },
                          ].map(({ label, value, color }) => (
                            <div
                              key={label}
                              className={`text-center balance-pill balance-${color} rounded-xl px-3 py-2 min-w-0`}
                            >
                              <p className="text-[10px] font-medium uppercase tracking-wider text-white/50">{label}</p>
                              <p className="text-sm font-bold text-white truncate mt-0.5">{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {showSmartBalances ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-white/50 mb-2">
                          Smart wallet balances
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            {
                              label: 'TYC',
                              value: tycBalanceSmart.isLoading ? '...' : Number(tycBalanceSmart.data?.formatted || 0).toFixed(2),
                              color: 'cyan',
                            },
                            {
                              label: 'USDC',
                              value: usdcBalanceSmart.isLoading ? '...' : Number(usdcBalanceSmart.data?.formatted || 0).toFixed(2),
                              color: 'emerald',
                            },
                            {
                              label: 'Celo',
                              value: nativeBalanceSmart.isLoading
                                ? '...'
                                : nativeBalanceSmart.data
                                  ? Number(nativeBalanceSmart.data.formatted).toFixed(4)
                                  : '0',
                              color: 'slate',
                            },
                          ].map(({ label, value, color }) => (
                            <div
                              key={label}
                              className={`text-center balance-pill balance-${color} rounded-xl px-3 py-2 min-w-0`}
                            >
                              <p className="text-[10px] font-medium uppercase tracking-wider text-white/50">{label}</p>
                              <p className="text-sm font-bold text-white truncate mt-0.5">{value}</p>
                            </div>
                          ))}
                        </div>
                        {shortSmartWalletAddress && (
                          <button
                            type="button"
                            disabled={recreatePending}
                            onClick={async () => { await onRecreateClick?.(); }}
                            className="w-full mt-3 px-4 py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-200 text-sm font-semibold transition disabled:opacity-60 disabled:hover:bg-cyan-500/15"
                          >
                            {recreatePending ? 'Creating…' : 'Recreate smart wallet'}
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Game stats | About you — tabs */}
        <section className="mb-8">
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { id: 'stats' as const, label: 'Game stats', icon: BarChart2 },
              { id: 'about' as const, label: 'About you', icon: User },
              { id: 'perks' as const, label: 'My Perks', icon: ShoppingBag, badge: ownedCollectibles.length },
              { id: 'vouchers' as const, label: 'Reward Vouchers', icon: Ticket, badge: myVouchers.length },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setProfileTab(id)}
                className={`flex-1 min-w-[160px] flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-semibold text-sm transition-all ${
                  profileTab === id
                    ? 'bg-cyan-500/20 border-2 border-cyan-500/50 text-cyan-200'
                    : 'bg-white/5 border border-white/10 text-white/70 hover:border-white/20 hover:text-white/90'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {'badge' in (arguments[0] as any) && (arguments[0] as any).badge !== undefined && (arguments[0] as any).badge > 0 ? null : null}
              </button>
            ))}
          </div>

          <div className="profile-card rounded-2xl border border-white/10 overflow-hidden min-h-[260px] max-h-[60vh] overflow-y-auto">
            {profileTab === 'stats' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 sm:p-6">
                {!userData ? (
                  <EmptyState
                    icon={<BarChart2 className="w-14 h-14 text-cyan-400/70" />}
                    title="No on-chain stats yet"
                    description="Link a wallet (or register in-game) to start tracking stats on-chain."
                    compact
                    className="border-cyan-500/20 bg-black/20"
                  />
                ) : (
                  <>
                    {(() => {
                      const levelInfo = getLevelFromActivity({ gamesPlayed: userData.gamesPlayed, gamesWon: userData.gamesWon });
                      return (
                        <div className="mb-4 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-medium text-cyan-400/90 uppercase tracking-widest">Level</span>
                            <span className="font-bold text-cyan-300">Level {levelInfo.level} · {levelInfo.label}</span>
                          </div>
                          {levelInfo.level < 99 && levelInfo.xpForNextLevel > 0 && (
                            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                              <div className="h-full rounded-full bg-cyan-500/80 transition-all duration-500" style={{ width: `${Math.round(levelInfo.progress * 100)}%` }} />
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      {[
                        { icon: BarChart2, label: 'Games played', value: String(userData.gamesPlayed), accent: 'cyan' },
                        { icon: Crown, label: 'Wins', value: String(userData.gamesWon), accent: 'amber', valueClass: 'text-amber-300' },
                        { icon: Coins, label: 'Losses', value: String(userData.gamesLost), accent: 'slate', valueClass: 'text-slate-300' },
                        { icon: BarChart2, label: 'Win rate', value: userData.winRate, accent: 'emerald', valueClass: 'text-emerald-300' },
                      ].map(({ icon: Icon, label, value, accent, valueClass = 'text-white' }) => (
                        <div key={label} className={`profile-stat stat-${accent} rounded-2xl p-4 flex items-center gap-3`}>
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 stat-icon"><Icon className="w-5 h-5" /></div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">{label}</p>
                            <p className={`font-bold text-base truncate ${valueClass}`}>{value}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                      {[
                        { icon: Wallet, label: 'Total staked', value: formatStakeOrEarned(userData.totalStaked) + ' BLOCK', accent: 'cyan' },
                        { icon: Coins, label: 'Total earned', value: formatStakeOrEarned(userData.totalEarned) + ' BLOCK', accent: 'emerald', valueClass: 'text-emerald-300' },
                        { icon: Wallet, label: 'Total withdrawn', value: formatStakeOrEarned(userData.totalWithdrawn) + ' BLOCK', accent: 'slate', valueClass: 'text-slate-300' },
                      ].map(({ icon: Icon, label, value, accent, valueClass = 'text-white' }) => (
                        <div key={label} className={`profile-stat stat-${accent} rounded-2xl p-4 flex items-center gap-3`}>
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 stat-icon"><Icon className="w-5 h-5" /></div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">{label}</p>
                            <p className={`font-bold text-sm truncate ${valueClass}`}>{value}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { icon: BarChart2, label: 'Properties bought', value: String(userData.propertiesBought), accent: 'cyan' },
                        { icon: BarChart2, label: 'Properties sold', value: String(userData.propertiesSold), accent: 'amber', valueClass: 'text-amber-300' },
                      ].map(({ icon: Icon, label, value, accent, valueClass = 'text-white' }) => (
                        <div key={label} className={`profile-stat stat-${accent} rounded-2xl p-4 flex items-center gap-3`}>
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 stat-icon"><Icon className="w-5 h-5" /></div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">{label}</p>
                            <p className={`font-bold text-base truncate ${valueClass}`}>{value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {profileTab === 'about' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 sm:p-8">
                <p className="text-xs font-medium text-cyan-400/90 uppercase tracking-widest mb-6">Tell us about yourself</p>
                <div className="space-y-6 max-w-xl">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">Display name</label>
                    <div className="flex gap-3 rounded-2xl bg-white/5 border border-white/10 px-4 py-3.5 focus-within:border-cyan-500/40 focus-within:bg-white/[0.07] transition-all">
                      <User className="w-5 h-5 text-cyan-400/80 shrink-0 mt-0.5" />
                      <input
                        type="text"
                        placeholder="How should we call you?"
                        value={localDisplayName}
                        onChange={(e) => setLocalDisplayName(e.target.value)}
                        onBlur={saveDisplayName}
                        className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none text-base min-w-0"
                      />
                      <button type="button" onClick={saveDisplayName} className="shrink-0 px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-sm font-semibold transition-colors">Save</button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">Short bio</label>
                    {editingBio ? (
                      <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3.5 focus-within:border-cyan-500/40 focus-within:bg-white/[0.07] transition-all">
                        <div className="flex gap-3">
                          <FileText className="w-5 h-5 text-cyan-400/80 shrink-0 mt-0.5" />
                          <textarea
                            placeholder="A line or two about you — what you love, your play style, or anything you'd like others to see."
                            value={localBio}
                            onChange={(e) => setLocalBio(e.target.value)}
                            rows={4}
                            className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none text-base resize-none min-w-0 leading-relaxed"
                            autoFocus
                          />
                        </div>
                        <div className="flex justify-end gap-2 mt-3">
                          <button type="button" onClick={() => setEditingBio(false)} className="px-4 py-2 rounded-xl bg-white/10 text-white/80 hover:bg-white/15 text-sm font-semibold transition-colors">Cancel</button>
                          <button type="button" onClick={() => { saveBio(); setEditingBio(false); }} className="px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-sm font-semibold transition-colors">Save bio</button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3.5 flex items-start justify-between gap-3">
                        <div className="flex gap-3 min-w-0 flex-1">
                          <FileText className="w-5 h-5 text-cyan-400/80 shrink-0 mt-0.5" />
                          <p className="text-base text-white/90 leading-relaxed whitespace-pre-wrap break-words">
                            {localBio.trim() || <span className="text-slate-500">No bio yet.</span>}
                          </p>
                        </div>
                        <button type="button" onClick={() => setEditingBio(true)} className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-sm font-semibold transition-colors">
                          <Pencil className="w-4 h-4" />
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {profileTab === 'perks' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 sm:p-6">
                {!guestOnChainAddress ? (
                  <EmptyState
                    icon={<ShoppingBag className="w-14 h-14 text-purple-400/70" />}
                    title="No perks yet"
                    description="Link a wallet to view perks owned by your on-chain address."
                    compact
                    className="border-purple-500/20 bg-black/20"
                  />
                ) : isLoadingPerks ? (
                  <>
                    <p className="text-slate-400 text-sm text-center mb-3">Loading perks…</p>
                    <SkeletonPerkGrid count={6} gridClass="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" />
                  </>
                ) : groupedCollectibles.length === 0 ? (
                  <EmptyState
                    icon={<ShoppingBag className="w-14 h-14 text-purple-400/70" />}
                    title="No perks yet"
                    description="Perks give you in-game advantages. Buy them in the Perk Shop or during a game from My Perks."
                    action={{ label: 'Visit Perk Shop', href: '/game-shop' }}
                    compact
                    className="border-purple-500/20 bg-black/20"
                  />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {groupedCollectibles.map((item, i) => (
                      <motion.div
                        key={`${item.heldBy}-${item.perk}-${item.strength}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        whileHover={{ y: -2 }}
                        className="rounded-2xl p-4 text-center border transition-all bg-black/20 border-white/10 hover:border-purple-500/30"
                      >
                        <div className="relative inline-block">
                          {item.icon}
                          {item.count > 1 && (
                            <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded-full bg-purple-500/90 text-white text-xs font-bold">
                              ×{item.count}
                            </span>
                          )}
                        </div>
                        <h4 className="mt-2 font-semibold text-white text-sm">{item.name}</h4>
                        {item.isTiered && item.strength > 0 && <p className="text-cyan-300/90 text-xs mt-0.5">Tier {item.strength}</p>}
                        {smartWalletAddress && item.heldBy.toLowerCase() === smartWalletAddress.toLowerCase() ? (
                          <p className="text-[10px] text-cyan-300/80 mt-1">Smart wallet</p>
                        ) : linkedWalletAddress && item.heldBy.toLowerCase() === linkedWalletAddress.toLowerCase() ? (
                          <p className="text-[10px] text-white/45 mt-1">Linked wallet</p>
                        ) : null}
                        <p className="text-xs text-white/50 mt-3">Connect a wallet to transfer perks.</p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {profileTab === 'vouchers' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 sm:p-6">
                {!guestOnChainAddress ? (
                  <EmptyState
                    icon={<Ticket className="w-14 h-14 text-amber-400/70" />}
                    title="No vouchers yet"
                    description="Link a wallet to view reward vouchers owned by your on-chain address."
                    compact
                    className="border-amber-500/20 bg-black/20"
                  />
                ) : isLoadingVouchers ? (
                  <>
                    <p className="text-slate-400 text-sm text-center mb-3">Loading vouchers…</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <SkeletonCard key={i} hasImage={false} lines={2} className="rounded-2xl p-5 border border-amber-500/20" />
                      ))}
                    </div>
                  </>
                ) : myVouchers.length === 0 ? (
                  <EmptyState
                    icon={<Ticket className="w-14 h-14 text-amber-400/70" />}
                    title="No vouchers yet"
                    description="Win games to earn reward vouchers. Redeem them here for TYC or use perks during a game."
                    compact
                    className="border-amber-500/20 bg-black/20"
                  />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {myVouchers.map((voucher) => (
                      <motion.div
                        key={`${voucher.heldBy}-${voucher.tokenId.toString()}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl p-5 text-center border border-amber-500/20 bg-black/20"
                      >
                        <Ticket className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                        <p className="text-lg font-bold text-amber-200 mb-3">{voucher.value} TYC</p>
                        {smartWalletAddress && voucher.heldBy.toLowerCase() === smartWalletAddress.toLowerCase() ? (
                          <p className="text-[10px] text-amber-200/70 mb-2">Smart wallet</p>
                        ) : linkedWalletAddress && voucher.heldBy.toLowerCase() === linkedWalletAddress.toLowerCase() ? (
                          <p className="text-[10px] text-white/45 mb-2">Linked wallet</p>
                        ) : null}
                        <button
                          type="button"
                          disabled={!smartWalletAddress || redeemingVoucherId === voucher.tokenId.toString()}
                          onClick={() => handleRedeemVoucher(voucher.tokenId, voucher.heldBy)}
                          className={`w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition ${
                            !smartWalletAddress
                              ? 'bg-white/10 text-white/50 cursor-not-allowed'
                              : 'bg-amber-500 text-white hover:bg-amber-600 disabled:bg-amber-500/50 disabled:cursor-wait'
                          }`}
                        >
                          {redeemingVoucherId === voucher.tokenId.toString() ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Redeeming...
                            </>
                          ) : (
                            'Redeem'
                          )}
                        </button>
                        {!smartWalletAddress && (
                          <p className="text-xs text-white/50 mt-2">Create a smart wallet to redeem.</p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </section>

        <section className="mt-10">
          <AccountLinkWallet />
        </section>
      </main>
    </div>
  );
}

export default function Profile() {
  const { address: walletAddress, isConnected, chainId } = useAccount();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const guestLoading = guestAuth?.isLoading ?? false;
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

  const tycBalance = useBalance({ address: walletAddress, token: tycTokenAddress, query: { enabled: !!walletAddress && !!tycTokenAddress } });
  const usdcBalance = useBalance({ address: walletAddress, token: usdcTokenAddress, query: { enabled: !!walletAddress && !!usdcTokenAddress } });

  const { data: registrySmartWallet } = useUserRegistryWallet(walletAddress);
  // Smart wallet can come from on-chain registry OR from the logged-in account (guest/Privy)
  // When the connected wallet is the user's linked wallet, prefer account smart wallet so we show full profile (no mismatch).
  const connectedWalletIsLinked =
    !!guestUser &&
    !!walletAddress &&
    !!guestUser.linked_wallet_address &&
    isValidWallet(guestUser.linked_wallet_address) &&
    walletAddress.toLowerCase() === (guestUser.linked_wallet_address as string).toLowerCase();
  const accountSmartWallet =
    guestUser && isValidWallet(guestUser.smart_wallet_address)
      ? (guestUser.smart_wallet_address as Address)
      : undefined;
  const smartWalletAddress =
    connectedWalletIsLinked && isValidWallet(accountSmartWallet)
      ? accountSmartWallet
      : isValidWallet(registrySmartWallet)
        ? (registrySmartWallet as Address)
        : accountSmartWallet;
  const smartWallet = smartWalletAddress;
  const { data: smartWalletOwner } = useProfileOwner(smartWallet);

  const showDualWallets = !!smartWallet && !!walletAddress && smartWallet.toLowerCase() !== walletAddress.toLowerCase();
  const [activeWalletView, setActiveWalletView] = useState<'connected' | 'smart'>(() => (smartWallet ? 'smart' : 'connected'));
  React.useEffect(() => {
    if (!smartWallet) setActiveWalletView('connected');
  }, [smartWallet]);

  // Perks/vouchers can be held on either wallet; let the user pick.
  const rewardOwnerAddress = (activeWalletView === 'smart' ? smartWallet : walletAddress) ?? walletAddress;
  const { data: ethBalanceSmart } = useBalance({ address: smartWallet, query: { enabled: !!smartWallet } });
  const tycBalanceSmart = useBalance({ address: smartWallet, token: tycTokenAddress, query: { enabled: !!smartWallet && !!tycTokenAddress } });
  const usdcBalanceSmart = useBalance({ address: smartWallet, token: usdcTokenAddress, query: { enabled: !!smartWallet && !!usdcTokenAddress } });

  // Tycoon username/profile: profile owner for display; for game lookups use smart wallet when present (wallet-first users are registered under smart wallet).
  const tycoonProfileOwnerAddress =
    (isValidWallet(smartWalletOwner) ? smartWalletOwner : null) ??
    walletAddress;
  const gameLookupAddress = smartWallet ?? tycoonProfileOwnerAddress;

  // Local avatar/displayName/bio should be keyed by the profile owner (linked EOA),
  // not by whichever wallet is currently connected (smart wallet).
  const { profile, setAvatar, setDisplayName, setBio, setProfile } = useProfileForAddress(tycoonProfileOwnerAddress);

  React.useEffect(() => {
    setLocalDisplayName(profile?.displayName ?? '');
    setLocalBio(profile?.bio ?? '');
  }, [profile?.displayName, profile?.bio]);

  const displayName = profile?.displayName?.trim() || null;

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

  const {
    ownedCollectibles: mergedCollectibleRows,
    myVouchers,
    isLoadingPerks,
    isLoadingVouchers,
  } = useMergedProfileRewardAssets(rewardAddress, chainId, [walletAddress, smartWallet]);

  const ownedCollectibles = useMemo(
    () =>
      mergedCollectibleRows.map((row) => {
        const asset = getPerkShopAsset(row.perk);
        return {
          ...row,
          name: asset?.name ?? `Perk #${row.perk}`,
          icon: <ProfilePerkCardImage perk={row.perk} className="w-16 h-16" />,
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

  React.useEffect(() => {
    // Reset when wallet changes / reconnects
    setError(null);
    setUserData(null);
    setLoading(true);
  }, [walletAddress, smartWallet]);

  React.useEffect(() => {
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

    // If username fetch is done but empty, user likely isn't registered (or wrong network/contract address).
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

    // If getUser finished but returned empty, show error rather than spinning.
    if (username && !playerDataLoading && (playerData == null)) {
      setError('No player data found');
      setLoading(false);
      return;
    }
  }, [
    isConnected,
    username,
    usernameLoading,
    usernameReadError,
    playerData,
    playerDataLoading,
    playerDataReadError,
  ]);

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

  const handleRedeemVoucher = async (tokenId: bigint, voucherHolder: Address) => {
    try {
      if (!rewardAddress) {
        toast.error('Reward contract not available');
        return;
      }
      setRedeemingId(tokenId);
      const redeemFromSmart =
        !!walletAddress &&
        voucherHolder.toLowerCase() !== walletAddress.toLowerCase();
      if (redeemFromSmart) {
        writeContract({
          address: rewardAddress,
          abi: RewardABI,
          functionName: 'redeemVoucherFor',
          args: [voucherHolder, tokenId],
        });
        return;
      }
      const res = await apiClient.post<ApiResponse>('/auth/redeem-voucher', {
        tokenId: tokenId.toString(),
        chain: 'CELO',
        voucher_owner: voucherHolder,
      });
      if (res?.data?.success) {
        toast.success('Voucher redeemed! Check your balance.');
        tycBalance.refetch();
      } else {
        toast.error(res?.data?.message || 'Failed to redeem voucher');
      }
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; voucher_owner?: string | null } }; message?: string };
      const owner = e?.response?.data?.voucher_owner;
      const msg = e?.response?.data?.message ?? e?.message ?? 'Failed to redeem voucher';
      toast.error(owner ? `${msg} (Owner: ${owner})` : msg);
    } finally {
      const redeemFromSmart =
        !!walletAddress &&
        voucherHolder.toLowerCase() !== walletAddress.toLowerCase();
      if (!redeemFromSmart) setRedeemingId(null);
    }
  };

  React.useEffect(() => {
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

  const refetchGuest = guestAuth?.refetchGuest;
  const [recreateApiPending, setRecreateApiPending] = useState(false);

  const handleRecreateViaApi = React.useCallback(async () => {
    setRecreateApiPending(true);
    try {
      const res = await apiClient.post<ApiResponse & { data?: { smart_wallet_address?: string; migration?: { status?: string; error?: string } } }>('auth/recreate-smart-wallet');
      await refetchGuest?.();
      if (res?.data?.data?.migration?.status === 'failed') {
        toast.warn('Wallet recreated, but migration is incomplete. Contact support with your old wallet address.');
      } else {
        toast.success('Smart wallet recreated. CELO, USDC, TYC, perks, and vouchers migrated.');
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      toast.error(err?.response?.data?.message ?? err?.message ?? 'Failed to recreate');
    } finally {
      setRecreateApiPending(false);
    }
  }, [refetchGuest]);

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
        <GuestProfileView
          guestUser={guestUser}
          onRecreateClick={handleRecreateViaApi}
          recreatePending={recreateApiPending}
        />
      );
    }
    if (showGuestProfileForConnectedWalletMismatch && guestUser) {
      return (
        <GuestProfileView
          guestUser={guestUser}
          onRecreateClick={handleRecreateViaApi}
          recreatePending={recreateApiPending}
          connectedWalletMismatchNotice={
            guestHasPerkHolderAddresses
              ? undefined
              : "Your connected wallet isn't registered on-chain yet. Link it below to use this account when you connect with that wallet (staked games, same stats)."
          }
        />
      );
    }
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
    <div className="min-h-screen text-[#F0F7F7] profile-page">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />

      {/* Ambient background */}
      <div className="fixed inset-0 -z-10 bg-[#030c0d]" />
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-cyan-950/25 via-transparent to-transparent" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(0,240,255,0.08),transparent_50%)]" />

      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#030c0d]/90 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex items-center justify-between max-w-5xl">
          <Link href="/" className="flex items-center gap-2 text-cyan-300/90 hover:text-cyan-200 transition text-sm font-medium">
            <span className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">←</span>
            Back
          </Link>
          <h1 className="text-lg font-semibold text-white/90 tracking-tight">My Profile</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-5xl">
        {/* Hero card — focal point */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative rounded-3xl overflow-hidden mb-8 sm:mb-10 profile-hero"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-teal-500/10" />
          <div className="absolute inset-0 border border-cyan-500/20 rounded-3xl" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
              <div className="relative group shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,240,255,0.15)] focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-[#030c0d] block"
                >
                  {profile?.avatar ? (
                    <img src={profile.avatar} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 [&>img]:object-cover">
                      <Image src={avatar} alt="Avatar" width={128} height={128} className="w-full h-full object-cover" />
                    </span>
                  )}
                  <span className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="w-12 h-12 rounded-full bg-cyan-500/30 flex items-center justify-center">
                      <Camera className="w-6 h-6 text-white" />
                    </span>
                  </span>
                </button>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg border-2 border-[#030c0d]">
                  <Crown className="w-5 h-5 text-black" />
                </div>
              </div>

              <div className="flex-1 w-full text-center sm:text-left min-w-0">
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight drop-shadow-sm">
                  {userData.username}
                </h2>
                {displayName && (
                  <p className="text-cyan-300/80 text-sm mt-1">"{displayName}"</p>
                )}
                {userData.registeredAt > 0 && (
                  <p className="text-slate-500 text-xs mt-1">
                    Member since {new Date(userData.registeredAt * 1000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                  </p>
                )}
                <div className="flex flex-col gap-1 mt-4">
                  <span className="text-slate-500 text-xs">Connected wallet</span>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span className="text-slate-400 font-mono text-xs sm:text-sm truncate max-w-full">{userData.shortAddress || walletAddress}</span>
                    <button
                    type="button"
                    onClick={copyAddress}
                    className="p-2 rounded-lg bg-white/5 hover:bg-cyan-500/20 border border-white/10 text-cyan-300 transition shrink-0"
                    title="Copy address"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                  </div>
                </div>
                {/* Smart wallet: show the best-known value (registry or account), without contradictions */}
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span className="text-slate-500 text-xs">Smart wallet:</span>
                    {smartWalletAddress && smartWalletAddress !== '0x0000000000000000000000000000000000000000' ? (
                      <>
                        <span className="text-cyan-300/90 font-mono text-xs truncate max-w-full">{`${smartWalletAddress.slice(0, 6)}...${smartWalletAddress.slice(-4)}`}</span>
                        {accountSmartWallet && isValidWallet(registrySmartWallet) && accountSmartWallet.toLowerCase() !== (registrySmartWallet as string).toLowerCase() ? (
                          <span className="text-[10px] text-slate-500">
                            (account: {accountSmartWallet.slice(0, 6)}...{accountSmartWallet.slice(-4)})
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(smartWalletAddress); toast.success('Smart wallet address copied'); }}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 border border-white/10 text-cyan-300 transition shrink-0"
                          title="Copy smart wallet"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <span className="text-slate-500 text-xs italic">
                        {guestLoading ? "Loading…" : "— (register in-game to get one)"}
                      </span>
                    )}
                  </div>
                  {isConnected && smartWalletAddress && smartWalletAddress !== '0x0000000000000000000000000000000000000000' && (
                    <button
                      type="button"
                      onClick={handleRecreateViaApi}
                      disabled={recreateApiPending}
                      className="w-full sm:w-auto px-4 py-2 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-200 text-sm font-semibold transition disabled:opacity-60"
                      title="Recreate smart wallet with safe migration"
                    >
                      {recreateApiPending ? 'Migrating…' : 'Recreate smart wallet'}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 shrink-0 w-full sm:w-[240px] justify-center sm:justify-start">
                {showDualWallets && (
                  <div className="flex items-center justify-center sm:justify-start gap-2">
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
                )}

                <div className="flex flex-row sm:flex-col gap-3 shrink-0 w-full sm:w-auto justify-center sm:justify-start">
                  {[
                    {
                      label: 'TYC',
                      value:
                        activeWalletView === 'smart'
                          ? (tycBalanceSmart.isLoading ? '...' : Number(tycBalanceSmart.data?.formatted || 0).toFixed(2))
                          : (tycBalance.isLoading ? '...' : Number(tycBalance.data?.formatted || 0).toFixed(2)),
                      color: 'cyan',
                    },
                    {
                      label: 'USDC',
                      value:
                        activeWalletView === 'smart'
                          ? (usdcBalanceSmart.isLoading ? '...' : Number(usdcBalanceSmart.data?.formatted || 0).toFixed(2))
                          : (usdcBalance.isLoading ? '...' : Number(usdcBalance.data?.formatted || 0).toFixed(2)),
                      color: 'emerald',
                    },
                    {
                      label: chainId === 137 || chainId === 80001 ? 'Polygon' : chainId === 42220 || chainId === 44787 ? 'Celo' : chainId === 8453 || chainId === 84531 ? 'Base' : 'Native',
                      value:
                        activeWalletView === 'smart'
                          ? (ethBalanceSmart ? Number(ethBalanceSmart.formatted).toFixed(4) : '0')
                          : (ethBalance ? Number(ethBalance.formatted).toFixed(4) : '0'),
                      color: 'slate',
                    },
                  ].map(({ label, value, color }) => (
                    <div key={label} className={`flex-1 sm:flex-none text-center py-3 px-4 rounded-2xl min-w-0 balance-pill balance-${color}`}>
                      <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-white/50">{label}</p>
                      <p className="text-base sm:text-lg font-bold text-white truncate mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
                {isConnected && smartWalletAddress && smartWalletAddress !== '0x0000000000000000000000000000000000000000' && (
                  <button
                    type="button"
                    onClick={handleRecreateViaApi}
                    disabled={recreateApiPending}
                    className="w-full mt-3 px-4 py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-200 text-sm font-semibold transition disabled:opacity-60"
                  >
                    {recreateApiPending ? 'Migrating…' : 'Recreate smart wallet'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Game stats | About you | My Perks | Reward Vouchers — one line of tabs, content below */}
        <section className="mb-8">
          <div className="flex flex-wrap gap-2 mb-4">
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
                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-semibold text-sm transition-all ${
                  profileTab === id
                    ? 'bg-cyan-500/20 border-2 border-cyan-500/50 text-cyan-200'
                    : 'bg-white/5 border border-white/10 text-white/70 hover:border-white/20 hover:text-white/90'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {badge !== undefined && badge > 0 && (
                  <span className="ml-1 min-w-[1.25rem] h-5 px-1.5 rounded-md bg-white/10 text-xs flex items-center justify-center">{badge}</span>
                )}
              </button>
            ))}
          </div>

          <div className="profile-card rounded-2xl border border-white/10 overflow-hidden min-h-[280px] max-h-[60vh] overflow-y-auto">
            {profileTab === 'stats' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 sm:p-6">
                <FirstTimeHint
                  storageKey="profile_stats"
                  message="Your stats and level progress live here. Claim rewards after games from the results screen."
                  link={{ href: '/how-to-play', label: 'How to Play' }}
                  compact
                  className="mb-4"
                />
                <div className="mb-6">
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
                    <div className="mb-4 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-medium text-cyan-400/90 uppercase tracking-widest">Level</span>
                        <span className="font-bold text-cyan-300">Level {levelInfo.level} · {levelInfo.label}</span>
                      </div>
                      {levelInfo.level < 99 && levelInfo.xpForNextLevel > 0 && (
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-cyan-500/80 transition-all duration-500"
                            style={{ width: `${Math.round(levelInfo.progress * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {[
                    { icon: BarChart2, label: 'Games played', value: String(userData.gamesPlayed), accent: 'cyan' },
                    { icon: Crown, label: 'Wins', value: String(userData.gamesWon), accent: 'amber', valueClass: 'text-amber-300' },
                    { icon: Coins, label: 'Losses', value: String(userData.gamesLost), accent: 'slate', valueClass: 'text-slate-300' },
                    { icon: BarChart2, label: 'Win rate', value: userData.winRate, accent: 'emerald', valueClass: 'text-emerald-300' },
                  ].map(({ icon: Icon, label, value, accent, valueClass = 'text-white' }) => (
                    <div key={label} className={`profile-stat stat-${accent} rounded-2xl p-4 flex items-center gap-3`}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 stat-icon">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">{label}</p>
                        <p className={`font-bold text-base truncate ${valueClass}`}>{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  {[
                    { icon: Wallet, label: 'Total staked', value: formatStakeOrEarned(userData.totalStaked) + ' BLOCK', accent: 'cyan' },
                    { icon: Coins, label: 'Total earned', value: formatStakeOrEarned(userData.totalEarned) + ' BLOCK', accent: 'emerald', valueClass: 'text-emerald-300' },
                    { icon: Wallet, label: 'Total withdrawn', value: formatStakeOrEarned(userData.totalWithdrawn) + ' BLOCK', accent: 'slate', valueClass: 'text-slate-300' },
                  ].map(({ icon: Icon, label, value, accent, valueClass = 'text-white' }) => (
                    <div key={label} className={`profile-stat stat-${accent} rounded-2xl p-4 flex items-center gap-3`}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 stat-icon">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">{label}</p>
                        <p className={`font-bold text-sm truncate ${valueClass}`}>{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: BarChart2, label: 'Properties bought', value: String(userData.propertiesBought), accent: 'cyan' },
                    { icon: BarChart2, label: 'Properties sold', value: String(userData.propertiesSold), accent: 'amber', valueClass: 'text-amber-300' },
                  ].map(({ icon: Icon, label, value, accent, valueClass = 'text-white' }) => (
                    <div key={label} className={`profile-stat stat-${accent} rounded-2xl p-4 flex items-center gap-3`}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 stat-icon">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider">{label}</p>
                        <p className={`font-bold text-base truncate ${valueClass}`}>{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
            {profileTab === 'about' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-6 sm:p-8"
              >
                <p className="text-xs font-medium text-cyan-400/90 uppercase tracking-widest mb-6">Tell us about yourself</p>
                <div className="space-y-6 max-w-xl">
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">Display name</label>
                    <div className="flex gap-3 rounded-2xl bg-white/5 border border-white/10 px-4 py-3.5 focus-within:border-cyan-500/40 focus-within:bg-white/[0.07] transition-all">
                      <User className="w-5 h-5 text-cyan-400/80 shrink-0 mt-0.5" />
                      <input
                        type="text"
                        placeholder="How should we call you?"
                        value={localDisplayName}
                        onChange={(e) => setLocalDisplayName(e.target.value)}
                        onBlur={saveDisplayName}
                        className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none text-base min-w-0"
                      />
                      <button type="button" onClick={saveDisplayName} className="shrink-0 px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-sm font-semibold transition-colors">Save</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">Short bio</label>
                    {editingBio ? (
                      <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3.5 focus-within:border-cyan-500/40 focus-within:bg-white/[0.07] transition-all">
                        <div className="flex gap-3">
                          <FileText className="w-5 h-5 text-cyan-400/80 shrink-0 mt-0.5" />
                          <textarea
                            placeholder="A line or two about you — what you love, your play style, or anything you'd like others to see."
                            value={localBio}
                            onChange={(e) => setLocalBio(e.target.value)}
                            rows={4}
                            className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none text-base resize-none min-w-0 leading-relaxed"
                            autoFocus
                          />
                        </div>
                        <div className="flex justify-end gap-2 mt-3">
                          <button type="button" onClick={() => setEditingBio(false)} className="px-4 py-2 rounded-xl bg-white/10 text-white/80 hover:bg-white/15 text-sm font-semibold transition-colors">Cancel</button>
                          <button type="button" onClick={() => { saveBio(); setEditingBio(false); }} className="px-4 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-sm font-semibold transition-colors">Save bio</button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3.5 flex items-start justify-between gap-3">
                        <div className="flex gap-3 min-w-0 flex-1">
                          <FileText className="w-5 h-5 text-cyan-400/80 shrink-0 mt-0.5" />
                          <p className="text-base text-white/90 leading-relaxed whitespace-pre-wrap break-words">
                            {localBio.trim() || <span className="text-slate-500">No bio yet.</span>}
                          </p>
                        </div>
                        <button type="button" onClick={() => setEditingBio(true)} className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-sm font-semibold transition-colors">
                          <Pencil className="w-4 h-4" />
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {profileTab === 'perks' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-5 sm:p-6"
              >
                {isLoadingPerks ? (
                  <>
                    <p className="text-slate-400 text-sm text-center mb-3">Loading perks…</p>
                    <SkeletonPerkGrid count={6} gridClass="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" />
                  </>
                ) : groupedCollectibles.length === 0 ? (
                  <EmptyState
                    icon={<ShoppingBag className="w-14 h-14 text-purple-400/70" />}
                    title="No perks yet"
                    description="Perks give you in-game advantages. Buy them in the Perk Shop or during a game from My Perks."
                    action={{ label: 'Visit Perk Shop', href: '/game-shop' }}
                    compact
                    className="border-purple-500/20 bg-black/20"
                  />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {groupedCollectibles.map((item, i) => {
                      const rowKey = `${item.heldBy.toLowerCase()}-${item.perk}-${item.strength}`;
                      return (
                      <motion.div
                        key={rowKey}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        whileHover={{ y: -2 }}
                        className={`rounded-2xl p-4 text-center border transition-all bg-black/20 ${
                          selectedPerkKey === rowKey ? 'border-purple-500/50 ring-2 ring-purple-500/20' : 'border-white/10 hover:border-purple-500/30'
                        }`}
                      >
                        <div className="relative inline-block">
                          {item.icon}
                          {item.count > 1 && (
                            <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded-full bg-purple-500/90 text-white text-xs font-bold">
                              ×{item.count}
                            </span>
                          )}
                        </div>
                        <h4 className="mt-2 font-semibold text-white text-sm">{item.name}</h4>
                        {item.isTiered && item.strength > 0 && <p className="text-cyan-300/90 text-xs mt-0.5">Tier {item.strength}</p>}
                        {smartWallet && item.heldBy.toLowerCase() === smartWallet.toLowerCase() ? (
                          <p className="text-[10px] text-cyan-300/80 mt-1">Smart wallet</p>
                        ) : walletAddress && item.heldBy.toLowerCase() === walletAddress.toLowerCase() ? (
                          <p className="text-[10px] text-white/45 mt-1">Connected wallet</p>
                        ) : null}
                        {selectedPerkKey === rowKey ? (
                          <div className="mt-3 space-y-2 text-left">
                            <label className="text-[10px] font-medium text-white/50 uppercase tracking-wider block">Send to address</label>
                            <input
                              type="text"
                              placeholder="0x0000...0000"
                              value={sendAddress}
                              onChange={(e) => setSendAddress(e.target.value.trim())}
                              className="w-full px-3 py-2 rounded-lg bg-black/40 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-xs border border-white/10"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSend(item.tokenId, item.heldBy)}
                                disabled={!sendAddress || !/^0x[a-fA-F0-9]{40}$/i.test(sendAddress) || sendingTokenId === item.tokenId || isWriting || isConfirming}
                                className="flex-1 py-2 rounded-lg font-semibold text-xs bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 flex items-center justify-center gap-1.5 text-white"
                              >
                                {sendingTokenId === item.tokenId && (isWriting || isConfirming) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                {sendingTokenId === item.tokenId && (isWriting || isConfirming) ? 'Sending...' : 'Send'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedPerkKey(null)}
                                className="px-3 py-2 rounded-lg font-medium text-xs bg-white/10 text-white/80 hover:bg-white/15"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedPerkKey(rowKey)}
                            className="mt-3 w-full py-2 rounded-xl font-semibold text-xs bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 flex items-center justify-center gap-1.5 text-white"
                          >
                            <Send className="w-3 h-3" />
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
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-5 sm:p-6"
              >
                {isLoadingVouchers ? (
                  <>
                    <p className="text-slate-400 text-sm text-center mb-3">Loading vouchers…</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <SkeletonCard key={i} hasImage={false} lines={2} className="rounded-2xl p-5 border border-amber-500/20" />
                      ))}
                    </div>
                  </>
                ) : myVouchers.length === 0 ? (
                  <EmptyState
                    icon={<Ticket className="w-14 h-14 text-amber-400/70" />}
                    title="No vouchers yet"
                    description="Win games to earn reward vouchers. Redeem them here for TYC or use perks during a game."
                    compact
                    className="border-amber-500/20 bg-black/20"
                  />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {myVouchers.map((voucher) => (
                      <motion.div
                        key={`${voucher.heldBy}-${voucher.tokenId.toString()}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl p-5 text-center border border-amber-500/20 bg-black/20"
                      >
                        <Ticket className="w-10 h-10 text-amber-400 mx-auto mb-2" />
                        <p className="text-lg font-bold text-amber-200 mb-3">{voucher.value} TYC</p>
                        {smartWallet && voucher.heldBy.toLowerCase() === smartWallet.toLowerCase() ? (
                          <p className="text-[10px] text-amber-200/70 mb-2">Smart wallet</p>
                        ) : walletAddress && voucher.heldBy.toLowerCase() === walletAddress.toLowerCase() ? (
                          <p className="text-[10px] text-white/45 mb-2">Connected wallet</p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleRedeemVoucher(voucher.tokenId, voucher.heldBy)}
                          disabled={redeemingId === voucher.tokenId}
                          className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black disabled:opacity-60 flex items-center justify-center gap-2 transition"
                        >
                          {redeemingId === voucher.tokenId ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Redeeming...
                            </>
                          ) : (
                            <>
                              <Coins className="w-4 h-4" />
                              Redeem
                            </>
                          )}
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </section>

        {/* Account & login — move to bottom */}
        <section className="mt-10">
          <AccountLinkWallet />
        </section>
      </main>

      <style jsx global>{`
        .profile-page .profile-hero {
          background: linear-gradient(135deg, rgba(6, 78, 89, 0.25) 0%, rgba(4, 47, 46, 0.2) 50%, rgba(15, 23, 42, 0.4) 100%);
          backdrop-filter: blur(16px);
          box-shadow: 0 4px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 240, 255, 0.1);
        }
        .profile-page .balance-pill {
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(8px);
        }
        .profile-page .balance-cyan { border-color: rgba(0, 240, 255, 0.15); box-shadow: inset 0 0 20px rgba(0, 240, 255, 0.05); }
        .profile-page .balance-emerald { border-color: rgba(52, 211, 153, 0.15); box-shadow: inset 0 0 20px rgba(52, 211, 153, 0.05); }
        .profile-page .balance-slate { border-color: rgba(255, 255, 255, 0.08); }
        .profile-page .profile-stat {
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(8px);
        }
        .profile-page .stat-cyan .stat-icon { background: rgba(0, 240, 255, 0.12); color: rgb(34, 211, 238); }
        .profile-page .stat-amber .stat-icon { background: rgba(251, 191, 36, 0.12); color: rgb(251, 191, 36); }
        .profile-page .stat-emerald .stat-icon { background: rgba(52, 211, 153, 0.12); color: rgb(52, 211, 153); }
        .profile-page .stat-slate .stat-icon { background: rgba(148, 163, 184, 0.12); color: rgb(148, 163, 184); }
        .profile-page .profile-card {
          background: rgba(15, 23, 42, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(12px);
        }
      `}</style>
    </div>
  );
}