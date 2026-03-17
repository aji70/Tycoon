'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  useAccount,
  useChainId,
  useBalance,
  useReadContract,
  useReadContracts,
} from 'wagmi';
import { formatUnits, type Address, type Abi } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import {
  ShoppingBag,
  Coins,
  Loader2,
  CreditCard,
  Zap,
  Shield,
  Sparkles,
  Gem,
  Crown,
  Ticket,
  Wallet,
  RefreshCw,
  X,
  Percent,
  CircleDollarSign,
  MapPin,
  Banknote,
  Smartphone,
  Package,
} from 'lucide-react';
import Link from 'next/link';

import RewardABI from '@/context/abi/rewardabi.json';
import Erc20Abi from '@/context/abi/ERC20abi.json';
import { REWARD_CONTRACT_ADDRESSES } from '@/constants/contracts';

import {
  useRewardBuyCollectible,
  useRewardRedeemVoucher,
  useApprove,
  useRewardTokenAddresses,
  useUserRegistryWallet,
} from '@/context/ContractProvider';
import { useGuestAuthOptional } from '@/context/GuestAuthContext';
import { apiClient } from '@/lib/api';
import { SkeletonPerkGrid } from '@/components/ui/SkeletonCard';
import EmptyState from '@/components/ui/EmptyState';
import FirstTimeHint from '@/components/ui/FirstTimeHint';

const VOUCHER_ID_START = 1_000_000_000;
const COLLECTIBLE_ID_START = 2_000_000_000;

const isVoucherToken = (tokenId: bigint): boolean =>
  tokenId >= VOUCHER_ID_START && tokenId < COLLECTIBLE_ID_START;

const isCollectibleToken = (tokenId: bigint): boolean =>
  tokenId >= COLLECTIBLE_ID_START;

// Tiered perks: show "Tier N" badge
const TIERED_PERKS = new Set([5, 8, 9]);

// New perks not yet in contract — show in shop as "Coming Soon"
const COMING_SOON_PERK_IDS = [11, 12, 13, 14];

// Default bundles shown in UI (used when API returns empty or before migration)
const DEFAULT_BUNDLES: Array<{ id?: number; name: string; description: string | null; price_tyc: string; price_usdc: string; price_ngn?: number | null }> = [
  { name: "Starter Pack", description: "Shield, Roll Boost, and Exact Roll — great for new players.", price_tyc: "45", price_usdc: "2.5" },
  { name: "Lucky Bundle", description: "Jail Free, Teleport, and Lucky 7. Get out of tight spots.", price_tyc: "60", price_usdc: "3" },
  { name: "Defender Pack", description: "Shield, Jail Free, and Roll Boost. Stay in the game when the board turns against you.", price_tyc: "55", price_usdc: "2.75" },
  { name: "High Roller", description: "Double Rent, Roll Boost, and Exact Roll. Maximize income and land where it hurts.", price_tyc: "65", price_usdc: "3.25" },
  { name: "Cash Flow", description: "Instant Cash, Property Discount, and Tax Refund (tiered). Keep your balance healthy.", price_tyc: "70", price_usdc: "3.5" },
  { name: "Chaos Bundle", description: "Teleport, Exact Roll, and Lucky 7. Control the board and bend the dice.", price_tyc: "75", price_usdc: "4" },
  { name: "Landlord's Choice", description: "Rent Cashback, Interest, and Free Parking Bonus. Rewards for property owners and patient play.", price_tyc: "50", price_usdc: "2.5" },
  { name: "Ultimate Pack", description: "Extra Turn, Double Rent, Shield, and Lucky 7. A bit of everything to dominate the board.", price_tyc: "80", price_usdc: "4.5" },
];

type BundleLineItem = { perk: number; strength: number; quantity: number };
type BundleDef = {
  name: string;
  description: string;
  items: BundleLineItem[];
};

/**
 * Bundle composition (perk IDs + strength) for "buy in sequence" bundles.
 * Note: This buys existing stocked collectibles individually (multiple txs), since
 * on-chain bundles may not be configured in every deployment yet.
 */
const BUNDLE_DEFS: BundleDef[] = [
  { name: "Starter Pack", description: "Shield, Roll Boost, and Exact Roll — great for new players.", items: [{ perk: 7, strength: 1, quantity: 1 }, { perk: 4, strength: 1, quantity: 1 }, { perk: 10, strength: 1, quantity: 1 }] },
  { name: "Lucky Bundle", description: "Jail Free, Teleport, and Lucky 7. Get out of tight spots.", items: [{ perk: 2, strength: 1, quantity: 1 }, { perk: 6, strength: 1, quantity: 1 }, { perk: 13, strength: 1, quantity: 1 }] },
  { name: "Defender Pack", description: "Shield, Jail Free, and Roll Boost. Stay in the game when the board turns against you.", items: [{ perk: 7, strength: 1, quantity: 1 }, { perk: 2, strength: 1, quantity: 1 }, { perk: 4, strength: 1, quantity: 1 }] },
  { name: "High Roller", description: "Double Rent, Roll Boost, and Exact Roll. Maximize income and land where it hurts.", items: [{ perk: 3, strength: 1, quantity: 1 }, { perk: 4, strength: 1, quantity: 1 }, { perk: 10, strength: 1, quantity: 1 }] },
  { name: "Cash Flow", description: "Instant Cash, Property Discount, and Tax Refund (tiered). Keep your balance healthy.", items: [{ perk: 5, strength: 1, quantity: 1 }, { perk: 8, strength: 1, quantity: 1 }, { perk: 9, strength: 1, quantity: 1 }] },
  { name: "Chaos Bundle", description: "Teleport, Exact Roll, and Lucky 7. Control the board and bend the dice.", items: [{ perk: 6, strength: 1, quantity: 1 }, { perk: 10, strength: 1, quantity: 1 }, { perk: 13, strength: 1, quantity: 1 }] },
  { name: "Landlord's Choice", description: "Rent Cashback, Interest, and Free Parking Bonus. Rewards for property owners and patient play.", items: [{ perk: 11, strength: 1, quantity: 1 }, { perk: 12, strength: 1, quantity: 1 }, { perk: 14, strength: 1, quantity: 1 }] },
  { name: "Ultimate Pack", description: "A bit of everything to dominate the board.", items: [{ perk: 1, strength: 1, quantity: 1 }, { perk: 3, strength: 1, quantity: 1 }, { perk: 7, strength: 1, quantity: 1 }, { perk: 13, strength: 1, quantity: 1 }] },
];

