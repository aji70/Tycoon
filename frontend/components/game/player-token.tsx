import { motion } from "framer-motion";
import { Player } from "@/types/game";
import { getPlayerSymbol } from "@/lib/types/symbol";

type PlayerTokensProps = {
  playersHere: Player[];
  currentPlayerId: number;
};

export default function PlayerTokens({ playersHere, currentPlayerId }: PlayerTokensProps) {
  return (
    <div className="absolute bottom-1 left-1 flex flex-wrap gap-2 z-40">
      {playersHere.map((p) => {
        const isCurrentPlayer = p.user_id === currentPlayerId;
        return (
          <motion.span
            key={p.user_id}
            title={`${p.username} ($${p.balance})`}
            className={`text-xl md:text-2xl lg:text-3xl border-2 rounded ${
              isCurrentPlayer ? "border-cyan-300" : "border-transparent"
            }`}
            initial={{ scale: 1 }}
            animate={{
              y: isCurrentPlayer ? [0, -8, 0] : [0, -3, 0],
              scale: isCurrentPlayer ? [1, 1.1, 1] : 1,
              rotate: isCurrentPlayer ? [0, 5, -5, 0] : 0,
            }}
            transition={{
              y: { duration: isCurrentPlayer ? 1.2 : 2, repeat: Infinity, ease: "easeInOut" },
              scale: { duration: isCurrentPlayer ? 1.2 : 0, repeat: Infinity, ease: "easeInOut" },
              rotate: { duration: isCurrentPlayer ? 1.5 : 0, repeat: Infinity, ease: "easeInOut" },
            }}
            whileHover={{ scale: 1.2, y: -2 }}
          >
            {getPlayerSymbol(p.symbol)}
          </motion.span>
        );
      })}
    </div>
  );
}