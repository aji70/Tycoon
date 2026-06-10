"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Gamepad2,
  Zap,
  Trophy,
  Target,
  Bot,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import styles from "./arena-revamp.module.css";
import { ARENA_TIER_LADDER, type ArenaTierKey, type DiscoverAgent } from "./map-api-agents";

const TIER_BADGE_CLASS: Record<ArenaTierKey, string> = {
  rookie: styles.tierRookie,
  challenger: styles.tierChallenger,
  pro: styles.tierPro,
  master: styles.tierMaster,
  elite: styles.tierElite,
  legend: styles.tierLegend,
};

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
  shortLabel: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    id: "discover",
    label: "New Match",
    shortLabel: "Match",
    description: "Set up your agent, pick opponents, and start a match.",
    icon: Gamepad2,
  },
  {
    id: "my-agents",
    label: "My Agents (Manage)",
    shortLabel: "Agents",
    description: "Create and manage the agents you compete with.",
    icon: Bot,
  },
  {
    id: "challenges",
    label: "Challenges",
    shortLabel: "Spend",
    description: "Play with agents that approved your wallet to spend USDC for them.",
    icon: Zap,
  },
  {
    id: "leaderboard",
    label: "Rankings",
    shortLabel: "Ranks",
    description: "See which agents have the best arena record.",
    icon: Trophy,
  },
  {
    id: "tournaments",
    label: "Tournaments",
    shortLabel: "Events",
    description: "Join or create bracket events with USDC prizes.",
    icon: Target,
  },
];

const PLAY_STEPS = [
  { id: "arena-step-1", label: "Setup" },
  { id: "arena-step-2", label: "Opponents" },
  { id: "arena-launch", label: "Start" },
] as const;

const QUICK_START_KEY = "tycoon-arena-quickstart-dismissed";

function playStepState(
  stepNum: number,
  currentStep: number,
  step1Done: boolean,
  step2Done: boolean
): "done" | "active" | "locked" | "upcoming" {
  if (stepNum === 1) {
    if (step1Done && currentStep > 1) return "done";
    if (currentStep === 1) return "active";
    return "upcoming";
  }
  if (stepNum === 2) {
    if (!step1Done) return "locked";
    if (step2Done && currentStep > 2) return "done";
    if (currentStep === 2) return "active";
    return "upcoming";
  }
  if (!step2Done) return "locked";
  if (currentStep === 3) return "active";
  return "upcoming";
}

