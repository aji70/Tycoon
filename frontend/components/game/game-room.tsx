"use client";

import { ChevronRight, Copy, Settings } from "lucide-react";
import React, { useState } from "react";
import ChatRoom from "./chat-room";
import { PiChatsCircle } from "react-icons/pi";

interface GameRoomProps {
  gameId: string;
}

const GameRoom = ({ gameId }: GameRoomProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  // Get current URL for sharing
  const gameRoomLink =
    typeof window !== "undefined" ? window.location.href : "https://tycoon.io/";

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(gameRoomLink);
      alert("Link copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy link:", err);
      alert("Failed to copy link. Please try again.");
    }
  };

  return (
    <>
      {/* Floating toggle button when sidebar is closed (mobile + desktop) */}
      {!isSidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="fixed top-4 right-4 z-30 lg:top-6 lg:right-8 bg-[#0B191A]/90 backdrop-blur-sm 
            text-cyan-400 hover:text-cyan-300 p-3 rounded-full shadow-lg border border-cyan-500/30 
            transition-all hover:scale-105 lg:hidden xl:block"
          aria-label="Open chat"
        >
          <PiChatsCircle className="w-6 h-6" />
        </button>
      )}

      <aside
        className={`
          h-full bg-[#010F10] border-l border-white/10 overflow-hidden
          transition-all duration-300 ease-in-out
          fixed top-0 right-0 z-20 lg:static lg:z-auto
          ${isSidebarOpen
            ? "translate-x-0 w-[85vw] sm:w-[75vw] md:w-[420px] lg:w-[300px] xl:w-[320px]"
            : "translate-x-full lg:translate-x-0 lg:w-[72px]"
          }
        `}
      >
        {/* Collapsed state (desktop only) - just icon */}
        {!isSidebarOpen && (
          <div className="hidden lg:flex lg:flex-col lg:items-center lg:pt-10 lg:gap-10 text-[#869298]">
            <button
              onClick={toggleSidebar}
              className="p-3 hover:text-cyan-400 transition-colors rounded-full hover:bg-cyan-950/30"
              aria-label="Open chat sidebar"
            >
              <PiChatsCircle className="w-7 h-7" />
            </button>
            {/* You can add more quick action icons here later */}
          </div>
        )}

        {/* Full content when open */}
        {isSidebarOpen && (
          <div className="h-full flex flex-col p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSidebar}
                  className="lg:hidden text-[#869298] hover:text-white transition-colors"
                  aria-label="Close chat"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
                <h4 className="font-bold text-lg text-white font-dmSans">
                  Game Chat
                </h4>
              </div>

              <button
                className="text-[#869298] hover:text-cyan-400 transition-colors p-2 rounded-full hover:bg-[#0B191A]"
                aria-label="Chat settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>

            {/* Shareable link */}
            <div className="flex mb-5 bg-[#0B191A] rounded-lg overflow-hidden border border-cyan-900/30">
              <div
                className="flex-1 px-3 py-2.5 text-xs text-[#AFBAC0] font-medium truncate"
                title={gameRoomLink}
              >
                {gameRoomLink}
              </div>
              <button
                onClick={copyToClipboard}
                className="bg-cyan-900/40 px-4 flex items-center gap-2 text-sm text-cyan-300 hover:bg-cyan-800/40 transition-colors"
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-hidden rounded-lg border border-white/5 bg-[#0A1617]">
              <ChatRoom gameId={gameId} />
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default GameRoom;