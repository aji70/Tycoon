"use client";
import React, { useState } from "react";
import { useAccount } from "wagmi";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ShoppingBag, CreditCard, Coins } from "lucide-react";
import { usePlayerContract } from "@/context/ContractProvider"; // Assuming a mint hook could be added here; placeholder for now

// Types for NFT item
interface NFTItem {
  id: number;
  name: string;
  description: string;
  image: string;
  price: string;
  type: string;
}

// Reusable NFT Card Component
interface NFTCardProps {
  item: NFTItem;
  onMint: (id: number) => void;
  loading: boolean;
}

const NFTCard: React.FC<NFTCardProps> = ({ item, onMint, loading }) => {
  return (
    <div className="bg-[#0E1415] rounded-lg p-6 border border-[#003B3E] hover:border-[#00F0FF] transition-all duration-300 shadow-lg">
      <div className="relative mb-4">
        <Image
          src={item.image}
          alt={item.name}
          width={200}
          height={200}
          className="w-full aspect-square object-cover rounded-md"
        />
        <div className="absolute top-2 right-2 bg-[#00F0FF]/20 text-[#00F0FF] px-2 py-1 rounded text-sm font-medium">
          {item.type.toUpperCase()}
        </div>
      </div>
      <h3 className="text-xl font-dmSans font-semibold mb-2">{item.name}</h3>
      <p className="text-[#455A64] mb-4 text-sm">{item.description}</p>
      <div className="flex justify-between items-center mb-4">
        <span className="text-[#00F0FF] font-bold text-lg">{item.price}</span>
        <CreditCard className="w-5 h-5 text-[#0FF0FC]" />
      </div>
      <button
        onClick={() => onMint(item.id)}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 h-12 bg-gradient-to-r from-[#003B3E] to-[#00F0FF] text-[#010F10] font-semibold rounded-md hover:from-[#00F0FF] hover:to-[#0FF0FC] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Coins className="w-4 h-4 animate-spin" />
            Minting...
          </>
        ) : (
          <>
            <Coins className="w-4 h-4" />
            Mint Now
          </>
        )}
      </button>
    </div>
  );
};

// Placeholder NFT items for Monopoly-themed Tycoon game - Edit names, descriptions, prices, types as needed
// a.jpg, b.jpg, c.jpg rendered on top
const nftItems: NFTItem[] = [
  // Images a.jpg, b.jpg, c.jpg from public (rendered first)
  {
    id: 1,
    name: "Lucky Roll",
    description: "Exclusive mystery NFT – discover its tycoon powers!",
    image: "/game/shop/a.jpeg",
    price: "0.06 ETH",
    type: "upgrade",
  },
  {
    id: 2,
    name: "Tax Refund",
    description: "Premium token for advanced players seeking edge.",
    image: "/game/shop/b.jpeg",
    price: "0.035 ETH",
    type: "token",
  },
  {
    id: 3,
    name: "Extra Roll",
    description: "Rare card pack for massive in-game fortune boosts.",
    image: "/game/shop/c.jpeg",
    price: "0.045 ETH",
    type: "card",
  },
  
];

const GameShop: React.FC = () => {
  const router = useRouter();
  const { address } = useAccount();
  const { /* Add mintNFT hook here if available */ } = usePlayerContract(); // Placeholder
  const [loading, setLoading] = useState<{ [key: number]: boolean }>({});

  const handleMintNFT = async (itemId: number) => {
    if (!address) {
      toast.error("Please connect your wallet to mint NFTs.", {
        position: "top-right",
        autoClose: 5000,
      });
      return;
    }

    setLoading((prev) => ({ ...prev, [itemId]: true }));

    const item = nftItems.find((i) => i.id === itemId);
    const toastId = toast.loading(`Minting ${item?.name}...`, {
      position: "top-right",
    });

    try {
      // Placeholder for actual mint transaction
      // await mintNFT(itemId, item?.price);
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate delay

      toast.update(toastId, {
        render: "NFT minted successfully! Check your wallet.",
        type: "success",
        isLoading: false,
        autoClose: 3000,
      });
    } catch (error) {
      console.error("Mint error:", error);
      toast.update(toastId, {
        render: "Failed to mint NFT. Please try again.",
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    } finally {
      setLoading((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const handleBackToHero = () => router.push("/"); // Assuming hero is at root

  return (
    <section className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] text-[#F0F7F7] py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-orbitron font-bold uppercase tracking-wide">
            <ShoppingBag className="inline mr-2 w-8 h-8" />
            Tycoon Shop
          </h1>
          <button
            onClick={handleBackToHero}
            className="flex items-center gap-2 text-[#00F0FF] hover:text-[#0FF0FC] transition-colors"
          >
            Back to Home
          </button>
        </div>

        <p className="text-lg mb-8 text-center text-[#455A64]">
          Mint NFTs to enhance your tycoon empire. Properties, tokens, and upgrades await!
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {nftItems.map((item) => (
            <NFTCard
              key={item.id}
              item={item}
              onMint={handleMintNFT}
              loading={loading[item.id]}
            />
          ))}
        </div>

        {!address && (
          <div className="text-center mt-12 p-8 bg-[#0E1415]/50 rounded-lg">
            <p className="text-[#455A64] mb-4">Connect your wallet to start minting NFTs and building your empire!</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default GameShop;