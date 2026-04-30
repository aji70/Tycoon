"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Share2, Link2, Instagram, Check } from "lucide-react";

/** Default waiting-room path passed from boards (used only to infer 2D vs 3D join link). */
const DEFAULT_JOIN_3D = "/game-waiting-3d";
/** Classic waiting room path from 2D flows. */
const DEFAULT_JOIN_2D = "/game-waiting";

/** Where social shares send people after a match — always open, unlike `?gameCode=` on a finished lobby. */
const INVITE_3D = "/join-room-3d";
const INVITE_2D = "/join-room";

export function getShareOrigin(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.location?.origin ?? "";
  } catch {
    return "";
  }
}

/**
 * Maps the in-game waiting path to the public join page (no finished `gameCode` in URL).
 */
export function invitePathFromJoinLobby(joinPagePath: string = DEFAULT_JOIN_3D): string {
  const j = (joinPagePath || "").replace(/\\/g, "/").toLowerCase();
  if (j.includes("3d")) return INVITE_3D;
  return INVITE_2D;
}

/**
 * Post-match invite URL: join lobby only. `finishedGameCode` is kept for call-site compatibility but not
 * appended — deep-linking a closed game’s waiting room confuses people who click the link later.
 */
export function buildWinnerChallengeUrl(
  finishedGameCode: string,
  joinPagePath: string = DEFAULT_JOIN_3D
): string {
  const origin = getShareOrigin();
  if (!origin) return "";
  const code = finishedGameCode.trim();
  if (!code) return "";
  const invite = invitePathFromJoinLobby(joinPagePath);
  const base = invite.startsWith("/") ? invite : `/${invite}`;
  return `${origin}${base}`;
}

export function buildWinnerShareCaption(inviteUrl: string, winnerUsername?: string): string {
  const tag = winnerUsername?.trim();
  const opener = tag
    ? `Ran the table on Tycoon 🏆 (${tag}). That match is in the books — think you'd last longer in the next one?`
    : `Ran the table on Tycoon 🏆. That match is in the books — think you'd last longer in the next one?`;
  return `${opener}\n\nStep up and prove it:\n${inviteUrl}\n\n#Tycoon`;
}

/** Loss: challenge friends / rematch — `winnerUsername` is who beat you; `loserUsername` is you (optional). */
export function buildLossShareCaption(
  inviteUrl: string,
  winnerUsername?: string,
  loserUsername?: string
): string {
  const w = winnerUsername?.trim();
  const l = loserUsername?.trim();
  const opener =
    w && l
      ? `Took an L on Tycoon — ${w} ran the board (I played as ${l}) 🎲`
      : w
        ? `Took an L on Tycoon — ${w} ran the board this round 🎲`
        : `Tough tables on Tycoon tonight 🎲`;
  return `${opener}\n\nNew lobby, clean slate — run it back:\n${inviteUrl}\n\n#Tycoon`;
}

export interface VictorySocialShareProps {
  gameCode: string;
  /** Win: your name as champion. Loss: opponent who won (use with variant="loss"). */
  winnerUsername?: string;
  /** Loss only: your display name (optional). */
  loserUsername?: string;
  /** Win (default) or loss — changes caption and labels. */
  variant?: "win" | "loss";
  /** Waiting-room path from the match flow — used to pick 3D vs 2D **join** URL (not sent as `?gameCode=`). */
  joinPagePath?: string;
  className?: string;
}

