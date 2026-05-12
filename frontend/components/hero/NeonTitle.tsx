"use client";
import { motion } from "framer-motion";

interface NeonTitleProps {
  text: string;
  size?: "sm" | "md" | "lg";
}

export function NeonTitle({ text, size = "lg" }: NeonTitleProps) {
  const sizeClasses = {
    sm: "text-4xl md:text-5xl",
    md: "text-6xl md:text-7xl",
    lg: "text-7xl md:text-8xl lg:text-9xl",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, rotateY: -10 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="relative perspective"
      style={{
        perspective: "1000px",
      }}
    >
      <div className="relative">
        {/* Multiple glow layers for depth */}
        <div className="absolute inset-0 text-center -z-10">
          <h1
            className={`${sizeClasses[size]} font-kronaOne font-bold uppercase tracking-tighter text-transparent`}
            style={{
              textShadow: `
                0 0 10px rgba(0, 240, 255, 0.5),
                0 0 20px rgba(0, 240, 255, 0.3),
                0 0 40px rgba(0, 240, 255, 0.2)
              `,
              filter: "blur(8px)",
            }}
          >
            {text}
          </h1>
        </div>

        {/* Main neon text */}
        <motion.h1
          animate={{
            textShadow: [
              `
              0 0 10px rgba(0, 240, 255, 0.8),
              0 0 20px rgba(0, 240, 255, 0.6),
              0 0 40px rgba(0, 240, 255, 0.4),
              0 0 80px rgba(0, 240, 255, 0.2)
              `,
              `
              0 0 15px rgba(15, 240, 252, 0.8),
              0 0 30px rgba(15, 240, 252, 0.6),
              0 0 50px rgba(15, 240, 252, 0.4),
              0 0 100px rgba(15, 240, 252, 0.2)
              `,
            ],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className={`${sizeClasses[size]} font-kronaOne font-bold uppercase tracking-tighter text-[#00F0FF] relative z-10`}
          style={{
            textShadow: `0 0 10px rgba(0, 240, 255, 0.8), 0 0 20px rgba(0, 240, 255, 0.6), 0 0 40px rgba(0, 240, 255, 0.4)`,
            WebkitTextStroke: "1px rgba(0, 240, 255, 0.3)",
          }}
        >
          {text}
        </motion.h1>

        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 blur-lg"
          animate={{ opacity: [0, 0.15, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      </div>
    </motion.div>
  );
}