// Perk metadata — real descriptions for shop and collectibles
const perkMetadata = [
  { perk: 1, name: "Extra Turn", desc: "Use on your turn to take an extra roll after this one. One more chance to land where you need.", icon: <Zap className="w-12 h-12 text-yellow-400" />, image: "/game/shop/a.jpeg" },
  { perk: 2, name: "Jail Free Card", desc: "Use when in Jail to get out without paying or rolling doubles. Keep your cash and stay in the game.", icon: <Crown className="w-12 h-12 text-purple-400" />, image: "/game/shop/b.jpeg" },
  { perk: 3, name: "Double Rent", desc: "When someone lands on your property, charge double the normal rent once. Maximize your income.", icon: <Coins className="w-12 h-12 text-green-400" />, image: "/game/shop/c.jpeg" },
  { perk: 4, name: "Roll Boost", desc: "Add +1 to your next dice roll (capped at 12). Nudge the odds in your favor.", icon: <Sparkles className="w-12 h-12 text-blue-400" />, image: "/game/shop/a.jpeg" },
  { perk: 5, name: "Instant Cash", desc: "Burn during a game to receive TYC based on tier (100–1000). Instant liquidity when you need it.", icon: <Gem className="w-12 h-12 text-cyan-400" />, image: "/game/shop/b.jpeg" },
  { perk: 6, name: "Teleport", desc: "Move your token to any property on the board. Buy that key lot or skip past danger.", icon: <Zap className="w-12 h-12 text-pink-400" />, image: "/game/shop/c.jpeg" },
  { perk: 7, name: "Shield", desc: "Block the next rent or fee you would pay (one use). Stay solvent when the board turns against you.", icon: <Shield className="w-12 h-12 text-indigo-400" />, image: "/game/shop/a.jpeg" },
  { perk: 8, name: "Property Discount", desc: "Get 30–50% off the next property you buy (tiered). Stretch your cash and complete sets faster.", icon: <Coins className="w-12 h-12 text-orange-400" />, image: "/game/shop/b.jpeg" },
  { perk: 9, name: "Tax Refund", desc: "Receive TYC back when you pay Income or Luxury Tax (tiered). Turn tax hits into partial recovery.", icon: <Gem className="w-12 h-12 text-teal-400" />, image: "/game/shop/c.jpeg" },
  { perk: 10, name: "Exact Roll", desc: "Choose your next roll (2–12) instead of rolling the dice. Land on the exact space you need.", icon: <Sparkles className="w-12 h-12 text-amber-400" />, image: "/game/shop/a.jpeg" },
  { perk: 11, name: "Rent Cashback", desc: "Next rent you receive is +25% extra. Great for property owners.", icon: <Percent className="w-12 h-12 text-emerald-400" />, image: "/game/shop/a.jpeg" },
  { perk: 12, name: "Interest", desc: "At the start of your next turn, receive $200. A little boost when it's your turn.", icon: <CircleDollarSign className="w-12 h-12 text-lime-400" />, image: "/game/shop/b.jpeg" },
  { perk: 13, name: "Lucky 7", desc: "Your next roll will be 7. The most common roll—land where you need.", icon: <Sparkles className="w-12 h-12 text-yellow-300" />, image: "/game/shop/c.jpeg" },
  { perk: 14, name: "Free Parking Bonus", desc: "Next time you land on Free Parking, collect $500. A classic Monopoly moment.", icon: <MapPin className="w-12 h-12 text-sky-400" />, image: "/game/shop/a.jpeg" },
];

const zeroAddress = '0x0000000000000000000000000000000000000000' as Address;
const isValidWallet = (a: string | undefined): a is Address =>
  !!a && a !== zeroAddress && a.toLowerCase() !== zeroAddress.toLowerCase();

