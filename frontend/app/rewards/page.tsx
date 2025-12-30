'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Crown, Coins, Sparkles, Gem, Shield, DollarSign, Wallet, Package, AlertTriangle, Send, Ticket, ChevronDown, RefreshCw
} from 'lucide-react';
import RewardABI from '@/context/rewardabi.json';
import { REWARD_CONTRACT_ADDRESSES, USDC_TOKEN_ADDRESS, TYC_TOKEN_ADDRESS } from '@/constants/contracts';

const PERKS = [
  { value: 1, label: "Extra Turn", icon: <Zap className="w-6 h-6" />, requiresStrength: false, strength: 0 },
  { value: 2, label: "Get Out of Jail Free", icon: <Crown className="w-6 h-6" />, requiresStrength: false, strength: 0 },
  { value: 3, label: "Double Rent", icon: <Coins className="w-6 h-6" />, requiresStrength: false, strength: 0 },
  { value: 4, label: "Roll Boost", icon: <Sparkles className="w-6 h-6" />, requiresStrength: false, strength: 0 },
  { value: 5, label: "Instant Cash (Tiered)", icon: <Gem className="w-6 h-6" />, requiresStrength: true, strength: 1 }, // default tier
  { value: 6, label: "Teleport", icon: <Zap className="w-6 h-6" />, requiresStrength: false, strength: 0 },
  { value: 7, label: "Shield", icon: <Shield className="w-6 h-6" />, requiresStrength: false, strength: 0 },
  { value: 8, label: "Property Discount", icon: <Coins className="w-6 h-6" />, requiresStrength: false, strength: 0 },
  { value: 9, label: "Tax Refund (Tiered)", icon: <Gem className="w-6 h-6" />, requiresStrength: true, strength: 1 },
  { value: 10, label: "Exact Roll", icon: <Sparkles className="w-6 h-6" />, requiresStrength: false, strength: 0 },
];

const rarityStyles = {
  1: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/40',
  2: 'from-purple-500/20 to-purple-600/10 border-purple-500/40',
  3: 'from-blue-500/20 to-blue-600/10 border-blue-500/40',
  4: 'from-yellow-500/20 to-amber-600/10 border-yellow-500/40',
  5: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/40',
  6: 'from-pink-500/20 to-pink-600/10 border-pink-500/40',
  7: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/40',
  8: 'from-orange-500/20 to-orange-600/10 border-orange-500/40',
  9: 'from-teal-500/20 to-teal-600/10 border-teal-500/40',
  10: 'from-amber-500/20 to-amber-600/10 border-amber-500/40',
};

const ERC20_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

