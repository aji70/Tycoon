import { motion } from "framer-motion";
import PropertyCard from "./cards/property-card";
import SpecialCard from "./cards/special-card";
import CornerCard from "./cards/corner-card";
import { Property, Player } from "@/types/game";
import { getPlayerSymbol } from "@/lib/types/symbol";

type BoardSquareProps = {
  square: Property;
  playersHere: Player[];
  currentPlayerId: number;
  owner: string | null;
  devLevel: number;
  mortgaged: boolean;
  playerCount?: number; // Optional - can be passed from parent if you want to use it separately
};

export default function BoardSquare({
  square,
  playersHere,
  currentPlayerId,
  owner,
  devLevel,
  mortgaged,
}: BoardSquareProps) {
  const isTopHalf = square.grid_row === 1;

  // Calculate scale based on number of players (1–8)
  const playerCount = playersHere.length;
  const getTokenScale = (count: number) => {
    if (count <= 1) return 1.0;
    if (count === 2) return 0.9;
    if (count === 3) return 0.82;
    if (count === 4) return 0.72;
    if (count <= 6) return 0.62;
    return 0.52; // For 7–8 players – still readable
  };

  const tokenScale = getTokenScale(playerCount);

  // Helper to position tokens nicely
  const getTokenPositions = (count: number): Array<React.CSSProperties> => {
    if (count === 0) return [];
    if (count === 1) {
      return [{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }];
    }
    if (count === 2) {
      return [
        { top: "38%", left: "38%", transform: "translate(-50%, -50%)" },
        { top: "62%", left: "62%", transform: "translate(-50%, -50%)" },
      ];
    }
    if (count <= 4) {
      return [
        { top: "32%", left: "32%", transform: "translate(-50%, -50%)" },
        { top: "32%", left: "68%", transform: "translate(-50%, -50%)" },
        { top: "68%", left: "32%", transform: "translate(-50%, -50%)" },
        { top: "68%", left: "68%", transform: "translate(-50%, -50%)" },
      ].slice(0, count);
    }

    // Circular layout for 5+ players
    const radius = count <= 6 ? 38 : 34;
    const angleStep = 360 / count;

    return Array.from({ length: count }, (_, i) => {
      const angle = i * angleStep + (count % 2 === 0 ? -angleStep / 2 : 0); // slight offset for even counts
      const rad = (angle * Math.PI) / 180;
      const x = 50 + Math.cos(rad) * radius;
      const y = 50 + Math.sin(rad) * radius;
      return {
        top: `${y}%`,
        left: `${x}%`,
        transform: "translate(-50%, -50%)",
      };
    });
  };

  const tokenPositions = getTokenPositions(playerCount);

  return (
    <motion.div
      style={{
        gridRowStart: square.grid_row,
        gridColumnStart: square.grid_col,
      }}
      className="w-full h-full p-[2px] relative box-border group hover:z-10 transition-transform duration-200"
      whileHover={{ scale: 1.75, zIndex: 50 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <div
        className={`w-full h-full transform group-hover:scale-200 ${
          isTopHalf ? "origin-top group-hover:origin-bottom group-hover:translate-y-[100px]" : ""
        } group-hover:shadow-lg group-hover:shadow-cyan-500/50 transition-transform duration-200 rounded-md overflow-hidden bg-black/20 p-1 relative`}
      >
        {/* Card content */}
        {square.type === "property" && <PropertyCard square={square} owner={owner} />}
        {["community_chest", "chance", "luxury_tax", "income_tax"].includes(square.type) && (
          <SpecialCard square={square} />
        )}
        {square.type === "corner" && <CornerCard square={square} />}

        {/* Development level indicator */}
        {square.type === "property" && devLevel > 0 && (
          <div className="absolute top-1 right-1 bg-yellow-500 text-black text-xs font-bold rounded px-1 z-20 flex items-center gap-0.5">
            {devLevel === 5 ? "🏨" : `🏠 ${devLevel}`}
          </div>
        )}

        {/* Mortgaged overlay */}
        {mortgaged && (
          <>
            <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center z-30 pointer-events-none">
              <span className="text-white text-lg font-bold rotate-12 tracking-wider drop-shadow-2xl">
                MORTGAGED
              </span>
            </div>
            <div className="absolute inset-0 bg-black/50 z-10 pointer-events-none" />
          </>
        )}

     {/* Player Tokens - DEBUG VERSION */}
{playerCount > 0 && (
  <div className="absolute inset-0 pointer-events-none">
    {playersHere.map((player, index) => {
      const isCurrent = player.user_id === currentPlayerId;
      
      // Force visible symbol + bright background for debugging
      const symbol = getPlayerSymbol(player.username) || "★"; // ← fallback if empty
      
      return (
        <motion.div
          key={player.user_id}
          className={`
            absolute flex items-center justify-center rounded-full
            text-white font-extrabold text-2xl
            shadow-2xl border-2 border-white
            ${isCurrent ? "ring-4 ring-yellow-400 ring-offset-4 ring-offset-black" : ""}
          `}
          style={{
            width: "50px",           // ← big for testing
            height: "50px",
            fontSize: "32px",
            backgroundColor: isCurrent ? "#ec4899" : "#3b82f6", // ← bright pink/blue
            ...tokenPositions[index],
            zIndex: 100 + index,     // ← definitely on top
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: index * 0.1, type: "spring" }}
        >
          {symbol}
        </motion.div>
      );
    })}
  </div>
)}
      </div>
    </motion.div>
  );
}