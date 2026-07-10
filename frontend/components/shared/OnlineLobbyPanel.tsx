"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, Users } from "lucide-react";
import { apiClient } from "@/lib/api";

type LobbyMessage = {
  id: string | number;
  body: string;
  user_id?: number | null;
  username?: string | null;
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
      <div className="flex items-center gap-2 border-b border-cyan-500/20 px-3 py-2.5">
        <Users className="h-4 w-4 text-cyan-300" />
        <div>
          <p className="font-orbitron text-[11px] font-bold uppercase tracking-wider text-cyan-200">
            General room
          </p>
          <p className="font-dmSans text-[10px] text-[#7ec8d4]">Everyone in the lobby</p>
        </div>
      </div>

      <div className="max-h-[42vh] min-h-[12rem] space-y-2 overflow-y-auto px-3 py-3">
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
              (!!username && !!m.username && String(m.username) === String(username));
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                    mine
                      ? "rounded-br-md border border-cyan-400/40 bg-cyan-500/25"
                      : "rounded-bl-md border border-cyan-500/20 bg-[#0a1a26]"
                  }`}
                >
                  {!mine && (
                    <p className="mb-0.5 font-orbitron text-[10px] font-bold uppercase tracking-wide text-cyan-300/85">
                      {m.username || "Player"}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words font-dmSans text-sm text-[#e8f4f7]">
                    {m.body}
                  </p>
                  <p className={`mt-1 font-dmSans text-[10px] ${mine ? "text-cyan-200/60" : "text-[#6a8490]"}`}>
                    {formatTime(m.created_at)}
                  </p>
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
          placeholder={canSend ? "Message the lobby…" : "Sign in to chat"}
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
