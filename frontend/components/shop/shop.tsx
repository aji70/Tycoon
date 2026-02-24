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
} from 'lucide-react';

import RewardABI from '@/context/abi/rewardabi.json';
import Erc20Abi from '@/context/abi/ERC20abi.json';
import {
  REWARD_CONTRACT_ADDRESSES,
  TYC_TOKEN_ADDRESS,
  USDC_TOKEN_ADDRESS,
} from '@/constants/contracts';

// Import user-facing reward hooks
import {
  useRewardBuyCollectible,
  useRewardRedeemVoucher,
  useRewardCollectibleInfo,
  useApprove,
} from '@/context/ContractProvider'; // Adjust path if needed

const VOUCHER_ID_START = 1_000_000_000;
const COLLECTIBLE_ID_START = 2_000_000_000;

const isVoucherToken = (tokenId: bigint): boolean =>
  tokenId >= VOUCHER_ID_START && tokenId < COLLECTIBLE_ID_START;

const isCollectibleToken = (tokenId: bigint): boolean =>
  tokenId >= COLLECTIBLE_ID_START;

// Perk metadata
const perkMetadata = [
  { perk: 1, name: "Extra Turn", desc: "Get +1 extra turn!", icon: <Zap className="w-12 h-12 text-yellow-400" />, image: "/game/shop/a.jpeg" },
  { perk: 2, name: "Jail Free Card", desc: "Escape jail instantly!", icon: <Crown className="w-12 h-12 text-purple-400" />, image: "/game/shop/b.jpeg" },
  { perk: 3, name: "Double Rent", desc: "Next rent doubled!", icon: <Coins className="w-12 h-12 text-green-400" />, image: "/game/shop/c.jpeg" },
  { perk: 4, name: "Roll Boost", desc: "Bonus to next roll!", icon: <Sparkles className="w-12 h-12 text-blue-400" />, image: "/game/shop/a.jpeg" },
  { perk: 5, name: "Instant Cash", desc: "Burn for tiered TYC!", icon: <Gem className="w-12 h-12 text-cyan-400" />, image: "/game/shop/b.jpeg" },
  { perk: 6, name: "Teleport", desc: "Move to any property!", icon: <Zap className="w-12 h-12 text-pink-400" />, image: "/game/shop/c.jpeg" },
  { perk: 7, name: "Shield", desc: "Protect from rent/fees!", icon: <Shield className="w-12 h-12 text-indigo-400" />, image: "/game/shop/a.jpeg" },
  { perk: 8, name: "Property Discount", desc: "30-50% off next buy!", icon: <Coins className="w-12 h-12 text-orange-400" />, image: "/game/shop/b.jpeg" },
  { perk: 9, name: "Tax Refund", desc: "Tiered tax cash back!", icon: <Gem className="w-12 h-12 text-teal-400" />, image: "/game/shop/c.jpeg" },
  { perk: 10, name: "Exact Roll", desc: "Choose exact roll 2-12!", icon: <Sparkles className="w-12 h-12 text-amber-400" />, image: "/game/shop/a.jpeg" },
];

export default function GameShop() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES] as Address | undefined;

  const tycTokenAddress = TYC_TOKEN_ADDRESS[chainId as keyof typeof TYC_TOKEN_ADDRESS] as Address | undefined;
  const usdcTokenAddress = USDC_TOKEN_ADDRESS[chainId as keyof typeof USDC_TOKEN_ADDRESS] as Address | undefined;

  const [useUsdc, setUseUsdc] = useState(false);
  const [isVoucherPanelOpen, setIsVoucherPanelOpen] = useState(false);

  const { data: tycAllowance } = useReadContract({
  address: tycTokenAddress,
  abi: Erc20Abi,
  functionName: 'allowance',
  args: address && contractAddress ? [address, contractAddress] : undefined,
  query: { enabled: !!address && !!tycTokenAddress && !!contractAddress },
});

