"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import { ArrowLeft, Loader2 } from "lucide-react";

type GameRow = Record<string, unknown>;

type PlayerRow = {
  game_player_id: number;
  user_id: number;
  username: string;
  user_address: string;
  balance: number;
  position: number;
  turn_order: number | null;
  turn_count: number | null;
  symbol: string | null;
};

type PropRow = {
  row_id: number;
  property_id: number;
  property_name: string;
  mortgaged: boolean;
  game_player_id_fk: number;
};

type HistRow = {
  id: number;
  action: string;
  amount: number | null;
  rolled: number | null;
  old_position: number | null;
  new_position: number | null;
  comment: string | null;
  created_at: string;
};

const CANCELLABLE = new Set(["PENDING", "RUNNING", "IN_PROGRESS", "AWAITING_PLAYERS"]);

export default function AdminGameRoomDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);

  const [game, setGame] = useState<GameRow | null>(null);
  const [meta, setMeta] = useState<{ playerCount: number; durationMs: number } | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [properties, setProperties] = useState<PropRow[]>([]);
  const [history, setHistory] = useState<HistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id) || id < 1) {
      setError("Invalid room id");
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
            game: GameRow;
            meta: { playerCount: number; durationMs: number };
            players: PlayerRow[];
            properties: PropRow[];
            historyTail: HistRow[];
          };
        }>(`admin/rooms/${id}`);
        if (cancelled) return;
        if (!body?.success || !body.data) {
          setError("Unexpected response");
          return;
        }
        setGame(body.data.game);
        setMeta(body.data.meta);
        setPlayers(body.data.players);
        setProperties(body.data.properties);
        setHistory(body.data.historyTail);
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load room";
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function cancelRoom() {
    if (!game || !CANCELLABLE.has(String(game.status))) return;
    if (!window.confirm(`Cancel game #${id} (${String(game.code)})? This sets status to CANCELLED. On-chain is not unwound.`)) {
      return;
    }
    setCancelBusy(true);
    setCancelMsg(null);
    try {
      await adminApi.post(`admin/rooms/${id}/cancel`, { reason: "admin_dashboard" });
      const { data: body } = await adminApi.get<{
        success: boolean;
        data?: { game: GameRow; meta: { playerCount: number; durationMs: number }; players: PlayerRow[]; properties: PropRow[]; historyTail: HistRow[] };
      }>(`admin/rooms/${id}`);
      if (body?.success && body.data) {
        setGame(body.data.game);
        setMeta(body.data.meta);
        setPlayers(body.data.players);
        setProperties(body.data.properties);
        setHistory(body.data.historyTail);
        setCancelMsg("Room cancelled.");
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Cancel failed";
      setCancelMsg(msg);
    } finally {
      setCancelBusy(false);
    }
  }

  if (!Number.isFinite(id) || id < 1) {
    return (
      <div>
        <Link href="/admin/game-rooms" className="text-sm text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to rooms
        </Link>
        <p className="text-red-400">Invalid id</p>
      </div>
    );
  }

  const statusStr = game ? String(game.status) : "";
  const canCancel = game && CANCELLABLE.has(statusStr);

  return (
    <div>
      <Link
        href="/admin/game-rooms"
        className="text-sm text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to rooms
      </Link>

      {loading && (
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
          Loading room…
        </div>
      )}

      {error && !loading && (
        <p className="text-red-400 text-sm border border-red-900/50 bg-red-950/30 rounded-lg px-3 py-2 max-w-lg">{error}</p>
      )}

      {game && !loading && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-semibold text-slate-100 font-mono">{String(game.code)}</h1>
              <p className="text-sm text-slate-500 mt-1">
                Game id {id} · {statusStr}
                {meta != null && (
                  <span className="ml-2 text-slate-600">
                    · {meta.playerCount} player{meta.playerCount === 1 ? "" : "s"} · duration ~{Math.round(meta.durationMs / 60000)}m
                  </span>
                )}
              </p>
            </div>
            {canCancel && (
              <button
                type="button"
                disabled={cancelBusy}
                onClick={cancelRoom}
                className="shrink-0 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-950/60 disabled:opacity-50"
              >
                {cancelBusy ? "Cancelling…" : "Cancel room"}
              </button>
            )}
          </div>

          {cancelMsg && (
            <p
              className={`mb-4 text-sm px-3 py-2 rounded-lg border ${
                cancelMsg.includes("failed") || cancelMsg.includes("Forbidden") || cancelMsg.includes("Cannot")
                  ? "text-red-400 border-red-900/50 bg-red-950/30"
                  : "text-emerald-400 border-emerald-900/50 bg-emerald-950/30"
              }`}
            >
              {cancelMsg}
            </p>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Game record</h2>
              <dl className="space-y-2 text-sm text-slate-300">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Mode</dt>
                  <dd>{String(game.mode ?? "—")}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Chain</dt>
                  <dd>{String(game.chain ?? "—")}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">AI</dt>
                  <dd>{game.is_ai ? "Yes" : "No"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Contract game id</dt>
                  <dd className="font-mono text-xs break-all text-right">{String(game.contract_game_id ?? "—")}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Creator id</dt>
                  <dd className="tabular-nums">{String(game.creator_id ?? "—")}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Winner id</dt>
                  <dd className="tabular-nums">{String(game.winner_id ?? "—")}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 overflow-hidden">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Players</h2>
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-sm min-w-[480px]">
                  <thead className="text-xs uppercase text-slate-500 border-b border-slate-800">
                    <tr>
                      <th className="py-2 pr-2 text-left">User</th>
                      <th className="py-2 pr-2 text-right">Balance</th>
                      <th className="py-2 pr-2 text-right">Pos</th>
                      <th className="py-2 text-right">Turn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {players.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-slate-500 text-center">
                          No players in this game.
                        </td>
                      </tr>
                    )}
                    {players.map((p) => (
                      <tr key={p.game_player_id}>
                        <td className="py-2 pr-2">
                          <Link href={`/admin/players/${p.user_id}`} className="text-cyan-400 hover:text-cyan-300">
                            {p.username}
                          </Link>
                          <span className="block text-xs text-slate-500">#{p.user_id}</span>
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums">{p.balance}</td>
                        <td className="py-2 pr-2 text-right tabular-nums">{p.position}</td>
                        <td className="py-2 text-right text-xs text-slate-400 tabular-nums">{p.turn_order ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 lg:col-span-2 overflow-hidden">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Properties on board</h2>
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-sm min-w-[400px]">
                  <thead className="text-xs uppercase text-slate-500 border-b border-slate-800">
                    <tr>
                      <th className="py-2 pr-2 text-left">Property</th>
                      <th className="py-2 pr-2 text-left">Owner (game_player id)</th>
                      <th className="py-2 text-left">Mortgaged</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {properties.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-6 text-slate-500 text-center">
                          No property rows.
                        </td>
                      </tr>
                    )}
                    {properties.map((pr) => (
                      <tr key={pr.row_id}>
                        <td className="py-2 pr-2">
                          {pr.property_name}{" "}
                          <span className="text-slate-500 text-xs">(id {pr.property_id})</span>
                        </td>
                        <td className="py-2 pr-2 font-mono text-xs">{pr.game_player_id_fk}</td>
                        <td className="py-2">{pr.mortgaged ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 lg:col-span-2 overflow-hidden">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Recent play log</h2>
              <div className="overflow-x-auto max-h-80 overflow-y-auto -mx-4 px-4">
                <table className="w-full text-xs min-w-[560px]">
                  <thead className="text-slate-500 border-b border-slate-800 sticky top-0 bg-[#0a1011]">
                    <tr>
                      <th className="py-2 pr-2 text-left">Time</th>
                      <th className="py-2 pr-2 text-left">Action</th>
                      <th className="py-2 pr-2 text-right">Amt</th>
                      <th className="py-2 text-left">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-400">
                    {history.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-slate-500 text-center">
                          No history rows.
                        </td>
                      </tr>
                    )}
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td className="py-1.5 pr-2 whitespace-nowrap">
                          {h.created_at ? String(h.created_at).slice(0, 19).replace("T", " ") : "—"}
                        </td>
                        <td className="py-1.5 pr-2">{h.action}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{h.amount ?? "—"}</td>
                        <td className="py-1.5 text-slate-500 max-w-xs truncate">{h.comment ?? ""}</td>
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