export default function GameShop() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const auth = useGuestAuthOptional();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES] as Address | undefined;

  const { tycAddress: tycTokenAddress, usdcAddress: usdcTokenAddress } = useRewardTokenAddresses();
  const { data: registrySmartWallet } = useUserRegistryWallet(address);
  const guestSmartWallet = auth?.guestUser?.smart_wallet_address ?? undefined;
  const smartWalletAddress =
    (isValidWallet(registrySmartWallet) ? registrySmartWallet : null) ??
    (isValidWallet(guestSmartWallet) ? (guestSmartWallet as Address) : null);

  const [isVoucherPanelOpen, setIsVoucherPanelOpen] = useState(false);
  const [shopTab, setShopTab] = useState<'perks' | 'bundles'>('perks');
  const [payWith, setPayWith] = useState<'connected' | 'smart_wallet'>('connected');
  const [bundles, setBundles] = useState<Array<{ id: number; name: string; description: string | null; price_tyc: string; price_usdc: string; price_ngn?: number | null }>>([]);
  const [ngnAvailable, setNgnAvailable] = useState(false);
  const [ngnLoadingBundleId, setNgnLoadingBundleId] = useState<number | null>(null);
  const [ngnLoadingTokenId, setNgnLoadingTokenId] = useState<string | null>(null);
  const [bundleBuyingName, setBundleBuyingName] = useState<string | null>(null);

  const USDC_TO_NGN_RATE = 1600; // approximate; min charge 200 NGN

  const payerAddress = payWith === 'smart_wallet' && smartWalletAddress ? smartWalletAddress : address ?? undefined;

  const { data: usdcAllowance } = useReadContract({
  address: usdcTokenAddress,
  abi: Erc20Abi,
  functionName: 'allowance',
  args: payerAddress && contractAddress ? [payerAddress, contractAddress] : undefined,
  query: { enabled: !!payerAddress && !!usdcTokenAddress && !!contractAddress },
});


  // Buy & Redeem hooks
  const {
    buy,
    isPending: buyingPending,
    isConfirming: buyingConfirming,
    isSuccess: buySuccess,
    error: buyError,
    reset: resetBuy,
  } = useRewardBuyCollectible();

    const {
    approve,
    isPending: approvePending,
    isConfirming: approveConfirming,
    isSuccess: approveSuccess,
    error: approveError,
    reset: resetapprove,
  } = useApprove();

  const {
    redeem,
    isPending: redeemingPending,
    isConfirming: redeemingConfirming,
    isSuccess: redeemSuccess,
    error: redeemError,
    reset: resetRedeem,
  } = useRewardRedeemVoucher();

  // USDC balance (for "Buy with USDC")
  const { data: usdcBalanceData, isLoading: usdcLoading, refetch: refetchUsdc } = useBalance({
    address: payerAddress,
    token: usdcTokenAddress,
    query: { enabled: !!payerAddress && !!usdcTokenAddress && isConnected },
  });

  const usdcBalance = usdcBalanceData ? Number(usdcBalanceData.formatted).toFixed(2) : '0.00';

  const payFromSmartWalletUnsupported = payWith === 'smart_wallet'; // on-chain buy is from signer only; smart wallet payment coming later

  // ── Shop Items: Collectibles owned by contract (in shop stock) ──
  const { data: contractOwnedCount } = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'ownedTokenCount',
    args: contractAddress ? [contractAddress] : undefined,
    query: { enabled: !!contractAddress },
  });

  const contractTokenCount = Number(contractOwnedCount ?? 0);

  const contractTokenIdCalls = useMemo(
    () =>
      Array.from({ length: contractTokenCount }, (_, i) => ({
        address: contractAddress!,
        abi: RewardABI as Abi,
        functionName: 'tokenOfOwnerByIndex' as const,
        args: [contractAddress!, BigInt(i)] as const,
      })),
    [contractAddress, contractTokenCount]
  );

  const { data: contractTokenIdResults } = useReadContracts({
    contracts: contractTokenIdCalls,
    query: { enabled: contractTokenCount > 0 && !!contractAddress },
  });

  const shopTokenIds = useMemo(() => {
    return (
      contractTokenIdResults
        ?.map((res) => (res.status === 'success' ? (res.result as bigint) : undefined))
        .filter((id): id is bigint => id !== undefined && isCollectibleToken(id)) ?? []
    );
  }, [contractTokenIdResults]);

  const shopInfoCalls = useMemo(
    () =>
      shopTokenIds.map((tokenId) => ({
        address: contractAddress!,
        abi: RewardABI as Abi,
        functionName: 'getCollectibleInfo' as const,
        args: [tokenId] as const,
      })),
    [contractAddress, shopTokenIds]
  );

  const { data: shopInfoResults } = useReadContracts({
    contracts: shopInfoCalls,
    query: { enabled: shopTokenIds.length > 0 && !!contractAddress },
  });

  const shopItems = useMemo(() => {
    if (!shopInfoResults) return [];

    return shopInfoResults
      .map((result, index) => {
        if (result.status !== 'success') return null;
        const [perk, strength, tycPrice, usdcPrice, stock] = result.result as [number, bigint, bigint, bigint, bigint];
        if (stock === BigInt(0)) return null;

        const tokenId = shopTokenIds[index];
        const meta = perkMetadata.find((m) => m.perk === perk) || {
          name: `Perk #${perk}`,
          desc: 'Use during a game for a strategic advantage.',
          icon: <Gem className="w-12 h-12 text-gray-400" />,
          image: '/game/shop/placeholder.jpg',
        };

        return {
          tokenId,
          perk,
          strength: Number(strength),
          tycPrice: formatUnits(tycPrice, 18),
          usdcPrice: formatUnits(usdcPrice, 6),
          stock: Number(stock),
          comingSoon: false as const,
          ...meta,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [shopInfoResults, shopTokenIds]);

  // New perks (11–14) always appear in the shop as "Coming soon" until stocked on contract
  const allShopItems = useMemo(() => {
    const stockedPerkIds = new Set(shopItems.map((s) => s.perk));
    const comingSoonFromMeta = COMING_SOON_PERK_IDS.filter((pid) => !stockedPerkIds.has(pid)).map((pid) => {
      const meta = perkMetadata.find((m) => m.perk === pid)!;
      return { ...meta, perk: pid, comingSoon: true as const, tokenId: null as unknown as bigint, strength: 0, tycPrice: '—', usdcPrice: '—', stock: 0 };
    });
    return [...shopItems, ...comingSoonFromMeta];
  }, [shopItems]);

  // ── User Vouchers ──
  const { data: userOwnedCount } = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'ownedTokenCount',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });

  const userTokenCount = Number(userOwnedCount ?? 0);

  const userTokenIdCalls = useMemo(
    () =>
      Array.from({ length: userTokenCount }, (_, i) => ({
        address: contractAddress!,
        abi: RewardABI as Abi,
        functionName: 'tokenOfOwnerByIndex' as const,
        args: [address!, BigInt(i)] as const,
      })),
    [contractAddress, address, userTokenCount]
  );

  const { data: userTokenIdResults } = useReadContracts({
    contracts: userTokenIdCalls,
    query: { enabled: userTokenCount > 0 && !!address && !!contractAddress },
  });

  const userVoucherIds = useMemo(() => {
    return (
      userTokenIdResults
        ?.map((res) => (res.status === 'success' ? (res.result as bigint) : undefined))
        .filter((id): id is bigint => id !== undefined && isVoucherToken(id)) ?? []
    );
  }, [userTokenIdResults]);

  const voucherInfoCalls = useMemo(
    () =>
      userVoucherIds.map((tokenId) => ({
        address: contractAddress!,
        abi: RewardABI as Abi,
        functionName: 'getCollectibleInfo' as const,
        args: [tokenId] as const,
      })),
    [contractAddress, userVoucherIds]
  );

  const { data: voucherInfoResults } = useReadContracts({
    contracts: voucherInfoCalls,
    query: { enabled: userVoucherIds.length > 0 && !!contractAddress },
  });

  const myVouchers = useMemo(() => {
    if (!voucherInfoResults) return [];

    return voucherInfoResults
      .map((result, i) => {
        if (result.status !== 'success') return null;
        const [, , tycPrice] = result.result as [number, bigint, bigint, bigint, bigint];
        const tokenId = userVoucherIds[i];
        return {
          tokenId,
          value: formatUnits(tycPrice, 18),
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
  }, [voucherInfoResults, userVoucherIds]);

  // ── Handlers ──
  const handleBuy = async (item: typeof shopItems[0], useUsdc: boolean = true) => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet');
      return;
    }
    if (payWith === 'smart_wallet') {
      toast.info('To pay from your smart wallet, select "Connected wallet" above. Smart wallet payment coming soon.');
      return;
    }
    if (!useUsdc) return;
    const priceNum = Number(item.usdcPrice);
    if (Number(usdcBalance) < priceNum) {
      toast.error('Insufficient USDC balance');
      return;
    }
    const price = BigInt(Math.round(priceNum * 1e6));
    if (!usdcTokenAddress) {
      toast.error('USDC not supported on this network');
      return;
    }
    try {
      if (usdcAllowance === undefined || usdcAllowance === null) {
        toast.info('Approval required');
        await approve(usdcTokenAddress, contractAddress!, price);
        toast.success('Approval successful, completing purchase...');
      } else if (typeof usdcAllowance === 'bigint' && usdcAllowance < price) {
        toast.info('Increasing approval...');
        await approve(usdcTokenAddress, contractAddress!, price);
        toast.success('Approval successful, completing purchase...');
      }
      await buy(item.tokenId, true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      toast.error(msg);
    }
  };

  const handlePayPerkWithNaira = async (item: (typeof shopItems)[0]) => {
    if (ngnLoadingTokenId != null) return;
    try {
      if (typeof window !== 'undefined' && !window.localStorage?.getItem('token')) {
        toast.error('Please sign in to pay with Naira.');
        return;
      }
    } catch (_) {}
    const tokenIdStr = item.tokenId.toString();
    setNgnLoadingTokenId(tokenIdStr);
    try {
      const amountNgn = Math.max(200, Math.ceil(Number(item.usdcPrice) * USDC_TO_NGN_RATE));
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      const callbackUrl = `${base}/game-shop`;
      const res = await apiClient.post<{ success?: boolean; link?: string; reference?: string; message?: string }>(
        'shop/flutterwave/initialize-perk',
        { token_id: tokenIdStr, amount_ngn: amountNgn, callback_url: callbackUrl }
      );
      if (res?.data?.link) {
        window.location.href = res.data.link;
        return;
      }
      toast.error(res?.data?.message ?? 'Could not start Naira payment');
    } catch (e: unknown) {
      const status = (e as { status?: number; response?: { status?: number } })?.status ?? (e as { response?: { status?: number } })?.response?.status;
      if (status === 401) toast.error('Please sign in to pay with Naira.');
      else toast.error((e as Error)?.message ?? 'Failed to start Naira payment');
    } finally {
      setNgnLoadingTokenId(null);
    }
  };

  const resolveBundlePurchases = useMemo(() => {
    const byPerkStrength = new Map<string, Array<(typeof shopItems)[0]>>();
    for (const si of shopItems) {
      const key = `${si.perk}:${si.strength}`;
      const arr = byPerkStrength.get(key) ?? [];
      arr.push(si);
      byPerkStrength.set(key, arr);
    }
    // Prefer higher stock first
    for (const arr of byPerkStrength.values()) {
      arr.sort((a, b) => b.stock - a.stock);
    }
    return { byPerkStrength };
  }, [shopItems]);

  const canBuyBundle = (def: BundleDef) => {
    for (const li of def.items) {
      const key = `${li.perk}:${li.strength}`;
      const match = resolveBundlePurchases.byPerkStrength.get(key)?.[0];
      if (!match || match.stock < li.quantity) return false;
    }
    return true;
  };

  const handleBuyBundleWithUsdc = async (bundleName: string) => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet');
      return;
    }
    if (payWith === 'smart_wallet') {
      toast.info('To pay from your smart wallet, select "Connected wallet" above. Smart wallet payment coming soon.');
      return;
    }
    if (!contractAddress || !usdcTokenAddress) {
      toast.error('USDC not supported on this network');
      return;
    }
    const def = BUNDLE_DEFS.find((b) => b.name === bundleName);
    if (!def) {
      toast.error('Bundle not found');
      return;
    }
    if (!canBuyBundle(def)) {
      toast.error('Bundle items are not currently in stock');
      return;
    }
    if (bundleBuyingName) return;

    setBundleBuyingName(def.name);
    try {
      for (const li of def.items) {
        const key = `${li.perk}:${li.strength}`;
        const match = resolveBundlePurchases.byPerkStrength.get(key)?.[0];
        if (!match) throw new Error(`Missing perk #${li.perk} (tier ${li.strength})`);
        for (let i = 0; i < li.quantity; i++) {
          await handleBuy(match);
        }
      }
      toast.success('Bundle purchase complete!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bundle purchase failed';
      toast.error(msg);
    } finally {
      setBundleBuyingName(null);
    }
  };

  const handleRedeemVoucher = async (tokenId: bigint) => {
    if (!isConnected) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      await redeem(tokenId);
    } catch (err: any) {
      toast.error(err.message || 'Redemption failed');
    }
  };

  // ── Success/Error Toasts ──
  useEffect(() => {
    if (buySuccess) {
      toast.success('Purchase successful! 🎉');
      refetchUsdc();
      resetBuy();
    }
  }, [buySuccess, refetchUsdc, resetBuy]);

  useEffect(() => {
    if (redeemSuccess) {
      toast.success('Voucher redeemed successfully!');
      resetRedeem();
    }
  }, [redeemSuccess, resetRedeem]);

  useEffect(() => {
    if (buyError) toast.error(buyError.message || 'Purchase failed');
    if (redeemError) toast.error(redeemError.message || 'Redemption failed');
  }, [buyError, redeemError]);

  const handleBack = () => {
    const returnTo = searchParams.get('returnTo');
    if (returnTo && typeof returnTo === 'string' && returnTo.startsWith('/') && !returnTo.startsWith('//')) {
      router.push(returnTo);
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/');
  };

  const hasVouchers = myVouchers.length > 0;
  const isLoadingShop = contractTokenCount > 0 && shopItems.length === 0;

  useEffect(() => {
    apiClient.get<{ success?: boolean; ngn_available?: boolean; bundles?: Array<{ id: number; name: string; description: string | null; price_tyc: string; price_usdc: string; price_ngn?: number | null }> }>('shop/bundles').then((r) => {
      if (r?.data?.bundles) setBundles(r.data.bundles);
      if (typeof r?.data?.ngn_available === 'boolean') setNgnAvailable(r.data.ngn_available);
    }).catch(() => {});
  }, []);

  // Handle return from Flutterwave payment (redirect with ?reference= or ?tx_ref=)
  useEffect(() => {
    const ref = searchParams.get('reference') ?? searchParams.get('tx_ref');
    if (!ref) return;
    apiClient.get<{ success?: boolean; found?: boolean; fulfilled?: boolean; status?: string }>(`shop/flutterwave/verify?reference=${encodeURIComponent(ref)}`).then((r) => {
      if (r?.data?.found && r?.data?.fulfilled) {
        toast.success('Perk bought successfully! Your bundle will be available in-game.');
      } else if (r?.data?.found && r?.data?.status === 'failed') {
        toast.error('Payment failed or was not completed.');
      }
      router.replace('/game-shop', { scroll: false });
    }).catch(() => {});
  }, [searchParams, router]);

  const handlePayWithNgn = async (bundleId: number) => {
    if (!bundleId || ngnLoadingBundleId != null) return;
    try {
      if (typeof window !== 'undefined' && !window.localStorage?.getItem('token')) {
        toast.error('Please sign in to pay with NGN.');
        return;
      }
    } catch {
      // localStorage may be unavailable
    }
    setNgnLoadingBundleId(bundleId);
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      const callbackUrl = `${base}/game-shop`;
      const res = await apiClient.post<{ success?: boolean; link?: string; reference?: string; message?: string }>('shop/flutterwave/initialize-test', { bundle_id: bundleId, callback_url: callbackUrl });
      if (res?.data?.link) {
        window.location.href = res.data.link;
        return;
      }
      toast.error(res?.data?.message ?? 'Could not start payment');
    } catch (e: any) {
      const status = e?.status ?? e?.response?.status;
      if (status === 401) {
        toast.error('Please sign in to pay with NGN.');
      } else {
        const msg =
          e?.message ??
          e?.data?.message ??
          e?.response?.data?.message ??
          'Failed to initialize NGN payment';
        toast.error(msg);
      }
    } finally {
      setNgnLoadingBundleId(null);
    }
  };

  return (
    <section className="min-h-screen text-[#F0F7F7] py-8 px-4 relative overflow-hidden">
      {/* Background: gradient + subtle grid + soft glow */}
      <div className="fixed inset-0 -z-10 bg-[#010F10]" />
      <div
        className="fixed inset-0 -z-10 opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(to bottom, rgba(0, 240, 255, 0.03) 0%, transparent 40%),
            radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0, 240, 255, 0.08), transparent),
            linear-gradient(180deg, #010F10 0%, #0A1618 50%, #0E1415 100%)
          `,
        }}
      />
      <div
        className="fixed inset-0 -z-10 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2300F0FF' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-5">
            <div className="rounded-2xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 p-3.5 shadow-[0_0_30px_rgba(0,240,255,0.15)]">
              <ShoppingBag className="w-10 h-10 text-[#00F0FF]" />
            </div>
            <div>
              <p className="text-[#00F0FF]/80 text-sm font-medium tracking-widest uppercase mb-0.5 font-[family-name:var(--font-orbitron-sans)]">
                Tycoon
              </p>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight font-[family-name:var(--font-orbitron-sans)] bg-clip-text text-transparent bg-gradient-to-r from-white via-[#E0F7F8] to-[#00F0FF]">
                Perk Shop
              </h1>
            </div>
          </div>
          <button
            onClick={handleBack}
            className="group flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#003B3E] bg-[#0E1415]/80 text-[#00F0FF] hover:border-[#00F0FF]/50 hover:bg-[#00F0FF]/10 transition-all duration-300 font-medium"
          >
            <span className="group-hover:-translate-x-0.5 transition-transform">←</span> Back
          </button>
        </div>

        {/* Pay from: Connected wallet | Smart wallet */}
        {isConnected && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
            <span className="text-xs text-slate-500 uppercase tracking-wider mr-1">Pay from:</span>
            <button
              type="button"
              onClick={() => setPayWith('connected')}
              className={`min-h-[36px] px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                payWith === 'connected'
                  ? 'bg-[#00F0FF]/15 border-[#00F0FF]/50 text-[#00F0FF]'
                  : 'bg-[#0E1415]/60 border-[#003B3E] text-slate-400 hover:text-slate-300'
              }`}
            >
              <Wallet className="w-4 h-4 inline mr-2 align-middle" />
              Connected wallet
            </button>
            <button
              type="button"
              onClick={() => setPayWith('smart_wallet')}
              disabled={!smartWalletAddress}
              title={!smartWalletAddress ? 'Create a profile to get a smart wallet' : 'Show smart wallet balance'}
              className={`min-h-[36px] px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                payWith === 'smart_wallet'
                  ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                  : !smartWalletAddress
                  ? 'bg-slate-800/60 border-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-[#0E1415]/60 border-[#003B3E] text-slate-400 hover:text-slate-300'
              }`}
            >
              <Smartphone className="w-4 h-4 inline mr-2 align-middle" />
              Smart wallet
            </button>
          </div>
        )}

        {/* Balance */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl px-4 py-3 flex items-center gap-3 border border-[#003B3E]/80 bg-[#0E1415]/60 backdrop-blur-xl"
          >
            <CreditCard className="w-5 h-5 text-[#00F0FF] shrink-0" />
            <div className="text-left">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">USDC</p>
              <p className="text-base font-bold text-[#00F0FF] font-[family-name:var(--font-orbitron-sans)]">
                {usdcLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : `$${usdcBalance}`}
              </p>
            </div>
            <button onClick={() => refetchUsdc()} className="p-1 rounded text-slate-500 hover:text-[#00F0FF]">
              <RefreshCw className="w-4 h-4" />
            </button>
          </motion.div>

        </div>

        {payFromSmartWalletUnsupported && (
          <p className="text-center text-amber-200/90 text-sm mb-4">
            Payment from smart wallet is not yet available. Select Connected wallet to pay with USDC or Naira.
          </p>
        )}

        {/* Tabs: Perks | Bundles — one visible at a time */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setShopTab('perks')}
            className={`flex-1 sm:flex-none min-h-[44px] px-6 py-3 rounded-xl font-semibold transition-all ${
              shopTab === 'perks'
                ? 'bg-[#00F0FF]/20 border-2 border-[#00F0FF]/60 text-[#00F0FF]'
                : 'bg-[#0E1415]/60 border border-[#003B3E] text-slate-400 hover:border-[#003B3E]/80 hover:text-slate-300'
            }`}
          >
            Perks
          </button>
          <button
            type="button"
            onClick={() => setShopTab('bundles')}
            className={`flex-1 sm:flex-none min-h-[44px] px-6 py-3 rounded-xl font-semibold transition-all ${
              shopTab === 'bundles'
                ? 'bg-amber-500/20 border-2 border-amber-400/60 text-amber-300'
                : 'bg-[#0E1415]/60 border border-[#003B3E] text-slate-400 hover:border-[#003B3E]/80 hover:text-slate-300'
            }`}
          >
            Bundles
          </button>
        </div>

        <div className="min-h-[320px]">
          {shopTab === 'perks' && (
            <div className="mb-4 space-y-2">
              <FirstTimeHint
                storageKey="perks_in_game"
                message="You can also buy perks during a game from the My Perks button in the bottom bar."
                link={{ href: '/how-to-play', label: 'How to Play' }}
                compact
              />
              <p className="text-center text-slate-500 text-xs">
                Admins: stock perks and bundles at <Link href="/rewards?section=stock" className="text-[#00F0FF]/80 hover:underline inline-flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Rewards → Stock</Link> (open the <strong>Stock</strong> tab).
              </p>
            </div>
          )}
          {shopTab === 'bundles' && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#003B3E] to-transparent" />
              <span className="text-sm font-medium text-slate-500 uppercase tracking-[0.2em]">Bundles</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#003B3E] to-transparent" />
            </div>
            {(bundles.length > 0 ? bundles : DEFAULT_BUNDLES).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
                {(bundles.length > 0 ? bundles : DEFAULT_BUNDLES).map((b, idx) => (
                  <motion.div
                    key={b.id ?? b.name ?? idx}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col rounded-2xl overflow-hidden border border-amber-500/30 bg-[#0E1415]/60 backdrop-blur-sm"
                  >
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/40 text-[10px] font-semibold text-amber-300 uppercase">Bundle</span>
                      </div>
                      <h3 className="font-bold text-lg text-white mb-2">{b.name}</h3>
                      <p className="text-slate-400 text-sm leading-relaxed mb-4 flex-1">{b.description || ''}</p>
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[#00F0FF] font-[family-name:var(--font-orbitron-sans)] mb-4">
                        <span className="text-lg font-bold">${(typeof b.price_usdc === 'string' ? Number(b.price_usdc) : b.price_usdc).toFixed(2)} USDC</span>
                        {b.price_ngn != null && b.price_ngn > 0 && (
                          <>
                            <span className="text-slate-500">or</span>
                            <span className="text-lg font-bold">₦{Number(b.price_ngn).toLocaleString()} NGN</span>
                          </>
                        )}
                      </div>
                      <button
                        onClick={() => handleBuyBundleWithUsdc(b.name)}
                        disabled={bundleBuyingName != null || payFromSmartWalletUnsupported || !BUNDLE_DEFS.some((d) => d.name === b.name) || !canBuyBundle(BUNDLE_DEFS.find((d) => d.name === b.name) as BundleDef)}
                        className={`w-full py-3 rounded-xl font-semibold border transition-all ${
                          bundleBuyingName === b.name
                            ? 'bg-slate-700/80 text-slate-400 cursor-wait border-slate-600/50'
                            : payFromSmartWalletUnsupported || !BUNDLE_DEFS.some((d) => d.name === b.name) || !canBuyBundle(BUNDLE_DEFS.find((d) => d.name === b.name) as BundleDef)
                            ? 'bg-slate-800/80 text-slate-500 border-slate-700/80 cursor-not-allowed'
                            : 'bg-[#00F0FF]/10 text-[#00F0FF] border-[#00F0FF]/40 hover:bg-[#00F0FF]/20'
                        }`}
                      >
                        {bundleBuyingName === b.name ? (
                          <><Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Buying bundle...</>
                        ) : (
                          <><CreditCard className="w-4 h-4 inline mr-2" /> Buy with USDC</>
                        )}
                      </button>
                      {b.price_ngn != null && b.price_ngn > 0 && (
                        <button
                          onClick={() => typeof b.id === 'number' && handlePayWithNgn(b.id)}
                          disabled={!ngnAvailable || ngnLoadingBundleId != null}
                          className="w-full mt-2 py-3 rounded-xl font-semibold border border-amber-400/50 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {ngnLoadingBundleId === b.id ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting to payment...</>
                          ) : (
                            <><Banknote className="w-4 h-4" /> Buy with Naira — ₦{Number(b.price_ngn).toLocaleString()}</>
                          )}
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : null}
          </div>
          )}

          {shopTab === 'perks' && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#003B3E] to-transparent" />
              <span className="text-sm font-medium text-slate-500 uppercase tracking-[0.2em]">Perks</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#003B3E] to-transparent" />
            </div>

            {/* Perks grid */}
            {isLoadingShop ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <p className="text-slate-400 text-sm text-center">Loading perks...</p>
            <SkeletonPerkGrid count={6} gridClass="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-x-4 gap-y-6 items-stretch" />
          </motion.div>
        ) : allShopItems.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <EmptyState
              icon={<ShoppingBag className="w-16 h-16 text-slate-500" />}
              title="No perks in stock yet"
              description="Perks give you in-game advantages. Buy them here or in the Perk Shop during a game. New perks will appear when they're added—check back soon or play games to earn vouchers."
            />
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-x-4 gap-y-6 items-stretch">
            {allShopItems.map((item, index) => {
              const isProcessing = buyingPending || buyingConfirming;
              const isComingSoon = 'comingSoon' in item && item.comingSoon;

              return (
                <motion.div
                  key={isComingSoon ? `coming-soon-${item.perk}` : item.tokenId.toString()}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-20px' }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                  className={`group flex flex-col rounded-2xl overflow-hidden border backdrop-blur-sm transition-all duration-300 ${
                    isComingSoon ? 'border-[#003B3E]/60 bg-[#0E1415]/50 opacity-90' : 'border-[#003B3E]/80 bg-[#0E1415]/70 hover:border-[#00F0FF]/40 hover:shadow-[0_0_40px_rgba(0,240,255,0.08),0_20px_40px_rgba(0,0,0,0.3)]'
                  }`}
                  whileHover={isComingSoon ? undefined : { y: -4 }}
                >
                  <div className="relative h-48 min-h-[12rem] overflow-hidden flex-shrink-0">
                    <Image
                      src={item.image || '/game/shop/placeholder.jpg'}
                      alt={item.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      {!isComingSoon && TIERED_PERKS.has(item.perk) && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/30 text-[10px] font-semibold text-amber-300 uppercase tracking-wider">
                          Tier {item.strength}
                        </span>
                      )}
                      {isComingSoon ? (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-xs font-semibold text-amber-300 uppercase tracking-wider">
                          Coming soon
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-black/50 border border-white/10 text-xs font-medium text-slate-300">
                          {item.stock} left
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3">
                      <div className="rounded-xl bg-black/30 backdrop-blur-sm p-2 border border-white/10">
                        {item.icon}
                      </div>
                      <span className="font-bold text-lg text-white drop-shadow-lg">{item.name}</span>
                    </div>
                  </div>

                  <div className="p-5 flex flex-col flex-1 min-h-0">
                    <p className="text-slate-400 text-sm leading-relaxed mb-4 line-clamp-2 flex-shrink-0">{item.desc}</p>

                    {!isComingSoon && (
                      <div className="flex justify-between items-end gap-4 mb-4 mt-auto flex-wrap">
                        <div className="flex flex-col gap-1">
                          <p className="text-xs text-slate-500 uppercase tracking-wider">Price</p>
                          <p className="text-lg font-bold text-[#00F0FF] font-[family-name:var(--font-orbitron-sans)]">${Number(item.usdcPrice).toFixed(2)} USDC</p>
                        </div>
                      </div>
                    )}

                    {isComingSoon ? (
                      <>
                        <button
                          disabled
                          className="w-full py-4 rounded-xl font-bold bg-slate-800/80 text-slate-500 border border-slate-700/80 cursor-not-allowed mt-auto"
                        >
                          Buy with USDC — Coming soon
                        </button>
                        <button
                          disabled
                          className="w-full mt-2 py-2.5 rounded-lg font-medium text-sm bg-slate-800/60 text-slate-500 border border-slate-700/60 cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          <Banknote className="w-4 h-4" />
                          Buy with Naira — Coming soon
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleBuy(item)}
                          disabled={item.stock === 0 || isProcessing || Number(usdcBalance) < Number(item.usdcPrice) || payFromSmartWalletUnsupported}
                          className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2.5 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1415] ${
                            item.stock === 0
                              ? 'bg-slate-800/80 text-slate-500 cursor-not-allowed'
                              : Number(usdcBalance) < Number(item.usdcPrice)
                              ? 'bg-slate-700/80 text-slate-400 cursor-not-allowed'
                              : isProcessing
                              ? 'bg-amber-600/90 text-black cursor-wait shadow-lg shadow-amber-500/30'
                              : 'bg-gradient-to-r from-[#00F0FF] to-[#0DD6E0] text-black hover:shadow-[0_0_30px_rgba(0,240,255,0.4)] hover:brightness-110'
                          }`}
                        >
                          {isProcessing ? (
                            <> <Loader2 className="w-5 h-5 animate-spin" /> Purchasing... </>
                          ) : item.stock === 0 ? (
                            'Sold Out'
                          ) : Number(usdcBalance) < Number(item.usdcPrice) ? (
                            'Insufficient USDC'
                          ) : payFromSmartWalletUnsupported ? (
                            <>Use Connected wallet to pay</>
                          ) : (
                            <> <CreditCard className="w-5 h-5" /> Buy with USDC — ${Number(item.usdcPrice).toFixed(2)} </>
                          )}
                        </button>
                        <button
                          onClick={() => handlePayPerkWithNaira(item)}
                          disabled={item.stock === 0 || payFromSmartWalletUnsupported || ngnLoadingTokenId === item.tokenId.toString()}
                          className="w-full mt-2 py-2.5 rounded-lg font-medium text-sm bg-amber-500/20 border border-amber-400/50 text-amber-200 hover:bg-amber-500/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {ngnLoadingTokenId === item.tokenId.toString() ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Banknote className="w-4 h-4" />
                          )}
                          Buy with Naira
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
          </div>
          )}
        </div>

        {/* Voucher Teaser FAB */}
        <AnimatePresence>
          {hasVouchers && !isVoucherPanelOpen && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 20 }}
              onClick={() => setIsVoucherPanelOpen(true)}
              className="fixed right-8 bottom-8 z-40 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-black font-bold py-5 px-6 shadow-[0_10px_40px_rgba(251,191,36,0.4)] border border-amber-400/30 flex items-center gap-4 hover:scale-105 hover:shadow-[0_15px_50px_rgba(251,191,36,0.5)] transition-all"
            >
              <Ticket className="w-8 h-8" />
              <div className="text-left">
                <p className="text-xs opacity-90">You have</p>
                <p className="text-2xl font-black">{myVouchers.length} Voucher{myVouchers.length > 1 ? 's' : ''}</p>
              </div>
              <span className="text-lg">→</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Voucher Panel */}
        <AnimatePresence>
          {isVoucherPanelOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsVoucherPanelOpen(false)}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
              />

              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="fixed right-0 top-0 h-full w-full max-w-md bg-gradient-to-b from-[#0A1A1C] to-[#071012] shadow-2xl z-50 overflow-y-auto border-l border-amber-600/40"
              >
                <div className="p-8">
                  <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-bold font-[family-name:var(--font-orbitron-sans)] flex items-center gap-3">
                      <div className="rounded-xl bg-amber-500/20 p-2 border border-amber-500/30">
                        <Ticket className="w-8 h-8 text-amber-400" />
                      </div>
                      My Vouchers ({myVouchers.length})
                    </h2>
                    <button
                      onClick={() => setIsVoucherPanelOpen(false)}
                      className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  {myVouchers.length === 0 ? (
                    <EmptyState
                      icon={<Ticket className="w-14 h-14 text-amber-500/70" />}
                      title="No vouchers yet"
                      description="Win games to earn reward vouchers, or buy perks in the Perk Shop to get in-game advantages."
                      compact
                      className="border-amber-500/20 bg-amber-950/10"
                    />
                  ) : (
                    <div className="grid gap-5">
                      {myVouchers.map((voucher) => {
                        const isProcessing = redeemingPending || redeemingConfirming;

                        return (
                          <motion.div
                            key={voucher.tokenId.toString()}
                            whileHover={{ scale: 1.02 }}
                            className="rounded-2xl p-6 border border-amber-600/40 bg-gradient-to-br from-amber-950/30 to-orange-950/20 flex flex-col items-center text-center"
                          >
                            <Ticket className="w-14 h-14 text-amber-400 mb-4" />
                            <p className="text-2xl font-bold text-amber-300 font-[family-name:var(--font-orbitron-sans)]">Value: {voucher.value}</p>
                            <p className="text-sm text-slate-500 mt-2 mb-6">ID: {voucher.tokenId.toString()}</p>

                            <button
                              onClick={() => handleRedeemVoucher(voucher.tokenId)}
                              disabled={isProcessing}
                              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                                isProcessing
                                  ? 'bg-slate-700/80 text-slate-400 cursor-wait'
                                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black hover:shadow-lg hover:shadow-amber-500/30'
                              }`}
                            >
                              {isProcessing ? (
                                <> <Loader2 className="w-5 h-5 animate-spin" /> Redeeming... </>
                              ) : (
                                <> <Coins className="w-5 h-5" /> Redeem Now </>
                              )}
                            </button>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-16 text-center p-10 rounded-2xl border border-[#003B3E]/80 bg-[#0E1415]/50 backdrop-blur-sm"
          >
            <Wallet className="w-14 h-14 mx-auto mb-4 text-[#00F0FF]/50" />
            <h3 className="text-xl font-bold mb-2">Connect your wallet</h3>
            <p className="text-slate-400 max-w-md mx-auto">
              Connect your wallet to buy perks and redeem vouchers.
            </p>
          </motion.div>
        )}
      </div>
    </section>
  );
}