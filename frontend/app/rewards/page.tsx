'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Crown, Zap, Shield, Sparkles, Gem, Coins, 
  ShoppingBag, Package, Ticket, RefreshCw, DollarSign, AlertTriangle 
} from 'lucide-react';
import RewardABI from '@/context/rewardabi.json';
import { REWARD_CONTRACT_ADDRESSES } from '@/constants/contracts';

const perkIcons = {
  1: <Zap className="w-6 h-6" />,
  2: <Shield className="w-6 h-6" />,
  3: <Coins className="w-6 h-6" />,
  4: <Sparkles className="w-6 h-6" />,
  5: <Gem className="w-6 h-6" />,
  6: <Crown className="w-6 h-6" />,
  7: <Shield className="w-6 h-6" />,
  8: <Coins className="w-6 h-6" />,
  9: <Gem className="w-6 h-6" />,
  10: <Crown className="w-6 h-6" />,
};

const rarityStyles = {
  common: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/40 text-emerald-300',
  medium: 'from-blue-500/20 to-blue-600/10 border-blue-500/40 text-blue-300',
  rare: 'from-purple-500/20 to-purple-600/10 border-purple-500/40 text-purple-300',
  epic: 'from-pink-500/20 to-pink-600/10 border-pink-500/40 text-pink-300',
  legendary: 'from-yellow-500/20 to-amber-600/10 border-yellow-500/40 text-yellow-300',
  tiered: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/40 text-cyan-300',
};

const perks = [
  { id: 1, name: 'EXTRA_TURN', rarity: 'common', tyc: '5', usdc: '0.10' },
  { id: 2, name: 'JAIL_FREE', rarity: 'rare', tyc: '10', usdc: '0.30' },
  { id: 3, name: 'DOUBLE_RENT', rarity: 'medium', tyc: '12', usdc: '0.40' },
  { id: 4, name: 'ROLL_BOOST', rarity: 'medium', tyc: '8', usdc: '0.25' },
  { id: 5, name: 'CASH_TIERED', rarity: 'tiered', tyc: 'varies', usdc: 'varies' },
  { id: 6, name: 'TELEPORT', rarity: 'epic', tyc: '15', usdc: '0.60' },
  { id: 7, name: 'SHIELD', rarity: 'rare', tyc: '12', usdc: '0.50' },
  { id: 8, name: 'PROPERTY_DISCOUNT', rarity: 'medium', tyc: '10', usdc: '0.40' },
  { id: 9, name: 'TAX_REFUND', rarity: 'tiered', tyc: 'varies', usdc: 'varies' },
  { id: 10, name: 'ROLL_EXACT', rarity: 'legendary', tyc: '20', usdc: '1.00' },
];

const cashTiers = [
  { tier: 1, value: 10, label: 'Tier 1 - 10 TYC' },
  { tier: 2, value: 25, label: 'Tier 2 - 25 TYC' },
  { tier: 3, value: 50, label: 'Tier 3 - 50 TYC' },
  { tier: 4, value: 100, label: 'Tier 4 - 100 TYC' },
  { tier: 5, value: 250, label: 'Tier 5 - 250 TYC' },
];

