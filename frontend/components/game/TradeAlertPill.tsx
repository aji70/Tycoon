"use client";

import { motion } from "framer-motion";
import { ArrowLeftRight } from "lucide-react";

interface TradeAlertPillProps {
  incomingCount: number;
  onViewTrades?: () => void;
  newTradePulse?: boolean;
}

export default function TradeAlertPill({
  incomingCount,
  onViewTrades,
  newTradePulse = false,
}: TradeAlertPillProps) {
  if (incomingCount === 0) return null;

  const label =
    incomingCount === 1
      ? "1 trade offer"
      : `${incomingCount} trade offers`;

  return (
    <motion.button
      initial={{ opacity: 0, y: -8 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: newTradePulse ? [1, 1.02, 1] : 1,
      }}
      transition={{
        opacity: { duration: 0.2 },
        y: { duration: 0.2 },
        scale: { duration: 0.5 },
      }}
      onClick={onViewTrades}
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-gradient-to-r from-violet-800/90 to-fuchsia-800/90 px-4 py-2.5 backdrop-blur-sm transition active:scale-[0.98]"
    >
      <ArrowLeftRight className="h-5 w-5 shrink-0 text-violet-200" />
      <span className="font-medium text-white">{label}</span>
      <span className="text-sm text-violet-200/90">· Tap to view</span>
    </motion.button>
  );
}
