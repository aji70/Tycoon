"use client";

import { useCallback, useState } from "react";
import { useAccount, useChainId, usePublicClient, useSwitchChain } from "wagmi";
import { celo } from "wagmi/chains";
import { erc20Abi, parseUnits, type Address } from "viem";
import { toast } from "react-hot-toast";
import { useWriteContract } from "@/hooks/useTaggedWriteContract";
import { apiClient } from "@/lib/api";
import { USDC_TOKEN_ADDRESS } from "@/constants/contracts";

/** Celo native USDC (bridged) — fallback when NEXT_PUBLIC_CELO_USDC is unset. */
const CELO_USDC_FALLBACK = "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as Address;

export type TipPackOffer = {
  tips: number;
  usdc: string;
  recipient: string | null;
  available?: boolean;
};

export const DEFAULT_TIP_PACK_OFFER: TipPackOffer = {
  tips: 5,
  usdc: "0.05",
  recipient:
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_TIP_PACK_USDC_RECIPIENT ||
        process.env.NEXT_PUBLIC_HOSTED_AGENT_CREDITS_USDC_RECIPIENT)) ||
    null,
  available: true,
};

/** Merge API tipPack with defaults so the buy button always has label + amounts. */
export function resolveTipPackOffer(pack?: TipPackOffer | null): TipPackOffer {
  return {
    tips: pack?.tips ?? DEFAULT_TIP_PACK_OFFER.tips,
    usdc: pack?.usdc ?? DEFAULT_TIP_PACK_OFFER.usdc,
    recipient: pack?.recipient || DEFAULT_TIP_PACK_OFFER.recipient,
    available: true,
  };
}

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
  const publicClient = usePublicClient({ chainId: celo.id });
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);

  const label = `Get ${offer.tips} for $${offer.usdc}`;

  const handleBuy = useCallback(async () => {
    if (!isConnected || !address) {
      toast.error("Connect your wallet to buy tips");
      return;
    }

    setBusy(true);
    try {
      let recipient = offer.recipient;
      if (!recipient) {
        try {
          const creditsRes = await apiClient.get<{
            success?: boolean;
            data?: { usdc_recipient?: string | null };
          }>("/agents/hosted-credits");
          recipient = creditsRes.data?.data?.usdc_recipient || null;
        } catch {
          /* ignore — handled below */
        }
      }
      if (!recipient) {
        toast.error("Tip pack payments are not configured yet");
        return;
      }

      const usdc =
        USDC_TOKEN_ADDRESS[celo.id] ||
        USDC_TOKEN_ADDRESS[chainId] ||
        CELO_USDC_FALLBACK;

      if (chainId !== celo.id) {
        await switchChainAsync?.({ chainId: celo.id });
      }
      const amount = parseUnits(offer.usdc, 6);
      const hash = await writeContractAsync({
        address: usdc as Address,
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipient as Address, amount],
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
