'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAccount, useBalance, useReadContract, useReadContracts } from 'wagmi';
import { formatUnits, isAddress, type Address, type Abi } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import EmptyState from '@/components/ui/EmptyState';
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
import { shopPerkRow } from '@/lib/shopPerkRow';
import { isShopPerkHidden } from '@/lib/perkShopAssets';
import { isMiniPayBrowser, useMiniPayShop } from '@/hooks/useMiniPayShop';
import { encodeFunctionData } from 'viem';

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
import {
  buildMergedHolderSlotCalls,
  buildTokenOfOwnerByIndexSlotCalls,
  mergeSlotScanResultsForHolders,
  REWARD_OWNED_SLOT_SCAN_CAP,
  takeTokenIdsUntilFirstFailure,
} from '@/lib/rewardOwnedEnumerable';
import { shopRegistryOwnerAddress, shopSmartWalletAddress } from '@/lib/shopWalletIdentity';
import { getContractErrorMessage } from '@/lib/utils/contractErrors';
import { toastContractError, toastTransactionOutcome } from '@/lib/utils/contractErrorToast';
import { isUserRejectedTransaction } from '@/lib/utils/contractErrors';
import { pickMinipayPreferredStable } from '@/lib/shop/preferredStable';
import { STABLE_DISPLAY_SYMBOL } from '@/constants/stableDisplay';

const VOUCHER_ID_START = 1_000_000_000;
const COLLECTIBLE_ID_START = 2_000_000_000;

const isVoucherToken = (tokenId: bigint) =>
  tokenId >= VOUCHER_ID_START && tokenId < COLLECTIBLE_ID_START;

const isCollectibleToken = (tokenId: bigint) => tokenId >= COLLECTIBLE_ID_START;

const zeroAddress = '0x0000000000000000000000000000000000000000' as Address;
const isValidWallet = (a: string | undefined): a is Address =>
  !!a && a !== zeroAddress && a.toLowerCase() !== zeroAddress.toLowerCase();

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

const perkMetadata = [
  shopPerkRow(1, "Use on your turn to take an extra roll after this one.", <Zap />),
  shopPerkRow(2, "Use when in Jail to get out without paying or rolling doubles.", <Crown />),
  shopPerkRow(3, "When someone lands on your property, charge double the normal rent once.", <Coins />),
  shopPerkRow(4, "Add +1 to your next dice roll (capped at 12).", <Sparkles />),
  shopPerkRow(5, "Burn to receive TYC based on tier (100–1000).", <Gem />),
  shopPerkRow(6, "Move your token to any property on the board.", <Zap />),
  shopPerkRow(7, "Block the next rent or fee you would pay (one use).", <Shield />),
  shopPerkRow(8, "Get 30–50% off the next property you buy (tiered).", <Coins />),
  shopPerkRow(9, "Receive TYC back when you pay Income or Luxury Tax (tiered).", <Gem />),
  shopPerkRow(10, "Choose your next roll (2–12) instead of rolling the dice.", <Sparkles />),
  shopPerkRow(11, "Next rent you receive is +25% extra.", <Percent />),
  shopPerkRow(12, "At the start of your next turn, receive $200.", <CircleDollarSign />),
  shopPerkRow(13, "Your next roll will be 7.", <Sparkles />),
  shopPerkRow(14, "Land on Free Parking to collect $500.", <MapPin />),
];

const BUY_COLLECTIBLE_ABI = [
  {
    type: 'function',
    name: 'buyCollectible',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256' }, { type: 'uint8' }],
    outputs: [],
  },
] as const;

const getFeeCurrencyAddress = (tokenAddress: Address): Address => {
  const USDT_ADDRESS = '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e' as Address;
  const USDC_ADDRESS = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' as Address;
  const USDT_ADAPTER = (process.env.NEXT_PUBLIC_USDT_ADAPTER as Address) || '0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72' as Address;
  const USDC_ADAPTER = (process.env.NEXT_PUBLIC_USDC_ADAPTER as Address) || '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B' as Address;

  if (tokenAddress?.toLowerCase() === USDT_ADDRESS.toLowerCase()) return USDT_ADAPTER;
  if (tokenAddress?.toLowerCase() === USDC_ADDRESS.toLowerCase()) return USDC_ADAPTER;
  return tokenAddress;
};

