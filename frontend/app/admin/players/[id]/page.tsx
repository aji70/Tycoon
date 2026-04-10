"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import { ArrowLeft, Loader2 } from "lucide-react";

type Profile = Record<string, unknown> & {
  id?: number;
  username?: string;
  address?: string;
  chain?: string;
  is_guest?: boolean;
  email?: string | null;
  email_verified?: boolean;
  games_played?: number;
  game_won?: number;
  game_lost?: number;
  total_earned?: number;
  total_staked?: number;
  total_withdrawn?: number;
  created_at?: string;
  linked_wallet_address?: string | null;
  smart_wallet_address?: string | null;
  privy_did?: string | null;
};

type PropertyStats = {
  properties_bought: number;
  properties_sold: number;
  trades_initiated: number;
  trades_accepted: number;
  favourite_property: { property_id: number; count: number } | null;
};

type ReferralInfo = {
  code: string | null;
  referredByUserId: number | null;
  referredAt: string | null;
  referrerUsername: string | null;
  directReferralsCount: number;
};

type RecentGame = {
  gameId: number;
  code: string;
  status: string;
  mode: string | null;
  chain: string | null;
  isAi: boolean;
  winnerId: number | null;
  gamePlayerId?: number;
  balance: number;
  createdAt: string;
  updatedAt: string;
  won: boolean;
};

function fmt(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return v.toLocaleString();
  return String(v);
}

