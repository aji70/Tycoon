'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAccount, useChainId, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits, Address, type Abi } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  ShoppingBag, Coins, AlertTriangle, Zap, Shield, Sparkles, Gem, Crown, 
  Wallet, Loader2, CreditCard, Ticket, RefreshCw
} from 'lucide-react';

import RewardABI from "@/context/abi/rewardabi.json";
import { REWARD_CONTRACT_ADDRESSES, TYC_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS } from "@/constants/contracts";

// Optional: Import your custom hook if you have it
// import { useRewardTokenBalance } from '@/context/ContractProvider';

// Metadata for display (match your deployed perk IDs)
// You can expand this as needed
const perkMetadata = [
  { perk: 1, name: "Extra Turn", desc: "Get +1 extra turn on your next roll!", icon: <Zap className="w-12 h-12 text-yellow-400" />, image: "/game/shop/a.jpeg" },
  { perk: 2, name: "Jail Free Card", desc: "Escape jail instantly!", icon: <Crown className="w-12 h-12 text-purple-400" />, image: "/game/shop/b.jpeg" },
  { perk: 3, name: "Double Rent", desc: "Next rent doubled!", icon: <Coins className="w-12 h-12 text-green-400" />, image: "/game/shop/c.jpeg" },
  { perk: 4, name: "Roll Boost", desc: "Bonus to next roll!", icon: <Sparkles className="w-12 h-12 text-blue-400" />, image: "/game/shop/a.jpeg" },
  { perk: 5, name: "Instant Cash", desc: "Burn for tiered TYC cash!", icon: <Gem className="w-12 h-12 text-cyan-400" />, image: "/game/shop/b.jpeg" },
  { perk: 6, name: "Teleport", desc: "Move to any property!", icon: <Zap className="w-12 h-12 text-pink-400" />, image: "/game/shop/c.jpeg" },
  { perk: 7, name: "Shield", desc: "Protect from rent/fees!", icon: <Shield className="w-12 h-12 text-indigo-400" />, image: "/game/shop/a.jpeg" },
  { perk: 8, name: "Property Discount", desc: "30-50% off next buy!", icon: <Coins className="w-12 h-12 text-orange-400" />, image: "/game/shop/b.jpeg" },
  { perk: 9, name: "Tax Refund", desc: "Tiered tax cash back!", icon: <Gem className="w-12 h-12 text-teal-400" />, image: "/game/shop/c.jpeg" },
  { perk: 10, name: "Exact Roll", desc: "Choose exact roll 2-12!", icon: <Sparkles className="w-12 h-12 text-amber-400" />, image: "/game/shop/a.jpeg" },
];

