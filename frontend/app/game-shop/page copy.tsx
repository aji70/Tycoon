// 'use client';

// import React, { useState } from "react";
// import { useAccount } from "wagmi";
// import { toast } from "react-toastify";
// import { useRouter } from "next/navigation";
// import Image from "next/image";
// import { ShoppingBag, ArrowLeft, Coins, Shield, Zap, Sparkles, Crown, Gem } from "lucide-react";
// import { useRewardCollectibleInfo, useRewardBuyCollectible, useRewardTokenBalance } from "@/context/hooks"; // Use your updated hooks
// import { CollectiblePerk } from "@/context/hooks";

// interface ShopItem {
//   tokenId: bigint;
//   name: string;
//   description: string;
//   image: string; // Path to your perk images in /public/game/shop/perks/
//   rarity: "common" | "rare" | "epic" | "legendary";
// }

// const shopItems: ShopItem[] = [
//   {
//     tokenId: 2000000001n, // Replace with your actual shop tokenIds
//     name: "Extra Turn",
//     description: "Take one additional turn immediately after your current one.",
//     image: "/game/shop/perks/extra-turn.jpg",
//     rarity: "common",
//   },
//   {
//     tokenId: 2000000002n,
//     name: "Get Out of Jail Free",
//     description: "Escape jail instantly without paying or rolling doubles.",
//     image: "/game/shop/perks/jail-free.jpg",
//     rarity: "rare",
//   },
//   {
//     tokenId: 2000000003n,
//     name: "Teleport",
//     description: "Move instantly to any property on the board.",
//     image: "/game/shop/perks/teleport.jpg",
//     rarity: "epic",
//   },
//   {
//     tokenId: 2000000004n,
//     name: "Shield",
//     description: "Become immune to rent and penalties for 2 full turns.",
//     image: "/game/shop/perks/shield.jpg",
//     rarity: "rare",
//   },
//   {
//     tokenId: 2000000005n,
//     name: "Roll Exact",
//     description: "Choose any dice roll from 2–12 on your next turn.",
//     image: "/game/shop/perks/roll-exact.jpg",
//     rarity: "legendary",
//   },
//   {
//     tokenId: BigInt(2000000006),
//     name: "Tax Refund (Tier 3)",
//     description: "Instantly receive 50 in-game cash from the bank.",
//     image: "/game/shop/perks/tax-refund.jpg",
//     rarity: "common",
//   },
// ];

// // Rarity styling
// const rarityStyles = {
//   common: "border-[#4ADE80]/50 bg-[#4ADE80]/5 text-[#4ADE80]",
//   rare: "border-[#3B82F6]/50 bg-[#3B82F6]/5 text-[#3B82F6]",
//   epic: "border-[#A855F7]/50 bg-[#A855F7]/5 text-[#A855F7]",
//   legendary: "border-[#FBBF24]/50 bg-[#FBBF24]/5 text-[#FBBF24]",
// };

// const rarityIcons = {
//   common: <Gem className="w-4 h-4" />,
//   rare: <Sparkles className="w-4 h-4" />,
//   epic: <Zap className="w-4 h-4" />,
//   legendary: <Crown className="w-4 h-4" />,
// };

// const ShopCard: React.FC<{ item: ShopItem }> = ({ item }) => {
//   const { address } = useAccount();
//   const { data: info, isLoading: loadingInfo } = useRewardCollectibleInfo(item.tokenId);
//   const { buy, isPending } = useRewardBuyCollectible();
//   const [selectedCurrency, setSelectedCurrency] = useState<"tyc" | "usdc">("tyc");

//   const hasTyc = info && info.tycPrice > 0n;
//   const hasUsdc = info && info.usdcPrice > 0n;
//   const inStock = info && info.shopStock > 0n;
//   const canBuy = address && inStock && (hasTyc || hasUsdc);

//   const handleBuy = async () => {
//     if (!address) {
//       toast.error("Please connect your wallet first!");
//       return;
//     }

//     if (!info) return;

//     const currency = selectedCurrency === "usdc" ? true : false;
//     const price = currency ? Number(info.usdcPrice) / 1e6 : Number(info.tycPrice) / 1e18;
//     const symbol = currency ? "USDC" : "TYC";

