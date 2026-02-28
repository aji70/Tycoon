"use client";

import dynamic from "next/dynamic";
import type { Property } from "@/types/game";
import type { Player } from "@/types/game";

const Canvas = dynamic(
  () => import("@react-three/fiber").then((m) => m.Canvas),
  { ssr: false }
);
const BoardScene = dynamic(
  () => import("@/components/game/board3d/BoardScene").then((m) => m.default),
  { ssr: false }
);

// Classic Monopoly-style 40 squares with correct types for 3D shapes
function buildMockProperties(): Property[] {
  const positions: ("top" | "bottom" | "left" | "right")[] = [];
  for (let i = 0; i < 40; i++) {
    if (i <= 9) positions.push("bottom");
    else if (i <= 19) positions.push("left");
    else if (i <= 29) positions.push("top");
    else positions.push("right");
  }

  const squares: { id: number; type: Property["type"]; color: string }[] = [
    { id: 0, type: "corner", color: "#2ecc71" },           // GO
    { id: 1, type: "property", color: "#8B4513" },        // Mediterranean
    { id: 2, type: "community_chest", color: "#8B4513" },
    { id: 3, type: "property", color: "#8B4513" },
    { id: 4, type: "income_tax", color: "#fff" },
    { id: 5, type: "property", color: "railroad" },      // Railroad
    { id: 6, type: "property", color: "#87CEEB" },
    { id: 7, type: "chance", color: "#87CEEB" },
    { id: 8, type: "property", color: "#87CEEB" },
    { id: 9, type: "property", color: "#87CEEB" },
    { id: 10, type: "corner", color: "#7f8c8d" },         // Jail
    { id: 11, type: "property", color: "#FF69B4" },
    { id: 12, type: "property", color: "utility" },      // Electric
    { id: 13, type: "property", color: "#FF69B4" },
    { id: 14, type: "property", color: "#FF69B4" },
    { id: 15, type: "property", color: "railroad" },
    { id: 16, type: "property", color: "#FFA500" },
    { id: 17, type: "community_chest", color: "#FFA500" },
    { id: 18, type: "property", color: "#FFA500" },
    { id: 19, type: "property", color: "#FFA500" },
    { id: 20, type: "corner", color: "#3498db" },        // Free Parking
    { id: 21, type: "property", color: "#FF0000" },
    { id: 22, type: "chance", color: "#FF0000" },
    { id: 23, type: "property", color: "#FF0000" },
    { id: 24, type: "property", color: "#FF0000" },
    { id: 25, type: "property", color: "railroad" },
    { id: 26, type: "property", color: "#FFD700" },
    { id: 27, type: "property", color: "#FFD700" },
    { id: 28, type: "property", color: "utility" },      // Water
    { id: 29, type: "property", color: "#FFD700" },
    { id: 30, type: "corner", color: "#e74c3c" },        // Go to Jail
    { id: 31, type: "property", color: "#228B22" },
    { id: 32, type: "property", color: "#228B22" },
    { id: 33, type: "community_chest", color: "#228B22" },
    { id: 34, type: "property", color: "#228B22" },
    { id: 35, type: "property", color: "railroad" },
    { id: 36, type: "chance", color: "#0000CD" },
    { id: 37, type: "property", color: "#0000CD" },
    { id: 38, type: "luxury_tax", color: "#0000CD" },
    { id: 39, type: "property", color: "#0000CD" },
  ];

  return squares.map((s, idx) => ({
    ...s,
    name: `Square ${s.id}`,
    group_id: Math.floor(s.id / 10),
    position: positions[idx],
    grid_row: s.id <= 9 ? 11 : s.id <= 19 ? 11 - (s.id - 10) : s.id <= 29 ? 1 : (s.id - 30) + 1,
    grid_col: s.id <= 9 ? 11 - s.id : s.id <= 19 ? 1 : s.id <= 29 ? (s.id - 20) + 1 : 11,
    price: 0,
    rent_site_only: 0,
    rent_one_house: 0,
    rent_two_houses: 0,
    rent_three_houses: 0,
    rent_four_houses: 0,
    rent_hotel: 0,
    cost_of_house: 0,
    is_mortgaged: false,
  })) as Property[];
}

// Mock 2 players at different positions
function buildMockPlayers(): Player[] {
  return [
    { user_id: 1, address: "0x1", balance: 1500, position: 5, symbol: "hat", username: "Player 1", rolls: 0, turn_order: 0, joined_date: "", chance_jail_card: 0, community_chest_jail_card: 0, circle: 0, in_jail: false, in_jail_rolls: 0 } as Player,
    { user_id: 2, address: "0x2", balance: 1500, position: 12, symbol: "car", username: "Player 2", rolls: 0, turn_order: 1, joined_date: "", chance_jail_card: 0, community_chest_jail_card: 0, circle: 0, in_jail: false, in_jail_rolls: 0 } as Player,
  ];
}

const mockProperties = buildMockProperties();
const mockPlayers = buildMockPlayers();
const mockAnimatedPositions: Record<number, number> = { 1: 5, 2: 12 };
const mockCurrentPlayerId = 1;

/**
 * UI-only 3D board demo. No game logic, no API.
 * Route: /board-3d-demo
 */
export default function Board3DDemoPage() {
  return (
    <div className="w-full min-h-screen bg-[#010F10] flex flex-col items-center justify-center p-4">
      <p className="text-cyan-400 text-sm mb-4">3D board (UI only — drag to rotate, scroll to zoom)</p>
      <div className="w-full max-w-[800px] aspect-square rounded-xl overflow-hidden border border-cyan-500/30 shadow-2xl">
        <Canvas
          camera={{ position: [0, 12, 12], fov: 45 }}
          shadows
          gl={{ antialias: true, alpha: false }}
        >
          <BoardScene
            properties={mockProperties}
            players={mockPlayers}
            animatedPositions={mockAnimatedPositions}
            currentPlayerId={mockCurrentPlayerId}
          />
        </Canvas>
      </div>
    </div>
  );
}
