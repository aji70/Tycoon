"use client";

import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Message {
  id: string;
  body: string;
  player_id: string;
  created_at?: string;           // ← add this later from backend if possible
  // username?: string;          // nice to have
}

interface ChatRoomProps {
  gameId: string;
}

const POLLING_INTERVAL = 4000; // 4 seconds – adjust 3000–8000 based on game pace

const fetchMessages = async (gameId: string): Promise<Message[]> => {
  const response = await fetch(`/api/messages/game/${gameId}`);
  if (!response.ok) throw new Error("Failed to fetch messages");
  const data = await response.json();
  return Array.isArray(data) ? data : [];
};

const ChatRoom = ({ gameId }: ChatRoomProps) => {
  const [newMessage, setNewMessage] = useState("");
  const [playerId, setPlayerId] = useState(""); // ← TODO: get real player_id / address from auth/wagmi
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["messages", gameId],
    queryFn: () => fetchMessages(gameId),
    refetchInterval: POLLING_INTERVAL,
    refetchOnWindowFocus: true,     // nice bonus
    staleTime: 2000,                // don't refetch too aggressively
    gcTime: 10 * 60 * 1000,         // keep in cache longer
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !gameId || !playerId) return;

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_id: gameId,
          player_id: playerId,
          body: newMessage.trim(),
        }),
      });

      if (!response.ok) throw new Error("Failed to send");

      setNewMessage("");

      // Optimistic update + invalidate
      queryClient.setQueryData<Message[]>(["messages", gameId], (old = []) => [
        ...old,
        {
          id: "temp-" + Date.now(), // temp id
          body: newMessage.trim(),
          player_id: playerId,
        },
      ]);

      // Refetch will replace temp with real data
      queryClient.invalidateQueries({ queryKey: ["messages", gameId] });
    } catch (err) {
      console.error(err);
      alert("Failed to send message");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#020F11]">
        {isLoading && messages.length === 0 ? (
          <div className="text-center text-gray-400">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            No messages yet. Be the first to say hi! 👋
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-3 rounded-lg max-w-[85%] ${
                msg.player_id === playerId
                  ? "ml-auto bg-cyan-900/40 text-white"
                  : "bg-[#0B191A] text-[#AFBAC0]"
              }`}
            >
              <p>{msg.body}</p>
              {/* <small className="opacity-60">{msg.created_at || "..."}</small> */}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex border-t border-[#1A3A3C] p-2 gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
          className="flex-1 bg-[#0B191A] text-white p-3 rounded outline-none focus:ring-1 focus:ring-cyan-600"
          placeholder="Type a message..."
        />
        <button
          onClick={sendMessage}
          disabled={!newMessage.trim()}
          className="bg-cyan-600 hover:bg-cyan-500 px-6 rounded font-medium disabled:opacity-50 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatRoom;