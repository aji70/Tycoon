"use client";

import { useEffect, useMemo, useState } from "react";
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

const TABS: {
  id: ArenaTab;
  label: string;
  description: string;
}[] = [
  {
    id: "discover",
    label: "Play",
    description: "Find opponents and start a match — this is where most games begin.",
  },
  {
    id: "challenges",
    label: "Challenges",
    description: "Challenge agents that approved your wallet to spend USDC on their behalf.",
  },
  {
    id: "leaderboard",
    label: "Rankings",
    description: "See which agents have the best arena record.",
  },
  {
    id: "tournaments",
    label: "Tournaments",
    description: "Join or create bracket events with USDC prizes.",
  },
  {
    id: "my-agents",
    label: "My Agents",
    description: "Create an agent with just a name — then head to Play to start a match.",
  },
];

const QUICK_START_KEY = "tycoon-arena-quickstart-dismissed";

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
  const [quickStartOpen, setQuickStartOpen] = useState(false);

  useEffect(() => {
    try {
      setQuickStartOpen(localStorage.getItem(QUICK_START_KEY) !== "1");
    } catch {
      setQuickStartOpen(true);
    }
  }, []);

  const dismissQuickStart = () => {
    setQuickStartOpen(false);
    try {
      localStorage.setItem(QUICK_START_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const playingAsOptions = useMemo(() => {
    return myAgents.map((a) => ({ id: a.id, label: a.name }));
  }, [myAgents]);

  useEffect(() => {
    if (challengerAgentId == null && playingAsOptions.length > 0) {
      onChallengerChange(playingAsOptions[0].id);
    }
  }, [challengerAgentId, playingAsOptions, onChallengerChange]);

  const hasAgent = isAuthed && myAgents.length > 0;
  const hasOpponents = selectedOpponentIds.length > 0;
  const canLaunch = hasAgent && hasOpponents && !isLaunching;

  const step1Done = hasAgent;
  const step2Done = hasOpponents;
  const currentStep = !step1Done ? 1 : !step2Done ? 2 : 3;

  const activeTabMeta = TABS.find((t) => t.id === activeTab)!;

  const launchHint = !isAuthed
    ? "Sign in (top nav) to start a match"
    : !hasAgent
      ? "Create an agent in My Agents first"
      : !hasOpponents
        ? `Select ${matchType === "agentVsAi" ? "1 opponent" : "at least 1 opponent"} below`
        : null;

  return (
    <div className={[styles.shell, activeTab === "discover" ? styles.shellWithDock : ""].filter(Boolean).join(" ")}>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Agent Arena</h1>
          <p className={styles.subtitle}>
            AI agents compete in Monopoly-style matches on Celo. New here? Follow the steps on the Play tab.
          </p>
        </header>

        {quickStartOpen ? (
          <aside className={styles.quickStart} aria-label="Getting started">
            <div className={styles.quickStartHead}>
              <strong>New to the arena?</strong>
              <button type="button" className={styles.dismissBtn} onClick={dismissQuickStart} aria-label="Dismiss">
                ✕
              </button>
            </div>
            <div className={styles.quickStartGrid}>
              <button
                type="button"
                className={styles.quickCard}
                onClick={() => {
                  onTabChange("discover");
                  dismissQuickStart();
                }}
              >
                <span className={styles.quickCardNum}>1</span>
                <span className={styles.quickCardTitle}>Play a match</span>
                <span className={styles.quickCardDesc}>Pick opponents and hit Start</span>
              </button>
              <button
                type="button"
                className={styles.quickCard}
                onClick={() => onTabChange("my-agents")}
              >
                <span className={styles.quickCardNum}>2</span>
                <span className={styles.quickCardTitle}>Create an agent</span>
                <span className={styles.quickCardDesc}>Required before you can play</span>
              </button>
              <button
                type="button"
                className={styles.quickCard}
                onClick={() => onTabChange("leaderboard")}
              >
                <span className={styles.quickCardNum}>3</span>
                <span className={styles.quickCardTitle}>View rankings</span>
                <span className={styles.quickCardDesc}>See top arena performers</span>
              </button>
            </div>
          </aside>
        ) : null}

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

        <p className={styles.tabDescription}>{activeTabMeta.description}</p>

        <div className={styles.body}>
          {error ? <div className={styles.errorBanner}>{error}</div> : null}

          {activeTab === "discover" ? (
            <DiscoverPanel
              isAuthed={isAuthed}
              hasAgent={hasAgent}
              myAgents={myAgents}
              discoverAgents={discoverAgents}
              loading={loading}
              selectedOpponentIds={selectedOpponentIds}
              onToggleOpponent={onToggleOpponent}
              maxOpponentSlots={maxOpponentSlots}
              challengerAgentId={challengerAgentId}
              onChallengerChange={onChallengerChange}
              playingAsOptions={playingAsOptions}
              stakeAmount={stakeAmount}
              onStakeChange={onStakeChange}
              matchType={matchType}
              onMatchTypeChange={onMatchTypeChange}
              onTabChange={onTabChange}
              step1Done={step1Done}
              step2Done={step2Done}
              currentStep={currentStep}
              canLaunch={canLaunch}
              isLaunching={isLaunching}
              launchHint={launchHint}
              onLaunch={onLaunch}
            />
          ) : (
            <section className={styles.panel} aria-label={activeTabMeta.label}>
              {tabPanels?.[activeTab] ?? <p className={styles.emptyState}>Nothing here yet.</p>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function DiscoverPanel({
  isAuthed,
  hasAgent,
  myAgents,
  discoverAgents,
  loading,
  selectedOpponentIds,
  onToggleOpponent,
  maxOpponentSlots,
  challengerAgentId,
  onChallengerChange,
  playingAsOptions,
  stakeAmount,
  onStakeChange,
  matchType,
  onMatchTypeChange,
  onTabChange,
  step1Done,
  step2Done,
  currentStep,
  canLaunch,
  isLaunching,
  launchHint,
  onLaunch,
}: {
  isAuthed: boolean;
  hasAgent: boolean;
  myAgents: ArenaRevampAgent[];
  discoverAgents: DiscoverAgent[];
  loading?: boolean;
  selectedOpponentIds: number[];
  onToggleOpponent: (id: number) => void;
  maxOpponentSlots: number;
  challengerAgentId: number | null;
  onChallengerChange: (id: number) => void;
  playingAsOptions: { id: number; label: string }[];
  stakeAmount: string;
  onStakeChange: (v: string) => void;
  matchType: MatchType;
  onMatchTypeChange: (t: MatchType) => void;
  onTabChange: (tab: ArenaTab) => void;
  step1Done: boolean;
  step2Done: boolean;
  currentStep: number;
  canLaunch: boolean;
  isLaunching: boolean;
  launchHint: string | null;
  onLaunch: () => void;
}) {
  return (
    <>
      <ol className={styles.stepper} aria-label="How to start a match">
        <li className={currentStep >= 1 ? styles.stepDone : currentStep === 1 ? styles.stepCurrent : styles.step}>
          <span className={styles.stepNum}>1</span>
          <span className={styles.stepText}>Set up your agent</span>
        </li>
        <li className={currentStep >= 2 ? styles.stepDone : currentStep === 2 ? styles.stepCurrent : styles.step}>
          <span className={styles.stepNum}>2</span>
          <span className={styles.stepText}>Choose opponents</span>
        </li>
        <li className={currentStep >= 3 ? styles.stepDone : currentStep === 3 ? styles.stepCurrent : styles.step}>
          <span className={styles.stepNum}>3</span>
          <span className={styles.stepText}>Start match</span>
        </li>
      </ol>

      <section
        className={`${styles.stepSection} ${currentStep === 1 ? styles.stepSectionHighlight : ""}`}
        aria-labelledby="step-1-heading"
      >
        <h2 id="step-1-heading" className={styles.stepHeading}>
          Step 1 — Your agent &amp; mode
        </h2>
        {!isAuthed ? (
          <div className={styles.callout}>
            <p className={styles.calloutText}>
              <strong>Sign in</strong> using the wallet button in the top navigation bar. You can browse agents below
              without signing in.
            </p>
          </div>
        ) : myAgents.length === 0 ? (
          <div className={styles.callout}>
            <p className={styles.calloutText}>
              You need an agent before you can play. Create one in <strong>My Agents</strong> — it only takes a minute.
            </p>
            <button type="button" className={styles.calloutBtn} onClick={() => onTabChange("my-agents")}>
              Create my first agent →
            </button>
          </div>
        ) : (
          <div className={styles.setupGrid}>
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
              <span className={styles.fieldLabel}>How do you want to play?</span>
              <div className={styles.modeToggle}>
                <button
                  type="button"
                  className={`${styles.modeBtn} ${matchType === "agentVsAgent" ? styles.modeBtnActive : ""}`}
                  onClick={() => onMatchTypeChange("agentVsAgent")}
                >
                  <span className={styles.modeBtnTitle}>Agent vs Agent</span>
                  <span className={styles.modeBtnHint}>Your agent plays automatically</span>
                </button>
                <button
                  type="button"
                  className={`${styles.modeBtn} ${matchType === "agentVsAi" ? styles.modeBtnActive : ""}`}
                  onClick={() => onMatchTypeChange("agentVsAi")}
                >
                  <span className={styles.modeBtnTitle}>You vs Agent</span>
                  <span className={styles.modeBtnHint}>You roll; opponent is AI</span>
                </button>
              </div>
            </div>

            <div className={styles.matchField}>
              <label className={styles.fieldLabel} htmlFor="usdc-stake">
                Stake (optional)
              </label>
              <input
                id="usdc-stake"
                type="number"
                min={0}
                step="0.01"
                className={`${styles.input} ${styles.mono}`}
                placeholder="0 USDC"
                value={stakeAmount}
                onChange={(e) => onStakeChange(e.target.value)}
              />
              <p className={styles.fieldHelp}>Leave at 0 for a free practice match.</p>
            </div>
          </div>
        )}
        {step1Done ? <p className={styles.stepComplete}>✓ Setup complete — pick opponents below</p> : null}
      </section>

      <section
        className={`${styles.stepSection} ${currentStep === 2 ? styles.stepSectionHighlight : ""}`}
        aria-labelledby="step-2-heading"
      >
        <div className={styles.stepHeadingRow}>
          <h2 id="step-2-heading" className={styles.stepHeading}>
            Step 2 — Choose opponents
          </h2>
          <span className={styles.pickBadge}>
            {selectedOpponentIds.length} / {maxOpponentSlots} selected
          </span>
        </div>
        <p className={styles.stepIntro}>
          {matchType === "agentVsAi"
            ? "Tap Select on exactly one agent to challenge."
            : `Select up to ${maxOpponentSlots} agents. Selected cards are highlighted.`}
        </p>

        {loading ? (
          <p className={styles.emptyState}>Loading agents…</p>
        ) : discoverAgents.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No opponents available yet</p>
            <p className={styles.emptyDesc}>
              When other players make agents public, they will appear here. You can create your own and invite friends.
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
        )}
        {step2Done ? <p className={styles.stepComplete}>✓ Opponents selected — ready to start</p> : null}
      </section>

      <div className={styles.launchDock} role="region" aria-label="Start match">
        <div className={styles.launchDockInner}>
          <div className={styles.launchDockText}>
            <span className={styles.launchDockTitle}>Step 3 — Start match</span>
            {launchHint ? (
              <span className={styles.launchDockHint}>{launchHint}</span>
            ) : (
              <span className={styles.launchDockHint}>
                {selectedOpponentIds.length} opponent{selectedOpponentIds.length !== 1 ? "s" : ""} ·{" "}
                {matchType === "agentVsAi" ? "You play" : "Agents play"} on Celo
              </span>
            )}
          </div>
          <button
            type="button"
            className={styles.launchBtn}
            disabled={!canLaunch}
            onClick={onLaunch}
          >
            {isLaunching ? "Starting match…" : "Start match →"}
          </button>
        </div>
      </div>
    </>
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

      {agent.erc8004 ? <span className={styles.ercTag}>On-chain identity</span> : null}

      <button
        type="button"
        className={selected ? styles.pickBtnOn : styles.pickBtnOff}
        onClick={onSelect}
        disabled={maxReached}
        aria-pressed={selected}
      >
        {selected ? "Selected ✓" : maxReached ? "Max selected" : "Select opponent"}
      </button>
    </article>
  );
}
