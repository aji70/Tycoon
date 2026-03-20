'use client';

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useChainId, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useBalance } from "wagmi";
import { formatUnits, type Address, type Abi, erc20Abi } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Image from "next/image";

import {
  Zap, Crown, Coins, Sparkles, Gem, Shield, ShoppingBag, Loader2, X, Wallet, Clock, Flame, Percent, CircleDollarSign, MapPin
} from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { useFocusTrap } from "@/hooks/useFocusTrap";

import RewardABI from "@/context/abi/rewardabi.json";
import { REWARD_CONTRACT_ADDRESSES, USDC_TOKEN_ADDRESS } from "@/constants/contracts";
import { Game, GameProperty } from "@/types/game";
import { useRewardBurnCollectible } from "@/context/ContractProvider";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";
import {
  buildTokenOfOwnerByIndexSlotCalls,
  REWARD_OWNED_SLOT_SCAN_CAP,
  takeTokenIdsUntilFirstFailure,
} from "@/lib/rewardOwnedEnumerable";

const COLLECTIBLE_ID_START = 2_000_000_000;

const BOARD_POSITIONS = [
  "GO", "Axone Avenue", "Community Chest", "Onlydust Avenue", "Income Tax",
  "IPFS Railroad", "ZK-Sync Lane", "Chance", "Starknet Lane", "Linea Lane",
  "Jail / Just Visiting", "Arbitrum Avenue", "Chainlink Electric Company", "Optimistic Avenue", "Base Avenue",
  "Pinata Railroad", "Near Lane", "Community Chest", "Cosmos Lane", "Polkadot Lane",
  "Free Parking", "Dune Lane", "Chance", "Uniswap Avenue", "MakerDAO Avenue",
  "O. Zeppelin Railroad", "AAVE Avenue", "Lisk Lane", "Graphic Water Works", "Rootstock Lane",
  "Go To Jail", "The Buidl Hub", "Ark Lane", "Community Chest", "Avalanche Avenue",
  "Cartridge Railroad", "Chance", "Solana Avenue", "Luxury Tax", "Ethereum Avenue"
];

const CASH_TIERS = [0, 100, 250, 500, 700, 1000];
const REFUND_TIERS = [0, 60, 150, 300, 420, 600];
const DISCOUNT_TIERS = [0, 100, 200, 300, 400, 500];

interface CollectibleInventoryBarProps {
  game: Game;
  game_properties: GameProperty[];
  isMyTurn: boolean;
  ROLL_DICE?: () => void;
  END_TURN: () => void;
  triggerSpecialLanding?: (position: number, isSpecial: boolean) => void;
  endTurnAfterSpecial?: () => void;
}

