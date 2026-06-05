"use client";

import { Html } from "@react-three/drei";
import PropertyCard from "@/components/game/cards/property-card";
import type { Property, Position } from "@/types/game";

const CARD_PX = 76;

/** Y rotation so the deed faces the board center from each edge (after laying flat). */
function cardRotation(position: Position): [number, number, number] {
  const y: Record<Position, number> = {
    bottom: 0,
    top: Math.PI,
    left: Math.PI / 2,
    right: -Math.PI / 2,
  };
  return [-Math.PI / 2, y[position] ?? 0, 0];
}

/** Flat 2D property card on an unowned 3D tile; replaced by 3D buildings once owned. */
export default function VacantPropertyCard3D({
  square,
  x,
  z,
}: {
  square: Property;
  x: number;
  z: number;
}) {
  const position = square.position ?? "bottom";

  return (
    <Html
      transform
      position={[x, 0.035, z]}
      rotation={cardRotation(position)}
      scale={0.44}
      center
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <div
        style={{
          width: CARD_PX,
          height: CARD_PX,
          overflow: "hidden",
          borderRadius: 2,
        }}
      >
        <PropertyCard square={{ ...square, position }} owner={null} />
      </div>
    </Html>
  );
}
