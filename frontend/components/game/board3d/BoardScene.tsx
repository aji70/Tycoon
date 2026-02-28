"use client";

import { useRef, useMemo, useState, createElement, Fragment } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import ActionLog from "@/components/game/ai-board/action-log";
import type { Game } from "@/types/game";
import * as THREE from "three";
import { getPosition3D, getPosition3DFromGrid } from "./positions";
import { getSquareName } from "./squareNames";
import { getPlayerSymbol } from "@/lib/types/symbol";
import type { Property } from "@/types/game";
import type { Player } from "@/types/game";

// Use createElement for R3F primitives so SWC/Next.js build accepts them (lowercase mesh/group etc.)

/** 0 = no houses, 1-4 = house count, 5 = hotel. Only for developable properties (standard color groups). */
export type DevelopmentByPropertyId = Record<number, number>;

/** Rotation (Euler) to show dice value 1–6 on top (Y+). */
const DICE_TOP_ROTATIONS: [number, number, number][] = [
  [0, 0, 0],           // 1
  [Math.PI / 2, 0, 0], // 2
  [0, 0, -Math.PI / 2], // 3
  [0, 0, Math.PI / 2],  // 4
  [-Math.PI / 2, 0, 0], // 5
  [Math.PI, 0, 0],     // 6
];

