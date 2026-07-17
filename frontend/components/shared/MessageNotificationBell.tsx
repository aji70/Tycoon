"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, ChevronLeft, MessageCircle, Users, X } from "lucide-react";
import { useAccount } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { useMessageNotifications } from "@/context/MessageNotificationsContext";
import OnlineDmPanel from "@/components/shared/OnlineDmPanel";
import { useMediaQuery } from "@/components/useMediaQuery";

type MessageNotificationBellProps = {
  className?: string;
  username?: string | null;
};

/**
 * Bell + badge for lobby / DM unread.
 * Desktop: dropdown anchored under the bell. Mobile: full-screen sheet.
 */
export default function MessageNotificationBell({
  className = "",
  username,
}: MessageNotificationBellProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { isConnected: wagmiConnected } = useAccount();
  const { isConnected: appKitConnected } = useAppKitAccount();
  const isConnected = wagmiConnected || appKitConnected;
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const {
    totalUnread,
    lobbyUnread,
    dmItems,
    setLobbyOpen,
    setActiveDmConversationId,
    markLobbyRead,
  } = useMessageNotifications();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dmTarget, setDmTarget] = useState<{
    conversationId: number;
    otherUserId?: number | null;
    otherUsername?: string | null;
  } | null>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const signedIn = !!(isConnected || guestUser);

  const close = useCallback(() => {
    setOpen(false);
    setDmTarget(null);
    setActiveDmConversationId(null);
    setAnchor(null);
  }, [setActiveDmConversationId]);

  const updateAnchor = useCallback(() => {
    const el = bellRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setAnchor({
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, []);

  useEffect(() => {
    if (!open || isMobile) return;
    updateAnchor();
    const onLayout = () => updateAnchor();
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);
    return () => {
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
    };
  }, [open, isMobile, updateAnchor]);

  useEffect(() => {
    if (!open || isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isMobile, close]);

  if (!signedIn) return null;

  const badge = totalUnread > 99 ? "99+" : totalUnread > 0 ? String(totalUnread) : null;

  const toggleOpen = () => {
    if (open) {
      close();
      return;
    }
    if (!isMobile) updateAnchor();
    setOpen(true);
  };

  const openLobby = () => {
    markLobbyRead();
    setLobbyOpen(true);
    close();
    window.dispatchEvent(new CustomEvent("tycoon-open-lobby-chat"));
  };

  const openDm = (item: {
    conversationId: number;
    otherUserId?: number | null;
    otherUsername?: string | null;
  }) => {
    setActiveDmConversationId(item.conversationId);
    setDmTarget(item);
  };

  const panelBody = (
    <div className={isMobile ? "flex min-h-0 flex-1 flex-col" : undefined}>
      <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-2">
          {dmTarget && (
            <button
              type="button"
              onClick={() => {
                setActiveDmConversationId(null);
                setDmTarget(null);
              }}
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/40 text-amber-100 transition hover:bg-amber-500/10"
              aria-label="Back"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <h3
              id="msg-notif-title"
              className="font-orbitron text-sm font-bold uppercase tracking-wider text-amber-200"
            >
              {dmTarget ? dmTarget.otherUsername || "Direct message" : "Messages"}
            </h3>
            <p className="mt-0.5 font-dmSans text-xs text-[#8aa4b0]">
              {dmTarget
                ? "Private chat"
                : totalUnread > 0
                  ? `${totalUnread} new`
                  : "You're all caught up"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/35 bg-amber-500/10 text-amber-100 transition hover:bg-amber-500/20"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {dmTarget ? (
        <OnlineDmPanel
          otherUserId={dmTarget.otherUserId}
          otherUsername={dmTarget.otherUsername}
          myUserId={guestUser?.id}
          myUsername={guestUser?.username ?? username}
          fillHeight={isMobile}
        />
      ) : (
        <ul className={`space-y-2 ${isMobile ? "min-h-0 flex-1 overflow-y-auto" : ""}`}>
          <li>
            <button
              type="button"
              onClick={openLobby}
              className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2.5 text-left transition hover:border-cyan-400/50"
            >
              <div className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-cyan-400/40 bg-[#0a1a26] text-cyan-300">
                <Users className="h-5 w-5" />
                {lobbyUnread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 font-orbitron text-[10px] font-bold text-black">
                    {lobbyUnread > 9 ? "9+" : lobbyUnread}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-dmSans text-sm font-semibold text-[#e8f4f7]">Lobby chat</p>
                <p className="font-dmSans text-[11px] text-[#8aa4b0]">
                  {lobbyUnread > 0 ? `${lobbyUnread} new in general room` : "Open general room"}
                </p>
              </div>
              <MessageCircle className="h-4 w-4 text-cyan-300/80" />
            </button>
          </li>

          {dmItems.length === 0 ? (
            <li className="rounded-xl border border-dashed border-amber-500/20 px-4 py-6 text-center">
              <p className="font-dmSans text-sm text-[#8aa4b0]">No new direct messages</p>
            </li>
          ) : (
            dmItems.map((item) => (
              <li key={item.conversationId}>
                <button
                  type="button"
                  onClick={() => openDm(item)}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-left transition hover:border-emerald-400/50"
                >
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-400/40 bg-[#0a1a26] font-orbitron text-sm font-bold text-emerald-300">
                    {(item.otherUsername?.[0] || "D").toUpperCase()}
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 font-orbitron text-[10px] font-bold text-black">
                      {item.count > 9 ? "9+" : item.count}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-dmSans text-sm font-semibold text-[#e8f4f7]">
                      {item.otherUsername || "Player"}
                    </p>
                    <p className="truncate font-dmSans text-[11px] text-[#8aa4b0]">
                      {item.preview || "New message"}
                    </p>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {isMobile && !dmTarget && (
        <button
          type="button"
          onClick={close}
          className="mt-5 flex min-h-12 w-full shrink-0 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/10 font-orbitron text-xs font-bold uppercase tracking-wider text-amber-100"
        >
          Close
        </button>
      )}
    </div>
  );

  const sheet =
    mounted &&
    createPortal(
      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close notifications"
              className={
                isMobile
                  ? "fixed inset-0 z-[1200] bg-black/75 backdrop-blur-[2px]"
                  : "fixed inset-0 z-[1200] bg-transparent"
              }
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="msg-notif-title"
              initial={
                isMobile
                  ? { y: "100%" }
                  : { opacity: 0, scale: 0.96, y: -6 }
              }
              animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
              exit={
                isMobile
                  ? { y: "100%" }
                  : { opacity: 0, scale: 0.96, y: -6 }
              }
              transition={{ type: "spring", damping: 28, stiffness: 360 }}
              style={
                !isMobile && anchor
                  ? { top: anchor.top, right: anchor.right }
                  : undefined
              }
              className={
                isMobile
                  ? "fixed inset-0 z-[1201] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-gradient-to-b from-[#0c1c28] to-[#071018] pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
                  : "fixed z-[1201] w-[min(22rem,calc(100vw-1rem))] max-h-[min(70vh,520px)] overflow-y-auto rounded-xl border border-amber-400/30 bg-gradient-to-b from-[#0c1c28] to-[#071018] shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
              }
            >
              <div className={isMobile ? "flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3" : "px-4 pb-4 pt-3"}>
                {panelBody}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body
    );

  return (
    <div className="relative">
      <button
        ref={bellRef}
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={badge ? `${badge} unread messages` : "Messages"}
        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#00F0FF]/25 bg-gradient-to-b from-[#03383a] to-[#011112] text-white/90 transition hover:border-[#00F0FF]/40 hover:shadow-[0_0_16px_rgba(0,240,255,0.12)] active:scale-[0.97] sm:h-11 sm:w-11 ${className}`}
      >
        <Bell size={20} className={totalUnread > 0 ? "text-amber-300" : undefined} />
        {badge && (
          <motion.span
            initial={{ scale: 0.6 }}
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
            className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 font-orbitron text-[10px] font-bold text-black shadow-[0_0_10px_rgba(251,191,36,0.65)]"
          >
            {badge}
          </motion.span>
        )}
      </button>
      {sheet}
    </div>
  );
}