export default function AdminPlayerDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [propertyStats, setPropertyStats] = useState<PropertyStats | null>(null);
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [memberships, setMemberships] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id) || id < 1) {
      setError("Invalid player id");
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: body } = await adminApi.get<{
          success: boolean;
          data?: {
            profile: Profile;
            referral?: ReferralInfo | null;
            propertyStats: PropertyStats;
            activity: { gameMembershipsCount: number; recentGames: RecentGame[] };
          };
        }>(`admin/players/${id}`);
        if (cancelled) return;
        if (!body?.success || !body.data) {
          setError("Unexpected response");
          return;
        }
        setProfile(body.data.profile);
        setReferral(body.data.referral ?? null);
        setPropertyStats(body.data.propertyStats);
        setRecentGames(body.data.activity.recentGames);
        setMemberships(body.data.activity.gameMembershipsCount);
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load player";
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!Number.isFinite(id) || id < 1) {
    return (
      <div>
        <Link href="/admin/players" className="text-sm text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to players
        </Link>
        <p className="text-red-400">Invalid id</p>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/admin/players"
        className="text-sm text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to players
      </Link>

      {loading && (
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
          Loading player…
        </div>
      )}

      {error && !loading && (
        <p className="text-red-400 text-sm border border-red-900/50 bg-red-950/30 rounded-lg px-3 py-2 max-w-lg">{error}</p>
      )}

      {profile && !loading && (
        <>
          <div className="flex flex-col gap-1 mb-8">
            <h1 className="text-2xl font-semibold text-slate-100">{profile.username ?? `User #${id}`}</h1>
            <p className="text-sm text-slate-500 font-mono">User id {profile.id ?? id}</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Account</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Wallet</dt>
                  <dd className="text-slate-200 font-mono text-xs break-all text-right">{fmt(profile.address)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Chain</dt>
                  <dd className="text-slate-200">{fmt(profile.chain)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Guest</dt>
                  <dd className="text-slate-200">{fmt(profile.is_guest)}</dd>
                </div>
                {profile.email != null && String(profile.email) !== "" && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Email</dt>
                    <dd className="text-slate-200 text-xs break-all text-right">
                      {String(profile.email)}
                      {profile.email_verified ? (
                        <span className="ml-1 text-emerald-400">(verified)</span>
                      ) : (
                        <span className="ml-1 text-amber-500/90">(unverified)</span>
                      )}
                    </dd>
                  </div>
                )}
                {profile.linked_wallet_address != null && String(profile.linked_wallet_address) !== "" && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Linked wallet</dt>
                    <dd className="text-slate-200 font-mono text-xs break-all text-right">
                      {String(profile.linked_wallet_address)}
                    </dd>
                  </div>
                )}
                {profile.smart_wallet_address != null && String(profile.smart_wallet_address) !== "" && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Smart wallet</dt>
                    <dd className="text-slate-200 font-mono text-xs break-all text-right">
                      {String(profile.smart_wallet_address)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Joined</dt>
                  <dd className="text-slate-200 text-xs">{profile.created_at ? String(profile.created_at) : "—"}</dd>
                </div>
              </dl>
            </section>

            {referral && (
              <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Referrals</h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Referral code</dt>
                    <dd className="text-slate-200 font-mono text-xs">{referral.code ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Direct referrals</dt>
                    <dd className="text-slate-200 tabular-nums">{referral.directReferralsCount}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Referred by</dt>
                    <dd className="text-slate-200 text-right text-xs">
                      {referral.referredByUserId != null ? (
                        <Link href={`/admin/players/${referral.referredByUserId}`} className="text-cyan-400 hover:underline">
                          {referral.referrerUsername ?? `User #${referral.referredByUserId}`}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  {referral.referredAt && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Referred at</dt>
                      <dd className="text-slate-200 text-xs">{String(referral.referredAt)}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Gameplay & balances</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Games played (profile)</dt>
                  <dd className="text-slate-200 tabular-nums">{fmt(profile.games_played)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Wins / losses</dt>
                  <dd className="text-slate-200 tabular-nums">
                    {fmt(profile.game_won)} / {fmt(profile.game_lost)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Game memberships</dt>
                  <dd className="text-slate-200 tabular-nums">{memberships.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Total earned</dt>
                  <dd className="text-cyan-200/90 tabular-nums">
                    {Number(profile.total_earned ?? 0).toLocaleString(undefined, { maximumFractionDigits: 8 })}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Total staked</dt>
                  <dd className="text-slate-200 tabular-nums">
                    {Number(profile.total_staked ?? 0).toLocaleString(undefined, { maximumFractionDigits: 8 })}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Total withdrawn</dt>
                  <dd className="text-slate-200 tabular-nums">
                    {Number(profile.total_withdrawn ?? 0).toLocaleString(undefined, { maximumFractionDigits: 8 })}
                  </dd>
                </div>
              </dl>
            </section>

            {propertyStats && (
              <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 lg:col-span-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Property & trades</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-950/50 border border-slate-800 px-3 py-2">
                    <p className="text-slate-500 text-xs">Bought</p>
                    <p className="text-slate-100 font-semibold tabular-nums">{propertyStats.properties_bought}</p>
                  </div>
                  <div className="rounded-lg bg-slate-950/50 border border-slate-800 px-3 py-2">
                    <p className="text-slate-500 text-xs">Sold</p>
                    <p className="text-slate-100 font-semibold tabular-nums">{propertyStats.properties_sold}</p>
                  </div>
                  <div className="rounded-lg bg-slate-950/50 border border-slate-800 px-3 py-2">
                    <p className="text-slate-500 text-xs">Trades initiated</p>
                    <p className="text-slate-100 font-semibold tabular-nums">{propertyStats.trades_initiated}</p>
                  </div>
                  <div className="rounded-lg bg-slate-950/50 border border-slate-800 px-3 py-2">
                    <p className="text-slate-500 text-xs">Trades accepted</p>
                    <p className="text-slate-100 font-semibold tabular-nums">{propertyStats.trades_accepted}</p>
                  </div>
                </div>
                {propertyStats.favourite_property && (
                  <p className="mt-3 text-xs text-slate-500">
                    Favourite property id {propertyStats.favourite_property.property_id} (
                    {propertyStats.favourite_property.count} purchases)
                  </p>
                )}
              </section>
            )}

            <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 lg:col-span-2 overflow-hidden">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Recent games</h2>
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-sm text-left min-w-[640px]">
                  <thead className="text-xs uppercase text-slate-500 border-b border-slate-800">
                    <tr>
                      <th className="py-2 pr-3">Game</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Chain</th>
                      <th className="py-2 pr-3">AI</th>
                      <th className="py-2 pr-3 text-right">Balance</th>
                      <th className="py-2 pr-3">Result</th>
                      <th className="py-2">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {recentGames.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          No game rows yet.
                        </td>
                      </tr>
                    )}
                    {recentGames.map((g) => (
                      <tr key={`${g.gameId}-${g.gamePlayerId ?? ""}`} className="text-slate-300">
                        <td className="py-2 pr-3 font-mono text-xs">
                          #{g.gameId}{" "}
                          <span className="text-slate-500 block sm:inline sm:ml-1">{g.code}</span>
                        </td>
                        <td className="py-2 pr-3 text-xs">{g.status}</td>
                        <td className="py-2 pr-3 text-xs">{g.chain ?? "—"}</td>
                        <td className="py-2 pr-3 text-xs">{g.isAi ? "Yes" : "—"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{g.balance}</td>
                        <td className="py-2 pr-3 text-xs">
                          {g.won ? (
                            <span className="text-emerald-400">Won</span>
                          ) : g.winnerId != null ? (
                            <span className="text-slate-500">Lost</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-2 text-xs text-slate-500 whitespace-nowrap">
                          {g.updatedAt ? String(g.updatedAt).slice(0, 19).replace("T", " ") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
