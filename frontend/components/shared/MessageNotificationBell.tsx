"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Loader2, MessageCircle, Swords, Users, X } from "lucide-react";
import { useAccount } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import {
  useMessageNotifications,
  type ChallengeItem,
} from "@/context/MessageNotificationsContext";
import OnlineDmPanel from "@/components/shared/OnlineDmPanel";
import { apiClient } from "@/lib/api";
import { canAccessChallenges } from "@/lib/featureAccess";
import { getGuestUserPlayAddress } from "@/lib/minipayGuestFlow";

type MessageNotificationBellProps = {
  className?: string;
  username?: string | null;
};

type ChallengerStats = {
  username: string;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  winRate: string;
};

function parseStats(row: Record<string, unknown> | null, fallback: string): ChallengerStats | null {
  if (!row) return null;
  const gamesPlayed = Number(row.celo_games_played ?? row.games_played ?? 0);
  const gamesWon = Number(row.celo_games_won ?? row.game_won ?? 0);
  const gamesLost = Number(row.game_lost ?? 0);
  return {
    username: String(row.username ?? fallback),
    gamesPlayed,
    gamesWon,
    gamesLost,
    winRate: gamesPlayed > 0 ? ((gamesWon / gamesPlayed) * 100).toFixed(1) : "0",
  };
}

/**
 * Bell + badge for lobby / DM / challenge unread.
 */