const { data: usdcAllowance } = useReadContract({
  address: usdcTokenAddress,
  abi: Erc20Abi,
  functionName: 'allowance',
  args: address && contractAddress ? [address, contractAddress] : undefined,
  query: { enabled: !!address && !!usdcTokenAddress && !!contractAddress },
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

  // Balances
  const { data: tycBalanceData, isLoading: tycLoading, refetch: refetchTyc } = useBalance({
    address,
    token: tycTokenAddress,
    query: { enabled: !!address && !!tycTokenAddress && isConnected },
  });

  const { data: usdcBalanceData, isLoading: usdcLoading, refetch: refetchUsdc } = useBalance({
    address,
    token: usdcTokenAddress,
    query: { enabled: !!address && !!usdcTokenAddress && isConnected },
  });

  const tycBalance = tycBalanceData ? Number(tycBalanceData.formatted).toFixed(2) : '0.00';
  const usdcBalance = usdcBalanceData ? Number(usdcBalanceData.formatted).toFixed(2) : '0.00';

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
          desc: 'Powerful game advantage',
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
          ...meta,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [shopInfoResults, shopTokenIds]);

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
 const handleBuy = async (item: typeof shopItems[0]) => {
  if (!isConnected || !address) {
    toast.error('Please connect your wallet');
    return;
  }

  try {
    const isPayingWithUsdc = useUsdc;

    const price = BigInt(
      isPayingWithUsdc
        ? Math.round(Number(item.usdcPrice) * 1e6)
        : Math.round(Number(item.tycPrice) * 1e18)
    );

    const allowance = isPayingWithUsdc ? usdcAllowance : tycAllowance;
    const tokenAddress = isPayingWithUsdc ? usdcTokenAddress : tycTokenAddress;

    if (!tokenAddress) {
      toast.error('Token not supported on this network');
      return;
    }

    // ── 1️⃣ Check allowance with proper type narrowing ──
    if (allowance === undefined || allowance === null) {
      toast.info('Approval required');
      await approve(tokenAddress, contractAddress!, price);
      toast.success('Approval successful, completing purchase...');
    } else if (typeof allowance === 'bigint' && allowance < price) {
      toast.info('Increasing approval...');
      await approve(tokenAddress, contractAddress!, price);
      toast.success('Approval successful, completing purchase...');
    }
    // If allowance is sufficient, skip approval

    // ── 2️⃣ Buy collectible ──
    await buy(item.tokenId, isPayingWithUsdc);
  } catch (err: any) {
    toast.error(err.message || 'Transaction failed');
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
      refetchTyc();
      refetchUsdc();
      resetBuy();
    }
  }, [buySuccess, refetchTyc, refetchUsdc, resetBuy]);

  useEffect(() => {
    if (redeemSuccess) {
      toast.success('Voucher redeemed successfully!');
      refetchTyc();
      resetRedeem();
    }
  }, [redeemSuccess, refetchTyc, resetRedeem]);

  useEffect(() => {
    if (buyError) toast.error(buyError.message || 'Purchase failed');
    if (redeemError) toast.error(redeemError.message || 'Redemption failed');
  }, [buyError, redeemError]);

  const handleBack = () => router.push('/');

  const hasVouchers = myVouchers.length > 0;
  const isLoadingShop = contractTokenCount > 0 && shopItems.length === 0;

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
            <span className="group-hover:-translate-x-0.5 transition-transform">←</span> Back to Game
          </button>
        </div>

        {/* Balances + Payment — compact single row */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl px-4 py-3 flex items-center gap-3 border border-[#003B3E]/80 bg-[#0E1415]/60 backdrop-blur-xl"
          >
            <Wallet className="w-5 h-5 text-[#00F0FF] shrink-0" />
            <div className="text-left">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">TYC</p>
              <p className="text-base font-bold text-[#00F0FF] font-[family-name:var(--font-orbitron-sans)]">
                {tycLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : `${tycBalance}`}
              </p>
            </div>
            <button onClick={() => refetchTyc()} className="p-1 rounded text-slate-500 hover:text-[#00F0FF]">
              <RefreshCw className="w-4 h-4" />
            </button>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
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
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="rounded-xl px-4 py-3 border border-[#00F0FF]/20 bg-[#003B3E]/30"
          >
            <button
              onClick={() => setUseUsdc(!useUsdc)}
              className="flex items-center gap-2 font-medium text-sm text-[#00F0FF]"
            >
              Pay with {useUsdc ? 'USDC' : 'TYC'}
            </button>
          </motion.div>
        </div>

        {/* Section label */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#003B3E] to-transparent" />
          <span className="text-sm font-medium text-slate-500 uppercase tracking-[0.2em]">Available perks</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#003B3E] to-transparent" />
        </div>

        {/* Shop Grid — rows & columns */}
        {isLoadingShop ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col justify-center items-center py-24"
          >
            <div className="rounded-full border-2 border-[#00F0FF]/30 border-t-[#00F0FF] w-14 h-14 animate-spin mb-6" />
            <p className="text-slate-400 text-lg">Loading perks...</p>
          </motion.div>
        ) : shopItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-24 px-8 rounded-3xl border border-[#003B3E]/60 bg-[#0E1415]/40 backdrop-blur-sm"
          >
            <ShoppingBag className="w-16 h-16 mx-auto mb-6 text-slate-600" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No collectibles yet</h3>
            <p className="text-slate-500 max-w-md mx-auto">New perks will appear here. Check back soon!</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-x-6 gap-y-8 items-stretch">
            {shopItems.map((item, index) => {
              const isProcessing = buyingPending || buyingConfirming;

              return (
                <motion.div
                  key={item.tokenId.toString()}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-20px' }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                  whileHover={{ y: -4 }}
                  className="group flex flex-col rounded-2xl overflow-hidden border border-[#003B3E]/80 bg-[#0E1415]/70 backdrop-blur-sm transition-all duration-300 hover:border-[#00F0FF]/40 hover:shadow-[0_0_40px_rgba(0,240,255,0.08),0_20px_40px_rgba(0,0,0,0.3)]"
                >
                  <div className="relative h-48 min-h-[12rem] overflow-hidden flex-shrink-0">
                    <Image
                      src={item.image || '/game/shop/placeholder.jpg'}
                      alt={item.name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/50 border border-white/10 text-xs font-medium text-slate-300">
                      Stock {item.stock}
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

                    <div className="flex justify-between items-end mb-4 mt-auto">
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Price</p>
                        <p className="text-xl font-bold text-[#00F0FF] font-[family-name:var(--font-orbitron-sans)]">
                          ${item.usdcPrice}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleBuy(item)}
                      disabled={item.stock === 0 || isProcessing}
                      className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2.5 transition-all duration-300 ${
                        item.stock === 0
                          ? 'bg-slate-800/80 text-slate-500 cursor-not-allowed'
                          : isProcessing
                          ? 'bg-amber-600/90 text-black cursor-wait shadow-lg shadow-amber-500/30'
                          : 'bg-gradient-to-r from-[#00F0FF] to-[#0DD6E0] text-black hover:shadow-[0_0_30px_rgba(0,240,255,0.4)] hover:brightness-110'
                      }`}
                    >
                      {isProcessing ? (
                        <> <Loader2 className="w-5 h-5 animate-spin" /> Purchasing... </>
                      ) : item.stock === 0 ? (
                        'Sold Out'
                      ) : (
                        <> <Coins className="w-5 h-5" /> Buy Now </>
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

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
                    <p className="text-center text-slate-500 py-20">No vouchers found.</p>
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
                            <p className="text-2xl font-bold text-amber-300 font-[family-name:var(--font-orbitron-sans)]">{voucher.value} TYC</p>
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