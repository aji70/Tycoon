"use client";

import { useAccount } from "wagmi";
import LobbyChatRoom from "@/components/game/board3d/LobbyChatRoom";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { useMediaQuery } from "@/components/useMediaQuery";
import { MessageCircle, Users } from "lucide-react";

export default function RoomsPage() {
  const { address, isConnected } = useAccount();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const { onlineCount } = useOnlineUsers(isConnected ? address : undefined);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const displayAddress = guestUser?.address ?? address ?? undefined;
  const currentUserId = guestUser?.id ?? undefined;
  const currentUsername = guestUser?.username ?? undefined;

  return (
    <main className="w-full min-h-screen bg-[#010F10] flex flex-col">
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white font-orbitron tracking-tight flex items-center gap-3">
            <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-400/30">
              <MessageCircle className="w-6 h-6 text-cyan-400" />
            </span>
            Rooms
          </h1>
          <p className="text-cyan-400/80 text-sm mt-2 font-dmSans">
            General lobby — chat with everyone online. Create or join games from Home.
          </p>
          {isConnected && onlineCount != null && (
            <p className="flex items-center gap-2 text-cyan-400/70 text-sm mt-1">
              <Users className="w-4 h-4" />
              <span>{onlineCount} {onlineCount === 1 ? "player" : "players"} online</span>
            </p>
          )}
        </div>

        <div className="flex-1 min-h-[400px] flex flex-col rounded-2xl overflow-hidden border border-cyan-500/20 bg-gradient-to-b from-[#0a1214] to-[#061012] shadow-xl">
          <LobbyChatRoom
            address={displayAddress}
            userId={currentUserId}
            username={currentUsername}
            isMobile={isMobile}
            showHeader={false}
          />
        </div>
      </div>
    </main>
  );
}