//     toast.loading(`Purchasing ${item.name} for ${price.toFixed(4)} ${symbol}...`, { toastId: item.tokenId.toString() });

//     try {
//       await buy(item.tokenId, currency);
//       toast.update(item.tokenId.toString(), {
//         render: `${item.name} purchased successfully!`,
//         type: "success",
//         isLoading: false,
//         autoClose: 5000,
//       });
//     } catch (err: any) {
//       toast.update(item.tokenId.toString(), {
//         render: `Failed: ${err.shortMessage || err.message}`,
//         type: "error",
//         isLoading: false,
//         autoClose: 7000,
//       });
//     }
//   };

//   return (
//     <div className={`relative overflow-hidden rounded-2xl border-2 ${rarityStyles[item.rarity]} bg-gradient-to-br from-[#0a1214]/90 to-[#0e1a1f] p-6 shadow-2xl transition-all hover:scale-105 hover:shadow-[#00F0FF]/20`}>
//       {/* Rarity Badge */}
//       <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/50 backdrop-blur px-3 py-1 rounded-full text-sm font-bold">
//         {rarityIcons[item.rarity]}
//         <span className="capitalize">{item.rarity}</span>
//       </div>

//       {/* Image */}
//       <div className="relative mb-6 overflow-hidden rounded-xl">
//         <Image
//           src={item.image}
//           alt={item.name}
//           width={400}
//           height={400}
//           className="w-full aspect-square object-cover transition-transform duration-700 hover:scale-110"
//         />
//         <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
//       </div>

//       {/* Content */}
//       <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-[#00F0FF] to-[#0FF0FC] bg-clip-text text-transparent">
//         {item.name}
//       </h3>
//       <p className="text-[#A0D8EF] mb-6 text-sm leading-relaxed">{item.description}</p>

//       {/* Stock & Strength */}
//       {loadingInfo ? (
//         <div className="space-y-2">
//           <div className="h-4 bg-gray-700 rounded animate-pulse" />
//           <div className="h-4 w-20 bg-gray-700 rounded animate-pulse" />
//         </div>
//       ) : info ? (
//         <>
//           <div className="flex justify-between text-sm mb-4">
//             <span className="text-[#455A64]">Stock</span>
//             <span className={inStock ? "text-green-400 font-bold" : "text-red-400"}>
//               {inStock ? `${info.shopStock.toString()} left` : "Sold Out"}
//             </span>
//           </div>
//           {info.strength > 0n && (
//             <div className="flex justify-between text-sm mb-4">
//               <span className="text-[#455A64]">Tier</span>
//               <span className="text-[#FBBF24] font-bold">{info.strength.toString()}</span>
//             </div>
//           )}
//         </>
//       ) : null}

//       {/* Pricing */}
//       {info && (hasTyc || hasUsdc) && (
//         <div className="mb-6 space-y-3">
//           {hasTyc && (
//             <div className="flex justify-between items-center">
//               <span className="text-[#F7931E]">TYC Price</span>
//               <span className="text-xl font-bold text-[#F7931E]">
//                 {(Number(info.tycPrice) / 1e18).toFixed(2)} TYC
//               </span>
//             </div>
//           )}
//           {hasUsdc && (
//             <div className="flex justify-between items-center">
//               <span className="text-[#4ADE80]">USDC Price</span>
//               <span className="text-xl font-bold text-[#4ADE80]">
//                 {(Number(info.usdcPrice) / 1e6).toFixed(2)} USDC
//               </span>
//             </div>
//           )}
//         </div>
//       )}

