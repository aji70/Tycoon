"use client";

import { motion } from "framer-motion";
import { RollResult } from "@/hooks/useDiceRoll"; // adjust path if needed

interface DiceAnimationProps {
  isRolling: boolean;
  roll: RollResult | null;
}

const DiceFace = ({ value }: { value: number }) => {
  // Dot positions for each face (in percentage for responsive scaling)
  const dotPositions: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[30, 30], [70, 70]],
    3: [[30, 30], [50, 50], [70, 70]],
    4: [[30, 30], [30, 70], [70, 30], [70, 70]],
    5: [[30, 30], [30, 70], [50, 50], [70, 30], [70, 70]],
    6: [[30, 20], [30, 50], [30, 80], [70, 20], [70, 50], [70, 80]],
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-white via-gray-50 to-gray-100 rounded-2xl shadow-2xl border-4 border-gray-300/70 relative overflow-hidden">
      {dotPositions[value]?.map(([x, y], i) => (
        <div
          key={i}
          className="absolute w-[18%] h-[18%] bg-gradient-to-br from-gray-900 to-black rounded-full shadow-inner"
          style={{
            top: `${y}%`,
            left: `${x}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </div>
  );
};

export default function DiceAnimation({ isRolling, roll }: DiceAnimationProps) {
  if (!isRolling && !roll) return null;

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center gap-16 lg:gap-24 z-30 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* First Die */}
      <motion.div
        className="relative w-32 h-32 lg:w-44 lg:h-44 rounded-3xl border-4 border-gray-700/50 shadow-2xl overflow-hidden"
        style={{
          boxShadow: "0 30px 60px rgba(0,0,0,0.6), inset 0 12px 24px rgba(255,255,255,0.4)",
        }}
        animate={
          isRolling
            ? {
                rotateX: [0, 360 * 4, 720 * 2],
                rotateY: [0, -360 * 3, 720],
                scale: [1, 1.08, 1],
              }
            : {}
        }
        transition={
          isRolling
            ? { duration: 1.4, ease: "easeOut" }
            : { duration: 0.6 }
        }
      >
        {roll ? (
          <DiceFace value={roll.die1} />
        ) : (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 flex items-center justify-center text-6xl lg:text-8xl font-black text-gray-400"
          >
            ?
          </motion.div>
        )}
      </motion.div>

      {/* Second Die */}
      <motion.div
        className="relative w-32 h-32 lg:w-44 lg:h-44 rounded-3xl border-4 border-gray-700/50 shadow-2xl overflow-hidden"
        style={{
          boxShadow: "0 30px 60px rgba(0,0,0,0.6), inset 0 12px 24px rgba(255,255,255,0.4)",
        }}
        animate={
          isRolling
            ? {
                rotateX: [0, -360 * 3, 720 * 2],
                rotateY: [0, 360 * 4, -720],
                scale: [1, 1.08, 1],
                
              }
            : {}
        }
        transition={
          isRolling
            ? { duration: 1.4, ease: "easeOut", delay: 0.15 }
            : { duration: 0.6 }
        }
      >
        {roll ? (
          <DiceFace value={roll.die2} />
        ) : (
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 flex items-center justify-center text-6xl lg:text-8xl font-black text-gray-400"
          >
            ?
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}