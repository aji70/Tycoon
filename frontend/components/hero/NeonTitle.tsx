"use client";
import { motion } from "framer-motion";

interface NeonTitleProps {
  text: string;
  size?: "sm" | "md" | "lg";
  /** Skip Framer Motion entrance (opacity 0) so LCP is not delayed after hydration. */
  priority?: boolean;
}

const titleShadow =
  "0 0 8px rgba(0, 240, 255, 0.8), 0 0 16px rgba(0, 240, 255, 0.6)";

export function NeonTitle({ text, size = "lg", priority = false }: NeonTitleProps) {
  const sizeClasses = {
    sm: "text-4xl md:text-5xl",
    md: "text-6xl md:text-7xl",
    lg: "text-7xl md:text-8xl lg:text-9xl",
  };

  const className = `${sizeClasses[size]} font-kronaOne font-bold uppercase tracking-tighter text-[#00F0FF] relative z-10`;

  if (priority) {
    return (
      <div className="relative">
        <h1
          className={className}
          style={{
            textShadow: titleShadow,
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "grayscale",
            textRendering: "geometricPrecision",
          }}
        >
          {text}
        </h1>
      </div>
    );
  }

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
        <motion.h1
          animate={{
            textShadow: [
              titleShadow,
              "0 0 8px rgba(15, 240, 252, 0.8), 0 0 16px rgba(15, 240, 252, 0.6)",
            ],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className={className}
          style={{
            textShadow: titleShadow,
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
