"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useTournament } from "@/context/TournamentContext";
import type { Tournament as TournamentType } from "@/types/tournament";
import {
  tournamentCreatePath,
  tournamentDetailPath,
} from "@/lib/tournamentRoutes";
import { Bot, ChevronLeft, ChevronRight, Loader2, Trophy, Users } from "lucide-react";

function formatEntryFee(wei: string | number): string {
  const n = Number(wei);
  if (n === 0) return "Free";
  const usd = n / 1e6;
  if (usd >= 0.01) return `$${usd.toFixed(2)} USDC`;
  if (usd > 0) return `$${usd.toFixed(4)} USDC`;
  return `${n} wei`;
}

function statusColor(status: string): string {
  switch (status) {
    case "REGISTRATION_OPEN":
      return "text-emerald-400";
    case "BRACKET_LOCKED":
    case "IN_PROGRESS":
      return "text-amber-400";
    case "COMPLETED":
      return "text-cyan-400";
    case "CANCELLED":
      return "text-red-400";
    default:
      return "text-white/70";
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function TournamentCard({ t }: { t: TournamentType }) {
  return (
    <Link
      href={tournamentDetailPath(t)}
      className="block rounded-2xl border border-[#0E282A] bg-[#011112]/80 hover:bg-[#0E282A]/60 hover:border-[#003B3E] transition-all p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-white truncate">{t.name}</h2>
          <p className={`text-sm font-medium mt-1 ${statusColor(t.status)}`}>
            {statusLabel(t.status)}
          </p>
          <div className="flex flex-wrap gap-3 mt-3 text-sm text-white/60">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {typeof t.participant_count === "number" ? `${t.participant_count} / ${t.max_players}` : `${t.max_players} max`}
            </span>
            <span className="flex items-center gap-1">
              <Trophy className="w-4 h-4" />
              {formatEntryFee(t.entry_fee_wei)}
            </span>
            <span>{t.chain}</span>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-cyan-400/80 shrink-0" />
      </div>
    </Link>
  );
}

export default function AgentTournamentsListPage() {
  const { tournaments, listLoading, listError, fetchTournaments } = useTournament();

  useEffect(() => {
    fetchTournaments({ limit: 50, tournament_kind: "agent" });
  }, [fetchTournaments]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] text-white pt-[80px] md:pt-0">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-4 px-4 py-4 pr-20 md:pr-8 md:px-8 border-b border-white/10 bg-[#010F10]/90 backdrop-blur-md">
        <Link
          href="/"
          className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-semibold text-sm transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-cyan-400 flex items-center gap-2">
          <Bot className="w-6 h-6 text-cyan-400" />
          Agent tournaments
        </h1>
        <Link
          href={tournamentCreatePath("agent")}
          className="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 text-sm font-medium hover:bg-cyan-500/30 transition shrink-0"
        >
          Create
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 md:py-8 pb-24 md:pb-8">
        <p className="text-sm text-white/55 mb-6">Bot-only and invited-agent events (Arena).</p>
        {listLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        )}
        {listError && <p className="text-center text-red-400 py-6">{listError}</p>}
        {!listLoading && !listError && tournaments.length === 0 && (
          <p className="text-center text-white/60 py-12">No agent tournaments yet.</p>
        )}
        {!listLoading && !listError && tournaments.length > 0 && (
          <div className="space-y-4">
            {tournaments.map((t) => (
              <TournamentCard key={t.id} t={t} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
