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
import { useRouter } from 'next/navigation';
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
  ArrowLeft,
  Percent,
  CircleDollarSign,
  MapPin,
} from 'lucide-react';

import RewardABI from '@/context/abi/rewardabi.json';
import Erc20Abi from '@/context/abi/ERC20abi.json';
import { REWARD_CONTRACT_ADDRESSES } from '@/constants/contracts';

import {
  useRewardBuyCollectible,
  useRewardRedeemVoucher,
  useApprove,
  useRewardTokenAddresses,
} from '@/context/ContractProvider';
import { apiClient } from '@/lib/api';

const VOUCHER_ID_START = 1_000_000_000;
const COLLECTIBLE_ID_START = 2_000_000_000;

const isVoucherToken = (tokenId: bigint) =>
  tokenId >= VOUCHER_ID_START && tokenId < COLLECTIBLE_ID_START;

const isCollectibleToken = (tokenId: bigint) => tokenId >= COLLECTIBLE_ID_START;

const TIERED_PERKS = new Set([5, 8, 9]);

// New perks not yet in contract — show in shop as "Coming Soon"
const COMING_SOON_PERK_IDS = [11, 12, 13, 14];

// Default bundles shown in UI (used when API returns empty or before migration)
const DEFAULT_BUNDLES: Array<{ id?: number; name: string; description: string | null; price_tyc: string; price_usdc: string }> = [
  { name: "Starter Pack", description: "Shield, Roll Boost, and Exact Roll — great for new players.", price_tyc: "45", price_usdc: "2.5" },
  { name: "Lucky Bundle", description: "Jail Free, Teleport, and Lucky 7. Get out of tight spots.", price_tyc: "60", price_usdc: "3" },
  { name: "Defender Pack", description: "Shield, Jail Free, and Roll Boost. Stay in the game when the board turns against you.", price_tyc: "55", price_usdc: "2.75" },
  { name: "High Roller", description: "Double Rent, Roll Boost, and Exact Roll. Maximize income and land where it hurts.", price_tyc: "65", price_usdc: "3.25" },
  { name: "Cash Flow", description: "Instant Cash, Property Discount, and Tax Refund (tiered). Keep your balance healthy.", price_tyc: "70", price_usdc: "3.5" },
  { name: "Chaos Bundle", description: "Teleport, Exact Roll, and Lucky 7. Control the board and bend the dice.", price_tyc: "75", price_usdc: "4" },
  { name: "Landlord's Choice", description: "Rent Cashback, Interest, and Free Parking Bonus. Rewards for property owners and patient play.", price_tyc: "50", price_usdc: "2.5" },
];

const perkMetadata = [
  { perk: 1, name: "Extra Turn", desc: "Use on your turn to take an extra roll after this one.", icon: <Zap />, image: "/game/shop/a.jpeg" },
  { perk: 2, name: "Jail Free Card", desc: "Use when in Jail to get out without paying or rolling doubles.", icon: <Crown />, image: "/game/shop/b.jpeg" },
  { perk: 3, name: "Double Rent", desc: "When someone lands on your property, charge double the normal rent once.", icon: <Coins />, image: "/game/shop/c.jpeg" },
  { perk: 4, name: "Roll Boost", desc: "Add +1 to your next dice roll (capped at 12).", icon: <Sparkles />, image: "/game/shop/a.jpeg" },
  { perk: 5, name: "Instant Cash", desc: "Burn to receive TYC based on tier (100–1000).", icon: <Gem />, image: "/game/shop/b.jpeg" },
  { perk: 6, name: "Teleport", desc: "Move your token to any property on the board.", icon: <Zap />, image: "/game/shop/c.jpeg" },
  { perk: 7, name: "Shield", desc: "Block the next rent or fee you would pay (one use).", icon: <Shield />, image: "/game/shop/a.jpeg" },
  { perk: 8, name: "Property Discount", desc: "Get 30–50% off the next property you buy (tiered).", icon: <Coins />, image: "/game/shop/b.jpeg" },
  { perk: 9, name: "Tax Refund", desc: "Receive TYC back when you pay Income or Luxury Tax (tiered).", icon: <Gem />, image: "/game/shop/c.jpeg" },
  { perk: 10, name: "Exact Roll", desc: "Choose your next roll (2–12) instead of rolling the dice.", icon: <Sparkles />, image: "/game/shop/a.jpeg" },
  { perk: 11, name: "Rent Cashback", desc: "Next rent you receive is +25% extra.", icon: <Percent />, image: "/game/shop/a.jpeg" },
  { perk: 12, name: "Interest", desc: "At the start of your next turn, receive $200.", icon: <CircleDollarSign />, image: "/game/shop/b.jpeg" },
  { perk: 13, name: "Lucky 7", desc: "Your next roll will be 7.", icon: <Sparkles />, image: "/game/shop/c.jpeg" },
  { perk: 14, name: "Free Parking Bonus", desc: "Land on Free Parking to collect $500.", icon: <MapPin />, image: "/game/shop/a.jpeg" },
];

