'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits, Address } from 'viem';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  ShoppingBag, Coins, AlertTriangle, Zap, Shield, Sparkles, Gem, Crown, 
  Wallet, Loader2, CreditCard 
} from 'lucide-react';
import RewardABI from "@/context/abi/rewardabi.json";
import { REWARD_CONTRACT_ADDRESSES, TYC_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS } from "@/constants/contracts";
// Assuming you have these hooks exported from your context
import { useRewardTokenBalance } from '@/context/ContractProvider';

// Metadata for display (match your deployed perk IDs)
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
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES];

  const [shopItems, setShopItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<bigint | null>(null);
  const [useUsdc, setUseUsdc] = useState(false);
  const [currentAction, setCurrentAction] = useState<'approve' | 'buy' | null>(null);

  const { writeContract, data: hash, isPending: writing, error: writeError, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Balances
  const { balance: tycBalanceRaw } = useRewardTokenBalance(address, undefined, { enabled: isConnected });
  const { balance: usdcBalanceRaw } = useRewardTokenBalance(address, undefined, { enabled: isConnected });

  const tycBalance = tycBalanceRaw ? formatUnits(tycBalanceRaw, 18) : '0';
  const usdcBalance = usdcBalanceRaw ? formatUnits(usdcBalanceRaw, 6) : '0';

  // Fetch shop items safely (no hooks in loop)
  useEffect(() => {
    if (!contractAddress || !isConnected) {
      setLoadingItems(false);
      setErrorMessage(!contractAddress ? "No shop contract on this chain" : "Connect wallet to view shop");
      return;
    }

    const fetchShopItems = async () => {
      setLoadingItems(true);
      setErrorMessage(null);
      try {
        // Get count of collectibles owned by contract (shop stock)
        const countResult = await useReadContract({
          address: contractAddress,
          abi: RewardABI,
          functionName: 'ownedTokenCount',
          args: [contractAddress],
        });

        const count = Number(countResult.data ?? 0);

        if (count === 0) {
          setShopItems([]);
          return;
        }

        const items = [];
        for (let i = 0; i < count; i++) {
          // Get token ID at index
          const tokenIdResult = await useReadContract({
            address: contractAddress,
            abi: RewardABI,
            functionName: 'tokenOfOwnerByIndex',
            args: [contractAddress, BigInt(i)],
          });
          const tokenId = tokenIdResult.data as bigint;

          // Get collectible info
          const infoResult = await useReadContract({
            address: contractAddress,
            abi: RewardABI,
            functionName: 'getCollectibleInfo',
            args: [tokenId],
          });
          const info = infoResult.data as [number, bigint, bigint, bigint, bigint];

          const perk = info[0];
          const metadata = perkMetadata.find(m => m.perk === perk) || {
            name: `Unknown Perk #${perk}`,
            desc: "Collectible available in shop",
            icon: <Gem className="w-12 h-12 text-gray-400" />,
            color: "gray",
            image: "/game/shop/placeholder.jpg",
          };

          items.push({
            tokenId,
            perkId: perk,
            strength: Number(info[1]),
            tycPrice: formatUnits(info[2], 18),
            usdcPrice: formatUnits(info[3], 6),
            stock: Number(info[4]),
            ...metadata,
          });
        }

        setShopItems(items);
      } catch (err: any) {
        console.error("Shop fetch error:", err);
        setErrorMessage(err.message || "Failed to load shop items. Try again later.");
        toast.error("Could not load shop items");
      } finally {
        setLoadingItems(false);
      }
    };

    fetchShopItems();
  }, [contractAddress, isConnected]);

  // Buy flow (approval → purchase)
  const handleBuy = async (item: any) => {
    if (!isConnected || !address) {
      toast.error("Connect your wallet first!");
      return;
    }

    const price = useUsdc ? item.usdcPrice : item.tycPrice;
    if (Number(price) === 0) {
      toast.error(useUsdc ? "Not available in USDC" : "Not available in TYC");
      return;
    }

    const decimals = useUsdc ? 6 : 18;
    const amount = parseUnits(price, decimals);
    const paymentToken = useUsdc ? USDC_TOKEN_ADDRESS[chainId] : TYC_TOKEN_ADDRESS[chainId];

    setBuyingId(item.tokenId);
    setCurrentAction('approve');

    const toastId = toast.loading(`Approving ${price} ${useUsdc ? "USDC" : "TYC"}...`);

    try {
      await writeContract({
        address: paymentToken as Address,
        abi: [
          {
            name: "approve",
            type: "function",
            inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
            outputs: [{ name: "", type: "bool" }],
            stateMutability: "nonpayable",
          },
        ],
        functionName: "approve",
        args: [contractAddress as Address, amount],
      });
      // Success will trigger next step in useEffect
    } catch (err: any) {
      toast.update(toastId, {
        render: err.message?.includes("User rejected") ? "Approval cancelled" : "Approval failed",
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
      setBuyingId(null);
      setCurrentAction(null);
      reset();
    }
  };

  // Transaction lifecycle
  useEffect(() => {
    if (!buyingId || !currentAction) return;

    if (currentAction === 'approve' && hash && isSuccess && !writing && !confirming) {
      toast.info("Approval confirmed! Purchasing perk now...", {
        isLoading: true,
        autoClose: false,
      });

      setCurrentAction('buy');

      writeContract({
        address: contractAddress as Address,
        abi: RewardABI,
        functionName: "buyCollectible",
        args: [buyingId, useUsdc],
      });
    }

    if (currentAction === 'buy' && hash && isSuccess && !writing && !confirming) {
      toast.success("Perk purchased successfully! 🎉", { autoClose: 5000 });

      setBuyingId(null);
      setCurrentAction(null);

      setTimeout(() => window.location.reload(), 2000);
    }

    if (writeError) {
      let errorMessage = "Transaction failed";

      if (writeError instanceof Error) {
        errorMessage = writeError.message;
      } else if (typeof writeError === "string") {
        errorMessage = writeError;
      } else if (writeError && 'message' in writeError) {
        errorMessage = (writeError as { message: string }).message;
      }

      const isRejected =
        errorMessage.toLowerCase().includes("user rejected") ||
        errorMessage.toLowerCase().includes("rejected") ||
        (writeError as any)?.code === 4001;

      toast.error(isRejected ? "Cancelled – no worries!" : `Error: ${errorMessage}`, {
        autoClose: 7000,
      });

      setBuyingId(null);
      setCurrentAction(null);
      reset();
    }
  }, [
    buyingId,
    currentAction,
    hash,
    isSuccess,
    writing,
    confirming,
    writeError,
    writeContract,
    contractAddress,
    useUsdc,
    reset,
  ]);

  const handleBack = () => router.push("/");

  return (
    <section className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] text-[#F0F7F7] py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-wide flex items-center gap-4">
            <ShoppingBag className="w-12 h-12 text-[#00F0FF]" />
            Tycoon Perk Shop
          </h1>
          <button onClick={handleBack} className="text-[#00F0FF] hover:text-[#0FF0FC] transition text-lg">
            ← Back to Game
          </button>
        </div>

        {/* Balances */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
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

        {/* Loading / Error / Empty States */}
        {loadingItems ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-[#00F0FF]" />
            <span className="ml-4 text-xl">Loading Perks...</span>
          </div>
        ) : errorMessage ? (
          <div className="text-center py-20 text-rose-400 text-xl">
            {errorMessage}
          </div>
        ) : shopItems.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-xl">
            No perks available in shop yet. Check back soon!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {shopItems.map((item) => {
              const price = useUsdc ? item.usdcPrice : item.tycPrice;
              const formattedPrice = useUsdc ? `$${price}` : `${price} TYC`;
              const isCheapInUsdc = Number(item.usdcPrice) < Number(item.tycPrice) * 0.5;

              return (
                <motion.div
                  key={item.tokenId.toString()}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="bg-[#0E1415] rounded-2xl overflow-hidden border border-[#003B3E] hover:border-[#00F0FF] transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-[#00F0FF]/20"
                >
                  <div className="relative h-48">
                    <Image
                      src={item.image || "/game/shop/placeholder.jpg"}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="flex items-center gap-2">
                        {item.icon}
                        <span className="font-bold text-lg">{item.name}</span>
                      </div>
                      {item.strength > 1 && (
                        <span className="text-sm text-gray-300">Tier {item.strength}</span>
                      )}
                    </div>
                  </div>

                  <div className="p-6">
                    <p className="text-gray-400 mb-4 text-sm line-clamp-2">{item.desc}</p>

                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <p className="text-sm text-gray-400">Price</p>
                        <p className="text-2xl font-bold text-[#00F0FF]">{formattedPrice}</p>
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

                    {isCheapInUsdc && (
                      <p className="text-center text-xs text-green-400 mt-3">
                        Save big with USDC!
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {!isConnected && (
          <div className="mt-16 text-center p-10 bg-[#0E1415]/60 rounded-2xl border border-red-800">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />
            <h3 className="text-2xl font-bold mb-4">Wallet Not Connected</h3>
            <p className="text-lg text-gray-300">
              Connect your wallet to browse and buy powerful perks!
            </p>
          </div>
        )}
      </div>
    </section>
  );
}