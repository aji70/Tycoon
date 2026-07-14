"use client";

import { useWriteContract } from '@/hooks/useTaggedWriteContract';

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Globe, Loader2, MessageCircle, Swords, X } from "lucide-react";
import { useAccount, useChainId, usePublicClient, useReadContract } from 'wagmi';
import { useAppKitAccount } from "@reown/appkit/react";
import { useOnlineUsers, type OnlineUser } from "@/hooks/useOnlineUsers";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { getGuestUserPlayAddress } from "@/lib/minipayGuestFlow";
import { canAccessDirectMessages, canAccessChallenges } from "@/lib/featureAccess";
import { apiClient } from "@/lib/api";
import OnlineDmPanel from "@/components/shared/OnlineDmPanel";
import OnlineLobbyPanel from "@/components/shared/OnlineLobbyPanel";
import { useMessageNotifications } from "@/context/MessageNotificationsContext";
import { presenceStatusLabel, resolvePresenceFromPath } from "@/lib/presenceStatus";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import {
  useGetUsername,
  useIsRegistered,
  useApprove,
  useRewardTokenAddresses,
} from "@/context/ContractProvider";
import { createSignedChallengeLobby } from "@/lib/createSignedChallengeLobby";
import { getContractErrorMessage } from "@/lib/utils/contractErrors";
import { isAddress, type Address } from "viem";
import Erc20Abi from "@/context/abi/ERC20abi.json";
import { TYCOON_CONTRACT_ADDRESSES, USDC_TOKEN_ADDRESS } from "@/constants/contracts";

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
  /** Resolved display username (guest / on-chain / backend). */
  username?: string | null;
  forceShow?: boolean;
  /**
   * `nav` — compact center pill (sheet portaled so it isn’t trapped by nav transforms).
   * `page` — larger chip with its own dismiss X (join room style).
   */
  variant?: "nav" | "page";
};

/**
 * Live global online count + sheet (Online list + public Lobby).
 * Available to all signed-in users. DMs / Challenge stay soft-launch gated.
 */
