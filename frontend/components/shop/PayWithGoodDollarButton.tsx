'use client';

import { useEffect, useState } from 'react';
import { useBalance, usePublicClient, useChainId } from 'wagmi';
import { Coins, Loader2 } from 'lucide-react';
import type { Abi, Address } from 'viem';
import { toast } from 'react-toastify';
import Erc20Abi from '@/context/abi/ERC20abi.json';
import { useWriteContract } from '@/hooks/useTaggedWriteContract';
import { apiClient, ApiError } from '@/lib/api';
import { isMiniPayEmbeddedWallet } from '@/lib/minipayGuestFlow';
import {
  GOODDOLLAR_SYMBOL,
  formatGoodDollarWhole,
  getGoodDollarTokenAddress,
  getGoodDollarTreasury,
  usdToGoodDollarWei,
} from '@/lib/shop/goodDollarPayment';

type Props = {
  tokenId?: bigint;
  bundleId?: number;
  usdPrice: number;
  payerAddress?: Address;
  disabled?: boolean;
  compact?: boolean;
  onConnectWallet?: () => void;
  onSuccess?: () => void;
};

export default function PayWithGoodDollarButton({
  tokenId,
  bundleId,
  usdPrice,
  payerAddress,
  disabled,
  compact,
  onConnectWallet,
  onSuccess,
}: Props) {
  const walletChainId = useChainId();
  const chainId = walletChainId && getGoodDollarTokenAddress(walletChainId) ? walletChainId : 42220;
  const tokenAddress = getGoodDollarTokenAddress(chainId);
  const treasury = getGoodDollarTreasury(chainId);
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);
  const [isMiniPay, setIsMiniPay] = useState(false);
  useEffect(() => {
    setIsMiniPay(isMiniPayEmbeddedWallet());
  }, []);

  const { data: gdBalanceData, refetch: refetchGd } = useBalance({
    address: payerAddress,
    token: tokenAddress,
    query: { enabled: !!payerAddress && !!tokenAddress },
  });
  const balanceWei = gdBalanceData?.value ?? 0n;

  const requiredWei = usdToGoodDollarWei(usdPrice);
  const configReady = Boolean(tokenAddress && treasury);
  if (!configReady) return null;
  if (isMiniPay) return null;

  const connected = Boolean(payerAddress);
  const insufficient = connected && balanceWei < requiredWei;

  const sizeClasses = compact
    ? 'py-2 text-xs mt-2'
    : 'py-2.5 text-sm mt-2';

  async function handleClick() {
    if (!connected) {
      onConnectWallet?.();
      return;
    }
    if (!payerAddress || !tokenAddress || !treasury) return;
    if (requiredWei <= 0n) {
      toast.error('Unable to compute G$ price');
      return;
    }
    if (balanceWei < requiredWei) {
      toast.error(`Need ${formatGoodDollarWhole(requiredWei)} ${GOODDOLLAR_SYMBOL}`);
      return;
    }
    if (!publicClient) {
      toast.error('Network client not ready. Try again.');
      return;
    }
    setBusy(true);
    try {
      const txHash = await writeContractAsync({
        address: tokenAddress,
        abi: Erc20Abi as Abi,
        functionName: 'transfer',
        args: [treasury, requiredWei],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status === 'reverted') throw new Error('G$ transfer reverted');

      const body: Record<string, unknown> = {
        tx_hash: txHash,
        address: payerAddress,
        chain: 'CELO',
      };
      if (tokenId) body.token_id = tokenId.toString();
      else if (bundleId) body.bundle_id = bundleId;

      const res = await apiClient.post<{
        success?: boolean;
        message?: string;
        data?: { status?: string; delivery_tx_hash?: string };
      }>('shop/gooddollar/claim', body, { timeout: 90000 });
      const status = res?.data?.data?.status;
      if (status === 'completed') {
        toast.success(`Paid with ${GOODDOLLAR_SYMBOL} — perk delivered.`);
      } else {
        toast.info(`Payment received — delivery pending (${status ?? 'processing'})`);
      }
      void refetchGd();
      onSuccess?.();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'G$ payment failed';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || busy || (connected && insufficient)}
      className={`w-full ${sizeClasses} rounded-xl font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1415] inline-flex items-center justify-center gap-1.5
        ${busy
          ? 'bg-emerald-700/80 text-white'
          : disabled
            ? 'bg-slate-800/60 text-slate-500'
            : connected && insufficient
              ? 'bg-slate-700/70 text-slate-400'
              : 'bg-gradient-to-r from-emerald-500/90 to-teal-500/90 text-black border border-emerald-300/40 hover:brightness-110 active:brightness-110'}`}
    >
      {busy ? (
        <>
          <Loader2 className="animate-spin" size={14} />
          Paying…
        </>
      ) : !connected ? (
        <>
          <Coins size={14} />
          Pay with {GOODDOLLAR_SYMBOL}
        </>
      ) : insufficient ? (
        `Need ${formatGoodDollarWhole(requiredWei)} ${GOODDOLLAR_SYMBOL}`
      ) : (
        <>
          <Coins size={14} />
          Pay with {GOODDOLLAR_SYMBOL} — {formatGoodDollarWhole(requiredWei)}
        </>
      )}
    </button>
  );
}
