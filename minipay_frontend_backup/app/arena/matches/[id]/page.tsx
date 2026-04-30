"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import styles from "./match-details.module.css";

interface Match {
  id: number;
  game_id?: number;
  agent_a_id: number;
  agent_b_id: number;
  agent_a_name: string;
  agent_b_name: string;
  agent_a_username: string;
  agent_b_username: string;
  winner_agent_id: number | null;
  status: string;
  elo_change_a: number;
  elo_change_b: number;
  elo_before_a: number;
  elo_before_b: number;
  agent_a_elo_after: number;
  agent_b_elo_after: number;
  started_at: string;
  completed_at: string;
}

const EloColor = (change: number) => {
  if (change > 0) return "#00ff00";
  if (change < 0) return "#ff4444";
  return "#aaa";
};

export default function MatchDetailsPage() {
  const params = useParams();
  const matchId = params.id as string;
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMatch();
  }, [matchId]);

  const fetchMatch = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/arena/matches/${matchId}`);
      if (!res.ok) throw new Error("Failed to fetch match");
      const data = await res.json();
      setMatch(data.match);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className={styles.loading}>Loading match details...</div>;
  if (error) return <div className={styles.error}>{error}</div>;
  if (!match) return <div className={styles.error}>Match not found</div>;

  const isAgentAWinner = match.winner_agent_id === match.agent_a_id;
  const isAgentBWinner = match.winner_agent_id === match.agent_b_id;
  const isDraw = match.winner_agent_id === null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>⚔️ Match Details</h1>
        <p>Match #{match.id}</p>
      </header>

      <div className={styles.matchCard}>
        {/* Agent A */}
        <div className={`${styles.agentSide} ${isAgentAWinner ? styles.winner : ""}`}>
          <div className={styles.agentInfo}>
            <h2 className={styles.agentName}>{match.agent_a_name}</h2>
            <p className={styles.username}>by {match.agent_a_username}</p>
            <div className={styles.eloInfo}>
              <div className={styles.eloRow}>
                <span>Before:</span>
                <span className={styles.elo}>{match.elo_before_a}</span>
              </div>
              <div className={styles.eloRow}>
                <span>After:</span>
                <span className={styles.eloAfter}>{match.agent_a_elo_after}</span>
              </div>
            </div>
            <div
              className={styles.eloChange}
              style={{ color: EloColor(match.elo_change_a) }}
            >
              {match.elo_change_a > 0 ? "+" : ""}{match.elo_change_a} XP
            </div>
          </div>
        </div>

        {/* VS / Result */}
        <div className={styles.vsSection}>
          {isAgentAWinner && <div className={styles.result}>🏆 WINNER</div>}
          {isAgentBWinner && <div className={styles.vs}>VS</div>}
          {isDraw && <div className={styles.draw}>DRAW</div>}
        </div>

        {/* Agent B */}
        <div className={`${styles.agentSide} ${isAgentBWinner ? styles.winner : ""}`}>
          <div className={styles.agentInfo}>
            <h2 className={styles.agentName}>{match.agent_b_name}</h2>
            <p className={styles.username}>by {match.agent_b_username}</p>
            <div className={styles.eloInfo}>
              <div className={styles.eloRow}>
                <span>Before:</span>
                <span className={styles.elo}>{match.elo_before_b}</span>
              </div>
              <div className={styles.eloRow}>
                <span>After:</span>
                <span className={styles.eloAfter}>{match.agent_b_elo_after}</span>
              </div>
            </div>
            <div
              className={styles.eloChange}
              style={{ color: EloColor(match.elo_change_b) }}
            >
              {match.elo_change_b > 0 ? "+" : ""}{match.elo_change_b} XP
            </div>
          </div>
        </div>
      </div>

      {isAgentBWinner && (
        <div className={styles.matchResult}>
          <span className={styles.resultText}>🏆 {match.agent_b_name} WINS</span>
        </div>
      )}

      <div className={styles.matchMetadata}>
        <div className={styles.metaRow}>
          <span className={styles.label}>Status:</span>
          <span className={styles.value}>{match.status}</span>
        </div>
        {match.started_at && (
          <div className={styles.metaRow}>
            <span className={styles.label}>Started:</span>
            <span className={styles.value}>{new Date(match.started_at).toLocaleString()}</span>
          </div>
        )}
        {match.completed_at && (
          <div className={styles.metaRow}>
            <span className={styles.label}>Completed:</span>
            <span className={styles.value}>
              {new Date(match.completed_at).toLocaleString()}
            </span>
          </div>
        )}
        {match.game_id && (
          <div className={styles.metaRow}>
            <span className={styles.label}>Game:</span>
            <a href={`/game-room-loading?gameId=${match.game_id}`} className={styles.link}>
              View Game #{match.game_id}
            </a>
          </div>
        )}
      </div>

      <div className={styles.backButton}>
        <a href="/arena" className={styles.link}>
          ← Back to Arena
        </a>
      </div>
    </div>
  );
}
