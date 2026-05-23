"use client";

import { useEffect, useMemo } from "react";
import styles from "./arena-revamp.module.css";
import type { DiscoverAgent } from "./map-api-agents";

export type ArenaTab = "discover" | "challenges" | "leaderboard" | "tournaments" | "my-agents";
export type MatchType = "agentVsAi" | "agentVsAgent";

export interface ArenaRevampAgent {
  id: number;
  name: string;
  username?: string;
}

export interface ArenaRevampPageProps {
  activeTab: ArenaTab;
  onTabChange: (tab: ArenaTab) => void;
  isAuthed: boolean;
  myAgents: ArenaRevampAgent[];
  discoverAgents: DiscoverAgent[];
  selectedOpponentIds: number[];
  onToggleOpponent: (id: number) => void;
  maxOpponentSlots: number;
  challengerAgentId: number | null;
  onChallengerChange: (id: number) => void;
  stakeAmount: string;
  onStakeChange: (v: string) => void;
  matchType: MatchType;
  onMatchTypeChange: (t: MatchType) => void;
  onLaunch: () => void;
  isLaunching: boolean;
  loading?: boolean;
  tabPanels?: Partial<Record<ArenaTab, React.ReactNode>>;
  error?: string | null;
}

const TABS: { id: ArenaTab; label: string }[] = [
  { id: "discover", label: "Discover" },
  { id: "challenges", label: "Challenges" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "tournaments", label: "Tournaments" },
  { id: "my-agents", label: "My Agents" },
];

function winRate(wins: number, losses: number): number | null {
  const total = wins + losses;
  if (total === 0) return null;
  return Math.round((wins / total) * 100);
}

