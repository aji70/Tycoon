"use client";

import { useRef, useMemo, createElement, Fragment } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { getPosition3D, getTokenOffset } from "./positions";
import type { Property } from "@/types/game";
import type { Player } from "@/types/game";

// Use createElement for R3F primitives so SWC/Next.js build accepts them (lowercase mesh/group etc.)

const TOKEN_COLORS = ["#22d3ee", "#a78bfa", "#f472b6", "#fbbf24", "#34d399", "#f87171", "#60a5fa", "#c084fc"];
function getTokenColor(playerIndex: number): string {
  return TOKEN_COLORS[playerIndex % TOKEN_COLORS.length];
}

type BoardSceneProps = {
  properties: Property[];
  players: Player[];
  animatedPositions: Record<number, number>; // playerId -> position index
  currentPlayerId: number | null;
};

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0.5, 0.5, 0.5];
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ];
}

function BoardTiles({ properties }: { properties: Property[] }) {
  return createElement(
    "group",
    null,
    ...properties.map((square) => {
      const [x, , z] = getPosition3D(square.id);
      const size = 0.9;
      const [r, g, b] = square.color ? hexToRgb(square.color) : [0.2, 0.25, 0.3];
      return createElement(
        "mesh",
        { key: square.id, position: [x, 0.01, z] as [number, number, number], rotation: [-Math.PI / 2, 0, 0] as [number, number, number] },
        createElement("planeGeometry", { args: [size, size] }),
        createElement("meshStandardMaterial", { color: new THREE.Color(r, g, b) })
      );
    })
  );
}

function PlayerToken({
  positionIndex,
  playerIndex,
  totalOnSquare,
  color,
  isCurrent,
}: {
  positionIndex: number;
  playerIndex: number;
  totalOnSquare: number;
  color: string;
  isCurrent: boolean;
}) {
  const [x, , z] = getPosition3D(positionIndex);
  const [ox, , oz] = getTokenOffset(playerIndex, totalOnSquare);
  const meshRef = useRef<THREE.Mesh>(null);
  const [r, g, b] = hexToRgb(color);

  useFrame(() => {
    if (meshRef.current && isCurrent) {
      meshRef.current.position.y = 0.15 + Math.sin(Date.now() * 0.003) * 0.03;
    }
  });

  return createElement(
    "mesh",
    {
      ref: meshRef,
      position: [x + ox, 0.15, z + oz] as [number, number, number],
      castShadow: true,
      receiveShadow: true,
    },
    createElement("cylinderGeometry", { args: [0.12, 0.14, 0.2, 16] }),
    createElement("meshStandardMaterial", {
      color: new THREE.Color(r, g, b),
      emissive: isCurrent ? new THREE.Color(r * 0.5, g * 0.5, b * 0.5) : undefined,
    })
  );
}

export default function BoardScene({
  properties,
  players,
  animatedPositions,
  currentPlayerId,
}: BoardSceneProps) {
  const playerTokens = useMemo(() => {
    const counts: Record<number, number> = {};
    players.forEach((p) => {
      const pos = animatedPositions[p.user_id] ?? p.position;
      counts[pos] = (counts[pos] ?? 0) + 1;
    });
    const nextIdx: Record<number, number> = {};
    return players.map((player, i) => {
      const pos = animatedPositions[player.user_id] ?? player.position;
      const totalOnSquare = counts[pos] ?? 1;
      const idxOnSquare = nextIdx[pos] ?? 0;
      nextIdx[pos] = idxOnSquare + 1;
      return { player, pos, idxOnSquare, totalOnSquare, color: getTokenColor(i) };
    });
  }, [players, animatedPositions]);

  return createElement(
    Fragment,
    null,
    createElement("ambientLight", { intensity: 0.6 }),
    createElement("directionalLight", {
      position: [5, 10, 5] as [number, number, number],
      intensity: 1,
      castShadow: true,
      "shadow-mapSize": [1024, 1024],
    }),
    createElement("directionalLight", {
      position: [-5, 5, -5] as [number, number, number],
      intensity: 0.3,
    }),
    createElement(
      "mesh",
      {
        rotation: [-Math.PI / 2, 0, 0] as [number, number, number],
        position: [0, -0.02, 0] as [number, number, number],
        receiveShadow: true,
      },
      createElement("planeGeometry", { args: [12, 12] }),
      createElement("meshStandardMaterial", { color: "#0a1516" })
    ),
    createElement(BoardTiles, { properties }),
    ...playerTokens.map(({ player, pos, idxOnSquare, totalOnSquare, color }) =>
      createElement(PlayerToken, {
        key: player.user_id,
        positionIndex: pos,
        playerIndex: idxOnSquare,
        totalOnSquare,
        color,
        isCurrent: currentPlayerId === player.user_id,
      })
    ),
    createElement(OrbitControls, {
      enablePan: true,
      enableZoom: true,
      minDistance: 8,
      maxDistance: 25,
      maxPolarAngle: Math.PI / 2 - 0.1,
    })
  );
}