type BoardSceneProps = {
  properties: Property[];
  players: Player[];
  animatedPositions: Record<number, number>; // playerId -> position index
  currentPlayerId: number | null;
  /** Optional: override development per property id for demo (0-4 houses, 5 = hotel). */
  developmentByPropertyId?: DevelopmentByPropertyId;
  /** Optional: owner username per property id (for display on hover). */
  ownerByPropertyId?: Record<number, string>;
  /** Called when user clicks a property square (property/railroad/utility). */
  onSquareClick?: (square: Property) => void;
  /** When set, show 3D dice roll animation then call onDiceComplete. */
  rollingDice?: { die1: number; die2: number } | null;
  onDiceComplete?: () => void;
  /** After roll, show this result in the center (die1 + die2 = total). */
  lastRollResult?: { die1: number; die2: number; total: number } | null;
  /** Called when user clicks the center Roll button (demo). */
  onRoll?: () => void;
  /** Action log history — renders below roll button in center */
  history?: Game["history"];
  /** When true, show "AI is thinking" in center just above the dice result */
  aiThinking?: boolean;
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

/** Ground tile + 3D structure; Monopoly-style groups and realistic buildings. Names + owner show on hover. */
function SquareTile({
  square,
  development = 0,
  owner = null,
  onClick,
}: {
  square: Property;
  development?: number;
  owner?: string | null;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  // Use backend grid when available (matches 2D board); else fall back to id-based layout
  const hasGrid = typeof square.grid_row === "number" && typeof square.grid_col === "number" && square.grid_row >= 1 && square.grid_row <= 11 && square.grid_col >= 1 && square.grid_col <= 11;
  const [x, , z] = hasGrid ? getPosition3DFromGrid(square.grid_row, square.grid_col) : getPosition3D(square.id);
  const size = 0.9;
  const displayName = square.name || getSquareName(square.id);
  const ownerSuffix = owner ? ` — Owner: ${owner}` : "";
  const [r, g, b] = square.color && /^#?[0-9A-Fa-f]{6}$/.test(square.color) ? hexToRgb(square.color) : [0.3, 0.35, 0.4];
  const color = new THREE.Color(r, g, b);
  const rotFlat = [-Math.PI / 2, 0, 0] as [number, number, number];
  const type = square.type;
  const id = square.id;
  const { group, index: groupIndex } = getGroupIndex(id);

  // Label: only visible on hover; higher for corner buildings (Jail, Go to Jail).
  const labelY = type === "corner" && (id === 10 || id === 30) ? 0.18 : 0.07;
  const nameLabel = hovered
    ? createElement(
        Html,
        {
          position: [x, labelY, z] as [number, number, number],
          center: true,
          distanceFactor: 14,
          style: {
            fontSize: "11px",
            fontWeight: 700,
            color: "#fff",
            textShadow: "0 0 6px #000, 0 2px 4px #000",
            textAlign: "center",
            whiteSpace: "nowrap",
            maxWidth: "140px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            pointerEvents: "none",
            userSelect: "none",
            background: "rgba(0,0,0,0.75)",
            padding: "4px 8px",
            borderRadius: "4px",
          },
        },
        displayName + ownerSuffix
      )
    : null;

  // Owner badge: only show when property has an owner (no badge for unowned).
  const ownerBadge =
    square.type === "property" && owner
      ? createElement(
          Html,
          {
            position: [x, 0.02, z + size * 0.35] as [number, number, number],
            center: true,
            distanceFactor: 18,
            style: {
              fontSize: "9px",
              fontWeight: 600,
              color: "#fbbf24",
              textShadow: "0 0 4px #000, 0 1px 3px #000",
              textAlign: "center",
              whiteSpace: "nowrap",
              maxWidth: "80px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              pointerEvents: "none",
              userSelect: "none",
              background: "rgba(251,191,36,0.2)",
              padding: "2px 6px",
              borderRadius: "6px",
              border: "1px solid rgba(251,191,36,0.5)",
            },
          },
          owner
        )
      : null;

  const ground = createElement(
    "mesh",
    { position: [x, 0.005, z] as [number, number, number], rotation: rotFlat, receiveShadow: true },
    createElement("planeGeometry", { args: [size, size] }),
    createElement("meshStandardMaterial", { color, roughness: 0.85, metalness: 0.05 })
  );

  const isClickable = square.type === "property" && !!onClick;
  const groupProps: Record<string, unknown> = {
    key: square.id,
    onPointerEnter: () => setHovered(true),
    onPointerLeave: () => setHovered(false),
  };
  if (isClickable) (groupProps as Record<string, () => void>).onClick = onClick!;

  // ---- CORNERS: iconic Monopoly look ----
  if (type === "corner") {
    const baseY = 0.02;
    if (id === 0) {
      // GO: property-style sign with visible "GO" + arrow (like a named property)
      const signPost = createElement("mesh", { position: [x, 0.14, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [0.06, 0.22, 0.06] }), createElement("meshStandardMaterial", { color: 0x27ae60 }));
      const signBoard = createElement("mesh", { position: [x, 0.28, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.65, 0.1, 0.04] }), createElement("meshStandardMaterial", { color: 0x2ecc71 }));
      const goSignLabel = createElement(
        Html,
        {
          position: [x, 0.28, z] as [number, number, number],
          rotation: [0, Math.PI, 0] as [number, number, number],
          center: true,
          distanceFactor: 12,
          style: {
            fontSize: "14px",
            fontWeight: 800,
            color: "#fff",
            textShadow: "0 0 8px #000, 0 2px 4px #000",
            textAlign: "center",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            userSelect: "none",
            letterSpacing: "0.08em",
          },
        },
        "GO →"
      );
      return createElement("group", groupProps, ground, signPost, signBoard, goSignLabel, nameLabel, ownerBadge);
    }
    if (id === 10) {
      // Jail: prison building with vertical bars + visible "Jail" label
      const jailBase = createElement("mesh", { position: [x, 0.18, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.7, 0.32, size * 0.7] }), createElement("meshStandardMaterial", { color: 0x5d6d7e }));
      const roof = createElement("mesh", { position: [x, 0.38, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.76, 0.06, size * 0.76] }), createElement("meshStandardMaterial", { color: 0x4a4a4a }));
      const barW = 0.03;
      const barH = 0.28;
      const bars = [];
      for (let b = -2; b <= 2; b++) {
        bars.push(createElement("mesh", { key: b, position: [x + b * 0.14, 0.18, z + size * 0.32] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [barW, barH, barW] }), createElement("meshStandardMaterial", { color: 0x2c3e50 })));
      }
      const jailTextLabel = createElement(
        Html,
        {
          position: [x, 0.28, z] as [number, number, number],
          center: true,
          distanceFactor: 12,
          style: {
            fontSize: "12px",
            fontWeight: 800,
            color: "#fff",
            textShadow: "0 0 8px #000, 0 2px 4px #000",
            textAlign: "center",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            userSelect: "none",
            letterSpacing: "0.05em",
          },
        },
        "Jail"
      );
      return createElement("group", groupProps, ground, jailBase, roof, ...bars, jailTextLabel, nameLabel, ownerBadge);
    }
    if (id === 20) {
      // Free Parking: empty with simple post and sign (no text)
      const post = createElement("mesh", { position: [x, 0.12, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [0.06, 0.22, 0.06] }), createElement("meshStandardMaterial", { color: 0x5d4037 }));
      const sign = createElement("mesh", { position: [x, 0.26, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.5, 0.08, 0.04] }), createElement("meshStandardMaterial", { color: 0x3498db }));
      return createElement("group", groupProps, ground, post, sign, nameLabel, ownerBadge);
    }
    if (id === 30) {
      // Go to Jail: heavy prison gate, bars, red arch – clearly jail, no text
      const base = createElement("mesh", { position: [x, 0.08, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.75, 0.1, size * 0.5] }), createElement("meshStandardMaterial", { color: 0x3d3d3d }));
      const gateL = createElement("mesh", { position: [x - size * 0.22, 0.28, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [0.12, 0.5, 0.12] }), createElement("meshStandardMaterial", { color: 0x2c3e50 }));
      const gateR = createElement("mesh", { position: [x + size * 0.22, 0.28, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [0.12, 0.5, 0.12] }), createElement("meshStandardMaterial", { color: 0x2c3e50 }));
      const arch = createElement("mesh", { position: [x, 0.52, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.6, 0.1, 0.14] }), createElement("meshStandardMaterial", { color: 0xc0392b }));
      const barW = 0.022;
      const goBars = [];
      for (let b = -2; b <= 2; b++) {
        goBars.push(createElement("mesh", { key: b, position: [x + b * 0.14, 0.28, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [barW, 0.42, 0.08] }), createElement("meshStandardMaterial", { color: 0x4a4a4a })));
      }
      return createElement("group", groupProps, ground, base, gateL, gateR, arch, ...goBars, nameLabel, ownerBadge);
    }
  }

  // ---- RAILROADS: station (light) + colored awning + train (red engine, blue carriage) ----
  const isRailroad = square.color === "railroad" || [5, 15, 25, 35].includes(id);
  if (isRailroad) {
    const platform = createElement("mesh", { position: [x, 0.06, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.85, 0.08, size * 0.5] }), createElement("meshStandardMaterial", { color: 0x7f8c8d }));
    const station = createElement("mesh", { position: [x, 0.22, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.45, 0.25, size * 0.4] }), createElement("meshStandardMaterial", { color: 0xd5d8dc }));
    const awning = createElement("mesh", { position: [x, 0.38, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.9, 0.04, size * 0.35] }), createElement("meshStandardMaterial", { color: 0x27ae60 }));
    const engine = createElement("mesh", { position: [x - size * 0.2, 0.14, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [0.22, 0.12, 0.18] }), createElement("meshStandardMaterial", { color: 0xc0392b }));
    const chimney = createElement("mesh", { position: [x - size * 0.2, 0.24, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [0.06, 0.12, 0.06] }), createElement("meshStandardMaterial", { color: 0x4a4a4a }));
    const carriage = createElement("mesh", { position: [x + size * 0.15, 0.12, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [0.2, 0.1, 0.16] }), createElement("meshStandardMaterial", { color: 0x2980b9 }));
    return createElement("group", groupProps, ground, platform, station, awning, engine, chimney, carriage, nameLabel, ownerBadge);
  }

  // ---- UTILITIES: Electric Company (12) vs Water Works (28) ----
  if (square.color === "utility" || [12, 28].includes(id)) {
    if (id === 12) {
      // Electric Company: substation with transformer, poles, and "Electric" label
      const building = createElement("mesh", { position: [x, 0.14, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.5, 0.22, size * 0.5] }), createElement("meshStandardMaterial", { color: 0x2c3e50 }));
      const transformer = createElement("mesh", { position: [x, 0.32, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.35, size * 0.35, size * 0.3] }), createElement("meshStandardMaterial", { color: 0x7f8c8d }));
      const poleL = createElement("mesh", { position: [x - size * 0.35, 0.2, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [0.04, 0.35, 0.04] }), createElement("meshStandardMaterial", { color: 0x5d4037 }));
      const poleR = createElement("mesh", { position: [x + size * 0.35, 0.2, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [0.04, 0.35, 0.04] }), createElement("meshStandardMaterial", { color: 0x5d4037 }));
      const electricLabel = createElement(
        Html,
        {
          position: [x, 0.18, z] as [number, number, number],
          center: true,
          distanceFactor: 12,
          style: {
            fontSize: "11px",
            fontWeight: 700,
            color: "#f4d03f",
            textShadow: "0 0 4px #000, 0 1px 3px #000",
            pointerEvents: "none",
            userSelect: "none",
            whiteSpace: "nowrap",
          },
        },
        "Electric"
      );
      return createElement("group", groupProps, ground, building, transformer, poleL, poleR, electricLabel, nameLabel, ownerBadge);
    }
    // Water Works (28): water tower
    const towerLegs = createElement("mesh", { position: [x, 0.08, z] as [number, number, number], castShadow: true }, createElement("cylinderGeometry", { args: [0.06, 0.08, 0.12, 6] }), createElement("meshStandardMaterial", { color: 0x7f8c8d }));
    const tank = createElement("mesh", { position: [x, 0.28, z] as [number, number, number], castShadow: true }, createElement("cylinderGeometry", { args: [size * 0.35, size * 0.35, 0.12, 12] }), createElement("meshStandardMaterial", { color: 0x3498db }));
    const dome = createElement("mesh", { position: [x, 0.38, z] as [number, number, number], castShadow: true }, createElement("sphereGeometry", { args: [size * 0.32, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2] }), createElement("meshStandardMaterial", { color: 0x2980b9 }));
    return createElement("group", groupProps, ground, towerLegs, tank, dome, nameLabel, ownerBadge);
  }

  // ---- CHANCE: standing card with ? label ----
  if (type === "chance") {
    const stand = createElement("mesh", { position: [x, 0.05, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.3, 0.08, size * 0.3] }), createElement("meshStandardMaterial", { color: 0x5d4037 }));
    const card = createElement("mesh", { position: [x, 0.2, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.28, size * 0.5, 0.02] }), createElement("meshStandardMaterial", { color: 0xf1c40f }));
    const chanceLabel = createElement(
      Html,
      {
        position: [x, 0.22, z] as [number, number, number],
        center: true,
        distanceFactor: 12,
        style: {
          fontSize: "28px",
          fontWeight: 800,
          color: "#1a1a1a",
          textShadow: "0 1px 2px rgba(0,0,0,0.3)",
          pointerEvents: "none",
          userSelect: "none",
        },
      },
      "?"
    );
    return createElement("group", groupProps, ground, stand, card, chanceLabel, nameLabel, ownerBadge);
  }

  // ---- COMMUNITY CHEST: clean treasure chest, no text ----
  if (type === "community_chest") {
    const pad = createElement("mesh", { position: [x, 0.02, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.55, 0.025, size * 0.45] }), createElement("meshStandardMaterial", { color: 0x3e2723 }));
    const body = createElement("mesh", { position: [x, 0.14, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.48, size * 0.24, size * 0.36] }), createElement("meshStandardMaterial", { color: 0x1e8449, roughness: 0.6 }));
    const bandH = createElement("mesh", { position: [x, 0.14, z + size * 0.2] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.5, 0.045, 0.04] }), createElement("meshStandardMaterial", { color: 0xd4a574 }));
    const bandC = createElement("mesh", { position: [x, 0.14, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.5, 0.045, 0.04] }), createElement("meshStandardMaterial", { color: 0xd4a574 }));
    const lid = createElement("mesh", { position: [x, 0.3, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.5, 0.06, size * 0.38] }), createElement("meshStandardMaterial", { color: 0x229954, roughness: 0.6 }));
    const lock = createElement("mesh", { position: [x, 0.1, z + size * 0.19] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [0.08, 0.06, 0.02] }), createElement("meshStandardMaterial", { color: 0xf1c40f }));
    return createElement("group", groupProps, ground, pad, body, bandH, bandC, lid, lock, nameLabel, ownerBadge);
  }

  // ---- TAX: tax office + dollar sign label ----
  if (type === "luxury_tax" || type === "income_tax") {
    const steps = createElement("mesh", { position: [x, 0.03, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.65, 0.04, size * 0.65] }), createElement("meshStandardMaterial", { color: 0x4a235a }));
    const building = createElement("mesh", { position: [x, 0.18, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.55, 0.28, size * 0.55] }), createElement("meshStandardMaterial", { color: 0x5b2c6f }));
    const roof = createElement("mesh", { position: [x, 0.34, z] as [number, number, number], castShadow: true }, createElement("boxGeometry", { args: [size * 0.6, 0.05, size * 0.6] }), createElement("meshStandardMaterial", { color: 0x4a235a }));
    const taxAmount = id === 4 ? "$200" : "$100"; // Income Tax $200, Luxury Tax $100
    const taxLabel = createElement(
      Html,
      {
        position: [x, 0.22, z] as [number, number, number],
        center: true,
        distanceFactor: 12,
        style: {
          fontSize: "13px",
          fontWeight: 800,
          color: "#fff",
          textShadow: "0 0 8px #000, 0 2px 4px #000",
          textAlign: "center",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          userSelect: "none",
        },
      },
      taxAmount
    );
    return createElement("group", { key: square.id, onPointerEnter: () => setHovered(true), onPointerLeave: () => setHovered(false) }, ground, steps, building, roof, taxLabel, nameLabel);
  }

  // ---- PROPERTIES: terraced buildings by color group, pitched roof + houses/hotel ----
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

  // Development: 0 = none, 1-4 = houses (small green boxes on roof), 5 = hotel (one red taller building)
  const houseColor = 0x27ae60; // green
  const hotelColor = 0xc0392b; // red
  const baseY = 0.02 + bodyH + roofH;
  const developmentMeshes: ReturnType<typeof createElement>[] = [];
  if (development >= 5) {
    // Hotel: single taller building replacing houses
    const hotelH = 0.2;
    const hotelBox = createElement(
      "mesh",
      { position: [x, baseY + hotelH / 2, z] as [number, number, number], castShadow: true },
      createElement("boxGeometry", { args: [size * 0.35, hotelH, size * 0.35] }),
      createElement("meshStandardMaterial", { color: hotelColor, roughness: 0.7 })
    );
    developmentMeshes.push(hotelBox);
  } else if (development >= 1 && development <= 4) {
    // 1-4 houses: small boxes in a 2x2 layout (1 = one, 2 = two, etc.)
    const houseH = 0.08;
    const houseW = size * 0.2;
    const gap = 0.04;
    const positions: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (let i = 0; i < development; i++) {
      const [sx, sz] = positions[i];
      const hx = x + sx * (houseW / 2 + gap / 2);
      const hz = z + sz * (houseW / 2 + gap / 2);
      const house = createElement(
        "mesh",
        { position: [hx, baseY + houseH / 2, hz] as [number, number, number], castShadow: true },
        createElement("boxGeometry", { args: [houseW, houseH, houseW] }),
        createElement("meshStandardMaterial", { color: houseColor, roughness: 0.75 })
      );
      developmentMeshes.push(house);
    }
  }

  return createElement(
    "group",
    groupProps,
    ground,
    body,
    roofSlant,
    roofSlant2,
    ...developmentMeshes,
    nameLabel,
    ownerBadge
  );
}

