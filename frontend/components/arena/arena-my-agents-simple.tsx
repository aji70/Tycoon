"use client";

import { useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import {
  buildTycoonHostedAgentPayload,
  defaultBehaviorProfile,
  type AgentBehaviorProfile,
} from "@/lib/agentCreatePayload";
import { ApiResponse } from "@/types/api";
import { AgentStrategyFields } from "@/components/arena/AgentStrategyFields";
import styles from "./arena-my-agents-simple.module.css";

export interface ArenaSimpleAgent {
  id: number;
  name: string;
  username?: string;
  arena_wins?: number;
  arena_losses?: number;
  is_public?: boolean;
}

interface ArenaMyAgentsSimpleProps {
  isAuthed: boolean;
  myAgents: ArenaSimpleAgent[];
  onRefresh: () => void | Promise<void>;
  onGoPlay: () => void;
  onTogglePublic: (agentId: number, currentValue: boolean) => void;
}

export function ArenaMyAgentsSimple({
  isAuthed,
  myAgents,
  onRefresh,
  onGoPlay,
  onTogglePublic,
}: ArenaMyAgentsSimpleProps) {
  const [name, setName] = useState("");
  const [listInDiscover, setListInDiscover] = useState(true);
  const [showStrategy, setShowStrategy] = useState(false);
  const [behaviorProfile, setBehaviorProfile] = useState<AgentBehaviorProfile>(defaultBehaviorProfile());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(myAgents.length === 0);
  const [justCreated, setJustCreated] = useState(false);

  const resetCreateForm = () => {
    setName("");
    setBehaviorProfile(defaultBehaviorProfile());
    setShowStrategy(false);
    setCreateError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setCreateError("Enter a name for your agent.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    setJustCreated(false);
    try {
      const res = await apiClient.post<ApiResponse<{ id: number }>>(
        "/agents",
        buildTycoonHostedAgentPayload(trimmed, behaviorProfile)
      );
      const agentId = res?.data?.data?.id;
      if (listInDiscover && agentId != null) {
        await apiClient.patch(`/agents/${agentId}`, { is_public: true });
      }
      resetCreateForm();
      setShowAddForm(false);
      setJustCreated(true);
      await onRefresh();
    } catch (err) {
      setCreateError((err as Error)?.message || "Could not create agent. Try again.");
    } finally {
      setCreating(false);
    }
  };

  if (!isAuthed) {
    return (
      <div className={styles.wrap}>
        <div className={styles.callout}>
          <p>
            <strong>Step 1:</strong> Sign in with the wallet button in the top navigation bar, then return here to
            create your agent.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <ol className={styles.flowSteps} aria-label="How the arena works">
        <li className={myAgents.length > 0 ? styles.flowStepDone : styles.flowStepActive}>
          <span className={styles.flowNum}>1</span>
          <span>Create your agent</span>
        </li>
        <li className={myAgents.length > 0 ? styles.flowStepActive : styles.flowStep}>
          <span className={styles.flowNum}>2</span>
          <span>Go to Play & pick opponents</span>
        </li>
        <li className={styles.flowStep}>
          <span className={styles.flowNum}>3</span>
          <span>Start match</span>
        </li>
      </ol>

      {justCreated ? (
        <div className={styles.successBanner} role="status">
          <p>
            <strong>Agent ready!</strong> Head to <strong>Play</strong> to choose opponents and start a match.
          </p>
          <button type="button" className={styles.playBtn} onClick={onGoPlay}>
            Go to Play →
          </button>
        </div>
      ) : null}

      <p className={styles.intro}>
        Give your agent a name and optional strategy. Tycoon runs the AI — no API keys needed. When you&apos;re ready,
        open the <strong>Play</strong> tab to start a match.
      </p>

      {(showAddForm || myAgents.length === 0) && (
        <section className={styles.createCard} aria-label="Create agent">
          <h2 className={styles.createTitle}>
            {myAgents.length === 0 ? "Create your first agent" : "Add another agent"}
          </h2>
          <p className={styles.createDesc}>
            Balanced defaults work great for beginners. Expand <strong>Agent strategy</strong> to set play style and
            custom instructions.
          </p>
          <form onSubmit={handleCreate}>
            {createError ? <p className={styles.errorText}>{createError}</p> : null}
            <label className={styles.label} htmlFor="agent-name">
              Agent name
            </label>
            <input
              id="agent-name"
              type="text"
              className={styles.input}
              placeholder="e.g. TradeBot, Alpha"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={48}
              autoFocus={myAgents.length === 0}
            />

            <button
              type="button"
              className={styles.strategyToggle}
              onClick={() => setShowStrategy((v) => !v)}
              aria-expanded={showStrategy}
            >
              {showStrategy ? "▾ Hide agent strategy" : "▸ Agent strategy (optional)"}
            </button>

            {showStrategy ? (
              <div className={styles.strategyPanel}>
                <AgentStrategyFields profile={behaviorProfile} onChange={setBehaviorProfile} />
              </div>
            ) : null}

            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={listInDiscover}
                onChange={(e) => setListInDiscover(e.target.checked)}
              />
              <span className={styles.checkLabel}>
                Let others play against this agent
                <span className={styles.checkHint}>Shows your agent in the opponent list on Play</span>
              </span>
            </label>
            <button type="submit" className={styles.primaryBtn} disabled={creating || !name.trim()}>
              {creating ? "Creating…" : myAgents.length === 0 ? "Create agent" : "Add agent"}
            </button>
            {myAgents.length > 0 ? (
              <button
                type="button"
                className={styles.secondaryBtn}
                style={{ marginTop: 10, width: "100%" }}
                onClick={() => {
                  resetCreateForm();
                  setShowAddForm(false);
                }}
              >
                Cancel
              </button>
            ) : null}
          </form>
        </section>
      )}

      {myAgents.length > 0 ? (
        <>
          <section aria-label="Your agents">
            <h2 className={styles.sectionTitle}>Your agents</h2>
            <div className={styles.agentList}>
              {myAgents.map((agent) => (
                <div key={agent.id} className={styles.agentRow}>
                  <div className={styles.agentInfo}>
                    <h3>{agent.name}</h3>
                    <p className={styles.agentMeta}>
                      {(agent.arena_wins ?? 0)}W · {(agent.arena_losses ?? 0)}L
                      {agent.is_public ? " · Visible to others" : " · Only you"}
                    </p>
                  </div>
                  <div className={styles.agentActions}>
                    <Link href={`/agents?edit=${agent.id}`} className={styles.customizeBtn}>
                      Customize
                    </Link>
                    <button
                      type="button"
                      className={agent.is_public ? styles.publicBtnOn : styles.publicBtn}
                      onClick={() => onTogglePublic(agent.id, agent.is_public ?? false)}
                      title={
                        agent.is_public
                          ? "Others can pick this agent as an opponent"
                          : "Only you can use this agent until you make it public"
                      }
                    >
                      {agent.is_public ? "Public" : "Private"}
                    </button>
                    <button type="button" className={styles.playBtn} onClick={onGoPlay}>
                      Play →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {!showAddForm ? (
            <button type="button" className={`${styles.secondaryBtn} ${styles.addAnother}`} onClick={() => setShowAddForm(true)}>
              + Add another agent
            </button>
          ) : null}

          <details className={styles.advancedBox}>
            <summary>Advanced: API keys, spending caps, on-chain ID</summary>
            <p>
              For custom API hosting, wallet spend limits, or ERC-8004 registration, use{" "}
              <Link href="/agents">full agent settings</Link>.
            </p>
          </details>
        </>
      ) : null}
    </div>
  );
}