export function ArenaRevampPage({
  activeTab,
  onTabChange,
  isAuthed,
  myAgents,
  discoverAgents,
  selectedOpponentIds,
  onToggleOpponent,
  maxOpponentSlots,
  challengerAgentId,
  onChallengerChange,
  stakeAmount,
  onStakeChange,
  matchType,
  onMatchTypeChange,
  onLaunch,
  isLaunching,
  loading,
  tabPanels,
  error,
}: ArenaRevampPageProps) {
  const playingAsOptions = useMemo(() => {
    return myAgents.map((a) => ({ id: a.id, label: a.name }));
  }, [myAgents]);

  useEffect(() => {
    if (challengerAgentId == null && playingAsOptions.length > 0) {
      onChallengerChange(playingAsOptions[0].id);
    }
  }, [challengerAgentId, playingAsOptions, onChallengerChange]);

  const canLaunch =
    isAuthed &&
    challengerAgentId != null &&
    selectedOpponentIds.length > 0 &&
    !isLaunching;

  const showMatchBar = activeTab === "discover";

  return (
    <div className={styles.shell}>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Arena</h1>
          <p className={styles.subtitle}>Pick opponents, set a stake, and launch a match on Celo.</p>
        </header>

        <div className={styles.tabs} role="tablist" aria-label="Arena sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              className={activeTab === t.id ? styles.tabActive : styles.tab}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          {error ? <div className={styles.errorBanner}>{error}</div> : null}

          {showMatchBar ? (
            <section className={styles.matchBar} aria-label="Match setup">
              {!isAuthed ? (
                <p className={styles.matchHint}>
                  Sign in from the nav to launch matches. Browse agents below in the meantime.
                </p>
              ) : myAgents.length === 0 ? (
                <p className={styles.matchHint}>
                  Create an agent in{" "}
                  <button type="button" className={styles.inlineBtn} onClick={() => onTabChange("my-agents")}>
                    My Agents
                  </button>{" "}
                  before starting a match.
                </p>
              ) : (
                <div className={styles.matchRow}>
                  <div className={styles.matchField}>
                    <label className={styles.fieldLabel} htmlFor="playing-as">
                      Your agent
                    </label>
                    <select
                      id="playing-as"
                      className={styles.select}
                      value={challengerAgentId ?? ""}
                      onChange={(e) => onChallengerChange(Number(e.target.value))}
                    >
                      {playingAsOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.matchField}>
                    <label className={styles.fieldLabel} htmlFor="usdc-stake">
                      Stake (USDC)
                    </label>
                    <input
                      id="usdc-stake"
                      type="number"
                      min={0}
                      step="0.01"
                      className={`${styles.input} ${styles.mono}`}
                      placeholder="0 — optional"
                      value={stakeAmount}
                      onChange={(e) => onStakeChange(e.target.value)}
                    />
                  </div>

                  <div className={styles.matchField}>
                    <span className={styles.fieldLabel}>Mode</span>
                    <div className={styles.modeToggle}>
                      <button
                        type="button"
                        className={`${styles.modeBtn} ${matchType === "agentVsAgent" ? styles.modeBtnActive : ""}`}
                        onClick={() => onMatchTypeChange("agentVsAgent")}
                      >
                        Agent vs Agent
                      </button>
                      <button
                        type="button"
                        className={`${styles.modeBtn} ${matchType === "agentVsAi" ? styles.modeBtnActive : ""}`}
                        onClick={() => onMatchTypeChange("agentVsAi")}
                      >
                        You vs Agent
                      </button>
                    </div>
                  </div>

                  <div className={styles.matchActions}>
                    <span className={styles.pickCount}>
                      {selectedOpponentIds.length} / {maxOpponentSlots} selected
                    </span>
                    <button
                      type="button"
                      className={styles.launchBtn}
                      disabled={!canLaunch}
                      onClick={onLaunch}
                    >
                      {isLaunching ? "Starting…" : "Start match"}
                    </button>
                  </div>
                </div>
              )}
            </section>
          ) : null}

          <section className={styles.panel} aria-label={TABS.find((t) => t.id === activeTab)?.label}>
            {activeTab === "discover" ? (
              loading ? (
                <p className={styles.emptyState}>Loading agents…</p>
              ) : discoverAgents.length === 0 ? (
                <div className={styles.emptyState}>
                  <p className={styles.emptyTitle}>No public agents yet</p>
                  <p className={styles.emptyDesc}>
                    Be the first — create an agent and set it to public in My Agents.
                  </p>
                  <button type="button" className={styles.emptyCta} onClick={() => onTabChange("my-agents")}>
                    Go to My Agents
                  </button>
                </div>
              ) : (
                <div className={styles.agentsGrid}>
                  {discoverAgents.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      selected={selectedOpponentIds.includes(agent.id)}
                      maxReached={
                        selectedOpponentIds.length >= maxOpponentSlots &&
                        !selectedOpponentIds.includes(agent.id)
                      }
                      onSelect={() => onToggleOpponent(agent.id)}
                    />
                  ))}
                </div>
              )
            ) : (
              tabPanels?.[activeTab] ?? <p className={styles.emptyState}>Nothing here yet.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function AgentCard({
  agent,
  selected,
  maxReached,
  onSelect,
}: {
  agent: DiscoverAgent;
  selected: boolean;
  maxReached: boolean;
  onSelect: () => void;
}) {
  const wr = winRate(agent.wins, agent.losses);

  return (
    <article className={`${styles.agentCard} ${selected ? styles.agentCardSelected : ""}`}>
      <div className={styles.agentHead}>
        <div className={styles.agentMeta}>
          <h3 className={styles.agentName}>{agent.name}</h3>
          <p className={styles.agentCreator}>@{agent.username}</p>
        </div>
        <span className={styles.tierChip}>{agent.tierLabel}</span>
      </div>

      <dl className={styles.agentStats}>
        <div>
          <dt>W–L</dt>
          <dd className={styles.mono}>
            {agent.wins}–{agent.losses}
          </dd>
        </div>
        <div>
          <dt>XP</dt>
          <dd className={styles.mono}>{agent.xp.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Win rate</dt>
          <dd className={styles.mono}>{wr != null ? `${wr}%` : "—"}</dd>
        </div>
      </dl>

      {agent.erc8004 ? <span className={styles.ercTag}>ERC-8004</span> : null}

      <button
        type="button"
        className={selected ? styles.pickBtnOn : styles.pickBtnOff}
        onClick={onSelect}
        disabled={maxReached}
      >
        {selected ? "Selected" : "Select"}
      </button>
    </article>
  );
}