function playStepMarker(state: "done" | "active" | "locked" | "upcoming"): string {
  if (state === "done") return "✓";
  if (state === "active") return "●";
  return "○";
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
  /** Default true so the guide shows until we read localStorage (avoids staying hidden on first paint). */
  const [quickStartOpen, setQuickStartOpen] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(QUICK_START_KEY) === "1") {
        setQuickStartOpen(false);
      }
    } catch {
      /* ignore */
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

  const showQuickStart = () => {
    setQuickStartOpen(true);
    try {
      localStorage.removeItem(QUICK_START_KEY);
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

  const step1Done = hasAgent;
  const step2Done = hasOpponents;
  const currentStep = !step1Done ? 1 : !step2Done ? 2 : 3;

  const activeTabMeta = TABS.find((t) => t.id === activeTab)!;
  const pageRef = useRef<HTMLDivElement>(null);

  const handleTabChange = useCallback(
    (tab: ArenaTab) => {
      onTabChange(tab);
      pageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [onTabChange]
  );

  const scrollToPlayStep = useCallback((elementId: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const launchHint = !isAuthed
    ? "Sign in (top nav) to start a match"
    : !hasAgent
      ? "Create an agent in My Agents first"
      : !hasOpponents
        ? `Select ${matchType === "agentVsAi" ? "1 opponent" : "at least 1 opponent"} below`
        : null;

  return (
    <div className={[styles.shell, activeTab === "discover" ? styles.shellWithDock : ""].filter(Boolean).join(" ")}>
      <div className={styles.page} ref={pageRef}>
        <header className={styles.header}>
          <div className={styles.headerRow}>
            <h1 className={styles.title}>Arena — Play with AI Agents</h1>
            {!quickStartOpen ? (
              <button type="button" className={styles.showGuideBtn} onClick={showQuickStart}>
                New here? Show guide
              </button>
            ) : null}
          </div>
          <p className={styles.subtitle}>
            Set up an AI agent, pick opponents, and start a match. Agents compete in Monopoly-style games on Celo.
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
                onClick={() => handleTabChange("my-agents")}
              >
                <span className={styles.quickCardNum}>1</span>
                <span className={styles.quickCardTitle}>Create an agent</span>
                <span className={styles.quickCardDesc}>Takes about a minute</span>
              </button>
              <button
                type="button"
                className={styles.quickCard}
                onClick={() => handleTabChange("discover")}
              >
                <span className={styles.quickCardNum}>2</span>
                <span className={styles.quickCardTitle}>Start a new match</span>
                <span className={styles.quickCardDesc}>Setup → opponents → Start</span>
              </button>
              <button
                type="button"
                className={styles.quickCard}
                onClick={() => handleTabChange("leaderboard")}
              >
                <span className={styles.quickCardNum}>3</span>
                <span className={styles.quickCardTitle}>View rankings</span>
                <span className={styles.quickCardDesc}>See top performers</span>
              </button>
            </div>
          </aside>
        ) : null}

        <nav className={styles.navSticky} aria-label="Arena navigation">
          <div className={styles.tabs} role="tablist" aria-label="Arena sections">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === t.id}
                  aria-controls={`arena-panel-${t.id}`}
                  id={`arena-tab-${t.id}`}
                  className={activeTab === t.id ? styles.tabActive : styles.tab}
                  title={t.id === "my-agents" ? "Create and edit your AI agents here." : undefined}
                  onClick={() => handleTabChange(t.id)}
                >
                  <Icon className={styles.tabIcon} aria-hidden />
                  <span className={styles.tabLabelFull}>{t.label}</span>
                  <span className={styles.tabLabelShort}>{t.shortLabel}</span>
                </button>
              );
            })}
          </div>

          {activeTab !== "discover" ? (
            <div className={styles.navMeta}>
              <p className={styles.tabDescription}>{activeTabMeta.description}</p>
              <button type="button" className={styles.goPlayBtn} onClick={() => handleTabChange("discover")}>
                Go to New Match
                <ChevronRight className={styles.goPlayIcon} aria-hidden />
              </button>
            </div>
          ) : null}

          {activeTab === "discover" ? (
            <nav className={styles.unifiedStepper} aria-label="Match setup steps">
              {PLAY_STEPS.map((s, i) => {
                const stepNum = i + 1;
                const state = playStepState(stepNum, currentStep, step1Done, step2Done);
                const stepClass =
                  state === "done"
                    ? styles.unifiedStepDone
                    : state === "active"
                      ? styles.unifiedStepActive
                      : state === "locked"
                        ? styles.unifiedStepLocked
                        : styles.unifiedStepUpcoming;
                return (
                  <span key={s.id} className={styles.unifiedStepWrap}>
                    {i > 0 ? (
                      <span className={styles.unifiedStepArrow} aria-hidden>
                        →
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={`${styles.unifiedStepBtn} ${stepClass}`}
                      disabled={state === "locked"}
                      aria-current={state === "active" ? "step" : undefined}
                      onClick={() => scrollToPlayStep(s.id)}
                    >
                      <span className={styles.unifiedStepMarker} aria-hidden>
                        {playStepMarker(state)}
                      </span>
                      {s.label}
                    </button>
                  </span>
                );
              })}
            </nav>
          ) : null}
        </nav>

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
              onTabChange={handleTabChange}
              step1Done={step1Done}
              step2Done={step2Done}
              currentStep={currentStep}
              isLaunching={isLaunching}
              launchHint={launchHint}
              onLaunch={onLaunch}
            />
          ) : (
            <section
              id={`arena-panel-${activeTab}`}
              role="tabpanel"
              aria-labelledby={`arena-tab-${activeTab}`}
              className={styles.panel}
            >
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
  isLaunching: boolean;
  launchHint: string | null;
  onLaunch: () => void;
}) {
  const step2Ref = useRef<HTMLElement>(null);
  const [step2Shake, setStep2Shake] = useState(false);
  const [opponentError, setOpponentError] = useState<string | null>(null);

  const handleLaunchClick = () => {
    if (!hasAgent || isLaunching) return;
    if (selectedOpponentIds.length === 0) {
      setOpponentError("Select at least 1 opponent to continue.");
      setStep2Shake(true);
      step2Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => setStep2Shake(false), 500);
      return;
    }
    setOpponentError(null);
    onLaunch();
  };

  const launchReady = hasAgent && !isLaunching && selectedOpponentIds.length > 0;
  const launchDisabledNoOpponents = hasAgent && !isLaunching && selectedOpponentIds.length === 0;

  return (
    <>
      <section
        id="arena-step-1"
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
            <p className={styles.firstTimeCallout} style={{ margin: 0, marginBottom: 12 }}>
              <strong>First time?</strong> Create an agent under My Agents before you can play.
            </p>
            <button type="button" className={styles.createAgentCta} onClick={() => onTabChange("my-agents")}>
              Create your first agent →
            </button>
          </div>
        ) : (
          <div className={styles.setupGrid}>
            <div className={styles.matchField}>
              <label className={styles.fieldLabel} htmlFor="playing-as">
                Your agent
              </label>
              {playingAsOptions.length === 0 ? (
                <>
                  <p className={styles.firstTimeCallout}>
                    <strong>First time?</strong> Create an agent under My Agents before you can play.
                  </p>
                  <button type="button" className={styles.createAgentCta} onClick={() => onTabChange("my-agents")}>
                    Create your first agent →
                  </button>
                </>
              ) : (
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
              )}
            </div>

            <div className={styles.matchField}>
              <span className={styles.fieldLabel}>How do you want to play?</span>
              <div className={styles.modeOptions}>
                <div className={styles.modeOption}>
                  <button
                    type="button"
                    className={`${styles.modeBtn} ${matchType === "agentVsAgent" ? styles.modeBtnActive : ""}`}
                    onClick={() => onMatchTypeChange("agentVsAgent")}
                  >
                    Fully Automatic (agents play themselves)
                  </button>
                  <p className={styles.modeDesc}>
                    Your agent and opponents play full turns without you — best for autonomous matches.
                  </p>
                </div>
                <div className={styles.modeOption}>
                  <button
                    type="button"
                    className={`${styles.modeBtn} ${matchType === "agentVsAi" ? styles.modeBtnActive : ""}`}
                    onClick={() => onMatchTypeChange("agentVsAi")}
                  >
                    Manual (you roll, agent responds)
                  </button>
                  <p className={styles.modeDesc}>
                    You control your seat on the board; the opponent agent plays on its own.
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.matchField}>
              <label className={styles.fieldLabel} htmlFor="usdc-stake">
                <span className={styles.labelWithTip}>
                  Bet USDC (optional)
                  <span
                    className={styles.fieldTooltip}
                    title="Winner takes the pool. Leave at 0 for a free game."
                    aria-label="Winner takes the pool. Leave at 0 for a free game."
                  >
                    ?
                  </span>
                </span>
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
              <p className={styles.fieldHelp}>Winner takes the pool. Leave at 0 for a free game.</p>
            </div>
          </div>
        )}
        {step1Done ? (
          <div className={styles.stepCompleteBanner} role="status">
            <span aria-hidden>✓</span>
            <span>Setup complete — pick opponents below</span>
          </div>
        ) : null}
      </section>

      <section
        ref={step2Ref}
        id="arena-step-2"
        className={`${styles.stepSection} ${currentStep === 2 ? styles.stepSectionHighlight : ""} ${step2Shake ? styles.step2Shake : ""}`}
        aria-labelledby="step-2-heading"
      >
        <h2 id="step-2-heading" className={styles.stepHeading}>
          Step 2 — Choose Opponents{" "}
          <span className={styles.selectionCountInline}>
            ({selectedOpponentIds.length} / {maxOpponentSlots} selected)
          </span>
        </h2>
        {opponentError ? (
          <p className={styles.opponentError} role="alert">
            {opponentError}
          </p>
        ) : null}
        <p className={styles.stepIntro}>
          {matchType === "agentVsAi"
            ? "Tap Select on exactly one agent to challenge."
            : `Select up to ${maxOpponentSlots} agents.`}
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
            {discoverAgents.map((agent, index) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                selected={selectedOpponentIds.includes(agent.id)}
                showTierLegend={index === 0}
                maxReached={
                  selectedOpponentIds.length >= maxOpponentSlots &&
                  !selectedOpponentIds.includes(agent.id)
                }
                onSelect={() => {
                  setOpponentError(null);
                  onToggleOpponent(agent.id);
                }}
              />
            ))}
          </div>
        )}
        {step2Done ? (
          <div className={styles.stepCompleteBanner} role="status">
            <span aria-hidden>✓</span>
            <span>Opponents selected — ready to start</span>
          </div>
        ) : null}
      </section>

      <div id="arena-launch" className={styles.launchDock} role="region" aria-label="Start match">
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
            className={launchReady ? styles.launchBtn : styles.launchBtnDisabled}
            disabled={!hasAgent || isLaunching || selectedOpponentIds.length === 0}
            title={launchDisabledNoOpponents ? "Select at least 1 opponent to start" : undefined}
            onClick={handleLaunchClick}
          >
            {isLaunching ? "Starting match…" : "Start match →"}
          </button>
        </div>
      </div>
    </>
  );
}

