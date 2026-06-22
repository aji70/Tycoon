'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CHAIN_DECIMALS, SupportedChains, type WalletClaimStatus } from '@goodsdks/citizen-sdk';
import { formatUnits } from 'viem';
import { Loader2, ShieldCheck, Coins } from 'lucide-react';
import { useSwitchChain } from 'wagmi';
import { celo } from 'wagmi/chains';
import toast from 'react-hot-toast';
import { useGoodDollarClaim } from '@/hooks/useGoodDollarClaim';
import { GD_CELO_CHAIN_ID } from '@/lib/gooddollar/constants';
import { dispatchGoodDollarUpdated } from '@/lib/gooddollar/events';

function formatGdAmount(amount: bigint): string {
  const decimals = CHAIN_DECIMALS[SupportedChains.CELO] ?? 18;
  const formatted = formatUnits(amount, decimals);
  const n = Number(formatted);
  if (!Number.isFinite(n)) return formatted;
  return n >= 1 ? n.toFixed(2) : n.toFixed(4);
}

type GoodDollarClaimProps = {
  className?: string;
};

export function GoodDollarClaim({ className = '' }: GoodDollarClaimProps) {
  const { isConnected, onCelo, sdksReady, refreshStatus, startVerification, claim } = useGoodDollarClaim();
  const { switchChain, isPending: switchingChain } = useSwitchChain();

  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [status, setStatus] = useState<WalletClaimStatus | null>(null);

  const loadStatus = useCallback(async () => {
    if (!sdksReady) {
      setStatus(null);
      return;
    }
    setLoading(true);
    try {
      const next = await refreshStatus();
      setStatus(next);
      if (next?.status !== 'not_whitelisted') {
        dispatchGoodDollarUpdated();
      }
    } catch (err) {
      console.error('GoodDollar status:', err);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [sdksReady, refreshStatus]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const onFocus = () => {
      void loadStatus();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadStatus]);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await startVerification();
    } catch (err) {
      toast.error((err as Error)?.message || 'Could not open verification');
      setVerifying(false);
    }
  };

  const handleClaim = async () => {
    if (!status || status.status !== 'can_claim') return;
    setClaiming(true);
    try {
      await claim();
      toast.success(`Claimed ${formatGdAmount(status.entitlement)} G$!`);
      await loadStatus();
      dispatchGoodDollarUpdated();
    } catch (err) {
      const msg = (err as Error)?.message || 'Claim failed';
      if (/whitelist|verif/i.test(msg)) {
        toast.error('Complete face verification first, then try again.');
      } else {
        toast.error(msg);
      }
    } finally {
      setClaiming(false);
    }
  };

  if (!isConnected) {
    return (
      <div className={`rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-5 ${className}`}>
        <div className="flex items-center gap-3 mb-2">
          <div className="rounded-lg bg-emerald-500/15 p-2 border border-emerald-400/25">
            <Coins className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">GoodDollar (G$)</h3>
            <p className="text-slate-400 text-xs">Daily universal basic income on Celo</p>
          </div>
        </div>
        <p className="text-slate-500 text-xs">Connect your wallet to verify and claim G$ inside Tycoon.</p>
      </div>
    );
  }

  if (!onCelo) {
    return (
      <div className={`rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-5 ${className}`}>
        <h3 className="font-bold text-white text-sm mb-2">GoodDollar (G$)</h3>
        <p className="text-slate-400 text-xs mb-3">Switch to Celo mainnet to claim G$ from Tycoon.</p>
        <button
          type="button"
          disabled={switchingChain}
          onClick={() => switchChain({ chainId: celo.id })}
          className="w-full py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/35 text-emerald-100 text-sm font-semibold hover:bg-emerald-500/30 disabled:opacity-60"
        >
          {switchingChain ? 'Switching…' : 'Switch to Celo'}
        </button>
      </div>
    );
  }

  if (loading && !status) {
    return (
      <div className={`rounded-xl border border-emerald-500/20 bg-emerald-950/15 p-4 flex items-center gap-3 ${className}`}>
        <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
        <span className="text-slate-400 text-sm">Loading GoodDollar…</span>
      </div>
    );
  }

  const verified = status?.status !== 'not_whitelisted';
  const canClaim = status?.status === 'can_claim' && status.entitlement > 0n;

  return (
    <div className={`rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/35 to-teal-950/20 p-5 ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="rounded-lg bg-emerald-500/20 p-2 border border-emerald-400/30">
          <Coins className="w-6 h-6 text-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-white">GoodDollar daily claim</h3>
          <p className="text-slate-400 text-sm flex items-center gap-1.5 flex-wrap">
            {verified ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Verified citizen</span>
              </>
            ) : (
              <span>Verify once to claim G$ on Celo</span>
            )}
          </p>
        </div>
      </div>

      {status && status.entitlement > 0n && (
        <p className="text-emerald-200/90 text-sm mb-3">
          Available today: <strong>{formatGdAmount(status.entitlement)} G$</strong>
        </p>
      )}

      {!verified ? (
        <>
          <p className="text-slate-400 text-sm mb-4">
            Complete GoodDollar face verification, then return here to claim your daily G$ without leaving Tycoon.
          </p>
          <button
            type="button"
            onClick={() => void handleVerify()}
            disabled={verifying || !sdksReady}
            className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:from-emerald-400 hover:to-teal-400 disabled:opacity-60"
          >
            {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
            Verify &amp; claim G$
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => void handleClaim()}
          disabled={!canClaim || claiming}
          className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
            canClaim && !claiming
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:from-emerald-400 hover:to-teal-400'
              : 'bg-slate-800/80 text-slate-500 cursor-not-allowed'
          }`}
        >
          {claiming ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : canClaim ? (
            'Claim G$ now'
          ) : status?.nextClaimTime ? (
            `Next claim ${status.nextClaimTime.toLocaleString()}`
          ) : (
            'Already claimed today'
          )}
        </button>
      )}

      <p className="text-[10px] text-slate-500 mt-3 text-center">
        Powered by GoodDollar on Celo · chain {GD_CELO_CHAIN_ID}
      </p>
    </div>
  );
}
