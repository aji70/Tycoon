'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Crown, Coins, Sparkles, Gem, Shield, DollarSign, RefreshCw, AlertTriangle 
} from 'lucide-react';
import RewardABI from '@/context/rewardabi.json';
import { REWARD_CONTRACT_ADDRESSES } from '@/constants/contracts';

const FIXED_TOKEN_IDS = {
  EXTRA_TURN: 2000000001,
  JAIL_FREE: 2000000002,
  DOUBLE_RENT: 2000000003,
  ROLL_BOOST: 2000000004,
  CASH_TIER1: 2000000005,
  CASH_TIER2: 2000000011,
  CASH_TIER3: 2000000012,
  CASH_TIER4: 2000000013,
  CASH_TIER5: 2000000014,
  TELEPORT: 2000000006,
  SHIELD: 2000000007,
  PROPERTY_DISCOUNT: 2000000008,
  TAX_REFUND_TIER1: 2000000009,
  TAX_REFUND_TIER3: 2000000015,
  ROLL_EXACT: 2000000010,
};

const PERKS = [
  { tokenId: FIXED_TOKEN_IDS.EXTRA_TURN, perkId: 1, name: "Extra Turn", rarity: "common", strength: 1, tyc: "5", usdc: "0.10" },
  { tokenId: FIXED_TOKEN_IDS.JAIL_FREE, perkId: 2, name: "Get Out of Jail Free", rarity: "rare", strength: 1, tyc: "10", usdc: "0.30" },
  { tokenId: FIXED_TOKEN_IDS.DOUBLE_RENT, perkId: 3, name: "Double Rent", rarity: "medium", strength: 0, tyc: "12", usdc: "0.40" },
  { tokenId: FIXED_TOKEN_IDS.ROLL_BOOST, perkId: 4, name: "Roll Boost", rarity: "medium", strength: 2, tyc: "8", usdc: "0.25" },
  { tokenId: FIXED_TOKEN_IDS.CASH_TIER1, perkId: 5, name: "Instant Cash (Tier 1)", rarity: "tiered", strength: 1, cash: "10 TYC", tyc: "6", usdc: "0.15" },
  { tokenId: FIXED_TOKEN_IDS.CASH_TIER2, perkId: 5, name: "Instant Cash (Tier 2)", rarity: "tiered", strength: 2, cash: "25 TYC", tyc: "12", usdc: "0.30" },
  { tokenId: FIXED_TOKEN_IDS.CASH_TIER3, perkId: 5, name: "Instant Cash (Tier 3)", rarity: "tiered", strength: 3, cash: "50 TYC", tyc: "20", usdc: "0.50" },
  { tokenId: FIXED_TOKEN_IDS.CASH_TIER4, perkId: 5, name: "Instant Cash (Tier 4)", rarity: "tiered", strength: 4, cash: "100 TYC", tyc: "35", usdc: "0.90" },
  { tokenId: FIXED_TOKEN_IDS.CASH_TIER5, perkId: 5, name: "Instant Cash (Tier 5)", rarity: "tiered", strength: 5, cash: "250 TYC", tyc: "70", usdc: "1.80" },
  { tokenId: FIXED_TOKEN_IDS.TELEPORT, perkId: 6, name: "Teleport", rarity: "epic", strength: 0, tyc: "15", usdc: "0.60" },
  { tokenId: FIXED_TOKEN_IDS.SHIELD, perkId: 7, name: "Shield", rarity: "rare", strength: 2, tyc: "12", usdc: "0.50" },
  { tokenId: FIXED_TOKEN_IDS.PROPERTY_DISCOUNT, perkId: 8, name: "Property Discount", rarity: "medium", strength: 40, tyc: "10", usdc: "0.40" },
  { tokenId: FIXED_TOKEN_IDS.TAX_REFUND_TIER1, perkId: 9, name: "Tax Refund (Tier 1)", rarity: "tiered", strength: 1, cash: "10 TYC", tyc: "7", usdc: "0.18" },
  { tokenId: FIXED_TOKEN_IDS.TAX_REFUND_TIER3, perkId: 9, name: "Tax Refund (Tier 3)", rarity: "tiered", strength: 3, cash: "50 TYC", tyc: "22", usdc: "0.55" },
  { tokenId: FIXED_TOKEN_IDS.ROLL_EXACT, perkId: 10, name: "Exact Roll", rarity: "legendary", strength: 0, tyc: "20", usdc: "1.00" },
];

const rarityStyles = {
  common: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/40 text-emerald-300',
  medium: 'from-blue-500/20 to-blue-600/10 border-blue-500/40 text-blue-300',
  rare: 'from-purple-500/20 to-purple-600/10 border-purple-500/40 text-purple-300',
  epic: 'from-pink-500/20 to-pink-600/10 border-pink-500/40 text-pink-300',
  legendary: 'from-yellow-500/20 to-amber-600/10 border-yellow-500/40 text-yellow-300',
  tiered: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/40 text-cyan-300',
};