const perkMetadata: Record<number, {
  name: string;
  icon: React.ReactNode;
  gradient: string;
  image?: string;
  canBeActivated: boolean;
  fakeDescription?: string;
}> = {
  1: { name: "Extra Turn", icon: <Zap className="w-6 h-6" />, gradient: "from-yellow-500 to-amber-600", image: "/game/shop/a.jpeg", canBeActivated: true, fakeDescription: "Use on your turn to take an extra roll after this one." },
  2: { name: "Jail Free Card", icon: <Crown className="w-6 h-6" />, gradient: "from-purple-600 to-pink-600", image: "/game/shop/b.jpeg", canBeActivated: true, fakeDescription: "Use when in Jail to get out without paying or rolling doubles." },
  3: { name: "Double Rent", icon: <Coins className="w-6 h-6" />, gradient: "from-green-600 to-emerald-600", image: "/game/shop/c.jpeg", canBeActivated: true, fakeDescription: "When someone lands on your property, charge double the normal rent once." },
  4: { name: "Roll Boost", icon: <Sparkles className="w-6 h-6" />, gradient: "from-blue-600 to-cyan-600", image: "/game/shop/a.jpeg", canBeActivated: true, fakeDescription: "Add +1 to your next dice roll (capped at 12)." },
  5: { name: "Instant Cash", icon: <Gem className="w-6 h-6" />, gradient: "from-cyan-600 to-teal-600", image: "/game/shop/b.jpeg", canBeActivated: true, fakeDescription: "Burn to receive TYC based on tier (100–1000)." },
  6: { name: "Teleport", icon: <Zap className="w-6 h-6" />, gradient: "from-pink-600 to-rose-600", image: "/game/shop/c.jpeg", canBeActivated: true, fakeDescription: "Move your token to any property on the board." },
  7: { name: "Shield", icon: <Shield className="w-6 h-6" />, gradient: "from-indigo-600 to-blue-600", image: "/game/shop/a.jpeg", canBeActivated: true, fakeDescription: "Block the next rent or fee you would pay (one use)." },
  8: { name: "Property Discount", icon: <Coins className="w-6 h-6" />, gradient: "from-orange-600 to-red-600", image: "/game/shop/b.jpeg", canBeActivated: true, fakeDescription: "Get 30–50% off the next property you buy (tiered)." },
  9: { name: "Tax Refund", icon: <Gem className="w-6 h-6" />, gradient: "from-teal-600 to-cyan-600", image: "/game/shop/c.jpeg", canBeActivated: true, fakeDescription: "Receive TYC back when you pay Income or Luxury Tax (tiered)." },
  10: { name: "Exact Roll", icon: <Sparkles className="w-6 h-6" />, gradient: "from-amber-600 to-yellow-500", image: "/game/shop/a.jpeg", canBeActivated: true, fakeDescription: "Choose your next roll (2–12) instead of rolling the dice." },
  11: { name: "Rent Cashback", icon: <Percent className="w-6 h-6" />, gradient: "from-emerald-600 to-green-600", image: "/game/shop/a.jpeg", canBeActivated: true, fakeDescription: "Next rent you receive is +25% extra." },
  12: { name: "Interest", icon: <CircleDollarSign className="w-6 h-6" />, gradient: "from-lime-600 to-green-600", image: "/game/shop/b.jpeg", canBeActivated: true, fakeDescription: "At the start of your next turn, receive $200." },
  13: { name: "Lucky 7", icon: <Sparkles className="w-6 h-6" />, gradient: "from-yellow-500 to-amber-500", image: "/game/shop/c.jpeg", canBeActivated: true, fakeDescription: "Your next roll will be 7." },
  14: { name: "Free Parking Bonus", icon: <MapPin className="w-6 h-6" />, gradient: "from-sky-600 to-blue-600", image: "/game/shop/a.jpeg", canBeActivated: true, fakeDescription: "Land on Free Parking to collect $500." },
};

