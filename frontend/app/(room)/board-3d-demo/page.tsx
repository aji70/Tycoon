"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";
import type { Property } from "@/types/game";
import type { Player } from "@/types/game";
import { getSquareName } from "@/components/game/board3d/squareNames";

const Canvas = dynamic(
  () => import("@react-three/fiber").then((m) => m.Canvas),
  { ssr: false }
);
const BoardScene = dynamic(
  () => import("@/components/game/board3d/BoardScene").then((m) => m.default),
  { ssr: false }
);

// Same as 2D boards: fetch properties from backend for names and grid layout
function useBoardProperties() {
  const { data: apiProperties = [], isLoading, isError } = useQuery<Property[]>({
    queryKey: ["properties"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse>("/properties");
      return res.data?.success ? res.data.data : [];
    },
    staleTime: Infinity,
  });

  if (apiProperties.length >= 40) {
    return { properties: [...apiProperties].sort((a, b) => a.id - b.id), isLoading: false, fromApi: true };
  }
  return { properties: buildMockProperties(), isLoading, fromApi: false };
}

// Fallback when API fails or returns no data (same structure as backend: id, name, type, grid_row, grid_col)
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

const SYMBOLS = ["hat", "car", "ship", "dog", "shoe", "thimble", "wheelbarrow", "boot"];

// 8 dummy players spread around the board; user_id 1 = "Me" (current player)
function buildMockPlayers(): Player[] {
  const positions = [0, 5, 10, 15, 20, 25, 30, 35];
  return Array.from({ length: 8 }, (_, i) => ({
    user_id: i + 1,
    address: `0x${i + 1}`,
    balance: 1500,
    position: positions[i],
    symbol: SYMBOLS[i],
    username: i === 0 ? "Me" : `Player ${i + 1}`,
    rolls: 0,
    turn_order: i,
    joined_date: "",
    chance_jail_card: 0,
    community_chest_jail_card: 0,
    circle: 0,
    in_jail: false,
    in_jail_rolls: 0,
  })) as Player[];
}

const mockPlayers = buildMockPlayers();

// Demo: show developable property with 0, 1, 2, 3, 4 houses and hotel (first 6 color-group properties)
const demoDevelopmentByPropertyId: Record<number, number> = {
  1: 0,  // 0 houses
  3: 1,  // 1 house
  6: 2,  // 2 houses
  8: 3,  // 3 houses
  9: 4,  // 4 houses
  11: 5, // hotel
};

/** Initial positions: 8 players spread around the board */
const initialPositions: Record<number, number> = Object.fromEntries(
  mockPlayers.map((p, i) => [p.user_id, [0, 5, 10, 15, 20, 25, 30, 35][i]])
);

/**
 * UI-only 3D board demo. Fetches properties from backend (same as 2D boards) for names and layout.
 * Route: /board-3d-demo
 */
export default function Board3DDemoPage() {
  const { properties, isLoading, fromApi } = useBoardProperties();
  const [animatedPositions, setAnimatedPositions] = useState<Record<number, number>>(initialPositions);
  const [lastRoll, setLastRoll] = useState<number | null>(null);

  const handleRoll = useCallback(() => {
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    const total = d1 + d2;
    setLastRoll(total);
    setAnimatedPositions((prev) => {
      const next: Record<number, number> = {};
      mockPlayers.forEach((p) => {
        const current = prev[p.user_id] ?? p.position;
        next[p.user_id] = (current + total) % 40;
      });
      return next;
    });
  }, []);

  return (
    <div className="w-full min-h-screen bg-[#010F10] flex flex-col items-center justify-center p-4">
      <p className="text-cyan-400 text-sm mb-2">
        3D board (UI only — drag to rotate, scroll to zoom)
        {fromApi ? " · Names from backend" : " · Using fallback names"}
        <span className="text-slate-500 block mt-1">Hover a square to see its name</span>
        <span className="text-emerald-400/90 text-xs block mt-1">Development demo: Mediterranean (0) → Baltic (1) → Oriental (2) → Vermont (3) → Connecticut (4) → St. Charles (hotel)</span>
      </p>
      <button
        type="button"
        onClick={handleRoll}
        className="mt-3 px-6 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold transition-colors shadow-lg"
      >
        Roll
      </button>
      {lastRoll !== null && (
        <p className="text-cyan-300/90 text-sm mt-2">Last roll: {lastRoll} — all players advanced</p>
      )}
      {isLoading ? (
        <p className="text-slate-400 mt-4">Loading board...</p>
      ) : (
        <div className="w-full max-w-[800px] aspect-square rounded-xl overflow-hidden border border-cyan-500/30 shadow-2xl mt-4">
          <Canvas
            camera={{ position: [0, 12, 12], fov: 45 }}
            shadows
            gl={{ antialias: true, alpha: false }}
          >
            <BoardScene
              properties={properties}
              players={mockPlayers}
              animatedPositions={animatedPositions}
              currentPlayerId={1}
              developmentByPropertyId={demoDevelopmentByPropertyId}
            />
          </Canvas>
        </div>
      )}
    </div>
  );
}
