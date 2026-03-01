'use client';

import React, { useMemo } from "react";
import { useAccount, useChainId, useReadContract, useReadContracts } from "wagmi";
import type { Address, Abi } from "viem";
import { Zap, Crown, Coins, Sparkles, Gem, Shield } from "lucide-react";
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
};

interface PerksBarProps {
  onOpenModal: () => void;
  className?: string;
}

export default function PerksBar({ onOpenModal, className = "" }: PerksBarProps) {
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

  const tokenCalls = useMemo(
    () =>
      Array.from({ length: ownedCount }, (_, i) => ({
        address: contractAddress!,
        abi: RewardABI as Abi,
        functionName: "tokenOfOwnerByIndex" as const,
        args: [address!, BigInt(i)],
      })),
    [contractAddress, address, ownedCount]
  );

  const { data: tokenResults } = useReadContracts({
    contracts: tokenCalls,
    query: { enabled: ownedCount > 0 && !!contractAddress && !!address },
  });

  const ownedTokenIds =
    tokenResults
      ?.map((r) => (r.status === "success" ? (r.result as bigint) : null))
      .filter((id): id is bigint => id !== null && id >= COLLECTIBLE_ID_START) ?? [];

  const infoCalls = useMemo(
    () =>
      ownedTokenIds.map((id) => ({
        address: contractAddress!,
        abi: RewardABI as Abi,
        functionName: "getCollectibleInfo" as const,
        args: [id],
      })),
    [contractAddress, ownedTokenIds]
  );

  const { data: infoResults } = useReadContracts({
    contracts: infoCalls,
    query: { enabled: ownedTokenIds.length > 0 },
  });

  const perks = useMemo(() => {
    if (!infoResults) return [];
    return infoResults
      .map((res, i) => {
        if (res?.status !== "success") return null;
        const [perkBig] = res.result as [bigint, bigint];
        const perk = Number(perkBig);
        return { perk, tokenId: ownedTokenIds[i] };
      })
      .filter((c): c is { perk: number; tokenId: bigint } => c !== null);
  }, [infoResults, ownedTokenIds]);

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
      className={`flex flex-col gap-2 ${className}`}
      role="region"
      aria-label="Boost bar – your perks"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-violet-200/90 uppercase tracking-wider shrink-0">
          Boost
        </span>
        <button
          type="button"
          onClick={onOpenModal}
          className="text-[10px] text-violet-400 hover:text-violet-200 underline underline-offset-1 shrink-0"
        >
          View all
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {perks.map(({ perk, tokenId }, i) => (
          <button
            key={`${tokenId}-${i}`}
            type="button"
            onClick={onOpenModal}
            title={PERK_NAMES[perk] ?? `Perk ${perk}`}
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-violet-600/90 to-fuchsia-600/80 border border-violet-400/50 text-white hover:scale-105 hover:border-violet-300/70 active:scale-95 transition-transform shadow-md"
          >
            {PERK_ICONS[perk] ?? <Sparkles className="w-4 h-4" />}
          </button>
        ))}
      </div>
    </div>
  );
}
