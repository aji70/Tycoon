'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import Image from 'next/image';
import { 
  ShoppingBag, Coins, AlertTriangle, Zap, Crown, Sparkles, Gem, Shield,
  Ticket, Wallet, Loader2, CheckCircle2
} from 'lucide-react';

import { 
  useRewardCollectibleInfo,
  useRewardTokenBalance,
  useRewardBuyCollectible,
  useRewardRedeemVoucher,
  isVoucherToken,
  isCollectibleToken
} from '@/context/ContractProvider'; // Your custom hooks file

import { REWARD_CONTRACT_ADDRESSES } from '@/constants/contracts';

const COLLECTIBLE_START = 2000000000;
const VOUCHER_START = 1000000000;

const perkMapping = [
  { perkId: 1, name: "Extra Turn", desc: "Get one extra turn on your next roll!", image: "/game/shop/a.jpeg", icon: Zap },
  { perkId: 2, name: "Get Out of Jail Free", desc: "Instant jail escape – priceless freedom!", image: "/game/shop/b.jpeg", icon: Crown },
  { perkId: 3, name: "Double Rent", desc: "Next rent collected is doubled!", image: "/game/shop/c.jpeg", icon: Coins },
  { perkId: 4, name: "Roll Boost", desc: "Add +2 to your next dice roll", image: "/game/shop/a.jpeg", icon: Sparkles },
  { perkId: 5, name: "Instant Cash (Tiered)", desc: "Burn for instant TYC: 10–250", image: "/game/shop/b.jpeg", icon: Gem },
  { perkId: 6, name: "Teleport", desc: "Move to any property instantly", image: "/game/shop/c.jpeg", icon: Zap },
  { perkId: 7, name: "Shield", desc: "Block rent & taxes for 2 turns", image: "/game/shop/a.jpeg", icon: Shield },
  { perkId: 8, name: "Property Discount", desc: "40% off next property purchase", image: "/game/shop/b.jpeg", icon: Coins },
  { perkId: 9, name: "Tax Refund (Tiered)", desc: "Burn for instant refund: 10–50 TYC", image: "/game/shop/c.jpeg", icon: Gem },
  { perkId: 10, name: "Exact Roll", desc: "Choose any roll (2-12) once", image: "/game/shop/a.jpeg", icon: Sparkles },
];

