"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Globe, Loader2, MessageCircle, X } from "lucide-react";
import { useAccount } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import { useOnlineUsers, type OnlineUser } from "@/hooks/useOnlineUsers";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { getGuestUserPlayAddress } from "@/lib/minipayGuestFlow";
import { canAccessMultiplayerPreview, canAccessDirectMessages } from "@/lib/featureAccess";
import { apiClient } from "@/lib/api";
import OnlineDmPanel from "@/components/shared/OnlineDmPanel";
import OnlineLobbyPanel from "@/components/shared/OnlineLobbyPanel";
import { useMessageNotifications } from "@/context/MessageNotificationsContext";

const DISMISS_KEY = "tycoon_who_is_online_pill_dismissed";

function shortAddress(addr?: string | null): string {
  if (!addr || addr.length < 10) return "Player";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatStakeOrEarned(value: number): string {
  if (value >= 1e18) return (value / 1e18).toFixed(2);
  if (value >= 1e15) return (value / 1e18).toFixed(4);
  return String(value);
}

type PlayerStats = {
  userId?: number;
  username: string;
  shortAddress: string;
  address?: string;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  winRate: string;
  totalStaked: number;
  totalEarned: number;
};

function parseStatsRow(row: Record<string, unknown> | null, fallbackLabel: string): PlayerStats | null {
  if (!row) return null;
  const playerAddress = String(row.address ?? "");
  const gamesPlayed = Number(row.celo_games_played ?? row.games_played ?? 0);
  const gamesWon = Number(row.celo_games_won ?? row.game_won ?? 0);
  const gamesLost = Number(row.game_lost ?? 0);
  const idNum = Number(row.id);
  return {
    userId: Number.isInteger(idNum) && idNum > 0 ? idNum : undefined,
    username: String(row.username ?? fallbackLabel),
    shortAddress:
      playerAddress && playerAddress.length > 10
        ? `${playerAddress.slice(0, 6)}…${playerAddress.slice(-4)}`
        : playerAddress || "—",
    address: playerAddress || undefined,
    gamesPlayed,
    gamesWon,
    gamesLost,
    winRate: gamesPlayed > 0 ? ((gamesWon / gamesPlayed) * 100).toFixed(1) : "0",
    totalStaked: Number(row.total_staked ?? 0),
    totalEarned: Number(row.total_earned ?? 0),
  };
}

type WhoIsOnlineControlProps = {
  className?: string;
  /** Resolved display username (guest / on-chain / backend). Used for allowlist gate. */
  username?: string | null;
  forceShow?: boolean;
  /**
   * `nav` — compact center pill (sheet portaled so it isn’t trapped by nav transforms).
   * `page` — larger chip with its own dismiss X (join room style).
   */
  variant?: "nav" | "page";
};

/**
 * Live global online count + sheet. Soft-launch: Ajisabo / Jaibois only unless forceShow.
 * Tap a player to view their public stats.
 */
export default function WhoIsOnlineControl({
  className = "",
  username,
  forceShow = false,
  variant = "nav",
}: WhoIsOnlineControlProps) {
  const { address: wagmiAddress } = useAccount();
  const { address: appKitAddress } = useAppKitAccount();
  const address = wagmiAddress ?? appKitAddress;
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pillDismissed, setPillDismissed] = useState(false);
  const [selected, setSelected] = useState<OnlineUser | null>(null);
  const [view, setView] = useState<"stats" | "dm">("stats");
  const [mainTab, setMainTab] = useState<"online" | "lobby">("online");
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(false);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const { setLobbyOpen, setActiveDmConversationId } = useMessageNotifications();

  useEffect(() => {
    setMounted(true);
    try {
      setPillDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const onOpenLobby = () => {
      setOpen(true);
      setSelected(null);
      setMainTab("lobby");
    };
    window.addEventListener("tycoon-open-lobby-chat", onOpenLobby);
    return () => window.removeEventListener("tycoon-open-lobby-chat", onOpenLobby);
  }, []);

  useEffect(() => {
    const lobbyVisible = open && !selected && mainTab === "lobby";
    setLobbyOpen(lobbyVisible);
    return () => setLobbyOpen(false);
  }, [open, selected, mainTab, setLobbyOpen]);

  useEffect(() => {
    if (view === "dm" && selected) {
      // conversation id unknown until panel opens — clear when leaving dm
      return () => setActiveDmConversationId(null);
    }
    setActiveDmConversationId(null);
  }, [view, selected, setActiveDmConversationId]);

  const allowed =
    forceShow ||
    canAccessMultiplayerPreview(username) ||
    canAccessMultiplayerPreview(guestUser?.username);

  const presenceAddress = useMemo(() => {
    if (address) return address;
    if (guestUser) return getGuestUserPlayAddress(guestUser) ?? guestUser.address ?? undefined;
    return undefined;
  }, [address, guestUser]);

  const { onlineUsers, onlineCount } = useOnlineUsers(presenceAddress, {
    enabled: allowed && !pillDismissed,
    userId: guestUser?.id,
    username: guestUser?.username ?? username ?? undefined,
  });

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setView("stats");
      setMainTab("online");
      setStats(null);
      setStatsError(false);
      setStatsLoading(false);
    }
  }, [open]);

  useEffect(() => {
    setView("stats");
  }, [selected]);

  const canDm =
    canAccessDirectMessages(username) || canAccessDirectMessages(guestUser?.username);

  useEffect(() => {
    if (!selected) {
      setStats(null);
      setStatsError(false);
      setStatsLoading(false);
      return;
    }

    const uname = selected.username?.trim();
    const addr = selected.address?.trim();
    if (!uname && !addr) {
      setStats(null);
      setStatsError(true);
      return;
    }

    let cancelled = false;
    setStatsLoading(true);
    setStatsError(false);
    setStats(null);

    void (async () => {
      try {
        const res = uname
          ? await apiClient.get(`/users/by-username/${encodeURIComponent(uname)}`, {
              chain: "CELO",
              period: "all",
            })
          : await apiClient.get(`/users/by-address/${addr}`, { chain: "CELO" });
        const body = res?.data as Record<string, unknown> | { data?: Record<string, unknown> } | null;
        const row =
          body && typeof body === "object" && "data" in body && body.data && typeof body.data === "object"
            ? (body.data as Record<string, unknown>)
            : (body as Record<string, unknown> | null);
        if (cancelled) return;
        const parsed = parseStatsRow(row, uname || shortAddress(addr));
        if (!parsed) {
          setStatsError(true);
          setStats(null);
        } else {
          setStats(parsed);
        }
      } catch {
        if (!cancelled) {
          setStatsError(true);
          setStats(null);
        }
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selected]);

  const dismissPill = () => {
    setOpen(false);
    setPillDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  };

  const closeSheet = () => setOpen(false);

  if (!allowed || pillDismissed) return null;

  const isPage = variant === "page";
  const selectedLabel =
    selected?.username?.trim() || shortAddress(selected?.address) || "Player";

  const sheet =
    mounted &&
    createPortal(
      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close online list"
              className="fixed inset-0 z-[1200] bg-black/75 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeSheet}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="who-online-sheet-title"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-[1201] max-h-[80dvh] overflow-y-auto rounded-t-2xl border-t-2 border-emerald-500/35 bg-gradient-to-b from-[#0c1c28] to-[#071018] pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_rgba(0,0,0,0.55)]"
            >
              <div className="mx-auto max-w-md px-4 pb-6 pt-3">
                <div className="mb-3 flex justify-center">
                  <div className="h-1.5 w-12 rounded-full bg-emerald-400/60" />
                </div>

                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex items-start gap-2">
                    {selected && (
                      <button
                        type="button"
                        onClick={() => {
                          if (view === "dm") setView("stats");
                          else setSelected(null);
                        }}
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/40 text-emerald-200 transition hover:bg-emerald-500/15"
                        aria-label="Back"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                    )}
                    <div className="min-w-0">
                      <h3
                        id="who-online-sheet-title"
                        className="font-orbitron text-sm font-bold uppercase tracking-wider text-emerald-300"
                      >
                        {selected ? selectedLabel : "Who's online"}
                      </h3>
                      <p className="mt-0.5 font-dmSans text-xs text-[#8aa4b0]">
                        {selected ? (
                          view === "dm" ? "Direct message" : "Player stats"
                        ) : mainTab === "lobby" ? (
                          "Public lobby · everyone can chat"
                        ) : (
                          <>
                            <span className="font-orbitron font-bold text-emerald-300">{onlineCount}</span>
                            {" "}
                            {onlineCount === 1 ? "player" : "players"} on Tycoon right now
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeSheet}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-emerald-400/50 bg-emerald-500/15 text-emerald-200 transition hover:border-emerald-300 hover:bg-emerald-500/25"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                </div>

                {!selected && (
                  <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-emerald-500/20 bg-black/20 p-1">
                    <button
                      type="button"
                      onClick={() => setMainTab("online")}
                      className={`min-h-10 rounded-lg font-orbitron text-[11px] font-bold uppercase tracking-wider transition ${
                        mainTab === "online"
                          ? "bg-emerald-500/25 text-emerald-200"
                          : "text-[#8aa4b0] hover:text-emerald-200"
                      }`}
                    >
                      Online
                    </button>
                    <button
                      type="button"
                      onClick={() => setMainTab("lobby")}
                      className={`min-h-10 rounded-lg font-orbitron text-[11px] font-bold uppercase tracking-wider transition ${
                        mainTab === "lobby"
                          ? "bg-cyan-500/25 text-cyan-200"
                          : "text-[#8aa4b0] hover:text-cyan-200"
                      }`}
                    >
                      Lobby
                    </button>
                  </div>
                )}

                {selected && view === "dm" && canDm ? (
                  <OnlineDmPanel
                    otherUserId={stats?.userId ?? selected.userId}
                    otherUsername={stats?.username ?? selected.username}
                    otherAddress={stats?.address ?? selected.address}
                    myUserId={guestUser?.id}
                    myUsername={guestUser?.username ?? username}
                  />
                ) : selected ? (
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-4">
                    {statsLoading ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-10">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
                        <p className="font-dmSans text-sm text-[#8aa4b0]">Loading stats…</p>
                      </div>
                    ) : statsError || !stats ? (
                      <div className="py-8 text-center">
                        <p className="font-dmSans text-sm text-[#e8f4f7]">Stats unavailable</p>
                        <p className="mt-1 font-dmSans text-xs text-[#8aa4b0]">
                          No profile found for this player yet.
                        </p>
                        {(selected.userId || selected.username || selected.address) && canDm && (
                          <button
                            type="button"
                            onClick={() => setView("dm")}
                            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-400/45 bg-emerald-500/15 px-4 font-orbitron text-xs font-bold uppercase tracking-wider text-emerald-200"
                          >
                            <MessageCircle className="h-4 w-4" />
                            Message anyway
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="mb-4 border-b border-emerald-500/20 pb-3">
                          <p className="font-orbitron text-lg font-bold text-[#e8f4f7] break-all">
                            {stats.username}
                          </p>
                          {stats.shortAddress !== "—" ? (
                            <p className="mt-1 font-mono text-xs text-[#8aa4b0]">{stats.shortAddress}</p>
                          ) : null}
                        </div>
                        <dl className="space-y-3 font-dmSans text-sm">
                          <div className="flex justify-between gap-3">
                            <dt className="text-[#8aa4b0]">Games played</dt>
                            <dd className="font-orbitron font-bold tabular-nums text-emerald-200">
                              {stats.gamesPlayed}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-[#8aa4b0]">Wins</dt>
                            <dd className="font-orbitron font-bold tabular-nums text-emerald-300">
                              {stats.gamesWon}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-[#8aa4b0]">Losses</dt>
                            <dd className="font-orbitron font-bold tabular-nums text-[#c8d8de]">
                              {stats.gamesLost}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-[#8aa4b0]">Win rate</dt>
                            <dd className="font-orbitron font-bold tabular-nums text-cyan-200">
                              {stats.winRate}%
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3 border-t border-emerald-500/15 pt-3">
                            <dt className="text-[#8aa4b0]">Total staked</dt>
                            <dd className="font-orbitron font-bold tabular-nums text-[#e8f4f7]">
                              {formatStakeOrEarned(stats.totalStaked)}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-[#8aa4b0]">Total earned</dt>
                            <dd className="font-orbitron font-bold tabular-nums text-emerald-200">
                              {formatStakeOrEarned(stats.totalEarned)}
                            </dd>
                          </div>
                        </dl>
                        {canDm && (
                          <button
                            type="button"
                            onClick={() => setView("dm")}
                            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-cyan-400/45 bg-cyan-500/15 font-orbitron text-xs font-bold uppercase tracking-wider text-cyan-100 transition hover:bg-cyan-500/25"
                          >
                            <MessageCircle className="h-4 w-4" />
                            Message
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ) : mainTab === "lobby" ? (
                  <OnlineLobbyPanel
                    address={presenceAddress}
                    userId={guestUser?.id}
                    username={guestUser?.username ?? username}
                  />
                ) : onlineUsers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-emerald-500/25 bg-emerald-950/10 px-4 py-8 text-center">
                    <Globe className="mx-auto mb-2 h-6 w-6 text-emerald-400/50" />
                    <p className="font-dmSans text-sm text-[#8aa4b0]">
                      No players showing yet. The list updates live as people open the app.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {onlineUsers.map((u, idx) => {
                      const label =
                        u.username?.trim() || shortAddress(u.address) || `Player ${idx + 1}`;
                      const canOpenStats = !!(u.username?.trim() || u.address?.trim());
                      return (
                        <li key={u.userId ?? u.address ?? `online-${idx}`}>
                          <button
                            type="button"
                            disabled={!canOpenStats}
                            onClick={() => setSelected(u)}
                            className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5 text-left transition hover:border-emerald-400/45 hover:bg-emerald-500/15 active:scale-[0.99] disabled:opacity-60"
                          >
                            <div className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-500/35 bg-[#0a1a26] font-orbitron text-sm font-bold text-emerald-300">
                              {(label[0] || "?").toUpperCase()}
                              <motion.span
                                className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#071018] bg-emerald-400"
                                animate={{ opacity: [1, 0.45, 1] }}
                                transition={{ repeat: Infinity, duration: 1.4 }}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-dmSans text-sm font-semibold text-[#e8f4f7]">
                                {label}
                              </p>
                              <p className="font-dmSans text-[11px] text-[#8aa4b0]">
                                {canOpenStats ? "Tap to view stats" : "Online on Tycoon"}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (view === "dm") setView("stats");
                    else if (selected) setSelected(null);
                    else closeSheet();
                  }}
                  className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 font-orbitron text-xs font-bold uppercase tracking-wider text-emerald-200 transition hover:bg-emerald-500/20"
                >
                  {view === "dm" ? "Back to stats" : selected ? "Back to list" : "Close"}
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
      <div
        className={`inline-flex items-center gap-1 ${
          isPage
            ? "rounded-full border border-[#00F0FF]/40 bg-[#00F0FF]/12 p-1 pl-1.5 shadow-[0_0_18px_rgba(0,240,255,0.18)]"
            : ""
        } ${className}`}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex min-h-9 items-center gap-1.5 font-dmSans text-[11px] text-[#9ad8e4] transition hover:text-[#00F0FF] active:scale-[0.98] ${
            isPage
              ? "rounded-full px-2.5 py-1.5"
              : "max-w-[9.5rem] rounded-full border border-[#00F0FF]/35 bg-[#00F0FF]/10 px-2.5 py-1.5 shadow-[0_0_14px_rgba(0,240,255,0.12)] hover:border-[#00F0FF]/55"
          }`}
          aria-label={`${onlineCount} players online — tap to view`}
        >
          <motion.span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
            animate={{ opacity: [1, 0.4, 1], scale: [1, 1.25, 1] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
          />
          <Globe className="h-3.5 w-3.5 shrink-0 text-[#00F0FF]" />
          <span className="truncate">
            <span className="font-orbitron font-bold text-[#00F0FF]">{onlineCount}</span>
            <span className="text-[#8aa4b0]"> online</span>
          </span>
        </button>

        {isPage && (
          <button
            type="button"
            onClick={dismissPill}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#00F0FF]/25 text-[#7ec8d4] transition hover:border-[#00F0FF]/50 hover:text-[#00F0FF]"
            aria-label="Hide online indicator"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        )}
      </div>

      {sheet}
    </>
  );
}
