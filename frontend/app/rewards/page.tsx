'use client';

import React, { useState, useEffect } from 'react';
import {
  useAccount,
  useChainId,
  useReadContract,
  useReadContracts,
} from 'wagmi';
import { parseUnits, formatUnits, type Address, type Abi } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Crown,
  Coins,
  Sparkles,
  Gem,
  Shield,
  DollarSign,
  Wallet,
  Package,
  AlertTriangle,
  Settings,
  PlusCircle,
  Gift,
  Banknote,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Edit2,
  Ticket,
  Star,
} from 'lucide-react';

import RewardABI from '@/context/abi/rewardabi.json';
import {
  REWARD_CONTRACT_ADDRESSES,
  USDC_TOKEN_ADDRESS,
  TYC_TOKEN_ADDRESS,
} from '@/constants/contracts';

// Import ALL admin reward hooks from your context
import {
  useRewardSetBackendMinter,
  useRewardMintVoucher,
  useRewardMintCollectible,
  useRewardStockShop,
  useRewardRestockCollectible,
  useRewardUpdateCollectiblePrices,
  useRewardPause,
  useRewardWithdrawFunds,
} from '@/context/ContractProvider'; 

// Assuming apiClient is imported from your API utilities
import { apiClient } from "@/lib/api";
import { ApiResponse } from '@/types/api';

enum CollectiblePerk {
  NONE = 0,
  EXTRA_TURN = 1,
  JAIL_FREE = 2,
  DOUBLE_RENT = 3,
  ROLL_BOOST = 4,
  CASH_TIERED = 5,
  TELEPORT = 6,
  SHIELD = 7,
  PROPERTY_DISCOUNT = 8,
  TAX_REFUND = 9,
  ROLL_EXACT = 10,
}

const PERK_NAMES: Record<CollectiblePerk, string> = {
  [CollectiblePerk.NONE]: 'None',
  [CollectiblePerk.EXTRA_TURN]: 'Extra Turn',
  [CollectiblePerk.JAIL_FREE]: 'Get Out of Jail Free',
  [CollectiblePerk.DOUBLE_RENT]: 'Double Rent',
  [CollectiblePerk.ROLL_BOOST]: 'Roll Boost',
  [CollectiblePerk.CASH_TIERED]: 'Instant Cash (Tiered)',
  [CollectiblePerk.TELEPORT]: 'Teleport',
  [CollectiblePerk.SHIELD]: 'Shield',
  [CollectiblePerk.PROPERTY_DISCOUNT]: 'Property Discount',
  [CollectiblePerk.TAX_REFUND]: 'Tax Refund (Tiered)',
  [CollectiblePerk.ROLL_EXACT]: 'Exact Roll',
};

const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
] as const;

const INITIAL_COLLECTIBLES = [
  { perk: CollectiblePerk.EXTRA_TURN, name: "Extra Turn", strength: 1, tycPrice: "0.75", usdcPrice: "0.08", icon: <Zap className="w-8 h-8" /> },
  { perk: CollectiblePerk.ROLL_BOOST, name: "Roll Boost", strength: 1, tycPrice: "1.0", usdcPrice: "0.10", icon: <Sparkles className="w-8 h-8" /> },
  { perk: CollectiblePerk.PROPERTY_DISCOUNT, name: "Property Discount", strength: 1, tycPrice: "1.25", usdcPrice: "0.25", icon: <Coins className="w-8 h-8" /> },
  { perk: CollectiblePerk.SHIELD, name: "Shield", strength: 1, tycPrice: "1.5", usdcPrice: "0.40", icon: <Shield className="w-8 h-8" /> },
  { perk: CollectiblePerk.TELEPORT, name: "Teleport", strength: 1, tycPrice: "1.8", usdcPrice: "0.60", icon: <Zap className="w-8 h-8" /> },
  { perk: CollectiblePerk.ROLL_EXACT, name: "Exact Roll (Legendary)", strength: 1, tycPrice: "2.5", usdcPrice: "1.00", icon: <Sparkles className="w-8 h-8" /> },
  { perk: CollectiblePerk.CASH_TIERED, name: "Cash Tier 1", strength: 1, tycPrice: "0.5", usdcPrice: "0.05", icon: <Gem className="w-8 h-8" /> },
  { perk: CollectiblePerk.CASH_TIERED, name: "Cash Tier 2", strength: 2, tycPrice: "0.8", usdcPrice: "0.15", icon: <Gem className="w-8 h-8" /> },
  { perk: CollectiblePerk.CASH_TIERED, name: "Cash Tier 3", strength: 3, tycPrice: "1.2", usdcPrice: "0.30", icon: <Gem className="w-8 h-8" /> },
  { perk: CollectiblePerk.CASH_TIERED, name: "Cash Tier 4", strength: 4, tycPrice: "1.6", usdcPrice: "0.50", icon: <Gem className="w-8 h-8" /> },
  { perk: CollectiblePerk.CASH_TIERED, name: "Cash Tier 5", strength: 5, tycPrice: "2.0", usdcPrice: "0.90", icon: <Gem className="w-8 h-8" /> },
] as const;

