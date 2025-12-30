"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ShoppingBag, Coins, AlertTriangle, Zap, Shield, Sparkles, Gem, Crown } from "lucide-react";
import RewardABI from "@/context/rewardabi.json";
import { REWARD_CONTRACT_ADDRESSES } from "@/constants/contracts";
import { TYC_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS } from "@/constants/contracts";

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

const perkData = [
  { id: CollectiblePerk.EXTRA_TURN, name: "Extra Turn", desc: "Get +1 extra turn on your next roll!", icon: <Zap className="w-12 h-12 text-yellow-400" />, image: "/game/shop/a.jpeg" },
  { id: CollectiblePerk.JAIL_FREE, name: "Get Out of Jail Free", desc: "Escape jail instantly – your golden ticket!", icon: <Crown className="w-12 h-12 text-purple-400" />, image: "/game/shop/b.jpeg" },
  { id: CollectiblePerk.DOUBLE_RENT, name: "Double Rent", desc: "Next rent you collect is doubled – cha-ching!", icon: <Coins className="w-12 h-12 text-green-400" />, image: "/game/shop/c.jpeg" },
  { id: CollectiblePerk.ROLL_BOOST, name: "Roll Boost", desc: "Add a bonus to your next dice roll!", icon: <Sparkles className="w-12 h-12 text-blue-400" />, image: "/game/shop/a.jpeg" },
  { id: CollectiblePerk.CASH_TIERED, name: "Instant Cash (Tiered)", desc: "Burn for instant TYC cash – tiers 10 to 250!", icon: <Gem className="w-12 h-12 text-cyan-400" />, image: "/game/shop/b.jpeg" },
  { id: CollectiblePerk.TELEPORT, name: "Teleport", desc: "Move to any property without rolling!", icon: <Zap className="w-12 h-12 text-pink-400" />, image: "/game/shop/c.jpeg" },
  { id: CollectiblePerk.SHIELD, name: "Shield", desc: "Immune to rent & payments for 1-2 turns", icon: <Shield className="w-12 h-12 text-indigo-400" />, image: "/game/shop/a.jpeg" },
  { id: CollectiblePerk.PROPERTY_DISCOUNT, name: "Property Discount", desc: "30-50% off your next property purchase", icon: <Coins className="w-12 h-12 text-orange-400" />, image: "/game/shop/b.jpeg" },
  { id: CollectiblePerk.TAX_REFUND, name: "Tax Refund (Tiered)", desc: "Burn for instant tiered cash refund!", icon: <Gem className="w-12 h-12 text-teal-400" />, image: "/game/shop/c.jpeg" },
  { id: CollectiblePerk.ROLL_EXACT, name: "Exact Roll", desc: "Choose any dice roll 2-12 once – perfect move!", icon: <Sparkles className="w-12 h-12 text-amber-400" />, image: "/game/shop/a.jpeg" },
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
  const [currentToastId, setCurrentToastId] = useState<any>(null);

  const { writeContract, data: hash, isPending: writing, error: writeError, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const paymentTokenAddress = useUsdc
    ? USDC_TOKEN_ADDRESS[chainId as keyof typeof USDC_TOKEN_ADDRESS]
    : TYC_TOKEN_ADDRESS[chainId as keyof typeof TYC_TOKEN_ADDRESS];

  useEffect(() => {
    if (!contractAddress) {
      setLoadingItems(false);
      return;
    }

    const fetchShop = async () => {
      setLoadingItems(true);
      const items = [];
      for (const perk of perkData) {
        items.push({
          tokenId: BigInt(2000000000 + perk.id),
          perkId: perk.id,
          ...perk,
          tycPrice: "5.0",
          usdcPrice: "0.10",
          stock: 999,
        });
      }
      setShopItems(items);
      setLoadingItems(false);
    };

    fetchShop();
  }, [contractAddress]);

  const handleBuy = (tokenId: bigint, tycPrice: string, usdcPrice: string) => {
    if (!isConnected) {
      toast.error("Please connect your wallet first!");
      return;
    }

    const priceStr = useUsdc ? usdcPrice : tycPrice;
    if (!priceStr || priceStr === "0") {
      toast.error(useUsdc ? "Not available in USDC" : "Not available in TYC");
      return;
    }

    const decimals = useUsdc ? 6 : 18;
    const amount = parseUnits(priceStr, decimals);

    setBuyingId(tokenId);

    const toastId = toast.loading(`Approve ${priceStr} ${useUsdc ? "USDC" : "TYC"} to continue...`, {
      position: "top-right",
    });
    setCurrentToastId(toastId);

    writeContract({
      address: paymentTokenAddress!,
      abi: [
        {
          name: "approve",
          type: "function",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ type: "bool" }],
          stateMutability: "nonpayable",
        },
      ],
      functionName: "approve",
      args: [contractAddress!, amount],
    });
  };

  useEffect(() => {
    if (!currentToastId) return;

    if (isSuccess && hash) {
      toast.update(currentToastId, {
        render: "Approval confirmed! Purchasing perk...",
        type: "info",
        isLoading: true,
      });

      writeContract({
        address: contractAddress!,
        abi: RewardABI,
        functionName: "buyCollectible",
        args: [buyingId!, useUsdc],
      });
    }

    if (writeError) {
      let message = "Transaction failed. Please try again.";

      const isUserRejection =
        (writeError as any)?.code === 4001 ||
        writeError?.message?.includes("User rejected") ||
        writeError?.message?.includes("User denied") ||
        writeError?.message?.includes("user rejected the request");

      if (isUserRejection) {
        message = "You cancelled the transaction – no worries!";
        toast.update(currentToastId, {
          render: message,
          type: "info",
          isLoading: false,
          autoClose: 4000,
        });
      } else {
        toast.update(currentToastId, {
          render: (
            <div>
              <div>{message}</div>
              {process.env.NODE_ENV === "development" && (
                <details className="text-xs mt-2 opacity-70">
                  <summary className="cursor-pointer">Show details</summary>
                  <pre className="mt-1 text-left overflow-x-auto text-xs">
                    {writeError?.message || "Unknown error"}
                  </pre>
                </details>
              )}
            </div>
          ),
          type: "error",
          isLoading: false,
          autoClose: 7000,
          closeOnClick: true,
        });
      }

      setBuyingId(null);
      setCurrentToastId(null);
      reset();
    }
  }, [isSuccess, writeError, hash, currentToastId, buyingId, writing, confirming, reset, writeContract, contractAddress, useUsdc]);

  // Final purchase success
  useEffect(() => {
    if (isSuccess && currentToastId && !writing && !confirming && buyingId) {
      toast.update(currentToastId, {
        render: "Perk purchased successfully! Check your inventory 🎉",
        type: "success",
        isLoading: false,
        autoClose: 5000,
        closeButton: true,
      });

      setBuyingId(null);
      setCurrentToastId(null);
      reset();
    }
  }, [isSuccess, currentToastId, writing, confirming, buyingId, reset]);

  const handleBack = () => router.push("/");

  return (
    <section className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] text-[#F0F7F7] py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-orbitron font-bold uppercase tracking-wide flex items-center gap-3">
            <ShoppingBag className="w-10 h-10 text-[#00F0FF]" />
            Tycoon Perk Shop
          </h1>
          <button onClick={handleBack} className="text-[#00F0FF] hover:text-[#0FF0FC] transition">
            ← Back to Game
          </button>
        </div>

        <p className="text-center text-lg mb-10 text-[#455A64]">
          Grab powerful perks to dominate the board! Pay with TYC or USDC
        </p>

        <div className="flex justify-center mb-8">
          <button
            onClick={() => setUseUsdc(!useUsdc)}
            className="px-6 py-3 bg-[#003B3E] rounded-lg border border-[#00F0FF] flex items-center gap-3 hover:bg-[#00F0FF]/20 transition"
          >
            Pay with {useUsdc ? "USDC" : "TYC"} {useUsdc ? "💵" : "🪙"}
          </button>
        </div>

        {loadingItems ? (
          <div className="text-center py-20 text-2xl">Loading shop items...</div>
        ) : shopItems.length === 0 ? (
          <div className="text-center py-20 text-gray-400">No perks available yet. Check back soon!</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {shopItems.map((item) => {
              const price = useUsdc ? item.usdcPrice : item.tycPrice;
              const formattedPrice = useUsdc ? `$${price}` : `${price} TYC`;

              return (
                <div
                  key={item.perkId}
                  className="bg-[#0E1415] rounded-2xl p-8 border border-[#003B3E] hover:border-[#00F0FF] transition-all duration-500 shadow-2xl"
                >
                  <div className="flex justify-center mb-6">{item.icon}</div>

                  <Image
                    src={item.image}
                    alt={item.name}
                    width={300}
                    height={300}
                    className="w-full rounded-xl mb-6 object-cover border border-[#00F0FF]/30"
                  />

                  <h3 className="text-2xl font-bold text-center mb-3">{item.name}</h3>
                  <p className="text-[#455A64] text-center mb-6">{item.desc}</p>

                  <div className="text-center mb-6">
                    <span className="text-3xl font-bold text-[#00F0FF]">{formattedPrice}</span>
                    {item.stock < 10 && <p className="text-orange-400 mt-2">Only {item.stock} left!</p>}
                  </div>

                  <button
                    onClick={() => handleBuy(item.tokenId, item.tycPrice, item.usdcPrice)}
                    disabled={buyingId === item.tokenId || writing || confirming}
                    className="w-full py-4 bg-gradient-to-r from-[#003B3E] to-[#00F0FF] text-black font-bold rounded-xl flex items-center justify-center gap-3 hover:from-[#00F0FF] hover:to-[#0FF0FC] transition disabled:opacity-50"
                  >
                    {buyingId === item.tokenId && (writing || confirming) ? (
                      <>Processing...</>
                    ) : (
                      <>
                        <Coins className="w-6 h-6" />
                        Buy Perk Now
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!isConnected && (
          <div className="mt-16 text-center p-10 bg-[#0E1415]/60 rounded-2xl border border-red-800">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />
            <p className="text-2xl">Connect your wallet to buy perks and rule the board!</p>
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