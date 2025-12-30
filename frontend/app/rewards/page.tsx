'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Crown, Coins, Sparkles, Gem, Shield, DollarSign, Wallet, Package, AlertTriangle
} from 'lucide-react';
import RewardABI from '@/context/rewardabi.json';
import { REWARD_CONTRACT_ADDRESSES, USDC_TOKEN_ADDRESS, TYC_TOKEN_ADDRESS } from '@/constants/contracts';

const FIXED_TOKEN_IDS = {
  EXTRA_TURN: 2000000000,
  JAIL_FREE: 2000000001,
  DOUBLE_RENT: 2000000002,
  ROLL_BOOST: 2000000003,
  CASH_TIER1: 2000000004,
  CASH_TIER2: 2000000010,
  CASH_TIER3: 2000000011,
  CASH_TIER4: 2000000012,
  CASH_TIER5: 2000000013,
  TELEPORT: 2000000005,
  SHIELD: 2000000006,
  PROPERTY_DISCOUNT: 2000000007,
  TAX_REFUND_TIER1: 2000000008,
  TAX_REFUND_TIER3: 2000000014,
  ROLL_EXACT: 2000000009,
};

const PERKS = [
  { tokenId: FIXED_TOKEN_IDS.EXTRA_TURN, name: "Extra Turn", rarity: "common", icon: <Zap className="w-8 h-8" />, perkId: 1 },
  { tokenId: FIXED_TOKEN_IDS.JAIL_FREE, name: "Get Out of Jail Free", rarity: "rare", icon: <Crown className="w-8 h-8" />, perkId: 2 },
  { tokenId: FIXED_TOKEN_IDS.DOUBLE_RENT, name: "Double Rent", rarity: "medium", icon: <Coins className="w-8 h-8" />, perkId: 3 },
  { tokenId: FIXED_TOKEN_IDS.ROLL_BOOST, name: "Roll Boost", rarity: "medium", icon: <Sparkles className="w-8 h-8" />, perkId: 4 },
  { tokenId: FIXED_TOKEN_IDS.CASH_TIER1, name: "Instant Cash (Tier 1)", rarity: "tiered", icon: <Gem className="w-8 h-8" />, perkId: 5, strength: 1 },
  { tokenId: FIXED_TOKEN_IDS.CASH_TIER2, name: "Instant Cash (Tier 2)", rarity: "tiered", icon: <Gem className="w-8 h-8" />, perkId: 5, strength: 2 },
  { tokenId: FIXED_TOKEN_IDS.CASH_TIER3, name: "Instant Cash (Tier 3)", rarity: "tiered", icon: <Gem className="w-8 h-8" />, perkId: 5, strength: 3 },
  { tokenId: FIXED_TOKEN_IDS.CASH_TIER4, name: "Instant Cash (Tier 4)", rarity: "tiered", icon: <Gem className="w-8 h-8" />, perkId: 5, strength: 4 },
  { tokenId: FIXED_TOKEN_IDS.CASH_TIER5, name: "Instant Cash (Tier 5)", rarity: "tiered", icon: <Gem className="w-8 h-8" />, perkId: 5, strength: 5 },
  { tokenId: FIXED_TOKEN_IDS.TELEPORT, name: "Teleport", rarity: "epic", icon: <Zap className="w-8 h-8" />, perkId: 6 },
  { tokenId: FIXED_TOKEN_IDS.SHIELD, name: "Shield", rarity: "rare", icon: <Shield className="w-8 h-8" />, perkId: 7 },
  { tokenId: FIXED_TOKEN_IDS.PROPERTY_DISCOUNT, name: "Property Discount", rarity: "medium", icon: <Coins className="w-8 h-8" />, perkId: 8 },
  { tokenId: FIXED_TOKEN_IDS.TAX_REFUND_TIER1, name: "Tax Refund (Tier 1)", rarity: "tiered", icon: <Gem className="w-8 h-8" />, perkId: 9, strength: 1 },
  { tokenId: FIXED_TOKEN_IDS.TAX_REFUND_TIER3, name: "Tax Refund (Tier 3)", rarity: "tiered", icon: <Gem className="w-8 h-8" />, perkId: 9, strength: 3 },
  { tokenId: FIXED_TOKEN_IDS.ROLL_EXACT, name: "Exact Roll", rarity: "legendary", icon: <Sparkles className="w-8 h-8" />, perkId: 10 },
];