function BoardTiles({
  properties,
  developmentByPropertyId,
  ownerByPropertyId,
  onSquareClick,
}: {
  properties: Property[];
  developmentByPropertyId?: DevelopmentByPropertyId;
  ownerByPropertyId?: Record<number, string>;
  onSquareClick?: (square: Property) => void;
}) {
  return createElement(
    "group",
    null,
    ...properties.map((square) =>
      createElement(SquareTile, {
        key: square.id,
        square,
        development: developmentByPropertyId?.[square.id] ?? 0,
        owner: ownerByPropertyId?.[square.id] ?? null,
        onClick: onSquareClick ? () => onSquareClick(square) : undefined,
      })
    )
  );
}

/** Center of board: decal with /bb.jpg (same as 2D board center). */
function BoardCenter() {
  const texture = useLoader(THREE.TextureLoader, "/bb.jpg");
  const size = 7;
  return createElement(
    "mesh",
    {
      position: [0, 0.012, 0] as [number, number, number],
      rotation: [-Math.PI / 2, 0, 0] as [number, number, number],
      receiveShadow: true,
    },
    createElement("planeGeometry", { args: [size, size] }),
    createElement("meshBasicMaterial", {
      map: texture,
      transparent: true,
      opacity: 0.92,
    })
  );
}

