"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { canCancelGameStatus, getAdminGamePlayPath } from "@/lib/adminGameRoomRoutes";
import { ApiError } from "@/lib/api";
import { ExternalLink, Loader2, X } from "lucide-react";

type GameRow = Record<string, unknown>;

type PlayerRow = {
  game_player_id: number;
  user_id: number;
  username: string;
  balance: number;
  position: number;
  turn_order: number | null;
};

type HistRow = {
  id: number;
  action: string;
  amount: number | null;
  comment: string | null;
  created_at: string;
};

type RoomDetail = {
  game: GameRow;
  meta: { playerCount: number; durationMs: number };
  players: PlayerRow[];
  properties: { row_id: number; property_name: string }[];
  historyTail: HistRow[];
  creator: { id: number; username: string } | null;
  winner: { id: number; username: string } | null;
};

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

type Props = {
  roomId: number | null;
  onClose: () => void;
  onCancelled: () => void;
};

export function GameRoomDetailDrawer({ roomId, onClose, onCancelled }: Props) {
  const [detail, setDetail] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    setCancelMsg(null);
    try {
      const { data: body } = await adminApi.get<{ success: boolean; data?: RoomDetail }>(`admin/rooms/${id}`);
      if (!body?.success || !body.data) {
        setError("Unexpected response");
        setDetail(null);
        return;
      }
      setDetail(body.data);
    } catch (e) {
      setDetail(null);
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load room");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (roomId == null) {
      setDetail(null);
      setError(null);
      setCancelMsg(null);
      return;
    }
    void load(roomId);
  }, [roomId, load]);

  useEffect(() => {
    if (roomId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [roomId, onClose]);

  async function cancelRoom() {
    if (roomId == null || !detail?.game) return;
    const status = String(detail.game.status);
    if (!canCancelGameStatus(status)) return;
    const code = String(detail.game.code ?? roomId);
    if (!window.confirm(`End game #${roomId} (${code})? Sets status to CANCELLED. On-chain is not unwound.`)) {
      return;
    }
    setCancelBusy(true);
    setCancelMsg(null);
    try {
      await adminApi.post(`admin/rooms/${roomId}/cancel`, { reason: "admin_dashboard" });
      setCancelMsg("Game ended.");
      await load(roomId);
      onCancelled();
    } catch (e) {
      setCancelMsg(e instanceof ApiError ? e.message : "Cancel failed");
    } finally {
      setCancelBusy(false);
    }
  }

  if (roomId == null) return null;

  const game = detail?.game;
  const statusStr = game ? String(game.status) : "";
  const canCancel = game && canCancelGameStatus(statusStr);
  const boardPath =
    game && game.code
      ? getAdminGamePlayPath({
          code: String(game.code),
          status: statusStr,
          isAi: !!game.is_ai,
        })
      : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Game room details">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      <aside className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-slate-800 bg-[#0a1011] shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div className="min-w-0">
            {game ? (
              <>
                <h2 className="font-mono text-lg font-semibold text-slate-100 truncate">{String(game.code)}</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  #{roomId} · {statusStr}
                  {detail?.meta != null && (
                    <span className="ml-1">· {formatDuration(detail.meta.durationMs)}</span>
                  )}
                </p>
              </>
            ) : (
              <h2 className="text-lg font-semibold text-slate-100">Room #{roomId}</h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close panel"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center gap-2 text-slate-400 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
              Loading details…
            </div>
          )}

          {error && !loading && (
            <p className="text-sm text-red-400 border border-red-900/50 bg-red-950/30 rounded-lg px-3 py-2">{error}</p>
          )}

          {cancelMsg && (
            <p
              className={`mb-4 text-sm px-3 py-2 rounded-lg border ${
                cancelMsg.includes("failed") || cancelMsg.includes("Forbidden")
                  ? "text-red-400 border-red-900/50 bg-red-950/30"
                  : "text-emerald-400 border-emerald-900/50 bg-emerald-950/30"
              }`}
            >
              {cancelMsg}
            </p>
          )}

          {game && detail && !loading && (
            <div className="space-y-5">
              <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Game record</h3>
                <dl className="space-y-2 text-sm text-slate-300">
                  <Row label="Mode" value={String(game.mode ?? "—")} />
                  <Row label="Chain" value={String(game.chain ?? "—")} />
                  <Row label="AI" value={game.is_ai ? "Yes" : "No"} />
                  <Row label="Players" value={`${detail.meta.playerCount} / ${String(game.number_of_players ?? "—")}`} />
                  <div className="flex justify-between gap-4 text-sm">
                    <dt className="text-slate-500 shrink-0">Creator</dt>
                    <dd className="text-right">
                      {detail.creator ? (
                        <Link href={`/admin/players/${detail.creator.id}`} className="text-cyan-400 hover:text-cyan-300">
                          {detail.creator.username}
                        </Link>
                      ) : game.creator_id ? (
                        <span className="text-slate-400 tabular-nums">#{String(game.creator_id)}</span>
                      ) : (
                        "—"
                      )}
                      {detail.creator && (
                        <span className="block text-xs text-slate-500 tabular-nums">#{detail.creator.id}</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 text-sm">
                    <dt className="text-slate-500 shrink-0">Winner</dt>
                    <dd className="text-right">
                      {detail.winner ? (
                        <Link href={`/admin/players/${detail.winner.id}`} className="text-cyan-400 hover:text-cyan-300">
                          {detail.winner.username}
                        </Link>
                      ) : game.winner_id ? (
                        <span className="text-slate-400 tabular-nums">#{String(game.winner_id)}</span>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <Row label="Contract id" value={String(game.contract_game_id ?? "—")} mono />
                </dl>
              </section>

              <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Players</h3>
                {detail.players.length === 0 ? (
                  <p className="text-sm text-slate-500">No players.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {detail.players.map((p) => (
                      <li key={p.game_player_id} className="flex justify-between gap-2 border-b border-slate-800/60 pb-2 last:border-0">
                        <Link href={`/admin/players/${p.user_id}`} className="text-cyan-400 hover:text-cyan-300 truncate">
                          {p.username}
                        </Link>
                        <span className="text-slate-400 tabular-nums shrink-0">
                          ${p.balance} · pos {p.position}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Recent activity</h3>
                <p className="text-xs text-slate-500 mb-2">
                  {detail.properties.length} propert{detail.properties.length === 1 ? "y" : "ies"} on board
                </p>
                {detail.historyTail.length === 0 ? (
                  <p className="text-sm text-slate-500">No play history.</p>
                ) : (
                  <ul className="space-y-1.5 text-xs text-slate-400 max-h-40 overflow-y-auto">
                    {detail.historyTail.slice(0, 12).map((h) => (
                      <li key={h.id} className="font-mono">
                        {h.created_at ? String(h.created_at).slice(11, 19) : "—"} {h.action}
                        {h.amount != null ? ` · ${h.amount}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>

        <footer className="border-t border-slate-800 px-5 py-4 flex flex-wrap gap-2">
          {boardPath && (
            <a
              href={boardPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-800/60 bg-cyan-950/40 px-3 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-950/60"
            >
              <ExternalLink className="h-4 w-4" />
              Open board
            </a>
          )}
          <Link
            href={`/admin/game-rooms/${roomId}`}
            className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:border-slate-500"
          >
            Full detail
          </Link>
          {canCancel && (
            <button
              type="button"
              disabled={cancelBusy}
              onClick={() => void cancelRoom()}
              className="ml-auto rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm font-medium text-red-200 hover:bg-red-950/60 disabled:opacity-50"
            >
              {cancelBusy ? "Ending…" : "End game"}
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500 shrink-0">{label}</dt>
      <dd className={`text-right break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
