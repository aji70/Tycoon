"use client";
import { useState, useCallback } from "react";

export type TradeBehavior = "never_sell" | "smart" | "generous";
export type BuildStyle = "conservative" | "balanced" | "aggressive";
export type BuyStyle = "conservative" | "balanced" | "aggressive";

export interface AgentSettings {
  /** How the agent responds to incoming trade offers requesting your properties */
  tradeBehavior: TradeBehavior;
  /** How aggressively the agent builds houses/hotels */
  buildStyle: BuildStyle;
  /** How aggressively the agent buys unowned properties */
  buyStyle: BuyStyle;
}

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  tradeBehavior: "smart",
  buildStyle: "balanced",
  buyStyle: "balanced",
};

// Thresholds used by the board pages when the LLM agent is unavailable
export const BUY_SCORE_THRESHOLD: Record<BuyStyle, number> = {
  conservative: 35,
  balanced: 20,
  aggressive: 5,
};
export const BUY_CASH_RESERVE: Record<BuyStyle, number> = {
  conservative: 600,
  balanced: 400,
  aggressive: 200,
};
export const BUILD_MIN_BALANCE: Record<BuildStyle, number> = {
  conservative: 800,
  balanced: 300,
  aggressive: 150,
};
export const BUILD_AFTER_RESERVE: Record<BuildStyle, number> = {
  conservative: 600,
  balanced: 150,
  aggressive: 0,
};

const STORAGE_KEY = "tycoon_agent_settings";

export function useAgentSettings() {
  const [agentSettings, setAgentSettings] = useState<AgentSettings>(() => {
    try {
      const stored =
        typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (stored) return { ...DEFAULT_AGENT_SETTINGS, ...JSON.parse(stored) };
    } catch { /* ignore */ }
    return DEFAULT_AGENT_SETTINGS;
  });

  const updateAgentSettings = useCallback((updates: Partial<AgentSettings>) => {
    setAgentSettings((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  return { agentSettings, updateAgentSettings };
}
