"use client";
import { motion } from "framer-motion";

interface NeonTitleProps {
  text: string;
  size?: "sm" | "md" | "lg";
}

export function NeonTitle({ text, size = "lg" }: NeonTitleProps) {
  const sizeClasses = {
    sm: "text-3xl",
    md: "text-5xl",
    lg: "text-6xl",
  };

  const shadowStyle = "0 0 20px #00E5FF, 0 0 40px #00E5FF";

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, rotateY: -10 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="relative perspective"
      style={{
        perspective: "1000px",
        willChange: "auto",
      }}
    >
      <div className="relative" style={{ backfaceVisibility: "hidden" }}>
        {/* Main neon text - sharp and readable */}
        <motion.h1
          className={`${sizeClasses[size]} font-kronaOne font-bold uppercase tracking-tighter text-[#00F0FF] relative z-10`}
          style={{
            textShadow: shadowStyle,
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "grayscale",
            textRendering: "geometricPrecision",
          }}
        >
          {text}
        </motion.h1>
      </div>
    </motion.div>
  );
}
