"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import {
  clearBoardNotice,
  subscribeBoardNotice,
  type BoardNotice,
  type BoardNoticeSeverity,
} from "@/lib/boardNotice";
import { BOARD_NOTICE_Z } from "@/lib/boardZIndex";

const SEVERITY_STYLES: Record<
  BoardNoticeSeverity,
  { container: string; Icon: typeof AlertCircle }
> = {
  error: {
    container: "bg-red-950/95 border-red-500/50 text-red-100",
    Icon: AlertCircle,
  },
  warning: {
    container: "bg-amber-950/95 border-amber-500/50 text-amber-100",
    Icon: AlertTriangle,
  },
  info: {
    container: "bg-slate-800/95 border-cyan-500/40 text-cyan-100",
    Icon: Info,
  },
};

export type NoticePlacement = "board" | "hero" | "page";

const BOTTOM_OFFSET: Record<NoticePlacement, string> = {
  board: "calc(4.75rem + env(safe-area-inset-bottom, 0px))",
  hero: "calc(var(--mobile-nav-height, 82px) + env(safe-area-inset-bottom, 0px) + 0.5rem)",
  page: "calc(var(--mobile-nav-height, 82px) + env(safe-area-inset-bottom, 0px) + 0.5rem)",
};

function NoticeContent({ notice }: { notice: BoardNotice }) {
  const { container, Icon } = SEVERITY_STYLES[notice.severity];

  return (
    <motion.div
      key={notice.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      role="alert"
      aria-live="polite"
      className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3 py-2.5 shadow-lg backdrop-blur-md ${container}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-90" aria-hidden />
      <p className="flex-1 text-sm leading-snug">{notice.message}</p>
      <button
        type="button"
        onClick={() => clearBoardNotice(notice.id)}
        className="shrink-0 rounded-md p-1 opacity-70 transition hover:bg-white/10 hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

/** Dismissible in-app notice strip — shared by board and hero. */
export default function NoticeBanner({ placement }: { placement: NoticePlacement }) {
  const [notice, setNotice] = useState<BoardNotice | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribeBoardNotice(setNotice), []);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!notice?.id || !rootRef.current) return;
    document.body.appendChild(rootRef.current);
  }, [notice?.id]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={rootRef}
      className="pointer-events-none fixed left-2 right-2"
      style={{
        zIndex: BOARD_NOTICE_Z,
        bottom: BOTTOM_OFFSET[placement],
      }}
    >
      <AnimatePresence mode="wait">
        {notice ? <NoticeContent notice={notice} /> : null}
      </AnimatePresence>
    </div>,
    document.body
  );
}