const rarityStyles = {
  common: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/40 text-emerald-300',
  medium: 'from-blue-500/20 to-blue-600/10 border-blue-500/40 text-blue-300',
  rare: 'from-purple-500/20 to-purple-600/10 border-purple-500/40 text-purple-300',
  epic: 'from-pink-500/20 to-pink-600/10 border-pink-500/40 text-pink-300',
  legendary: 'from-yellow-500/20 to-amber-600/10 border-yellow-500/40 text-yellow-300',
  tiered: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/40 text-cyan-300',
};
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export default function RewardAdminPanel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES];
  const usdcAddress = USDC_TOKEN_ADDRESS[chainId as keyof typeof USDC_TOKEN_ADDRESS];
  const tycAddress = TYC_TOKEN_ADDRESS[chainId as keyof typeof TYC_TOKEN_ADDRESS];

  const [activeTab, setActiveTab] = useState<'stock' | 'pricing' | 'funds'>('stock');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [selectedPerk, setSelectedPerk] = useState<typeof PERKS[0] | null>(null);
  const [tycPriceInput, setTycPriceInput] = useState('');
  const [usdcPriceInput, setUsdcPriceInput] = useState('');

  const { writeContract, data: txHash, isPending: isWriting, error: writeError, reset } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });
  const isLoading = isWriting || isConfirming;

  // Correctly fetch live stock using balanceOfBatch
  const stockResults = useReadContract({
    address: contractAddress ?? undefined,
    abi: RewardABI,
    functionName: 'balanceOfBatch',
    args: contractAddress ? [Array(PERKS.length).fill(contractAddress), PERKS.map(p => BigInt(p.tokenId))] : undefined,
    query: { enabled: !!contractAddress },
  });

  const currentStocks = stockResults.data && Array.isArray(stockResults.data)
    ? stockResults.data.map((s: bigint) => Number(s))
    : PERKS.map(() => 0);

  // Individual price lookups (fallback if no batch price function)
  // We'll just show placeholder prices or fetch one-by-one if needed — but stock is priority

const { address: userAddress } = useAccount();
const tycBalance = useReadContract({
  address: tycAddress ?? undefined,
  abi: ERC20_ABI,
  functionName: "balanceOf",
  args: contractAddress ? [contractAddress] : undefined,
  query: {
    enabled: !!contractAddress && !!userAddress,
  },
});