export default function GameShopMobile() {
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

  // Allowances (for selected payer)
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
  // Buy / Approve / Redeem hooks
  const { buy, isPending: buyingPending, isConfirming: buyingConfirming, isSuccess: buySuccess, error: buyError, reset: resetBuy } = useRewardBuyCollectible();
  const { approve, isPending: approvePending, isConfirming: approveConfirming, isSuccess: approveSuccess, error: approveError, reset: resetApprove } = useApprove();
  const { redeem, isPending: redeemingPending, isConfirming: redeemingConfirming, isSuccess: redeemSuccess, error: redeemError, reset: resetRedeem } = useRewardRedeemVoucher();
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
    resetApprove();
  }, [resetBuy, resetApprove]);

  const notifyShopTxOutcome = useCallback((error: unknown, fallback: string) => {
    if (isUserRejectedTransaction(error)) return;
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

  const hasPaymentMethod = Boolean(isConnected && address);

  // Shop Items: Collectibles owned by contract (in shop stock)
  const contractTokenIdCalls = useMemo(() => {
    if (!contractAddress) return [];
    return buildTokenOfOwnerByIndexSlotCalls(contractAddress, RewardABI as Abi, contractAddress, chainId, REWARD_OWNED_SLOT_SCAN_CAP);
  }, [contractAddress, chainId]);

  const { data: contractTokenIdResults } = useReadContracts({
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

  const { data: shopInfoResults } = useReadContracts({
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

  // User vouchers: union of connected wallet + smart wallet (readable without signing)
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

  // Handlers
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
    const paymentToken = preferredStable.paymentToken;
    const paymentTokenAddress = preferredStable.tokenAddress;
    if (!paymentTokenAddress || !contractAddress) {
      toast.error(`${activeStableLabel} not supported on this network`);
      return;
    }
    try {
      if (isMiniPayBrowser()) {
        const feeCurrencyAddress = getFeeCurrencyAddress(paymentTokenAddress);

        if (stableAllowance === undefined || stableAllowance === null) {
          toast.info('Approval required');
          await miniPayShop.sendRawApproval(paymentTokenAddress, contractAddress, price);
          toast.success('Approval successful');
        } else if (typeof stableAllowance === 'bigint' && stableAllowance < price) {
          toast.info('Increasing approval...');
          await miniPayShop.sendRawApproval(paymentTokenAddress, contractAddress, price);
          toast.success('Approval updated');
        }

        const buyData = encodeFunctionData({
          abi: BUY_COLLECTIBLE_ABI,
          functionName: 'buyCollectible',
          args: [item.tokenId, paymentToken],
        });
        await miniPayShop.sendContractCallRaw(contractAddress, buyData, feeCurrencyAddress);
      } else {
        if (stableAllowance === undefined || stableAllowance === null) {
          toast.info('Approval required');
          await approve(paymentTokenAddress, contractAddress, price);
          toast.success('Approval successful');
        } else if (typeof stableAllowance === 'bigint' && stableAllowance < price) {
          toast.info('Increasing approval...');
          await approve(paymentTokenAddress, contractAddress, price);
          toast.success('Approval updated');
        }
        await buy(item.tokenId, paymentToken);
      }
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

  // Success / Error toasts
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
        {/* USDT Balance — compact */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl px-4 py-3 flex items-center justify-between border border-[#003B3E]/80 bg-[#0E1415]/60 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-[#00F0FF]" />
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{activeStableLabel} (auto)</p>
              <p className="text-lg font-bold text-[#00F0FF] font-[family-name:var(--font-orbitron-sans)]">
                {stableLoading ? <Loader2 className="inline animate-spin" size={18} /> : payerAddress ? `$${activeStableBalance.toFixed(2)}` : '—'}
              </p>
              {payerAddress && (
                <p className="text-[10px] text-slate-500 mt-0.5">Connected wallet</p>
              )}
            </div>
          </div>
          <button onClick={() => { refetchUsdc(); refetchCusdc(); refetchUsdt(); }} className="text-xs text-[#00F0FF] flex items-center gap-1">
            <RefreshCw size={12} /> Refresh
          </button>
        </motion.div>


        {!hasPaymentMethod && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-[#00F0FF]/25 bg-[#00F0FF]/5 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="text-sm text-slate-300">
              Connect your wallet to buy perks with USDT.
            </p>
            <button
              type="button"
              onClick={() => openWallet()}
              className="shrink-0 min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00F0FF]/25 to-[#0FF0FC]/20 border border-[#00F0FF]/50 text-[#00F0FF] font-semibold text-sm"
            >
              Connect wallet
            </button>
          </motion.div>
        )}

        {/* Section label */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[#003B3E]/80" />
          <span className="text-xs text-slate-500 uppercase tracking-widest">Perks</span>
          <div className="h-px flex-1 bg-[#003B3E]/80" />
        </div>

        {/* Shop Items */}
        {shopItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20 rounded-2xl border border-[#003B3E]/60 bg-[#0E1415]/40"
          >
            <ShoppingBag size={56} className="mx-auto mb-6 text-slate-600" />
            <p className="text-lg font-medium text-slate-400">Perk Shop is currently empty</p>
            <p className="text-sm text-slate-500 mt-2">New perks will appear here when available. Play games or check back later!</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5">
            {shopItems.map((item, index) => {
              return (
                <motion.div
                  key={item.tokenId.toString()}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.03 }}
                  className="group flex flex-col rounded-xl overflow-hidden border backdrop-blur-sm transition-all border-[#003B3E]/70 bg-[#0E1415]/70 active:scale-[0.98]"
                >
                  <div className="relative h-44 w-full flex-shrink-0 bg-black/60">
                    <Image
                      src={item.image || '/game/shop/placeholder.jpg'}
                      alt={item.name}
                      fill
                      sizes="50vw"
                      className="object-contain p-2 transition-transform duration-300 group-active:scale-[1.02]"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5 px-3 pt-2 pb-0 border-t border-white/5 bg-[#0E1415]/40">
                    {TIERED_PERKS.has(item.perk) && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/30 text-[9px] font-semibold text-amber-300 uppercase">
                        T{item.strength}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-black/40 text-[10px] font-medium text-slate-300 border border-white/10">
                      {item.stock} left
                    </span>
                  </div>

                  <div className="p-3 flex flex-col flex-1 min-h-0 pt-2">
                    <p className="font-bold text-base leading-tight text-white mb-1">{item.name}</p>
                    <p className="text-[11px] text-slate-500 mb-2 line-clamp-2 flex-shrink-0">{item.desc}</p>

                    <div className="flex justify-between items-end mb-3 mt-auto">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase">Price</p>
                        <p className="text-base font-bold text-[#00F0FF] font-[family-name:var(--font-orbitron-sans)]">
                          ${Number(item.usdtPrice).toFixed(2)} {activeStableLabel}
                        </p>
                      </div>
                    </div>

                    <>
                      <button
                        onClick={() => (hasPaymentMethod ? handleBuy(item) : openWallet())}
                        disabled={
                          item.stock === 0 ||
                          buyingPending ||
                          buyingConfirming ||
                          approvePending ||
                          approveConfirming ||
                          (hasPaymentMethod && activeStableBalance < Number(item.usdtPrice))
                        }
                        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1415]
                          ${item.stock === 0
                            ? 'bg-slate-800/80 text-slate-500'
                            : !hasPaymentMethod
                            ? 'bg-gradient-to-r from-[#00F0FF]/30 to-[#0DD6E0]/25 text-[#00F0FF] border border-[#00F0FF]/40'
                            : activeStableBalance < Number(item.usdtPrice)
                            ? 'bg-slate-700/80 text-slate-400'
                            : (buyingPending || buyingConfirming || approvePending || approveConfirming)
                            ? 'bg-amber-600/90 text-black'
                            : 'bg-gradient-to-r from-[#00F0FF] to-[#0DD6E0] text-black active:brightness-110'}`}
                      >
                        {(buyingPending || buyingConfirming || approvePending || approveConfirming) ? (
                          <Loader2 className="inline animate-spin mr-2" size={16} />
                        ) : item.stock === 0 ? (
                          'Sold Out'
                        ) : !hasPaymentMethod ? (
                          'Connect to buy'
                        ) : activeStableBalance < Number(item.usdtPrice) ? (
                          `Insufficient ${activeStableLabel}`
                        ) : (
                          <> Pay with USDT — ${Number(item.usdtPrice).toFixed(2)} </>
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

                {!isConnected && myVouchers.length > 0 && (
                  <p className="text-sm text-amber-200/85 mb-4 rounded-xl border border-amber-500/25 bg-amber-950/20 px-3 py-2">
                    Connect your wallet to redeem. Redemption is signed in your wallet only (no backend transaction).
                  </p>
                )}

                {myVouchers.length === 0 ? (
                  <EmptyState
                    icon={<Ticket className="w-14 h-14 text-amber-500/70" />}
                    title="No vouchers yet"
                    description="Win games to earn reward vouchers, or buy perks in the Perk Shop for in-game advantages."
                    compact
                    className="border-amber-500/20 bg-amber-950/10"
                  />
                ) : (
                  <div className="space-y-5">
                    {myVouchers.map((v) => (
                      <motion.div
                        key={v.tokenId.toString()}
                        className="rounded-2xl p-5 border border-amber-600/40 bg-gradient-to-br from-amber-950/40 to-orange-950/30"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-2xl font-bold text-amber-300 font-[family-name:var(--font-orbitron-sans)]">Value: {v.value}</p>
                            <p className="text-sm text-slate-500 mt-1">ID: {v.tokenId.toString()}</p>
                          </div>
                          <Ticket className="text-amber-400" size={36} />
                        </div>

                        <button
                          onClick={() => handleRedeemVoucher(v.tokenId, v.voucherOwner)}
                          disabled={
                            redeemingPending ||
                            redeemingConfirming ||
                            redeemForPending ||
                            redeemForConfirming
                          }
                          className={`w-full py-4 rounded-xl font-bold transition-all
                            ${redeemingPending || redeemingConfirming || redeemForPending || redeemForConfirming
                              ? 'bg-slate-700/80 text-slate-400'
                              : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-lg shadow-amber-500/20'}`}
                        >
                          {redeemingPending || redeemingConfirming || redeemForPending || redeemForConfirming ? (
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