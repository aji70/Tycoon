"use client";

import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Send, MessageCircle, Reply, X, Users } from "lucide-react";
import toast from "react-hot-toast";
import { parseMessageBody } from "@/components/game/chat-room";

const REPLY_QUOTE_PREFIX = "> ";
const REPLY_QUOTE_SEP = "\n\n";
const REPLY_QUOTE_MAX_LEN = 80;

interface LobbyMessage {
  id: string | number;
  body: string;
  player_id?: string;
  user_id?: number | null;
  created_at?: string;
  username?: string | null;
}

export interface LobbyChatRoomProps {
  /** Wallet address for sending (used if user_id not available) */
  address?: string | null;
  /** Resolved user id from backend (optional) */
  userId?: number | null;
  /** Display name for "me" (optional) */
  username?: string | null;
  isMobile?: boolean;
  showHeader?: boolean;
}

const POLLING_INTERVAL = 4000;
const POLLING_INTERVAL_MOBILE = 8000;

const fetchLobbyMessages = async (): Promise<LobbyMessage[]> => {
  const res = await apiClient.get<{ data?: LobbyMessage[] }>("/messages/lobby");
  const payload = (res as { data?: { data?: LobbyMessage[] } })?.data;
  const list = payload?.data ?? payload;
  const arr = Array.isArray(list) ? list : [];
  return arr.map((m) => ({
    ...m,
    body: typeof m?.body === "string" ? m.body : "",
    username: m?.username ?? null,
  }));
};

