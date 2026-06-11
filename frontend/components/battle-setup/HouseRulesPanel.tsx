"use client";
import { motion } from "framer-motion";
import { ReactNode } from "react";

interface HouseRule {
  label: string;
  key: string;
  icon: ReactNode;
  desc: string;
}

interface HouseRulesPanelProps {
  rules: HouseRule[];
  settings: Record<string, boolean>;
  onChange: (key: string, value: boolean) => void;
}

export function HouseRulesPanel({
  rules,
  settings,
  onChange,
}: HouseRulesPanelProps) {
  return (
    <div className="space-y-3">
      {rules.map((rule, idx) => {
        const isActive = settings[rule.key];

        return (
          <motion.div
            key={rule.key}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className={`flex items-center justify-between p-2 md:p-4 rounded-lg border-2 transition-all ${
              isActive
                ? "border-cyan-500/60 bg-cyan-500/15"
                : "border-cyan-500/20 bg-slate-800/30"
            }`}
          >
            <div className="flex items-center gap-2 md:gap-3 flex-1">
              <motion.div
                animate={{ rotate: isActive ? 10 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                className="text-lg md:text-xl text-cyan-400 flex-shrink-0"
              >
                {rule.icon}
              </motion.div>
              <div className="min-w-0">
                <div className="text-xs md:text-sm font-orbitron font-bold text-white uppercase tracking-wide">
                  {rule.label}
                </div>
                <div className="text-xs text-cyan-300/60 font-dmSans hidden md:block">
                  {rule.desc}
                </div>
              </div>
            </div>

            {/* Military-style toggle */}
            <motion.button
              onClick={() => onChange(rule.key, !isActive)}
              className={`relative w-12 h-6 md:w-14 md:h-7 rounded-full transition-all duration-300 flex-shrink-0 border-2 ${
                isActive
                  ? "border-cyan-500 bg-gradient-to-r from-cyan-600 to-cyan-500 shadow-lg shadow-cyan-500/40"
                  : "border-cyan-500/30 bg-slate-700/60"
              }`}
            >
              {/* Toggle indicator */}
              <motion.div
                animate={{ x: isActive ? 24 : 2 }}
                transition={{ type: "spring", stiffness: 600, damping: 25 }}
                className={`absolute top-0.5 w-5 h-5 md:w-6 md:h-6 rounded-full transition-colors ${
                  isActive ? "bg-white shadow-lg shadow-cyan-400/50" : "bg-slate-500"
                }`}
              />

              {/* State labels */}
              <span
                className={`absolute inset-0 flex items-center justify-center text-xs font-bold font-orbitron ${
                  isActive ? "text-slate-900" : "text-cyan-300"
                }`}
              >
                {isActive ? "ON" : "OFF"}
              </span>
            </motion.button>
          </motion.div>
        );
      })}
    </div>
  );
}
