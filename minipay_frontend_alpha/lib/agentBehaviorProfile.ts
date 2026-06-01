import type { AgentSettings, TradeBehavior, BuyStyle, BuildStyle } from "@/hooks/useAgentSettings";

const LEGACY_TRADE_MAP: Record<string, TradeBehavior> = {
  avoid: "never_sell",
  balanced: "smart",
  aggressive: "generous",
  never_sell: "never_sell",
  smart: "smart",
  generous: "generous",
};

export function normalizeTradeBehavior(raw: unknown): TradeBehavior {
  if (typeof raw === "string" && raw in LEGACY_TRADE_MAP) return LEGACY_TRADE_MAP[raw];
  return "smart";
}

export function normalizeBuyStyle(raw: unknown): BuyStyle {
  if (raw === "conservative" || raw === "balanced" || raw === "aggressive") return raw;
  return "balanced";
}

export function normalizeBuildStyle(raw: unknown): BuildStyle {
  if (raw === "conservative" || raw === "balanced" || raw === "aggressive") return raw;
  return "balanced";
}

/** When opening edit: load trade/buy/build into the same UI state used at submit time. */
export function syncAgentSettingsFromSavedProfile(
  p: unknown,
  update: (u: Partial<AgentSettings>) => void
) {
  if (!p || typeof p !== "object") return;
  const o = p as Record<string, unknown>;
  const patch: Partial<AgentSettings> = {};
  if (o.trade_behavior != null) patch.tradeBehavior = normalizeTradeBehavior(o.trade_behavior);
  if (o.buy_style != null) patch.buyStyle = normalizeBuyStyle(o.buy_style);
  if (o.build_style != null) patch.buildStyle = normalizeBuildStyle(o.build_style);
  if (Object.keys(patch).length > 0) update(patch);
}

/** Persist gameplay sliders (trade / buy / build) together with behavior profile. */
export function mergeGameplayIntoBehaviorProfile<T extends Record<string, unknown>>(
  profile: T,
  settings: AgentSettings
): T & { trade_behavior: TradeBehavior; buy_style: BuyStyle; build_style: BuildStyle } {
  return {
    ...profile,
    trade_behavior: settings.tradeBehavior,
    buy_style: settings.buyStyle,
    build_style: settings.buildStyle,
  };
}