const DICE_ROLL_MS = 1400;
const DICE_SIZE = 0.6;
const PIP_RADIUS = 0.05;
const PIP_COLOR = 0x1a1a1a;

/** Pip positions per face value (1-6). Standard layout: 1 center, 2 diagonal, 3 L, 4 corners, 5 corners+center, 6 two rows. */
const DICE_PIPS: [number, number][][] = [
  [[0, 0]], // 1: center
  [[-0.25, 0.25], [0.25, -0.25]], // 2: diagonal
  [[-0.25, 0.25], [0, 0], [0.25, -0.25]], // 3
  [[-0.25, 0.25], [0.25, 0.25], [-0.25, -0.25], [0.25, -0.25]], // 4: corners
  [[-0.25, 0.25], [0.25, 0.25], [0, 0], [-0.25, -0.25], [0.25, -0.25]], // 5
  [[-0.25, 0.25], [0.25, 0.25], [-0.25, 0], [0.25, 0], [-0.25, -0.25], [0.25, -0.25]], // 6
];

function RollingDice({
  die1,
  die2,
  onComplete,
}: {
  die1: number;
  die2: number;
  onComplete: () => void;
}) {
  const startTime = useRef(Date.now());
  const completed = useRef(false);
  const mesh1Ref = useRef<THREE.Group>(null);
  const mesh2Ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (completed.current) return;
    const elapsed = Date.now() - (startTime.current ?? 0);
    const r1 = DICE_TOP_ROTATIONS[Math.max(0, Math.min(5, die1 - 1))];
    const r2 = DICE_TOP_ROTATIONS[Math.max(0, Math.min(5, die2 - 1))];
    const spin = (elapsed / DICE_ROLL_MS) * Math.PI * 10;
    if (elapsed >= DICE_ROLL_MS) {
      completed.current = true;
      if (mesh1Ref.current) mesh1Ref.current.rotation.set(r1[0], r1[1], r1[2]);
      if (mesh2Ref.current) mesh2Ref.current.rotation.set(r2[0], r2[1], r2[2]);
      onComplete();
      return;
    }
    if (mesh1Ref.current) mesh1Ref.current.rotation.set(r1[0] + spin * 0.7, r1[1] + spin * 1.2, r1[2] + spin * 0.6);
    if (mesh2Ref.current) mesh2Ref.current.rotation.set(r2[0] + spin * 0.9, r2[1] + spin * 0.5, r2[2] + spin * 1.1);
  });

  const pipMat = createElement("meshStandardMaterial", { color: PIP_COLOR, roughness: 0.8, metalness: 0 });
  const pipGeo = createElement("sphereGeometry", { args: [PIP_RADIUS, 8, 6] });
  const mat = createElement("meshStandardMaterial", { color: 0xf8f8f8, roughness: 0.3, metalness: 0.08 });
  const geo = createElement("boxGeometry", { args: [DICE_SIZE, DICE_SIZE, DICE_SIZE] });

  const makePipsForDie = () => {
    const half = DICE_SIZE / 2;
    const faceOff = half + PIP_RADIUS * 1.1;
    const out: ReturnType<typeof createElement>[] = [];
    const faceValues = [1, 6, 5, 2, 3, 4];
    const faces: { axis: "x" | "y" | "z"; sign: number }[] = [
      { axis: "y", sign: 1 }, { axis: "y", sign: -1 }, { axis: "x", sign: 1 },
      { axis: "x", sign: -1 }, { axis: "z", sign: 1 }, { axis: "z", sign: -1 },
    ];
    faces.forEach(({ axis, sign }, faceIdx) => {
      const positions = DICE_PIPS[faceValues[faceIdx] - 1];
      const off = faceOff * sign;
      positions.forEach(([u, v], i) => {
        let x = 0, y = 0, z = 0;
        if (axis === "y") { x = u * half; y = off; z = v * half; }
        else if (axis === "x") { x = off; y = u * half; z = v * half; }
        else { x = u * half; y = v * half; z = off; }
        out.push(createElement("mesh", { key: `p${faceIdx}-${i}`, position: [x, y, z] as [number, number, number], castShadow: true }, pipGeo, pipMat));
      });
    });
    return out;
  };

  return createElement(
    "group",
    { position: [0, 0.35, 0] as [number, number, number] },
    createElement("group", { ref: mesh1Ref, position: [-DICE_SIZE * 1.2, 0, 0] as [number, number, number] },
      createElement("mesh", { castShadow: true, receiveShadow: true }, geo, mat),
      ...makePipsForDie()
    ),
    createElement("group", { ref: mesh2Ref, position: [DICE_SIZE * 1.2, 0, 0] as [number, number, number] },
      createElement("mesh", { castShadow: true, receiveShadow: true }, geo, mat),
      ...makePipsForDie()
    )
  );
}

