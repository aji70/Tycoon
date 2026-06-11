'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAccount, useBalance, useReadContract, useReadContracts } from 'wagmi';
import { formatUnits, isAddress, type Address, type Abi } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { getContractErrorMessage } from '@/lib/utils/contractErrors';
import { toastContractError, toastTransactionOutcome } from '@/lib/utils/contractErrorToast';
import { pickMinipayPreferredStable } from '@/lib/shop/preferredStable';
import { STABLE_DISPLAY_SYMBOL } from '@/constants/stableDisplay';
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
} from 'lucide-react';

import RewardABI from '@/context/abi/rewardabi.json';
import Erc20Abi from '@/context/abi/ERC20abi.json';
import { REWARD_CONTRACT_ADDRESSES } from '@/constants/contracts';
import { shopPerkRow } from '@/lib/shopPerkRow';
import { isShopPerkHidden } from '@/lib/perkShopAssets';
import { useMiniPayShop, isMiniPayBrowser } from '@/hooks/useMiniPayShop';

import {
  useRewardBuyCollectible,
  useRewardRedeemVoucher,
  useRewardRedeemVoucherFor,
  useApprove,
  useRewardTokenAddresses,
  useUserRegistryWallet,
  useReadChainIdOrCelo,
} from '@/context/ContractProvider';
import { useGuestAuthOptional } from '@/context/GuestAuthContext';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
import { SkeletonPerkGrid } from '@/components/ui/SkeletonCard';
import EmptyState from '@/components/ui/EmptyState';
import {
  buildMergedHolderSlotCalls,
  buildTokenOfOwnerByIndexSlotCalls,
  mergeSlotScanResultsForHolders,
  REWARD_OWNED_SLOT_SCAN_CAP,
  takeTokenIdsUntilFirstFailure,
} from '@/lib/rewardOwnedEnumerable';
import { shopRegistryOwnerAddress, shopSmartWalletAddress } from '@/lib/shopWalletIdentity';

const VOUCHER_ID_START = 1_000_000_000;
const COLLECTIBLE_ID_START = 2_000_000_000;

const isVoucherToken = (tokenId: bigint): boolean =>
  tokenId >= VOUCHER_ID_START && tokenId < COLLECTIBLE_ID_START;

const isCollectibleToken = (tokenId: bigint): boolean =>
  tokenId >= COLLECTIBLE_ID_START;