export default function RewardAdminPanel() {
  const { address: adminAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES];
  const usdcAddress = USDC_TOKEN_ADDRESS[chainId as keyof typeof USDC_TOKEN_ADDRESS];
  const tycAddress = TYC_TOKEN_ADDRESS[chainId as keyof typeof TYC_TOKEN_ADDRESS];

  const [activeTab, setActiveTab] = useState<'stock' | 'pricing' | 'funds' | 'mint'>('stock');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [selectedPerk, setSelectedPerk] = useState<typeof PERKS[0] | null>(null);
  const [tycPriceInput, setTycPriceInput] = useState('');
  const [usdcPriceInput, setUsdcPriceInput] = useState('');

  // Mint states
  const [mintType, setMintType] = useState<'collectible' | 'voucher'>('collectible');
  const [selectedMintPerk, setSelectedMintPerk] = useState<number | null>(null);
  const [mintStrength, setMintStrength] = useState('1');
  const [voucherTycValue, setVoucherTycValue] = useState('100');
  const [mintRecipient, setMintRecipient] = useState('');

  const { writeContract, data: txHash, isPending: isWriting, error: writeError, reset } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });
  const isLoading = isWriting || isConfirming;

  // Token IDs
  const tokenIds = Array.from({ length: 10 }, (_, i) => BigInt(2000000000 + i + 1));

  const stockResults = useReadContract({
    address: contractAddress ?? undefined,
    abi: RewardABI,
    functionName: 'balanceOfBatch',
    args: contractAddress ? [Array(10).fill(contractAddress), tokenIds] : undefined,
    query: { enabled: !!contractAddress },
  });

  const currentStocks: number[] = Array.isArray(stockResults.data)
    ? (stockResults.data as bigint[]).map(Number)
    : Array(10).fill(0);

  const tycBalance = useReadContract({
    address: tycAddress ?? undefined,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: contractAddress ? [contractAddress] : undefined,
    query: { enabled: !!contractAddress && !!tycAddress },
  });

  const usdcBalance = useReadContract({
    address: usdcAddress ?? undefined,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: contractAddress ? [contractAddress] : undefined,
    query: { enabled: !!contractAddress && !!usdcAddress },
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

  // NEW: Stock all collectibles to 500 each
  const handleStockAllTo500 = () => {
    if (!contractAddress) return;

    setStatus({ type: 'info', message: 'Stocking all collectibles to 500... This may take 10 transactions.' });

    PERKS.forEach((perk) => {
      writeContract({
        address: contractAddress,
        abi: RewardABI,
        functionName: 'stockShop',
        args: [
          BigInt(500),
          BigInt(perk.value),
          BigInt(perk.strength),
          0, // tycPrice - set to 0 or your default
          0, // usdcPrice - set to 0 or your default
        ],
      });
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

    const tokenId = BigInt(2000000000 + selectedPerk.value);

    writeContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'setCollectiblePrice',
      args: [tokenId, 0, tycWei, usdcWei],
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

  const handleMint = () => {
    if (!contractAddress || !mintRecipient) {
      setStatus({ type: 'error', message: 'Recipient address is required' });
      return;
    }

    if (mintType === 'collectible') {
      if (!selectedMintPerk) {
        setStatus({ type: 'error', message: 'Please select a perk' });
        return;
      }

      const strength = PERKS.find(p => p.value === selectedMintPerk)?.requiresStrength ? BigInt(parseInt(mintStrength) || 1) : 0;

      writeContract({
        address: contractAddress,
        abi: RewardABI,
        functionName: 'mintCollectible',
        args: [mintRecipient, BigInt(selectedMintPerk), strength],
      });
    } else {
      const value = parseUnits(voucherTycValue, 18);
      if (value === BigInt(0)) {
        setStatus({ type: 'error', message: 'TYC value must be > 0' });
        return;
      }

      writeContract({
        address: contractAddress,
        abi: RewardABI,
        functionName: 'mintVoucher',
        args: [mintRecipient, value],
      });
    }
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
          <p className="text-xl text-gray-400">Full backend control • Mint perks & vouchers • Manage prices</p>
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
          <button onClick={() => setActiveTab('mint')} className={`px-8 py-3 rounded-xl font-semibold transition-all ${activeTab === 'mint' ? 'bg-gradient-to-r from-pink-600 to-orange-600' : 'bg-gray-800/60'}`}>
            <Send className="inline w-5 h-5 mr-2" /> Mint
          </button>
        </div>

        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-8 p-6 rounded-2xl border text-center ${status.type === 'success' ? 'bg-green-900/40 border-green-600' : status.type === 'info' ? 'bg-blue-900/40 border-blue-600' : 'bg-red-900/40 border-red-600'}`}
            >
              <p className="font-medium">{status.message}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stock Tab - Now with "Stock All to 500" button */}
        {activeTab === 'stock' && (
          <div className="space-y-10">
            <div className="text-center">
              <button
                onClick={handleStockAllTo500}
                disabled={isLoading}
                className="px-10 py-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-bold text-xl rounded-2xl shadow-xl flex items-center gap-4 mx-auto transition disabled:opacity-50"
              >
                <RefreshCw className={`w-8 h-8 ${isLoading ? 'animate-spin' : ''}`} />
                Stock All Collectibles to 500
              </button>
              <p className="text-gray-400 mt-3 text-sm">This will send 10 transactions (one per perk)</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {PERKS.map((perk, index) => {
                const stock = currentStocks[index] || 0;
                const isLow = stock < 100;
                const isSoldOut = stock === 0;

                return (
                  <div key={perk.value} className={`rounded-2xl p-6 border-2 bg-gradient-to-br ${rarityStyles[perk.value as keyof typeof rarityStyles]} backdrop-blur-sm text-center relative overflow-hidden`}>
                    <div className="flex justify-center mb-4">{perk.icon}</div>
                    <h3 className="font-bold text-lg mb-3">{perk.label}</h3>
                    <p className={`text-2xl font-bold ${isSoldOut ? 'text-red-400' : isLow ? 'text-orange-400' : 'text-emerald-300'}`}>
                      {stock}/500
                    </p>
                    {isSoldOut && <div className="absolute inset-0 bg-red-900/30 flex items-center justify-center pointer-events-none"><span className="text-3xl font-bold">SOLD OUT</span></div>}
                    {isLow && !isSoldOut && <p className="text-xs text-orange-300 mt-2">Low Stock!</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pricing, Funds, Mint tabs remain exactly as before */}
        {activeTab === 'pricing' && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-10">Edit Prices</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {PERKS.map((perk) => (
                <div key={perk.value} className="bg-gray-900/50 rounded-2xl p-6 border border-gray-700/50">
                  <div className="flex items-center gap-4 mb-4">
                    {perk.icon}
                    <h4 className="font-bold text-xl">{perk.label}</h4>
                  </div>
                  <button
                    onClick={() => setSelectedPerk(perk)}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold hover:opacity-90 transition"
                  >
                    Edit Price
                  </button>
                </div>
              ))}
            </div>

            {selectedPerk && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPerk(null)}>
                <div className="bg-gray-900 rounded-3xl p-8 max-w-md w-full border border-gray-700" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-2xl font-bold mb-6 text-center">Set Price — {selectedPerk.label}</h3>
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
                      {isLoading ? 'Updating...' : 'Save'}
                    </button>
                    <button onClick={() => setSelectedPerk(null)} className="px-8 py-4 bg-gray-800 rounded-xl transition">Cancel</button>
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

        {activeTab === 'mint' && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-10 bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent">
              Mint Collectibles or Vouchers
            </h2>

            <div className="bg-gray-900/60 rounded-3xl p-10 border border-gray-700">
              <div className="flex justify-center gap-8 mb-10">
                <button
                  onClick={() => setMintType('collectible')}
                  className={`px-8 py-4 rounded-xl font-bold transition ${mintType === 'collectible' ? 'bg-gradient-to-r from-purple-600 to-pink-600' : 'bg-gray-800'}`}
                >
                  <Gem className="inline w-6 h-6 mr-2" /> Collectible
                </button>
                <button
                  onClick={() => setMintType('voucher')}
                  className={`px-8 py-4 rounded-xl font-bold transition ${mintType === 'voucher' ? 'bg-gradient-to-r from-teal-600 to-cyan-600' : 'bg-gray-800'}`}
                >
                  <Ticket className="inline w-6 h-6 mr-2" /> Voucher
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-lg font-medium mb-2 text-cyan-300">Recipient Address</label>
                  <input
                    type="text"
                    value={mintRecipient}
                    onChange={(e) => setMintRecipient(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-6 py-4 bg-gray-800 rounded-xl text-lg focus:outline-none focus:ring-4 focus:ring-cyan-500"
                  />
                </div>

                {mintType === 'collectible' ? (
                  <>
                    <div>
                      <label className="block text-lg font-medium mb-2 text-purple-300">Select Perk</label>
                      <div className="relative">
                        <select
                          value={selectedMintPerk || ''}
                          onChange={(e) => setSelectedMintPerk(Number(e.target.value))}
                          className="w-full px-6 py-4 bg-gray-800 rounded-xl text-lg appearance-none focus:outline-none focus:ring-4 focus:ring-purple-500 cursor-pointer"
                        >
                          <option value="">Choose a perk...</option>
                          {PERKS.map((perk) => (
                            <option key={perk.value} value={perk.value}>
                              {perk.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    {selectedMintPerk && PERKS.find(p => p.value === selectedMintPerk)?.requiresStrength && (
                      <div>
                        <label className="block text-lg font-medium mb-2 text-pink-300">Strength (Tier)</label>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={mintStrength}
                          onChange={(e) => setMintStrength(e.target.value)}
                          className="w-full px-6 py-4 bg-gray-800 rounded-xl text-lg focus:outline-none focus:ring-4 focus:ring-pink-500"
                        />
                        <p className="text-sm text-gray-400 mt-2">For tiered perks (Cash, Tax Refund)</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div>
                    <label className="block text-lg font-medium mb-2 text-teal-300">Voucher TYC Value</label>
                    <input
                      type="number"
                      min="1"
                      step="10"
                      value={voucherTycValue}
                      onChange={(e) => setVoucherTycValue(e.target.value)}
                      placeholder="e.g. 100"
                      className="w-full px-6 py-4 bg-gray-800 rounded-xl text-lg focus:outline-none focus:ring-4 focus:ring-teal-500"
                    />
                  </div>
                )}

                <button
                  onClick={handleMint}
                  disabled={isLoading}
                  className="w-full py-6 bg-gradient-to-r from-pink-600 to-orange-600 hover:from-pink-500 hover:to-orange-500 font-bold text-xl rounded-2xl shadow-xl transition disabled:opacity-50"
                >
                  {isLoading ? 'Minting...' : `Mint ${mintType === 'collectible' ? 'Collectible' : 'Voucher'}`}
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