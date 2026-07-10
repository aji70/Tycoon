"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Globe, X } from "lucide-react";
import { useAccount } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { getGuestUserPlayAddress } from "@/lib/minipayGuestFlow";
import { canAccessMultiplayerPreview } from "@/lib/featureAccess";

const DISMISS_KEY = "tycoon_who_is_online_pill_dismissed";

function shortAddress(addr?: string | null): string {
  if (!addr || addr.length < 10) return "Player";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
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

  useEffect(() => {
    setMounted(true);
    try {
      setPillDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

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

  const dismissPill = () => {
    setOpen(false);
    setPillDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  };

  if (!allowed || pillDismissed) return null;

  const isPage = variant === "page";

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
              onClick={() => setOpen(false)}
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
                  <div className="min-w-0">
                    <h3
                      id="who-online-sheet-title"
                      className="font-orbitron text-sm font-bold uppercase tracking-wider text-emerald-300"
                    >
                      Who&apos;s online
                    </h3>
                    <p className="mt-0.5 font-dmSans text-xs text-[#8aa4b0]">
                      <span className="font-orbitron font-bold text-emerald-300">{onlineCount}</span>
                      {" "}
                      {onlineCount === 1 ? "player" : "players"} on Tycoon right now
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-emerald-400/50 bg-emerald-500/15 text-emerald-200 transition hover:border-emerald-300 hover:bg-emerald-500/25"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                </div>

                {onlineUsers.length === 0 ? (
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
                      return (
                        <li
                          key={u.userId ?? u.address ?? `online-${idx}`}
                          className="flex min-h-14 items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5"
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
                            <p className="font-dmSans text-[11px] text-[#8aa4b0]">Online on Tycoon</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 font-orbitron text-xs font-bold uppercase tracking-wider text-emerald-200 transition hover:bg-emerald-500/20"
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
