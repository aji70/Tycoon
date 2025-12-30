'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits, Address } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Crown, Coins, Sparkles, Gem, Shield, DollarSign, Wallet, Package, AlertTriangle,
  Settings, PlusCircle, Gift, Banknote, PauseCircle, PlayCircle, RefreshCw, Edit2
} from 'lucide-react';
import RewardABI from '@/context/abi/rewardabi.json';
import { REWARD_CONTRACT_ADDRESSES, USDC_TOKEN_ADDRESS, TYC_TOKEN_ADDRESS } from '@/constants/contracts';

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

  const { writeContract, data: txHash, isPending: isWriting, error: writeError, reset } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });
  const isLoading = isWriting || isConfirming;

  // Form states
  const [newMinter, setNewMinter] = useState('');
  const [voucherRecipient, setVoucherRecipient] = useState('');
  const [voucherValue, setVoucherValue] = useState('');
  const [collectibleRecipient, setCollectibleRecipient] = useState('');
  const [selectedPerk, setSelectedPerk] = useState<CollectiblePerk>(CollectiblePerk.EXTRA_TURN);
  const [collectibleStrength, setCollectibleStrength] = useState('1');
  const [stockAmount, setStockAmount] = useState('500');
  const [stockTycPrice, setStockTycPrice] = useState('');
  const [stockUsdcPrice, setStockUsdcPrice] = useState('');
  const [restockTokenId, setRestockTokenId] = useState('');
  const [restockAmount, setRestockAmount] = useState('100');
  const [updateTokenId, setUpdateTokenId] = useState('');
  const [updateTycPrice, setUpdateTycPrice] = useState('');
  const [updateUsdcPrice, setUpdateUsdcPrice] = useState('');
  const [withdrawToken, setWithdrawToken] = useState<'TYC' | 'USDC'>('TYC');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawTo, setWithdrawTo] = useState('');

  // Fetch contract state
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
    args: [contractAddress as Address],
    query: { enabled: !!contractAddress && !!tycAddress },
  });

  const usdcBalance = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [contractAddress as Address],
    query: { enabled: !!contractAddress && !!usdcAddress },
  });

  const tycDecimals = useReadContract({
    address: tycAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: !!tycAddress },
  });

  const usdcDecimals = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: !!usdcAddress },
  });

  // Shop inventory using enumeration
  const shopTokenCount = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'ownedTokenCount',
    args: [contractAddress as Address],
    query: { enabled: !!contractAddress },
  });

  const shopTokens = [];
  for (let i = 0; i < Number(shopTokenCount.data || 0); i++) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const tokenIdResult = useReadContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'tokenOfOwnerByIndex',
      args: [contractAddress as Address, BigInt(i)],
      query: { enabled: !!contractAddress && shopTokenCount.data !== undefined },
    });
    shopTokens.push(tokenIdResult);
  }

  const shopItems = shopTokens.map((res) => res.data as bigint | undefined).filter(Boolean);

  const shopItemInfos = shopItems.map((tokenId) => 
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useReadContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'getCollectibleInfo',
      args: [tokenId!],
      query: { enabled: !!tokenId },
    })
  );

  useEffect(() => {
    setIsPaused(!!pausedResult.data);
    setBackendMinter(backendMinterResult.data as Address || null);
    setOwner(ownerResult.data as Address || null);
    setWithdrawTo(ownerResult.data as string || '');
  }, [pausedResult.data, backendMinterResult.data, ownerResult.data]);

  useEffect(() => {
    if (txHash && !isConfirming && !isWriting) {
      setStatus({ type: 'success', message: 'Transaction successful!' });
      reset();
    }
    if (writeError) {
      setStatus({ type: 'error', message: writeError.message || 'Transaction failed' });
      reset();
    }
  }, [txHash, isConfirming, isWriting, writeError, reset]);

  const showStatus = (type: 'success' | 'error' | 'info', message: string) => {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), 5000);
  };

  const handleSetBackendMinter = () => {
    if (!contractAddress || !newMinter) return;
    writeContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'setBackendMinter',
      args: [newMinter as Address],
    });
    setNewMinter('');
  };

  const handleMintVoucher = () => {
    if (!contractAddress || !voucherRecipient || !voucherValue) return;
    const valueWei = parseUnits(voucherValue, 18); // Assuming 18 decimals for TYC
    writeContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'mintVoucher',
      args: [voucherRecipient as Address, valueWei],
    });
    setVoucherRecipient('');
    setVoucherValue('');
  };

  const handleMintCollectible = () => {
    if (!contractAddress || !collectibleRecipient) return;
    writeContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'mintCollectible',
      args: [collectibleRecipient as Address, BigInt(selectedPerk), BigInt(collectibleStrength || 1)],
    });
    setCollectibleRecipient('');
    setCollectibleStrength('1');
  };

  const handleStockShop = () => {
    if (!contractAddress) return;
    const amount = BigInt(stockAmount || 500);
    const tycWei = stockTycPrice ? parseUnits(stockTycPrice, 18) : 0;
    const usdcWei = stockUsdcPrice ? parseUnits(stockUsdcPrice, 6) : 0;
    writeContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'stockShop',
      args: [amount, BigInt(selectedPerk), BigInt(collectibleStrength || 1), tycWei, usdcWei],
    });
    setStockAmount('500');
    setStockTycPrice('');
    setStockUsdcPrice('');
    setCollectibleStrength('1');
  };

  const handleRestock = () => {
    if (!contractAddress || !restockTokenId || !restockAmount) return;
    writeContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'restockCollectible',
      args: [BigInt(restockTokenId), BigInt(restockAmount)],
    });
    setRestockTokenId('');
    setRestockAmount('100');
  };

  const handleUpdatePrices = () => {
    if (!contractAddress || !updateTokenId) return;
    const tycWei = updateTycPrice ? parseUnits(updateTycPrice, 18) : 0;
    const usdcWei = updateUsdcPrice ? parseUnits(updateUsdcPrice, 6) : 0;
    writeContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'updateCollectiblePrices',
      args: [BigInt(updateTokenId), tycWei, usdcWei],
    });
    setUpdateTokenId('');
    setUpdateTycPrice('');
    setUpdateUsdcPrice('');
  };

  const handlePause = (pause: boolean) => {
    if (!contractAddress) return;
    writeContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: pause ? 'pause' : 'unpause',
    });
  };

  const handleWithdraw = () => {
    if (!contractAddress || !withdrawAmount || !withdrawTo) return;
    const tokenAddr = withdrawToken === 'TYC' ? tycAddress! : usdcAddress!;
    const decimals = withdrawToken === 'TYC' ? (tycDecimals.data as number || 18) : (usdcDecimals.data as number || 6);
    const amountWei = parseUnits(withdrawAmount, decimals);
    writeContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'withdrawFunds',
      args: [tokenAddr, withdrawTo as Address, amountWei],
    });
    setWithdrawAmount('');
    setWithdrawTo(owner || '');
  };

  if (!isConnected || !userAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0f1a] to-[#0f1a27]">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="p-10 bg-red-950/60 rounded-3xl border border-red-700/50 text-center">
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
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="p-10 bg-red-950/60 rounded-3xl border border-red-700/50 text-center">
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
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-extrabold mb-4 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Tycoon Reward Admin Panel
          </h1>
          <p className="text-xl text-gray-400">Manage minter • Mint items • Stock shop • Update prices • Control contract</p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-4 mb-10">
          <button onClick={() => setActiveSection('overview')} className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${activeSection === 'overview' ? 'bg-gradient-to-r from-cyan-600 to-purple-600' : 'bg-gray-800/60'}`}>
            <Settings className="w-5 h-5" /> Overview
          </button>
          <button onClick={() => setActiveSection('mint')} className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${activeSection === 'mint' ? 'bg-gradient-to-r from-cyan-600 to-purple-600' : 'bg-gray-800/60'}`}>
            <PlusCircle className="w-5 h-5" /> Mint
          </button>
          <button onClick={() => setActiveSection('stock')} className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${activeSection === 'stock' ? 'bg-gradient-to-r from-cyan-600 to-purple-600' : 'bg-gray-800/60'}`}>
            <Package className="w-5 h-5" /> Stock Shop
          </button>
          <button onClick={() => setActiveSection('manage')} className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${activeSection === 'manage' ? 'bg-gradient-to-r from-cyan-600 to-purple-600' : 'bg-gray-800/60'}`}>
            <Edit2 className="w-5 h-5" /> Manage
          </button>
          <button onClick={() => setActiveSection('funds')} className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${activeSection === 'funds' ? 'bg-gradient-to-r from-cyan-600 to-purple-600' : 'bg-gray-800/60'}`}>
            <Wallet className="w-5 h-5" /> Funds
          </button>
        </div>

        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-8 p-6 rounded-2xl border text-center max-w-2xl mx-auto ${status.type === 'success' ? 'bg-green-900/40 border-green-600' : status.type === 'error' ? 'bg-red-900/40 border-red-600' : 'bg-blue-900/40 border-blue-600'}`}
            >
              <p className="font-medium">{status.message}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {activeSection === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Settings className="w-6 h-6 text-cyan-400" /> Contract Status</h3>
              <p className="mb-2">Paused: {isPaused ? 'Yes' : 'No'}</p>
              <p className="mb-2">Owner: {owner?.slice(0,6)}...{owner?.slice(-4)}</p>
              <p>Backend Minter: {backendMinter ? `${backendMinter.slice(0,6)}...${backendMinter.slice(-4)}` : 'Not set'}</p>
            </div>
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Wallet className="w-6 h-6 text-emerald-400" /> Balances</h3>
              <p className="mb-2">TYC: {tycBalance.data ? Number(formatUnits(tycBalance.data as bigint, tycDecimals.data as number || 18)).toFixed(2) : '0.00'}</p>
              <p>USDC: {usdcBalance.data ? Number(formatUnits(usdcBalance.data as bigint, usdcDecimals.data as number || 6)).toFixed(2) : '0.00'}</p>
            </div>
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Package className="w-6 h-6 text-purple-400" /> Shop Inventory</h3>
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {shopItems.map((tokenId, index) => {
                  const info = shopItemInfos[index]?.data as [number, bigint, bigint, bigint, bigint] | undefined;
                  if (!info) return null;
                  return (
                    <li key={index} className="flex justify-between text-sm">
                      <span>ID: {tokenId?.toString()} ({PERK_NAMES[info[0] as CollectiblePerk]})</span>
                      <span>Stock: {info[4].toString()}</span>
                    </li>
                  );
                })}
                {shopItems.length === 0 && <p className="text-gray-400">No items in shop</p>}
              </ul>
            </div>
          </motion.div>
        )}

        {activeSection === 'mint' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Gift className="w-6 h-6 text-blue-400" /> Mint Voucher</h3>
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
                  placeholder="TYC Value"
                  value={voucherValue}
                  onChange={(e) => setVoucherValue(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleMintVoucher}
                  disabled={isLoading || !voucherRecipient || !voucherValue}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {isLoading ? 'Minting...' : 'Mint Voucher'}
                </button>
              </div>
            </div>
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Gem className="w-6 h-6 text-purple-400" /> Mint Collectible</h3>
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
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {Object.entries(PERK_NAMES).map(([value, name]) => (
                    <option key={value} value={value}>{name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Strength (for tiered)"
                  value={collectibleStrength}
                  onChange={(e) => setCollectibleStrength(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={handleMintCollectible}
                  disabled={isLoading || !collectibleRecipient}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {isLoading ? 'Minting...' : 'Mint Collectible'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeSection === 'stock' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Package className="w-6 h-6 text-green-400" /> Stock Shop</h3>
            <div className="space-y-4">
              <select
                value={selectedPerk}
                onChange={(e) => setSelectedPerk(Number(e.target.value) as CollectiblePerk)}
                className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {Object.entries(PERK_NAMES).map(([value, name]) => (
                  <option key={value} value={value}>{name}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Strength (for tiered)"
                value={collectibleStrength}
                onChange={(e) => setCollectibleStrength(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                type="number"
                placeholder="Amount (default 500)"
                value={stockAmount}
                onChange={(e) => setStockAmount(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                type="number"
                step="0.01"
                placeholder="TYC Price"
                value={stockTycPrice}
                onChange={(e) => setStockTycPrice(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <input
                type="number"
                step="0.01"
                placeholder="USDC Price"
                value={stockUsdcPrice}
                onChange={(e) => setStockUsdcPrice(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={handleStockShop}
                disabled={isLoading}
                className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold transition disabled:opacity-50"
              >
                {isLoading ? 'Stocking...' : 'Stock Shop'}
              </button>
            </div>
          </motion.div>
        )}

        {activeSection === 'manage' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Settings className="w-6 h-6 text-yellow-400" /> Set Backend Minter</h3>
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
                  disabled={isLoading || !newMinter}
                  className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {isLoading ? 'Setting...' : 'Set Minter'}
                </button>
              </div>
            </div>
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><PauseCircle className="w-6 h-6 text-red-400" /> Contract Control</h3>
              <div className="flex gap-4">
                <button
                  onClick={() => handlePause(true)}
                  disabled={isLoading || isPaused}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {isLoading ? 'Pausing...' : 'Pause'}
                </button>
                <button
                  onClick={() => handlePause(false)}
                  disabled={isLoading || !isPaused}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {isLoading ? 'Unpausing...' : 'Unpause'}
                </button>
              </div>
            </div>
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><RefreshCw className="w-6 h-6 text-blue-400" /> Restock Collectible</h3>
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
                  placeholder="Additional Amount"
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleRestock}
                  disabled={isLoading || !restockTokenId || !restockAmount}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {isLoading ? 'Restocking...' : 'Restock'}
                </button>
              </div>
            </div>
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><DollarSign className="w-6 h-6 text-green-400" /> Update Prices</h3>
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
                  disabled={isLoading || !updateTokenId}
                  className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {isLoading ? 'Updating...' : 'Update Prices'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeSection === 'funds' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Banknote className="w-6 h-6 text-yellow-400" /> Withdraw Funds</h3>
            <div className="space-y-4">
              <select
                value={withdrawToken}
                onChange={(e) => setWithdrawToken(e.target.value as 'TYC' | 'USDC')}
                className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500"
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
                placeholder="To Address"
                value={withdrawTo}
                onChange={(e) => setWithdrawTo(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <button
                onClick={handleWithdraw}
                disabled={isLoading || !withdrawAmount || !withdrawTo}
                className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 rounded-xl font-bold transition disabled:opacity-50"
              >
                {isLoading ? 'Withdrawing...' : 'Withdraw'}
              </button>
            </div>
          </motion.div>
        )}

        {txHash && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 p-6 bg-green-900/90 rounded-2xl border border-green-600 shadow-2xl z-50">
            <p className="text-xl font-bold text-green-300 text-center">Transaction Sent!</p>
            <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="block mt-3 text-cyan-300 underline text-center">
              View on Explorer
            </a>
          </motion.div>
        )}
      </div>
    </div>
  );
}