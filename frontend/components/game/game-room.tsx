"use client";

import { ChevronRight, Copy, Share2 } from "lucide-react";
import React, { useState } from "react";
import ChatRoom from "./chat-room";
import { PiChatsCircle } from "react-icons/pi";
import { Game, Player } from "@/types/game";
import toast from "react-hot-toast";

interface GameRoomProps {
  game: Game | null;
  me: Player | null;
  /** When true, used as full-width tab on mobile (no sidebar chrome) */
  isMobile?: boolean;
}

const GameRoom = ({ game, me, isMobile = false }: GameRoomProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showShare, setShowShare] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const gameRoomLink =
    typeof window !== "undefined" ? window.location.href : "https://tycoon.io/";

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(gameRoomLink);
      toast.success("Link copied to clipboard!");
      setShowShare(false);
    } catch (err) {
      console.error("Failed to copy link:", err);
      toast.error("Failed to copy link");
    }
  };

  const gameId = game?.code ?? game?.id ?? "";
  if (!gameId) return null;

  // Mobile tab layout: full-width chat, minimal chrome
  if (isMobile) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-[#010F10]">
        {/* Compact header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[#1A3A3C]/60">
          <h3 className="font-bold text-base text-white font-dmSans">
            Game Chat
          </h3>
          <button
            onClick={() => setShowShare((s) => !s)}
            className="p-2 rounded-lg text-[#869298] hover:text-cyan-400 hover:bg-[#0B191A] transition-colors"
            aria-label="Share game link"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {/* Expandable share link */}
        {showShare && (
          <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-[#0B191A]/80 border-b border-[#1A3A3C]/40">
            <input
              readOnly
              value={gameRoomLink}
              className="flex-1 bg-[#020F11] text-xs text-[#AFBAC0] px-3 py-2 rounded-lg truncate border border-[#1A3A3C]"
            />
            <button
              onClick={copyToClipboard}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-600/80 hover:bg-cyan-600 text-white text-sm font-medium transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy
            </button>
          </div>
        )}

        {/* Chat */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ChatRoom gameId={gameId} me={me} isMobile />
        </div>
      </div>
    );
  }

  // Desktop sidebar layout
  return (
    <>
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
            ? "translate-x-0 w-[85vw] sm:w-[75vw] md:w-[400px] lg:w-[320px] xl:w-[360px]"
            : "translate-x-full lg:translate-x-0 lg:w-[72px]"
          }
        `}
      >
        {!isSidebarOpen && (
          <div className="hidden lg:flex lg:flex-col lg:items-center lg:pt-10 lg:gap-10 text-[#869298]">
            <button
              onClick={toggleSidebar}
              className="p-3 hover:text-cyan-400 transition-colors rounded-full hover:bg-cyan-950/30"
              aria-label="Open chat sidebar"
            >
              <PiChatsCircle className="w-7 h-7" />
            </button>
          </div>
        )}

        {isSidebarOpen && (
          <div className="h-full flex flex-col p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSidebar}
                  className="lg:hidden text-[#869298] hover:text-white transition-colors p-1 rounded"
                  aria-label="Close chat"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
                <h4 className="font-bold text-lg text-white font-dmSans">
                  Game Chat
                </h4>
              </div>
            </div>

            {/* Shareable link - compact on desktop */}
            <div className="flex mb-4 bg-[#0B191A] rounded-xl overflow-hidden border border-[#1A3A3C]/60">
              <div
                className="flex-1 px-3 py-2.5 text-xs text-[#AFBAC0] truncate"
                title={gameRoomLink}
              >
                {gameRoomLink}
              </div>
              <button
                onClick={copyToClipboard}
                className="flex-shrink-0 px-4 py-2.5 bg-cyan-900/40 hover:bg-cyan-800/50 text-cyan-300 text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-white/5 bg-[#0A1617]">
              <ChatRoom gameId={gameId} me={me} isMobile={false} />
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default GameRoom;