export default function GameShop() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES] as Address | undefined;

  const [shopItems, setShopItems] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[]>([]); // For redeem section
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<bigint | null>(null);
  const [useUsdc, setUseUsdc] = useState(false);
  const [voucherIdToRedeem, setVoucherIdToRedeem] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const { writeContract, data: hash, isPending: writing, error: writeError, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Fetch user's TYC & USDC balances (you can use your custom hook or direct read)
  const tycBalanceRaw = useReadContract({
    address: TYC_TOKEN_ADDRESS[chainId as keyof typeof TYC_TOKEN_ADDRESS] as Address,
    abi: [
      { constant: true, inputs: [{ name: "_owner", type: "address" }], name: "balanceOf", outputs: [{ name: "balance", type: "uint256" }], type: "function" }
    ],
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address && !!contractAddress },
  });

  const usdcBalanceRaw = useReadContract({
    address: USDC_TOKEN_ADDRESS[chainId as keyof typeof USDC_TOKEN_ADDRESS] as Address,
    abi: [
      { constant: true, inputs: [{ name: "_owner", type: "address" }], name: "balanceOf", outputs: [{ name: "balance", type: "uint256" }], type: "function" }
    ],
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address && !!contractAddress },
  });

  const tycBalance = tycBalanceRaw.data ? Number(formatUnits(tycBalanceRaw.data as bigint, 18)).toFixed(2) : '0.00';
  const usdcBalance = usdcBalanceRaw.data ? Number(formatUnits(usdcBalanceRaw.data as bigint, 6)).toFixed(2) : '0.00';

  // Fetch all collectibles & vouchers owned by the shop contract
  useEffect(() => {
    if (!contractAddress || !isConnected) {
      setLoading(false);
      setErrorMessage(!contractAddress ? "Shop not available on this chain" : "Connect wallet to view items");
      return;
    }

    const fetchItems = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        // 1. Get total unique token types owned by shop
        const countResult = await useReadContract({
          address: contractAddress,
          abi: RewardABI,
          functionName: 'ownedTokenCount',
          args: [contractAddress],
        });

        const count = Number(countResult.data ?? 0);

        if (count === 0) {
          setShopItems([]);
          setVouchers([]);
          setLoading(false);
          return;
        }

        // 2. Get all token IDs
    const tokenIds: bigint[] = [];
for (let i = 0; i < count; i++) {
  const tokenIdResult = await useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: 'tokenOfOwnerByIndex',
    args: [contractAddress, BigInt(i)],
  });
  tokenIds.push(tokenIdResult.data as bigint);
}

        // 3. Batch fetch info for all tokens
        const infoCalls = tokenIds.map((id) => ({
          address: contractAddress,
          abi: RewardABI as Abi,
          functionName: 'getCollectibleInfo' as const,
          args: [id] as const,
        } as const));

        const infoResults = await useReadContracts({ contracts: infoCalls });

        const collectibles: any[] = [];
        const userVouchers: any[] = [];

        infoResults.data?.forEach((result, index) => {
          if (result?.status !== 'success') return;

          const [perk, strength, tycPrice, usdcPrice, stock] = result.result as [number, bigint, bigint, bigint, bigint];
          const tokenId = tokenIds[index];

          // Voucher range: 1_000_000_000+
          if (tokenId >= 1000000000 && tokenId < 2000000000) {
            userVouchers.push({
              tokenId,
              value: Number(strength), // assuming strength holds redeem value for vouchers
              name: `TYC Voucher #${tokenId}`,
              desc: `Redeem for ${Number(strength)} TYC`,
              icon: <Ticket className="w-12 h-12 text-amber-400" />,
            });
          } 
          // Collectible range: 2_000_000_000+
          else if (tokenId >= 2000000000) {
            const meta = perkMetadata.find(m => m.perk === perk) || {
              name: `Unknown Perk #${perk}`,
              desc: "Mysterious collectible",
              icon: <Gem className="w-12 h-12 text-gray-400" />,
              image: "/game/shop/placeholder.jpg",
            };

            collectibles.push({
              tokenId,
              perkId: perk,
              strength: Number(strength),
              tycPrice: formatUnits(tycPrice, 18),
              usdcPrice: formatUnits(usdcPrice, 6),
              stock: Number(stock),
              ...meta,
            });
          }
        });

        setShopItems(collectibles);
        setVouchers(userVouchers);
      } catch (err: any) {
        console.error("Shop fetch error:", err);
        setErrorMessage(err.message || "Failed to load shop items");
        toast.error("Could not load shop items");
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [contractAddress, isConnected]);

  // Buy handler (same as before, just using item from shopItems)
  const handleBuy = async (item: any) => {
    if (!isConnected || !address || !contractAddress) {
      toast.error("Connect wallet first!");
      return;
    }

    const price = useUsdc ? item.usdcPrice : item.tycPrice;
    if (Number(price) === 0) {
      toast.error(useUsdc ? "Not available in USDC" : "Not available in TYC");
      return;
    }

    const decimals = useUsdc ? 6 : 18;
    const amount = parseUnits(price.toString(), decimals);
    const paymentToken = useUsdc 
      ? USDC_TOKEN_ADDRESS[chainId as keyof typeof USDC_TOKEN_ADDRESS] as Address
      : TYC_TOKEN_ADDRESS[chainId as keyof typeof TYC_TOKEN_ADDRESS] as Address;

    try {
      // 1. Approve token
      await writeContract({
        address: paymentToken,
        abi: [
          { name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" }
        ],
        functionName: "approve",
        args: [contractAddress, amount],
      });

      toast.info("Approval confirmed! Finalizing purchase...");

      // 2. Buy collectible
      await writeContract({
        address: contractAddress,
        abi: RewardABI,
        functionName: "buyCollectible",
        args: [item.tokenId, useUsdc],
      });

      toast.success("Perk purchased successfully! 🎉");
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      console.error(err);
      toast.error(err.shortMessage || "Transaction failed");
    }
  };

  // Redeem voucher handler
  const handleRedeemVoucher = async () => {
    if (!isConnected || !address || !contractAddress) {
      toast.error("Connect wallet first!");
      return;
    }

    const tokenId = BigInt(voucherIdToRedeem.trim());
    if (isNaN(Number(tokenId)) || tokenId <= 0) {
      toast.error("Invalid voucher ID");
      return;
    }

    setRedeeming(true);

    try {
      await writeContract({
        address: contractAddress,
        abi: RewardABI,
        functionName: 'redeemVoucher',
        args: [tokenId],
      });

      toast.success("Voucher redeemed successfully! TYC added to your wallet");
      setVoucherIdToRedeem('');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      console.error(err);
      toast.error(err.shortMessage || "Redemption failed");
    } finally {
      setRedeeming(false);
    }
  };

  const handleBack = () => router.push("/");

  return (
    <section className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] text-[#F0F7F7] py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-wide flex items-center gap-4">
            <ShoppingBag className="w-12 h-12 text-[#00F0FF]" />
            Tycoon Perk Shop
          </h1>
          <button onClick={handleBack} className="text-[#00F0FF] hover:text-[#0FF0FC] transition text-lg">
            ← Back to Game
          </button>
        </div>

        {/* User Balances + Payment Toggle */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-[#0E1415]/80 rounded-xl p-6 border border-[#003B3E] text-center">
            <Wallet className="w-8 h-8 mx-auto mb-2 text-[#00F0FF]" />
            <p className="text-lg font-semibold">Your TYC</p>
            <p className="text-2xl font-bold text-[#00F0FF]">{tycBalance} TYC</p>
          </div>
          <div className="bg-[#0E1415]/80 rounded-xl p-6 border border-[#003B3E] text-center">
            <CreditCard className="w-8 h-8 mx-auto mb-2 text-[#00F0FF]" />
            <p className="text-lg font-semibold">Your USDC</p>
            <p className="text-2xl font-bold text-[#00F0FF]">{usdcBalance} USDC</p>
          </div>
          <div className="bg-[#003B3E]/50 rounded-xl p-6 border border-[#00F0FF]/30 flex items-center justify-center">
            <button
              onClick={() => setUseUsdc(!useUsdc)}
              className="px-8 py-4 bg-[#003B3E] rounded-xl border-2 border-[#00F0FF] flex items-center gap-4 hover:bg-[#00F0FF]/20 transition text-lg font-semibold"
            >
              Pay with <span className="text-[#00F0FF]">{useUsdc ? "USDC 💵" : "TYC 🪙"}</span>
              <span className="text-sm opacity-70">(cheaper in USDC!)</span>
            </button>
          </div>
        </div>

        {/* Loading / Error */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-[#00F0FF]" />
            <span className="ml-4 text-xl">Loading Perks & Vouchers...</span>
          </div>
        ) : errorMessage ? (
          <div className="text-center py-20 text-rose-400 text-xl">
            {errorMessage}
          </div>
        ) : (
          <>
            {/* Available Collectibles */}
            <section className="mb-16">
              <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
                <ShoppingBag className="w-8 h-8 text-[#00F0FF]" />
                Available Perks
              </h2>

              {shopItems.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  No collectibles available in shop yet. Check back soon!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {shopItems.map((item) => (
                    <motion.div
                      key={item.tokenId.toString()}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.05 }}
                      className="bg-[#0E1415] rounded-2xl overflow-hidden border border-[#003B3E] hover:border-[#00F0FF] transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-[#00F0FF]/20"
                    >
                      {/* Image */}
                      <div className="relative h-48">
                        <Image
                          src={item.image || "/game/shop/placeholder.jpg"}
                          alt={item.name}
                          fill
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                        <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2">
                          {item.icon}
                          <span className="font-bold text-lg truncate">{item.name}</span>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="p-6">
                        <p className="text-gray-400 mb-4 text-sm line-clamp-2">{item.desc}</p>

                        <div className="flex justify-between items-center mb-4">
                          <div>
                            <p className="text-sm text-gray-400">Price</p>
                            <p className="text-xl font-bold text-[#00F0FF]">
                              {useUsdc ? `$${item.usdcPrice}` : `${item.tycPrice} TYC`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-400">Stock</p>
                            <p className="font-semibold">{item.stock}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleBuy(item)}
                          disabled={buyingId === item.tokenId || writing || confirming || item.stock === 0}
                          className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 ${
                            buyingId === item.tokenId && (writing || confirming)
                              ? "bg-gray-700 cursor-wait"
                              : item.stock === 0
                              ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                              : "bg-gradient-to-r from-[#003B3E] to-[#00F0FF] hover:from-[#00F0FF] hover:to-[#0FF0FC] text-black"
                          }`}
                        >
                          {buyingId === item.tokenId && (writing || confirming) ? (
                            <>
                              <Loader2 className="w-6 h-6 animate-spin" />
                              Processing...
                            </>
                          ) : item.stock === 0 ? (
                            "Sold Out"
                          ) : (
                            <>
                              <Coins className="w-6 h-6" />
                              Buy Now
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </section>

            {/* Redeem Vouchers Section */}
            <section className="mb-16">
              <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
                <Ticket className="w-8 h-8 text-amber-400" />
                Redeem Your Vouchers
              </h2>

              <div className="bg-[#0E1415]/80 rounded-2xl p-8 border border-[#003B3E]">
                <div className="max-w-md mx-auto">
                  <label className="block text-lg font-semibold mb-3">
                    Voucher Token ID
                  </label>
                  <input
                    type="text"
                    value={voucherIdToRedeem}
                    onChange={(e) => setVoucherIdToRedeem(e.target.value)}
                    placeholder="Enter your voucher ID (e.g. 1000000001)"
                    className="w-full px-4 py-3 bg-gray-800 border border-[#003B3E] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00F0FF] text-white mb-4"
                  />
                  <button
                    onClick={handleRedeemVoucher}
                    disabled={redeeming || !voucherIdToRedeem.trim()}
                    className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 ${
                      redeeming
                        ? "bg-gray-700 cursor-wait"
                        : "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500"
                    }`}
                  >
                    {redeeming ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        Redeeming...
                      </>
                    ) : (
                      <>
                        <Ticket className="w-6 h-6" />
                        Redeem Voucher
                      </>
                    )}
                  </button>
                  <p className="text-sm text-gray-400 mt-4 text-center">
                    Redeem your TYC vouchers instantly. Make sure you own the token!
                  </p>
                </div>
              </div>
            </section>
          </>
        )}

        {!isConnected && (
          <div className="mt-16 text-center p-10 bg-[#0E1415]/60 rounded-2xl border border-red-800">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />
            <h3 className="text-2xl font-bold mb-4">Wallet Not Connected</h3>
            <p className="text-lg text-gray-300">
              Connect your wallet to browse perks and redeem vouchers!
            </p>
          </div>
        )}
      </div>
    </section>
  );
}