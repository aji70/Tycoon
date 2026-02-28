"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";
import type { Property, Player, History, Game, GameProperty } from "@/types/game";
import { getSquareName } from "@/components/game/board3d/squareNames";
import ActionLog from "@/components/game/ai-board/action-log";
import { getPlayerSymbol } from "@/lib/types/symbol";

const MOVE_ANIMATION_MS_PER_SQUARE = 250;

function makeHistoryEntry(id: number, player_name: string, comment: string, rolled: number): History {
  return {
    id,
    game_id: 0,
    game_player_id: 0,
    rolled,
    old_position: null,
    new_position: 0,
    action: "",
    amount: 0,
    extra: { description: "" },
    comment,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    active: 1,
    player_symbol: "hat",
    player_name,
  };
}

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

// Game tokens from lib/types/symbol: hat, car, dog, thimble, iron, battleship, boot, wheelbarrow
const SYMBOLS = ["hat", "car", "dog", "thimble", "iron", "battleship", "boot", "wheelbarrow"];

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
 * 3D board demo. With ?gameCode=XXX loads that game from backend (players, positions, development).
 * Without gameCode uses mock data. Route: /board-3d-demo or /board-3d-demo?gameCode=ABC123
 */
export default function Board3DDemoPage() {
  const searchParams = useSearchParams();
  const gameCode = searchParams.get("gameCode")?.trim().toUpperCase() || null;

  const { properties, isLoading, fromApi } = useBoardProperties();
  const { data: game, isLoading: gameLoading } = useQuery<Game>({
    queryKey: ["game", gameCode ?? ""],
    queryFn: async () => {
      if (!gameCode) throw new Error("No code");
      const res = await apiClient.get<ApiResponse>(`/games/code/${gameCode}`);
      if (!res.data?.success) throw new Error("Game not found");
      return res.data.data;
    },
    enabled: !!gameCode && gameCode.length === 6,
    refetchInterval: gameCode ? 5000 : false,
  });
  const { data: gameProperties = [] } = useQuery<GameProperty[]>({
    queryKey: ["game_properties", game?.id],
    queryFn: async () => {
      if (!game?.id) return [];
      const res = await apiClient.get<ApiResponse>(`/game-properties/game/${game.id}`);
      return res.data?.success ? res.data.data : [];
    },
    enabled: !!game?.id,
  });

  const isLiveGame = !!gameCode && !!game;
  const livePlayers = useMemo(() => game?.players ?? [], [game?.players]);
  const liveAnimatedPositions = useMemo(() => {
    const out: Record<number, number> = {};
    livePlayers.forEach((p) => {
      out[p.user_id] = p.position ?? 0;
    });
    return out;
  }, [livePlayers]);
  const liveDevelopmentByPropertyId = useMemo(() => {
    const out: Record<number, number> = {};
    gameProperties.forEach((gp) => {
      out[gp.property_id] = gp.development ?? 0;
    });
    return out;
  }, [gameProperties]);
  const currentPlayerId = game?.next_player_id ?? null;

  const [animatedPositions, setAnimatedPositions] = useState<Record<number, number>>(initialPositions);
  const [lastRollResult, setLastRollResult] = useState<{ die1: number; die2: number; total: number } | null>(null);
  const [rollingDice, setRollingDice] = useState<{ die1: number; die2: number } | null>(null);
  const [demoHistory, setDemoHistory] = useState<History[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const pendingRollRef = useRef<{ die1: number; die2: number; total: number }>({ die1: 0, die2: 0, total: 0 });
  const moveStartPositionsRef = useRef<Record<number, number>>({});
  const historyIdRef = useRef(0);

  const players = isLiveGame ? livePlayers : mockPlayers;
  const positions = isLiveGame ? liveAnimatedPositions : animatedPositions;
  const developmentByPropertyId = isLiveGame ? liveDevelopmentByPropertyId : demoDevelopmentByPropertyId;
  const showRollUi = !isLiveGame;

  const handleRoll = useCallback(() => {
    if (rollingDice) return;
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    const total = d1 + d2;
    pendingRollRef.current = { die1: d1, die2: d2, total };
    setRollingDice({ die1: d1, die2: d2 });
  }, [rollingDice]);

  const handleDiceComplete = useCallback(() => {
    const { die1, die2, total } = pendingRollRef.current;
    setLastRollResult({ die1, die2, total });
    setRollingDice(null);
    historyIdRef.current += 1;
    setDemoHistory((prev) => [
      ...prev,
      makeHistoryEntry(historyIdRef.current, "Me", `rolled ${die1} + ${die2} = ${total}; all players advanced`, total),
    ]);
    setAnimatedPositions((prev) => {
      moveStartPositionsRef.current = { ...prev };
      return prev;
    });
    for (let step = 1; step <= total; step++) {
      setTimeout(() => {
        setAnimatedPositions(() => {
          const start = moveStartPositionsRef.current;
          const next: Record<number, number> = {};
          mockPlayers.forEach((p) => {
            const from = start[p.user_id] ?? p.position;
            next[p.user_id] = (from + step) % 40;
          });
          return next;
        });
      }, step * MOVE_ANIMATION_MS_PER_SQUARE);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = fullscreenRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  return (
    <div className="w-full min-h-screen bg-[#010F10] flex flex-row gap-4 p-4">
      {/* Players & Action Log sidebar — game-style panels */}
      <div className="hidden lg:flex flex-col w-72 flex-shrink-0 gap-5">
        {/* Players panel */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500/50 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.15),inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="absolute inset-0 rounded-2xl border border-amber-400/20 pointer-events-none" />
          <div className="relative">
            <div className="px-4 py-3 bg-gradient-to-r from-amber-900/40 to-amber-800/30 border-b-2 border-amber-500/40">
              <h3 className="text-base font-black text-amber-200 tracking-widest uppercase drop-shadow-sm flex items-center gap-2">
                <span className="text-lg">🎲</span> Players
              </h3>
            </div>
            <div className="p-2.5 space-y-2 max-h-64 overflow-y-auto">
              {mockPlayers.map((p) => {
                const pos = animatedPositions[p.user_id] ?? p.position;
                const isMe = p.user_id === 1;
                return (
                  <div
                    key={p.user_id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl border-2 transition-all ${
                      isMe
                        ? "bg-amber-500/25 border-amber-400/60 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                        : "bg-slate-800/60 border-slate-600/50 hover:border-slate-500/70"
                    }`}
                  >
                    <span
                      className={`flex items-center justify-center w-10 h-10 rounded-full text-2xl shrink-0 ${
                        isMe ? "bg-amber-500/30 ring-2 ring-amber-400/50" : "bg-slate-700/80"
                      }`}
                      title={p.symbol}
                    >
                      {getPlayerSymbol(p.symbol)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${isMe ? "text-amber-100" : "text-slate-200"}`}>
                        {p.username}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        <span className="text-emerald-400 font-semibold">${p.balance}</span>
                        <span className="text-slate-500 mx-1">·</span>
                        {getSquareName(pos)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Log — game-style frame */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-cyan-500/50 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 shadow-[0_0_30px_rgba(6,182,212,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <ActionLog
            history={demoHistory}
            className="!mt-0 !rounded-none !border-0 !bg-transparent !shadow-none"
          />
        </div>
      </div>

      {/* Board area */}
      <div
        ref={fullscreenRef}
        className="flex flex-col items-center justify-center bg-[#010F10] rounded-xl min-h-0 flex-1 min-w-0"
      >
        <p className="text-cyan-400 text-sm mb-2">
          3D board — drag to rotate, scroll to zoom
          {fromApi ? " · Names from backend" : " · Using fallback names"}
          <span className="text-slate-500 block mt-1">Hover a square to see its name</span>
        </p>
        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-medium transition-colors border border-slate-500"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
        </div>
        {isLoading ? (
          <p className="text-slate-400 mt-4">Loading board...</p>
        ) : (
          <div
            className={`mt-4 rounded-xl overflow-hidden border border-cyan-500/30 shadow-2xl ${
              isFullscreen ? "flex-1 w-full min-h-0 max-w-4xl" : "w-full max-w-[800px] aspect-square"
            }`}
          >
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
                rollingDice={rollingDice}
                onDiceComplete={handleDiceComplete}
                lastRollResult={lastRollResult}
                onRoll={handleRoll}
              />
            </Canvas>
          </div>
        )}
      </div>
    </div>
  );
}
