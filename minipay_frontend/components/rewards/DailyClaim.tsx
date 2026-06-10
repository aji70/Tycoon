'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Gift, Loader2 } from 'lucide-react';
import { useAccount } from 'wagmi';
import { apiClient, ApiError } from '@/lib/api';
import { useGuestAuthOptional } from '@/context/GuestAuthContext';
import { getGuestUserPlayAddress } from '@/lib/minipayGuestFlow';
import { walletAuthParams, type WalletChain } from '@/lib/walletSession';
import toast from 'react-hot-toast';

interface DailyClaimStatus {
  can_claim: boolean;
  streak: number;
  last_claim_at: string | null;
}

type DailyClaimProps = {
  chain?: WalletChain;
  accountKey?: string | number | null;
  playAddress?: string | null;
};

function parseStatusPayload(res: { data?: unknown } | null | undefined): DailyClaimStatus | null {
  const body = res?.data as Record<string, unknown> | undefined;
  if (!body || typeof body !== 'object') return null;
  const inner =
    body.data && typeof body.data === 'object'
      ? (body.data as Record<string, unknown>)
      : body;
  if (inner.success === false && !('can_claim' in inner)) return null;
  return {
    can_claim: inner.can_claim === true,
    streak: Number(inner.streak ?? 0),
    last_claim_at: (inner.last_claim_at as string | null) ?? null,
  };
}

function hasBackendToken(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.localStorage.getItem('token')?.trim());
  } catch {
    return false;
  }
}

