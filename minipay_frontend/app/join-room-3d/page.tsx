"use client";

import JoinRoomMobile from "@/components/settings/join-room-mobile";
import { useMediaQuery } from "@/components/useMediaQuery";

const REDIRECT_BOARD_MOBILE = "/board-3d-multi-mobile";
const REDIRECT_WAITING = "/game-waiting-3d";
const REDIRECT_CREATE = "/game-settings-3d";

/**
 * Join room for multiplayer 3D. Enter code → waiting room or 3D board. "Create new" → game-settings-3d.
 * Mobile users are sent to board-3d-multi-mobile when the game is running.
 */
export default function JoinRoom3DPage() {
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <main className="w-full">
      <JoinRoomMobile
        redirectToBoard={REDIRECT_BOARD_MOBILE}
        redirectToWaiting={REDIRECT_WAITING}
        redirectCreateNew={REDIRECT_CREATE}
      />
    </main>
  );
}
