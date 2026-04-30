"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import { Loader2 } from "lucide-react";

type AlertsPayload = {
  generatedAt: string;
  flaggedPlayers: {
    openCount: number;
    items: {
      id: number;
      targetUserId: number | null;
      targetUsername: string | null;
      category: string;
      detailsPreview: string | null;
      createdAt: string;
    }[];
  };
  suspiciousWallets: {
    attachFailedTotal: number;
    items: {
      id: number;
      refereeUserId: number;
      refereeUsername: string | null;
      refereeAddress: string | null;
      failureReason: string | null;
      codeNormalized: string | null;
      createdAt: string;
    }[];
  };
  gameErrors: {
    errorEventTotal: number;
    items: {
      id: number;
      entityType: string | null;
      entityId: number | null;
      payloadPreview: string | null;
      createdAt: string;
    }[];
  };
};

function shortAddr(a: string | null) {
  if (!a) return "—";
  if (a.length < 14) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function AdminDashboardAlerts() {
  const [data, setData] = useState<AlertsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: body } = await adminApi.get<{ success: boolean; data?: AlertsPayload }>("admin/alerts");
        if (cancelled) return;
        if (!body?.success || !body.data) {
          setError("Bad response");
          return;
        }
        setData(body.data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load alerts");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
        <Loader2 className="w-4 h-4 animate-spin text-cyan-500" aria-hidden />
        Loading alerts…
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-red-400/90">{error}</p>;
  }

  if (!data) return null;

  const { flaggedPlayers, suspiciousWallets, gameErrors } = data;

  return (
    <div className="space-y-5 text-sm">
      <section>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-slate-400 font-medium">Flagged players</p>
          <Link href="/admin/moderation" className="text-xs text-cyan-400 hover:underline shrink-0">
            Queue ({flaggedPlayers.openCount})
          </Link>
        </div>
        {flaggedPlayers.items.length === 0 ? (
          <p className="text-xs text-slate-600">No open moderation reports.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {flaggedPlayers.items.map((r) => (
              <li key={r.id} className="border border-slate-800/80 rounded-lg p-2 bg-slate-950/40">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-300 truncate">
                    {r.targetUserId != null ? (
                      <Link href={`/admin/players/${r.targetUserId}`} className="text-cyan-400 hover:underline">
                        {r.targetUsername ?? `User #${r.targetUserId}`}
                      </Link>
                    ) : (
                      <span className="text-slate-500">No target user</span>
                    )}
                  </span>
                  <span className="text-slate-600 shrink-0 tabular-nums">{String(r.createdAt).slice(0, 10)}</span>
                </div>
                <p className="text-slate-500 mt-0.5">{r.category}</p>
                {r.detailsPreview && <p className="text-slate-600 mt-1 line-clamp-2">{r.detailsPreview}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-slate-400 font-medium">Referral attach failures</p>
          <Link href="/admin/referrals" className="text-xs text-cyan-400 hover:underline shrink-0">
            Referrals
          </Link>
        </div>
        {suspiciousWallets.attachFailedTotal === 0 && suspiciousWallets.items.length === 0 ? (
          <p className="text-xs text-slate-600">No failed attach events logged.</p>
        ) : (
          <>
            <p className="text-xs text-slate-600 mb-2">
              Total failed attaches: <span className="text-slate-400 tabular-nums">{suspiciousWallets.attachFailedTotal}</span>
            </p>
            <ul className="space-y-2 text-xs">
              {suspiciousWallets.items.map((r) => (
                <li key={r.id} className="border border-slate-800/80 rounded-lg p-2 bg-slate-950/40">
                  <div className="flex justify-between gap-2">
                    <Link href={`/admin/players/${r.refereeUserId}`} className="text-cyan-400 hover:underline truncate">
                      {r.refereeUsername ?? `User #${r.refereeUserId}`}
                    </Link>
                    <span className="text-slate-600 shrink-0 font-mono">{shortAddr(r.refereeAddress)}</span>
                  </div>
                  <p className="text-amber-200/80 mt-1">{r.failureReason ?? "unknown"}</p>
                  {r.codeNormalized && <p className="text-slate-600 mt-0.5 font-mono">code {r.codeNormalized}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-slate-400 font-medium">Game / client errors</p>
          <Link href="/admin/analytics" className="text-xs text-cyan-400 hover:underline shrink-0">
            Analytics
          </Link>
        </div>
        {gameErrors.errorEventTotal === 0 && gameErrors.items.length === 0 ? (
          <p className="text-xs text-slate-600">No analytics error events (or table absent).</p>
        ) : (
          <>
            <p className="text-xs text-slate-600 mb-2">
              Total error events: <span className="text-slate-400 tabular-nums">{gameErrors.errorEventTotal}</span>
            </p>
            <ul className="space-y-2 text-xs">
              {gameErrors.items.map((r) => (
                <li key={r.id} className="border border-slate-800/80 rounded-lg p-2 bg-slate-950/40">
                  <p className="text-slate-500">
                    {r.entityType ?? "—"}
                    {r.entityId != null ? ` #${r.entityId}` : ""}
                  </p>
                  {r.payloadPreview && <p className="text-slate-600 mt-1 line-clamp-3 font-mono">{r.payloadPreview}</p>}
                  <p className="text-slate-600 mt-1 tabular-nums">{String(r.createdAt)}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <p className="text-[10px] text-slate-600 pt-1 border-t border-slate-800/60">
        Updated{" "}
        {new Date(data.generatedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
      </p>
    </div>
  );
}
