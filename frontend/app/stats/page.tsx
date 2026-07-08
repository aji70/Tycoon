"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ApiError, apiClient } from "@/lib/api";

type Period = "all" | "day" | "week" | "month";

type MostActivePlayer = {
  username: string | null;
  games: number;
};

type PublicStatsData = {
  period: Period;
  generatedAt: string;
  totals: {
    totalTransactions: number;
    totalTokenTransfers: number;
    totalGames: number;
    totalTrades: number;
    totalPlayHistoryEvents: number;
    totalPropertiesOwned: number;
  };
  engagement?: {
    totalPlayers: number;
    uniquePlayers: number;
    gamesPerPlayer: number;
    mostActivePlayer: MostActivePlayer | null;
    perkShopRevenueUsdt: number | null;
  };
};

function periodLabel(period: Period) {
  return period === "all" ? "All time" : `Last ${period}`;
}

function formatUsd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type StatCard = {
  key: string;
  label: string;
  value: string;
  sub?: ReactNode;
};

/** Ordered cards — most relevant traction stats first, technical/DB rows last. */
function buildStatCards(data: PublicStatsData): StatCard[] {
  const t = data.totals;
  const e = data.engagement;
  const cards: StatCard[] = [];

  if (e) {
    cards.push({
      key: "totalPlayers",
      label: "Total players",
      value: e.totalPlayers.toLocaleString(),
    });
  }

  cards.push({
    key: "totalGames",
    label: "Games created",
    value: t.totalGames.toLocaleString(),
  });

  if (e) {
    cards.push({
      key: "perkRevenue",
      label: "Perk shop revenue",
      value: formatUsd(e.perkShopRevenueUsdt),
      sub: "USDT balance",
    });
    cards.push({
      key: "gamesPerPlayer",
      label: "Games per player",
      value: e.gamesPerPlayer.toLocaleString(undefined, { maximumFractionDigits: 1 }),
      sub: e.mostActivePlayer ? (
        <>
          Most active:{" "}
          <span className="text-slate-300">
            {e.mostActivePlayer.username ?? "Anonymous"}
          </span>{" "}
          · {e.mostActivePlayer.games.toLocaleString()} games
        </>
      ) : undefined,
    });
  }

  cards.push({
    key: "totalTransactions",
    label: "Transactions",
    value: t.totalTransactions.toLocaleString(),
  });
  cards.push({
    key: "totalTrades",
    label: "Accepted trades",
    value: t.totalTrades.toLocaleString(),
  });
  cards.push({
    key: "totalTokenTransfers",
    label: "Token transfers",
    value: t.totalTokenTransfers.toLocaleString(),
  });
  cards.push({
    key: "totalPlayHistoryEvents",
    label: "Play history events",
    value: t.totalPlayHistoryEvents.toLocaleString(),
  });
  cards.push({
    key: "totalPropertiesOwned",
    label: "Property ownership rows",
    value: t.totalPropertiesOwned.toLocaleString(),
  });

  return cards;
}

export default function PublicStatsPage() {
  const [period, setPeriod] = useState<Period>("all");
  const [data, setData] = useState<PublicStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<{ success: boolean; data?: PublicStatsData }>(
          "public/stats",
          { period },
        );
        const body = res.data;
        if (!cancelled) {
          if (!body?.success || !body.data) {
            setError("Unexpected response");
            setData(null);
            return;
          }
          setData(body.data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load stats");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Tycoon Stats</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Public totals for on-chain contract activity and core game activity metrics.
            </p>
          </div>
          <Link
            href="/leaderboard"
            className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
          >
            View leaderboard
          </Link>
        </div>

        {loading && (
          <div className="mt-8 text-sm text-slate-400">Loading stats…</div>
        )}

        {error && !loading && (
          <div className="mt-8 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {data && !loading && (
          <>
            <p className="mt-6 text-xs text-slate-500">
              Range: {periodLabel(data.period)} · Generated {data.generatedAt}
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {buildStatCards(data).map((card) => (
                <div
                  key={card.key}
                  className="rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-4 shadow-sm"
                >
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {card.label}
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-cyan-100 tabular-nums">
                    {card.value}
                  </p>
                  {card.sub && (
                    <p className="mt-1 text-xs text-slate-500">{card.sub}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
