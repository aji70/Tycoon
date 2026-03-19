'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  useAccount,
  useChainId,
  useBalance,
  useReadContract,
  useReadContracts,
} from 'wagmi';
import { formatUnits, parseUnits, type Address, type Abi } from 'viem';
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
  Wallet,
  RefreshCw,
  X,
  ArrowLeft,
  Percent,
  CircleDollarSign,
  MapPin,
  Banknote,
  Smartphone,
} from 'lucide-react';

import RewardABI from '@/context/abi/rewardabi.json';
import Erc20Abi from '@/context/abi/ERC20abi.json';
import { REWARD_CONTRACT_ADDRESSES } from '@/constants/contracts';

import {
  useRewardBuyCollectible,
  useRewardBuyCollectibleFrom,
  useRewardRedeemVoucher,
  useApprove,
  useRewardTokenAddresses,
  useUserRegistryWallet,
  useRewardStockBundle,
  useUserWalletApproveERC20,
} from '@/context/ContractProvider';
import { useGuestAuthOptional } from '@/context/GuestAuthContext';
import { apiClient } from '@/lib/api';

const VOUCHER_ID_START = 1_000_000_000;
const COLLECTIBLE_ID_START = 2_000_000_000;

const isVoucherToken = (tokenId: bigint) =>
  tokenId >= VOUCHER_ID_START && tokenId < COLLECTIBLE_ID_START;

const isCollectibleToken = (tokenId: bigint) => tokenId >= COLLECTIBLE_ID_START;

// Bundle image mapping
const bundleImageMap: Record<string, string> = {
  "Starter Pack": "/shopcards/starterpack.jpg",
  "Lucky Bundle": "/shopcards/lucky_7.jpg",
  "Defender Pack": "/shopcards/defendpack.jpg",
  "High Roller": "/shopcards/highroller.jpg",
  "Cash Flow": "/shopcards/cashflow.jpg",
  "Chaos Bundle": "/shopcards/chaosbundle.jpg",
  "Landlord's Choice": "/shopcards/landlordsChoice.jpg",
  "Ultimate Pack": "/shopcards/ultimatepack.jpg",
};

const zeroAddress = '0x0000000000000000000000000000000000000000' as Address;
const isValidWallet = (a: string | undefined): a is Address =>
  !!a && a !== zeroAddress && a.toLowerCase() !== zeroAddress.toLowerCase();

const TIERED_PERKS = new Set([5, 8, 9]);

// Admin "stock all bundles" definitions (must match bundle composition used in UI)
const BUNDLE_DEFS_FOR_STOCK: Array<{
  name: string;
  items: Array<{ perk: number; strength: number; quantity: number }>;
  price_tyc: string;
  price_usdc: string;
}> = [
  { name: "Starter Pack", price_tyc: "45", price_usdc: "2.5", items: [{ perk: 7, strength: 1, quantity: 1 }, { perk: 4, strength: 1, quantity: 1 }, { perk: 10, strength: 1, quantity: 1 }] },
  { name: "Lucky Bundle", price_tyc: "60", price_usdc: "3", items: [{ perk: 2, strength: 1, quantity: 1 }, { perk: 6, strength: 1, quantity: 1 }, { perk: 13, strength: 1, quantity: 1 }] },
  { name: "Defender Pack", price_tyc: "55", price_usdc: "2.75", items: [{ perk: 7, strength: 1, quantity: 1 }, { perk: 2, strength: 1, quantity: 1 }, { perk: 4, strength: 1, quantity: 1 }] },
  { name: "High Roller", price_tyc: "65", price_usdc: "3.25", items: [{ perk: 3, strength: 1, quantity: 1 }, { perk: 4, strength: 1, quantity: 1 }, { perk: 10, strength: 1, quantity: 1 }] },
  { name: "Cash Flow", price_tyc: "70", price_usdc: "3.5", items: [{ perk: 5, strength: 1, quantity: 1 }, { perk: 8, strength: 1, quantity: 1 }, { perk: 9, strength: 1, quantity: 1 }] },
  { name: "Chaos Bundle", price_tyc: "75", price_usdc: "4", items: [{ perk: 6, strength: 1, quantity: 1 }, { perk: 10, strength: 1, quantity: 1 }, { perk: 13, strength: 1, quantity: 1 }] },
  { name: "Landlord's Choice", price_tyc: "50", price_usdc: "2.5", items: [{ perk: 11, strength: 1, quantity: 1 }, { perk: 12, strength: 1, quantity: 1 }, { perk: 14, strength: 1, quantity: 1 }] },
  { name: "Ultimate Pack", price_tyc: "80", price_usdc: "4.5", items: [{ perk: 1, strength: 1, quantity: 1 }, { perk: 3, strength: 1, quantity: 1 }, { perk: 7, strength: 1, quantity: 1 }, { perk: 13, strength: 1, quantity: 1 }] },
];