function AiThinkingLabel() {
  return createElement(
    Html,
    {
      position: [0, 1.95, 0] as [number, number, number],
      center: true,
      distanceFactor: 7,
      style: {
        pointerEvents: "none",
        userSelect: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "18px",
        fontWeight: 600,
        color: "#fbbf24",
        textShadow: "0 0 8px #000, 0 1px 4px #000",
        whiteSpace: "nowrap",
      },
    },
    "AI is thinking..."
  );
}

function RollResultLabel({ roll }: { roll: { die1: number; die2: number; total: number } }) {
  return createElement(
    Html,
    {
      position: [0, 1.35, 0] as [number, number, number],
      center: true,
      distanceFactor: 7,
      style: {
        pointerEvents: "none",
        userSelect: "none",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: "14px",
        fontSize: "48px",
        fontWeight: 800,
        color: "#fff",
        textShadow: "0 0 12px #000, 0 2px 6px #000",
        whiteSpace: "nowrap",
      },
    },
    createElement("span", { style: { color: "#22d3ee" } }, String(roll.die1)),
    createElement("span", { style: { color: "#fff" } }, "+"),
    createElement("span", { style: { color: "#f472b6" } }, String(roll.die2)),
    createElement("span", { style: { color: "#fff" } }, "="),
    createElement("span", { style: { color: "#fbbf24" } }, String(roll.total))
  );
}

