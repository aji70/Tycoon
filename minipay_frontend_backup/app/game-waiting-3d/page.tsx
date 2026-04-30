import GameWaitingClient3D from "@/clients/WaitingClient3D";

/**
 * Multiplayer 3D waiting room. When game starts, redirects to board-3d-multi (desktop) or board-3d-multi-mobile.
 */
export default function GameWaiting3DPage() {
  return (
    <main className="w-full overflow-x-hidden">
      <GameWaitingClient3D />
    </main>
  );
}