export default function CollectibleInventoryBar({
  game,
  game_properties,
  isMyTurn,
  ROLL_DICE,
  triggerSpecialLanding,
}: CollectibleInventoryBarProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES] as Address | undefined;

  const usdcToken = USDC_TOKEN_ADDRESS[chainId as keyof typeof USDC_TOKEN_ADDRESS] as Address | undefined;

  const [showMiniShop, setShowMiniShop] = useState(false);
  const useUsdc = true;
  const [buyingId, setBuyingId] = useState<bigint | null>(null);
  const miniShopModalRef = useRef<HTMLDivElement>(null);
  const buyPerksTriggerRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(miniShopModalRef, showMiniShop, buyPerksTriggerRef);
  const [approvingId, setApprovingId] = useState<bigint | null>(null);

  const [pendingPerk, setPendingPerk] = useState<{
    tokenId: bigint;
    perkId: number;
    name: string;
    strength?: number;
  } | null>(null);

  const [selectedPositionIndex, setSelectedPositionIndex] = useState<number | null>(null);
  const [selectedRollTotal, setSelectedRollTotal] = useState<number | null>(null);

  const selectedToken = usdcToken;
  const selectedDecimals = 6;

  const { writeContract: writeBuy, data: buyHash, isPending: buyingPending } = useWriteContract();
  const { writeContract: writeApprove, data: approveHash, isPending: approving } = useWriteContract();

  const { isLoading: confirmingBuy } = useWaitForTransactionReceipt({ hash: buyHash });
  const { isLoading: confirmingApprove, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });

  const { data: usdcBal } = useBalance({ address, token: usdcToken });

  const { data: allowance } = useReadContract({
    address: selectedToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && contractAddress ? [address, contractAddress] : undefined,
    query: { enabled: !!address && !!contractAddress && !!selectedToken },
  });

  const currentAllowance = allowance ?? 0;

  const { burn: burnCollectible, isPending: isBurning, isSuccess: burnSuccess } = useRewardBurnCollectible();

  const currentPlayer = useMemo(() => {
    if (!address || !game?.players) return null;
    return game.players.find(p => p.address?.toLowerCase() === address.toLowerCase()) || null;
  }, [address, game?.players]);

  const getRealPlayerId = (walletAddress: string | undefined): number | null => {
    if (!walletAddress) return null;
    const owned = game_properties.find(gp => gp.address?.toLowerCase() === walletAddress.toLowerCase());
    return owned?.player_id ?? null;
  };

  const applyCashAdjustment = async (playerId: number, amount: number): Promise<boolean> => {
    if (amount === 0) return true;
    const targetPlayer = game.players.find(p => p.user_id === playerId);
    if (!targetPlayer?.address) return false;
    const realPlayerId = getRealPlayerId(targetPlayer.address);
    if (!realPlayerId) {
      toast.error("Must own a property");
      return false;
    }
    try {
      const res = await apiClient.put<ApiResponse>(`/game-players/${realPlayerId}`, {
        game_id: game.id,
        user_id: targetPlayer.user_id,
        balance: (targetPlayer.balance ?? 0) + amount,
      });
      return res?.success ?? false;
    } catch {
      toast.error("Cash adjustment failed");
      return false;
    }
  };

  const applyPositionChange = async (playerId: number, newPos: number): Promise<boolean> => {
    if (newPos < 0 || newPos > 39) return false;
    const targetPlayer = game.players.find(p => p.user_id === playerId);
    if (!targetPlayer?.address) return false;
    const realPlayerId = getRealPlayerId(targetPlayer.address);
    if (!realPlayerId) return false;
    try {
      const res = await apiClient.put<ApiResponse>(`/game-players/${realPlayerId}`, {
        game_id: game.id,
        user_id: playerId,
        position: newPos,
      });
      return res?.success ?? false;
    } catch {
      toast.error("Position change failed");
      return false;
    }
  };

  const escapeJail = async (playerId: number): Promise<boolean> => {
    const targetPlayer = game.players.find(p => p.user_id === playerId);
    if (!targetPlayer?.address) return false;
    const realPlayerId = getRealPlayerId(targetPlayer.address);
    if (!realPlayerId) return false;
    try {
      const res = await apiClient.put<ApiResponse>(`/game-players/${realPlayerId}`, {
        game_id: game.id,
        user_id: playerId,
        in_jail: false,
      });
      return res?.success ?? false;
    } catch {
      toast.error("Failed to escape jail");
      return false;
    }
  };

  // === OWNED COLLECTIBLES === (slot-scan: see rewardOwnedEnumerable.ts)
  const ownedTokenCalls = useMemo(() => {
    if (!contractAddress || !address) return [];
    return buildTokenOfOwnerByIndexSlotCalls(contractAddress, RewardABI as Abi, address, chainId, REWARD_OWNED_SLOT_SCAN_CAP);
  }, [contractAddress, address, chainId]);

  const { data: ownedTokenResults } = useReadContracts({
    contracts: ownedTokenCalls,
    query: { enabled: !!contractAddress && !!address },
  });

  const ownedTokenIds = useMemo(() => {
    const scanned = takeTokenIdsUntilFirstFailure(ownedTokenResults);
    return scanned.filter((id) => id >= COLLECTIBLE_ID_START);
  }, [ownedTokenResults]);

  const infoCalls = useMemo(() => ownedTokenIds.map(id => ({
    address: contractAddress!,
    abi: RewardABI as Abi,
    functionName: "getCollectibleInfo" as const,
    args: [id],
  })), [contractAddress, ownedTokenIds]);

  const { data: infoResults } = useReadContracts({
    contracts: infoCalls,
    query: { enabled: ownedTokenIds.length > 0 },
  });

  const ownedCollectibles = useMemo(() => {
    if (!infoResults) return [];

    return infoResults
      .map((res, i) => {
        if (res?.status !== "success") return null;
        const [perkBig, strengthBig] = res.result as [bigint, bigint];
        const perk = Number(perkBig);
        const strength = Number(strengthBig);
        const meta = perkMetadata[perk] ?? perkMetadata[10];

        const displayName = (perk === 5 || perk === 8 || perk === 9)
          ? `${meta.name} (Tier ${strength})`
          : meta.name;

        return {
          tokenId: ownedTokenIds[i],
          perk,
          name: displayName,
          icon: meta.icon,
          gradient: meta.gradient,
          canBeActivated: meta.canBeActivated,
          fakeDescription: meta.fakeDescription,
          strength,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }, [infoResults, ownedTokenIds]);

  const totalOwned = ownedCollectibles.length;

  // === SHOP ITEMS === (contract holds stock; same slot-scan as player inventory)
  const shopTokenCalls = useMemo(() => {
    if (!contractAddress) return [];
    return buildTokenOfOwnerByIndexSlotCalls(contractAddress, RewardABI as Abi, contractAddress, chainId, REWARD_OWNED_SLOT_SCAN_CAP);
  }, [contractAddress, chainId]);

  const { data: shopTokenResults } = useReadContracts({
    contracts: shopTokenCalls,
    query: { enabled: !!contractAddress },
  });

  const shopTokenIds = useMemo(() => {
    const scanned = takeTokenIdsUntilFirstFailure(shopTokenResults);
    return scanned.filter((id) => id >= COLLECTIBLE_ID_START);
  }, [shopTokenResults]);

  const shopInfoCalls = useMemo(() => shopTokenIds.map(id => ({
    address: contractAddress!,
    abi: RewardABI as Abi,
    functionName: "getCollectibleInfo" as const,
    args: [id],
  })), [contractAddress, shopTokenIds]);

  const { data: shopInfoResults } = useReadContracts({
    contracts: shopInfoCalls,
    query: { enabled: shopTokenIds.length > 0 },
  });

  const shopItems = useMemo(() => {
    if (!shopInfoResults) return [];

    return shopInfoResults
      .map((res, i) => {
        if (res?.status !== "success") return null;
        const [perkBig, , tycPriceBig, usdcPriceBig, stockBig] = res.result as [bigint, bigint, bigint, bigint, bigint];
        const perk = Number(perkBig);
        const stock = Number(stockBig);
        if (stock === 0) return null;

        const meta = perkMetadata[perk] ?? perkMetadata[10];

        return {
          tokenId: shopTokenIds[i],
          perk,
          tycPrice: formatUnits(tycPriceBig, 18),
          usdcPrice: formatUnits(usdcPriceBig, 6),
          stock,
          name: meta.name,
          icon: meta.icon,
          gradient: meta.gradient,
          image: meta.image,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [shopInfoResults, shopTokenIds]);

  // === BUY & APPROVE LOGIC ===
  const handleBuy = async (item: typeof shopItems[number]) => {
    if (!contractAddress || !address) {
      toast.error("Wallet not connected");
      return;
    }

    const priceStr = useUsdc ? item.usdcPrice : item.tycPrice;
    const priceBig = BigInt(Math.round(parseFloat(priceStr) * 10 ** selectedDecimals));

    if (currentAllowance < priceBig) {
      setApprovingId(item.tokenId);
      toast.loading("Approving USDC...", { id: "approve" });
      writeApprove({
        address: selectedToken!,
        abi: erc20Abi,
        functionName: "approve",
        args: [contractAddress, priceBig],
      });
      return;
    }

    setBuyingId(item.tokenId);
    toast.loading("Purchasing...", { id: "buy" });
    writeBuy({
      address: contractAddress,
      abi: RewardABI,
      functionName: "buyCollectible",
      args: [item.tokenId, useUsdc],
    });
  };

  useEffect(() => {
    if (approveSuccess && approvingId !== null) {
      toast.dismiss("approve");
      toast.success("Approved! Completing purchase...");
      const item = shopItems.find(i => i.tokenId === approvingId);
      if (item) handleBuy(item);
      setApprovingId(null);
    }
  }, [approveSuccess, approvingId, shopItems]);

  useEffect(() => {
    if (buyHash && !buyingPending && !confirmingBuy) {
      toast.success("Purchase complete! 🎉");
      setBuyingId(null);
    }
  }, [buyHash, buyingPending, confirmingBuy]);

  // === PERK ACTIVATION ===
  const handleUsePerk = (
    tokenId: bigint,
    perkId: number,
    name: string,
    canBeActivated: boolean,
    strength: number = 1
  ) => {
    if (!isMyTurn) {
      toast("Wait for your turn!", { icon: "⏳" });
      return;
    }

    if (!currentPlayer) {
      toast.error("Player data not found");
      return;
    }

    if (!canBeActivated) {
      toast(`${name} — ${perkMetadata[perkId]?.fakeDescription || "Use during a game for its effect."}`, {
        icon: <Clock className="w-5 h-5" />,
        duration: 5000
      });
      return;
    }

    // Open unified burn confirmation modal for all perks
    setPendingPerk({ tokenId, perkId, name, strength });
  };

  // Apply effect after successful burn
  useEffect(() => {
    if (!pendingPerk || !burnSuccess || !currentPlayer) return;

    const { perkId, name, strength = 1 } = pendingPerk;

    const toastId = toast.loading("Applying perk effect...");

    (async () => {
      try {
        let success = false;

        switch (perkId) {
          case 1: // Extra Turn
            if (ROLL_DICE) {
              toast.success("Extra Turn activated! Roll again!", { id: toastId });
              setTimeout(() => ROLL_DICE(), 800);
              success = true;
            }
            break;
          case 2: // Jail Free Card — unified perk API
            try {
              const res = await apiClient.post<{ success?: boolean }>("/perks/use-jail-free", {
                game_id: game.id,
                from_collectible: true,
              });
              success = res?.data?.success ?? false;
              if (success) toast.success("Escaped jail! 🚔➡️🛤️", { id: toastId });
            } catch {
              toast.error("Failed to use Jail Free", { id: toastId });
            }
            break;
          case 5: // Instant Cash — unified perk API (backend applies tier amount)
            try {
              const amount = CASH_TIERS[Math.min(strength, CASH_TIERS.length - 1)];
              const res = await apiClient.post<{ success?: boolean; reward?: number }>("/perks/burn-cash", {
                game_id: game.id,
                from_collectible: true,
                amount,
              });
              success = res?.data?.success ?? false;
              const reward = res?.data?.reward ?? amount;
              if (success) toast.success(`+$${reward} Instant Cash!`, { id: toastId });
            } catch {
              toast.error("Failed to use Instant Cash", { id: toastId });
            }
            break;
          case 8: // Property Discount — unified perk API
            try {
              const discount = DISCOUNT_TIERS[Math.min(strength, DISCOUNT_TIERS.length - 1)];
              const res = await apiClient.post<{ success?: boolean }>("/perks/apply-cash", {
                game_id: game.id,
                perk_id: 8,
                amount: discount,
                from_collectible: true,
              });
              success = res?.data?.success ?? false;
              if (success && discount > 0) toast.success(`+$${discount} Property Discount!`, { id: toastId });
            } catch {
              toast.error("Failed to use Property Discount", { id: toastId });
            }
            break;
          case 9: // Tax Refund — unified perk API
            try {
              const refund = REFUND_TIERS[Math.min(strength, REFUND_TIERS.length - 1)];
              const res = await apiClient.post<{ success?: boolean }>("/perks/apply-cash", {
                game_id: game.id,
                perk_id: 9,
                amount: refund,
                from_collectible: true,
              });
              success = res?.data?.success ?? false;
              if (success) toast.success(`+$${refund} Tax Refund!`, { id: toastId });
            } catch {
              toast.error("Failed to use Tax Refund", { id: toastId });
            }
            break;
          case 3: // Double Rent
          case 4: // Roll Boost
          case 7: // Shield
          case 11: // Rent Cashback
          case 12: // Interest
          case 13: // Lucky 7
          case 14: // Free Parking Bonus
            try {
              const res = await apiClient.post<{ success?: boolean }>("/perks/activate", {
                game_id: game.id,
                perk_id: perkId,
              });
              success = res?.data?.success ?? res?.success ?? false;
              if (success) toast.success(perkId === 13 ? "Lucky 7! Next roll will be 7." : `${name} activated!`, { id: toastId });
            } catch {
              toast.error("Failed to activate perk", { id: toastId });
            }
            break;
          case 6: // Teleport — unified perk API
            if (selectedPositionIndex !== null) {
              try {
                const res = await apiClient.post<{ success?: boolean; data?: { new_position?: number } }>("/perks/teleport", {
                  game_id: game.id,
                  target_position: selectedPositionIndex,
                  from_collectible: true,
                });
                success = res?.data?.success ?? false;
                if (success) {
                  if (triggerSpecialLanding) triggerSpecialLanding(selectedPositionIndex, true);
                  toast.success(`${name} activated! Moved!`, { id: toastId });
                }
              } catch {
                toast.error("Teleport failed", { id: toastId });
              }
            }
            break;
          case 10: // Exact Roll — unified perk API
            if (selectedRollTotal != null && selectedRollTotal >= 2 && selectedRollTotal <= 12) {
              try {
                const res = await apiClient.post<{ success?: boolean }>("/perks/exact-roll", {
                  game_id: game.id,
                  chosen_total: selectedRollTotal,
                  from_collectible: true,
                });
                success = res?.data?.success ?? false;
                if (success) toast.success(`Next roll will be ${selectedRollTotal}!`, { id: toastId });
              } catch {
                toast.error("Exact Roll failed", { id: toastId });
              }
            }
            break;
        }

        if (success || perkId === 1) {
          toast.success(`${name} activated & collectible burned! 🔥`, { id: toastId });
        } else {
          toast.error("Effect failed — contact support", { id: toastId });
        }
      } catch (err) {
        toast.error("Activation failed", { id: toastId });
      } finally {
        setPendingPerk(null);
        setSelectedPositionIndex(null);
        setSelectedRollTotal(null);
      }
    })();
  }, [burnSuccess, pendingPerk, currentPlayer, ROLL_DICE, triggerSpecialLanding, selectedRollTotal, selectedPositionIndex]);

  const handleConfirmBurnAndActivate = async () => {
    if (!pendingPerk) return;

    const toastId = toast.loading("Burning collectible... 🔥");

    try {
      await burnCollectible(pendingPerk.tokenId);
      // Effect will be applied automatically via useEffect on burnSuccess
    } catch (err) {
      toast.error("Burn failed — perk not activated", { id: toastId });
      setPendingPerk(null);
      setSelectedPositionIndex(null);
      setSelectedRollTotal(null);
    }
  };

  if (!isConnected) return null;

  return (
    <>
      {/* Inventory Bar */}
      <div className="fixed bottom-6 left-6 z-50 pointer-events-auto">
        <div className="bg-black/90 backdrop-blur-xl rounded-2xl border border-cyan-500/40 p-5 shadow-2xl max-h-[70vh] overflow-y-auto w-72">
          <div className="flex items-center justify-between mb-4">
            <p className="text-cyan-300 text-sm font-bold uppercase tracking-wider">
              Your Perks ({totalOwned})
            </p>
            <div className="flex flex-col items-end gap-1">
              <button
                ref={buyPerksTriggerRef}
                onClick={() => setShowMiniShop(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-lg text-black text-xs font-bold hover:shadow-lg hover:shadow-cyan-500/50 transition"
                aria-haspopup="dialog"
                aria-expanded={showMiniShop}
              >
                <ShoppingBag className="w-4 h-4" /> Buy perks
              </button>
              <span className="text-[10px] text-slate-500">Without leaving the game</span>
            </div>
          </div>

          {totalOwned === 0 && (
            <p className="text-slate-400 text-xs mb-2">Buy perks below to use during this game.</p>
          )}

          <div className="space-y-3">
            {ownedCollectibles.map((item) => (
              <button
                key={item.tokenId.toString()}
                onClick={() => handleUsePerk(item.tokenId, item.perk, item.name, item.canBeActivated, item.strength)}
                disabled={!isMyTurn || !item.canBeActivated}
                className={`w-full relative rounded-xl overflow-hidden transition-all ${
                  isMyTurn && item.canBeActivated ? "hover:scale-105 cursor-pointer" : "opacity-60 cursor-not-allowed"
                }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-90`} />
                <div className="relative p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-white">{item.icon}</div>
                    <div>
                      <p className="text-white text-base font-bold">{item.name}</p>
                      {!item.canBeActivated && (
                        <p className="text-xs text-gray-300 mt-1">{item.fakeDescription || "Use during a game for its effect."}</p>
                      )}
                    </div>
                  </div>
                </div>
                {!isMyTurn && (
                  <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                    <p className="text-sm text-gray-300">Wait for turn</p>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mini Shop Modal */}
      <AnimatePresence>
        {showMiniShop && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMiniShop(false)}
              className="fixed inset-0 bg-black/70 z-50"
            />
            <motion.div
              ref={miniShopModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="quick-perk-shop-title"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-x-4 top-20 bottom-20 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-4xl z-50 bg-[#0A1C1E] rounded-3xl border border-cyan-500/50 overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-cyan-900/50 flex justify-between items-center">
                <h2 id="quick-perk-shop-title" className="text-3xl font-bold flex items-center gap-3">
                  <ShoppingBag className="w-10 h-10 text-[#00F0FF]" />
                  Perk Shop
                </h2>
                <button onClick={() => setShowMiniShop(false)} className="text-gray-400 hover:text-white" aria-label="Close Perk Shop">
                  <X className="w-8 h-8" />
                </button>
              </div>

              <div className="p-6 flex items-center justify-between mb-6">
                <div className="flex gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-[#00F0FF]" />
                    <span>USDC: {usdcBal ? Number(usdcBal.formatted).toFixed(2) : "0.00"}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 px-6 pb-8 overflow-y-auto max-h-full">
                {shopItems.length === 0 ? (
                  <div className="col-span-full">
                    <EmptyState
                      icon={<ShoppingBag className="w-14 h-14 text-cyan-500/70" />}
                      title="No perks in stock right now"
                      description="New perks are added regularly. Check back later or use your existing perks from My Perks."
                      compact
                      className="border-cyan-500/20 bg-[#0E1415]/60"
                    />
                  </div>
                ) : (
                  shopItems.map((item) => (
                    <motion.div
                      key={item.tokenId.toString()}
                      whileHover={{ scale: 1.05 }}
                      className="bg-gradient-to-br from-[#0E1415] to-[#0A1C1E] rounded-2xl border border-cyan-900/50 overflow-hidden"
                    >
                      <div className="relative h-40 min-h-[10rem] overflow-hidden">
                        <Image
                          src={item.image || "/game/shop/placeholder.jpg"}
                          alt={item.name}
                          fill
                          sizes="(max-width: 768px) 100vw, 50vw"
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <div className="absolute bottom-4 left-4 flex items-center gap-2">
                          <div className="text-white">{item.icon}</div>
                          <span className="text-white font-bold">{item.name}</span>
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-xs text-gray-400 mb-2">Stock: {item.stock}</p>
                        <p className="text-lg text-cyan-300 mb-4 font-medium">${item.usdcPrice}</p>
                        <button
                          onClick={() => handleBuy(item)}
                          disabled={item.stock === 0 || buyingId === item.tokenId || approvingId === item.tokenId}
                          className="w-full py-3 rounded-lg bg-gradient-to-r from-[#00F0FF] to-cyan-400 text-black font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                          {buyingId === item.tokenId || approvingId === item.tokenId ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            "Buy Now"
                          )}
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Burn Confirmation & Special Perk Selection Modal */}
      <AnimatePresence>
        {pendingPerk && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-50"
              onClick={() => {
                setPendingPerk(null);
                setSelectedPositionIndex(null);
                setSelectedRollTotal(null);
              }}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0A1C1E] rounded-3xl border border-red-500/50 p-8 z-50 w-[540px] shadow-2xl"
            >
              <div className="text-center mb-8">
                <Flame className="w-16 h-16 text-red-500 mx-auto mb-4 animate-pulse" />
                <h2 className="text-3xl font-bold text-white mb-2">Burn Collectible?</h2>
                <p className="text-2xl text-cyan-300 font-semibold">{pendingPerk.name}</p>
                <p className="text-red-400 mt-6 text-lg leading-relaxed">
                  This action is <span className="font-bold underline">IRREVERSIBLE</span>.<br />
                  Your collectible will be <span className="font-bold">permanently burned</span> to activate this perk.
                </p>
              </div>

              {/* Selection for Teleport or Exact Roll */}
              {(pendingPerk.perkId === 6 || pendingPerk.perkId === 10) && (
                <div className="mb-8">
                  <p className="text-center text-white mb-5 text-lg font-medium">
                    {pendingPerk.perkId === 6 ? "Select destination:" : "Select exact roll total:"}
                  </p>

                  {pendingPerk.perkId === 6 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-2">
                      {BOARD_POSITIONS.map((name, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedPositionIndex(index)}
                          className={`py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                            selectedPositionIndex === index
                              ? "bg-cyan-600 text-black shadow-lg shadow-cyan-500/50"
                              : "bg-gray-800 hover:bg-gray-700 text-gray-200"
                          }`}
                        >
                          {index}. {name}
                        </button>
                      ))}
                    </div>
                  )}

                  {pendingPerk.perkId === 10 && (
                    <div className="grid grid-cols-4 md:grid-cols-6 gap-4">
                      {[2,3,4,5,6,7,8,9,10,11,12].map((total) => (
                        <button
                          key={total}
                          onClick={() => setSelectedRollTotal(total)}
                          className={`py-6 rounded-xl text-2xl font-bold transition-all ${
                            selectedRollTotal === total
                              ? "bg-cyan-600 text-black shadow-lg shadow-cyan-500/50"
                              : "bg-gray-800 hover:bg-gray-700 text-gray-200"
                          }`}
                        >
                          {total}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => {
                    setPendingPerk(null);
                    setSelectedPositionIndex(null);
                    setSelectedRollTotal(null);
                  }}
                  className="flex-1 py-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold text-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmBurnAndActivate}
                  disabled={
                    isBurning ||
                    (pendingPerk.perkId === 6 && selectedPositionIndex === null) ||
                    (pendingPerk.perkId === 10 && selectedRollTotal === null)
                  }
                  className="flex-1 py-4 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition shadow-lg"
                >
                  {isBurning ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Burning...
                    </>
                  ) : (
                    <>
                      <Flame className="w-6 h-6" />
                      Burn & Activate
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}