"use client";
import { motion } from "framer-motion";
import React from "react";

interface GlowButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "tertiary";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  icon?: React.ReactNode;
  glow?: boolean;
}

export function GlowButton({
  onClick,
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  icon,
  glow = true,
}: GlowButtonProps) {
  // Fix: disabled should not default based on glow
  const effectiveGlow = glow && !disabled;

  const sizeClasses = {
    sm: "h-[44px] px-4 text-sm",
    md: "h-[48px] px-6 text-base",
    lg: "h-[56px] px-8 text-lg",
  };

  const variantClasses = {
    primary: {
      bg: "#00F0FF",
      border: "#0E282A",
      text: "#010F10",
      glow: "from-cyan-500 via-cyan-400 to-cyan-500",
    },
    secondary: {
      bg: "#003B3E",
      border: "#00F0FF",
      text: "#00F0FF",
      glow: "from-cyan-600 via-cyan-500 to-cyan-600",
    },
    tertiary: {
      bg: "#0E1415",
      border: "#003B3E",
      text: "#0FF0FC",
      glow: "from-cyan-700 via-cyan-600 to-cyan-700",
    },
  };

  const colors = variantClasses[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <button
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        className={`relative overflow-hidden rounded-lg font-orbitron font-bold uppercase transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group ${sizeClasses[size]}`}
        style={{
          backgroundColor: colors.bg,
          color: colors.text,
          border: `2px solid ${colors.border}`,
        }}
      >
        {/* Glow background */}
        {effectiveGlow && (
          <>
            <div className="absolute -inset-1 rounded-lg opacity-0 group-hover:opacity-100 transition duration-300 blur-lg z-0"
              style={{
                background: `linear-gradient(135deg, ${colors.glow})`,
              }}
            />
            <motion.div
              className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-60 z-0 blur-sm"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                background: `linear-gradient(135deg, ${colors.glow})`,
              }}
            />
          </>
        )}

        {/* Content */}
        <div className="relative z-10 flex items-center justify-center gap-2">
          {icon}
          {children}
        </div>

        {/* Hover shine effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent rounded-lg opacity-0 group-hover:opacity-20 z-5"
          initial={{ x: "-100%" }}
          whileHover={{ x: "100%" }}
          transition={{ duration: 0.5 }}
        />
      </button>
    </motion.div>
  );
}
