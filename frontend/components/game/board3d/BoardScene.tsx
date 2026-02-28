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

// Monopoly color groups: same group = same row/side, similar building style
const COLOR_GROUPS: Record<string, number[]> = {
  brown: [1, 3],
  lightblue: [6, 8, 9],
  pink: [11, 13, 14],
  orange: [16, 18, 19],
  red: [21, 23, 24],
  yellow: [26, 27, 29],
  green: [31, 32, 34],
  darkblue: [37, 39],
  railroad: [5, 15, 25, 35],
  utility: [12, 28],
};

function getGroupIndex(id: number): { group: string; index: number } {
  for (const [group, ids] of Object.entries(COLOR_GROUPS)) {
    const idx = ids.indexOf(id);
    if (idx >= 0) return { group, index: idx };
  }
  return { group: "other", index: 0 };
}

/** Ground tile + 3D structure; Monopoly-style groups and realistic buildings */
function SquareTile({ square }: { square: Property }) {
  const [x, , z] = getPosition3D(square.id);
  const size = 0.9;
  const [r, g, b] = square.color && /^#?[0-9A-Fa-f]{6}$/.test(square.color) ? hexToRgb(square.color) : [0.3, 0.35, 0.4];
  const color = new THREE.Color(r, g, b);
  const rotFlat = [-Math.PI / 2, 0, 0] as [number, number, number];
  const type = square.type;
  const id = square.id;
  const { group, index: groupIndex } = getGroupIndex(id);

  const ground = createElement(
    "mesh",
    { position: [x, 0.005, z] as [number, number, number], rotation: rotFlat, receiveShadow: true },
    createElement("planeGeometry", { args: [size, size] }),
    createElement("meshStandardMaterial", { color, roughness: 0.85, metalness: 0.05 })
  );

  // ---- CORNERS: iconic Monopoly look ----
  if (type === "corner") {
    const baseY = 0.02;
    if (id === 0) {
      // GO: archway / start gate
      const pillar = createElement("mesh", { position: [x, 0.2, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [0.15, 0.35, 0.15] }), createElement("meshStandardMaterial", { color: 0x27ae60 }));
      const arch = createElement("mesh", { position: [x, 0.42, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.75, 0.12, 0.2] }), createElement("meshStandardMaterial", { color: 0x2ecc71 }));
      return createElement("group", { key: square.id }, ground, pillar, arch);
    }
    if (id === 10) {
      // Jail: building with bars
      const jail = createElement("mesh", { position: [x, 0.22, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.65, 0.4, size * 0.65] }), createElement("meshStandardMaterial", { color: 0x95a5a6 }));
      const roof = createElement("mesh", { position: [x, 0.48, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.72, 0.06, size * 0.72] }), createElement("meshStandardMaterial", { color: 0x7f8c8d }));
      return createElement("group", { key: square.id }, ground, jail, roof);
    }
    if (id === 20) {
      // Free Parking: park / garden with small structure
      const kiosk = createElement("mesh", { position: [x, 0.12, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.4, 0.2, size * 0.4] }), createElement("meshStandardMaterial", { color: 0x3498db }));
      const canopy = createElement("mesh", { position: [x, 0.28, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.55, 0.04, size * 0.55] }), createElement("meshStandardMaterial", { color: 0x2980b9 }));
      return createElement("group", { key: square.id }, ground, kiosk, canopy);
    }
    if (id === 30) {
      // Go to Jail: jail door / gate
      const gate = createElement("mesh", { position: [x, 0.25, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.6, 0.45, 0.12] }), createElement("meshStandardMaterial", { color: 0xc0392b }));
      const roof = createElement("mesh", { position: [x, 0.52, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.7, 0.06, 0.2] }), createElement("meshStandardMaterial", { color: 0x922b21 }));
      return createElement("group", { key: square.id }, ground, gate, roof);
    }
  }

  // ---- RAILROADS: station with platform and awning ----
  const isRailroad = square.color === "railroad" || [5, 15, 25, 35].includes(id);
  if (isRailroad) {
    const platform = createElement("mesh", { position: [x, 0.06, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.85, 0.08, size * 0.5] }), createElement("meshStandardMaterial", { color: 0x34495e }));
    const station = createElement("mesh", { position: [x, 0.22, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.45, 0.25, size * 0.4] }), createElement("meshStandardMaterial", { color: 0x2c3e50 }));
    const awning = createElement("mesh", { position: [x, 0.38, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.9, 0.04, size * 0.35] }), createElement("meshStandardMaterial", { color: 0x1a252f }));
    return createElement("group", { key: square.id }, ground, platform, station, awning);
  }

  // ---- UTILITIES: small industrial building ----
  if (square.color === "utility" || [12, 28].includes(id)) {
    const building = createElement("mesh", { position: [x, 0.18, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.55, 0.3, size * 0.55] }), createElement("meshStandardMaterial", { color: 0x16a085 }));
    const roof = createElement("mesh", { position: [x, 0.36, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.6, 0.06, size * 0.6] }), createElement("meshStandardMaterial", { color: 0x0e6655 }));
    const chimney = createElement("mesh", { position: [x + size * 0.2, 0.45, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [0.08, 0.15, 0.08] }), createElement("meshStandardMaterial", { color: 0x7f8c8d }));
    return createElement("group", { key: square.id }, ground, building, roof, chimney);
  }

  // ---- CHANCE: card kiosk ----
  if (type === "chance") {
    const stand = createElement("mesh", { position: [x, 0.06, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.35, 0.1, size * 0.35] }), createElement("meshStandardMaterial", { color: 0xb7950b }));
    const card = createElement("mesh", { position: [x, 0.18, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.32, size * 0.45, 0.03] }), createElement("meshStandardMaterial", { color: 0xf1c40f }));
    return createElement("group", { key: square.id }, ground, stand, card);
  }

  // ---- COMMUNITY CHEST: chest kiosk ----
  if (type === "community_chest") {
    const stand = createElement("mesh", { position: [x, 0.05, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.5, 0.08, size * 0.5] }), createElement("meshStandardMaterial", { color: 0x1e8449 }));
    const chest = createElement("mesh", { position: [x, 0.18, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.45, size * 0.35, size * 0.4] }), createElement("meshStandardMaterial", { color: 0x229954 }));
    const lid = createElement("mesh", { position: [x, 0.38, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.48, 0.04, size * 0.42] }), createElement("meshStandardMaterial", { color: 0x1e8449 }));
    return createElement("group", { key: square.id }, ground, stand, chest, lid);
  }

  // ---- TAX: bank / treasury (classical building) ----
  if (type === "luxury_tax" || type === "income_tax") {
    const steps = createElement("mesh", { position: [x, 0.04, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.7, 0.06, size * 0.7] }), createElement("meshStandardMaterial", { color: 0x5b2c6f }));
    const building = createElement("mesh", { position: [x, 0.2, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.6, 0.28, size * 0.6] }), createElement("meshStandardMaterial", { color: 0x6c3483 }));
    const roof = createElement("mesh", { position: [x, 0.36, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.68, 0.06, size * 0.68] }), createElement("meshStandardMaterial", { color: 0x4a235a }));
    return createElement("group", { key: square.id }, ground, steps, building, roof);
  }

  // ---- PROPERTIES: terraced buildings by color group, pitched roof ----
  const groupHeight = { brown: 0.14, lightblue: 0.16, pink: 0.18, orange: 0.2, red: 0.22, yellow: 0.2, green: 0.24, darkblue: 0.26 }[group] ?? 0.18;
  const bodyH = groupHeight * 0.65;
  const roofH = groupHeight * 0.35;
  const body = createElement(
    "mesh",
    { position: [x, bodyH / 2 + 0.02, z] as [number, number, number], castShadow: true },
    createElement("boxGeometry", { args: [size * 0.65, bodyH, size * 0.65] }),
    createElement("meshStandardMaterial", { color, roughness: 0.65, metalness: 0.05 })
  );
  // Pitched (gable) roof: two boxes angled to form ^
  const roofW = size * 0.48;
  const roofSlant = createElement(
    "mesh",
    {
      position: [x, bodyH + 0.02 + roofH / 2, z - roofW * 0.15] as [number, number, number],
      rotation: [Math.PI / 6, 0, 0] as [number, number, number],
      castShadow: true,
    },
    createElement("boxGeometry", { args: [size * 0.72, roofH, roofW] }),
    createElement("meshStandardMaterial", { color: 0x5d4037, roughness: 0.85 })
  );
  const roofSlant2 = createElement(
    "mesh",
    {
      position: [x, bodyH + 0.02 + roofH / 2, z + roofW * 0.15] as [number, number, number],
      rotation: [-Math.PI / 6, 0, 0] as [number, number, number],
      castShadow: true,
    },
    createElement("boxGeometry", { args: [size * 0.72, roofH, roofW] }),
    createElement("meshStandardMaterial", { color: 0x5d4037, roughness: 0.85 })
  );
  return createElement("group", { key: square.id }, ground, body, roofSlant, roofSlant2);
}

function BoardTiles({ properties }: { properties: Property[] }) {
  return createElement(
    "group",
    null,
    ...properties.map((square) => createElement(SquareTile, { key: square.id, square }))
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
