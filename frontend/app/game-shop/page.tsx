'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { motion, AnimatePresence } from "framer-motion";
import { parseUnits, formatUnits, Address } from 'viem';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { 
  ShoppingBag, Coins, AlertTriangle, Zap, Shield, Sparkles, Gem, Crown, 
  Wallet, RefreshCw, CheckCircle, Loader2, DollarSign, CreditCard 
} from 'lucide-react';
import RewardABI from "@/context/abi/rewardabi.json";
import { REWARD_CONTRACT_ADDRESSES, TYC_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS } from "@/constants/contracts";
import { useRewardTokenBalance, useRewardCollectibleInfo, useRewardRedeemVoucher } from "@/context/ContractProvider"; // ← Import your hooks

const CollectiblePerk = {
  NONE: 0,
  EXTRA_TURN: 1,
  JAIL_FREE: 2,
  DOUBLE_RENT: 3,
  ROLL_BOOST: 4,
  CASH_TIERED: 5,
  TELEPORT: 6,
  SHIELD: 7,
  PROPERTY_DISCOUNT: 8,
  TAX_REFUND: 9,
  ROLL_EXACT: 10,
};

const perkMetadata = [
  { perk: CollectiblePerk.EXTRA_TURN, name: "Extra Turn", desc: "Get +1 extra turn on your next roll!", icon: <Zap />, color: "yellow", image: "/game/shop/extra-turn.jpg" },
  { perk: CollectiblePerk.JAIL_FREE, name: "Jail Free Card", desc: "Escape jail instantly – no questions asked!", icon: <Crown />, color: "purple", image: "/game/shop/jail-free.jpg" },
  { perk: CollectiblePerk.DOUBLE_RENT, name: "Double Rent", desc: "Next rent you collect is doubled – pure profit!", icon: <Coins />, color: "green", image: "/game/shop/double-rent.jpg" },
  { perk: CollectiblePerk.ROLL_BOOST, name: "Roll Boost", desc: "Add +1 to +3 to your next dice roll!", icon: <Sparkles />, color: "blue", image: "/game/shop/roll-boost.jpg" },
  { perk: CollectiblePerk.CASH_TIERED, name: "Instant Cash (Tiered)", desc: "Burn for instant TYC cash payout (Tier 1–5)", icon: <Gem />, color: "cyan", image: "/game/shop/cash-tiered.jpg" },
  { perk: CollectiblePerk.TELEPORT, name: "Teleport", desc: "Instantly move to any property on the board!", icon: <Zap />, color: "pink", image: "/game/shop/teleport.jpg" },
  { perk: CollectiblePerk.SHIELD, name: "Shield", desc: "Protect yourself from rent & fees for 1–3 turns", icon: <Shield />, color: "indigo", image: "/game/shop/shield.jpg" },
  { perk: CollectiblePerk.PROPERTY_DISCOUNT, name: "Property Discount", desc: "30–50% off your next property purchase", icon: <Coins />, color: "orange", image: "/game/shop/property-discount.jpg" },
  { perk: CollectiblePerk.TAX_REFUND, name: "Tax Refund (Tiered)", desc: "Get a tiered cash refund on taxes paid", icon: <Gem />, color: "teal", image: "/game/shop/tax-refund.jpg" },
  { perk: CollectiblePerk.ROLL_EXACT, name: "Exact Roll", desc: "Choose any dice roll (2–12) once – perfect precision!", icon: <Sparkles />, color: "amber", image: "/game/shop/exact-roll.jpg" },
];