function CenterActionLog({ history }: { history?: Game["history"] }) {
  if (history == null) return null;
  return createElement(
    Html,
    {
      position: [0, -2.5, 0] as [number, number, number],
      center: true,
      distanceFactor: 8,
      style: {
        pointerEvents: "auto",
        width: "340px",
        maxHeight: "300px",
      },
    },
    createElement(ActionLog, {
      history,
      className: "!mt-0 !h-44 !max-h-44 !min-h-[180px] !rounded-lg !border-2 !border-cyan-500/40 !bg-slate-900/95",
    })
  );
}

function CenterRollButton({ onRoll, disabled }: { onRoll: () => void; disabled: boolean }) {
  return createElement(
    Html,
    {
      position: [0, 0.02, 0] as [number, number, number],
      center: true,
      distanceFactor: 9,
      style: { pointerEvents: "auto" },
    },
    createElement("button", {
      type: "button",
      onClick: onRoll,
      disabled,
      style: {
        padding: "10px 22px",
        fontSize: "15px",
        fontWeight: 700,
        color: "#0f172a",
        background: "linear-gradient(180deg, #67e8f9 0%, #22d3ee 50%, #06b6d4 100%)",
        border: "2px solid #0e7490",
        borderRadius: "10px",
        boxShadow: "0 4px 0 #0e7490, 0 6px 16px rgba(0,0,0,0.35)",
        cursor: disabled ? "not-allowed" : "pointer",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        opacity: disabled ? 0.6 : 1,
      },
    }, "Roll")
  );
}