export default function RewardAdminTester() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES];

  const [activeTab, setActiveTab] = useState<'stock' | 'direct' | 'voucher' | 'restock' | 'prices'>('stock');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Form States
  const [voucher, setVoucher] = useState({ recipient: '', amount: '50' });
  const [direct, setDirect] = useState({ recipient: '', perk: 1, strength: '1' });
  const [bulkStock, setBulkStock] = useState('100');
  const [restock, setRestock] = useState({ tokenId: '', amount: '100' });
  const [priceUpdate, setPriceUpdate] = useState({ tokenId: '', tyc: '', usdc: '' });

  const { writeContract, data: txHash, isPending: isWriting, error: writeError, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const isLoading = isWriting || isConfirming;

  const explorer = chainId === 42220 ? 'explorer.celo.org' :
                  chainId === 11155111 ? 'sepolia.etherscan.io' : 'etherscan.io';

  // Auto-clear status after 8 seconds
  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleStockPerk = (perkId: number, tycPrice: string, usdcPrice: string, overrideStrength?: string) => {
    if (!contractAddress) return;

    const amount = BigInt(bulkStock || '100');
    const strength = overrideStrength || (perkId === 5 || perkId === 9 ? '1' : '1'); // default 1, override for tiered

    const tycWei = tycPrice !== 'varies' ? parseUnits(tycPrice, 18) : BigInt(0);
    const usdcWei = usdcPrice !== 'varies' ? parseUnits(usdcPrice, 6) : BigInt(0);

    writeContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'stockShop',
      args: [amount, BigInt(perkId), BigInt(strength), tycWei, usdcWei],
    });
  };

  const handleBulkStockAll = () => {
    if (!confirm('This will send multiple transactions to stock 100 of each perk. Continue?')) return;
    perks.forEach(perk => {
      if (perk.tyc !== 'varies') {
        handleStockPerk(perk.id, perk.tyc, perk.usdc);
      }
    });
    setStatus({ type: 'info', message: 'Bulk stocking started... watch your wallet!' });
  };

  const handleDirectMint = () => {
    if (!direct.recipient) return setStatus({ type: 'error', message: 'Recipient address required' });
    writeContract({
      address: contractAddress!,
      abi: RewardABI,
      functionName: 'mintCollectible',
      args: [direct.recipient as `0x${string}`, BigInt(direct.perk), BigInt(direct.strength)],
    });
  };

  const handleMintVoucher = () => {
    if (!voucher.recipient || !voucher.amount) return setStatus({ type: 'error', message: 'All fields required' });
    const amountWei = parseUnits(voucher.amount, 18);
    writeContract({
      address: contractAddress!,
      abi: RewardABI,
      functionName: 'mintVoucher',
      args: [voucher.recipient as `0x${string}`, amountWei],
    });
  };

  const handleRestock = () => {
    if (!restock.tokenId || !restock.amount) return setStatus({ type: 'error', message: 'Token ID & amount required' });
    writeContract({
      address: contractAddress!,
      abi: RewardABI,
      functionName: 'restockCollectible',
      args: [BigInt(restock.tokenId), BigInt(restock.amount)],
    });
  };

  const handleUpdatePrices = () => {
    if (!priceUpdate.tokenId) return setStatus({ type: 'error', message: 'Token ID required' });
    const tycWei = priceUpdate.tyc ? parseUnits(priceUpdate.tyc, 18) : BigInt(0);
    const usdcWei = priceUpdate.usdc ? parseUnits(priceUpdate.usdc, 6) : BigInt(0);
    writeContract({
      address: contractAddress!,
      abi: RewardABI,
      functionName: 'updateCollectiblePrices',
      args: [BigInt(priceUpdate.tokenId), tycWei, usdcWei],
    });
  };

  const resetForms = () => {
    setVoucher({ recipient: '', amount: '50' });
    setDirect({ recipient: '', perk: 1, strength: '1' });
    setBulkStock('100');
    setRestock({ tokenId: '', amount: '100' });
    setPriceUpdate({ tokenId: '', tyc: '', usdc: '' });
    reset();
    setStatus(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1a] via-[#0d141f] to-[#0f1a27] text-white pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-6xl font-extrabold mb-4 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Tycoon Reward Admin
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Powerful control panel • Economy-balanced prices • Bulk operations
          </p>
        </motion.div>

        {!isConnected ? (
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center py-24"
          >
            <div className="inline-block p-10 bg-gradient-to-br from-red-950/60 to-red-900/40 rounded-3xl border border-red-700/50 backdrop-blur-sm">
              <AlertTriangle className="w-16 h-16 mx-auto mb-6 text-red-400" />
              <h2 className="text-3xl font-bold mb-4">Wallet Not Connected</h2>
              <p className="text-xl text-gray-300">Please connect your wallet to access admin controls</p>
            </div>
          </motion.div>
        ) : !contractAddress ? (
          <div className="text-center py-24 text-rose-400 text-2xl font-medium">
            No contract deployed on current chain (ID: {chainId})
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Status Messages */}
              <AnimatePresence>
                {status && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`mb-8 p-6 rounded-2xl border ${
                      status.type === 'success' ? 'bg-green-900/40 border-green-600' :
                      status.type === 'error' ? 'bg-red-900/40 border-red-600' :
                      'bg-blue-900/40 border-blue-600'
                    }`}
                  >
                    <p className="text-center font-medium">{status.message}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation Tabs */}
              <div className="flex flex-wrap justify-center gap-4 mb-12">
                {[
                  { id: 'stock', label: 'Bulk Stock Shop', icon: ShoppingBag },
                  { id: 'direct', label: 'Direct Mint', icon: Crown },
                  { id: 'voucher', label: 'Mint Voucher', icon: Ticket },
                  { id: 'restock', label: 'Restock', icon: RefreshCw },
                  { id: 'prices', label: 'Update Prices', icon: DollarSign },
                ].map((tab) => (
                  <motion.button
                    key={tab.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-lg shadow-purple-500/30'
                        : 'bg-gray-800/60 hover:bg-gray-700/80 border border-gray-700'
                    }`}
                  >
                    <tab.icon className="w-5 h-5" />
                    {tab.label}
                  </motion.button>
                ))}
              </div>

              {/* STOCK TAB - Main Feature */}
              {activeTab === 'stock' && (
                <div className="space-y-12">
                  <div className="text-center">
                    <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                      Bulk Stock Shop Items
                    </h2>
                    <p className="text-gray-400 mb-6">Balanced prices (reduced ~5×) • Recommended economy setup</p>

                    <div className="inline-flex items-center gap-4 bg-gray-900/60 backdrop-blur-sm p-4 rounded-2xl border border-gray-700/50">
                      <label className="text-lg font-medium">Amount per item:</label>
                      <input
                        type="number"
                        min="1"
                        value={bulkStock}
                        onChange={(e) => setBulkStock(e.target.value)}
                        className="w-32 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-center text-xl font-bold"
                      />
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleBulkStockAll}
                      disabled={isLoading}
                      className="mt-8 px-12 py-6 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-bold text-xl rounded-2xl shadow-2xl hover:shadow-orange-500/40 transition-all disabled:opacity-50"
                    >
                      {isLoading ? 'Processing...' : '🚀 STOCK ALL PERKS NOW'}
                    </motion.button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {perks.map((perk) => (
                      <motion.div
                        key={perk.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: perk.id * 0.05 }}
                        className={`rounded-2xl p-6 border bg-gradient-to-br ${rarityStyles[perk.rarity as keyof typeof rarityStyles]} backdrop-blur-sm`}
                      >
                        <div className="flex items-center gap-4 mb-5">
                          <div className="p-4 rounded-xl bg-black/40">
                            {perkIcons[perk.id as keyof typeof perkIcons]}
                          </div>
                          <div>
                            <h3 className="text-xl font-bold">{perk.name.replace(/_/g, ' ')}</h3>
                            <p className="text-sm capitalize opacity-80">{perk.rarity}</p>
                          </div>
                        </div>

                        <div className="space-y-3 mb-6">
                          <div className="flex justify-between text-sm">
                            <span>TYC Price</span>
                            <span className="font-bold">{perk.tyc === 'varies' ? 'Tiered' : `${perk.tyc} TYC`}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>USDC Price</span>
                            <span className="font-bold">{perk.usdc === 'varies' ? 'Tiered' : `$${perk.usdc}`}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleStockPerk(perk.id, perk.tyc, perk.usdc)}
                          disabled={isLoading}
                          className="w-full py-4 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                        >
                          Stock {bulkStock} ×
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* DIRECT MINT */}
              {activeTab === 'direct' && (
                <div className="max-w-2xl mx-auto">
                  <div className="bg-gradient-to-br from-indigo-950/70 to-purple-950/70 rounded-3xl p-10 border border-purple-500/30 backdrop-blur-md">
                    <h2 className="text-4xl font-bold text-center mb-10 bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                      Direct Mint Reward
                    </h2>

                    <input
                      placeholder="Recipient address (0x...)"
                      value={direct.recipient}
                      onChange={(e) => setDirect({ ...direct, recipient: e.target.value })}
                      className="w-full mb-6 px-6 py-4 bg-gray-900/70 border border-gray-700 rounded-xl focus:border-purple-500 focus:ring-purple-500"
                    />

                    <select
                      value={direct.perk}
                      onChange={(e) => setDirect({ ...direct, perk: Number(e.target.value) })}
                      className="w-full mb-6 px-6 py-4 bg-gray-900/70 border border-gray-700 rounded-xl focus:border-purple-500 focus:ring-purple-500"
                    >
                      {perks.map(p => (
                        <option key={p.id} value={p.id}>{p.name.replace(/_/g, ' ')} ({p.rarity})</option>
                      ))}
                    </select>

                    <div className="mb-8">
                      <label className="block text-sm mb-2 text-gray-300">
                        Strength / Tier {direct.perk === 5 || direct.perk === 9 ? '(1-5 for cash perks)' : ''}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={direct.perk === 5 || direct.perk === 9 ? "5" : "999"}
                        value={direct.strength}
                        onChange={(e) => setDirect({ ...direct, strength: e.target.value })}
                        className="w-full px-6 py-4 bg-gray-900/70 border border-gray-700 rounded-xl focus:border-purple-500 focus:ring-purple-500"
                      />
                    </div>

                    <button
                      onClick={handleDirectMint}
                      disabled={isLoading}
                      className="w-full py-6 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 font-bold text-xl rounded-2xl shadow-lg shadow-cyan-500/30 transition-all disabled:opacity-50"
                    >
                      {isLoading ? 'Minting...' : 'Mint Direct Collectible'}
                    </button>
                  </div>
                </div>
              )}

              {/* VOUCHER */}
              {activeTab === 'voucher' && (
                <div className="max-w-2xl mx-auto">
                  <div className="bg-gradient-to-br from-purple-950/70 to-pink-950/70 rounded-3xl p-10 border border-pink-500/30 backdrop-blur-md">
                    <h2 className="text-4xl font-bold text-center mb-10 bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                      Mint TYC Voucher
                    </h2>

                    <input
                      placeholder="Recipient address"
                      value={voucher.recipient}
                      onChange={(e) => setVoucher({ ...voucher, recipient: e.target.value })}
                      className="w-full mb-6 px-6 py-4 bg-gray-900/70 border border-gray-700 rounded-xl focus:border-pink-500 focus:ring-pink-500"
                    />

                    <input
                      type="number"
                      placeholder="TYC Amount"
                      value={voucher.amount}
                      onChange={(e) => setVoucher({ ...voucher, amount: e.target.value })}
                      className="w-full mb-8 px-6 py-4 bg-gray-900/70 border border-gray-700 rounded-xl focus:border-pink-500 focus:ring-pink-500"
                    />

                    <button
                      onClick={handleMintVoucher}
                      disabled={isLoading}
                      className="w-full py-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-bold text-xl rounded-2xl shadow-lg shadow-pink-500/30 transition-all disabled:opacity-50"
                    >
                      {isLoading ? 'Minting...' : 'Create Voucher'}
                    </button>
                  </div>
                </div>
              )}

              {/* RESTOCK & PRICES (simplified but beautiful) */}
              {activeTab === 'restock' && (
                <div className="max-w-2xl mx-auto">
                  <div className="bg-gradient-to-br from-orange-950/70 to-rose-950/70 rounded-3xl p-10 border border-orange-500/30 backdrop-blur-md">
                    <h2 className="text-4xl font-bold text-center mb-10 bg-gradient-to-r from-orange-400 to-rose-500 bg-clip-text text-transparent">
                      Restock Collectible
                    </h2>

                    <input
                      placeholder="Token ID (e.g. 2000000001)"
                      value={restock.tokenId}
                      onChange={(e) => setRestock({ ...restock, tokenId: e.target.value })}
                      className="w-full mb-6 px-6 py-4 bg-gray-900/70 border border-gray-700 rounded-xl focus:border-orange-500 focus:ring-orange-500"
                    />

                    <input
                      type="number"
                      placeholder="Additional Amount"
                      value={restock.amount}
                      onChange={(e) => setRestock({ ...restock, amount: e.target.value })}
                      className="w-full mb-8 px-6 py-4 bg-gray-900/70 border border-gray-700 rounded-xl focus:border-orange-500 focus:ring-orange-500"
                    />

                    <button
                      onClick={handleRestock}
                      disabled={isLoading}
                      className="w-full py-6 bg-gradient-to-r from-orange-600 to-rose-600 hover:from-orange-500 hover:to-rose-500 font-bold text-xl rounded-2xl shadow-lg shadow-orange-500/30 transition-all disabled:opacity-50"
                    >
                      {isLoading ? 'Restocking...' : 'Restock Item'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'prices' && (
                <div className="max-w-2xl mx-auto">
                  <div className="bg-gradient-to-br from-teal-950/70 to-cyan-950/70 rounded-3xl p-10 border border-cyan-500/30 backdrop-blur-md">
                    <h2 className="text-4xl font-bold text-center mb-10 bg-gradient-to-r from-teal-400 to-cyan-500 bg-clip-text text-transparent">
                      Update Collectible Prices
                    </h2>

                    <input
                      placeholder="Token ID"
                      value={priceUpdate.tokenId}
                      onChange={(e) => setPriceUpdate({ ...priceUpdate, tokenId: e.target.value })}
                      className="w-full mb-6 px-6 py-4 bg-gray-900/70 border border-gray-700 rounded-xl focus:border-cyan-500 focus:ring-cyan-500"
                    />

                    <input
                      placeholder="New TYC Price (0 = disable)"
                      value={priceUpdate.tyc}
                      onChange={(e) => setPriceUpdate({ ...priceUpdate, tyc: e.target.value })}
                      className="w-full mb-6 px-6 py-4 bg-gray-900/70 border border-gray-700 rounded-xl focus:border-cyan-500 focus:ring-cyan-500"
                    />

                    <input
                      placeholder="New USDC Price (0 = disable)"
                      value={priceUpdate.usdc}
                      onChange={(e) => setPriceUpdate({ ...priceUpdate, usdc: e.target.value })}
                      className="w-full mb-8 px-6 py-4 bg-gray-900/70 border border-gray-700 rounded-xl focus:border-cyan-500 focus:ring-cyan-500"
                    />

                    <button
                      onClick={handleUpdatePrices}
                      disabled={isLoading}
                      className="w-full py-6 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 font-bold text-xl rounded-2xl shadow-lg shadow-cyan-500/30 transition-all disabled:opacity-50"
                    >
                      {isLoading ? 'Updating...' : 'Update Prices'}
                    </button>
                  </div>
                </div>
              )}

              {/* Transaction Result */}
              {txHash && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-12 p-10 bg-gradient-to-br from-green-950 to-emerald-950 rounded-3xl border border-green-600/50 text-center"
                >
                  <h3 className="text-4xl font-bold mb-6 text-green-300">Success! 🎉</h3>
                  
                  <a
                    href={`https://${explorer}/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-12 py-5 bg-green-700 hover:bg-green-600 rounded-2xl font-bold text-xl mb-6 transition-colors"
                  >
                    View on Explorer
                  </a>

                  <button
                    onClick={resetForms}
                    className="block mx-auto px-10 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl font-medium transition-colors"
                  >
                    Reset & New Action
                  </button>
                </motion.div>
              )}

              {writeError && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-12 p-8 bg-red-950/80 rounded-3xl border border-red-700"
                >
                  <h3 className="text-2xl font-bold text-red-400 mb-4">Transaction Failed</h3>
                  <p className="text-gray-300 break-all font-mono text-sm">{writeError.message}</p>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}