function TierLegendPopover() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className={styles.tierStatWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.tierHelpBtn}
        aria-label="What do arena tiers mean?"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        ?
      </button>
      {open ? (
        <div className={styles.tierPopover} role="dialog" aria-label="Arena tier ladder">
          <p className={styles.tierPopoverTitle}>Arena tiers</p>
          <ul className={styles.tierPopoverList}>
            {ARENA_TIER_LADDER.map((tier) => (
              <li key={tier.label} className={styles.tierPopoverItem}>
                <span className={`${styles.tierBadge} ${TIER_BADGE_CLASS[tier.key]}`}>{tier.label}</span>
                <span>{tier.hint}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function AgentCard({
  agent,
  selected,
  showTierLegend,
  maxReached,
  onSelect,
}: {
  agent: DiscoverAgent;
  selected: boolean;
  showTierLegend?: boolean;
  maxReached: boolean;
  onSelect: () => void;
}) {
  const wr = agent.winRatePct;
  const noMatches = agent.wins === 0 && agent.losses === 0 && agent.draws === 0;

  return (
    <article className={`${styles.agentCard} ${selected ? styles.agentCardSelected : ""}`}>
      <div className={styles.agentHead}>
        <div className={styles.agentMeta}>
          <h3 className={styles.agentName}>{agent.name}</h3>
          <p className={styles.agentCreator}>@{agent.username}</p>
        </div>
      </div>

      <div className={styles.agentStatsGrid}>
        <div className={styles.statCell}>
          <span className={styles.tierBadgeRow}>
            <span className={`${styles.tierBadge} ${TIER_BADGE_CLASS[agent.tierKey]}`}>
              {agent.tierLabel}
            </span>
            {showTierLegend ? <TierLegendPopover /> : null}
          </span>
        </div>
        <div className={styles.statCell}>
          <span className={styles.statLabel}>W-L</span>
          <span className={styles.statValue}>
            {agent.wins}–{agent.losses}
          </span>
        </div>
        <div className={styles.statCell}>
          <span className={styles.statLabel}>XP</span>
          <span className={`${styles.statValue} ${styles.mono}`}>{agent.xp.toLocaleString()}</span>
        </div>
        <div className={styles.statCell}>
          <span className={styles.statLabel}>Win rate</span>
          <span className={styles.statValue}>
            {wr != null ? (
              `${Number.isInteger(wr) ? wr : wr.toFixed(1)}%`
            ) : noMatches ? (
              <span className={styles.statEmpty}>No matches yet</span>
            ) : (
              "—"
            )}
          </span>
        </div>
      </div>

      {agent.erc8004 ? <span className={styles.ercTag}>On-chain identity</span> : null}

      <button
        type="button"
        className={selected ? styles.pickBtnOn : styles.pickBtnOff}
        onClick={onSelect}
        disabled={maxReached}
        aria-pressed={selected}
      >
        {selected ? "✓ Selected" : maxReached ? "Max selected" : "Select opponent"}
      </button>
    </article>
  );
}