function PlayerToken({
  positionIndex,
  playerIndex,
  totalOnSquare,
  symbol,
  isCurrent,
}: {
  positionIndex: number;
  playerIndex: number;
  totalOnSquare: number;
  symbol: string;
  isCurrent: boolean;
}) {
  const [x, , z] = getPosition3D(positionIndex);
  const groupRef = useRef<THREE.Group>(null);
  const emoji = getPlayerSymbol(symbol) ?? "🎲";

  useFrame(() => {
    if (groupRef.current && isCurrent) {
      groupRef.current.position.y = 0.02 + Math.sin(Date.now() * 0.003) * 0.04;
    }
  });

  return createElement(
    "group",
    {
      ref: groupRef,
      position: [x, 0.02, z] as [number, number, number],
    },
    createElement(
      Html,
      {
        center: true,
        distanceFactor: 10,
        sprite: true,
        style: {
          fontSize: "28px",
          lineHeight: 1,
          pointerEvents: "none",
          userSelect: "none",
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.9))",
          transform: isCurrent ? "scale(1.2)" : "scale(1)",
        },
      },
      createElement(
        "span",
        {
          style: {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: isCurrent ? "rgba(34, 211, 238, 0.4)" : "rgba(0,0,0,0.55)",
            border: isCurrent ? "3px solid #22d3ee" : "2px solid rgba(255,255,255,0.5)",
            boxShadow: isCurrent ? "0 0 14px rgba(34, 211, 238, 0.7)" : "0 2px 10px rgba(0,0,0,0.6)",
          },
        },
        emoji
      )
    )
  );
}

