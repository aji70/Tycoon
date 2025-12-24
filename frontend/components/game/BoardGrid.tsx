"use client";

import { motion } from "framer-motion";
import PropertyCard from "./cards/property-card";
import SpecialCard from "./cards/special-card";
import CornerCard from "./cards/corner-card";
import { getPlayerSymbol } from "@/lib/types/symbol";
import { Property, GameProperty, Player } from "@/types/game";

interface BoardGridProps {
  properties: Property[]; // ← Use the real type from your data
  game_properties: GameProperty[];
  players: Player[];
  currentPlayerId?: number;
}

export default function BoardGrid({
  properties,
  game_properties,
  players,
  currentPlayerId,
}: BoardGridProps) {
  // Group players by their current position
  const playersByPosition = new Map<number, Player[]>();
  players.forEach((player) => {
    const pos = player.position ?? 0;
    if (!playersByPosition.has(pos)) {
      playersByPosition.set(pos, []);
    }
    playersByPosition.get(pos)!.push(player);
  });

  // Helper functions
  const getOwnerUsername = (propertyId: number): string | null => {
    const gameProp = game_properties.find((gp) => gp.property_id === propertyId);
    return gameProp
      ? players.find((p) => p.address === gameProp.address)?.username ?? null
      : null;
  };

  const getDevelopmentLevel = (propertyId: number): number =>
    game_properties.find((gp) => gp.property_id === propertyId)?.development ?? 0;

  const isPropertyMortgaged = (propertyId: number): boolean =>
    game_properties.find((gp) => gp.property_id === propertyId)?.mortgaged === true;

  return (
    <div className="grid grid-cols-11 grid-rows-11 w-full h-full gap-[2px] box-border select-none">
      {/* Center empty area (for CenterInfo overlay) */}
      <div
        className="
          col-start-2 col-span-9 
          row-start-2 row-span-9 
          bg-[#010F10]/90 
          flex flex-col justify-center items-center 
          p-4 md:p-6 lg:p-8 
          relative overflow-hidden
          rounded-xl border border-cyan-900/30
        "
      />

      {/* Board squares */}
      {properties.map((square) => {
        // We expect these fields to exist in your Property type/data
        const gridRow = (square as any).grid_row ?? 1; // fallback if missing
        const gridCol = (square as any).grid_col ?? 1;

        const playersHere = playersByPosition.get(square.id) ?? [];
        const devLevel = getDevelopmentLevel(square.id);
        const isMortgaged = isPropertyMortgaged(square.id);
        const owner = getOwnerUsername(square.id);

        return (
          <motion.div
            key={square.id}
            style={{
              gridRowStart: gridRow,
              gridColumnStart: gridCol,
            }}
            className="
              w-full h-full p-[2px] 
              relative box-border 
              group 
              hover:z-20 
              transition-transform duration-200
            "
            whileHover={{ scale: 1.8, zIndex: 60 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
          >
            <div
              className={`
                w-full h-full 
                transform transition-all duration-300
                group-hover:scale-200 
                ${gridRow === 1
                  ? "origin-top group-hover:origin-bottom group-hover:translate-y-[120px]"
                  : "origin-bottom group-hover:origin-top group-hover:-translate-y-[120px]"}
                group-hover:shadow-2xl group-hover:shadow-cyan-600/40 
                rounded-lg overflow-hidden 
                bg-gradient-to-br from-gray-950 to-black/80 
                border border-gray-700/40
                relative
              `}
            >
              {/* Card Content */}
              {square.type === "property" && (
                <PropertyCard square={square} owner={owner} />
              )}

              {["community_chest", "chance", "luxury_tax", "income_tax"].includes(square.type) && (
                <SpecialCard square={square} />
              )}

              {square.type === "corner" && <CornerCard square={square} />}

              {/* Development Indicator */}
              {square.type === "property" && devLevel > 0 && (
                <div className="
                  absolute top-1.5 right-1.5 
                  bg-gradient-to-br from-yellow-400 to-amber-600 
                  text-black text-xs font-bold 
                  px-1.5 py-0.5 rounded 
                  shadow-md z-30 
                  flex items-center gap-1
                ">
                  {devLevel === 5 ? "🏨" : `🏠 ×${devLevel}`}
                </div>
              )}

              {/* Mortgaged Overlay */}
              {isMortgaged && (
                <>
                  <div className="absolute inset-0 bg-red-950/70 z-20 pointer-events-none" />
                  <div className="
                    absolute inset-0 
                    flex items-center justify-center 
                    z-30 pointer-events-none
                  ">
                    <span className="
                      text-red-300/90 text-xl md:text-2xl font-black 
                      rotate-[-18deg] tracking-widest 
                      drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]
                    ">
                      MORTGAGED
                    </span>
                  </div>
                </>
              )}

              {/* Player Tokens */}
              <div className="absolute bottom-1 left-1 flex flex-wrap gap-1.5 md:gap-2 z-40">
                {playersHere.map((player) => {
                  const isCurrent = player.user_id === currentPlayerId;

                  return (
                    <motion.span
                      key={player.user_id}
                      title={`${player.username} ($${player.balance?.toLocaleString() ?? "0"})`}
                      className={`
                        text-2xl md:text-3xl lg:text-4xl 
                        drop-shadow-lg
                        border-2 rounded-full p-0.5
                        ${isCurrent ? "border-cyan-300 shadow-cyan-500/50" : "border-transparent"}
                      `}
                      animate={
                        isCurrent
                          ? { y: [0, -10, 0], scale: [1, 1.15, 1], rotate: [0, 6, -6, 0] }
                          : { y: [0, -4, 0], scale: 1 }
                      }
                      transition={{
                        y: { duration: isCurrent ? 1.4 : 3, repeat: Infinity, ease: "easeInOut" },
                        scale: { duration: isCurrent ? 1.4 : 0, repeat: Infinity },
                        rotate: { duration: isCurrent ? 1.8 : 0, repeat: Infinity },
                      }}
                      whileHover={{ scale: 1.3, y: -4 }}
                    >
                      {getPlayerSymbol(player.symbol)}
                    </motion.span>
                  );
                })}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}