type BundleLineItem = { perk: number; strength: number; quantity: number };
type BundleDef = { name: string; description: string; items: BundleLineItem[] };

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

const perkMetadata = [
  { perk: 1, name: "Extra Turn", desc: "Use on your turn to take an extra roll after this one.", icon: <Zap />, image: "/shopcards/extraturn.jpg" },
  { perk: 2, name: "Jail Free Card", desc: "Use when in Jail to get out without paying or rolling doubles.", icon: <Crown />, image: "/shopcards/jailfree.jpg" },
  { perk: 3, name: "Double Rent", desc: "When someone lands on your property, charge double the normal rent once.", icon: <Coins />, image: "/shopcards/double_rent.jpg" },
  { perk: 4, name: "Roll Boost", desc: "Add +1 to your next dice roll (capped at 12).", icon: <Sparkles />, image: "/shopcards/roll_boost.jpg" },
  { perk: 5, name: "Instant Cash", desc: "Burn to receive TYC based on tier (100–1000).", icon: <Gem />, image: "/shopcards/Cash_tiered.jpg" },
  { perk: 6, name: "Teleport", desc: "Move your token to any property on the board.", icon: <Zap />, image: "/shopcards/teleport.jpg" },
  { perk: 7, name: "Shield", desc: "Block the next rent or fee you would pay (one use).", icon: <Shield />, image: "/shopcards/rent_immunity.jpg" },
  { perk: 8, name: "Property Discount", desc: "Get 30–50% off the next property you buy (tiered).", icon: <Coins />, image: "/shopcards/Cash_tiered.jpg" },
  { perk: 9, name: "Tax Refund", desc: "Receive TYC back when you pay Income or Luxury Tax (tiered).", icon: <Gem />, image: "/shopcards/tax_refund.jpg" },
  { perk: 10, name: "Exact Roll", desc: "Choose your next roll (2–12) instead of rolling the dice.", icon: <Sparkles />, image: "/shopcards/roll_boost.jpg" },
  { perk: 11, name: "Rent Cashback", desc: "Next rent you receive is +25% extra.", icon: <Percent />, image: "/shopcards/rent_cashback.jpg" },
  { perk: 12, name: "Interest", desc: "At the start of your next turn, receive $200.", icon: <CircleDollarSign />, image: "/shopcards/interest.jpg" },
  { perk: 13, name: "Lucky 7", desc: "Your next roll will be 7.", icon: <Sparkles />, image: "/shopcards/lucky_7.jpg" },
  { perk: 14, name: "Free Parking Bonus", desc: "Land on Free Parking to collect $500.", icon: <MapPin />, image: "/shopcards/freeparking_bonus.jpg" },
];

