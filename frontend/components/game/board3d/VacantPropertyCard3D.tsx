"use client";

import { Html } from "@react-three/drei";
import PropertyCard from "@/components/game/cards/property-card";
import type { Property } from "@/types/game";

const CARD_PX = 76;

/** Same flat lay + orientation as mobile bottom row (grid_row 11). */
const BOTTOM_ROW_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0];

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
      rotation={BOTTOM_ROW_ROTATION}
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
        />
      </div>
    </Html>
  );
}
