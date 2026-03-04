'use client';

import React, { useMemo } from "react";
import { useAccount, useChainId, useReadContract, useReadContracts } from "wagmi";
import type { Address, Abi } from "viem";
import { Zap, Crown, Coins, Sparkles, Gem, Shield, Percent, CircleDollarSign, MapPin } from "lucide-react";
import RewardABI from "@/context/abi/rewardabi.json";
import { REWARD_CONTRACT_ADDRESSES } from "@/constants/contracts";

const COLLECTIBLE_ID_START = 2_000_000_000;

const PERK_ICONS: Record<number, React.ReactNode> = {
  1: <Zap className="w-4 h-4" />,
  2: <Crown className="w-4 h-4" />,
  3: <Coins className="w-4 h-4" />,
  4: <Sparkles className="w-4 h-4" />,
  5: <Gem className="w-4 h-4" />,
  6: <Zap className="w-4 h-4" />,
  7: <Shield className="w-4 h-4" />,
  8: <Coins className="w-4 h-4" />,
  9: <Gem className="w-4 h-4" />,
  10: <Sparkles className="w-4 h-4" />,
  11: <Percent className="w-4 h-4" />,
  12: <CircleDollarSign className="w-4 h-4" />,
  13: <Sparkles className="w-4 h-4" />,
  14: <MapPin className="w-4 h-4" />,
};

const PERK_NAMES: Record<number, string> = {
  1: "Extra Turn",
  2: "Jail Free",
  3: "Double Rent",
  4: "Roll Boost",
  5: "Instant Cash",
  6: "Teleport",
  7: "Shield",
  8: "Discount",
  9: "Tax Refund",
  10: "Exact Roll",
  11: "Rent Cashback",
  12: "Interest",
  13: "Lucky 7",
  14: "Free Parking Bonus",
};

interface PerksBarProps {
  onOpenModal: () => void;
  /** When set, clicking a perk activates it (burn + apply) instead of opening the modal. */
  onUsePerk?: (tokenId: bigint, perk: number, strength: number, name: string) => void;
  className?: string;
}

export default function PerksBar({ onOpenModal, onUsePerk, className = "" }: PerksBarProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES] as Address | undefined;

  const { data: ownedCountRaw } = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: "ownedTokenCount",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contractAddress },
  });

  const ownedCount = Number(ownedCountRaw ?? 0);

  const tokenCalls = useMemo(() => {
    if (!contractAddress || !address || ownedCount <= 0) return [];
    return Array.from({ length: ownedCount }, (_, i) => ({
      address: contractAddress,
      abi: RewardABI as Abi,
      functionName: "tokenOfOwnerByIndex" as const,
      args: [address, BigInt(i)],
    }));
  }, [contractAddress, address, ownedCount]);

  const { data: tokenResults } = useReadContracts({
    contracts: tokenCalls,
    query: { enabled: ownedCount > 0 && !!contractAddress && !!address },
  });

  const ownedTokenIds =
    tokenResults
      ?.map((r) => (r.status === "success" ? (r.result as bigint) : null))
      .filter((id): id is bigint => id !== null && id >= COLLECTIBLE_ID_START) ?? [];

  const infoCalls = useMemo(() => {
    if (!contractAddress || ownedTokenIds.length === 0) return [];
    return ownedTokenIds.map((id) => ({
      address: contractAddress,
      abi: RewardABI as Abi,
      functionName: "getCollectibleInfo" as const,
      args: [id],
    }));
  }, [contractAddress, ownedTokenIds]);

  const { data: infoResults } = useReadContracts({
    contracts: infoCalls,
    query: { enabled: ownedTokenIds.length > 0 },
  });

  const perks = useMemo(() => {
    if (!infoResults || infoResults.length !== ownedTokenIds.length) return [];
    return infoResults
      .map((res, i) => {
        if (res?.status !== "success") return null;
        const tokenId = ownedTokenIds[i];
        if (tokenId == null || tokenId < COLLECTIBLE_ID_START) return null;
        const arr = res.result as [bigint, bigint?, ...unknown[]];
        const perk = Number(arr?.[0]);
        if (Number.isNaN(perk) || perk < 1 || perk > 14) return null;
        const strength = arr?.[1] != null ? Number(arr[1]) : 1;
        return { perk, tokenId, strength };
      })
      .filter((c): c is { perk: number; tokenId: bigint; strength: number } => c !== null);
  }, [infoResults, ownedTokenIds]);

  /** Group by perk type: count, and first tokenId/strength for activation */
  const perksGrouped = useMemo(() => {
    const byPerk: Record<number, { count: number; tokenId: bigint; strength: number }> = {};
    perks.forEach(({ perk, tokenId, strength }) => {
      if (!byPerk[perk]) byPerk[perk] = { count: 1, tokenId, strength };
      else byPerk[perk].count += 1;
    });
    return Object.entries(byPerk).map(([perkStr, v]) => ({
      perk: Number(perkStr),
      count: v.count,
      tokenId: v.tokenId,
      strength: v.strength,
    }));
  }, [perks]);

  if (!address || perks.length === 0) {
    return (
      <button
        type="button"
        onClick={onOpenModal}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-violet-500/40 bg-violet-950/30 text-violet-200/80 hover:bg-violet-900/40 hover:border-violet-400/50 transition-colors text-sm font-medium ${className}`}
        aria-label="View perks"
      >
        <Sparkles className="w-4 h-4" />
        <span>Perks</span>
      </button>
    );
  }

  return (
    <div
      className={`flex flex-wrap gap-1.5 ${className}`}
      role="region"
      aria-label="Perks bar"
    >
        {perksGrouped.map(({ perk, count, tokenId, strength }) => (
          <button
            key={perk}
            type="button"
            onClick={() => (onUsePerk ? onUsePerk(tokenId, perk, strength, PERK_NAMES[perk] ?? `Perk ${perk}`) : onOpenModal())}
            title={`${PERK_NAMES[perk] ?? `Perk ${perk}`}${count > 1 ? ` (×${count})` : ""}`}
            className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-violet-600/90 to-fuchsia-600/80 border border-violet-400/50 text-white hover:scale-105 hover:border-violet-300/70 active:scale-95 transition-transform shadow-md"
          >
            {PERK_ICONS[perk] ?? <Sparkles className="w-4 h-4" />}
            {count > 1 && (
              <span className="absolute -bottom-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-md bg-slate-900/95 border border-violet-400/60 text-[9px] font-bold text-violet-200 flex items-center justify-center">
                ×{count}
              </span>
            )}
          </button>
        ))}
    </div>
  );
}
