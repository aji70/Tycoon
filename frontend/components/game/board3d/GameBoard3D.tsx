"use client";

import dynamic from "next/dynamic";
import type { Property } from "@/types/game";
import type { Player } from "@/types/game";

const Canvas = dynamic(() => import("@react-three/fiber").then((mod) => mod.Canvas), { ssr: false });
const BoardScene = dynamic(() => import("./BoardScene").then((mod) => mod.default), { ssr: false });

export type GameBoard3DProps = {
  properties: Property[];
  players: Player[];
  animatedPositions: Record<number, number>;
  currentPlayerId: number | null;
  className?: string;
};

export default function GameBoard3D({
  properties,
  players,
  animatedPositions,
  currentPlayerId,
  className = "",
}: GameBoard3DProps) {
  return (
    <div className={`relative w-full aspect-square bg-[#010F10] rounded-lg overflow-hidden ${className}`}>
      <Canvas
        camera={{ position: [0, 12, 12], fov: 45 }}
        shadows
        gl={{ antialias: true, alpha: false }}
      >
        <BoardScene
          properties={properties}
          players={players}
          animatedPositions={animatedPositions}
          currentPlayerId={currentPlayerId}
        />
      </Canvas>
    </div>
  );
}
