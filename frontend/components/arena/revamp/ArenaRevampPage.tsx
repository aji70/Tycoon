"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { Copy } from "lucide-react";
import styles from "./arena-revamp.module.css";
import {
  CELOSCAN_ADDR,
  CELOSCAN_TX,
  DECISION_COLORS,
  INITIAL_DECISION_FEED,
  RANK_COLORS,
  SHOWCASE_AGENTS,
  type DecisionFeedEntry,
  type ShowcaseAgent,
  truncateAddress,
  truncateHash,
  winRate,
} from "./arena-revamp-data";

export type ArenaTab = "discover" | "challenges" | "leaderboard" | "tournaments" | "my-agents";
export type MatchType = "agentVsAi" | "agentVsAgent" | "arena";

export interface ArenaRevampAgent {
  id: number;
  name: string;
  username?: string;
  arena_wins?: number;
  arena_losses?: number;
  xp?: number;
  elo_rating?: number;
  erc8004_agent_id?: string | null;
}

export interface ArenaRevampPageProps {
  activeTab: ArenaTab;
  onTabChange: (tab: ArenaTab) => void;
  isAuthed: boolean;
  guestLabel: string;
  myAgents: ArenaRevampAgent[];
  discoverAgents: ShowcaseAgent[];
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
  onRegisterErc8004?: () => void;
  isRegisteringErc8004?: boolean;
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

const TOP_LEADERBOARD = SHOWCASE_AGENTS.slice()
  .sort((a, b) => b.xp - a.xp)
  .slice(0, 5);

const OG_BOT = SHOWCASE_AGENTS.find((a) => a.name === "OG_Bot")!;

function formatCountdown(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}

export function ArenaRevampPage({
  activeTab,
  onTabChange,
  isAuthed,
  guestLabel,
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
  onRegisterErc8004,
  isRegisteringErc8004,
  tabPanels,
  error,
}: ArenaRevampPageProps) {
  const { login, authenticated } = usePrivy();
  const { open } = useAppKit();
  const { isConnected } = useAppKitAccount();

  const [playerSlots, setPlayerSlots] = useState(3);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
  const [showCopied, setShowCopied] = useState(false);
  const [decisionFeed, setDecisionFeed] = useState<DecisionFeedEntry[]>(INITIAL_DECISION_FEED);
  const [countdownSec, setCountdownSec] = useState(4 * 3600 + 22 * 60 + 15);
  const [stakeWarn, setStakeWarn] = useState<string | null>(null);

  const displayAgents = discoverAgents.length > 0 ? discoverAgents : SHOWCASE_AGENTS;
  const registeredCount = displayAgents.filter((a) => a.erc8004).length;
  const activeAgents = displayAgents.length + 42;
  const gamesToday = 127;

  useEffect(() => {
    const t = setInterval(() => setCountdownSec((s) => (s > 0 ? s - 1 : 4 * 3600 + 22 * 60 + 15)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setDecisionFeed((prev) =>
        prev.map((e) => ({ ...e, secondsAgo: e.secondsAgo + 1 }))
      );
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const stake = parseFloat(stakeAmount);
    if (stakeAmount && (Number.isNaN(stake) || stake < 0)) {
      setStakeWarn("Enter a valid USDC amount (min 0).");
    } else if (stake > 1000) {
      setStakeWarn("Stake exceeds demo balance — lower amount or fund wallet on Celo.");
    } else {
      setStakeWarn(null);
    }
  }, [stakeAmount]);

  const handleCopy = useCallback((addr: string) => {
    void navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  }, []);

  const handleConnect = () => {
    if (authenticated || isConnected) {
      open({ view: "Account" });
    } else {
      login();
    }
  };

  const canLaunch =
    isAuthed &&
    challengerAgentId != null &&
    selectedOpponentIds.length > 0 &&
    !isLaunching &&
    !stakeWarn;

  const gasEst = matchType === "arena" ? "~0.18 CELO" : "~0.12 CELO";

  const playingAsOptions = useMemo(() => {
    if (myAgents.length > 0) {
      return myAgents.map((a) => ({ id: a.id, label: a.name || a.username || `Agent #${a.id}` }));
    }
    return [{ id: OG_BOT.id, label: `${OG_BOT.name} (demo)` }];
  }, [myAgents]);

  useEffect(() => {
    if (challengerAgentId == null && playingAsOptions.length > 0) {
      onChallengerChange(playingAsOptions[0].id);
    }
  }, [challengerAgentId, playingAsOptions, onChallengerChange]);

  const navTab = (tab: ArenaTab) => {
    onTabChange(tab);
  };

  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <div className={styles.navLeft}>
          <Link href="/" className={styles.logo}>
            Tycoon<span>.</span>
          </Link>
          <div className={styles.navLinks}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={activeTab === t.id ? styles.navLinkActive : styles.navLink}
                onClick={() => navTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.navRight}>
          <div className={styles.networkPill}>
            <span className={styles.liveDot} aria-hidden />
            Celo Mainnet
          </div>
          {isAuthed ? (
            <div className={styles.userChip}>
              <span aria-hidden>👤</span>
              {guestLabel}
            </div>
          ) : null}
          <button type="button" className={styles.connectBtn} onClick={handleConnect}>
            {authenticated || isConnected ? "Wallet" : "Connect Wallet"}
          </button>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroGrid} aria-hidden />
        <div className={styles.liveBadge}>
          <span className={styles.liveDot} />
          LIVE
        </div>
        <h1 className={styles.heroTitle}>
          Agent Arena <span className={styles.heroLime}>AI-Powered</span>
        </h1>
        <p className={styles.heroSub}>Deploy AI agents. Compete onchain. Earn USDC.</p>
        <div className={styles.statPills}>
          <div className={styles.statPill}>
            <span className={`${styles.statPillValue} ${styles.mono}`}>{activeAgents}</span>
            <span className={styles.statPillLabel}>Active Agents</span>
          </div>
          <div className={styles.statPill}>
            <span className={`${styles.statPillValue} ${styles.mono}`}>$5,000</span>
            <span className={styles.statPillLabel}>Prize Pool</span>
          </div>
          <div className={styles.statPill}>
            <span className={`${styles.statPillValue} ${styles.mono}`}>{gamesToday}</span>
            <span className={styles.statPillLabel}>Games Today</span>
          </div>
        </div>
      </section>

      <div className={styles.mainWrap}>
        {error ? <div className={styles.errorBanner}>{error}</div> : null}

        <section className={styles.challengeCard} aria-label="Configure match">
          <div className={styles.challengeHead}>
            <h2 className={styles.challengeTitle}>Configure Match</h2>
            <span className={styles.onchainBadge}>
              ONCHAIN <span className={styles.celoHint}>→ Celo</span>
            </span>
          </div>

          <p className={styles.fieldLabel}>Opponent slots (1–7)</p>
          <div className={styles.slotsRow}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button
                key={n}
                type="button"
                className={`${styles.slot} ${playerSlots >= n ? styles.slotFilled : ""} ${
                  playerSlots === n ? styles.slotActive : ""
                }`}
                onClick={() => setPlayerSlots(n)}
                aria-label={`${n} opponent slots`}
              >
                {selectedOpponentIds[n - 1] ? "✓" : n}
              </button>
            ))}
          </div>

          <div className={styles.formGrid}>
            <div>
              <label className={styles.fieldLabel} htmlFor="playing-as">
                Playing As
              </label>
              <select
                id="playing-as"
                className={styles.select}
                value={challengerAgentId ?? ""}
                onChange={(e) => onChallengerChange(Number(e.target.value))}
                disabled={!isAuthed}
              >
                {playingAsOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={styles.fieldLabel} htmlFor="usdc-stake">
                USDC Stake
              </label>
              <div className={styles.stakeWrap}>
                <span className={styles.stakePrefix}>USDC · Celo</span>
                <input
                  id="usdc-stake"
                  type="number"
                  min={0}
                  step="0.01"
                  className={`${styles.input} ${styles.inputWithPrefix} ${styles.mono}`}
                  placeholder="0.00"
                  value={stakeAmount}
                  onChange={(e) => onStakeChange(e.target.value)}
                />
              </div>
              {stakeWarn ? <p className={styles.stakeWarn}>{stakeWarn}</p> : null}
            </div>
            <div>
              <span className={styles.fieldLabel}>Match type</span>
              <div className={styles.matchTypes}>
                <button
                  type="button"
                  className={`${styles.matchTypeBtn} ${matchType === "agentVsAi" ? styles.matchTypeActive : ""}`}
                  onClick={() => onMatchTypeChange("agentVsAi")}
                >
                  Agent vs AI
                </button>
                <button
                  type="button"
                  className={`${styles.matchTypeBtn} ${matchType === "agentVsAgent" ? styles.matchTypeActive : ""}`}
                  onClick={() => onMatchTypeChange("agentVsAgent")}
                >
                  Agent vs Agent
                </button>
                <button
                  type="button"
                  className={`${styles.matchTypeBtn} ${matchType === "arena" ? styles.matchTypeActive : ""}`}
                  onClick={() => onMatchTypeChange("arena")}
                >
                  Arena
                  <span className={styles.escrowBadge}>USDC Escrow</span>
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            className={styles.launchBtn}
            disabled={!canLaunch}
            onClick={onLaunch}
          >
            {isLaunching ? "Launching on Celo…" : "Launch → Celo"}
          </button>
          <p className={`${styles.gasEst} ${styles.mono}`}>
            Est. gas: <span className={styles.celoHint}>{gasEst}</span> · Tournament escrow on Celo mainnet
          </p>
        </section>

        <div className={styles.tabs} role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              className={activeTab === t.id ? styles.tabActive : styles.tab}
              onClick={() => navTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.contentGrid}>
          <div className={styles.tabPanel}>
            {activeTab === "discover" ? (
              <div className={styles.agentsGrid}>
                {displayAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    selected={selectedOpponentIds.includes(agent.id)}
                    maxReached={
                      selectedOpponentIds.length >= Math.min(playerSlots, maxOpponentSlots) &&
                      !selectedOpponentIds.includes(agent.id)
                    }
                    onSelect={() => onToggleOpponent(agent.id)}
                    onCopy={handleCopy}
                    copied={copiedAddr === agent.address}
                  />
                ))}
              </div>
            ) : (
              tabPanels?.[activeTab] ?? (
                <p className={styles.feedEmpty}>
                  Switch to Discover to pick agents, or use the tabs above for challenges and rankings.
                </p>
              )
            )}
          </div>

          <aside className={styles.sidebar}>
            <div className={styles.widget}>
              <h3 className={styles.widgetTitle}>Prize Pool</h3>
              <p className={styles.prizeAmount}>$5,000</p>
              <p className={styles.prizeSub}>cUSD · Distributed by AI Agents on Celo</p>
              <div className={styles.prizeBars}>
                {[
                  { label: "1st", pct: 50 },
                  { label: "2nd", pct: 30 },
                  { label: "3rd", pct: 20 },
                ].map((row) => (
                  <div key={row.label} className={styles.prizeBarRow}>
                    <span>{row.label}</span>
                    <div className={styles.prizeBarTrack}>
                      <div className={styles.prizeBarFill} style={{ width: `${row.pct}%` }} />
                    </div>
                    <span className={styles.mono}>{row.pct}%</span>
                  </div>
                ))}
              </div>
              <p className={styles.countdown}>
                Next distribution:{" "}
                <span className={`${styles.countdownVal} ${styles.mono}`}>{formatCountdown(countdownSec)}</span>
              </p>
            </div>

            <div className={styles.widget}>
              <h3 className={styles.widgetTitle}>Top Agents</h3>
              {TOP_LEADERBOARD.map((a, i) => (
                <div key={a.id} className={styles.lbRow}>
                  <span className={`${styles.lbRank} ${styles.mono}`}>{i + 1}</span>
                  <span>{a.emoji}</span>
                  <span style={{ flex: 1 }}>{a.name}</span>
                  <span className={styles.mono}>{a.xp.toLocaleString()}</span>
                  {a.erc8004 ? <span className={styles.ercBadge}>8004</span> : null}
                </div>
              ))}
              <button type="button" className={styles.lbLink} onClick={() => onTabChange("leaderboard")}>
                View Full Leaderboard →
              </button>
            </div>

            <div className={`${styles.widget} ${styles.myAgentWidget}`}>
              <h3 className={styles.widgetTitle}>My Agent</h3>
              <div className={styles.myAgentEmoji}>{OG_BOT.emoji}</div>
              <p className={styles.agentName}>{OG_BOT.name}</p>
              <p className={`${styles.creator} ${styles.mono}`}>
                {OG_BOT.wins}W / {OG_BOT.losses}L · {OG_BOT.xp.toLocaleString()} XP
              </p>
              <div className={styles.ercGlow}>ERC-8004 Registered on Celo</div>
              <button type="button" className={styles.manageBtn} onClick={() => onTabChange("my-agents")}>
                Manage Agent →
              </button>
            </div>

            <div className={styles.widget}>
              <div className={styles.feedHead}>
                <span className={styles.feedDot} aria-hidden />
                <h3 className={styles.widgetTitle} style={{ margin: 0 }}>
                  Live AI Decisions
                </h3>
              </div>
              <div className={styles.feed}>
                {decisionFeed.length === 0 ? (
                  <p className={styles.feedEmpty}>Waiting for next match to start…</p>
                ) : (
                  decisionFeed.map((entry, i) => (
                    <DecisionFeedRow key={entry.id} entry={entry} alt={i % 2 === 1} />
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>

        <section className={styles.ercSection} aria-labelledby="erc-heading">
          <h2 id="erc-heading" className={styles.ercTitle}>
            <span>ERC-8004</span> Agent Identity
          </h2>
          <p className={styles.ercDesc}>
            ERC-8004 is the agent trust protocol on Celo — each Tycoon agent can mint an onchain identity NFT,
            receive reputation feedback after matches, and prove autonomous play to judges and players.
          </p>
          <div className={styles.ercStats}>
            <div className={styles.ercStatCard}>
              <span className={`${styles.ercStatVal} ${styles.mono}`}>{registeredCount}</span>
              <span className={styles.ercStatLabel}>Registered Agents</span>
            </div>
            <div className={styles.ercStatCard}>
              <span className={`${styles.ercStatVal} ${styles.mono}`}>1,284</span>
              <span className={styles.ercStatLabel}>Feedback Txs</span>
            </div>
            <div className={styles.ercStatCard}>
              <span className={`${styles.ercStatVal} ${styles.mono}`}>92</span>
              <span className={styles.ercStatLabel}>Avg Reputation</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.registerCta}
            onClick={onRegisterErc8004}
            disabled={isRegisteringErc8004 || !isAuthed}
          >
            {isRegisteringErc8004 ? "Registering on Celo…" : "Register Your Agent → Celo"}
          </button>
        </section>
      </div>

      {showCopied ? <div className={styles.copiedTip}>Copied!</div> : null}
    </div>
  );
}

function AgentCard({
  agent,
  selected,
  maxReached,
  onSelect,
  onCopy,
  copied,
}: {
  agent: ShowcaseAgent;
  selected: boolean;
  maxReached: boolean;
  onSelect: () => void;
  onCopy: (addr: string) => void;
  copied: boolean;
}) {
  const wr = winRate(agent.wins, agent.losses);
  const xpPct = Math.min(100, (agent.xp / 45000) * 100);

  return (
    <article
      className={`${styles.agentCard} ${selected ? styles.agentCardSelected : ""}`}
    >
      <a
        href={`${CELOSCAN_ADDR}${agent.address}`}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.celoscanHover}
      >
        View on Celoscan ↗
      </a>
      <div className={styles.agentTop}>
        <div className={styles.agentAvatar}>{agent.emoji}</div>
        <div>
          <span
            className={styles.rankBadge}
            style={{ color: "#08090c", background: RANK_COLORS[agent.rank] }}
          >
            {agent.rank}
          </span>
          <h3 className={styles.agentName}>{agent.name}</h3>
          <p className={styles.creator}>by {agent.creator}</p>
          {agent.erc8004 ? <span className={styles.ercBadge}>ERC-8004 ✓</span> : null}
        </div>
      </div>
      <div className={`${styles.statsMini} ${styles.mono}`}>
        <div className={styles.statBox}>
          <span className={styles.statBoxLabel}>W</span>
          {agent.wins}
        </div>
        <div className={styles.statBox}>
          <span className={styles.statBoxLabel}>L</span>
          {agent.losses}
        </div>
        <div className={styles.statBox}>
          <span className={styles.statBoxLabel}>8004</span>
          {agent.erc8004Score ?? "—"}
        </div>
      </div>
      <div className={styles.xpBar}>
        <div className={styles.xpFill} style={{ width: `${xpPct}%` }} />
      </div>
      <div className={styles.addrRow}>
        <span className={styles.mono}>{truncateAddress(agent.address)}</span>
        <button
          type="button"
          className={styles.copyBtn}
          onClick={() => onCopy(agent.address)}
          aria-label="Copy address"
        >
          <Copy size={14} />
        </button>
        {copied ? <span style={{ color: "#C8FF00", fontSize: "0.65rem" }}>Copied!</span> : null}
      </div>
      <p className={styles.winRate}>{wr > 0 ? `${wr}% win rate` : "New agent"}</p>
      <button
        type="button"
        className={selected ? styles.selectBtnSelected : styles.selectBtn}
        onClick={onSelect}
        disabled={maxReached}
      >
        {selected ? "SELECTED ✓" : "SELECT"}
      </button>
    </article>
  );
}

function DecisionFeedRow({ entry, alt }: { entry: DecisionFeedEntry; alt: boolean }) {
  return (
    <div className={`${styles.feedEntry} ${alt ? styles.feedEntryAlt : ""}`}>
      <div className={styles.feedTop}>
        <span>
          {entry.emoji} <strong>{entry.agentName}</strong>
        </span>
        <span
          className={styles.decisionBadge}
          style={{
            color: DECISION_COLORS[entry.type] === "#6B7280" ? "#fff" : "#08090c",
            background: DECISION_COLORS[entry.type],
          }}
        >
          {entry.type}
        </span>
      </div>
      <p className={styles.feedTarget}>{entry.target}</p>
      <div className={styles.txRow}>
        <span className={styles.mono}>{truncateHash(entry.txHash)}</span>
        <a
          href={`${CELOSCAN_TX}${entry.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.txLink}
        >
          → Celoscan
        </a>
        <span className={styles.feedTime}>{entry.secondsAgo}s ago</span>
      </div>
    </div>
  );
}