//       {/* Buy Buttons */}
//       {canBuy && (hasTyc || hasUsdc) ? (
//         <div className="space-y-3">
//           {hasTyc && hasUsdc && (
//             <div className="flex gap-2 mb-3">
//               <button
//                 onClick={() => setSelectedCurrency("tyc")}
//                 className={`flex-1 py-2 rounded-lg font-medium transition-all ${
//                   selectedCurrency === "tyc"
//                     ? "bg-[#F7931E] text-black"
//                     : "bg-gray-700 text-gray-300"
//                 }`}
//               >
//                 Pay with TYC
//               </button>
//               <button
//                 onClick={() => setSelectedCurrency("usdc")}
//                 className={`flex-1 py-2 rounded-lg font-medium transition-all ${
//                   selectedCurrency === "usdc"
//                     ? "bg-[#4ADE80] text-black"
//                     : "bg-gray-700 text-gray-300"
//                 }`}
//               >
//                 Pay with USDC
//               </button>
//             </div>
//           )}
//           <button
//             onClick={handleBuy}
//             disabled={isPending || loadingInfo}
//             className="w-full h-12 bg-gradient-to-r from-[#00F0FF] to-[#0FF0FC] text-black font-bold rounded-xl hover:from-[#0FF0FC] hover:to-[#00F0FF] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg shadow-[#00F0FF]/30"
//           >
//             {isPending || loadingInfo ? (
//               <>
//                 <Coins className="w-5 h-5 animate-spin" />
//                 Processing...
//               </>
//             ) : (
//               <>
//                 <ShoppingBag className="w-5 h-5" />
//                 Buy Now
//               </>
//             )}
//           </button>
//         </div>
//       ) : (
//         <div className="text-center py-6">
//           <p className="text-gray-500 text-lg font-medium">
//             {address ? (inStock ? "Not Available" : "Sold Out") : "Connect Wallet to Buy"}
//           </p>
//         </div>
//       )}
//     </div>
//   );
// };

// const GameShop: React.FC = () => {
//   const router = useRouter();
//   const { address, isConnected } = useAccount();

//   return (
//     <section className="min-h-screen bg-gradient-to-b from-[#010F10] via-[#0a1214] to-[#0e1a1f] text-[#F0F7F7]">
//       {/* Hero Header */}
//       <div className="relative overflow-hidden bg-gradient-to-r from-[#003B3E]/50 to-[#00F0FF]/20 py-20">
//         <div className="absolute inset-0 bg-grid-white/5 bg-grid-16"></div>
//         <div className="relative max-w-7xl mx-auto px-6 text-center">
//           <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-[#00F0FF] via-[#0FF0FC] to-[#00F0FF] bg-clip-text text-transparent animate-gradient">
//             <ShoppingBag className="inline mr-4 w-16 h-16" />
//             Tycoon Collectibles Shop
//           </h1>
//           <p className="text-xl md:text-2xl text-[#A0D8EF] max-w-4xl mx-auto">
//             Acquire powerful perks and dominate the board. Limited stock — act fast!
//           </p>
//         </div>
//       </div>

//       <div className="max-w-7xl mx-auto px-6 py-12">
//         {/* Back Button */}
//         <button
//           onClick={() => router.push("/")}
//           className="flex items-center gap-2 text-[#00F0FF] hover:text-[#0FF0FC] mb-8 text-lg font-medium transition-colors"
//         >
//           <ArrowLeft className="w-5 h-5" />
//           Back to Dashboard
//         </button>

//         {/* Shop Grid */}
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
//           {shopItems.map((item) => (
//             <ShopCard key={item.tokenId.toString()} item={item} />
//           ))}
//         </div>

//         {/* Empty State */}
//         {shopItems.length === 0 && (
//           <div className="text-center py-20">
//             <Shield className="w-24 h-24 mx-auto text-[#00F0FF]/30 mb-6" />
//             <p className="text-2xl text-[#455A64]">The shop is preparing legendary items...</p>
//             <p className="text-lg text-[#A0D8EF] mt-4">Check back soon!</p>
//           </div>
//         )}

//         {/* Wallet Prompt */}
//         {!isConnected && (
//           <div className="mt-20 text-center p-10 bg-gradient-to-r from-[#003B3E]/30 to-[#00F0FF]/10 rounded-3xl border border-[#00F0FF]/20">
//             <p className="text-2xl font-bold mb-4">Ready to conquer the board?</p>
//             <p className="text-[#A0D8EF] text-lg">Connect your wallet to unlock exclusive collectibles.</p>
//           </div>
//         )}
//       </div>
//     </section>
//   );
// };

// export default GameShop;