"use client";

import { useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import { buildTycoonHostedAgentPayload } from "@/lib/agentCreatePayload";
import { ApiResponse } from "@/types/api";
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
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(myAgents.length === 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setCreateError("Enter a name for your agent.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await apiClient.post<ApiResponse<{ id: number }>>(
        "/agents",
        buildTycoonHostedAgentPayload(trimmed)
      );
      const agentId = res?.data?.data?.id;
      if (listInDiscover && agentId != null) {
        await apiClient.patch(`/agents/${agentId}`, { is_public: true });
      }
      setName("");
      setShowAddForm(false);
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
            <strong>Sign in</strong> with the wallet button in the top navigation bar, then come back here to create
            your agent.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.intro}>
        You only need a name. Tycoon runs the AI for you — no API keys required. When you are done, go to{" "}
        <strong>Play</strong> to find opponents.
      </p>

      {(showAddForm || myAgents.length === 0) && (
        <section className={styles.createCard} aria-label="Create agent">
          <h2 className={styles.createTitle}>
            {myAgents.length === 0 ? "Create your first agent" : "Add another agent"}
          </h2>
          <p className={styles.createDesc}>
            Pick any name. Your agent will use balanced default strategy — you can customize later if needed.
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
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={listInDiscover}
                onChange={(e) => setListInDiscover(e.target.checked)}
              />
              <span className={styles.checkLabel}>
                Show in Discover
                <span className={styles.checkHint}>Other players can select this agent as an opponent</span>
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
                onClick={() => setShowAddForm(false)}
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
            <div className={styles.agentList}>
              {myAgents.map((agent) => (
                <div key={agent.id} className={styles.agentRow}>
                  <div className={styles.agentInfo}>
                    <h3>{agent.name}</h3>
                    <p className={styles.agentMeta}>
                      {(agent.arena_wins ?? 0)}W · {(agent.arena_losses ?? 0)}L
                      {agent.is_public ? " · Listed in Discover" : " · Hidden from Discover"}
                    </p>
                  </div>
                  <div className={styles.agentActions}>
                    <button
                      type="button"
                      className={agent.is_public ? styles.publicBtnOn : styles.publicBtn}
                      onClick={() => onTogglePublic(agent.id, agent.is_public ?? false)}
                      title={
                        agent.is_public
                          ? "Others can find this agent in Discover"
                          : "Only you can use this agent until you make it public"
                      }
                    >
                      {agent.is_public ? "Public" : "Private"}
                    </button>
                    <button type="button" className={styles.playBtn} onClick={onGoPlay}>
                      Play now →
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

          <p className={styles.footerLink}>
            Need API keys, custom hosting, or wallet spending caps?{" "}
            <Link href="/agents">Open full agent settings</Link>
          </p>
        </>
      ) : null}
    </div>
  );
}
