import { motion } from "framer-motion";
import PropertyCard from "../cards/property-card";
import SpecialCard from "../cards/special-card";
import CornerCard from "../cards/corner-card";
import { Property, Player } from "@/types/game";
import { getPlayerSymbol, getPlayerSymbolData } from "@/lib/types/symbol";

type BoardSquareProps = {
  square: Property;
  playersHere: Player[];
  currentPlayerId: number;
  owner: string | null;
  devLevel: number;
  mortgaged: boolean;
  onClick?: () => void; // NEW: Optional click handler (for owned properties)
};

export default function BoardSquare({
  square,
  playersHere,
  currentPlayerId,
  owner,
  devLevel,
  mortgaged,
  onClick, // NEW
}: BoardSquareProps) {
  const isTopHalf = square.grid_row === 1;
  const playerCount = playersHere.length;

  // Only make property squares clickable if it's a buildable property
  const isClickableProperty = square.type === "property" && onClick;

  return (
    <motion.div
      style={{
        gridRowStart: square.grid_row,
        gridColumnStart: square.grid_col,
      }}
      className={`w-full h-full p-[2px] relative box-border group hover:z-10 transition-transform duration-200 ${
        isClickableProperty ? "cursor-pointer" : ""
      }`}
      whileHover={{ scale: 1.75, zIndex: 50 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onClick={isClickableProperty ? onClick : undefined} // Trigger modal only on owned properties
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

        {/* Development indicator */}
        {square.type === "property" && devLevel > 0 && (
          <div className="absolute top-1 right-1 bg-yellow-500 text-black text-xs font-bold rounded px-1 z-20 flex items-center gap-0.5">
            {devLevel === 5 ? "🏨" : `🏠 ${devLevel}`}
          </div>
        )}

        {/* Enhanced Mortgaged Overlay */}
        {mortgaged && (
          <>
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/60 z-10 pointer-events-none" />
            
            {/* Diagonal red stripe */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-red-600/70 to-transparent z-20 pointer-events-none" />
            
            {/* Bold MORTGAGED text */}
            <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
              <span className="text-red-300 text-2xl font-black tracking-wider drop-shadow-2xl rotate-[-30deg] scale-150">
                MORTGAGED
              </span>
            </div>
          </>
        )}

        {/* Player Tokens */}
        {playerCount > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-3">
            <div className="relative w-full h-full flex flex-wrap items-center justify-center gap-2">
              {playersHere.map((player, index) => {
                const isCurrent = player.user_id === currentPlayerId;
                const symbol = getPlayerSymbol(player.symbol ?? "hat") || "🎲";
                const tokenData = getPlayerSymbolData(player.symbol ?? "hat");
                const tokenName = tokenData?.name || "Classic Token";

                const size = playerCount === 1 
                  ? 60
                  : playerCount === 2 
                  ? 42
                  : playerCount <= 4 
                  ? 36
                  : 30;

                const fontSize = playerCount === 1 
                  ? 36
                  : playerCount === 2 
                  ? 26
                  : playerCount <= 4 
                  ? 22
                  : 18;

                return (
                  <motion.div
                    key={player.user_id}
                    className={`
                      flex items-center justify-center rounded-full
                      bg-transparent text-white font-bold shadow-2xl
                      ${isCurrent 
                        ? "ring-2 ring-cyan-400 ring-offset-1"
                        : "border border-white/40"
                      }
                    `}
                    style={{
                      width: `${size}px`,
                      height: `${size}px`,
                      fontSize: `${fontSize}px`,
                      minWidth: `${size}px`,
                      minHeight: `${size}px`,
                    }}
                    title={tokenName}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 350,
                      damping: 20,
                      delay: index * 0.07,
                    }}
                    whileHover={{ scale: 1.15 }}
                  >
                    {symbol}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}