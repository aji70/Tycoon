"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useAccount } from "wagmi";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { useMediaQuery } from "@/components/useMediaQuery";
import { MessageCircle, Users } from "lucide-react";
import ModalErrorBoundary from "@/components/game/board3d/ModalErrorBoundary";

const LobbyChatRoom = dynamic(
  () => import("@/components/game/board3d/LobbyChatRoom"),
  { ssr: false, loading: () => (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-3">
      <div className="w-10 h-10 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
      <span className="text-sm text-cyan-400/80 font-medium">Loading chat…</span>
    </div>
  ) }
);

function RoomsLoadingPlaceholder() {
  return (
    <div className="flex-1 min-h-[400px] flex flex-col items-center justify-center rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-[#0a1214] to-[#061012]">
      <div className="w-10 h-10 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
      <span className="text-sm text-cyan-400/80 font-medium mt-3">Loading…</span>
    </div>
  );
}

export default function RoomsPage() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const onlineAddress = mounted && (isConnected || !!guestUser) ? (guestUser?.address ?? address ?? undefined) : undefined;
  const { onlineCount } = useOnlineUsers(onlineAddress, { enabled: mounted });
  const isMobile = useMediaQuery("(max-width: 768px)");

  useEffect(() => {
    setMounted(true);
  }, []);

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
          {mounted && (isConnected || guestUser) && onlineCount != null && (
            <p className="flex items-center gap-2 text-cyan-400/70 text-sm mt-1">
              <Users className="w-4 h-4" />
              <span>{onlineCount} {onlineCount === 1 ? "player" : "players"} online</span>
            </p>
          )}
        </div>

        <div className="flex-1 min-h-[400px] flex flex-col rounded-2xl overflow-hidden border border-cyan-500/20 bg-gradient-to-b from-[#0a1214] to-[#061012] shadow-xl">
          {!mounted ? (
            <RoomsLoadingPlaceholder />
          ) : (
            <ModalErrorBoundary
              fallbackTitle="Something went wrong loading the room."
              fallbackSubtext="Try refreshing the page. If it keeps happening, check the browser console for details."
              showStack
            >
              <LobbyChatRoom
                address={displayAddress ?? undefined}
                userId={currentUserId ?? undefined}
                username={currentUsername ?? undefined}
                isMobile={isMobile}
                showHeader={false}
              />
            </ModalErrorBoundary>
          )}
        </div>
      </div>
    </main>
  );
}