export default function GameShop() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES];

  const [useUsdc, setUseUsdc] = useState(false);
  const [activeTab, setActiveTab] = useState<'shop' | 'vouchers'>('shop');

  // Fetch all collectible info + stock
  const collectibles = perkMapping.map((perk, index) => {
    const tokenId = BigInt(COLLECTIBLE_START) + BigInt(perk.perkId);
    const info = useRewardCollectibleInfo(tokenId);
    const balance = useRewardTokenBalance(address, tokenId);

    return {
      ...perk,
      tokenId,
      info: info.data,
      loading: info.isLoading,
      stock: info.data?.shopStock ? Number(info.data.shopStock) : 0,
      tycPrice: info.data ? Number(info.data.tycPrice) / 1e18 : 0,
      usdcPrice: info.data ? Number(info.data.usdcPrice) / 1e6 : 0,
      owned: balance.balance ? Number(balance.balance) : 0,
    };
  });

  // Fetch user's vouchers (simple scan of common voucher IDs or assume known)
  // For demo: assume voucher IDs are 1000000001 to 1000000010
  const voucherIds = Array.from({ length: 10 }, (_, i) => BigInt(VOUCHER_START) + BigInt(i + 1));
  const vouchers = voucherIds.map(id => {
    const balance = useRewardTokenBalance(address, id);
    return { tokenId: id, amount: balance.balance ? Number(balance.balance) : 0 };
  }).filter(v => v.amount > 0);

  const { buy, isPending: buying } = useRewardBuyCollectible();
  const { redeem, isPending: redeeming } = useRewardRedeemVoucher();

  const handleBuy = async (tokenId: bigint) => {
    if (!isConnected) return toast.error("Connect wallet first!");

    const item = collectibles.find(c => c.tokenId === tokenId);
    if (!item?.info) return;

    const price = useUsdc ? item.info.usdcPrice : item.info.tycPrice;
    if (price === BigInt(0)) {
      return toast.error(`This perk is not available in ${useUsdc ? 'USDC' : 'TYC'}`);
    }

    toast.promise(
      buy(tokenId, useUsdc),
      {
        pending: `Purchasing ${item.name}...`,
        success: `${item.name} purchased! 🎉`,
        error: 'Purchase failed',
      }
    );
  };

  const handleRedeem = async (tokenId: bigint) => {
    toast.promise(
      redeem(tokenId),
      {
        pending: 'Redeeming voucher...',
        success: 'Voucher redeemed! TYC added 🎉',
        error: 'Redeem failed',
      }
    );
  };

  if (!contractAddress) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] flex items-center justify-center text-rose-400 text-2xl">
        Shop not available on this network (Chain ID: {chainId})
      </div>
    );
  }

  return (
    <section className="min-h-screen bg-gradient-to-b from-[#010F10] via-[#0a1a1b] to-[#0E1415] text-[#F0F7F7] py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-6xl font-bold uppercase tracking-wider flex items-center justify-center gap-4 mb-4">
            <ShoppingBag className="w-16 h-16 text-[#00F0FF]" />
            <span className="bg-gradient-to-r from-[#00F0FF] to-[#FF00E5] bg-clip-text text-transparent">
              Tycoon Perk Shop
            </span>
          </h1>
          <p className="text-xl text-[#80DEEA]">Power-ups to dominate the board • Pay with TYC or USDC</p>
        </motion.div>

        {/* Tabs */}
        <div className="flex justify-center gap-6 mb-12">
          <button
            onClick={() => setActiveTab('shop')}
            className={`px-8 py-4 rounded-xl font-bold text-lg transition-all ${
              activeTab === 'shop'
                ? 'bg-gradient-to-r from-[#00F0FF] to-[#FF00E5] text-black shadow-lg shadow-cyan-500/50'
                : 'bg-[#003B3E]/50 border border-[#00F0FF]/30 hover:bg-[#003B3E]/80'
            }`}
          >
            <Coins className="inline w-6 h-6 mr-2" />
            Buy Perks
          </button>
          <button
            onClick={() => setActiveTab('vouchers')}
            className={`px-8 py-4 rounded-xl font-bold text-lg transition-all relative ${
              activeTab === 'vouchers'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50'
                : 'bg-[#003B3E]/50 border border-purple-500/30 hover:bg-[#003B3E]/80'
            }`}
          >
            <Ticket className="inline w-6 h-6 mr-2" />
            Redeem Vouchers
            {vouchers.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                {vouchers.reduce((sum, v) => sum + v.amount, 0)}
              </span>
            )}
          </button>
        </div>

        {/* Payment Toggle */}
        {activeTab === 'shop' && (
          <div className="flex justify-center mb-10">
            <button
              onClick={() => setUseUsdc(!useUsdc)}
              className="px-10 py-4 bg-[#002D30] rounded-2xl border-2 border-[#00F0FF] flex items-center gap-4 hover:bg-[#00F0FF]/10 transition text-xl font-semibold"
            >
              <Wallet className="w-8 h-8" />
              Pay with {useUsdc ? "USDC 💵" : "TYC 🪙"}
            </button>
          </div>
        )}

        {/* Shop Tab */}
        <AnimatePresence mode="wait">
          {activeTab === 'shop' && (
            <motion.div
              key="shop"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10"
            >
              {collectibles.map((item) => {
                const Icon = item.icon;
                const price = useUsdc ? item.usdcPrice.toFixed(2) : item.tycPrice.toFixed(2);
                const currency = useUsdc ? 'USDC' : 'TYC';
                const canBuy = useUsdc ? item.usdcPrice > 0 : item.tycPrice > 0;

                return (
                  <motion.div
                    key={item.perkId}
                    whileHover={{ scale: 1.05 }}
                    className="relative bg-gradient-to-br from-[#0a1f20] via-[#0E1415] to-[#00171a] rounded-3xl overflow-hidden border-2 border-[#003B3E] hover:border-[#00F0FF] transition-all duration-500 shadow-2xl"
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={400}
                      height={400}
                      className="w-full h-64 object-cover"
                    />

                    <div className="relative p-8">
                      <div className="flex justify-center -mt-16 mb-6">
                        <div className="p-6 bg-black/70 rounded-full border-4 border-[#00F0FF] shadow-xl">
                          <Icon className="w-16 h-16 text-[#00F0FF]" />
                        </div>
                      </div>

                      <h3 className="text-3xl font-bold text-center mb-3 bg-gradient-to-r from-[#00F0FF] to-[#FF00E5] bg-clip-text text-transparent">
                        {item.name}
                      </h3>
                      <p className="text-[#80DEEA] text-center mb-6 leading-relaxed">{item.desc}</p>

                      <div className="text-center mb-6">
                        <div className="text-4xl font-bold text-[#00F0FF] mb-2">
                          {price} {currency}
                        </div>
                        {item.stock < 50 && (
                          <p className="text-orange-400 font-semibold">
                            {item.stock === 0 ? 'SOLD OUT' : `Only ${item.stock} left!`}
                          </p>
                        )}
                        {item.owned > 0 && (
                          <p className="text-green-400 mt-2">
                            <CheckCircle2 className="inline w-5 h-5 mr-1" />
                            You own {item.owned}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => handleBuy(item.tokenId)}
                        disabled={buying || item.stock === 0 || !canBuy}
                        className="w-full py-5 bg-gradient-to-r from-[#00F0FF] to-[#FF00E5] text-black font-bold text-xl rounded-2xl flex items-center justify-center gap-3 hover:shadow-lg hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        {buying ? (
                          <Loader2 className="w-8 h-8 animate-spin" />
                        ) : (
                          <>
                            <ShoppingBag className="w-8 h-8" />
                            Buy Now
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* Vouchers Tab */}
          {activeTab === 'vouchers' && (
            <motion.div
              key="vouchers"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto"
            >
              {vouchers.length === 0 ? (
                <div className="text-center py-20">
                  <Ticket className="w-32 h-32 mx-auto text-gray-600 mb-6" />
                  <h3 className="text-3xl font-bold mb-4">No Vouchers Found</h3>
                  <p className="text-xl text-gray-400">Win games or get lucky to earn TYC vouchers!</p>
                </div>
              ) : (
                <div className="space-y-8">
                  <h2 className="text-4xl font-bold text-center mb-10 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Your TYC Vouchers
                  </h2>
                  {vouchers.map((voucher) => (
                    <motion.div
                      key={voucher.tokenId.toString()}
                      whileHover={{ scale: 1.02 }}
                      className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-3xl p-8 border border-purple-500/50 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-6">
                        <div className="p-6 bg-purple-900/50 rounded-2xl">
                          <Ticket className="w-16 h-16 text-purple-300" />
                        </div>
                        <div>
                          <h3 className="text-3xl font-bold">TYC Voucher</h3>
                          <p className="text-xl text-purple-300 mt-2">
                            Redeem for free TYC tokens
                          </p>
                          <p className="text-lg text-gray-400">Amount: {voucher.amount}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRedeem(voucher.tokenId)}
                        disabled={redeeming}
                        className="px-10 py-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xl rounded-2xl hover:shadow-xl hover:shadow-purple-500/50 transition disabled:opacity-50"
                      >
                        {redeeming ? <Loader2 className="w-8 h-8 animate-spin mx-auto" /> : 'Redeem Now'}
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wallet Warning */}
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-900/90 backdrop-blur-lg border border-red-600 rounded-3xl px-10 py-6 shadow-2xl"
          >
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-red-400" />
            <p className="text-2xl font-bold text-center">Connect Wallet to Shop & Redeem</p>
          </motion.div>
        )}
      </div>
    </section>
  );
}