function formatTime(created_at?: string) {
  if (!created_at) return "";
  try {
    const d = new Date(created_at);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    return isToday
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function getInitial(name: string) {
  return (name || "?").charAt(0).toUpperCase();
}

type ReplyingTo = { id: string | number; name: string; body: string };

const LOBBY_QUERY_KEY = ["messages", "lobby"];

export default function LobbyChatRoom({
  address,
  userId,
  username,
  isMobile = false,
  showHeader = true,
}: LobbyChatRoomProps) {
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplyingTo | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const canSend = !!(userId != null || (address && String(address).trim()));

  const { data: messages = [], isLoading } = useQuery<LobbyMessage[]>({
    queryKey: LOBBY_QUERY_KEY,
    queryFn: fetchLobbyMessages,
    refetchInterval: isMobile ? POLLING_INTERVAL_MOBILE : POLLING_INTERVAL,
    refetchOnWindowFocus: !isMobile,
    staleTime: isMobile ? 5000 : 2000,
  });

  const prevMessagesLengthRef = useRef(0);
  useEffect(() => {
    const len = messages.length;
    if (len > prevMessagesLengthRef.current) {
      prevMessagesLengthRef.current = len;
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      prevMessagesLengthRef.current = len;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !canSend || sending) return;

    setSending(true);
    const trimmed = newMessage.trim();
    let bodyToSend = trimmed;
    if (replyingTo) {
      const quoteText =
        replyingTo.body.length > REPLY_QUOTE_MAX_LEN ? replyingTo.body.slice(0, REPLY_QUOTE_MAX_LEN) + "…" : replyingTo.body;
      bodyToSend = `${REPLY_QUOTE_PREFIX}@${replyingTo.name}: ${quoteText}${REPLY_QUOTE_SEP}${trimmed}`;
      setReplyingTo(null);
    }
    setNewMessage("");

    queryClient.setQueryData<LobbyMessage[]>(LOBBY_QUERY_KEY, (old = []) => [
      ...old,
      {
        id: "temp-" + Date.now(),
        body: bodyToSend,
        user_id: userId ?? undefined,
        created_at: new Date().toISOString(),
        username: username ?? null,
      },
    ]);

    try {
      const payload: { room: string; body: string; user_id?: number; address?: string } = {
        room: "lobby",
        body: bodyToSend,
      };
      if (userId != null) payload.user_id = userId;
      if (address && String(address).trim()) payload.address = String(address).trim();
      await apiClient.post("/messages", payload);
      queryClient.invalidateQueries({ queryKey: LOBBY_QUERY_KEY });
    } catch (err: unknown) {
      queryClient.setQueryData<LobbyMessage[]>(LOBBY_QUERY_KEY, (old = []) =>
        old.filter((m) => !String(m.id).startsWith("temp-"))
      );
      setNewMessage(trimmed);
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to send message";
      toast.error(msg);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-gradient-to-b from-[#0d1819] via-[#0a1214] to-[#061012] rounded-xl border border-cyan-500/20 shadow-[0_0_30px_rgba(0,240,255,0.06),inset_0_1px_0_rgba(255,255,255,0.03)]">
      {showHeader && (
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-950/40 to-cyan-900/20">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/30">
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-cyan-100 tracking-wide uppercase">General room</h3>
            <p className="text-[10px] text-cyan-400/70 font-mono tracking-wider">Everyone · Lobby</p>
          </div>
        </div>
      )}

      <div
        className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-cyan-500/30 scrollbar-track-transparent ${
          isMobile ? "px-3 py-3" : "px-4 py-4"
        }`}
      >
        {isLoading && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[140px] gap-3">
            <div className="w-10 h-10 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            <span className="text-sm text-cyan-400/80 font-medium">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/10">
              <MessageCircle className="w-8 h-8 text-cyan-400/80" />
            </div>
            <p className="text-cyan-100 font-semibold text-lg">General room</p>
            <p className="text-cyan-400/70 text-sm mt-1.5">Say hi to everyone in the lobby! 👋</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isMe =
                (userId != null && msg.user_id === userId) ||
                (msg.username && username && msg.username === username);
              const displayName = msg.username ?? "Anonymous";
              const { quote, main } = parseMessageBody(msg?.body);
              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                  {!isMobile && (
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                        isMe
                          ? "bg-cyan-500/40 border-cyan-400/60 text-cyan-100"
                          : "bg-slate-700/80 border-cyan-500/30 text-cyan-200/90"
                      }`}
                    >
                      {getInitial(displayName)}
                    </div>
                  )}
                  <div className={`flex flex-col min-w-0 flex-1 ${isMe ? "items-end" : "items-start"}`}>
                    <div className={`flex items-center gap-2 mb-0.5 ${isMe ? "flex-row-reverse" : ""}`}>
                      <span className={`text-xs font-semibold ${isMe ? "text-cyan-300" : "text-cyan-400/90"}`}>
                        {displayName}
                      </span>
                      {msg.created_at && !String(msg.id).startsWith("temp-") && (
                        <span className="text-[10px] text-cyan-500/50 tabular-nums">
                          {formatTime(msg.created_at)}
                        </span>
                      )}
                    </div>
                    <div className={`group flex items-end gap-1 max-w-[90%] ${isMe ? "flex-row-reverse" : ""}`}>
                      <div
                        className={`px-3.5 py-2.5 rounded-xl border ${
                          isMe
                            ? "bg-gradient-to-br from-cyan-500/90 to-cyan-600/90 text-white border-cyan-400/40 shadow-lg shadow-cyan-500/20 rounded-br-sm"
                            : "bg-slate-800/80 text-slate-100 border-cyan-500/20 rounded-bl-sm"
                        }`}
                      >
                        {quote && (
                          <div
                            className={`mb-2 pl-2 border-l-2 text-xs opacity-90 ${
                              isMe ? "border-cyan-200/50" : "border-cyan-400/40"
                            }`}
                          >
                            <p className="font-semibold text-[11px] mb-0.5 text-cyan-200/90">{quote.name}</p>
                            <p className="leading-snug break-words line-clamp-2 text-slate-300">{quote.text}</p>
                          </div>
                        )}
                        <p className="text-[14px] leading-relaxed break-words whitespace-pre-wrap">{main}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyingTo({ id: msg.id, name: displayName, body: main })}
                        className={`flex-shrink-0 p-1.5 rounded-lg text-cyan-400/60 hover:text-cyan-300 transition ${
                          isMobile ? "" : "opacity-0 group-hover:opacity-100"
                        }`}
                        aria-label={`Reply to ${displayName}`}
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div
        className={`flex-shrink-0 border-t border-cyan-500/20 bg-slate-900/95 backdrop-blur-sm ${
          isMobile ? "p-3 pb-[max(1rem,env(safe-area-inset-bottom))]" : "p-3"
        }`}
      >
        {replyingTo && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-cyan-500/15 border border-cyan-400/25">
            <Reply className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <p className="flex-1 min-w-0 text-xs text-cyan-200/90 truncate">
              Replying to <span className="font-semibold">{replyingTo.name}</span>: {replyingTo.body.slice(0, 50)}
              {replyingTo.body.length > 50 ? "…" : ""}
            </p>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="p-1 rounded-lg text-cyan-400/70 hover:text-cyan-300 hover:bg-cyan-500/20"
              aria-label="Cancel reply"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {!canSend ? (
          <div className="text-center py-3 text-sm text-cyan-500/60 font-medium">Connect wallet to send messages</div>
        ) : (
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type a message to everyone..."
              maxLength={500}
              className="flex-1 bg-slate-800/80 text-cyan-50 placeholder-cyan-400/40 px-4 py-3 rounded-xl border border-cyan-500/20 outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 transition-all text-sm font-medium"
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-slate-900 shadow-lg shadow-cyan-500/30 transition-all active:scale-95 border border-cyan-400/30"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