export function DailyClaim({ chain = 'CELO', accountKey, playAddress }: DailyClaimProps) {
  const { address, status: wagmiStatus } = useAccount();
  const guestUser = useGuestAuthOptional()?.guestUser ?? null;

  const resolvedAddress = useMemo(() => {
    const fromProp = playAddress?.trim();
    if (fromProp && /^0x[a-fA-F0-9]{40}$/i.test(fromProp)) return fromProp;
    const fromWagmi = address?.trim();
    if (fromWagmi && /^0x[a-fA-F0-9]{40}$/i.test(fromWagmi)) return fromWagmi;
    return getGuestUserPlayAddress(guestUser);
  }, [playAddress, address, guestUser?.linked_wallet_address, guestUser?.smart_wallet_address, guestUser?.address]);

  const lastAddressRef = useRef<string | null>(null);
  if (resolvedAddress) lastAddressRef.current = resolvedAddress;
  const effectiveAddress = resolvedAddress ?? lastAddressRef.current;

  const walletKey = effectiveAddress ? `${effectiveAddress.toLowerCase()}:${chain}` : '';
  const canCallApi = Boolean(effectiveAddress) || hasBackendToken();

  const [status, setStatus] = useState<DailyClaimStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const lastWalletKeyRef = useRef('');
  const hasLoadedRef = useRef(false);
  const walletConnecting = wagmiStatus === 'connecting' || wagmiStatus === 'reconnecting';

  const fetchStatus = useCallback(
    (opts?: { silent?: boolean }) => {
      if (!canCallApi) {
        setLoading(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      setFetchError(null);

      const params = walletAuthParams(effectiveAddress, chain);
      apiClient
        .get('rewards/daily-claim/status', params ?? undefined)
        .then((r) => {
          const parsed = parseStatusPayload(r);
          if (parsed) {
            setStatus(parsed);
            hasLoadedRef.current = true;
          } else if (!opts?.silent) {
            setFetchError('Could not load daily reward status.');
          }
        })
        .catch((err: unknown) => {
          const code =
            err instanceof ApiError
              ? err.status
              : (err as { response?: { status?: number } })?.response?.status;
          if (!opts?.silent || !hasLoadedRef.current) {
            setFetchError(
              code === 401
                ? 'Sign in or connect your wallet to claim daily rewards.'
                : err instanceof ApiError
                  ? err.message
                  : 'Could not load daily reward. Try again later.'
            );
          }
        })
        .finally(() => setLoading(false));
    },
    [canCallApi, effectiveAddress, chain]
  );

  useEffect(() => {
    const walletChanged = lastWalletKeyRef.current !== walletKey;
    lastWalletKeyRef.current = walletKey;

    if (!canCallApi) {
      if (!walletConnecting) {
        setStatus(null);
        setFetchError(null);
        setLoading(false);
        hasLoadedRef.current = false;
      }
      return;
    }

    if (walletChanged && walletKey) {
      setStatus(null);
      hasLoadedRef.current = false;
    }

    fetchStatus({ silent: hasLoadedRef.current });
  }, [walletKey, canCallApi, fetchStatus, walletConnecting]);

  const handleClaim = () => {
    if (!status?.can_claim || claiming || !canCallApi) return;
    setClaiming(true);
    const params = walletAuthParams(effectiveAddress, chain);
    apiClient
      .post('rewards/daily-claim', params ? { ...params } : {})
      .then((r) => {
        const raw = (r?.data ?? {}) as Record<string, unknown>;
        const payload =
          raw.data && typeof raw.data === 'object'
            ? (raw.data as Record<string, unknown>)
            : raw;
        if (payload?.success) {
          if (payload.already_claimed) {
            toast.success('Already claimed today. See you tomorrow!');
          } else {
            const msg =
              payload.reward_tyc != null
                ? `Day ${payload.streak}! You received ${payload.reward_tyc} TYC.`
                : (payload.message as string) || `Day ${payload.streak}!`;
            toast.success(msg);
          }
          fetchStatus({ silent: true });
        }
      })
      .catch((err: unknown) => {
        toast.error(err instanceof ApiError ? err.message : 'Claim failed. Try again later.');
      })
      .finally(() => setClaiming(false));
  };

  if (!canCallApi && !walletConnecting && !status) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="rounded-lg bg-amber-500/20 p-2 border border-amber-400/30">
            <Gift className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Daily login reward</h3>
            <p className="text-slate-400 text-xs">Claim TYC vouchers every day.</p>
          </div>
        </div>
        <p className="text-slate-500 text-xs">
          Connect your MiniPay wallet from the menu to claim.
        </p>
      </div>
    );
  }

  if (loading && !status) {
    return (
      <div className="rounded-xl border border-[#003B3E]/60 bg-[#0E1415]/50 p-4 flex items-center gap-3 min-h-[120px]">
        <Loader2 className="w-5 h-5 animate-spin text-[#00F0FF] shrink-0" />
        <span className="text-slate-400 text-sm">
          {walletConnecting ? 'Connecting wallet…' : 'Loading daily reward…'}
        </span>
      </div>
    );
  }

  if (fetchError && !status) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/50 min-h-[80px]">
        {fetchError}
      </div>
    );
  }

  if (!status) {
    return (
      <div className="rounded-xl border border-[#003B3E]/60 bg-[#0E1415]/50 p-4 flex items-center gap-3 min-h-[120px]">
        <Loader2 className="w-5 h-5 animate-spin text-[#00F0FF] shrink-0" />
        <span className="text-slate-400 text-sm">Loading daily reward…</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-orange-950/20 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="rounded-lg bg-amber-500/20 p-2 border border-amber-400/30">
          <Gift className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h3 className="font-bold text-white">Daily login reward</h3>
          <p className="text-slate-400 text-sm flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {status.streak} day streak
          </p>
        </div>
      </div>
      <p className="text-slate-400 text-sm mb-4">
        Log in every day to build your streak and claim TYC vouchers. Higher streaks earn bonus TYC.
      </p>
      <button
        type="button"
        onClick={handleClaim}
        disabled={!status.can_claim || claiming}
        className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
          status.can_claim && !claiming
            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400'
            : 'bg-slate-800/80 text-slate-500 cursor-not-allowed'
        }`}
      >
        {claiming ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : status.can_claim ? (
          'Claim today’s reward'
        ) : (
          'Come back tomorrow'
        )}
      </button>
    </div>
  );
}
