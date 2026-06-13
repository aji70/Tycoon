"use client";

import type { AgentBehaviorProfile } from "@/lib/agentCreatePayload";
import styles from "./arena-my-agents-simple.module.css";

type Props = {
  profile: AgentBehaviorProfile;
  onChange: (next: AgentBehaviorProfile) => void;
  idPrefix?: string;
};

/** Compact strategy fields for Arena — maps to the agent skill prompt behind the scenes. */
export function AgentStrategyFields({ profile, onChange, idPrefix = "agent" }: Props) {
  const set = <K extends keyof AgentBehaviorProfile>(key: K, value: AgentBehaviorProfile[K]) => {
    onChange({ ...profile, [key]: value });
  };

  return (
    <div className={styles.strategyGrid}>
      <div>
        <label className={styles.label} htmlFor={`${idPrefix}-goal`}>
          Play style
        </label>
        <select
          id={`${idPrefix}-goal`}
          className={styles.select}
          value={profile.goal ?? "win"}
          onChange={(e) => set("goal", e.target.value as AgentBehaviorProfile["goal"])}
        >
          <option value="win">Balanced — try to win</option>
          <option value="maximize_prize">Prize hunter</option>
          <option value="survive">Play safe</option>
          <option value="aggressive_growth">Aggressive growth</option>
        </select>
      </div>

      <div>
        <label className={styles.label} htmlFor={`${idPrefix}-risk`}>
          Risk level
        </label>
        <select
          id={`${idPrefix}-risk`}
          className={styles.select}
          value={profile.risk ?? "medium"}
          onChange={(e) => set("risk", e.target.value as AgentBehaviorProfile["risk"])}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      <div className={styles.strategyFull}>
        <label className={styles.label} htmlFor={`${idPrefix}-focus`}>
          Property focus
        </label>
        <select
          id={`${idPrefix}-focus`}
          className={styles.select}
          value={profile.property_focus ?? "balanced"}
          onChange={(e) => set("property_focus", e.target.value as AgentBehaviorProfile["property_focus"])}
        >
          <option value="balanced">Balanced</option>
          <option value="monopolies">Monopolies first</option>
          <option value="rail_util">Railroads & utilities</option>
          <option value="high_rent">High-rent squares</option>
          <option value="cashflow">Steady cashflow</option>
        </select>
      </div>

      <div className={styles.strategyFull}>
        <label className={styles.label} htmlFor={`${idPrefix}-skills`}>
          Custom instructions <span className={styles.optionalTag}>(optional)</span>
        </label>
        <textarea
          id={`${idPrefix}-skills`}
          className={styles.textarea}
          rows={3}
          placeholder='e.g. "Keep $300 cash", "Never mortgage railroads", "Target orange set"'
          value={profile.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
        />
        <p className={styles.fieldHelp}>
          This becomes your agent&apos;s skill prompt — how it decides trades, buys, and builds.
        </p>
      </div>
    </div>
  );
}
