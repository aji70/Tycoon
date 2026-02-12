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
  gameId: string | number; // game code or id - backend supports both
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

function getInitial(name?: string | null) {
  if (!name?.trim()) return "?";
  return name.charAt(0).toUpperCase();
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

    // Optimistic update
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
      // Revert optimistic update
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
      {/* Messages area */}
      <div
        className={`flex-1 overflow-y-auto scrollbar-hide ${
          isMobile ? "p-3 min-h-[200px]" : "p-4"
        }`}
        style={{ background: "linear-gradient(180deg, #020F11 0%, #0A1617 100%)" }}
      >
        {isLoading && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[120px] gap-2">
            <div className="w-8 h-8 border-2 border-cyan-500/50 border-t-cyan-400 rounded-full animate-spin" />
            <span className="text-sm text-[#869298]">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[160px] text-center px-4">
            <div className="w-14 h-14 rounded-full bg-cyan-900/20 flex items-center justify-center mb-3">
              <MessageCircle className="w-7 h-7 text-cyan-500/60" />
            </div>
            <p className="text-[#869298] font-medium">No messages yet</p>
            <p className="text-[#5a6b70] text-sm mt-1">
              Be the first to say hi! 👋
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isMe = String(msg.player_id) === playerId;
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      isMe
                        ? "bg-cyan-500/80 text-white"
                        : "bg-[#1A3A3C] text-cyan-300"
                    }`}
                  >
                    {isMe ? getInitial(me?.username) : getInitial(msg.username)}
                  </div>
                  <div
                    className={`flex flex-col max-w-[75%] sm:max-w-[80%] ${
                      isMe ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`px-4 py-2.5 rounded-2xl shadow-sm ${
                        isMe
                          ? "bg-cyan-600/90 text-white rounded-br-md"
                          : "bg-[#0B191A] text-[#E2E8F0] border border-white/5 rounded-bl-md"
                      }`}
                    >
                      <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                        {msg.body}
                      </p>
                    </div>
                    {msg.created_at && !String(msg.id).startsWith("temp-") && (
                      <span
                        className={`text-[10px] text-[#5a6b70] mt-1 ${
                          isMe ? "mr-1" : "ml-1"
                        }`}
                      >
                        {formatTime(msg.created_at)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 p-3 border-t border-[#1A3A3C]/80 bg-[#0A1617]">
        {!canSend ? (
          <div className="text-center py-2 text-sm text-[#5a6b70]">
            Join the game to send messages
          </div>
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
              placeholder="Type a message..."
              maxLength={500}
              className="flex-1 bg-[#020F11] text-white placeholder-[#5a6b70] px-4 py-3 rounded-xl border border-[#1A3A3C] 
                outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all text-[15px]"
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="flex-shrink-0 w-12 h-12 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 
                disabled:cursor-not-allowed flex items-center justify-center text-white transition-all 
                active:scale-95"
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatRoom;
