"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { useAccount } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { getGuestUserPlayAddress } from "@/lib/minipayGuestFlow";
import OnlineLobbyPanel from "@/components/shared/OnlineLobbyPanel";
import { useMessageNotifications } from "@/context/MessageNotificationsContext";

type LobbyChatControlProps = {
  className?: string;
  /** When false, hide entirely (e.g. preview users already have Lobby inside Who's online). */
  enabled?: boolean;
  username?: string | null;
};

/**
 * General lobby chat for any signed-in player (not soft-launch gated).
 */
export default function LobbyChatControl({
  className = "",
  enabled = true,
  username,
}: LobbyChatControlProps) {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { address: appKitAddress, isConnected: appKitConnected } = useAppKitAccount();
  const address = wagmiAddress ?? appKitAddress;
  const isConnected = wagmiConnected || appKitConnected;
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const { setLobbyOpen } = useMessageNotifications();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("tycoon-open-lobby-chat", onOpen);
    return () => window.removeEventListener("tycoon-open-lobby-chat", onOpen);
  }, []);

  useEffect(() => {
    setLobbyOpen(open);
    return () => setLobbyOpen(false);
  }, [open, setLobbyOpen]);

  const presenceAddress = useMemo(() => {
    if (address) return address;
    if (guestUser) return getGuestUserPlayAddress(guestUser) ?? guestUser.address ?? undefined;
    return undefined;
  }, [address, guestUser]);

  const signedIn = !!(isConnected || guestUser);
  if (!enabled || !signedIn) return null;

  const sheet =
    mounted &&
    createPortal(
      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close lobby chat"
              className="fixed inset-0 z-[1200] bg-black/75 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="lobby-chat-title"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-[1201] max-h-[80dvh] overflow-y-auto rounded-t-2xl border-t-2 border-cyan-500/35 bg-gradient-to-b from-[#0c1c28] to-[#071018] pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_rgba(0,0,0,0.55)]"
            >
              <div className="mx-auto max-w-md px-4 pb-6 pt-3">
                <div className="mb-3 flex justify-center">
                  <div className="h-1.5 w-12 rounded-full bg-cyan-400/60" />
                </div>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3
                      id="lobby-chat-title"
                      className="font-orbitron text-sm font-bold uppercase tracking-wider text-cyan-300"
                    >
                      Lobby chat
                    </h3>
                    <p className="mt-0.5 font-dmSans text-xs text-[#8aa4b0]">
                      Public room · everyone can chat
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-cyan-400/50 bg-cyan-500/15 text-cyan-100"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                </div>

                <OnlineLobbyPanel
                  address={presenceAddress}
                  userId={guestUser?.id}
                  username={guestUser?.username ?? username}
                />

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/10 font-orbitron text-xs font-bold uppercase tracking-wider text-cyan-100"
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
        className={`inline-flex min-h-9 max-w-[9.5rem] items-center gap-1.5 rounded-full border border-[#00F0FF]/35 bg-[#00F0FF]/10 px-2.5 py-1.5 font-dmSans text-[11px] text-[#9ad8e4] shadow-[0_0_14px_rgba(0,240,255,0.12)] transition hover:border-[#00F0FF]/55 hover:text-[#00F0FF] active:scale-[0.98] ${className}`}
        aria-label="Open lobby chat"
      >
        <MessageCircle className="h-3.5 w-3.5 shrink-0 text-[#00F0FF]" />
        <span className="truncate font-orbitron font-bold text-[#00F0FF]">Lobby</span>
      </button>
      {sheet}
    </>
  );
}