export default function RewardAdminPanel() {
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();

  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES] as Address | undefined;
  const usdcAddress = USDC_TOKEN_ADDRESS[chainId as keyof typeof USDC_TOKEN_ADDRESS] as Address | undefined;
  const tycAddress = TYC_TOKEN_ADDRESS[chainId as keyof typeof TYC_TOKEN_ADDRESS] as Address | undefined;

  const [activeSection, setActiveSection] = useState<'overview' | 'mint' | 'stock' | 'manage' | 'funds'>('overview');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [backendMinter, setBackendMinter] = useState<Address | null>(null);
  const [owner, setOwner] = useState<Address | null>(null);
  const [totalGames, setTotalGames] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);

  // Form states
  const [newMinter, setNewMinter] = useState('');
  const [voucherRecipient, setVoucherRecipient] = useState('');
  const [voucherValue, setVoucherValue] = useState('');
  const [collectibleRecipient, setCollectibleRecipient] = useState('');
  const [selectedPerk, setSelectedPerk] = useState<CollectiblePerk>(CollectiblePerk.EXTRA_TURN);
  const [collectibleStrength, setCollectibleStrength] = useState('1');
  const [restockTokenId, setRestockTokenId] = useState('');
  const [restockAmount, setRestockAmount] = useState('50');
  const [updateTokenId, setUpdateTokenId] = useState('');
  const [updateTycPrice, setUpdateTycPrice] = useState('');
  const [updateUsdcPrice, setUpdateUsdcPrice] = useState('');
  const [withdrawToken, setWithdrawToken] = useState<'TYC' | 'USDC'>('TYC');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawTo, setWithdrawTo] = useState('');

  // Admin hooks from context
  const {
    setMinter: setBackendMinterFn,
    isPending: pendingMinter,
    isSuccess: successMinter,
    error: errorMinter,
    txHash: txMinter,
    reset: resetMinter,
  } = useRewardSetBackendMinter();

  const {
    mint: mintVoucher,
    isPending: pendingVoucher,
    isSuccess: successVoucher,
    error: errorVoucher,
    txHash: txVoucher,
    reset: resetVoucher,
  } = useRewardMintVoucher();

  const {
    mint: mintCollectible,
    isPending: pendingCollectible,
    isSuccess: successCollectible,
    error: errorCollectible,
    txHash: txCollectible,
    reset: resetCollectible,
  } = useRewardMintCollectible();

  const {
    stock: stockShop,
    isPending: pendingStock,
    isSuccess: successStock,
    error: errorStock,
    txHash: txStock,
    reset: resetStock,
  } = useRewardStockShop();

  const {
    restock,
    isPending: pendingRestock,
    isSuccess: successRestock,
    error: errorRestock,
    txHash: txRestock,
    reset: resetRestock,
  } = useRewardRestockCollectible();

  const {
    update,
    isPending: pendingUpdate,
    isSuccess: successUpdate,
    error: errorUpdate,
    txHash: txUpdate,
    reset: resetUpdate,
  } = useRewardUpdateCollectiblePrices();

  const {
    pause,
    unpause,
    isPending: pendingPause,
    isSuccess: successPause,
    error: errorPause,
    txHash: txPause,
    reset: resetPause,
  } = useRewardPause();

  const {
    withdraw,
    isPending: pendingWithdraw,
    isSuccess: successWithdraw,
    error: errorWithdraw,
    txHash: txWithdraw,
    reset: resetWithdraw,
  } = useRewardWithdrawFunds();

  // Contract state reads
  const pausedResult = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'paused',
    query: { enabled: !!contractAddress },
  });

  const backendMinterResult = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'backendMinter',
    query: { enabled: !!contractAddress },
  });

  const ownerResult = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'owner',
    query: { enabled: !!contractAddress },
  });

  const tycBalance = useReadContract({
    address: tycAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: contractAddress ? [contractAddress] : undefined,
    query: { enabled: !!contractAddress && !!tycAddress },
  });

  const usdcBalance = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: contractAddress ? [contractAddress] : undefined,
    query: { enabled: !!contractAddress && !!usdcAddress },
  });

  // Token holdings for overview
  const contractTokenCount = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'ownedTokenCount',
    args: contractAddress ? [contractAddress] : undefined,
    query: { enabled: !!contractAddress },
  });

  const tokenCount = Number(contractTokenCount.data ?? 0);

  const tokenOfOwnerCalls = Array.from({ length: tokenCount }, (_, i) => ({
    address: contractAddress!,
    abi: RewardABI as Abi,
    functionName: 'tokenOfOwnerByIndex',
    args: [contractAddress!, BigInt(i)],
  } as const));

  const tokenIdResults = useReadContracts({
    contracts: tokenOfOwnerCalls,
    allowFailure: true,
    query: { enabled: !!contractAddress && tokenCount > 0 },
  });

  const allTokenIds = tokenIdResults.data
    ?.map((res) => (res.status === 'success' ? res.result : undefined))
    .filter((id): id is bigint => id !== undefined) ?? [];

  const collectibleInfoCalls = allTokenIds.map((tokenId) => ({
    address: contractAddress!,
    abi: RewardABI as Abi,
    functionName: 'getCollectibleInfo',
    args: [tokenId],
  } as const));

  const tokenInfoResults = useReadContracts({
    contracts: collectibleInfoCalls,
    allowFailure: true,
    query: { enabled: !!contractAddress && allTokenIds.length > 0 },
  });

  const allTokens = tokenInfoResults.data
    ?.map((result, index) => {
      if (result?.status !== 'success') return null;
      const [perk, , tycPrice, usdcPrice, stock] = result.result as [number, bigint, bigint, bigint, bigint];
      const tokenId = allTokenIds[index];
      const isVoucher = tokenId < 2_000_000_000;
      const isCollectible = tokenId >= 2_000_000_000;

      return {
        tokenId,
        perk: isCollectible ? (perk as CollectiblePerk) : undefined,
        name: isVoucher
          ? `Voucher #${tokenId.toString()}`
          : PERK_NAMES[perk as CollectiblePerk] || `Collectible #${perk}`,
        type: isVoucher ? 'voucher' : 'collectible',
        tycPrice,
        usdcPrice,
        stock,
        icon: isVoucher ? <Ticket className="w-12 h-12" /> : <Star className="w-12 h-12" />,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null) ?? [];

  // Fetch total games and users
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const gamesRes = await apiClient.get<ApiResponse>('/games');
        setTotalGames(gamesRes.data?.data.length);
        const usersRes = await apiClient.get<ApiResponse>('/users');
        setTotalUsers(usersRes.data?.length);
        
      } catch (error) {
        console.error('Failed to fetch platform stats:', error);
        // Optionally set status to show error
      }
    };

    fetchStats();
  }, []);

  // Update local state from contract reads
  useEffect(() => {
    setIsPaused(!!pausedResult.data);
    setBackendMinter((backendMinterResult.data as Address) ?? null);
    setOwner((ownerResult.data as Address) ?? null);
    setWithdrawTo((ownerResult.data as string) ?? '');
  }, [pausedResult.data, backendMinterResult.data, ownerResult.data]);

  // Global success/error feedback
  useEffect(() => {
    const successes = [
      successMinter,
      successVoucher,
      successCollectible,
      successStock,
      successRestock,
      successUpdate,
      successPause,
      successWithdraw,
    ];
    if (successes.some(Boolean)) {
      setStatus({ type: 'success', message: 'Transaction successful!' });
      resetMinter?.();
      resetVoucher?.();
      resetCollectible?.();
      resetStock?.();
      resetRestock?.();
      resetUpdate?.();
      resetPause?.();
      resetWithdraw?.();
    }
  }, [
    successMinter,
    successVoucher,
    successCollectible,
    successStock,
    successRestock,
    successUpdate,
    successPause,
    successWithdraw,
  ]);

  useEffect(() => {
    const errors = [
      errorMinter,
      errorVoucher,
      errorCollectible,
      errorStock,
      errorRestock,
      errorUpdate,
      errorPause,
      errorWithdraw,
    ].filter(Boolean);
    if (errors.length > 0) {
      setStatus({ type: 'error', message: errors[0]?.message || 'Transaction failed' });
    }
  }, [
    errorMinter,
    errorVoucher,
    errorCollectible,
    errorStock,
    errorRestock,
    errorUpdate,
    errorPause,
    errorWithdraw,
  ]);

  // Handlers using context hooks
  const handleSetBackendMinter = async () => {
    if (!newMinter) return;
    await setBackendMinterFn(newMinter as Address);
    setNewMinter('');
  };

  const handleMintVoucher = async () => {
    if (!voucherRecipient || !voucherValue) return;
    const valueWei = parseUnits(voucherValue, 18);
    await mintVoucher(voucherRecipient as Address, valueWei);
    setVoucherRecipient('');
    setVoucherValue('');
  };

  const handleMintCollectible = async () => {
    if (!collectibleRecipient) return;
    await mintCollectible(collectibleRecipient as Address, selectedPerk, Number(collectibleStrength || 1));
    setCollectibleRecipient('');
    setCollectibleStrength('1');
  };

  const handleStockShop = async (perk: CollectiblePerk, strength: number) => {
    const selectedItem = INITIAL_COLLECTIBLES.find(
      (item) => item.perk === perk && item.strength === strength
    );
    const tycPrice = selectedItem
      ? parseUnits(selectedItem.tycPrice, 18)
      : parseUnits("1.0", 18);
    const usdcPrice = selectedItem
      ? parseUnits(selectedItem.usdcPrice, 6)
      : parseUnits("0.20", 6);

    await stockShop(50, perk, strength, Number(tycPrice), Number(usdcPrice));
  };

  const handleRestock = async () => {
    if (!restockTokenId || !restockAmount) return;
    await restock(BigInt(restockTokenId), BigInt(restockAmount));
    setRestockTokenId('');
    setRestockAmount('50');
  };

  const handleUpdatePrices = async () => {
    if (!updateTokenId) return;
    const tycWei = updateTycPrice ? parseUnits(updateTycPrice, 18) : 0;
    const usdcWei = updateUsdcPrice ? parseUnits(updateUsdcPrice, 6) : 0;
    await update(BigInt(updateTokenId), BigInt(tycWei), BigInt(usdcWei));
    setUpdateTokenId('');
    setUpdateTycPrice('');
    setUpdateUsdcPrice('');
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !withdrawTo) return;
    const tokenAddr = withdrawToken === 'TYC' ? tycAddress! : usdcAddress!;
    const decimals = withdrawToken === 'TYC' ? 18 : 6;
    const amountWei = parseUnits(withdrawAmount, decimals);
    await withdraw(tokenAddr, withdrawTo as Address, amountWei);
    setWithdrawAmount('');
  };

  const anyPending =
    pendingMinter ||
    pendingVoucher ||
    pendingCollectible ||
    pendingStock ||
    pendingRestock ||
    pendingUpdate ||
    pendingPause ||
    pendingWithdraw;

  const currentTxHash =
    txMinter ||
    txVoucher ||
    txCollectible ||
    txStock ||
    txRestock ||
    txUpdate ||
    txPause ||
    txWithdraw;

  // Early returns
  if (!isConnected || !userAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0f1a] to-[#0f1a27]">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="p-10 bg-red-950/60 rounded-3xl border border-red-700/50 text-center"
        >
          <AlertTriangle className="w-16 h-16 mx-auto mb-6 text-red-400" />
          <h2 className="text-3xl font-bold">Wallet Not Connected</h2>
          <p className="text-gray-400 mt-2">Connect your wallet to access admin features</p>
        </motion.div>
      </div>
    );
  }

  if (!contractAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0f1a] to-[#0f1a27] text-rose-400 text-2xl">
        No Reward contract deployed on chain {chainId}
      </div>
    );
  }

  if (owner && owner.toLowerCase() !== userAddress.toLowerCase()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0f1a] to-[#0f1a27]">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="p-10 bg-red-950/60 rounded-3xl border border-red-700/50 text-center"
        >
          <AlertTriangle className="w-16 h-16 mx-auto mb-6 text-red-400" />
          <h2 className="text-3xl font-bold">Access Denied</h2>
          <p className="text-gray-400 mt-2">Only the contract owner can access this panel</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1a] via-[#0d141f] to-[#0f1a27] text-white py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl md:text-6xl font-extrabold mb-4 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Tycoon Reward Admin Panel
          </h1>
          <p className="text-xl text-gray-400">
            Manage minter • Mint items • Stock shop • Update prices • Control contract
          </p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-4 mb-10">
          {(['overview', 'mint', 'stock', 'manage', 'funds'] as const).map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                activeSection === section
                  ? 'bg-gradient-to-r from-cyan-600 to-purple-600 shadow-lg'
                  : 'bg-gray-800/60 hover:bg-gray-700/50'
              }`}
            >
              {section === 'overview' && <Settings className="w-5 h-5" />}
              {section === 'mint' && <PlusCircle className="w-5 h-5" />}
              {section === 'stock' && <Package className="w-5 h-5" />}
              {section === 'manage' && <Edit2 className="w-5 h-5" />}
              {section === 'funds' && <Wallet className="w-5 h-5" />}
              {section.charAt(0).toUpperCase() + section.slice(1)}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-8 p-6 rounded-2xl border text-center max-w-2xl mx-auto ${
                status.type === 'success'
                  ? 'bg-green-900/40 border-green-600'
                  : status.type === 'error'
                  ? 'bg-red-900/40 border-red-600'
                  : 'bg-blue-900/40 border-blue-600'
              }`}
            >
              <p className="font-medium">{status.message}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {activeSection === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Settings className="w-6 h-6 text-cyan-400" /> Contract Status
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-lg">
                <div>
                  Paused: <span className={isPaused ? 'text-red-400' : 'text-green-400'}>{isPaused ? 'Yes' : 'No'}</span>
                </div>
                <div>
                  Owner: <span className="font-mono text-sm">{owner ? `${owner.slice(0, 8)}...${owner.slice(-6)}` : '—'}</span>
                </div>
                <div>
                  Backend Minter: <span className="font-mono text-sm">{backendMinter ? `${backendMinter.slice(0, 8)}...${backendMinter.slice(-6)}` : 'Not set'}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Crown className="w-6 h-6 text-purple-400" /> Platform Statistics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-lg">
                <div>
                  Total Games Created: <span className="text-green-400">{totalGames}</span>
                </div>
                <div>
                  Total Users Registered: <span className="text-green-400">{totalUsers}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-bold mb-8 flex items-center gap-3">
                <Package className="w-8 h-8 text-purple-400" /> Contract Token Holdings
              </h3>

              {tokenCount === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <Package className="w-20 h-20 mx-auto mb-4 opacity-30" />
                  <p>No tokens held by contract yet</p>
                </div>
              ) : allTokens.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <div className="animate-pulse">Loading {tokenCount} tokens...</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {allTokens.map((item) => (
                    <motion.div
                      key={item.tokenId.toString()}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.05 }}
                      className={`relative overflow-hidden rounded-2xl border-2 p-6 text-center transition-all ${
                        item.type === 'voucher'
                          ? 'bg-gradient-to-br from-amber-900/40 to-orange-900/40 border-amber-600'
                          : 'bg-gradient-to-br from-purple-900/40 to-pink-900/40 border-purple-600'
                      }`}
                    >
                      <div className="absolute inset-0 bg-white/5 backdrop-blur-xl" />
                      <div className="relative z-10">
                        <div className={`mx-auto mb-4 p-4 rounded-full ${item.type === 'voucher' ? 'bg-amber-900/60' : 'bg-purple-900/60'}`}>
                          {item.icon}
                        </div>
                        <h4 className="font-bold text-lg mb-2 truncate">{item.name}</h4>
                        <p className="text-xs opacity-80 mb-4">ID: {item.tokenId.toString()}</p>
                        <div className="text-2xl font-bold text-emerald-400">{item.stock.toString()}</div>
                        <p className="text-xs opacity-75">In Stock</p>

                        {item.type === 'collectible' && item.tycPrice > 0 && (
                          <div className="mt-4 pt-4 border-t border-white/20">
                            <p className="text-xs">
                              <span className="text-emerald-300">{formatUnits(item.tycPrice, 18)}</span> TYC
                            </p>
                            <p className="text-xs">
                              <span className="text-cyan-300">{formatUnits(item.usdcPrice, 6)}</span> USDC
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeSection === 'mint' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Gift className="w-6 h-6 text-blue-400" /> Mint Voucher
              </h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Recipient Address"
                  value={voucherRecipient}
                  onChange={(e) => setVoucherRecipient(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="TYC Value (e.g. 10)"
                  value={voucherValue}
                  onChange={(e) => setVoucherValue(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleMintVoucher}
                  disabled={anyPending || !voucherRecipient || !voucherValue}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {pendingVoucher ? 'Minting...' : 'Mint Voucher'}
                </button>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Gem className="w-6 h-6 text-purple-400" /> Mint Collectible
              </h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Recipient Address"
                  value={collectibleRecipient}
                  onChange={(e) => setCollectibleRecipient(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <select
                  value={selectedPerk}
                  onChange={(e) => setSelectedPerk(Number(e.target.value) as CollectiblePerk)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                >
                  {Object.entries(PERK_NAMES).map(([value, name]) => (
                    <option key={value} value={value}>
                      {name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Strength (for tiered perks)"
                  value={collectibleStrength}
                  onChange={(e) => setCollectibleStrength(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={handleMintCollectible}
                  disabled={anyPending || !collectibleRecipient}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {pendingCollectible ? 'Minting...' : 'Mint Collectible'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeSection === 'stock' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 justify-center">
              <Package className="w-8 h-8 text-green-400" /> Stock Shop (50 Units Each)
            </h3>
            <p className="text-center text-gray-400 mb-8">
              Click any item to stock 50 units with pre-set prices
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {INITIAL_COLLECTIBLES.map((item) => (
                <motion.div
                  key={`${item.perk}-${item.strength}`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-2xl p-6 border-2 cursor-pointer transition-all text-center bg-gray-800/40 border-gray-700 hover:border-green-500/50"
                  onClick={() => {
                    setSelectedPerk(item.perk);
                    setCollectibleStrength(String(item.strength));
                  }}
                >
                  <div className="flex flex-col items-center mb-4">
                    <div className="p-4 rounded-full mb-3 bg-gray-700/50">
                      {item.icon}
                    </div>
                    <h4 className="font-bold text-lg">{item.name}</h4>
                    {item.strength > 1 && <p className="text-sm text-gray-400">Tier {item.strength}</p>}
                  </div>

                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-emerald-300">
                      <span className="font-semibold">{item.tycPrice} TYC</span>
                    </p>
                    <p className="text-sm text-cyan-300 font-semibold">
                      {item.usdcPrice} USDC
                    </p>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStockShop(item.perk, item.strength);
                    }}
                    disabled={anyPending}
                    className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-xl font-bold transition disabled:opacity-50 shadow-md"
                  >
                    {pendingStock ? 'Stocking...' : 'Stock 50 Units'}
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {activeSection === 'manage' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Settings className="w-6 h-6 text-yellow-400" /> Set Backend Minter
              </h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="New Minter Address"
                  value={newMinter}
                  onChange={(e) => setNewMinter(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
                <button
                  onClick={handleSetBackendMinter}
                  disabled={anyPending || !newMinter}
                  className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {pendingMinter ? 'Setting...' : 'Set Minter'}
                </button>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <PauseCircle className="w-6 h-6 text-red-400" /> Contract Control
              </h3>
              <div className="flex gap-4">
                <button
                  onClick={() => pause()}
                  disabled={anyPending || isPaused}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {pendingPause ? 'Pausing...' : 'Pause'}
                </button>
                <button
                  onClick={() => unpause()}
                  disabled={anyPending || !isPaused}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {pendingPause ? 'Unpausing...' : 'Unpause'}
                </button>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <RefreshCw className="w-6 h-6 text-blue-400" /> Restock Collectible
              </h3>
              <div className="space-y-4">
                <input
                  type="number"
                  placeholder="Token ID"
                  value={restockTokenId}
                  onChange={(e) => setRestockTokenId(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Amount to Add"
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleRestock}
                  disabled={anyPending || !restockTokenId || !restockAmount}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {pendingRestock ? 'Restocking...' : 'Restock'}
                </button>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-green-400" /> Update Prices
              </h3>
              <div className="space-y-4">
                <input
                  type="number"
                  placeholder="Token ID"
                  value={updateTokenId}
                  onChange={(e) => setUpdateTokenId(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="New TYC Price"
                  value={updateTycPrice}
                  onChange={(e) => setUpdateTycPrice(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="New USDC Price"
                  value={updateUsdcPrice}
                  onChange={(e) => setUpdateUsdcPrice(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  onClick={handleUpdatePrices}
                  disabled={anyPending || !updateTokenId}
                  className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {pendingUpdate ? 'Updating...' : 'Update Prices'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeSection === 'funds' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Banknote className="w-6 h-6 text-yellow-400" /> Withdraw Funds
            </h3>
            <div className="space-y-4">
              <select
                value={withdrawToken}
                onChange={(e) => setWithdrawToken(e.target.value as 'TYC' | 'USDC')}
                className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 text-white"
              >
                <option value="TYC">TYC</option>
                <option value="USDC">USDC</option>
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="Amount"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <input
                type="text"
                placeholder="Recipient Address"
                value={withdrawTo}
                onChange={(e) => setWithdrawTo(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <button
                onClick={handleWithdraw}
                disabled={anyPending || !withdrawAmount || !withdrawTo}
                className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 rounded-xl font-bold transition disabled:opacity-50"
              >
                {pendingWithdraw ? 'Withdrawing...' : 'Withdraw'}
              </button>
            </div>
          </motion.div>
        )}

        {currentTxHash && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 p-6 bg-green-900/90 rounded-2xl border border-green-600 shadow-2xl z-50"
          >
            <p className="text-xl font-bold text-green-300 text-center">Transaction Sent!</p>
            <a
              href={`https://basescan.org/tx/${currentTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-3 text-cyan-300 underline text-center"
            >
              View on Block Explorer
            </a>
          </motion.div>
        )}
      </div>
    </div>
  );
}