"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Share2, Link2, Instagram, Check } from "lucide-react";

/** 3D lobby — `gameCode` in URL is read by WaitingClient3D. */
const DEFAULT_JOIN_3D = "/game-waiting-3d";
/** Classic lobby — same pattern as 2D waiting room. */
const DEFAULT_JOIN_2D = "/game-waiting";

export function getShareOrigin(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.location?.origin ?? "";
  } catch {
    return "";
  }
}

/** Full URL to the join page with `gameCode` pre-filled (same param as waiting room / board). */
export function buildWinnerChallengeUrl(
  gameCode: string,
  joinPagePath: string = DEFAULT_JOIN_3D
): string {
  const origin = getShareOrigin();
  const code = gameCode.trim().toUpperCase();
  if (!origin || !code) return "";
  const base = joinPagePath.startsWith("/") ? joinPagePath : `/${joinPagePath}`;
  const sep = base.includes("?") ? "&" : "?";
  return `${origin}${base}${sep}gameCode=${encodeURIComponent(code)}`;
}

export function buildWinnerShareCaption(challengeUrl: string, winnerUsername?: string): string {
  const tag = winnerUsername?.trim();
  const opener = tag
    ? `I just won a match on Tycoon 🏆 (${tag})`
    : `I just won a match on Tycoon 🏆`;
  return `${opener}\n\nThink you can beat me? Jump in here:\n${challengeUrl}\n\n#Tycoon`;
}

export interface VictorySocialShareProps {
  gameCode: string;
  winnerUsername?: string;
  /** Lobby path before `?gameCode=` — default 3D `/game-waiting-3d`, classic `/game-waiting`. */
  joinPagePath?: string;
  className?: string;
}

export function VictorySocialShare({
  gameCode,
  winnerUsername,
  joinPagePath = DEFAULT_JOIN_3D,
  className = "",
}: VictorySocialShareProps) {
  const [copied, setCopied] = useState<"link" | "ig" | null>(null);

  const challengeUrl = useMemo(
    () => buildWinnerChallengeUrl(gameCode, joinPagePath),
    [gameCode, joinPagePath]
  );

  const caption = useMemo(
    () => buildWinnerShareCaption(challengeUrl, winnerUsername),
    [challengeUrl, winnerUsername]
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
        title: "Tycoon win",
        text: caption,
        url: challengeUrl,
      });
    } catch {
      /* user cancelled or unsupported */
    }
  }, [caption, challengeUrl]);

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
        Share your win
      </p>
      <p className="text-xs text-slate-400 mb-3 leading-relaxed">
        One tap to post — friends land on join with your room code ready.
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

export { DEFAULT_JOIN_2D, DEFAULT_JOIN_3D };