export default function GameShop() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES];

  const [shopItems, setShopItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [buyingId, setBuyingId] = useState<bigint | null>(null);
  const [useUsdc, setUseUsdc] = useState(false);
  const [currentAction, setCurrentAction] = useState<'approve' | 'buy' | null>(null);

  const { writeContract, data: hash, isPending: writing, error: writeError, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Player balances
  const { balance: tycBalance } = useRewardTokenBalance(address, undefined, { enabled: isConnected });
  const { balance: usdcBalance } = useRewardTokenBalance(address, undefined, { enabled: isConnected }); // We'll filter later

  const { redeem: redeemVoucher, isPending: redeeming, isSuccess: redeemSuccess } = useRewardRedeemVoucher();

  // Fetch all shop items dynamically from contract
  useEffect(() => {
    if (!contractAddress || !isConnected) {
      setLoadingItems(false);
      return;
    }

    const fetchShopItems = async () => {
      setLoadingItems(true);
      try {
        const count = await useReadContract({
          address: contractAddress,
          abi: RewardABI,
          functionName: 'ownedTokenCount',
          args: [contractAddress],
        }).data as bigint;

        const items = [];
        for (let i = 0; i < count; i++) {
          const tokenId = await useReadContract({
            address: contractAddress,
            abi: RewardABI,
            functionName: 'tokenOfOwnerByIndex',
            args: [contractAddress, i],
          }).data as bigint;

          const info = await useReadContract({
            address: contractAddress,
            abi: RewardABI,
            functionName: 'getCollectibleInfo',
            args: [tokenId],
          }).data as [number, bigint, bigint, bigint, bigint];

          const perk = info[0];
          const metadata = perkMetadata.find(m => m.perk === perk) || {
            name: `Perk #${perk}`,
            desc: "Mysterious collectible",
            icon: <Gem />,
            color: "gray",
            image: "/game/shop/mystery.jpg",
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
      } catch (err) {
        console.error("Failed to load shop:", err);
        toast.error("Could not load shop items. Please try again.");
      } finally {
        setLoadingItems(false);
      }
    };

    fetchShopItems();
  }, [contractAddress, isConnected]);

  // Handle approval → buy flow
  const handleBuy = async (item: any) => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet first!");
      return;
    }

    const price = useUsdc ? item.usdcPrice : item.tycPrice;
    if (parseFloat(price) === 0) {
      toast.error(useUsdc ? "This item is not available in USDC" : "This item is not available in TYC");
      return;
    }

    const decimals = useUsdc ? 6 : 18;
    const amount = parseUnits(price, decimals);
    const paymentToken = useUsdc ? USDC_TOKEN_ADDRESS[chainId] : TYC_TOKEN_ADDRESS[chainId];

    setBuyingId(item.tokenId);
    setCurrentAction('approve');

    const toastId = toast.loading(`Approving ${price} ${useUsdc ? "USDC" : "TYC"}...`, {
      position: "top-right",
    });

    try {
      await writeContract({
        address: paymentToken!,
        abi: [
          {
            name: "approve",
            type: "function",
            inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
            outputs: [{ type: "bool" }],
            stateMutability: "nonpayable",
          },
        ],
        functionName: "approve",
        args: [contractAddress!, amount],
      });

      // Wait for approval confirmation (handled by useEffect below)
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

useEffect(() => {
  // No active purchase flow → early return
  if (!buyingId || !currentAction) return;

  // 1. Approval successful → trigger buy
  if (currentAction === 'approve' && hash && isSuccess && !writing && !confirming) {
    toast.info("Approval confirmed! Purchasing perk now...", {
      isLoading: true,
      autoClose: false,
    });

    setCurrentAction('buy');

    writeContract({
      address: contractAddress!,
      abi: RewardABI,
      functionName: "buyCollectible",
      args: [buyingId, useUsdc],
    });
  }

  // 2. Purchase successful → celebrate & refresh
  if (currentAction === 'buy' && hash && isSuccess && !writing && !confirming) {
    toast.success("Perk purchased successfully! 🎉", {
      autoClose: 5000,
    });

    // Clean up and refresh shop
    setBuyingId(null);
    setCurrentAction(null);

    const timer = setTimeout(() => {
      window.location.reload();
    }, 2000);

    return () => clearTimeout(timer);
  }

  // 3. Handle errors safely (type guard for writeError)
  if (writeError) {
    // Safely extract error message with fallback
    let errorMessage = "Transaction failed";

    if (writeError instanceof Error) {
      errorMessage = writeError.message;
    } else if (typeof writeError === "string") {
      errorMessage = writeError;
    } else if (writeError && typeof writeError === "object" && "message" in writeError) {
      errorMessage = (writeError as { message: string }).message;
    }

    const isUserRejected =
      errorMessage.toLowerCase().includes("user rejected") ||
      errorMessage.toLowerCase().includes("rejected") ||
      (writeError as any)?.code === 4001;

    toast.error(
      isUserRejected
        ? "Transaction cancelled – no worries!"
        : `Error: ${errorMessage}`,
      { autoClose: 7000 }
    );

    // Reset state
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
  // Redeem voucher
  const handleRedeem = async (tokenId: bigint) => {
    try {
      await redeemVoucher(tokenId);
      toast.success("Voucher redeemed! TYC added to your wallet.");
    } catch (err: any) {
      toast.error(err.message || "Failed to redeem voucher");
    }
  };

  const handleBack = () => router.push("/");

  return (
    <section className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] text-[#F0F7F7] py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl md:text-5xl font-orbitron font-bold uppercase tracking-wide flex items-center gap-4">
            <ShoppingBag className="w-12 h-12 text-[#00F0FF]" />
            Tycoon Perk Shop
          </h1>
          <button onClick={handleBack} className="text-[#00F0FF] hover:text-[#0FF0FC] transition text-lg">
            ← Back to Game
          </button>
        </div>

        {/* Balances & Payment Toggle */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-[#0E1415]/80 rounded-xl p-6 border border-[#003B3E] text-center">
            <Wallet className="w-8 h-8 mx-auto mb-2 text-[#00F0FF]" />
            <p className="text-lg font-semibold">Your TYC</p>
            <p className="text-2xl font-bold text-[#00F0FF]">
              {tycBalance !== undefined ? formatUnits(tycBalance, 18) : "—"} TYC
            </p>
          </div>

          <div className="bg-[#0E1415]/80 rounded-xl p-6 border border-[#003B3E] text-center">
            <CreditCard className="w-8 h-8 mx-auto mb-2 text-[#00F0FF]" />
            <p className="text-lg font-semibold">Your USDC</p>
            <p className="text-2xl font-bold text-[#00F0FF]">
              {usdcBalance !== undefined ? formatUnits(usdcBalance, 6) : "—"} USDC
            </p>
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

        {/* Redeem Vouchers Section */}
        {isConnected && (
          <div className="mb-12 bg-[#0E1415]/80 rounded-2xl p-8 border border-[#003B3E]">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <RefreshCw className="w-7 h-7 text-[#00F0FF]" /> Redeem Your Vouchers
            </h2>
            <p className="text-gray-400 mb-6">
              Got vouchers from registering or winning? Redeem them here for TYC!
            </p>
            {/* You can expand this to list owned vouchers using useRewardTokenBalance + enumeration */}
            <button
              onClick={() => toast.info("Voucher redemption coming soon – contact support for now!")}
              className="px-8 py-4 bg-gradient-to-r from-[#003B3E] to-[#00F0FF] text-black font-bold rounded-xl flex items-center gap-3 hover:from-[#00F0FF] hover:to-[#0FF0FC] transition"
            >
              <CheckCircle className="w-6 h-6" />
              Redeem Vouchers
            </button>
          </div>
        )}

        {/* Shop Items */}
        {loadingItems ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-[#00F0FF]" />
            <span className="ml-4 text-xl">Loading Perks...</span>
          </div>
        ) : shopItems.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-xl">
            No perks available yet. Check back soon!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {shopItems.map((item) => {
              const price = useUsdc ? item.usdcPrice : item.tycPrice;
              const formattedPrice = useUsdc ? `$${price}` : `${price} TYC`;
              const isCheapInUsdc = parseFloat(item.usdcPrice) < parseFloat(item.tycPrice) * 0.5;

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

                      {item.stock > 0 ? (
                        <div className="text-right">
                          <p className="text-sm text-gray-400">Stock</p>
                          <p className="font-semibold">{item.stock}</p>
                        </div>
                      ) : (
                        <span className="text-red-400 font-semibold">Sold Out</span>
                      )}
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

        {!contractAddress && isConnected && (
          <div className="mt-16 text-center text-rose-400 text-2xl">
            No shop deployed on this network (Chain ID: {chainId})
          </div>
        )}
      </div>
    </section>
  );
}