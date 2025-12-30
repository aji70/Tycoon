'use client';

import React, { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import RewardABI from '@/context/rewardabi.json';
import { REWARD_CONTRACT_ADDRESSES } from '@/constants/contracts';
import { ArrowLeft, Crown, Zap, Shield, Sparkles, Gem, Coins, ShoppingBag } from 'lucide-react';

export default function RewardAdminTester() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId];

  // Global states
  const [activeTab, setActiveTab] = useState<'voucher' | 'direct' | 'stock' | 'restock' | 'prices'>('stock');

  // Voucher
  const [voucherRecipient, setVoucherRecipient] = useState<string>('');
  const [voucherTycAmount, setVoucherTycAmount] = useState<string>('50');

  // Direct Mint (non-shop)
  const [directRecipient, setDirectRecipient] = useState<string>('');
  const [directPerk, setDirectPerk] = useState<number>(1);
  const [directStrength, setDirectStrength] = useState<string>('1');

  // Stock Shop (Bulk + Recommended Prices /5)
  const [bulkStockAmount, setBulkStockAmount] = useState<string>('100');

  // Restock
  const [restockTokenId, setRestockTokenId] = useState<string>('');
  const [restockAmount, setRestockAmount] = useState<string>('100');

  // Update Prices
  const [updateTokenId, setUpdateTokenId] = useState<string>('');
  const [updateTycPrice, setUpdateTycPrice] = useState<string>('');
  const [updateUsdcPrice, setUpdateUsdcPrice] = useState<string>('');

  const { writeContract, data: txHash, isPending: writing, error: writeError, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess: confirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const isLoading = writing || confirming;

  const explorerBase =
    chainId === 42220
      ? 'explorer.celo.org'
      : chainId === 11155111
      ? 'sepolia.etherscan.io'
      : 'etherscan.io';

  // Updated perk list with icons and balanced prices divided by ~5
  const perks = [
    { id: 1, name: 'EXTRA_TURN', icon: <Zap className="w-5 h-5" />, rarity: 'common', tyc: '5', usdc: '0.10' },
    { id: 2, name: 'JAIL_FREE', icon: <Shield className="w-5 h-5" />, rarity: 'rare', tyc: '10', usdc: '0.30' },
    { id: 3, name: 'DOUBLE_RENT', icon: <Coins className="w-5 h-5" />, rarity: 'medium', tyc: '12', usdc: '0.40' },
    { id: 4, name: 'ROLL_BOOST', icon: <Sparkles className="w-5 h-5" />, rarity: 'medium', tyc: '8', usdc: '0.25' },
    { id: 5, name: 'CASH_TIERED', icon: <Gem className="w-5 h-5" />, rarity: 'tiered', tyc: 'varies', usdc: 'varies' },
    { id: 6, name: 'TELEPORT', icon: <Crown className="w-5 h-5" />, rarity: 'epic', tyc: '15', usdc: '0.60' },
    { id: 7, name: 'SHIELD', icon: <Shield className="w-5 h-5" />, rarity: 'rare', tyc: '12', usdc: '0.50' },
    { id: 8, name: 'PROPERTY_DISCOUNT', icon: <Coins className="w-5 h-5" />, rarity: 'medium', tyc: '10', usdc: '0.40' },
    { id: 9, name: 'TAX_REFUND', icon: <Gem className="w-5 h-5" />, rarity: 'tiered', tyc: 'varies', usdc: 'varies' },
    { id: 10, name: 'ROLL_EXACT', icon: <Crown className="w-5 h-5" />, rarity: 'legendary', tyc: '20', usdc: '1.00' },
  ];

  const rarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'text-green-400 border-green-400/30';
      case 'medium': return 'text-blue-400 border-blue-400/30';
      case 'rare': return 'text-purple-400 border-purple-400/30';
      case 'epic': return 'text-pink-400 border-pink-400/30';
      case 'legendary': return 'text-yellow-400 border-yellow-400/30';
      case 'tiered': return 'text-cyan-400 border-cyan-400/30';
      default: return 'text-gray-400 border-gray-400/30';
    }
  };

  // Handlers
  const handleMintVoucher = () => {
    if (!voucherRecipient || !voucherTycAmount) return alert('Fill all fields');
    const amountWei = parseUnits(voucherTycAmount, 18);
    writeContract({
      address: contractAddress!,
      abi: RewardABI,
      functionName: 'mintVoucher',
      args: [voucherRecipient as `0x${string}`, amountWei],
    });
  };

  const handleDirectMint = () => {
    if (!directRecipient) return alert('Enter recipient');
    writeContract({
      address: contractAddress!,
      abi: RewardABI,
      functionName: 'mintCollectible',
      args: [directRecipient as `0x${string}`, directPerk, BigInt(directStrength)],
    });
  };

  const handleStockPerk = (perkId: number, tycPrice: string, usdcPrice: string) => {
    const amount = BigInt(bulkStockAmount || 100);
    const tycWei = tycPrice ? parseUnits(tycPrice, 18) : 0;
    const usdcWei = usdcPrice ? parseUnits(usdcPrice, 6) : 0;

    writeContract({
      address: contractAddress!,
      abi: RewardABI,
      functionName: 'stockShop',
      args: [amount, perkId, 1, tycWei, usdcWei], // strength 1 by default unless tiered
    });
  };

  const handleBulkStockAll = () => {
    if (!confirm('Stock 100 of EVERY perk with recommended prices? This will send multiple transactions.')) return;
    perks.forEach(perk => {
      if (perk.tyc !== 'varies') {
        handleStockPerk(perk.id, perk.tyc, perk.usdc);
      }
    });
  };

  const handleRestock = () => {
    if (!restockTokenId || !restockAmount) return alert('Fill token ID and amount');
    writeContract({
      address: contractAddress!,
      abi: RewardABI,
      functionName: 'restockCollectible',
      args: [BigInt(restockTokenId), BigInt(restockAmount)],
    });
  };

  const handleUpdatePrices = () => {
    if (!updateTokenId) return alert('Enter token ID');
    const tycWei = updateTycPrice ? parseUnits(updateTycPrice, 18) : 0;
    const usdcWei = updateUsdcPrice ? parseUnits(updateUsdcPrice, 6) : 0;
    writeContract({
      address: contractAddress!,
      abi: RewardABI,
      functionName: 'updateCollectiblePrices',
      args: [BigInt(updateTokenId), tycWei, usdcWei],
    });
  };

  const resetAll = () => {
    setVoucherRecipient('');
    setVoucherTycAmount('50');
    setDirectRecipient('');
    setDirectPerk(1);
    setDirectStrength('1');
    setBulkStockAmount('100');
    setRestockTokenId('');
    setRestockAmount('100');
    setUpdateTokenId('');
    setUpdateTycPrice('');
    setUpdateUsdcPrice('');
    reset();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#010F10] via-[#0a1214] to-[#0e1a1f] text-white">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-[#00F0FF] to-[#FF00FF] bg-clip-text text-transparent">
            Tycoon Reward Admin Dashboard
          </h1>
          <p className="text-xl text-[#A0D8EF]">Luxury control panel • Easy bulk minting • Prices ÷5 for healthy economy</p>
        </div>

        {!isConnected ? (
          <div className="text-center py-20">
            <div className="bg-gradient-to-r from-red-900/50 to-red-800/50 rounded-3xl p-12 border border-red-600/50">
              <p className="text-3xl">Please connect your wallet to access admin tools</p>
            </div>
          </div>
        ) : !contractAddress ? (
          <div className="text-center py-20 text-red-400 text-2xl">Contract not deployed on chain {chainId}</div>
        ) : (
          <>
            {/* Wallet Info */}
            <div className="bg-gradient-to-r from-[#003B3E]/50 to-[#00F0FF]/10 rounded-2xl p-6 mb-10 border border-[#00F0FF]/30">
              <p className="text-sm text-[#A0D8EF]">Connected: <span className="font-mono text-[#00F0FF]">{address}</span></p>
              <p className="text-sm text-green-400 mt-2">✓ Reward Contract Ready: {contractAddress}</p>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap justify-center gap-4 mb-12">
              {(['stock', 'direct', 'voucher', 'restock', 'prices'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-8 py-4 rounded-xl font-bold text-lg transition-all ${
                    activeTab === tab
                      ? 'bg-gradient-to-r from-[#00F0FF] to-[#FF00FF] text-black shadow-lg shadow-[#00F0FF]/50'
                      : 'bg-gray-800/50 hover:bg-gray-700'
                  }`}
                >
                  {tab === 'stock' && '🛒 Bulk Stock Shop'}
                  {tab === 'direct' && '🎁 Direct Mint'}
                  {tab === 'voucher' && '🎟️ Mint Voucher'}
                  {tab === 'restock' && '📦 Restock'}
                  {tab === 'prices' && '💰 Update Prices'}
                </button>
              ))}
            </div>

            {/* Bulk Stock Shop - Main Feature */}
            {activeTab === 'stock' && (
              <div className="space-y-8">
                <div className="text-center mb-10">
                  <h2 className="text-4xl font-bold mb-4">Bulk Stock All Perks (100 each)</h2>
                  <p className="text-xl text-[#A0D8EF]">Recommended balanced prices (original ÷ ~5)</p>
                  <div className="mt-6">
                    <label className="text-lg mr-4">Amount per perk:</label>
                    <input
                      type="number"
                      value={bulkStockAmount}
                      onChange={(e) => setBulkStockAmount(e.target.value)}
                      className="w-32 px-4 py-2 bg-gray-800 rounded-lg text-center text-2xl font-bold"
                      min="1"
                    />
                  </div>
                  <button
                    onClick={handleBulkStockAll}
                    disabled={isLoading}
                    className="mt-8 px-12 py-6 bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-2xl font-bold rounded-2xl shadow-2xl hover:scale-105 transition-all disabled:opacity-50"
                  >
                    {isLoading ? 'Stocking All...' : '🚀 STOCK 100 OF EVERYTHING NOW'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {perks.map((perk) => (
                    <div
                      key={perk.id}
                      className={`relative rounded-2xl p-8 border-2 ${rarityColor(perk.rarity)} bg-gradient-to-br from-gray-900/80 to-black/50 backdrop-blur`}
                    >
                      <div className="flex items-center gap-4 mb-6">
                        <div className={`p-4 rounded-xl ${rarityColor(perk.rarity)} bg-black/50`}>
                          {perk.icon}
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold">{perk.name.replace(/_/g, ' ')}</h3>
                          <p className="text-sm capitalize opacity-80">{perk.rarity}</p>
                        </div>
                      </div>

                      <div className="space-y-3 mb-8">
                        <div className="flex justify-between">
                          <span>TYC Price</span>
                          <span className="font-bold text-orange-400">{perk.tyc === 'varies' ? 'Tiered' : `${perk.tyc} TYC`}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>USDC Price</span>
                          <span className="font-bold text-green-400">{perk.usdc === 'varies' ? 'Tiered' : `$${perk.usdc}`}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleStockPerk(perk.id, perk.tyc, perk.usdc)}
                        disabled={isLoading}
                        className="w-full py-4 bg-gradient-to-r from-[#00F0FF] to-[#FF00FF] text-black font-bold rounded-xl hover:scale-105 transition-all disabled:opacity-60"
                      >
                        Stock {bulkStockAmount} Now
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Other Tabs - Simplified */}
            {activeTab === 'direct' && (
              <div className="max-w-2xl mx-auto bg-gradient-to-br from-blue-900/50 to-purple-900/50 rounded-3xl p-10 border border-[#00F0FF]/30">
                <h2 className="text-4xl font-bold text-center mb-8">Mint Direct Reward</h2>
                <input placeholder="Recipient 0x..." value={directRecipient} onChange={(e) => setDirectRecipient(e.target.value)} className="w-full mb-6 px-6 py-4 bg-gray-800 rounded-xl" />
                <select value={directPerk} onChange={(e) => setDirectPerk(Number(e.target.value))} className="w-full mb-6 px-6 py-4 bg-gray-800 rounded-xl">
                  {perks.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input placeholder="Strength/Tier" value={directStrength} onChange={(e) => setDirectStrength(e.target.value)} className="w-full mb-8 px-6 py-4 bg-gray-800 rounded-xl" />
                <button onClick={handleDirectMint} disabled={isLoading} className="w-full py-6 bg-gradient-to-r from-cyan-500 to-blue-500 font-bold text-2xl rounded-2xl hover:scale-105 transition-all">
                  {isLoading ? 'Minting...' : 'Mint Direct Collectible'}
                </button>
              </div>
            )}

            {activeTab === 'voucher' && (
              <div className="max-w-2xl mx-auto bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-3xl p-10 border border-pink-500/30">
                <h2 className="text-4xl font-bold text-center mb-8">Mint TYC Voucher</h2>
                <input placeholder="Recipient" value={voucherRecipient} onChange={(e) => setVoucherRecipient(e.target.value)} className="w-full mb-6 px-6 py-4 bg-gray-800 rounded-xl" />
                <input placeholder="TYC Amount" value={voucherTycAmount} onChange={(e) => setVoucherTycAmount(e.target.value)} className="w-full mb-8 px-6 py-4 bg-gray-800 rounded-xl" />
                <button onClick={handleMintVoucher} disabled={isLoading} className="w-full py-6 bg-gradient-to-r from-purple-500 to-pink-500 font-bold text-2xl rounded-2xl hover:scale-105 transition-all">
                  {isLoading ? 'Minting...' : 'Mint Voucher'}
                </button>
              </div>
            )}

            {activeTab === 'restock' && (
              <div className="max-w-2xl mx-auto bg-gradient-to-br from-orange-900/50 to-red-900/50 rounded-3xl p-10 border border-orange-500/30">
                <h2 className="text-4xl font-bold text-center mb-8">Restock Existing Item</h2>
                <input placeholder="Token ID (e.g. 2000000001)" value={restockTokenId} onChange={(e) => setRestockTokenId(e.target.value)} className="w-full mb-6 px-6 py-4 bg-gray-800 rounded-xl" />
                <input placeholder="Amount" value={restockAmount} onChange={(e) => setRestockAmount(e.target.value)} className="w-full mb-8 px-6 py-4 bg-gray-800 rounded-xl" />
                <button onClick={handleRestock} disabled={isLoading} className="w-full py-6 bg-gradient-to-r from-orange-500 to-red-500 font-bold text-2xl rounded-2xl hover:scale-105 transition-all">
                  {isLoading ? 'Restocking...' : 'Restock Item'}
                </button>
              </div>
            )}

            {activeTab === 'prices' && (
              <div className="max-w-2xl mx-auto bg-gradient-to-br from-teal-900/50 to-cyan-900/50 rounded-3xl p-10 border border-cyan-500/30">
                <h2 className="text-4xl font-bold text-center mb-8">Update Prices</h2>
                <input placeholder="Token ID" value={updateTokenId} onChange={(e) => setUpdateTokenId(e.target.value)} className="w-full mb-6 px-6 py-4 bg-gray-800 rounded-xl" />
                <input placeholder="New TYC Price (0 to disable)" value={updateTycPrice} onChange={(e) => setUpdateTycPrice(e.target.value)} className="w-full mb-6 px-6 py-4 bg-gray-800 rounded-xl" />
                <input placeholder="New USDC Price (0 to disable)" value={updateUsdcPrice} onChange={(e) => setUpdateUsdcPrice(e.target.value)} className="w-full mb-8 px-6 py-4 bg-gray-800 rounded-xl" />
                <button onClick={handleUpdatePrices} disabled={isLoading} className="w-full py-6 bg-gradient-to-r from-teal-500 to-cyan-500 font-bold text-2xl rounded-2xl hover:scale-105 transition-all">
                  {isLoading ? 'Updating...' : 'Update Prices'}
                </button>
              </div>
            )}

            {/* Transaction Feedback */}
            {writeError && (
              <div className="mt-12 bg-red-900/80 rounded-2xl p-8 border border-red-600">
                <strong className="text-2xl">Error:</strong>
                <p className="mt-4 text-lg break-all">{writeError.message}</p>
              </div>
            )}

            {confirmed && txHash && (
              <div className="mt-12 bg-gradient-to-r from-green-900 to-emerald-900 rounded-3xl p-10 text-center border border-green-500">
                <h3 className="text-4xl font-bold mb-6">Transaction Confirmed! 🎉</h3>
                <a
                  href={`https://${explorerBase}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-10 py-5 bg-green-600 hover:bg-green-500 rounded-2xl text-2xl font-bold"
                >
                  View on Explorer
                </a>
                <button
                  onClick={resetAll}
                  className="ml-6 px-10 py-5 bg-gray-700 hover:bg-gray-600 rounded-2xl text-xl font-bold"
                >
                  Reset All Forms
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}