export default function GameShopMobile() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES] as Address | undefined;
  const { usdcAddress: usdcTokenAddress } = useRewardTokenAddresses();

  const [isVoucherPanelOpen, setIsVoucherPanelOpen] = useState(false);
  const [bundles, setBundles] = useState<Array<{ id: number; name: string; description: string | null; price_tyc: string; price_usdc: string }>>([]);

  useEffect(() => {
    apiClient.get<{ success?: boolean; bundles?: Array<{ id: number; name: string; description: string | null; price_tyc: string; price_usdc: string }> }>('shop/bundles').then((r) => {
      if (r?.data?.bundles) setBundles(r.data.bundles);
    }).catch(() => {});
  }, []);

  // Prevent body scroll when voucher panel is open
  useEffect(() => {
    if (isVoucherPanelOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isVoucherPanelOpen]);

  // USDC Allowance
  const { data: usdcAllowance } = useReadContract({
    address: usdcTokenAddress,
    abi: Erc20Abi,
    functionName: 'allowance',
    args: address && contractAddress ? [address, contractAddress] : undefined,
    query: { enabled: !!address && !!usdcTokenAddress && !!contractAddress },
  });

  // Buy / Approve / Redeem hooks
  const { buy, isPending: buyingPending, isConfirming: buyingConfirming, isSuccess: buySuccess, error: buyError, reset: resetBuy } = useRewardBuyCollectible();
  const { approve, isPending: approvePending, isSuccess: approveSuccess, error: approveError, reset: resetApprove } = useApprove();
  const { redeem, isPending: redeemingPending, isConfirming: redeemingConfirming, isSuccess: redeemSuccess, error: redeemError, reset: resetRedeem } = useRewardRedeemVoucher();

  // USDC Balance
  const { data: usdcBalanceData, isLoading: usdcLoading, refetch: refetchUsdc } = useBalance({
    address,
    token: usdcTokenAddress,
    query: { enabled: !!address && !!usdcTokenAddress && isConnected },
  });

  const usdcBalance = usdcBalanceData ? Number(usdcBalanceData.formatted).toFixed(2) : '0.00';

  // Shop Items: Collectibles owned by contract (in shop stock)
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

  // New perks (11–14) always in shop as "Coming soon" until stocked
  const allShopItems = useMemo(() => {
    const stockedPerkIds = new Set(shopItems.map((s) => s.perk));
    const comingSoonFromMeta = COMING_SOON_PERK_IDS.filter((pid) => !stockedPerkIds.has(pid)).map((pid) => {
      const meta = perkMetadata.find((m) => m.perk === pid)!;
      return { ...meta, perk: pid, comingSoon: true as const, tokenId: null as unknown as bigint, strength: 0, tycPrice: '—', usdcPrice: '—', stock: 0 };
    });
    return [...shopItems, ...comingSoonFromMeta];
  }, [shopItems]);

  // User Vouchers
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

  // Handlers
  const handleBuy = async (item: typeof shopItems[0]) => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!usdcTokenAddress) {
      toast.error('USDC not supported on this network');
      return;
    }

    const priceNum = Number(item.usdcPrice);
    if (Number(usdcBalance) < priceNum) {
      toast.error('Insufficient USDC balance');
      return;
    }

    try {
      const price = BigInt(Math.round(priceNum * 1e6));

      if (usdcAllowance === undefined || usdcAllowance === null) {
        toast.info('Approval required');
        await approve(usdcTokenAddress, contractAddress!, price);
        toast.success('Approval successful');
      } else if (typeof usdcAllowance === 'bigint' && usdcAllowance < price) {
        toast.info('Increasing approval...');
        await approve(usdcTokenAddress, contractAddress!, price);
        toast.success('Approval updated');
      }

      await buy(item.tokenId, true); // true = use USDC
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      toast.error(msg);
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

  // Success / Error toasts
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

  const handleBack = () => router.push('/');

  return (
    <div className="min-h-screen text-white pb-24 relative">
      {/* Background */}
      <div className="fixed inset-0 -z-10 bg-[#010F10]" />
      <div
        className="fixed inset-0 -z-10 opacity-50"
        style={{
          background: 'linear-gradient(180deg, rgba(0, 240, 255, 0.02) 0%, transparent 30%, #0A1415 100%)',
        }}
      />

      {/* Sticky Header */}
      <div className="sticky top-0 z-30 border-b border-[#003B3E]/60 bg-[#010F10]/85 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-4 max-w-xl mx-auto">
          <button
            onClick={handleBack}
            className="p-2.5 -ml-2 rounded-xl text-[#00F0FF] hover:bg-[#00F0FF]/10 transition"
          >
            <ArrowLeft size={26} />
          </button>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/20 p-2">
              <ShoppingBag size={22} className="text-[#00F0FF]" />
            </div>
            <h1 className="text-xl font-bold tracking-tight font-[family-name:var(--font-orbitron-sans)] bg-clip-text text-transparent bg-gradient-to-r from-white to-[#00F0FF]">
              Perk Shop
            </h1>
          </div>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-4 pt-6 pb-32 max-w-xl mx-auto space-y-8">
        {/* USDC Balance — compact */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl px-4 py-3 flex items-center justify-between border border-[#003B3E]/80 bg-[#0E1415]/60 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-[#00F0FF]" />
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">USDC</p>
              <p className="text-lg font-bold text-[#00F0FF] font-[family-name:var(--font-orbitron-sans)]">
                {usdcLoading ? <Loader2 className="inline animate-spin" size={18} /> : `$${usdcBalance}`}
              </p>
            </div>
          </div>
          <button onClick={() => refetchUsdc()} className="text-xs text-[#00F0FF] flex items-center gap-1">
            <RefreshCw size={12} /> Refresh
          </button>
        </motion.div>

        {/* Bundles */}
        {(bundles.length > 0 ? bundles : DEFAULT_BUNDLES).length > 0 && (
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[#003B3E]/80" />
              <span className="text-xs text-slate-500 uppercase tracking-widest">Bundles</span>
              <div className="h-px flex-1 bg-[#003B3E]/80" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(bundles.length > 0 ? bundles : DEFAULT_BUNDLES).map((b, idx) => (
                <motion.div
                  key={b.id ?? b.name ?? idx}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl p-4 border border-amber-500/20 bg-[#0E1415]/50"
                >
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-[9px] font-semibold text-amber-300 uppercase">Bundle</span>
                  <h3 className="font-bold text-base text-white mt-2">{b.name}</h3>
                  <p className="text-slate-500 text-xs mt-1 line-clamp-2">{b.description || ''}</p>
                  <p className="text-[#00F0FF] font-semibold text-sm mt-2">{b.price_tyc} TYC or ${b.price_usdc} USDC</p>
                  <button disabled className="w-full mt-3 py-2.5 rounded-lg bg-slate-800/80 text-slate-500 text-sm font-medium">Coming soon</button>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Section label */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[#003B3E]/80" />
          <span className="text-xs text-slate-500 uppercase tracking-widest">Perks</span>
          <div className="h-px flex-1 bg-[#003B3E]/80" />
        </div>

        {/* Shop Items */}
        {!isConnected ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 px-6 rounded-2xl border border-[#003B3E]/60 bg-[#0E1415]/40"
          >
            <Wallet size={48} className="mx-auto mb-4 text-[#00F0FF]/50" />
            <h3 className="text-lg font-bold mb-2">Connect your wallet</h3>
            <p className="text-slate-400 text-sm">
              Connect your wallet to purchase game perks with USDC
            </p>
          </motion.div>
        ) : allShopItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20 rounded-2xl border border-[#003B3E]/60 bg-[#0E1415]/40"
          >
            <ShoppingBag size={56} className="mx-auto mb-6 text-slate-600" />
            <p className="text-lg font-medium text-slate-400">Shop is currently empty</p>
            <p className="text-sm text-slate-500 mt-2">New perks will appear here when available. Play games or check back later!</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5">
            {allShopItems.map((item, index) => {
              const isComingSoon = 'comingSoon' in item && item.comingSoon;
              return (
                <motion.div
                  key={isComingSoon ? `coming-soon-${item.perk}` : item.tokenId.toString()}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.03 }}
                  className={`group flex flex-col rounded-xl overflow-hidden border backdrop-blur-sm transition-all ${
                    isComingSoon ? 'border-[#003B3E]/50 bg-[#0E1415]/40 opacity-90' : 'border-[#003B3E]/70 bg-[#0E1415]/70 active:scale-[0.98]'
                  }`}
                >
                  <div className="relative aspect-[4/3] w-full flex-shrink-0">
                    <Image
                      src={item.image || '/game/shop/placeholder.jpg'}
                      alt={item.name}
                      fill
                      className="object-cover transition-transform duration-500 group-active:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                      {!isComingSoon && TIERED_PERKS.has(item.perk) && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/30 text-[9px] font-semibold text-amber-300 uppercase">
                          T{item.strength}
                        </span>
                      )}
                      {isComingSoon ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/40 text-[9px] font-semibold text-amber-300 uppercase">
                          Coming soon
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-black/50 text-[10px] font-medium text-slate-300">
                          {item.stock} left
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="font-bold text-base leading-tight text-white drop-shadow-lg">{item.name}</p>
                    </div>
                  </div>

                  <div className="p-3 flex flex-col flex-1 min-h-0">
                    <p className="text-[11px] text-slate-500 mb-2 line-clamp-2 flex-shrink-0">{item.desc}</p>

                    {!isComingSoon && (
                      <div className="flex justify-between items-end mb-3 mt-auto">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase">Price</p>
                          <p className="text-base font-bold text-[#00F0FF] font-[family-name:var(--font-orbitron-sans)]">${item.usdcPrice} USDC</p>
                        </div>
                      </div>
                    )}

                    {isComingSoon ? (
                      <button disabled className="w-full py-3 rounded-xl font-semibold text-sm bg-slate-800/80 text-slate-500 border border-slate-700/80">
                        Coming soon
                      </button>
                    ) : (
                      (() => {
                        const insufficientUsdc = Number(usdcBalance) < Number(item.usdcPrice);
                        return (
                          <button
                            onClick={() => handleBuy(item)}
                            disabled={item.stock === 0 || buyingPending || buyingConfirming || insufficientUsdc}
                            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1415]
                              ${item.stock === 0
                                ? 'bg-slate-800/80 text-slate-500'
                                : insufficientUsdc
                                ? 'bg-slate-700/80 text-slate-400'
                                : buyingPending || buyingConfirming
                                ? 'bg-amber-600/90 text-black'
                                : 'bg-gradient-to-r from-[#00F0FF] to-[#0DD6E0] text-black active:brightness-110'}`}
                          >
                            {buyingPending || buyingConfirming ? (
                              <Loader2 className="inline animate-spin mr-2" size={16} />
                            ) : item.stock === 0 ? (
                              'Sold Out'
                            ) : insufficientUsdc ? (
                              'Insufficient USDC'
                            ) : (
                              'Buy Now'
                            )}
                          </button>
                        );
                      })()
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Voucher Button */}
      <AnimatePresence>
        {myVouchers.length > 0 && !isVoucherPanelOpen && (
          <motion.button
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            onClick={() => setIsVoucherPanelOpen(true)}
            className="fixed bottom-6 right-6 z-40 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-black font-bold py-4 px-5 shadow-[0_10px_30px_rgba(251,191,36,0.35)] border border-amber-400/30 flex items-center gap-3 active:scale-95 transition-transform"
          >
            <Ticket size={26} />
            <div className="text-left">
              <p className="text-[10px] opacity-90 uppercase tracking-wider">Vouchers</p>
              <p className="text-lg font-black">{myVouchers.length}</p>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Voucher Side Sheet */}
      <AnimatePresence>
        {isVoucherPanelOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsVoucherPanelOpen(false)}
              className="fixed inset-0 bg-black/70 z-[9999] backdrop-blur-sm"
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-gradient-to-b from-[#0A1A1C] to-[#071012] z-[10000] overflow-y-auto border-l border-amber-600/40"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-8 sticky top-0 bg-[#0A1A1C]/95 backdrop-blur-md -mx-6 -mt-6 px-6 pt-6 pb-4 z-10 border-b border-amber-600/20">
                  <h2 className="text-xl font-bold font-[family-name:var(--font-orbitron-sans)] flex items-center gap-3">
                    <div className="rounded-xl bg-amber-500/20 p-2 border border-amber-500/30">
                      <Ticket className="text-amber-400" size={24} />
                    </div>
                    My Vouchers
                  </h2>
                  <button
                    onClick={() => setIsVoucherPanelOpen(false)}
                    className="p-3 rounded-xl hover:bg-white/10 transition"
                  >
                    <X size={28} className="text-white" />
                  </button>
                </div>

                {myVouchers.length === 0 ? (
                  <div className="text-center py-20 text-slate-500">
                    <Ticket size={56} className="mx-auto mb-6 opacity-30" />
                    <p>No vouchers available yet</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {myVouchers.map((v) => (
                      <motion.div
                        key={v.tokenId.toString()}
                        className="rounded-2xl p-5 border border-amber-600/40 bg-gradient-to-br from-amber-950/40 to-orange-950/30"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-2xl font-bold text-amber-300 font-[family-name:var(--font-orbitron-sans)]">{v.value} TYC</p>
                            <p className="text-sm text-slate-500 mt-1">ID: {v.tokenId.toString()}</p>
                          </div>
                          <Ticket className="text-amber-400" size={36} />
                        </div>

                        <button
                          onClick={() => handleRedeemVoucher(v.tokenId)}
                          disabled={redeemingPending || redeemingConfirming}
                          className={`w-full py-4 rounded-xl font-bold transition-all
                            ${redeemingPending || redeemingConfirming
                              ? 'bg-slate-700/80 text-slate-400'
                              : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-lg shadow-amber-500/20'}`}
                        >
                          {redeemingPending || redeemingConfirming ? (
                            <Loader2 className="animate-spin inline mr-2" />
                          ) : 'Redeem Now'}
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}