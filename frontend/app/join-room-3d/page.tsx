"use client";

import JoinRoom from "@/components/settings/join-room";
import JoinRoomMobile from "@/components/settings/join-room-mobile";
import { useMediaQuery } from "@/components/useMediaQuery";

const REDIRECT_BOARD = "/board-3d-multi";
const REDIRECT_WAITING = "/game-waiting-3d";
const REDIRECT_CREATE = "/game-settings-3d";

/**
 * Join room for multiplayer 3D. Enter code → waiting room or 3D board. "Create new" → game-settings-3d.
 */
export default function JoinRoom3DPage() {
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <main className="w-full">
      {isMobile ? (
        <JoinRoomMobile
          redirectToBoard={REDIRECT_BOARD}
          redirectToWaiting={REDIRECT_WAITING}
          redirectCreateNew={REDIRECT_CREATE}
        />
      ) : (
        <JoinRoom
          redirectToBoard={REDIRECT_BOARD}
          redirectToWaiting={REDIRECT_WAITING}
          redirectCreateNew={REDIRECT_CREATE}
        />
      )}
    </main>
  );
}