export default function WhoIsOnlineControl({
  className = "",
  username,
  forceShow = false,
  variant = "nav",
}: WhoIsOnlineControlProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { address: appKitAddress, isConnected: appKitConnected } = useAppKitAccount();
  const address = wagmiAddress ?? appKitAddress;
  const isConnected = wagmiConnected || appKitConnected;
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const safeAddress = address && isAddress(address) ? address : undefined;
  const { data: onChainUsername } = useGetUsername(safeAddress);
  const { data: isUserRegistered } = useIsRegistered(safeAddress);
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const presenceWhere = useMemo(
    () => resolvePresenceFromPath(pathname, searchParams?.get("gameCode")),
    [pathname, searchParams]
  );
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pillDismissed, setPillDismissed] = useState(false);
  const [selected, setSelected] = useState<OnlineUser | null>(null);
  const [view, setView] = useState<"stats" | "dm">("stats");
  const [mainTab, setMainTab] = useState<"online" | "lobby">("online");
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(false);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [challengeBusy, setChallengeBusy] = useState(false);
  const [stakePrompt, setStakePrompt] = useState<{
    opponentUserId: number;
    label: string;
  } | null>(null);
  const [stakeMode, setStakeMode] = useState<"free" | "staked">("free");
  const [stakeAmount, setStakeAmount] = useState(5);
  const { setLobbyOpen, setActiveDmConversationId } = useMessageNotifications();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[
    chainId as keyof typeof TYCOON_CONTRACT_ADDRESSES
  ] as Address | undefined;
  const { usdcAddress, usdtAddress } = useRewardTokenAddresses();
  const stakeTokenAddress =
    (usdcAddress as Address | undefined) ??
    (usdtAddress as Address | undefined) ??
    USDC_TOKEN_ADDRESS[chainId];
  const { approve: approveUSDC } = useApprove();
  const { data: stakeAllowance, refetch: refetchAllowance } = useReadContract({
    address: stakeTokenAddress,
    abi: Erc20Abi,
    functionName: "allowance",
    args: safeAddress && contractAddress ? [safeAddress, contractAddress] : undefined,
    query: { enabled: !!safeAddress && !!stakeTokenAddress && !!contractAddress },
  });

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
    forceShow || !!guestUser || isConnected || !!(username && String(username).trim());

  const presenceAddress = useMemo(() => {
    if (address) return address;
    if (guestUser) return getGuestUserPlayAddress(guestUser) ?? guestUser.address ?? undefined;
    return undefined;
  }, [address, guestUser]);

  const { onlineUsers, onlineCount } = useOnlineUsers(presenceAddress, {
    enabled: allowed && !pillDismissed,
    userId: guestUser?.id,
    username: guestUser?.username ?? username ?? undefined,
    status: presenceWhere.status,
    gameCode: presenceWhere.gameCode,
    registerPresence: false,
  });

  const openPlayerProfile = useCallback(
    (player: { userId?: number | null; username?: string | null; address?: string | null }) => {
      const uid = player.userId != null ? Number(player.userId) : null;
      const uname = player.username?.trim() || null;
      const addr = player.address?.trim() || null;
      if (uid == null && !uname && !addr) return;

      const match = onlineUsers.find((u) => {
        if (uid != null && u.userId != null && Number(u.userId) === uid) return true;
        if (uname && u.username && u.username.trim().toLowerCase() === uname.toLowerCase()) return true;
        if (addr && u.address && u.address.toLowerCase() === addr.toLowerCase()) return true;
        return false;
      });

      setOpen(true);
      setView("stats");
      setSelected(
        match ?? {
          userId: uid ?? undefined,
          username: uname,
          address: addr,
          status: null,
        }
      );
    },
    [onlineUsers]
  );

  useEffect(() => {
    const onOpenProfile = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as {
        userId?: number | null;
        username?: string | null;
        address?: string | null;
      } | null;
      if (!detail) return;
      openPlayerProfile(detail);
    };
    window.addEventListener("tycoon-open-player-profile", onOpenProfile);
    return () => window.removeEventListener("tycoon-open-player-profile", onOpenProfile);
  }, [openPlayerProfile]);

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
  const canChallenge =
    canAccessChallenges(username) || canAccessChallenges(guestUser?.username);

  const openStakePrompt = (opponentUserId?: number | null, label?: string) => {
    if (!opponentUserId) return;
    if (guestUser?.id != null && Number(guestUser.id) === Number(opponentUserId)) {
      toast.error("You can't challenge yourself");
      return;
    }
    if (selected?.status === "game") {
      toast.error("That player is on the board and can't receive challenges");
      return;
    }
    if (!safeAddress) {
      toast.error("Connect your wallet to challenge — you'll sign create game");
      return;
    }
    setStakeMode("free");
    setStakeAmount(5);
    setStakePrompt({
      opponentUserId,
      label: label || "Player",
    });
  };

  const sendChallenge = async (opponentUserId?: number | null, stake = 0) => {
    if (!opponentUserId || challengeBusy) return;
    if (guestUser?.id != null && Number(guestUser.id) === Number(opponentUserId)) {
      toast.error("You can't challenge yourself");
      return;
    }
    if (!safeAddress) {
      toast.error("Connect your wallet to challenge — you'll sign create game");
      return;
    }
    if (!isUserRegistered) {
      toast.error("Register on-chain on the home page before challenging");
      return;
    }
    const creatorUsername =
      (typeof onChainUsername === "string" && onChainUsername.trim()) ||
      guestUser?.username?.trim() ||
      username?.trim() ||
      "";
    if (!creatorUsername) {
      toast.error("Set a username before challenging");
      return;
    }
    if (!publicClient) {
      toast.error("Network unavailable");
      return;
    }

    setChallengeBusy(true);
    setStakePrompt(null);
    const toastId = toast.loading(
      stake > 0 ? `Sign staked challenge (${stake} USDT)…` : "Sign create game in your wallet…"
    );
    try {
      const { code, contractGameId } = await createSignedChallengeLobby({
        address: safeAddress,
        username: creatorUsername,
        chainId,
        publicClient,
        writeContractAsync: writeContractAsync as never,
        stake,
        stakeTokenAddress: stakeTokenAddress ?? null,
        approveUsdc: async (token, spender, amount) => {
          toast.update(toastId, { render: "Approve USDT…", isLoading: true });
          await approveUSDC(token, spender, amount);
        },
        readAllowance: async () => {
          const r = await refetchAllowance();
          if (r.data != null) return BigInt(r.data.toString());
          if (stakeAllowance != null) return BigInt(stakeAllowance.toString());
          return 0n;
        },
      });

      toast.update(toastId, { render: "Sending challenge…", type: "default", isLoading: true });
      const res = await apiClient.post(
        "/challenges",
        {
          opponentId: opponentUserId,
          gameCode: code,
          contractGameId,
          stake,
          chain: "CELO",
          address: safeAddress,
        },
        { timeout: 60000 }
      );
      const body = res?.data as {
        data?: { game?: { code?: string }; challenge?: { gameCode?: string } };
        message?: string;
        success?: boolean;
      };
      if (body && body.success === false) {
        throw new Error(body.message || "Challenge failed");
      }
      const gameCode =
        body?.data?.game?.code || body?.data?.challenge?.gameCode || code;
      toast.update(toastId, {
        render: "Challenge sent — waiting in lobby",
        type: "success",
        isLoading: false,
        autoClose: 2500,
      });
      setOpen(false);
      setSelected(null);
      if (gameCode) {
        router.push(`/game-waiting-3d?gameCode=${encodeURIComponent(gameCode)}`);
      }
    } catch (err: unknown) {
      const msg =
        getContractErrorMessage(err, "") ||
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as Error)?.message ||
        "Challenge failed";
      toast.update(toastId, { render: msg, type: "error", isLoading: false, autoClose: 8000 });
    } finally {
      setChallengeBusy(false);
    }
  };

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

  const myUsername = (guestUser?.username ?? username ?? "").trim().toLowerCase();
  const myAddress = (presenceAddress ?? "").trim().toLowerCase();
  const myUserId = guestUser?.id ?? null;

  const isSelfUser = (u: {
    userId?: number | null;
    username?: string | null;
    address?: string | null;
  }) => {
    if (myUserId != null && u.userId != null && Number(u.userId) === Number(myUserId)) return true;
    if (myUsername && u.username?.trim() && u.username.trim().toLowerCase() === myUsername) return true;
    if (myAddress && u.address?.trim() && u.address.trim().toLowerCase() === myAddress) return true;
    return false;
  };

  const isPage = variant === "page";
  const selectedIsSelf = selected ? isSelfUser(selected) : false;
  const selectedLabel = selectedIsSelf
    ? "You"
    : selected?.username?.trim() || shortAddress(selected?.address) || "Player";
  const canChallengeSelected =
    canChallenge &&
    !selectedIsSelf &&
    !!(selected?.userId || stats?.userId) &&
    !!selected?.status &&
    selected.status !== "game";
  const selectedOffline = !!(selected && !selectedIsSelf && !selected.status);
  const selectedInGame = !!(selected && !selectedIsSelf && selected.status === "game");

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
                        {canChallengeSelected && (
                          <button
                            type="button"
                            disabled={challengeBusy}
                            onClick={() =>
                              openStakePrompt(
                                selected.userId,
                                selected.username?.trim() || shortAddress(selected.address)
                              )
                            }
                            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-400/45 bg-rose-500/15 px-4 font-orbitron text-xs font-bold uppercase tracking-wider text-rose-200 disabled:opacity-50"
                          >
                            {challengeBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Swords className="h-4 w-4" />
                            )}
                            Challenge
                          </button>
                        )}
                        {canChallenge && selected.userId && selectedInGame ? (
                          <p className="mt-3 font-dmSans text-xs text-amber-200/90">
                            In a game — can&apos;t challenge right now
                          </p>
                        ) : null}
                        {canChallenge && selected.userId && selectedOffline ? (
                          <p className="mt-3 font-dmSans text-xs text-[#8aa4b0]">
                            Offline — challenge when they&apos;re online
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <div className="mb-4 border-b border-emerald-500/20 pb-3">
                          <p className="font-orbitron text-lg font-bold text-[#e8f4f7] break-all">
                            {selectedIsSelf ? "You" : stats.username}
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
                        {canDm && !selectedIsSelf && (
                          <button
                            type="button"
                            onClick={() => setView("dm")}
                            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-cyan-400/45 bg-cyan-500/15 font-orbitron text-xs font-bold uppercase tracking-wider text-cyan-100 transition hover:bg-cyan-500/25"
                          >
                            <MessageCircle className="h-4 w-4" />
                            Message
                          </button>
                        )}
                        {canChallengeSelected && (
                          <button
                            type="button"
                            disabled={challengeBusy}
                            onClick={() =>
                              openStakePrompt(
                                stats.userId ?? selected.userId,
                                stats.username || selected.username?.trim() || shortAddress(selected.address)
                              )
                            }
                            className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-rose-400/45 bg-rose-500/15 font-orbitron text-xs font-bold uppercase tracking-wider text-rose-100 transition hover:bg-rose-500/25 disabled:opacity-50"
                          >
                            {challengeBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Swords className="h-4 w-4" />
                            )}
                            Challenge
                          </button>
                        )}
                        {canChallenge && selectedInGame ? (
                          <p className="mt-3 text-center font-dmSans text-xs text-amber-200/90">
                            In a game — can&apos;t challenge right now
                          </p>
                        ) : null}
                        {canChallenge && selectedOffline ? (
                          <p className="mt-3 text-center font-dmSans text-xs text-[#8aa4b0]">
                            Offline — challenge when they&apos;re online
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : mainTab === "lobby" ? (
                  <OnlineLobbyPanel
                    address={presenceAddress}
                    userId={guestUser?.id}
                    username={guestUser?.username ?? username}
                    onPlayerClick={openPlayerProfile}
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
                      const self = isSelfUser(u);
                      const label = self
                        ? "You"
                        : u.username?.trim() || shortAddress(u.address) || `Player ${idx + 1}`;
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
                              {(self ? "Y" : label[0] || "?").toUpperCase()}
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
                              <p
                                className={`font-dmSans text-[11px] ${
                                  u.status === "game"
                                    ? "text-amber-300"
                                    : u.status === "waiting"
                                      ? "text-cyan-300"
                                      : "text-[#8aa4b0]"
                                }`}
                              >
                                {presenceStatusLabel(u.status, u.gameCode)}
                                {canOpenStats ? " · tap for stats" : ""}
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

              {stakePrompt ? (
                <div
                  className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/60 p-3 sm:items-center"
                  onClick={() => {
                    if (!challengeBusy) setStakePrompt(null);
                  }}
                >
                  <div
                    className="w-full max-w-sm rounded-2xl border border-rose-400/30 bg-[#0c1520] p-4 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="font-orbitron text-sm font-bold uppercase tracking-wider text-rose-200">
                      Challenge {stakePrompt.label}
                    </p>
                    <p className="mt-1 font-dmSans text-xs text-[#8aa4b0]">
                      Free games need no stake. Staked games lock cUSD for both players.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={challengeBusy}
                        onClick={() => void sendChallenge(stakePrompt.opponentUserId, 0)}
                        className="rounded-xl border border-white/15 bg-white/5 px-3 py-3 font-orbitron text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10 disabled:opacity-50"
                      >
                        Free
                      </button>
                      <button
                        type="button"
                        disabled={challengeBusy}
                        onClick={() => setStakeMode("staked")}
                        className={`rounded-xl border px-3 py-3 font-orbitron text-xs font-bold uppercase tracking-wider disabled:opacity-50 ${
                          stakeMode === "staked"
                            ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                            : "border-white/15 bg-white/5 text-white hover:bg-white/10"
                        }`}
                      >
                        Staked
                      </button>
                    </div>
                    {stakeMode === "staked" ? (
                      <div className="mt-3 space-y-2">
                        <label className="block font-dmSans text-[11px] font-medium text-[#8aa4b0]">
                          Stake amount (cUSD)
                          <input
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={stakeAmount}
                            onChange={(e) => setStakeAmount(Number(e.target.value) || 0)}
                            className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-dmSans text-sm text-white outline-none focus:border-amber-400/50"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={challengeBusy || !(stakeAmount > 0)}
                          onClick={() => {
                            if (!(stakeAmount > 0)) {
                              toast.error("Enter a valid stake amount");
                              return;
                            }
                            void sendChallenge(stakePrompt.opponentUserId, stakeAmount);
                          }}
                          className="flex min-h-11 w-full items-center justify-center rounded-xl bg-amber-500/90 font-orbitron text-xs font-bold uppercase tracking-wider text-black disabled:opacity-50"
                        >
                          {challengeBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            `Send ${stakeAmount} cUSD challenge`
                          )}
                        </button>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      disabled={challengeBusy}
                      onClick={() => {
                        setStakePrompt(null);
                        setStakeMode("free");
                      }}
                      className="mt-3 w-full rounded-lg px-3 py-2 font-dmSans text-xs text-[#8aa4b0] hover:bg-white/5 hover:text-white/80"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
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
          className={`inline-flex min-h-9 max-w-full items-center gap-1.5 font-dmSans text-[11px] text-[#9ad8e4] transition hover:text-[#00F0FF] active:scale-[0.98] ${
            isPage
              ? "rounded-full px-2.5 py-1.5"
              : "rounded-full border border-[#00F0FF]/35 bg-[#00F0FF]/10 px-2 py-1.5 shadow-[0_0_14px_rgba(0,240,255,0.12)] hover:border-[#00F0FF]/55 sm:px-2.5"
          }`}
          aria-label={`${onlineCount} players online — tap to view`}
        >
          <motion.span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
            animate={{ opacity: [1, 0.4, 1], scale: [1, 1.25, 1] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
          />
          <Globe className="h-3.5 w-3.5 shrink-0 text-[#00F0FF]" />
          <span className="min-w-0 truncate">
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
