"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, MessageCircle, Users, X } from "lucide-react";
import { useAccount } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { useMessageNotifications } from "@/context/MessageNotificationsContext";
import OnlineDmPanel from "@/components/shared/OnlineDmPanel";

type MessageNotificationBellProps = {
  className?: string;
  username?: string | null;
};

/**
 * Bell + badge for lobby / DM unread.
 * Challenges use ChallengeInviteBanner, not this sheet.
 */
export default function MessageNotificationBell({
  className = "",
  username,
}: MessageNotificationBellProps) {
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

  useEffect(() => {
    setMounted(true);
  }, []);

  const signedIn = !!(isConnected || guestUser);
  if (!signedIn) return null;

  const badge = totalUnread > 99 ? "99+" : totalUnread > 0 ? String(totalUnread) : null;

  const close = () => {
    setOpen(false);
    setDmTarget(null);
    setActiveDmConversationId(null);
  };

  const openLobby = () => {
    markLobbyRead();
    setLobbyOpen(true);
    setOpen(false);
    setDmTarget(null);
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

  const sheet =
    mounted &&
    createPortal(
      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close notifications"
              className="fixed inset-0 z-[1200] bg-black/75 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="msg-notif-title"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-[1201] max-h-[80dvh] overflow-y-auto rounded-t-2xl border-t-2 border-amber-400/35 bg-gradient-to-b from-[#0c1c28] to-[#071018] pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_rgba(0,0,0,0.55)]"
            >
              <div className="mx-auto max-w-md px-4 pb-6 pt-3">
                <div className="mb-3 flex justify-center">
                  <div className="h-1.5 w-12 rounded-full bg-amber-400/60" />
                </div>

                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex items-start gap-2">
                    {dmTarget && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDmConversationId(null);
                          setDmTarget(null);
                        }}
                        className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/40 text-amber-100"
                        aria-label="Back"
                      >
                        <X className="h-4 w-4 rotate-45" />
                      </button>
                    )}
                    <div>
                      <h3
                        id="msg-notif-title"
                        className="font-orbitron text-sm font-bold uppercase tracking-wider text-amber-200"
                      >
                        {dmTarget
                          ? dmTarget.otherUsername || "Direct message"
                          : "Messages"}
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
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-amber-400/45 bg-amber-500/15 text-amber-100"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                </div>

                {dmTarget ? (
                  <OnlineDmPanel
                    otherUserId={dmTarget.otherUserId}
                    otherUsername={dmTarget.otherUsername}
                    myUserId={guestUser?.id}
                    myUsername={guestUser?.username ?? username}
                  />
                ) : (
                  <ul className="space-y-2">
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

                <button
                  type="button"
                  onClick={close}
                  className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/10 font-orbitron text-xs font-bold uppercase tracking-wider text-amber-100"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>,
      document.body
    );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
    </>
  );
}
