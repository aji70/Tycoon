"use client";

import { Html } from "@react-three/drei";
import PropertyCard from "@/components/game/cards/property-card";
import type { Property } from "@/types/game";

const CARD_PX = 76;

/**
 * Flat on the board like bottom-row tiles (0–9), with Y spin so the deed
 * face + text point toward the board center from every edge.
 */
function flatCardRotation(square: Property): [number, number, number] {
  const row = square.grid_row;
  const col = square.grid_col;

  // Reference: positions 0–9 (grid_row 11) — Y = 0
  if (row === 11) return [-Math.PI / 2, 0, 0];
  if (row === 1) return [-Math.PI / 2, Math.PI, 0];
  if (col === 1) return [-Math.PI / 2, Math.PI / 2, 0];
  if (col === 11) return [-Math.PI / 2, -Math.PI / 2, 0];

  const yByPosition: Record<string, number> = {
    bottom: 0,
    top: Math.PI,
    left: Math.PI / 2,
    right: -Math.PI / 2,
  };
  return [-Math.PI / 2, yByPosition[square.position] ?? 0, 0];
}

/** Flat 2D property card on an unowned 3D tile; replaced by 3D buildings once owned. */
export default function VacantPropertyCard3D({
  square,
  x,
  z,
  onClick,
}: {
  square: Property;
  x: number;
  z: number;
  onClick?: () => void;
}) {
  return (
    <Html
      transform
      position={[x, 0.035, z]}
      rotation={flatCardRotation(square)}
      scale={0.44}
      center
      style={{
        pointerEvents: onClick ? "auto" : "none",
        userSelect: "none",
        cursor: onClick ? "pointer" : undefined,
      }}
    >
      <div
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? -1 : undefined}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          width: CARD_PX,
          height: CARD_PX,
          overflow: "hidden",
          borderRadius: 2,
        }}
      >
        <PropertyCard
          square={{ ...square, position: "bottom" }}
          owner={null}
          flatDeed
        />
      </div>
    </Html>
  );
}
