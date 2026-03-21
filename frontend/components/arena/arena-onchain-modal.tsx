"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./arena-onchain-modal.module.css";

const STATUS_LINES = [
  "Deploying your game on-chain…",
  "Spinning up seats on the contract…",
  "Almost there — approve in your wallet if prompted…",
  "Sealing the board — processing transactions…",
  "Hang tight — on-chain magic in progress…",
];

export type ArenaOnchainBusyPayload = {
  message: string;
  gameCode: string;
};

type Props = {
  open: boolean;
  busy: ArenaOnchainBusyPayload | null;
  isMobile: boolean;
  onClose: () => void;
};

export function ArenaOnchainModal({ open, busy, isMobile, onClose }: Props) {
  const [lineIdx, setLineIdx] = useState(0);

  useEffect(() => {
    if (!open || busy) return;
    const id = setInterval(() => {
      setLineIdx((i) => (i + 1) % STATUS_LINES.length);
    }, 2800);
    return () => clearInterval(id);
  }, [open, busy]);

  useEffect(() => {
    if (open && !busy) setLineIdx(0);
  }, [open, busy]);

  if (!open) return null;

  const boardBase = isMobile ? "/board-3d-mobile" : "/board-3d";
  const watchHref =
    busy?.gameCode && String(busy.gameCode).trim() !== ""
      ? `${boardBase}?gameCode=${encodeURIComponent(String(busy.gameCode).trim())}`
      : null;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="arena-tx-modal-title">
      <div className={styles.card}>
        <div className={styles.particles} aria-hidden>
          <span className={styles.particle} />
          <span className={styles.particle} />
          <span className={styles.particle} />
        </div>
        <div className={styles.cardInner}>
          {busy ? (
            <>
              <h2 id="arena-tx-modal-title" className={styles.title}>
                Agent already in a match
              </h2>
              <p className={styles.busyMessage}>{busy.message}</p>
              <div className={styles.actions}>
                {watchHref ? (
                  <Link href={watchHref} className={styles.watchBtn} onClick={onClose}>
                    Spectate this game
                  </Link>
                ) : null}
                <button type="button" className={styles.closeBtn} onClick={onClose}>
                  Close
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 id="arena-tx-modal-title" className={styles.title}>
                On-chain setup
              </h2>
              <div className={styles.spinnerWrap}>
                <div className={styles.spinner} aria-hidden />
              </div>
              <p className={styles.statusLine}>{STATUS_LINES[lineIdx]}</p>
              <p className={styles.sub}>
                Processing on-chain transactions. This can take 1–3 minutes. Keep this tab open and confirm any wallet
                prompts.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