export default function BoardScene({
  properties,
  players,
  animatedPositions,
  currentPlayerId,
  developmentByPropertyId,
  ownerByPropertyId,
  onSquareClick,
  rollingDice,
  onDiceComplete,
  lastRollResult,
  onRoll,
  history,
  aiThinking,
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
      return { player, pos, idxOnSquare, totalOnSquare, symbol: player.symbol ?? "hat" };
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
    createElement(BoardTiles, {
      properties,
      developmentByPropertyId,
      ownerByPropertyId,
      onSquareClick,
    }),
    createElement(BoardCenter),
    rollingDice && onDiceComplete
      ? createElement(RollingDice, {
          key: "dice",
          die1: rollingDice.die1,
          die2: rollingDice.die2,
          onComplete: onDiceComplete,
        })
      : null,
    aiThinking ? createElement(AiThinkingLabel, { key: "ai-thinking" }) : null,
    lastRollResult && !rollingDice ? createElement(RollResultLabel, { key: "roll-result", roll: lastRollResult }) : null,
    onRoll ? createElement(CenterRollButton, { key: "roll-btn", onRoll, disabled: !!rollingDice }) : null,
    history ? createElement(CenterActionLog, { key: "action-log", history }) : null,
    ...playerTokens.map(({ player, pos, idxOnSquare, totalOnSquare, symbol }) =>
      createElement(PlayerToken, {
        key: player.user_id,
        positionIndex: pos,
        playerIndex: idxOnSquare,
        totalOnSquare,
        symbol,
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