// USDC balance
const usdcBalance = useReadContract({
  address: usdcAddress ?? undefined,
  abi: ERC20_ABI,
  functionName: "balanceOf",
  args: contractAddress ? [contractAddress] : undefined,
  query: {
    enabled: !!USDC_TOKEN_ADDRESS && !!userAddress,
  },
});

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [status]);

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

  const handleStockShop = (perk: typeof PERKS[0], amount = 500) => {
    if (!contractAddress) return;

    writeContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'stockShop',
      args: [
        BigInt(amount),
        BigInt(perk.perkId),
        BigInt(perk.strength || 0),
        0, // We'll let the contract use current prices
        0,
      ],
    });
  };

  const handleSetPrice = () => {
    if (!selectedPerk || !contractAddress) return;

    const tycWei = tycPriceInput ? parseUnits(tycPriceInput, 18) : 0;
    const usdcWei = usdcPriceInput ? parseUnits(usdcPriceInput, 6) : 0;

    if (tycWei === 0 && usdcWei === 0) {
      setStatus({ type: 'error', message: 'At least one price must be set' });
      return;
    }

    writeContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'setCollectiblePrice',
      args: [
        BigInt(selectedPerk.tokenId),
        BigInt(selectedPerk.strength || 0),
        tycWei,
        usdcWei,
      ],
    });

    setTycPriceInput('');
    setUsdcPriceInput('');
    setSelectedPerk(null);
  };

  const handleWithdraw = (token: 'TYC' | 'USDC') => {
    if (!contractAddress) return;

    writeContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'withdrawFunds',
      args: [token === 'USDC'],
    });
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0f1a] to-[#0f1a27]">
        <div className="p-10 bg-red-950/60 rounded-3xl border border-red-700/50">
          <AlertTriangle className="w-16 h-16 mx-auto mb-6 text-red-400" />
          <h2 className="text-3xl font-bold text-center">Wallet Not Connected</h2>
        </div>
      </div>
    );
  }

  if (!contractAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0f1a] to-[#0f1a27] text-rose-400 text-2xl">
        No Reward contract on chain {chainId}
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
          <p className="text-xl text-gray-400">Manage stock • Set TYC & USDC prices • Withdraw funds</p>
        </motion.div>

        <div className="flex justify-center gap-4 mb-10 flex-wrap">
          <button onClick={() => setActiveTab('stock')} className={`px-8 py-3 rounded-xl font-semibold transition-all ${activeTab === 'stock' ? 'bg-gradient-to-r from-cyan-600 to-purple-600' : 'bg-gray-800/60'}`}>
            <Package className="inline w-5 h-5 mr-2" /> Stock
          </button>
          <button onClick={() => setActiveTab('pricing')} className={`px-8 py-3 rounded-xl font-semibold transition-all ${activeTab === 'pricing' ? 'bg-gradient-to-r from-cyan-600 to-purple-600' : 'bg-gray-800/60'}`}>
            <DollarSign className="inline w-5 h-5 mr-2" /> Pricing
          </button>
          <button onClick={() => setActiveTab('funds')} className={`px-8 py-3 rounded-xl font-semibold transition-all ${activeTab === 'funds' ? 'bg-gradient-to-r from-cyan-600 to-purple-600' : 'bg-gray-800/60'}`}>
            <Wallet className="inline w-5 h-5 mr-2" /> Funds
          </button>
        </div>

        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-8 p-6 rounded-2xl border text-center ${status.type === 'success' ? 'bg-green-900/40 border-green-600' : 'bg-red-900/40 border-red-600'}`}
            >
              <p className="font-medium">{status.message}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'stock' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {PERKS.map((perk, index) => {
              const stock = currentStocks[index] || 0;

              return (
                <motion.div
                  key={perk.tokenId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`rounded-2xl p-8 border-2 bg-gradient-to-br ${rarityStyles[perk.rarity as keyof typeof rarityStyles]} backdrop-blur-sm relative overflow-hidden`}
                >
                  <div className="absolute top-2 right-2 text-xs opacity-70 font-mono">
                    ID: {perk.tokenId}
                  </div>

                  <div className="flex flex-col items-center mb-6">
                    <div className="p-4 rounded-2xl bg-black/40 mb-4">
                      {perk.icon}
                    </div>
                    <h3 className="text-xl font-bold text-center">{perk.name}</h3>
                    <p className="text-sm capitalize mt-1 opacity-80">{perk.rarity}</p>
                  </div>

                  <div className="space-y-3 text-center mb-8">
                    <p className="text-lg font-bold text-pink-300">
                      Stock: {stock}/500
                    </p>
                  </div>

                  <button
                    onClick={() => handleStockShop(perk)}
                    disabled={isLoading}
                    className="w-full py-4 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 font-bold rounded-xl disabled:opacity-50 shadow-lg transition"
                  >
                    {isLoading ? 'Processing...' : 'Mint 500'}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Pricing and Funds tabs remain the same as before */}
        {activeTab === 'pricing' && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-10">Edit TYC & USDC Prices</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {PERKS.map((perk) => (
                <div key={perk.tokenId} className="bg-gray-900/50 rounded-2xl p-6 border border-gray-700/50">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-black/40 rounded-xl">{perk.icon}</div>
                    <div>
                      <h4 className="font-bold">{perk.name}</h4>
                      <p className="text-xs text-gray-400">ID: {perk.tokenId}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPerk(perk)}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold hover:opacity-90 transition"
                  >
                    Set Prices
                  </button>
                </div>
              ))}
            </div>

            {selectedPerk && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPerk(null)}>
                <div className="bg-gray-900 rounded-3xl p-8 max-w-md w-full border border-gray-700" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-2xl font-bold mb-6 text-center">Edit Prices — {selectedPerk.name}</h3>
                  <p className="text-sm text-gray-400 mb-6 text-center">Token ID: {selectedPerk.tokenId}</p>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-emerald-300">TYC Price</label>
                      <input type="number" step="0.01" value={tycPriceInput} onChange={(e) => setTycPriceInput(e.target.value)} placeholder="e.g. 15.00" className="w-full px-6 py-4 bg-gray-800 rounded-xl text-xl focus:outline-none focus:ring-4 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-cyan-300">USDC Price</label>
                      <input type="number" step="0.01" value={usdcPriceInput} onChange={(e) => setUsdcPriceInput(e.target.value)} placeholder="e.g. 0.60" className="w-full px-6 py-4 bg-gray-800 rounded-xl text-xl focus:outline-none focus:ring-4 focus:ring-cyan-500" />
                    </div>
                  </div>

                  <div className="flex gap-4 mt-8">
                    <button onClick={handleSetPrice} disabled={isLoading} className="flex-1 py-4 bg-gradient-to-r from-cyan-600 to-purple-600 rounded-xl font-bold disabled:opacity-50 transition">
                      {isLoading ? 'Updating...' : 'Save Prices'}
                    </button>
                    <button onClick={() => setSelectedPerk(null)} className="px-8 py-4 bg-gray-800 rounded-xl transition">
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {activeTab === 'funds' && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-10">Contract Funds</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-800/10 rounded-3xl p-10 border border-emerald-600/40 text-center">
                <h3 className="text-2xl font-bold mb-4">TYC Balance</h3>
                <p className="text-4xl font-extrabold text-emerald-300">
                  {tycBalance.data ? Number(formatUnits(tycBalance.data as bigint, 18)).toFixed(2) : '0.00'} TYC
                </p>
                <button onClick={() => handleWithdraw('TYC')} disabled={isLoading} className="mt-8 w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition">
                  Withdraw TYC
                </button>
              </div>
              <div className="bg-gradient-to-br from-cyan-900/30 to-cyan-800/10 rounded-3xl p-10 border border-cyan-600/40 text-center">
                <h3 className="text-2xl font-bold mb-4">USDC Balance</h3>
                <p className="text-4xl font-extrabold text-cyan-300">
                  {usdcBalance.data ? Number(formatUnits(usdcBalance.data as bigint, 6)).toFixed(2) : '0.00'} USDC
                </p>
                <button onClick={() => handleWithdraw('USDC')} disabled={isLoading} className="mt-8 w-full py-4 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold transition">
                  Withdraw USDC
                </button>
              </div>
            </div>
          </div>
        )}

        {txHash && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 p-6 bg-green-900/90 rounded-2xl border border-green-600 shadow-2xl">
            <p className="text-xl font-bold text-green-300 text-center">Transaction Sent!</p>
            <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="block mt-3 text-cyan-300 underline">
              View on Explorer
            </a>
          </motion.div>
        )}
      </div>
    </div>
  );
}