'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, Gift, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface DailyClaimStatus {
  can_claim: boolean;
  streak: number;
  last_claim_at: string | null;
}

export function DailyClaim() {
  const [status, setStatus] = useState<DailyClaimStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const fetchStatus = () => {
    setLoading(true);
    apiClient
      .get<{ success?: boolean; can_claim?: boolean; streak?: number; last_claim_at?: string | null }>('rewards/daily-claim/status')
      .then((r) => {
        if (r?.data) {
          setStatus({
            can_claim: r.data.can_claim ?? true,
            streak: r.data.streak ?? 0,
            last_claim_at: r.data.last_claim_at ?? null,
          });
        }
      })
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleClaim = () => {
    if (!status?.can_claim || claiming) return;
    setClaiming(true);
    apiClient
      .post<{ success?: boolean; already_claimed?: boolean; message?: string; streak?: number; reward_tyc?: number | null }>('rewards/daily-claim', {})
      .then((r) => {
        if (r?.data?.success) {
          if (r.data.already_claimed) {
            toast.success('Already claimed today. See you tomorrow!');
          } else {
            const msg = r.data.reward_tyc != null
              ? `Day ${r.data.streak}! You received ${r.data.reward_tyc} TYC.`
              : (r.data.message || `Day ${r.data.streak}!`);
            toast.success(msg);
          }
          fetchStatus();
        }
      })
      .catch((err: { message?: string }) => {
        toast.error(err?.message || 'Claim failed. Try again later.');
      })
      .finally(() => setClaiming(false));
  };

  if (loading && !status) {
    return (
      <div className="rounded-xl border border-[#003B3E]/60 bg-[#0E1415]/50 p-4 flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-[#00F0FF]" />
        <span className="text-slate-400 text-sm">Loading daily reward…</span>
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
