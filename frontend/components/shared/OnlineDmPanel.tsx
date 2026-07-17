"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { apiClient } from "@/lib/api";
import { socketService } from "@/lib/socket";

export type DmMessage = {
  id: number;
  body: string;
  senderId: number;
  username?: string | null;
  createdAt?: string;
};

type OnlineDmPanelProps = {
  otherUserId?: number | null;
  otherUsername?: string | null;
  otherAddress?: string | null;
  myUserId?: number | null;
  myUsername?: string | null;
  /** Mobile full-screen sheet: message list grows to fill viewport. */
  fillHeight?: boolean;
};

function formatTime(createdAt?: string) {
  if (!createdAt) return "";
  try {
    const d = new Date(createdAt);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function unwrapData<T>(res: unknown): T | null {
  const body = res as { data?: T | { data?: T } } | null;
  if (!body?.data) return null;
  const inner = body.data as T | { data?: T };
  if (inner && typeof inner === "object" && "data" in (inner as object) && (inner as { data?: T }).data) {
    return (inner as { data: T }).data;
  }
  return inner as T;
}

/**
 * Compact 1:1 DM thread for the Who's online sheet.
 */
export default function OnlineDmPanel({
  otherUserId,
  otherUsername,
  otherAddress,
  myUserId,
  myUsername,
  fillHeight = false,
}: OnlineDmPanelProps) {
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [peerLabel, setPeerLabel] = useState(otherUsername?.trim() || "Player");
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<number | null>(null);
  conversationIdRef.current = conversationId;

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const hasTarget = otherUserId != null || !!otherUsername?.trim() || !!otherAddress?.trim();
    if (!hasTarget) {
      setError("Cannot message this player yet.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setMessages([]);
    setConversationId(null);

    void (async () => {
      try {
        const openRes = await apiClient.post(`/dms/open`, {
          userId: otherUserId ?? undefined,
          username: otherUsername?.trim() || undefined,
          address: otherAddress?.trim() || undefined,
          chain: "CELO",
        });
        const opened = unwrapData<{
          id: number;
          otherUser?: { userId?: number; username?: string | null };
        }>(openRes);
        if (cancelled || !opened?.id) {
          if (!cancelled) setError("Could not open chat.");
          return;
        }
        setConversationId(opened.id);
        if (opened.otherUser?.username) setPeerLabel(opened.otherUser.username);

        const msgRes = await apiClient.get(`/dms/${opened.id}/messages`);
        const payload = unwrapData<{
          messages?: DmMessage[];
          otherUser?: { username?: string | null };
        }>(msgRes);
        if (cancelled) return;
        if (payload?.otherUser?.username) setPeerLabel(payload.otherUser.username);
        setMessages(Array.isArray(payload?.messages) ? payload!.messages! : []);
        scrollToEnd();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not open chat.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [otherUserId, otherUsername, otherAddress, scrollToEnd]);

  useEffect(() => {
    const handler = (data: { conversationId?: number; message?: DmMessage }) => {
      if (!data?.message || data.conversationId !== conversationIdRef.current) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.message!.id)) return prev;
        return [...prev, data.message!];
      });
      scrollToEnd();
    };
    try {
      socketService.onDmMessage(handler);
    } catch {
      // ignore
    }
    return () => {
      try {
        socketService.removeListener("dm-message", handler);
      } catch {
        // ignore
      }
    };
  }, [scrollToEnd]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !conversationId || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await apiClient.post(`/dms/${conversationId}/messages`, { body });
      const message = unwrapData<DmMessage>(res);
      setDraft("");
      if (message?.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
        scrollToEnd();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 ${fillHeight ? "min-h-0 flex-1 py-8" : "py-12"}`}
      >
        <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
        <p className="font-dmSans text-sm text-[#8aa4b0]">Opening chat with {peerLabel}…</p>
      </div>
    );
  }

  if (error && messages.length === 0 && !conversationId) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-8 text-center">
        <p className="font-dmSans text-sm text-red-200">{error}</p>
        <p className="mt-1 font-dmSans text-xs text-[#8aa4b0]">Sign in and try again.</p>
      </div>
    );
  }

  return (
    <div
      className={
        fillHeight
          ? "flex min-h-0 flex-1 flex-col overflow-hidden"
          : "flex flex-col overflow-hidden rounded-xl border border-emerald-500/25 bg-emerald-500/5"
      }
    >
      <div
        className={
          fillHeight
            ? "min-h-0 flex-1 space-y-2 overflow-y-auto px-1 py-2"
            : "max-h-[42vh] min-h-[12rem] space-y-2 overflow-y-auto px-3 py-3"
        }
      >
        {messages.length === 0 ? (
          <p className="py-8 text-center font-dmSans text-sm text-[#8aa4b0]">
            Say hi to {peerLabel}. Messages are private.
          </p>
        ) : (
          messages.map((m) => {
            const mine = myUserId != null && Number(m.senderId) === Number(myUserId);
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                    mine
                      ? "rounded-br-md bg-emerald-500/25 border border-emerald-400/35"
                      : "rounded-bl-md bg-[#0a1a26] border border-emerald-500/20"
                  }`}
                >
                  {!mine && (
                    <p className="mb-0.5 font-orbitron text-[10px] font-bold uppercase tracking-wide text-emerald-300/80">
                      {m.username || peerLabel}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words font-dmSans text-sm text-[#e8f4f7]">
                    {m.body}
                  </p>
                  <p className={`mt-1 font-dmSans text-[10px] ${mine ? "text-emerald-200/60" : "text-[#6a8490]"}`}>
                    {formatTime(m.createdAt)}
                    {mine ? ` · ${myUsername || "You"}` : ""}
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

      <div className="flex items-center gap-2 border-t border-emerald-500/20 bg-[#071018]/80 p-2">
        <input
          type="text"
          value={draft}
          maxLength={1000}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={`Message ${peerLabel}…`}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-emerald-500/30 bg-[#0a1a26] px-3 font-dmSans text-sm text-[#e8f4f7] outline-none placeholder:text-[#5a7380] focus:border-emerald-400/60"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || !draft.trim() || !conversationId}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-emerald-400/50 bg-emerald-500/20 text-emerald-200 transition hover:bg-emerald-500/30 disabled:opacity-40"
          aria-label="Send message"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
