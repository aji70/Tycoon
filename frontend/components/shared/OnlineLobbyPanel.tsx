"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, Users } from "lucide-react";
import { apiClient } from "@/lib/api";

type LobbyMessage = {
  id: string | number;
  body: string;
  user_id?: number | null;
  username?: string | null;
  address?: string | null;
  display_name?: string | null;
  created_at?: string;
};

type OnlineLobbyPanelProps = {
  address?: string | null;
  userId?: number | null;
  username?: string | null;
};

function formatTime(createdAt?: string) {
  if (!createdAt) return "";
  try {
    return new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function shortAddress(addr?: string | null): string | null {
  if (!addr || addr.length < 10) return null;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function displayNameFor(m: LobbyMessage): string {
  const fromApi = m.display_name?.trim();
  if (fromApi) return fromApi;
  const uname = m.username?.trim();
  if (uname) return uname;
  const short = shortAddress(m.address);
  if (short) return short;
  if (m.user_id != null) return `Player #${m.user_id}`;
  return "Player";
}

function unwrapList(res: unknown): LobbyMessage[] {
  const body = res as { data?: LobbyMessage[] | { data?: LobbyMessage[] } } | null;
  const payload = body?.data;
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: LobbyMessage[] })?.data)
      ? (payload as { data: LobbyMessage[] }).data
      : [];
  return list.map((m) => ({
    id: m?.id ?? "",
    body: typeof m?.body === "string" ? m.body : "",
    user_id: m?.user_id ?? null,
    username: m?.username != null ? m.username : null,
    address: m?.address != null ? String(m.address) : null,
    display_name: m?.display_name != null ? String(m.display_name) : null,
    created_at: typeof m?.created_at === "string" ? m.created_at : undefined,
  }));
}

/**
 * Compact general lobby chat (everyone can read/send when signed in).
 */
export default function OnlineLobbyPanel({ address, userId, username }: OnlineLobbyPanelProps) {
  const [messages, setMessages] = useState<LobbyMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const canSend = !!(userId != null || (address && String(address).trim()));
  const myLabel =
    (username && String(username).trim()) || shortAddress(address) || (userId != null ? `Player #${userId}` : "You");

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await apiClient.get("/messages/lobby");
      setMessages(unwrapList(res));
      scrollToEnd();
    } catch {
      // keep previous
    } finally {
      setLoading(false);
    }
  }, [scrollToEnd]);

  useEffect(() => {
    void fetchMessages();
    const t = window.setInterval(() => {
      void fetchMessages();
    }, 5000);
    return () => window.clearInterval(t);
  }, [fetchMessages]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !canSend || sending) return;
    setSending(true);
    setError(null);
    const optimistic: LobbyMessage = {
      id: `temp-${Date.now()}`,
      body,
      user_id: userId ?? null,
      username: username ?? null,
      address: address ?? null,
      display_name: myLabel,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    scrollToEnd();
    try {
      const payload: { room: string; body: string; user_id?: number; address?: string } = {
        room: "lobby",
        body,
      };
      if (userId != null) payload.user_id = userId;
      if (address) payload.address = String(address).trim();
      await apiClient.post("/messages", payload);
      await fetchMessages();
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(body);
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-cyan-500/30 bg-cyan-500/5">
      <div className="flex items-center justify-between gap-2 border-b border-cyan-500/20 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-cyan-300" />
          <div className="min-w-0">
            <p className="font-orbitron text-[11px] font-bold uppercase tracking-wider text-cyan-200">
              General room
            </p>
            <p className="truncate font-dmSans text-[10px] text-[#7ec8d4]">
              Chatting as{" "}
              <span className="font-semibold text-cyan-100">{myLabel}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="max-h-[42vh] min-h-[12rem] space-y-2.5 overflow-y-auto px-3 py-3">
        {loading && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10">
            <Loader2 className="h-7 w-7 animate-spin text-cyan-300" />
            <p className="font-dmSans text-sm text-[#8aa4b0]">Loading lobby…</p>
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center font-dmSans text-sm text-[#8aa4b0]">
            No messages yet. Be the first to say hi.
          </p>
        ) : (
          messages.map((m) => {
            const mine =
              (userId != null && m.user_id === userId) ||
              (!!username && !!m.username && String(m.username).toLowerCase() === String(username).toLowerCase()) ||
              (!!address &&
                !!m.address &&
                String(m.address).toLowerCase() === String(address).toLowerCase());
            const label = mine ? `You · ${displayNameFor(m)}` : displayNameFor(m);
            const initial = (displayNameFor(m)[0] || "?").toUpperCase();
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`flex max-w-[90%] gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border font-orbitron text-[11px] font-bold ${
                      mine
                        ? "border-cyan-400/45 bg-cyan-500/20 text-cyan-100"
                        : "border-emerald-400/35 bg-[#0a1a26] text-emerald-200"
                    }`}
                    aria-hidden
                  >
                    {initial}
                  </div>
                  <div
                    className={`min-w-0 rounded-2xl px-3 py-2 ${
                      mine
                        ? "rounded-br-md border border-cyan-400/40 bg-cyan-500/25"
                        : "rounded-bl-md border border-cyan-500/20 bg-[#0a1a26]"
                    }`}
                  >
                    <p
                      className={`mb-0.5 truncate font-orbitron text-[10px] font-bold uppercase tracking-wide ${
                        mine ? "text-cyan-200/90" : "text-emerald-300/90"
                      }`}
                      title={label}
                    >
                      {label}
                    </p>
                    <p className="whitespace-pre-wrap break-words font-dmSans text-sm text-[#e8f4f7]">
                      {m.body}
                    </p>
                    <p className={`mt-1 font-dmSans text-[10px] ${mine ? "text-cyan-200/60" : "text-[#6a8490]"}`}>
                      {formatTime(m.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p className="border-t border-red-500/20 px-3 py-1.5 font-dmSans text-xs text-red-300">{error}</p>
      )}

      <div className="flex items-center gap-2 border-t border-cyan-500/20 bg-[#071018]/80 p-2">
        <input
          type="text"
          value={draft}
          maxLength={500}
          disabled={!canSend}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={canSend ? `Message as ${myLabel}…` : "Sign in to chat"}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-cyan-500/30 bg-[#0a1a26] px-3 font-dmSans text-sm text-[#e8f4f7] outline-none placeholder:text-[#5a7380] focus:border-cyan-400/60 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || !draft.trim() || !canSend}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-cyan-400/50 bg-cyan-500/20 text-cyan-100 transition hover:bg-cyan-500/30 disabled:opacity-40"
          aria-label="Send lobby message"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