// Tiered perks: show "Tier N" badge
const TIERED_PERKS = new Set([5, 8, 9]);
type StableSymbol = 'USDC' | 'CUSDC' | 'USDT';
type StableOption = { symbol: StableSymbol; tokenAddress?: Address; paymentToken: number; balance: number };
const REWARD_COLLECTIBLE_INFO_EXTENDED_ABI = [
  {
    type: 'function',
    name: 'getCollectibleInfoExtended',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [
      { type: 'uint8' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
    ],
  },
] as const;

// Perk metadata — names/images from lib/perkShopAssets (same card art as profile)
const perkMetadata = [
  shopPerkRow(1, "Use on your turn to take an extra roll after this one. One more chance to land where you need.", <Zap className="w-12 h-12 text-yellow-400" />),
  shopPerkRow(2, "Use when in Jail to get out without paying or rolling doubles. Keep your cash and stay in the game.", <Crown className="w-12 h-12 text-purple-400" />),
  shopPerkRow(3, "When someone lands on your property, charge double the normal rent once. Maximize your income.", <Coins className="w-12 h-12 text-green-400" />),
  shopPerkRow(4, "Add +1 to your next dice roll (capped at 12). Nudge the odds in your favor.", <Sparkles className="w-12 h-12 text-blue-400" />),
  shopPerkRow(5, "Burn during a game to receive TYC based on tier (100–1000). Instant liquidity when you need it.", <Gem className="w-12 h-12 text-cyan-400" />),
  shopPerkRow(6, "Move your token to any property on the board. Buy that key lot or skip past danger.", <Zap className="w-12 h-12 text-pink-400" />),
  shopPerkRow(7, "Block the next rent or fee you would pay (one use). Stay solvent when the board turns against you.", <Shield className="w-12 h-12 text-indigo-400" />),
  shopPerkRow(8, "Get 30–50% off the next property you buy (tiered). Stretch your cash and complete sets faster.", <Coins className="w-12 h-12 text-orange-400" />),
  shopPerkRow(9, "Receive TYC back when you pay Income or Luxury Tax (tiered). Turn tax hits into partial recovery.", <Gem className="w-12 h-12 text-teal-400" />),
  shopPerkRow(10, "Choose your next roll (2–12) instead of rolling the dice. Land on the exact space you need.", <Sparkles className="w-12 h-12 text-amber-400" />),
  shopPerkRow(11, "Next rent you receive is +25% extra. Great for property owners.", <Percent className="w-12 h-12 text-emerald-400" />),
  shopPerkRow(12, "At the start of your next turn, receive $200. A little boost when it's your turn.", <CircleDollarSign className="w-12 h-12 text-lime-400" />),
  shopPerkRow(13, "Your next roll will be 7. The most common roll—land where you need.", <Sparkles className="w-12 h-12 text-yellow-300" />),
  shopPerkRow(14, "Next time you land on Free Parking, collect $500. A classic Monopoly moment.", <MapPin className="w-12 h-12 text-sky-400" />),
];

const zeroAddress = '0x0000000000000000000000000000000000000000' as Address;
const isValidWallet = (a: string | undefined): a is Address =>
  !!a && a !== zeroAddress && a.toLowerCase() !== zeroAddress.toLowerCase();

export default function GameShop() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { open: openWallet } = useAppKit();
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { address: appKitAddress, isConnected: appKitConnected } = useAppKitAccount();
  const miniPayShop = useMiniPayShop();
  const address = useMemo((): Address | undefined => {
    const a = appKitAddress ?? wagmiAddress;
    return a && isAddress(a) ? (a as Address) : undefined;
  }, [appKitAddress, wagmiAddress]);
  const isConnected = Boolean(appKitConnected || wagmiConnected);
  const chainId = useReadChainIdOrCelo();
  const auth = useGuestAuthOptional();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES] as Address | undefined;

  const { usdcAddress: usdcTokenAddress, cusdcAddress, usdtAddress } = useRewardTokenAddresses();
  const guestUser = auth?.guestUser ?? null;

  const registryOwnerAddress = useMemo(
    () => shopRegistryOwnerAddress({ guestUser, connectedAddress: address }),
    [guestUser, address]
  );
  const { data: registrySmartWallet } = useUserRegistryWallet(registryOwnerAddress);
  const smartWalletAddress = useMemo(
    () =>
      shopSmartWalletAddress({
        guestUser,
        registrySmartWallet: registrySmartWallet as string | undefined,
      }),
    [guestUser, registrySmartWallet]
  );

  const [isVoucherPanelOpen, setIsVoucherPanelOpen] = useState(false);

  const payerAddress = address ?? undefined;

  const { data: usdcBalanceData, isLoading: usdcLoading, refetch: refetchUsdc } = useBalance({
    address: payerAddress,
    token: usdcTokenAddress,
    query: { enabled: !!payerAddress && !!usdcTokenAddress },
  });
  const { data: cusdcBalanceData, isLoading: cusdcLoading, refetch: refetchCusdc } = useBalance({
    address: payerAddress,
    token: cusdcAddress,
    query: { enabled: !!payerAddress && !!cusdcAddress },
  });
  const { data: usdtBalanceData, isLoading: usdtLoading, refetch: refetchUsdt } = useBalance({
    address: payerAddress,
    token: usdtAddress,
    query: { enabled: !!payerAddress && !!usdtAddress },
  });
  const stableOptions = useMemo<StableOption[]>(
    () => [
      { symbol: 'USDC', tokenAddress: usdcTokenAddress, paymentToken: 1, balance: Number(usdcBalanceData?.formatted ?? 0) },
      { symbol: 'CUSDC', tokenAddress: cusdcAddress, paymentToken: 2, balance: Number(cusdcBalanceData?.formatted ?? 0) },
      { symbol: 'USDT', tokenAddress: usdtAddress, paymentToken: 3, balance: Number(usdtBalanceData?.formatted ?? 0) },
    ],
    [usdcTokenAddress, cusdcAddress, usdtAddress, usdcBalanceData?.formatted, cusdcBalanceData?.formatted, usdtBalanceData?.formatted]
  );
  const preferredStable = useMemo<StableOption>(() => {
    const minipayStables = stableOptions.filter(
      (s): s is StableOption & { symbol: 'CUSDC' | 'USDT' } =>
        s.symbol === 'CUSDC' || s.symbol === 'USDT'
    );
    return pickMinipayPreferredStable(minipayStables) as StableOption;
  }, [stableOptions]);
  const activeStableLabel = STABLE_DISPLAY_SYMBOL;
  const activeStableBalance = Number.isFinite(preferredStable.balance) ? preferredStable.balance : 0;
  const stableLoading = usdcLoading || cusdcLoading || usdtLoading;

  const { data: stableAllowance } = useReadContract({
    address: preferredStable.tokenAddress,
    abi: Erc20Abi,
    functionName: 'allowance',
    args: payerAddress && contractAddress ? [payerAddress, contractAddress] : undefined,
    query: { enabled: !!payerAddress && !!preferredStable.tokenAddress && !!contractAddress },
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

  const {
    redeemFor,
    isPending: redeemForPending,
    isConfirming: redeemForConfirming,
    isSuccess: redeemForSuccess,
    error: redeemForError,
    reset: resetRedeemFor,
  } = useRewardRedeemVoucherFor();

  const shopTxToastKeyRef = useRef<string | null>(null);

  const resetShopWrites = useCallback(() => {
    resetBuy();
    resetapprove();
  }, [resetBuy, resetapprove]);

  const notifyShopTxOutcome = useCallback((error: unknown, fallback: string) => {
    const key =
      typeof error === 'object' && error !== null
        ? `${(error as { name?: string }).name ?? ''}:${(error as { message?: string }).message ?? ''}:${(error as { shortMessage?: string }).shortMessage ?? ''}`
        : String(error);
    if (shopTxToastKeyRef.current === key) return;
    shopTxToastKeyRef.current = key;
    toastTransactionOutcome(error, fallback);
    window.setTimeout(() => {
      if (shopTxToastKeyRef.current === key) shopTxToastKeyRef.current = null;
    }, 4000);
  }, []);

  useEffect(() => {
    resetShopWrites();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clear stale wagmi errors once on shop mount
  }, []);

  // ── Shop Items: Collectibles owned by contract (in shop stock) ──
  const contractTokenIdCalls = useMemo(() => {
    if (!contractAddress) return [];
    return buildTokenOfOwnerByIndexSlotCalls(contractAddress, RewardABI as Abi, contractAddress, chainId, REWARD_OWNED_SLOT_SCAN_CAP);
  }, [contractAddress, chainId]);

  const { data: contractTokenIdResults, isPending: contractTokenIdsPending } = useReadContracts({
    contracts: contractTokenIdCalls,
    query: { enabled: !!contractAddress },
  });

  const shopTokenIds = useMemo(() => {
    const scanned = takeTokenIdsUntilFirstFailure(contractTokenIdResults);
    return scanned.filter((id) => isCollectibleToken(id));
  }, [contractTokenIdResults]);

  const shopInfoCalls = useMemo(
    () =>
      shopTokenIds.map((tokenId) => ({
        address: contractAddress!,
        abi: REWARD_COLLECTIBLE_INFO_EXTENDED_ABI as Abi,
        functionName: 'getCollectibleInfoExtended' as const,
        args: [tokenId] as const,
      })),
    [contractAddress, shopTokenIds]
  );

  const { data: shopInfoResults, isPending: shopCollectibleInfosPending } = useReadContracts({
    contracts: shopInfoCalls,
    query: { enabled: shopTokenIds.length > 0 && !!contractAddress },
  });

  const shopItems = useMemo(() => {
    if (!shopInfoResults) return [];

    return shopInfoResults
      .map((result, index) => {
        if (result.status !== 'success') return null;
        const [perk, strength, tycPrice, usdcPrice, cusdcPrice, usdtPrice, stock] = result.result as [number, bigint, bigint, bigint, bigint, bigint, bigint];
        if (stock === BigInt(0)) return null;
        if (isShopPerkHidden(Number(perk))) return null;

        const tokenId = shopTokenIds[index];
        const meta = perkMetadata.find((m) => m.perk === perk) || {
          name: `Perk #${perk}`,
          desc: 'Use during a game for a strategic advantage.',
          icon: <Gem className="w-12 h-12 text-gray-400" />,
          image: '/game/shop/placeholder.jpg',
        };

        const usdcPriceStr = formatUnits(usdcPrice, 6);

        return {
          tokenId,
          perk,
          strength: Number(strength),
          tycPrice: formatUnits(tycPrice, 18),
          usdcPrice: usdcPriceStr,
          cusdcPrice: formatUnits(cusdcPrice, 6),
          usdtPrice: formatUnits(usdtPrice, 6),
          stock: Number(stock),
          comingSoon: false as const,
          ...meta,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [shopInfoResults, shopTokenIds]);

  // ── User vouchers: union of connected wallet + smart wallet (readable without signing)
  const voucherOwners = useMemo((): Address[] => {
    const list: Address[] = [];
    const seen = new Set<string>();
    const push = (a: Address | null | undefined) => {
      if (!a || !isValidWallet(a)) return;
      const k = a.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      list.push(a);
    };
    push(smartWalletAddress);
    push(address);
    return list;
  }, [smartWalletAddress, address]);

  const voucherSlotCalls = useMemo(() => {
    if (!contractAddress || voucherOwners.length === 0) return [];
    return buildMergedHolderSlotCalls(contractAddress, RewardABI as Abi, voucherOwners, chainId, REWARD_OWNED_SLOT_SCAN_CAP);
  }, [contractAddress, voucherOwners, chainId]);

  const { data: voucherSlotResults } = useReadContracts({
    contracts: voucherSlotCalls,
    query: { enabled: voucherSlotCalls.length > 0 && !!contractAddress },
  });

  const vouchersWithOwner = useMemo(() => {
    const { tokenIds, heldBy } = mergeSlotScanResultsForHolders(voucherOwners, voucherSlotResults, REWARD_OWNED_SLOT_SCAN_CAP);
    const out: Array<{ tokenId: bigint; voucherOwner: Address }> = [];
    tokenIds.forEach((tokenId, i) => {
      if (isVoucherToken(tokenId)) out.push({ tokenId, voucherOwner: heldBy[i]! });
    });
    return out;
  }, [voucherOwners, voucherSlotResults]);

  const voucherInfoCalls = useMemo(
    () =>
      vouchersWithOwner.map(({ tokenId }) => ({
        address: contractAddress!,
        abi: RewardABI as Abi,
        functionName: 'getCollectibleInfo' as const,
        args: [tokenId] as const,
      })),
    [vouchersWithOwner, contractAddress]
  );

  const { data: voucherInfoResults } = useReadContracts({
    contracts: voucherInfoCalls,
    query: { enabled: voucherInfoCalls.length > 0 && !!contractAddress },
  });

  const myVouchers = useMemo(() => {
    if (!voucherInfoResults) return [];

    return voucherInfoResults
      .map((result, i) => {
        if (result.status !== 'success') return null;
        const [, , tycPrice] = result.result as [number, bigint, bigint, bigint, bigint];
        const { tokenId, voucherOwner } = vouchersWithOwner[i];
        return {
          tokenId,
          voucherOwner,
          value: formatUnits(tycPrice, 18),
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);
  }, [voucherInfoResults, vouchersWithOwner]);

  // ── Handlers ──
  const handleBuy = async (item: typeof shopItems[0]) => {
    if (!isConnected || !address) {
      openWallet();
      toast.info('Connect your wallet to buy perks');
      return;
    }
    if (!usdtAddress || !contractAddress) {
      toast.error('USDT not supported on this network');
      return;
    }
    const priceNum = Number(item.usdtPrice || 0);
    if (activeStableBalance < priceNum) {
      toast.error(`Insufficient ${activeStableLabel} balance`);
      return;
    }
    const price = BigInt(Math.round(priceNum * 1e6));
    const paymentTokenAddress = preferredStable.tokenAddress;
    const paymentToken = preferredStable.paymentToken;
    if (!paymentTokenAddress || !contractAddress) {
      toast.error(`${activeStableLabel} not supported on this network`);
      return;
    }
    try {
      // MiniPay: bypass viem and use raw eth_sendTransaction
      if (isMiniPayBrowser() && isConnected && address) {
        const txHash = await miniPayShop.sendERC20Transfer(
          paymentTokenAddress,
          contractAddress,
          price
        );
        if (!txHash) throw new Error('Transaction failed');
        // Refetch balance after successful on-chain transfer
        refetchUsdc();
        refetchCusdc();
        refetchUsdt();
        toast.success('Purchase successful!');
        return;
      }

      if (stableAllowance === undefined || stableAllowance === null) {
        toast.info('Approval required');
        await approve(paymentTokenAddress, contractAddress, price);
        toast.success('Approval successful, completing purchase...');
      } else if (typeof stableAllowance === 'bigint' && stableAllowance < price) {
        toast.info('Increasing approval...');
        await approve(paymentTokenAddress, contractAddress, price);
        toast.success('Approval successful, completing purchase...');
      }
      await buy(item.tokenId, paymentToken);
    } catch (err: unknown) {
      notifyShopTxOutcome(err, 'Purchase failed');
      resetShopWrites();
    }
  };

  const handleRedeemVoucher = async (tokenId: bigint, voucherOwner: Address) => {
    if (!isConnected || !address) {
      openWallet();
      toast.info('Connect your wallet to redeem');
      return;
    }

    try {
      if (address.toLowerCase() === voucherOwner.toLowerCase()) {
        await redeem(tokenId);
      } else {
        await redeemFor(voucherOwner, tokenId);
      }
    } catch (err: unknown) {
      notifyShopTxOutcome(err, 'Redemption failed');
      resetRedeem();
      resetRedeemFor();
    }
  };

  // ── Success/Error Toasts ──
  useEffect(() => {
    if (buySuccess) {
      toast.success('Purchase successful!');
      refetchUsdc();
      refetchCusdc();
      refetchUsdt();
      resetBuy();
    }
  }, [buySuccess, refetchUsdc, refetchCusdc, refetchUsdt, resetBuy]);

  useEffect(() => {
    if (redeemSuccess) {
      toast.success('Voucher redeemed successfully!');
      resetRedeem();
    }
  }, [redeemSuccess, resetRedeem]);

  useEffect(() => {
    if (redeemForSuccess) {
      toast.success('Voucher redeemed successfully!');
      resetRedeemFor();
    }
  }, [redeemForSuccess, resetRedeemFor]);

  // Wagmi may set `error` without throwing; one toast for shared write state across buy/approve hooks.
  useEffect(() => {
    const txError = buyError ?? approveError;
    if (!txError) return;
    notifyShopTxOutcome(txError, 'Purchase failed');
    resetShopWrites();
  }, [buyError, approveError, notifyShopTxOutcome, resetShopWrites]);

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
  const isLoadingShop =
    (!!contractAddress && contractTokenIdsPending) ||
    (shopTokenIds.length > 0 && shopCollectibleInfosPending);

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

        {/* Balance */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl px-4 py-3 flex items-center gap-3 border border-[#003B3E]/80 bg-[#0E1415]/60 backdrop-blur-xl"
          >
            <CreditCard className="w-5 h-5 text-[#00F0FF] shrink-0" />
            <div className="text-left">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{activeStableLabel} (auto)</p>
              <p className="text-base font-bold text-[#00F0FF] font-[family-name:var(--font-orbitron-sans)]">
                {stableLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : payerAddress ? `$${activeStableBalance.toFixed(2)}` : '—'}
              </p>
              {payerAddress && (
                <p className="text-[10px] text-slate-500 mt-0.5">Connected wallet</p>
              )}
            </div>
            <button onClick={() => { refetchUsdc(); refetchCusdc(); refetchUsdt(); }} className="p-1 rounded text-slate-500 hover:text-[#00F0FF]">
              <RefreshCw className="w-4 h-4" />
            </button>
          </motion.div>

        </div>

        <div className="min-h-[320px]">
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
        ) : shopItems.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <EmptyState
              icon={<ShoppingBag className="w-16 h-16 text-slate-500" />}
              title="No perks in stock yet"
              description="Perks give you in-game advantages. Buy them here or in the Perk Shop during a game. New perks will appear when they're added—check back soon or play games to earn vouchers."
            />
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-x-4 gap-y-6 items-stretch">
            {shopItems.map((item, index) => {
              const isProcessing = buyingPending || buyingConfirming || approvePending || approveConfirming;

              return (
                <motion.div
                  key={item.tokenId.toString()}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-20px' }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                  className="group flex flex-col rounded-2xl overflow-hidden border backdrop-blur-sm transition-all duration-300 border-[#003B3E]/80 bg-[#0E1415]/70 hover:border-[#00F0FF]/40 hover:shadow-[0_0_40px_rgba(0,240,255,0.08),0_20px_40px_rgba(0,0,0,0.3)]"
                  whileHover={{ y: -4 }}
                >
                  <div className="relative h-56 min-h-[14rem] overflow-hidden flex-shrink-0 bg-black/60">
                    <Image
                      src={item.image || '/game/shop/placeholder.jpg'}
                      alt={item.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-contain p-3 transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 px-4 pt-3 pb-0 border-t border-white/5 bg-[#0E1415]/40">
                    {TIERED_PERKS.has(item.perk) && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/30 text-[10px] font-semibold text-amber-300 uppercase tracking-wider">
                        Tier {item.strength}
                      </span>
                    )}
                    <span className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-xs font-medium text-slate-300">
                      {item.stock} left
                    </span>
                  </div>

                  <div className="p-5 flex flex-col flex-1 min-h-0 pt-4">
                    <h3 className="font-bold text-lg text-white mb-2">{item.name}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed mb-4 line-clamp-2 flex-shrink-0">{item.desc}</p>

                    <div className="flex justify-between items-end gap-4 mb-4 mt-auto flex-wrap">
                      <div className="flex flex-col gap-1">
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Price</p>
                        <p className="text-lg font-bold text-[#00F0FF] font-[family-name:var(--font-orbitron-sans)]">
                          ${Number(item.usdtPrice).toFixed(2)} {activeStableLabel}
                        </p>
                      </div>
                    </div>

                    <>
                        <button
                          onClick={() => handleBuy(item)}
                          disabled={item.stock === 0 || isProcessing || !isConnected || !address || activeStableBalance < Number(item.usdtPrice)}
                          className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2.5 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1415] ${
                            item.stock === 0
                              ? 'bg-slate-800/80 text-slate-500 cursor-not-allowed'
                              : activeStableBalance < Number(item.usdtPrice)
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
                          ) : !isConnected || !address ? (
                            <>Connect wallet to buy</>
                          ) : activeStableBalance < Number(item.usdtPrice) ? (
                            `Insufficient ${activeStableLabel}`
                          ) : (
                            <> <CreditCard className="w-5 h-5" /> Pay with USDT — ${Number(item.usdtPrice).toFixed(2)} </>
                          )}
                        </button>
                    </>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
          </div>
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

                  {!isConnected && myVouchers.length > 0 && (
                    <p className="text-sm text-amber-200/85 mb-6 rounded-xl border border-amber-500/25 bg-amber-950/20 px-3 py-2">
                      Connect your wallet to redeem. Redemption is signed in your wallet only (no backend transaction).
                    </p>
                  )}

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
                        const isProcessing =
                          redeemingPending ||
                          redeemingConfirming ||
                          redeemForPending ||
                          redeemForConfirming;

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
                              onClick={() => handleRedeemVoucher(voucher.tokenId, voucher.voucherOwner)}
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