'use client';
import React, { useState } from 'react';
import { Send, Users } from 'lucide-react';

// Define the type for chat messages
interface ChatMessage {
  sender: string;
  message: string;
}

const ChatRoom = () => {
  // State for chat messages and input
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');

  // Handle sending a chat message
  const handleSendChat = () => {
    if (chatInput.trim()) {
      setChatMessages([...chatMessages, { sender: 'You', message: chatInput }]);
      setChatInput(''); // Clear input
    }
  };

  return (
    <div
      className="w-full lg:w-[250px] h-[685px] border-[1px] border-[#263238] flex flex-col mt-4 rounded-[12px] bg-cover bg-center shadow-lg shadow-cyan-500/10"
      style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1620283088057-7d4241262d45'), linear-gradient(to bottom, rgba(14, 40, 42, 0.8), rgba(14, 40, 42, 0.8))`,
      }}
    >
      {/* Top Bar */}
      <div className="w-full h-[37px] flex justify-between items-center border-b-[1px] border-[#263238] px-4">
        <h4 className="font-[700] font-dmSans text-[#F0F7F7] text-[14px]">Chat</h4>
        <Users className="w-4 h-4 text-[#F0F7F7]" />
      </div>

      {/* Chat Content */}
      <main className="w-full h-[calc(100%-89px)] overflow-y-auto no-scrollbar p-3">
        <div className="flex flex-col gap-2">
          {chatMessages.map((msg, index) => (
            <p key={index} className="text-sm text-gray-300">
              <strong>{msg.sender}:</strong> {msg.message}
            </p>
          ))}
        </div>
      </main>

      {/* Bottom Input */}
      <div className="w-full border-t-[1px] border-[#263238] h-[52px] flex items-center gap-1 p-2">
        <input
          type="text"
          placeholder="Type a message..."
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
          className="outline-none flex-1 min-w-0 bg-[#0B191A] rounded-[20px] text-[14px] text-[#AFBAC0] font-dmSans px-4 py-2 border border-gray-600 focus:ring-2 focus:ring-cyan-500"
          aria-label="Enter chat message"
        />
        <button
          onClick={handleSendChat}
          aria-label="Send chat message"
          className="size-[32px] rounded-[20px] bg-[#010F10] border-[1px] border-[#263238] flex items-center justify-center text-[#AFBAC0] hover:bg-[#263238] transition-all duration-200"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ChatRoom;