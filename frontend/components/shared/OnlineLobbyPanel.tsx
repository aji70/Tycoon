"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Reply, Send, Users, X } from "lucide-react";
import { apiClient } from "@/lib/api";

const REPLY_QUOTE_PREFIX = "> ";
const REPLY_QUOTE_SEP = "\n\n";
const REPLY_QUOTE_MAX_LEN = 80;

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
  /** Open player profile / stats (e.g. from Who's online sheet). */
  onPlayerClick?: (player: {
    userId?: number | null;
    username?: string | null;
    address?: string | null;
  }) => void;
  /** Mobile full-screen sheet: message list grows to fill viewport. */
  fillHeight?: boolean;
};

type ReplyingTo = { id: string | number; name: string; body: string };

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

function parseMessageBody(body: string | null | undefined): {
  quote: { name: string; text: string } | null;
  main: string;
} {
  const safeBody = typeof body === "string" ? body : "";
  if (!safeBody.startsWith(REPLY_QUOTE_PREFIX)) return { quote: null, main: safeBody };
  const idx = safeBody.indexOf(REPLY_QUOTE_SEP);
  if (idx < 0) return { quote: null, main: safeBody };
  const quoteLine = safeBody.slice(REPLY_QUOTE_PREFIX.length, idx).trim();
  const main = safeBody.slice(idx + REPLY_QUOTE_SEP.length).trim();
  const colon = quoteLine.indexOf(":");
  if (colon < 0) return { quote: { name: quoteLine.replace(/^@/, ""), text: "" }, main };
  return {
    quote: {
      name: quoteLine.slice(0, colon).replace(/^@/, "").trim() || "Player",
      text: quoteLine.slice(colon + 1).trim(),
    },
    main,
  };
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
 * Supports reply-to-message the same way as in-game chat.
 */
export default function OnlineLobbyPanel({
  address,
  userId,
  username,
  onPlayerClick,
  fillHeight = false,
}: OnlineLobbyPanelProps) {
  const [messages, setMessages] = useState<LobbyMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ReplyingTo | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  const openPlayer = (m: LobbyMessage, mine: boolean) => {
    if (mine) return;
    if (!m.user_id && !m.username?.trim() && !m.address?.trim()) return;
    const player = {
      userId: m.user_id ?? null,
      username: m.username ?? null,
      address: m.address ?? null,
    };
    if (onPlayerClick) {
      onPlayerClick(player);
      return;
    }
    try {
      window.dispatchEvent(new CustomEvent("tycoon-open-player-profile", { detail: player }));
    } catch {
      // ignore
    }
  };

  const send = async () => {
    const trimmed = draft.trim();
    if (!trimmed || !canSend || sending) return;
    setSending(true);
    setError(null);

    let bodyToSend = trimmed;
    if (replyingTo) {
      const quoteText =
        replyingTo.body.length > REPLY_QUOTE_MAX_LEN
          ? `${replyingTo.body.slice(0, REPLY_QUOTE_MAX_LEN)}…`
          : replyingTo.body;
      bodyToSend = `${REPLY_QUOTE_PREFIX}@${replyingTo.name}: ${quoteText}${REPLY_QUOTE_SEP}${trimmed}`;
      setReplyingTo(null);
    }

    const optimistic: LobbyMessage = {
      id: `temp-${Date.now()}`,
      body: bodyToSend,
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
        body: bodyToSend,
      };
      if (userId != null) payload.user_id = userId;
      if (address) payload.address = String(address).trim();
      await apiClient.post("/messages", payload);
      await fetchMessages();
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(trimmed);
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className={
        fillHeight
          ? "flex min-h-0 flex-1 flex-col overflow-hidden"
          : "flex flex-col overflow-hidden rounded-xl border border-cyan-500/30 bg-cyan-500/5"
      }
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-cyan-500/20 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-cyan-300" />
          <div className="min-w-0">
            <p className="font-orbitron text-[11px] font-bold uppercase tracking-wider text-cyan-200">
              General room
            </p>
            <p className="truncate font-dmSans text-[10px] text-[#7ec8d4]">You</p>
          </div>
        </div>
      </div>

      <div
        className={
          fillHeight
            ? "min-h-0 flex-1 space-y-2.5 overflow-y-auto px-1 py-2"
            : "max-h-[42vh] min-h-[12rem] space-y-2.5 overflow-y-auto px-3 py-3"
        }
      >
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
              (!!username &&
                !!m.username &&
                String(m.username).toLowerCase() === String(username).toLowerCase()) ||
              (!!address &&
                !!m.address &&
                String(m.address).toLowerCase() === String(address).toLowerCase());
            const label = mine ? "You" : displayNameFor(m);
            const initial = (mine ? "Y" : displayNameFor(m)[0] || "?").toUpperCase();
            const { quote, main } = parseMessageBody(m.body);
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`group flex max-w-[90%] gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}>
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
                  <div className={`flex min-w-0 flex-col ${mine ? "items-end" : "items-start"}`}>
                    <div
                      className={`min-w-0 rounded-2xl px-3 py-2 ${
                        mine
                          ? "rounded-br-md border border-cyan-400/40 bg-cyan-500/25"
                          : "rounded-bl-md border border-cyan-500/20 bg-[#0a1a26]"
                      }`}
                    >
                      {mine ? (
                        <p
                          className="mb-0.5 truncate font-orbitron text-[10px] font-bold uppercase tracking-wide text-cyan-200/90"
                          title={label}
                        >
                          {label}
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openPlayer(m, false)}
                          className="mb-0.5 truncate font-orbitron text-[10px] font-bold uppercase tracking-wide text-emerald-300/90 underline-offset-2 transition hover:text-emerald-200 hover:underline"
                          title={`View ${label}'s stats`}
                        >
                          {label}
                        </button>
                      )}
                      {quote ? (
                        <div
                          className={`mb-1.5 border-l-2 pl-2 text-[11px] ${
                            mine ? "border-cyan-200/40 text-cyan-100/80" : "border-emerald-400/40 text-[#9bb4c0]"
                          }`}
                        >
                          <p className="font-semibold text-[10px]">{quote.name}</p>
                          <p className="line-clamp-2 leading-snug">{quote.text}</p>
                        </div>
                      ) : null}
                      <p className="whitespace-pre-wrap break-words font-dmSans text-sm text-[#e8f4f7]">
                        {main}
                      </p>
                      <p
                        className={`mt-1 font-dmSans text-[10px] ${
                          mine ? "text-cyan-200/60" : "text-[#6a8490]"
                        }`}
                      >
                        {formatTime(m.created_at)}
                      </p>
                    </div>
                    {canSend ? (
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTo({ id: m.id, name: label, body: main || m.body });
                          inputRef.current?.focus();
                        }}
                        className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-dmSans text-[10px] text-cyan-300/70 transition hover:bg-cyan-500/10 hover:text-cyan-200"
                        aria-label={`Reply to ${label}`}
                      >
                        <Reply className="h-3 w-3" />
                        Reply
                      </button>
                    ) : null}
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

      <div className="border-t border-cyan-500/20 bg-[#071018]/80 p-2">
        {replyingTo ? (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1.5">
            <Reply className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
            <p className="min-w-0 flex-1 truncate font-dmSans text-[11px] text-cyan-100/90">
              Replying to <span className="font-semibold">{replyingTo.name}</span>:{" "}
              {replyingTo.body.slice(0, 50)}
              {replyingTo.body.length > 50 ? "…" : ""}
            </p>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-cyan-200/70 hover:bg-cyan-500/15 hover:text-cyan-100"
              aria-label="Cancel reply"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
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
            placeholder={
              canSend
                ? replyingTo
                  ? `Reply to ${replyingTo.name}…`
                  : "Message the lobby…"
                : "Sign in to chat"
            }
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
    </div>
  );
}
