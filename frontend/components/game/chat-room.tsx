"use client";

import React, { useState, useEffect } from "react";

interface Message {
  id: string;
  body: string;
  player_id: string;
  // Add timestamp, username etc. later if needed
}

interface ChatRoomProps {
  gameId: string;
}

const ChatRoom = ({ gameId }: ChatRoomProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [playerId, setPlayerId] = useState(""); // ← Replace with real auth later!
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!gameId) return;
    fetchMessages();
  }, [gameId]);

  const fetchMessages = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/messages/game/${gameId}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching messages:", err);
    } finally {
      setIsLoading(false);
    }
  };

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
      fetchMessages(); // refresh
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Failed to send message");
    }
  };

  if (!gameId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        No game selected
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="text-center text-gray-400">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            No messages yet. Say hi!
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="mb-3 p-2 bg-[#0B191A] rounded">
              <p className="text-[#AFBAC0]">{msg.body}</p>
              {/* Add sender name/timestamp later */}
            </div>
          ))
        )}
      </div>

      <div className="flex border-t border-[#1A3A3C] p-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-1 bg-[#0B191A] text-white p-3 rounded-l outline-none"
          placeholder="Type a message..."
        />
        <button
          onClick={sendMessage}
          className="bg-cyan-600 hover:bg-cyan-500 px-5 rounded-r font-medium"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatRoom;