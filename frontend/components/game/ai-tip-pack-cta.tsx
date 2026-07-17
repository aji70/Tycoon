"use client";

import { useCallback, useState } from "react";
import { useAccount, useChainId, usePublicClient, useSwitchChain } from "wagmi";
import { celo } from "wagmi/chains";
import { erc20Abi, parseUnits, type Address } from "viem";
import { toast } from "react-hot-toast";
import { useWriteContract } from "@/hooks/useTaggedWriteContract";
import { apiClient } from "@/lib/api";
import { USDC_TOKEN_ADDRESS } from "@/constants/contracts";

export type TipPackOffer = {
  tips: number;
  usdc: string;
  recipient: string | null;
  available: boolean;
};

type Props = {
  gameId: number;
  offer: TipPackOffer;
  onPurchased: () => void;
  className?: string;
};

/**
 * In-buy-prompt CTA: send $0.05 USDC for +5 AI tips, then verify with backend.
 */
export function AiTipPackCta({ gameId, offer, onPurchased, className }: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);

  const label = `Get ${offer.tips} for $${offer.usdc}`;

  const handleBuy = useCallback(async () => {
    if (!offer.available || !offer.recipient) {
      toast.error("Tip packs not available right now");
      return;
    }
    if (!isConnected || !address) {
      toast.error("Connect your wallet to buy tips");
      return;
    }
    const usdc = USDC_TOKEN_ADDRESS[chainId] ?? USDC_TOKEN_ADDRESS[celo.id];
    if (!usdc) {
      toast.error("USDC not configured");
      return;
    }

    setBusy(true);
    try {
      if (chainId !== celo.id) {
        await switchChainAsync?.({ chainId: celo.id });
      }
      const amount = parseUnits(offer.usdc, 6);
      const hash = await writeContractAsync({
        address: (USDC_TOKEN_ADDRESS[celo.id] ?? usdc) as Address,
        abi: erc20Abi,
        functionName: "transfer",
        args: [offer.recipient as Address, amount],
        chainId: celo.id,
      });
      toast.loading("Confirming payment…", { id: "tip-pack" });
      if (publicClient && hash) {
        await publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      }
      const res = await apiClient.post<{
        success?: boolean;
        tips_granted?: number;
        already_credited?: boolean;
        message?: string;
      }>("/agent-registry/tips/purchase", {
        gameId,
        tx_hash: hash,
      });
      if (res.data?.already_credited) {
        toast.success("Tips already added for this payment", { id: "tip-pack" });
      } else {
        toast.success(`Added ${res.data?.tips_granted ?? offer.tips} tips!`, { id: "tip-pack" });
      }
      onPurchased();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; shortMessage?: string; message?: string })
          ?.response?.data?.message ??
        (err as { shortMessage?: string })?.shortMessage ??
        (err as { message?: string })?.message ??
        "Purchase failed";
      toast.error(msg, { id: "tip-pack" });
    } finally {
      setBusy(false);
    }
  }, [
    address,
    chainId,
    gameId,
    isConnected,
    offer,
    onPurchased,
    publicClient,
    switchChainAsync,
    writeContractAsync,
  ]);

  if (!offer.available) return null;

  return (
    <button
      type="button"
      onClick={handleBuy}
      disabled={busy}
      className={
        className ??
        "mt-2 w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-semibold"
      }
    >
      {busy ? "Buying…" : label}
    </button>
  );
}
