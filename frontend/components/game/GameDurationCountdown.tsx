"use client";

import { useEffect, useState } from "react";
import { Game } from "@/types/game";

const STORAGE_KEY_PREFIX = "tycoon_game_end_";

function getEndTimeMs(game: Game): number | null {
  const durationMinutes = Number(game?.duration ?? 0);
  if (!game?.created_at || durationMinutes <= 0) return null;
  const startMs = new Date(game.created_at).getTime();
  return startMs + durationMinutes * 60 * 1000;
}

function formatRemaining(remainingSeconds: number): string {
  if (remainingSeconds <= 0) return "0:00";
  const m = Math.floor(remainingSeconds / 60);
  const s = Math.floor(remainingSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface GameDurationCountdownProps {
  game: Game | null;
  className?: string;
  /** Compact style (e.g. for mobile bar) */
  compact?: boolean;
}

/**
 * Shows game duration as a countdown (time left). Uses game.created_at + game.duration (minutes).
 * Only visible when game is RUNNING and duration > 0.
 */
export function GameDurationCountdown({ game, className = "", compact }: GameDurationCountdownProps) {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!game || game.status !== "RUNNING") {
      setRemainingSeconds(null);
      return;
    }

    const endMs = getEndTimeMs(game);
    if (endMs == null) {
      setRemainingSeconds(null);
      return;
    }

    const update = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endMs - now) / 1000));
      setRemainingSeconds(remaining);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [game?.id, game?.status, game?.created_at, game?.duration]);

  if (remainingSeconds === null) return null;

  const label = compact ? "⏱" : "Time left";
  const value = formatRemaining(remainingSeconds);
  const isLow = remainingSeconds <= 60;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border ${
        isLow
          ? compact
            ? "border-red-500/60 bg-red-950/40 text-red-300"
            : "border-red-500/60 bg-red-950/40 text-red-600"
          : compact
            ? "border-cyan-500/40 bg-cyan-950/30 text-cyan-200"
            : "border-gray-400/40 bg-white/80 text-black"
      } ${className}`}
      title={compact ? `Time left: ${value}` : undefined}
    >
      <span className="text-sm font-medium">{label}</span>
      <span className={`font-mono font-bold tabular-nums ${compact ? "text-sm" : "text-base"}`}>
        {value}
      </span>
    </div>
  );
}
