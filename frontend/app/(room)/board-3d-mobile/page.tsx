"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";
import type { Property } from "@/types/game";
import { getSquareName } from "@/components/game/board3d/squareNames";

const Canvas = dynamic(
  () => import("@react-three/fiber").then((m) => m.Canvas),
  { ssr: false }
);
const BoardScene = dynamic(
  () => import("@/components/game/board3d/BoardScene").then((m) => m.default),
  { ssr: false }
);

// Same property source as desktop 3D: API or mock (no edits to 2D)
function useBoardProperties() {
  const { data: apiProperties = [], isLoading } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse>("/properties");
      return res.data?.success ? res.data.data : [];
    },
    staleTime: Infinity,
  });

  if (apiProperties.length >= 40) {
    return { properties: [...apiProperties].sort((a, b) => a.id - b.id), isLoading: false };
  }
  return { properties: buildMockProperties(), isLoading };
}

function buildMockProperties(): Property[] {
  const positions: ("top" | "bottom" | "left" | "right")[] = [];
  for (let i = 0; i < 40; i++) {
    if (i <= 9) positions.push("bottom");
    else if (i <= 19) positions.push("left");
    else if (i <= 29) positions.push("top");
    else positions.push("right");
  }

  const squares: { id: number; type: Property["type"]; color: string }[] = [
    { id: 0, type: "corner", color: "#2ecc71" },
    { id: 1, type: "property", color: "#8B4513" },
    { id: 2, type: "community_chest", color: "#8B4513" },
    { id: 3, type: "property", color: "#8B4513" },
    { id: 4, type: "income_tax", color: "#fff" },
    { id: 5, type: "property", color: "railroad" },
    { id: 6, type: "property", color: "#87CEEB" },
    { id: 7, type: "chance", color: "#87CEEB" },
    { id: 8, type: "property", color: "#87CEEB" },
    { id: 9, type: "property", color: "#87CEEB" },
    { id: 10, type: "corner", color: "#7f8c8d" },
    { id: 11, type: "property", color: "#FF69B4" },
    { id: 12, type: "property", color: "utility" },
    { id: 13, type: "property", color: "#FF69B4" },
    { id: 14, type: "property", color: "#FF69B4" },
    { id: 15, type: "property", color: "railroad" },
    { id: 16, type: "property", color: "#FFA500" },
    { id: 17, type: "community_chest", color: "#FFA500" },
    { id: 18, type: "property", color: "#FFA500" },
    { id: 19, type: "property", color: "#FFA500" },
    { id: 20, type: "corner", color: "#3498db" },
    { id: 21, type: "property", color: "#FF0000" },
    { id: 22, type: "chance", color: "#FF0000" },
    { id: 23, type: "property", color: "#FF0000" },
    { id: 24, type: "property", color: "#FF0000" },
    { id: 25, type: "property", color: "railroad" },
    { id: 26, type: "property", color: "#FFD700" },
    { id: 27, type: "property", color: "#FFD700" },
    { id: 28, type: "property", color: "utility" },
    { id: 29, type: "property", color: "#FFD700" },
    { id: 30, type: "corner", color: "#e74c3c" },
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
    name: getSquareName(s.id),
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

/** Board height as % of viewport — same as before nav bar was removed (72.9%). */
const BOARD_HEIGHT_PCT = 72.9;

/**
 * Minimal mobile 3D board — properties only, landscape-first.
 * Route: /board-3d-mobile (no gameCode; skeletal UI to score arrangement).
 * No page nav bar; global hamburger only. Board uses same % of screen as before.
 */
export default function Board3DMobilePage() {
  const { properties, isLoading } = useBoardProperties();

  const emptyPlayers = useMemo(() => [], []);
  const emptyPositions = useMemo(() => ({}), []);

  return (
    <div
      className="fixed inset-0 w-full bg-[#010F10] overflow-hidden"
      style={{ height: "100dvh" }}
    >
      {/* Board: same percentage of viewport as before (no full bleed) */}
      <main
        className="w-full relative overflow-hidden"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: `${BOARD_HEIGHT_PCT}%`,
        }}
      >
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-slate-400">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-500/50 border-t-cyan-400 animate-spin" />
            <p className="text-sm">Loading board…</p>
          </div>
        ) : (
          <div
            className="absolute inset-0 w-full h-full overflow-hidden"
            style={{ touchAction: "none" }}
          >
            <Canvas
              camera={{ position: [0, 12, 12], fov: 45 }}
              shadows
              gl={{ antialias: true, alpha: false }}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                display: "block",
              }}
            >
              <BoardScene
                properties={properties}
                players={emptyPlayers}
                animatedPositions={emptyPositions}
                currentPlayerId={null}
                developmentByPropertyId={{}}
              />
            </Canvas>
          </div>
        )}
      </main>
    </div>
  );
}
