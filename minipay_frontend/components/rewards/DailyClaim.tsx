'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Gift, Loader2 } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { apiClient, ApiError } from '@/lib/api';
import { useBackendSession } from '@/context/GuestAuthContext';
import toast from 'react-hot-toast';

interface DailyClaimStatus {
  can_claim: boolean;
  streak: number;
  last_claim_at: string | null;
}

type SupportedChain = 'CELO' | 'POLYGON' | 'BASE';

type DailyClaimProps = {
  chain?: SupportedChain;
  /** When this changes (e.g. guest id or connected wallet), status is refetched so UI matches the current session. */
  accountKey?: string | number | null;
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

export function DailyClaim({ chain, accountKey }: DailyClaimProps) {
  const { guestUser, authLoading, isBackendAuthed, refetchGuest } = useBackendSession();
  const { ready: privyReady, authenticated: privyAuthed } = usePrivy();

  const [status, setStatus] = useState<DailyClaimStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const privyPendingBackend =
    privyReady && privyAuthed && !authLoading && !isBackendAuthed;

  const fetchStatus = useCallback(() => {
    if (authLoading) return;
    if (!isBackendAuthed) {
      setStatus(null);
      setNeedsAuth(!privyPendingBackend);
      setFetchError(null);
      setLoading(false);
      return;
    }
    setNeedsAuth(false);
    setLoading(true);
    setFetchError(null);
    apiClient
      .get<{ success?: boolean; can_claim?: boolean; streak?: number; last_claim_at?: string | null }>(
        'rewards/daily-claim/status',
        chain ? { chain } : undefined
      )
      .then((r) => {
        const parsed = parseStatusPayload(r);
        if (parsed) {
          setStatus(parsed);
        } else {
          setStatus(null);
          setFetchError('Could not load daily reward status.');
        }
      })
      .catch((err: unknown) => {
        setStatus(null);
        const statusCode =
          err instanceof ApiError
            ? err.status
            : (err as { response?: { status?: number } })?.response?.status;
        if (statusCode === 401) {
          setNeedsAuth(true);
          setFetchError(null);
          void refetchGuest?.();
        } else {
          setNeedsAuth(false);
          setFetchError(
            err instanceof ApiError ? err.message : 'Could not load daily reward. Try again later.'
          );
        }
      })
      .finally(() => setLoading(false));
  }, [chain, authLoading, isBackendAuthed, privyPendingBackend, refetchGuest]);

  useEffect(() => {
    if (authLoading) return;
    setStatus(null);
    fetchStatus();
  }, [chain, accountKey, guestUser?.id, authLoading, isBackendAuthed, fetchStatus]);

  useEffect(() => {
    if (!privyPendingBackend || !refetchGuest) return;
    const id = window.setInterval(() => {
      void refetchGuest();
    }, 2000);
    return () => window.clearInterval(id);
  }, [privyPendingBackend, refetchGuest]);

  const handleClaim = () => {
    if (!status?.can_claim || claiming || needsAuth || !isBackendAuthed) return;
    setClaiming(true);
    apiClient
      .post<{ success?: boolean; already_claimed?: boolean; message?: string; streak?: number; reward_tyc?: number | null }>(
        'rewards/daily-claim',
        chain ? { chain } : {}
      )
      .then((r) => {
        const body = (r?.data ?? {}) as Record<string, unknown>;
        const payload =
          body.data && typeof body.data === 'object'
            ? (body.data as Record<string, unknown>)
            : body;
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
          fetchStatus();
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof ApiError ? err.message : 'Claim failed. Try again later.';
        toast.error(msg);
      })
      .finally(() => setClaiming(false));
  };

  if (authLoading || (loading && !status && !needsAuth && !fetchError && !privyPendingBackend)) {
    return (
      <motionlessLoading label="Loading daily reward…" />
    );
  }

  if (privyPendingBackend) {
    return (
      <motionlessLoading
        label="Linking your Tycoon account…"
        sub="If Home asks for a username, complete that first, then return here."
      />
    );
  }

  if (needsAuth) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="rounded-lg bg-amber-500/20 p-2 border border-amber-400/30">
            <Gift className="w-6 h-6 text-amber-400" />
          </div>
          <motionlessHeader />
        </div>
        <p className="text-slate-500 text-xs">
          {guestUser
            ? 'Your session expired. Open Home and sign in again, then return to claim.'
            : 'Sign in with MiniPay on the home page and finish setup (username if prompted). Connecting a wallet alone does not enable daily rewards.'}
        </p>
      </div>
    );
  }

  if (fetchError && !status) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/50">
        {fetchError}
      </div>
    );
  }

  if (!status) return null;

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

function motionlessLoading({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[#003B3E]/60 bg-[#0E1415]/50 p-4 flex items-center gap-3">
      <Loader2 className="w-5 h-5 animate-spin text-[#00F0FF] shrink-0" />
      <motionlessText label={label} sub={sub} />
    </div>
  );
}

function motionlessHeader() {
  return (
    <div>
      <h3 className="font-bold text-white text-sm">Daily login reward</h3>
      <p className="text-slate-400 text-xs">Claim TYC vouchers every day.</p>
    </div>
  );
}

function motionlessText({ label, sub }: { label: string; sub?: string }) {
  return (
    <div>
      <span className="text-slate-400 text-sm block">{label}</span>
      {sub ? <span className="text-slate-500 text-xs block mt-1">{sub}</span> : null}
    </div>
  );
}