export default function GameShopMobile() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const auth = useGuestAuthOptional();
  const stockBundleHook = useRewardStockBundle();

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
  const [stockAllBundlesProgress, setStockAllBundlesProgress] = useState<{ active: boolean; current: number; total: number }>({
    active: false,
    current: 0,
    total: 0,
  });

  const USDC_TO_NGN_RATE = 1600;

  // Calculate NGN price with discount for purchases over 1000 NGN
  const calculateNgnPrice = (ngnBasePrice: number): number => {
    const minNgnPurchase = 200;
    if (ngnBasePrice < minNgnPurchase) return minNgnPurchase;
    if (ngnBasePrice > 1000) return Math.round(ngnBasePrice * 0.8);
    return ngnBasePrice;
  };

  const payerAddress = payWith === 'smart_wallet' && smartWalletAddress ? smartWalletAddress : address ?? undefined;

  useEffect(() => {
    apiClient.get<{ success?: boolean; ngn_available?: boolean; bundles?: Array<{ id: number; name: string; description: string | null; price_tyc: string; price_usdc: string; price_ngn?: number | null }> }>('shop/bundles').then((r) => {
      if (r?.data?.bundles) setBundles(r.data.bundles);
      if (typeof r?.data?.ngn_available === 'boolean') setNgnAvailable(r.data.ngn_available);
    }).catch(() => {});
  }, []);

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
      const res = await apiClient.post<{ success?: boolean; link?: string; reference?: string; message?: string }>('shop/flutterwave/initialize', { bundle_id: bundleId, callback_url: callbackUrl });
      if (res?.data?.link) {
        window.location.href = res.data.link;
        return;
      }
      toast.error((res?.data as { message?: string })?.message || 'Could not start payment');
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
  const { data: usdcAllowance } = useReadContract({
    address: usdcTokenAddress,
    abi: Erc20Abi,
    functionName: 'allowance',
    args: payerAddress && contractAddress ? [payerAddress, contractAddress] : undefined,
    query: { enabled: !!payerAddress && !!usdcTokenAddress && !!contractAddress },
  });
  // Buy / Approve / Redeem hooks
  const { buy, isPending: buyingPending, isConfirming: buyingConfirming, isSuccess: buySuccess, error: buyError, reset: resetBuy } = useRewardBuyCollectible();
  const { buyFrom, isPending: buyFromPending, isConfirming: buyFromConfirming, isSuccess: buyFromSuccess, reset: resetBuyFrom } = useRewardBuyCollectibleFrom();
  const { approve, isPending: approvePending, isSuccess: approveSuccess, error: approveError, reset: resetApprove } = useApprove();
  const { approveERC20: smartWalletApprove, isPending: smartWalletApprovePending } = useUserWalletApproveERC20(smartWalletAddress ?? undefined);
  const { redeem, isPending: redeemingPending, isConfirming: redeemingConfirming, isSuccess: redeemSuccess, error: redeemError, reset: resetRedeem } = useRewardRedeemVoucher();

  // Balances (of selected payer)
  const { data: usdcBalanceData, isLoading: usdcLoading, refetch: refetchUsdc } = useBalance({
    address: payerAddress,
    token: usdcTokenAddress,
    query: { enabled: !!payerAddress && !!usdcTokenAddress && isConnected },
  });
  const usdcBalance = usdcBalanceData ? Number(usdcBalanceData.formatted).toFixed(2) : '0.00';

  const payFromSmartWalletUnsupported = payWith === 'smart_wallet' && !smartWalletAddress;

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

        const usdcPriceStr = formatUnits(usdcPrice, 6);
        const baseNgnPrice = Math.round(Number(usdcPriceStr) * USDC_TO_NGN_RATE);
        const ngnPrice = calculateNgnPrice(baseNgnPrice);

        return {
          tokenId,
          perk,
          strength: Number(strength),
          tycPrice: formatUnits(tycPrice, 18),
          usdcPrice: usdcPriceStr,
          ngnPrice,
          stock: Number(stock),
          comingSoon: false as const,
          ...meta,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [shopInfoResults, shopTokenIds]);

  // For admin bundle stocking we need tokenIds even when stock is 0
  const allCollectiblesByPerkStrength = useMemo(() => {
    const map = new Map<string, { tokenId: bigint; perk: number; strength: number }>();
    if (!shopInfoResults) return map;
    for (let i = 0; i < shopInfoResults.length; i++) {
      const r = shopInfoResults[i];
      if (!r || r.status !== 'success') continue;
      const [perk, strength] = r.result as [number, bigint, bigint, bigint, bigint];
      const tokenId = shopTokenIds[i];
      if (!tokenId) continue;
      map.set(`${Number(perk)}:${Number(strength)}`, { tokenId, perk: Number(perk), strength: Number(strength) });
    }
    return map;
  }, [shopInfoResults, shopTokenIds]);

  const { data: rewardOwner } = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'owner',
    query: { enabled: !!contractAddress },
  });

  const isAdmin = useMemo(() => {
    if (!address || !rewardOwner) return false;
    try {
      return String(address).toLowerCase() === String(rewardOwner).toLowerCase();
    } catch {
      return false;
    }
  }, [address, rewardOwner]);

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
    // Allow if wallet is connected OR smart wallet is available
    const hasPaymentMethod = (isConnected && address) || smartWalletAddress;
    if (!hasPaymentMethod) {
      toast.error('Please connect your wallet or register to use your smart wallet');
      return;
    }
    if (!usdcTokenAddress || !contractAddress) {
      toast.error('USDC not supported on this network');
      return;
    }
    const priceNum = Number(item.usdcPrice);
    if (Number(usdcBalance) < priceNum) {
      toast.error('Insufficient USDC balance');
      return;
    }
    const price = BigInt(Math.round(priceNum * 1e6));
    try {
      if (payWith === 'smart_wallet' && smartWalletAddress) {
        await smartWalletApprove(usdcTokenAddress, contractAddress, price);
        await buyFrom(smartWalletAddress, item.tokenId, true);
      } else {
        if (usdcAllowance === undefined || usdcAllowance === null) {
          toast.info('Approval required');
          await approve(usdcTokenAddress, contractAddress, price);
          toast.success('Approval successful');
        } else if (typeof usdcAllowance === 'bigint' && usdcAllowance < price) {
          toast.info('Increasing approval...');
          await approve(usdcTokenAddress, contractAddress, price);
          toast.success('Approval updated');
        }
        await buy(item.tokenId, true);
      }
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
    for (const arr of byPerkStrength.values()) arr.sort((a, b) => b.stock - a.stock);
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
    // Allow if wallet is connected OR smart wallet is available
    const hasPaymentMethod = (isConnected && address) || smartWalletAddress;
    if (!hasPaymentMethod) {
      toast.error('Please connect your wallet or register to use your smart wallet');
      return;
    }
    if (payWith === 'smart_wallet' && !smartWalletAddress) {
      toast.error('Smart wallet not available');
      return;
    }
    if (!usdcTokenAddress) {
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

  const handleStockAllBundles = async () => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet');
      return;
    }
    if (!isAdmin) {
      toast.error('Admin only');
      return;
    }
    if (!contractAddress) {
      toast.error('Reward contract not configured on this chain');
      return;
    }
    if (stockAllBundlesProgress.active) return;
    setStockAllBundlesProgress({ active: true, current: 0, total: BUNDLE_DEFS_FOR_STOCK.length });
    try {
      for (let i = 0; i < BUNDLE_DEFS_FOR_STOCK.length; i++) {
        const def = BUNDLE_DEFS_FOR_STOCK[i];
        setStockAllBundlesProgress((p) => ({ ...p, current: i + 1 }));
        const tokenIds: bigint[] = [];
        const amounts: bigint[] = [];
        for (const li of def.items) {
          const key = `${li.perk}:${li.strength}`;
          const match = allCollectiblesByPerkStrength.get(key);
          if (!match) {
            throw new Error(`Bundle "${def.name}": perk ${li.perk} (tier ${li.strength}) missing. Stock perks first.`);
          }
          for (let q = 0; q < li.quantity; q++) {
            tokenIds.push(match.tokenId);
            amounts.push(BigInt(1));
          }
        }
        const tycPrice = parseUnits(def.price_tyc, 18);
        const usdcPrice = parseUnits(def.price_usdc, 6);
        await stockBundleHook.stockBundle(tokenIds, amounts, tycPrice, usdcPrice);
      }
      toast.success('All bundles stocked');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to stock bundles');
    } finally {
      setStockAllBundlesProgress({ active: false, current: 0, total: 0 });
    }
  };

  const handleRedeemVoucher = async (tokenId: bigint) => {
    if (!isConnected) {
      toast.error('Please connect your wallet to redeem vouchers');
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
    if (buyFromSuccess) {
      toast.success('Purchase successful! 🎉');
      refetchUsdc();
      resetBuyFrom();
    }
  }, [buyFromSuccess, refetchUsdc, resetBuyFrom]);

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
        {/* Pay from: Connected wallet | Smart wallet */}
        {isConnected && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Pay from:</span>
            <button
              type="button"
              onClick={() => setPayWith('connected')}
              className={`min-h-[36px] px-3 py-2 rounded-lg text-xs font-medium border ${
                payWith === 'connected' ? 'bg-[#00F0FF]/15 border-[#00F0FF]/50 text-[#00F0FF]' : 'bg-[#0E1415]/60 border-[#003B3E] text-slate-400'
              }`}
            >
              <Wallet size={12} className="inline mr-1.5 align-middle" />
              Connected
            </button>
            <button
              type="button"
              onClick={() => setPayWith('smart_wallet')}
              disabled={!smartWalletAddress}
              className={`min-h-[36px] px-3 py-2 rounded-lg text-xs font-medium border ${
                payWith === 'smart_wallet' ? 'bg-amber-500/15 border-amber-400/50 text-amber-200' : !smartWalletAddress ? 'bg-slate-800/60 border-slate-700 text-slate-500' : 'bg-[#0E1415]/60 border-[#003B3E] text-slate-400'
              }`}
            >
              <Smartphone size={12} className="inline mr-1.5 align-middle" />
              Smart wallet
            </button>
          </div>
        )}

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

        {payFromSmartWalletUnsupported && (
          <p className="text-center text-amber-200/90 text-xs">No smart wallet to pay from. Use Connected wallet or create/link one in Profile.</p>
        )}

        {/* Tabs: Perks | Bundles — one visible at a time */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setShopTab('perks')}
            className={`flex-1 min-h-[44px] px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
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
            className={`flex-1 min-h-[44px] px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
              shopTab === 'bundles'
                ? 'bg-amber-500/20 border-2 border-amber-400/60 text-amber-300'
                : 'bg-[#0E1415]/60 border border-[#003B3E] text-slate-400 hover:border-[#003B3E]/80 hover:text-slate-300'
            }`}
          >
            Bundles
          </button>
        </div>

        {shopTab === 'bundles' && (
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[#003B3E]/80" />
              <span className="text-xs text-slate-500 uppercase tracking-widest">Bundles</span>
              <div className="h-px flex-1 bg-[#003B3E]/80" />
            </div>
            {bundles.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {bundles.map((b, idx) => (
                <motion.div
                  key={b.id ?? b.name ?? idx}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl overflow-hidden border border-amber-500/20 bg-[#0E1415]/50"
                >
                  {/* Bundle Image */}
                  <div className="relative h-40 bg-black/40 overflow-hidden">
                    <Image
                      src={bundleImageMap[b.name] || "/game/shop/placeholder.jpg"}
                      alt={b.name}
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="p-4">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-[9px] font-semibold text-amber-300 uppercase">Bundle</span>
                    <h3 className="font-bold text-base text-white mt-2">{b.name}</h3>
                    <p className="text-slate-500 text-xs mt-1 line-clamp-2">{b.description || ''}</p>
                    <p className="text-[#00F0FF] font-semibold text-sm mt-2">
                      ${Number(b.price_usdc).toFixed(2)} USDC
                      {b.price_ngn != null && b.price_ngn > 0 && (
                        <> or ₦{Number(b.price_ngn).toLocaleString()} NGN</>
                      )}
                    </p>
                    <button
                      onClick={() => handleBuyBundleWithUsdc(b.name)}
                      disabled={bundleBuyingName != null || payFromSmartWalletUnsupported || !BUNDLE_DEFS.some((d) => d.name === b.name) || !canBuyBundle(BUNDLE_DEFS.find((d) => d.name === b.name) as BundleDef)}
                      className={`w-full mt-3 py-2.5 rounded-lg text-sm font-medium border ${
                        bundleBuyingName === b.name
                          ? 'bg-slate-700/80 text-slate-400 border-slate-600/50'
                          : payFromSmartWalletUnsupported || !BUNDLE_DEFS.some((d) => d.name === b.name) || !canBuyBundle(BUNDLE_DEFS.find((d) => d.name === b.name) as BundleDef)
                          ? 'bg-slate-800/80 text-slate-500 border-slate-700/80'
                          : 'bg-[#00F0FF]/10 text-[#00F0FF] border-[#00F0FF]/40'
                      }`}
                    >
                      {bundleBuyingName === b.name ? (
                        <><Loader2 size={14} className="inline animate-spin mr-2" /> Buying...</>
                      ) : (
                        <><CreditCard size={14} className="inline mr-2" /> Buy with USDC</>
                      )}
                    </button>
                    {b.price_ngn != null && b.price_ngn > 0 && (
                      <button
                        onClick={() => typeof b.id === 'number' && handlePayWithNgn(b.id)}
                        disabled={!ngnAvailable || ngnLoadingBundleId != null}
                        className="w-full mt-2 py-2.5 rounded-lg text-sm font-medium bg-amber-500/20 border border-amber-400/50 text-amber-200 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {ngnLoadingBundleId === b.id ? (
                          <><Loader2 size={14} className="animate-spin" /> Redirecting...</>
                        ) : (
                          <><Banknote size={14} /> Buy with Naira — ₦{Number(b.price_ngn).toLocaleString()}</>
                        )}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
            ) : (
              <div className="text-center py-12 px-4 rounded-2xl border border-[#003B3E]/60 bg-[#0E1415]/40">
                <p className="text-slate-400 text-sm">No bundles available yet. Check back soon.</p>
              </div>
            )}
          </div>
        )}

        {shopTab === 'perks' && (
          <>
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
        ) : shopItems.length === 0 ? (
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
                  <div className="relative aspect-[4/3] w-full flex-shrink-0">
                    <Image
                      src={item.image || '/game/shop/placeholder.jpg'}
                      alt={item.name}
                      fill
                      sizes="50vw"
                      className="object-cover transition-transform duration-500 group-active:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                      {TIERED_PERKS.has(item.perk) && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/30 text-[9px] font-semibold text-amber-300 uppercase">
                          T{item.strength}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md bg-black/50 text-[10px] font-medium text-slate-300">
                        {item.stock} left
                      </span>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="font-bold text-base leading-tight text-white drop-shadow-lg">{item.name}</p>
                    </div>
                  </div>

                  <div className="p-3 flex flex-col flex-1 min-h-0">
                    <p className="text-[11px] text-slate-500 mb-2 line-clamp-2 flex-shrink-0">{item.desc}</p>

                    <div className="flex justify-between items-end mb-3 mt-auto">
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase">Price</p>
                        <p className="text-base font-bold text-[#00F0FF] font-[family-name:var(--font-orbitron-sans)]">${Number(item.usdcPrice).toFixed(2)} USDC</p>
                        {ngnAvailable && (
                          <p className="text-xs text-amber-200">₦{Number(item.ngnPrice).toLocaleString()} NGN</p>
                        )}
                      </div>
                    </div>

                    <>
                      <button
                        onClick={() => handleBuy(item)}
                        disabled={item.stock === 0 || buyingPending || buyingConfirming || buyFromPending || buyFromConfirming || smartWalletApprovePending || Number(usdcBalance) < Number(item.usdcPrice) || payFromSmartWalletUnsupported}
                        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1415]
                          ${item.stock === 0
                            ? 'bg-slate-800/80 text-slate-500'
                            : Number(usdcBalance) < Number(item.usdcPrice)
                            ? 'bg-slate-700/80 text-slate-400'
                            : (buyingPending || buyingConfirming || buyFromPending || buyFromConfirming || smartWalletApprovePending)
                            ? 'bg-amber-600/90 text-black'
                            : 'bg-gradient-to-r from-[#00F0FF] to-[#0DD6E0] text-black active:brightness-110'}`}
                      >
                        {(buyingPending || buyingConfirming || buyFromPending || buyFromConfirming || smartWalletApprovePending) ? (
                          <Loader2 className="inline animate-spin mr-2" size={16} />
                        ) : item.stock === 0 ? (
                          'Sold Out'
                        ) : Number(usdcBalance) < Number(item.usdcPrice) ? (
                          'Insufficient USDC'
                        ) : payFromSmartWalletUnsupported ? (
                          'Use Connected wallet'
                        ) : (
                          <> Buy with USDC — ${Number(item.usdcPrice).toFixed(2)} </>
                        )}
                      </button>
                      <button
                        onClick={() => handlePayPerkWithNaira(item)}
                        disabled={item.stock === 0 || payFromSmartWalletUnsupported || ngnLoadingTokenId === item.tokenId.toString() || !ngnAvailable}
                        className="w-full mt-2 py-2.5 rounded-lg text-sm font-medium bg-amber-500/20 border border-amber-400/50 text-amber-200 flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {ngnLoadingTokenId === item.tokenId.toString() ? (
                          <><Loader2 size={14} className="animate-spin" /> Redirecting...</>
                        ) : (
                          <><Banknote size={14} /> Buy with Naira — ₦{Number(item.ngnPrice).toLocaleString()}</>
                        )}
                      </button>
                    </>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
          </>
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