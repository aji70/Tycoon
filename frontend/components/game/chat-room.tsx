"use client";

import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Send, MessageCircle } from "lucide-react";
import { Player } from "@/types/game";
import toast from "react-hot-toast";

interface Message {
  id: string | number;
  body: string;
  player_id: string;
  created_at?: string;
  username?: string | null;
}

interface ChatRoomProps {
  gameId: string | number;
  me: Player | null;
  isMobile?: boolean;
}

const POLLING_INTERVAL = 3000;

const fetchMessages = async (gameId: string | number): Promise<Message[]> => {
  const res = await apiClient.get<{ data?: Message[] }>(`/messages/game/${gameId}`);
  const payload = (res as { data?: { data?: Message[] } })?.data;
  const list = payload?.data ?? payload;
  return Array.isArray(list) ? list : [];
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

function getDisplayName(msg: Message, me: Player | null, playerId: string) {
  const isMe = String(msg.player_id) === playerId;
  if (isMe && me?.username) return me.username;
  return msg.username ?? "Player";
}

const ChatRoom = ({ gameId, me, isMobile = false }: ChatRoomProps) => {
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const playerId = me?.id != null ? String(me.id) : "";
  const canSend = !!playerId;

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["messages", gameId],
    queryFn: () => fetchMessages(gameId),
    refetchInterval: POLLING_INTERVAL,
    refetchOnWindowFocus: true,
    staleTime: 2000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !gameId || !playerId || sending) return;

    setSending(true);
    const trimmed = newMessage.trim();
    setNewMessage("");

    queryClient.setQueryData<Message[]>(["messages", gameId], (old = []) => [
      ...old,
      {
        id: "temp-" + Date.now(),
        body: trimmed,
        player_id: playerId,
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      await apiClient.post("/messages", {
        game_id: gameId,
        player_id: playerId,
        body: trimmed,
      });
      queryClient.invalidateQueries({ queryKey: ["messages", gameId] });
    } catch (err: unknown) {
      queryClient.setQueryData<Message[]>(["messages", gameId], (old = []) =>
        old.filter((m) => !String(m.id).startsWith("temp-"))
      );
      setNewMessage(trimmed);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to send message";
      toast.error(msg);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div
        className={`flex-1 overflow-y-auto scrollbar-hide ${
          isMobile ? "px-4 py-4 min-h-[200px]" : "px-5 py-5"
        }`}
      >
        {isLoading && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[140px] gap-3">
            <div className="w-10 h-10 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            <span className="text-sm text-cyan-400/70 font-medium">Loading chat...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 flex items-center justify-center mb-4 ring-1 ring-cyan-400/20">
              <MessageCircle className="w-8 h-8 text-cyan-400/70" />
            </div>
            <p className="text-white/90 font-semibold text-lg">No messages yet</p>
            <p className="text-cyan-400/60 text-sm mt-1.5">
              Start the conversation — say hi! 👋
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((msg) => {
              const isMe = String(msg.player_id) === playerId;
              const displayName = getDisplayName(msg, me, playerId);
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  {/* Username above message */}
                  <div className={`flex items-center gap-2 mb-1.5 ${isMe ? "flex-row-reverse" : ""}`}>
                    <span className={`text-xs font-semibold tracking-wide ${
                      isMe ? "text-cyan-400" : "text-cyan-400/80"
                    }`}>
                      {displayName}
                    </span>
                    {msg.created_at && !String(msg.id).startsWith("temp-") && (
                      <span className="text-[10px] text-white/40 tabular-nums">
                        {formatTime(msg.created_at)}
                      </span>
                    )}
                  </div>
                  {/* Message bubble */}
                  <div
                    className={`max-w-[85%] px-4 py-2.5 rounded-2xl ${
                      isMe
                        ? "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/20 rounded-br-md"
                        : "bg-white/5 text-white/95 border border-white/10 rounded-bl-md backdrop-blur-sm"
                    }`}
                  >
                    <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                      {msg.body}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-4 bg-[#060a0b]/80 border-t border-white/5 backdrop-blur-sm">
        {!canSend ? (
          <div className="text-center py-3 text-sm text-white/40 font-medium">
            Join the game to send messages
          </div>
        ) : (
          <div className="flex gap-3">
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
              placeholder="Type a message..."
              maxLength={500}
              className="flex-1 bg-white/5 text-white placeholder-white/30 px-5 py-3.5 rounded-xl 
                border border-white/10 outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 
                transition-all text-[15px] font-medium"
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 
                hover:from-cyan-400 hover:to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed 
                flex items-center justify-center text-white shadow-lg shadow-cyan-500/25 
                transition-all active:scale-95"
              aria-label="Send message"
            >
              <Send className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatRoom;
