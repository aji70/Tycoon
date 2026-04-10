"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Loader2 } from "lucide-react";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";

type PlayerHit = {
  id: number;
  username: string;
  address: string;
  chain: string;
  isGuest: boolean;
  referralCode?: string | null;
};

type GameHit = {
  id: number;
  code: string;
  status: string;
  chain: string;
  mode: string | null;
};

export default function AdminGlobalSearch() {
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<PlayerHit[]>([]);
  const [games, setGames] = useState<GameHit[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input.trim()), 280);
    return () => clearTimeout(t);
  }, [input]);

  const runSearch = useCallback(async (q: string) => {
    if (!q) {
      setPlayers([]);
      setGames([]);
      setHint(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: body } = await adminApi.get<{
        success: boolean;
        data?: { players: PlayerHit[]; games: GameHit[]; hint?: string | null };
      }>("admin/search", { params: { q, limit: 8 } });
      if (!body?.success || !body.data) {
        setError("Bad response");
        setPlayers([]);
        setGames([]);
        return;
      }
      setPlayers(body.data.players);
      setGames(body.data.games);
      setHint(body.data.hint ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Search failed");
      setPlayers([]);
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    runSearch(debounced);
  }, [debounced, open, runSearch]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const hasResults = players.length > 0 || games.length > 0;
  const showPanel = open && (debounced.length > 0 || hint || error);

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" aria-hidden />
      <input
        type="search"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Players (name, wallet, id) · Rooms (code, id)"
        autoComplete="off"
        className="w-full rounded-lg bg-slate-900/80 border border-slate-700/80 pl-9 pr-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-700/60"
        aria-label="Admin search"
        aria-expanded={showPanel}
        aria-controls="admin-search-results"
      />

      {showPanel && (
        <div
          id="admin-search-results"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-xl border border-slate-700 bg-[#0d1416] shadow-xl max-h-[min(70vh,420px)] overflow-y-auto"
          role="listbox"
        >
          {loading && (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-600" />
              Searching…
            </div>
          )}

          {!loading && error && <p className="px-3 py-3 text-sm text-red-400">{error}</p>}

          {!loading && !error && hint && <p className="px-3 py-3 text-sm text-slate-500">{hint}</p>}

          {!loading && !error && !hasResults && debounced.length > 0 && !hint && (
            <p className="px-3 py-3 text-sm text-slate-500">No matches.</p>
          )}

          {!loading && !error && players.length > 0 && (
            <div className="border-b border-slate-800/80">
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Players</p>
              <ul className="pb-1">
                {players.map((p) => (
                  <li key={`p-${p.id}`}>
                    <Link
                      href={`/admin/players/${p.id}`}
                      className="block px-3 py-2 text-sm hover:bg-slate-800/80 text-slate-200"
                      onClick={() => setOpen(false)}
                    >
                      <span className="font-medium text-cyan-200/90">{p.username}</span>
                      <span className="text-slate-500 text-xs ml-2">
                        #{p.id} · {p.chain}
                        {p.isGuest ? " · guest" : ""}
                        {p.referralCode ? ` · ref ${p.referralCode}` : ""}
                      </span>
                      <span className="block text-xs text-slate-500 font-mono truncate mt-0.5">{p.address}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!loading && !error && games.length > 0 && (
            <div>
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Game rooms</p>
              <ul className="pb-1">
                {games.map((g) => (
                  <li key={`g-${g.id}`}>
                    <Link
                      href={`/admin/game-rooms/${g.id}`}
                      className="block px-3 py-2 text-sm hover:bg-slate-800/80 text-slate-200"
                      onClick={() => setOpen(false)}
                    >
                      <span className="font-mono text-cyan-200/90">{g.code}</span>
                      <span className="text-slate-500 text-xs ml-2">
                        #{g.id} · {g.status} · {g.chain}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