export function VictorySocialShare({
  gameCode,
  winnerUsername,
  loserUsername,
  variant = "win",
  joinPagePath = DEFAULT_JOIN_3D,
  className = "",
}: VictorySocialShareProps) {
  const [copied, setCopied] = useState<"link" | "ig" | null>(null);

  const challengeUrl = useMemo(
    () => buildWinnerChallengeUrl(gameCode, joinPagePath),
    [gameCode, joinPagePath]
  );

  const caption = useMemo(
    () =>
      variant === "loss"
        ? buildLossShareCaption(challengeUrl, winnerUsername, loserUsername)
        : buildWinnerShareCaption(challengeUrl, winnerUsername),
    [challengeUrl, winnerUsername, loserUsername, variant]
  );

  const xIntentUrl = useMemo(() => {
    if (!challengeUrl) return "";
    return `https://x.com/intent/tweet?text=${encodeURIComponent(caption)}`;
  }, [caption, challengeUrl]);

  const facebookSharerUrl = useMemo(() => {
    if (!challengeUrl) return "";
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(challengeUrl)}`;
  }, [challengeUrl]);

  const flashCopied = useCallback((kind: "link" | "ig") => {
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 2000);
  }, []);

  const copyText = useCallback(
    async (text: string, kind: "link" | "ig") => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const el = document.createElement("textarea");
          el.value = text;
          el.setAttribute("readonly", "");
          el.style.position = "absolute";
          el.style.left = "-9999px";
          document.body.appendChild(el);
          el.select();
          document.execCommand("copy");
          document.body.removeChild(el);
        }
        flashCopied(kind);
      } catch {
        /* ignore */
      }
    },
    [flashCopied]
  );

  const openShare = useCallback((url: string) => {
    window.open(url, "_blank", "noopener,noreferrer,width=620,height=420");
  }, []);

  const tryNativeShare = useCallback(async () => {
    if (!challengeUrl || typeof navigator === "undefined" || !navigator.share) return;
    try {
      await navigator.share({
        title: variant === "loss" ? "Tycoon match" : "Tycoon win",
        text: caption,
        url: challengeUrl,
      });
    } catch {
      /* user cancelled or unsupported */
    }
  }, [caption, challengeUrl, variant]);

  if (!challengeUrl) return null;

  const shareBtnClass =
    "flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-sm font-semibold " +
    "border border-cyan-500/35 bg-cyan-950/40 text-cyan-100 hover:bg-cyan-900/50 hover:border-cyan-400/50 " +
    "transition-colors active:scale-[0.98]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className={`w-full rounded-2xl border border-cyan-500/25 bg-black/30 backdrop-blur-sm p-4 text-left ${className}`}
    >
      <p className="text-[0.65rem] uppercase tracking-[0.2em] text-cyan-300/90 font-bold mb-1">
        {variant === "loss" ? "Share your game" : "Share your win"}
      </p>
      <p className="text-xs text-slate-400 mb-3 leading-relaxed">
        {variant === "loss"
          ? "One tap to post — link opens the join page so friends can enter a new code or start a game."
          : "One tap to post — link opens the join page (your finished match isn't deep-linked so the URL stays good)."}
      </p>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <button type="button" onClick={() => openShare(xIntentUrl)} className={shareBtnClass}>
          <span className="font-black text-white tracking-tight">𝕏</span>
          Post on X
        </button>
        <button
          type="button"
          onClick={() => openShare(facebookSharerUrl)}
          className={shareBtnClass}
        >
          <span className="text-blue-300 font-bold">f</span>
          Facebook
        </button>
        <button
          type="button"
          onClick={() => void copyText(caption, "ig")}
          className={shareBtnClass}
        >
          {copied === "ig" ? (
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Instagram className="w-4 h-4 text-pink-300 shrink-0" />
          )}
          {copied === "ig" ? "Copied" : "Instagram"}
        </button>
        <button
          type="button"
          onClick={() => void copyText(challengeUrl, "link")}
          className={shareBtnClass}
        >
          {copied === "link" ? (
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Link2 className="w-4 h-4 text-cyan-300 shrink-0" />
          )}
          {copied === "link" ? "Copied" : "Copy link"}
        </button>
      </div>

      {typeof navigator !== "undefined" && typeof navigator.share === "function" ? (
        <button
          type="button"
          onClick={() => void tryNativeShare()}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-sm font-semibold border border-white/15 bg-white/5 text-slate-100 hover:bg-white/10 transition-colors"
        >
          <Share2 className="w-4 h-4" />
          More apps…
        </button>
      ) : null}

      <p className="text-[0.65rem] text-slate-500 mt-3 leading-snug">
        Instagram has no web post composer — we copy a caption; paste it in a new post or story.
      </p>
    </motion.div>
  );
}

export { DEFAULT_JOIN_2D, DEFAULT_JOIN_3D, INVITE_2D, INVITE_3D };