export default function MessageNotificationBell({
  className = "",
  username,
}: MessageNotificationBellProps) {
  const router = useRouter();
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { address: appKitAddress, isConnected: appKitConnected } = useAppKitAccount();
  const isConnected = wagmiConnected || appKitConnected;
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const playAddress =
    wagmiAddress ||
    appKitAddress ||
    getGuestUserPlayAddress(guestUser) ||
    guestUser?.address ||
    undefined;
  const canChallenge =
    canAccessChallenges(username) || canAccessChallenges(guestUser?.username);
  const {
    totalUnread,
    lobbyUnread,
    dmItems,
    challengeItems,
    setLobbyOpen,
    setActiveDmConversationId,
    markLobbyRead,
    dismissChallenge,
    refreshChallenges,
  } = useMessageNotifications();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dmTarget, setDmTarget] = useState<{
    conversationId: number;
    otherUserId?: number | null;
    otherUsername?: string | null;
  } | null>(null);
  const [challengeFocus, setChallengeFocus] = useState<ChallengeItem | null>(null);
  const [challengeStats, setChallengeStats] = useState<ChallengerStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState<"accept" | "reject" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!challengeFocus) {
      setChallengeStats(null);
      setActionError(null);
      return;
    }
    let cancelled = false;
    setStatsLoading(true);
    setActionError(null);
    void (async () => {
      try {
        const uname = challengeFocus.challengerUsername?.trim();
        const res = uname
          ? await apiClient.get(`/users/by-username/${encodeURIComponent(uname)}`)
          : challengeFocus.challengerId
            ? await apiClient.get(`/users/${challengeFocus.challengerId}`)
            : null;
        const body = res?.data as { data?: Record<string, unknown> } | Record<string, unknown> | undefined;
        const row =
          body && typeof body === "object" && "data" in body && body.data
            ? (body.data as Record<string, unknown>)
            : (body as Record<string, unknown> | null);
        if (!cancelled) {
          setChallengeStats(parseStats(row, uname || "Player"));
        }
      } catch {
        if (!cancelled) setChallengeStats(null);
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [challengeFocus]);

  const signedIn = !!(isConnected || guestUser);
  if (!signedIn) return null;

  const badge = totalUnread > 99 ? "99+" : totalUnread > 0 ? String(totalUnread) : null;

  const close = () => {
    setOpen(false);
    setDmTarget(null);
    setChallengeFocus(null);
    setActiveDmConversationId(null);
  };

  const openLobby = () => {
    markLobbyRead();
    setLobbyOpen(true);
    setOpen(false);
    setDmTarget(null);
    setChallengeFocus(null);
    window.dispatchEvent(new CustomEvent("tycoon-open-lobby-chat"));
  };

  const openDm = (item: {
    conversationId: number;
    otherUserId?: number | null;
    otherUsername?: string | null;
  }) => {
    setChallengeFocus(null);
    setActiveDmConversationId(item.conversationId);
    setDmTarget(item);
  };

  const acceptChallenge = async () => {
    if (!challengeFocus || actionBusy) return;
    setActionBusy("accept");
    setActionError(null);
    try {
      const res = await apiClient.post(
        `/challenges/${challengeFocus.id}/accept`,
        playAddress ? { address: playAddress, chain: "CELO" } : {},
        { timeout: 120000 }
      );
      const body = res?.data as { data?: { gameCode?: string }; message?: string } | undefined;
      const code =
        body?.data?.gameCode ||
        challengeFocus.gameCode ||
        "";
      dismissChallenge(challengeFocus.id);
      close();
      if (code) {
        router.push(`/game-waiting-3d?gameCode=${encodeURIComponent(code)}`);
      }
      void refreshChallenges();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as Error)?.message ||
        "Could not accept challenge";
      setActionError(msg);
    } finally {
      setActionBusy(null);
    }
  };

  const rejectChallenge = async () => {
    if (!challengeFocus || actionBusy) return;
    setActionBusy("reject");
    setActionError(null);
    try {
      await apiClient.post(
        `/challenges/${challengeFocus.id}/reject`,
        playAddress ? { address: playAddress, chain: "CELO" } : {}
      );
      dismissChallenge(challengeFocus.id);
      setChallengeFocus(null);
      void refreshChallenges();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as Error)?.message ||
        "Could not reject challenge";
      setActionError(msg);
    } finally {
      setActionBusy(null);
    }
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
                    {(dmTarget || challengeFocus) && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDmConversationId(null);
                          setDmTarget(null);
                          setChallengeFocus(null);
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
                        {challengeFocus
                          ? "Challenge"
                          : dmTarget
                            ? dmTarget.otherUsername || "Direct message"
                            : "Messages"}
                      </h3>
                      <p className="mt-0.5 font-dmSans text-xs text-[#8aa4b0]">
                        {challengeFocus
                          ? `${challengeFocus.challengerUsername || "Player"} challenged you`
                          : dmTarget
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

                {challengeFocus ? (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-4">
                    {statsLoading ? (
                      <div className="flex flex-col items-center gap-3 py-8">
                        <Loader2 className="h-7 w-7 animate-spin text-rose-200" />
                        <p className="font-dmSans text-sm text-[#8aa4b0]">Loading player stats…</p>
                      </div>
                    ) : (
                      <>
                        <p className="font-orbitron text-lg font-bold text-[#e8f4f7]">
                          {challengeStats?.username ||
                            challengeFocus.challengerUsername ||
                            "Player"}
                        </p>
                        <p className="mt-1 font-dmSans text-xs text-[#8aa4b0]">
                          Free private match · lobby {challengeFocus.gameCode}
                        </p>
                        <dl className="mt-4 space-y-2 font-dmSans text-sm">
                          <div className="flex justify-between gap-3">
                            <dt className="text-[#8aa4b0]">Games played</dt>
                            <dd className="font-orbitron font-bold text-emerald-200">
                              {challengeStats?.gamesPlayed ?? "—"}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-[#8aa4b0]">Wins</dt>
                            <dd className="font-orbitron font-bold text-emerald-300">
                              {challengeStats?.gamesWon ?? "—"}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-[#8aa4b0]">Losses</dt>
                            <dd className="font-orbitron font-bold text-[#c8d8de]">
                              {challengeStats?.gamesLost ?? "—"}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-[#8aa4b0]">Win rate</dt>
                            <dd className="font-orbitron font-bold text-cyan-200">
                              {challengeStats ? `${challengeStats.winRate}%` : "—"}
                            </dd>
                          </div>
                        </dl>
                        {actionError && (
                          <p className="mt-3 font-dmSans text-xs text-rose-300">{actionError}</p>
                        )}
                        <div className="mt-5 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={!!actionBusy}
                            onClick={() => void rejectChallenge()}
                            className="flex min-h-12 items-center justify-center rounded-xl border border-white/20 bg-white/5 font-orbitron text-xs font-bold uppercase tracking-wider text-[#e8f4f7] disabled:opacity-50"
                          >
                            {actionBusy === "reject" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Reject"
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={!!actionBusy}
                            onClick={() => void acceptChallenge()}
                            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-emerald-400/50 bg-emerald-500/20 font-orbitron text-xs font-bold uppercase tracking-wider text-emerald-100 disabled:opacity-50"
                          >
                            {actionBusy === "accept" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Accept"
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : dmTarget ? (
                  <OnlineDmPanel
                    otherUserId={dmTarget.otherUserId}
                    otherUsername={dmTarget.otherUsername}
                    myUserId={guestUser?.id}
                    myUsername={guestUser?.username ?? username}
                  />
                ) : (
                  <ul className="space-y-2">
                    {canChallenge &&
                      challengeItems.map((c) => (
                        <li key={`challenge-${c.id}`}>
                          <button
                            type="button"
                            onClick={() => setChallengeFocus(c)}
                            className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-rose-500/35 bg-rose-500/12 px-3 py-2.5 text-left transition hover:border-rose-400/55"
                          >
                            <div className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-rose-400/45 bg-[#0a1a26] text-rose-200">
                              <Swords className="h-5 w-5" />
                              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 font-orbitron text-[10px] font-bold text-black">
                                1
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-dmSans text-sm font-semibold text-[#e8f4f7]">
                                {c.challengerUsername || "Player"} challenged you
                              </p>
                              <p className="font-dmSans text-[11px] text-[#8aa4b0]">
                                Tap to view stats · Accept or reject
                              </p>
                            </div>
                          </button>
                        </li>
                      ))}

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
