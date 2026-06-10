"use client";
import { ReactNode } from "react";
import { motion } from "framer-motion";

interface LoadoutCardProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  variant?: "default" | "danger";
  glow?: boolean;
  danger?: boolean;
}

export function LoadoutCard({
  icon,
  title,
  children,
  variant = "default",
  glow = true,
  danger = false,
}: LoadoutCardProps) {
  const isDanger = variant === "danger" || danger;
  const bgGradient = isDanger
    ? "from-red-900/40 via-red-800/30 to-orange-900/40"
    : "from-slate-800/60 via-slate-800/40 to-slate-900/40";
  const borderColor = isDanger ? "border-red-500/40" : "border-cyan-500/30";
  const glowColor = isDanger ? "from-red-500/20 to-orange-500/20" : "from-cyan-500/20 to-cyan-400/20";
  const iconColor = isDanger ? "text-red-400" : "text-cyan-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative group"
    >
      {/* Glow effect on hover */}
      {glow && (
        <div
          className={`absolute -inset-1 bg-gradient-to-r ${glowColor} rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-300 z-0`}
        />
      )}

      <div
        className={`relative bg-gradient-to-br ${bgGradient} rounded-xl md:rounded-2xl p-3 md:p-4 lg:p-6 border ${borderColor} backdrop-blur-sm transition-all duration-300 group-hover:border-${isDanger ? "red" : "cyan"}-400/60 h-full`}
      >
        {/* Metallic accent bar */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${isDanger ? "from-red-500 to-orange-500" : "from-cyan-500 to-cyan-400"} rounded-t-xl md:rounded-t-2xl opacity-60`} />

        {/* Title with icon */}
        <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4 lg:mb-5">
          <motion.div
            whileHover={{ scale: 1.15, rotate: isDanger ? 0 : 5 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
            className={`text-2xl md:text-3xl ${iconColor}`}
          >
            {icon}
          </motion.div>
          <h3 className="text-sm md:text-base lg:text-lg font-bold text-white font-orbitron uppercase tracking-wider">
            {title}
          </h3>
        </div>

        {/* Content */}
        <div className="space-y-2 md:space-y-3">{children}</div>
      </div>
    </motion.div>
  );
}
