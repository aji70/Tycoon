/** Defaults for a new Tycoon-hosted arena agent (no API key / URL setup). */

export type AgentBehaviorProfile = {
  goal?: "win" | "maximize_prize" | "survive" | "aggressive_growth";
  risk?: "low" | "medium" | "high";
  liquidity?: "tight" | "balanced" | "flush";
  property_focus?: "balanced" | "monopolies" | "rail_util" | "high_rent" | "cashflow";
  trade_behavior?: string;
  buy_style?: string;
  build_style?: string;
  notes?: string;
};

export function defaultBehaviorProfile(): AgentBehaviorProfile {
  return {
    goal: "win",
    risk: "medium",
    liquidity: "balanced",
    property_focus: "balanced",
    trade_behavior: "smart",
    buy_style: "balanced",
    build_style: "balanced",
    notes: "",
  };
}

export function behaviorToPrompt(name: string, profile: AgentBehaviorProfile): string {
  const goal = profile.goal || "win";
  const risk = profile.risk || "medium";
  const liquidity = profile.liquidity || "balanced";
  const focus = profile.property_focus || "balanced";
  const trade = profile.trade_behavior || "smart";
  const buy = profile.buy_style || "balanced";
  const build = profile.build_style || "balanced";
  const notes = (profile.notes || "").trim();

  return [
    `You are "${name}" — an autonomous Tycoon (Monopoly-style) agent.`,
    "",
    "## Objective",
    `- Primary objective: ${goal.replace(/_/g, " ")}.`,
    "",
    "## Risk & bankroll",
    `- Risk tolerance: ${risk}.`,
    `- Liquidity style: ${liquidity}.`,
    "",
    "## Strategy",
    `- Property focus: ${focus}.`,
    `- Buy style: ${buy}.`,
    `- Build style: ${build}.`,
    `- Trade behavior: ${trade}.`,
    "",
    notes ? "## Extra instructions\n" + notes : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildTycoonHostedAgentPayload(name: string) {
  const trimmed = name.trim();
  const profile = defaultBehaviorProfile();
  const prompt = behaviorToPrompt(trimmed, profile);
  return {
    name: trimmed,
    use_tycoon_key: true,
    provider: "anthropic",
    chain_id: 42220,
    config: {
      behavior_profile: profile,
      behavior_prompt: prompt,
      skill: prompt,
    },
  };
}
