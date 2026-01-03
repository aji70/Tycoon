"use client";
import { ChevronRight, Copy, Settings } from "lucide-react";
import React, { useState } from "react";
import ChatRoom from "./chat-room";
import { PiChatsCircle } from "react-icons/pi";

const GameRoom = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Get the current browser URL
  const gameRoomLink =
    typeof window !== "undefined"
      ? window.location.href
      : "https://tycoon.io/";

  // Function to copy the link to clipboard
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
      {!isSidebarOpen && (
        <button
          type="button"
          onClick={toggleSidebar}
          className="absolute top-0 right-0 bg-[#010F10] z-10 lg:hidden text-[#869298] hover:text-[#F0F7F7] w-[40px] h-[40px] rounded-s-[8px] flex items-center justify-center border-[1px] border-white/10"
          aria-label="Toggle sidebar"
        >
          <PiChatsCircle className="w-5 h-5" />
        </button>
      )}
      <aside
        className={`
          h-full overflow-y-auto no-scrollbar bg-[#010F10] p-4 rounded-s-[12px] border-l-[1px] border-white/10
          transition-all duration-300 ease-in-out
          fixed z-20 top-0 right-0 
          transform ${
            isSidebarOpen
              ? "translate-x-0 lg:translate-x-0"
              : "translate-x-full lg:translate-x-0"
          }
          lg:static lg:transform-none
          ${
            isSidebarOpen
              ? "lg:w-[272px] md:w-1/2 w-full"
              : "lg:w-[60px] w-full"
          }
        `}
      >
        <div className="w-full h-full flex flex-col gap-3">
          {/* Toggle button with changing icon */}
          <button
            type="button"
            onClick={toggleSidebar}
            className="text-[#869298] hover:text-[#F0F7F7] lg:hidden"
            aria-label="Toggle sidebar"
          >
            {isSidebarOpen ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <PiChatsCircle className="size-[25px]" />
            )}
          </button>
          <div
            className={`w-full flex justify-between items-center ${
              !isSidebarOpen && "hidden"
            }`}
          >
            {/* Show only when the sidebar is open */}
            <h4
              className={"font-[700] font-dmSans md:text-[16px] text-[#F0F7F7]"}
            >
              Game Room
            </h4>
            {/* Settings button */}
            <button
              type="button"
              className="text-[#869298] hover:text-[#F0F7F7] bg-[#0B191A] size-[32px] rounded-full flex justify-center items-center cursor-pointer"
              aria-label="Open settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* Game Room Link */}
          <div
            className={`
              w-full flex
              transition-opacity duration-200
              ${isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"}
            `}
          >
            <div
              className="flex-1 overflow-x-auto no-scrollbar bg-[#0B191A] px-[12px] py-[8px] rounded-s-[12px] text-[#AFBAC0] text-[12px] font-dmSans font-medium"
              title={gameRoomLink}
            >
              {gameRoomLink}
            </div>
            <button
              type="button"
              onClick={copyToClipboard}
              className="bg-[#0E282A] w-[81px] py-[8px] rounded-e-[12px] text-[#AFBAC0] text-[12px] font-dmSans font-medium flex justify-center items-center gap-[6px] cursor-pointer hover:bg-[#1A3A3C] transition-all duration-300"
              aria-label="Copy game room link"
            >
              <Copy className="w-4 h-4" />
              Copy
            </button>
          </div>

          {/* Chat Room */}
          {isSidebarOpen && <ChatRoom />}
        </div>
      </aside>
    </>
  );
};

export default GameRoom;
