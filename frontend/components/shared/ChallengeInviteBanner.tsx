"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Swords, X } from "lucide-react";
import { useAccount } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import {
  useMessageNotifications,
  type ChallengeItem,
} from "@/context/MessageNotificationsContext";
import { apiClient } from "@/lib/api";
import { canAccessChallenges } from "@/lib/featureAccess";
import { getGuestUserPlayAddress } from "@/lib/minipayGuestFlow";
import { resolvePresenceFromPath } from "@/lib/presenceStatus";
import { toast } from "react-toastify";

/**
 * Full-width challenge invite banner. Closing / dismissing rejects the challenge
 * and cancels the lobby game. Hidden while the local player is on the board.
 */
export default function ChallengeInviteBanner({ username }: { username?: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const { challengeItems, dismissChallenge, refreshChallenges } = useMessageNotifications();

  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rejectingRef = useRef<Set<number>>(new Set());

  const presence = resolvePresenceFromPath(pathname, searchParams?.get("gameCode"));
  const onBoard = presence.status === "game";
  const active: ChallengeItem | null =
    canChallenge && !onBoard && challengeItems.length > 0 ? challengeItems[0] : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!onBoard || !canChallenge || challengeItems.length === 0) return;
    const addressPayload = playAddress ? { address: playAddress, chain: "CELO" } : {};
    for (const c of challengeItems) {
      if (rejectingRef.current.has(c.id)) continue;
      rejectingRef.current.add(c.id);
      void (async () => {
        try {
          await apiClient.post(`/challenges/${c.id}/reject`, addressPayload);
        } catch {
          // ignore
        } finally {
          dismissChallenge(c.id);
          rejectingRef.current.delete(c.id);
        }
      })();
    }
  }, [onBoard, canChallenge, challengeItems, playAddress, dismissChallenge]);

  const reject = async (challenge: ChallengeItem, silent = false) => {
    if (busy || rejectingRef.current.has(challenge.id)) return;
    setBusy("reject");
    setError(null);
    rejectingRef.current.add(challenge.id);
    try {
      await apiClient.post(
        `/challenges/${challenge.id}/reject`,
        playAddress ? { address: playAddress, chain: "CELO" } : {}
      );
      dismissChallenge(challenge.id);
      if (!silent) toast.info("Challenge declined — lobby cancelled");
      void refreshChallenges();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as Error)?.message ||
        "Could not decline challenge";
      setError(msg);
      dismissChallenge(challenge.id);
    } finally {
      rejectingRef.current.delete(challenge.id);
      setBusy(null);
    }
  };

  const accept = async (challenge: ChallengeItem) => {
    if (busy) return;
    setBusy("accept");
    setError(null);
    try {
      const res = await apiClient.post(
        `/challenges/${challenge.id}/accept`,
        playAddress ? { address: playAddress, chain: "CELO" } : {},
        { timeout: 120000 }
      );
      const body = res?.data as { data?: { gameCode?: string } } | undefined;
      const code = body?.data?.gameCode || challenge.gameCode || "";
      dismissChallenge(challenge.id);
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
      setError(msg);
    } finally {
      setBusy(null);
    }
  };

  if (!mounted || !(isConnected || guestUser)) return null;

  return createPortal(
    <AnimatePresence>
      {active ? (
        <motion.div
          key={active.id}
          role="dialog"
          aria-modal="true"
          aria-label="Challenge invite"
          initial={{ y: -120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 320 }}
          className="fixed left-0 right-0 top-0 z-[1400] px-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
        >
          <div className="mx-auto max-w-lg overflow-hidden rounded-2xl border-2 border-rose-400/50 bg-gradient-to-b from-[#1a0c14] to-[#0a1018] shadow-[0_12px_40px_rgba(0,0,0,0.65)]">
            <div className="flex items-start gap-3 px-4 pb-3 pt-3.5">
              <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-400/45 bg-rose-500/20 text-rose-100">
                <Swords className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-orbitron text-[11px] font-bold uppercase tracking-wider text-rose-200">
                  Challenge
                </p>
                <p className="mt-0.5 truncate font-dmSans text-base font-semibold text-[#e8f4f7]">
                  {active.challengerUsername || "A player"} challenged you
                </p>
                <p className="mt-0.5 font-dmSans text-xs text-[#8aa4b0]">
                  {active.stake != null && Number(active.stake) > 0
                    ? `${Number(active.stake)} cUSD stake · lobby ${active.gameCode}`
                    : `Free match · lobby ${active.gameCode}`}
                </p>
                {error ? <p className="mt-1 font-dmSans text-xs text-rose-300">{error}</p> : null}
              </div>
              <button
                type="button"
                disabled={!!busy}
                aria-label="Decline challenge"
                onClick={() => void reject(active)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                {busy === "reject" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-5 w-5" strokeWidth={2.5} />
                )}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-white/10 px-4 py-3">
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void reject(active)}
                className="flex min-h-12 items-center justify-center rounded-xl border border-white/20 bg-white/5 font-orbitron text-xs font-bold uppercase tracking-wider text-[#e8f4f7] disabled:opacity-50"
              >
                {busy === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Decline"}
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void accept(active)}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-emerald-400/50 bg-emerald-500/25 font-orbitron text-xs font-bold uppercase tracking-wider text-emerald-100 disabled:opacity-50"
              >
                {busy === "accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept"}
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