const perkIcons = {
  1: <Zap className="w-8 h-8" />,
  2: <Crown className="w-8 h-8" />,
  3: <Coins className="w-8 h-8" />,
  4: <Sparkles className="w-8 h-8" />,
  5: <Gem className="w-8 h-8" />,
  6: <Zap className="w-8 h-8" />,
  7: <Shield className="w-8 h-8" />,
  8: <Coins className="w-8 h-8" />,
  9: <Gem className="w-8 h-8" />,
  10: <Sparkles className="w-8 h-8" />,
};

export default function RewardAdminTester() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES];

  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const { writeContract, data: txHash, isPending: isWriting, error: writeError, reset } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });
  const isLoading = isWriting || isConfirming;

  // Read live stock for all fixed tokenIds
  const stockQueries = PERKS.map(perk => ({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'balanceOf' as const,
    args: [contractAddress, perk.tokenId],
  }));

  const stockResults = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'balanceOfBatch',
    args: contractAddress ? [Array(PERKS.length).fill(contractAddress), PERKS.map(p => p.tokenId)] : undefined,
    query: { enabled: !!contractAddress },
  });

  const currentStocks = stockResults.data && Array.isArray(stockResults.data)
  ? stockResults.data.map((s: bigint) => Number(s))
  : PERKS.map(() => 0);

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleMint500 = (perk: typeof PERKS[0]) => {
    if (!contractAddress) return;

    const tycWei = parseUnits(perk.tyc, 18);
    const usdcWei = parseUnits(perk.usdc, 6);

    writeContract({
      address: contractAddress,
      abi: RewardABI,
      functionName: 'stockShop',
      args: [500, BigInt(perk.perkId), BigInt(perk.strength), tycWei, usdcWei],
    });
  };

  useEffect(() => {
    if (txHash && isConfirming === false && isWriting === false) {
      setStatus({ type: 'success', message: 'Successfully minted 500 collectibles!' });
      reset();
    }
    if (writeError) {
      setStatus({ type: 'error', message:  writeError.message || 'Transaction failed' });
      reset();
    }
  }, [txHash, isConfirming, isWriting, writeError, reset]);

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
        No contract on chain {chainId}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1a] via-[#0d141f] to-[#0f1a27] text-white py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-extrabold mb-4 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Tycoon Reward Admin
          </h1>
          <p className="text-xl text-gray-400">Mint 500 of each collectible • Live stock tracking • Fixed token IDs</p>
        </motion.div>

        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-8 p-6 rounded-2xl border text-center ${
                status.type === 'success' ? 'bg-green-900/40 border-green-600' :
                status.type === 'error' ? 'bg-red-900/40 border-red-600' :
                'bg-blue-900/40 border-blue-600'
              }`}
            >
              <p className="font-medium">{status.message}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {PERKS.map((perk, index) => {
            const currentStock = currentStocks[index] || 0;
            const icon = perkIcons[perk.perkId as keyof typeof perkIcons] || <Gem className="w-8 h-8" />;

            return (
                    <motion.div
          key={perk.tokenId.toString()}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className={`rounded-2xl p-8 border-2 bg-gradient-to-br ${
            rarityStyles[perk.rarity as keyof typeof rarityStyles]
          } backdrop-blur-sm relative overflow-hidden`}
        >
                <div className="absolute top-2 right-2 text-xs opacity-70">
                  ID: {perk.tokenId.toString().slice(-10)}
                </div>

                <div className="flex flex-col items-center mb-6">
                  <div className="p-4 rounded-2xl bg-black/40 mb-4">
                    {icon}
                  </div>
                  <h3 className="text-2xl font-bold text-center">{perk.name}</h3>
                  <p className="text-sm capitalize mt-1 opacity-80">{perk.rarity}</p>
                  {perk.cash && <p className="text-cyan-300 text-lg font-bold mt-2">{perk.cash}</p>}
                </div>

                <div className="space-y-3 mb-8 text-center">
                  <p className="text-sm"><span className="opacity-70">TYC Price:</span> <strong>{perk.tyc} TYC</strong></p>
                  <p className="text-sm"><span className="opacity-70">USDC Price:</span> <strong>${perk.usdc}</strong></p>
                  <p className="text-lg font-bold text-cyan-300 mt-4">
                    Stock: {currentStock}/500
                  </p>
                </div>

                <button
                  onClick={() => handleMint500(perk)}
                  disabled={isLoading}
                  className="w-full py-4 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold text-lg rounded-xl transition-all disabled:opacity-50 shadow-lg"
                >
                  {isLoading ? 'Minting...' : 'Mint 500'}
                </button>
              </motion.div>
            );
          })}
        </div>

        {txHash && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 p-6 bg-green-900/90 rounded-2xl border border-green-600 shadow-2xl"
          >
            <p className="text-xl font-bold text-green-300 text-center">Transaction Sent!</p>
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-3 text-cyan-300 underline"
            >
              View on Explorer
            </a>
          </motion.div>
        )}
      </div>
    </div>
  );
}