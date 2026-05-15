"use client";

import React, { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useWaitingRoom } from "./useWaitingRoom";
import GameRoomLoading from "./game-room-loading";
import { Copy, Scan } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { ScanlineOverlay } from "@/components/hero/ScanlineOverlay";
import { ParticleBackground } from "@/components/hero/ParticleBackground";
import { WARoomLaunchButton } from "@/components/game-setup/WARoomLaunchButton";

const REDIRECT_TO_BOARD = "/board-3d-multi-mobile";
const REDIRECT_TO_BOARD_MOBILE = "/board-3d-multi-mobile";
const COPY_FEEDBACK_MS = 2000;

function ReticleCorners() {
  const corner =
    "absolute w-5 h-5 border-cyan-400/90 pointer-events-none";
  return (
    <>
      <motion.span
        className={`${corner} top-2 left-2 border-t-2 border-l-2`}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ repeat: Infinity, duration: 2 }}
      />
      <motion.span
        className={`${corner} top-2 right-2 border-t-2 border-r-2`}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
      />
      <motion.span
        className={`${corner} bottom-2 left-2 border-b-2 border-l-2`}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ repeat: Infinity, duration: 2, delay: 1 }}
      />
      <motion.span
        className={`${corner} bottom-2 right-2 border-b-2 border-r-2`}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ repeat: Infinity, duration: 2, delay: 1.5 }}
      />
    </>
  );
}

function SectionLabel({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <p className="flex items-center justify-center gap-1.5 text-[10px] font-orbitron font-bold text-cyan-400/80 tracking-[0.2em] uppercase mb-3">
      {icon}
      {children}
    </p>
  );
}

/**
 * 3D game waiting room. Uses same useWaitingRoom logic; redirects to board-3d-multi when game starts.
 */
export default function GameWaiting3DLobby(): React.ReactElement {
  const {
    router,
    gameCode,
    game,
    loading,
    contractGameLoading,
    error,
    playerSymbol,
    setPlayerSymbol,
    availableSymbols,
    isJoined,
    actionLoading,
    approvePending,
    approveConfirming,
    playersJoined,
    maxPlayers,
    handleJoinGame,
    handleLeaveGame,
    handleGoHome,
    guestCannotJoinStaked,
    symbols,
    stakePerPlayer,
    isJoining,
    joinError,
    contractGameError,
  } = useWaitingRoom({ redirectToBoard: REDIRECT_TO_BOARD, redirectToBoardMobile: REDIRECT_TO_BOARD_MOBILE });

  const gameUrl3d = useMemo(() => {
    if (!gameCode) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/game-waiting-3d?gameCode=${encodeURIComponent(gameCode)}`;
  }, [gameCode]);

  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const handleCopyLink = useCallback(async () => {
    if (!gameUrl3d) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(gameUrl3d);
      } else {
        const el = document.createElement("textarea");
        el.value = gameUrl3d;
        el.setAttribute("readonly", "");
        el.style.position = "absolute";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopySuccess("Link copied!");
      window.setTimeout(() => setCopySuccess(null), COPY_FEEDBACK_MS);
    } catch {
      setCopySuccess("Copy failed");
    }
  }, [gameUrl3d]);

  const joinLoading = actionLoading || isJoining || approvePending || approveConfirming;
  const slotsOpen = playersJoined < maxPlayers;

  if (loading || contractGameLoading) {
    return <GameRoomLoading variant="waiting" />;
  }

  if (error || !game) {
    return (
      <section className="relative w-full min-h-[calc(100dvh-87px)] flex flex-col items-center justify-center bg-[#010F10] px-4 overflow-hidden">
        <ScanlineOverlay />
        <p className="relative z-20 text-red-400 text-center mb-4">{error ?? "Game not found"}</p>
        <button
          type="button"
          onClick={() =>
            gameCode
              ? router.push(`/game-waiting-3d?gameCode=${encodeURIComponent(gameCode)}`)
              : handleGoHome()
          }
          className="relative z-20 px-4 py-2 rounded-full border border-cyan-500/50 bg-cyan-500/10 text-cyan-400 text-sm font-orbitron"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={handleGoHome}
          className="relative z-20 mt-4 px-4 py-2 rounded-full border border-slate-600 bg-slate-800/80 text-slate-200 text-sm"
        >
          🏠 HOME
        </button>
      </section>
    );
  }

  return (
    <section className="relative w-full min-h-[calc(100dvh-87px)] bg-[#010F10] flex flex-col items-center justify-center p-4 overflow-hidden">
      <ParticleBackground />
      <ScanlineOverlay />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative z-20 w-full max-w-md"
      >
        {/* Header */}
        <motion.div
          className="text-center mb-6"
          animate={{ textShadow: ["0 0 20px rgba(0,240,255,0.4)", "0 0 40px rgba(0,240,255,0.8)", "0 0 20px rgba(0,240,255,0.4)"] }}
          transition={{ repeat: Infinity, duration: 2.5 }}
        >
          <motion.div
            className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.span
              className="w-2 h-2 rounded-full bg-emerald-400"
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
            />
            <span className="text-[10px] font-orbitron font-bold text-emerald-400 tracking-widest">LIVE</span>
          </motion.div>
          <h1 className="text-3xl sm:text-4xl font-black font-orbitron text-cyan-300 tracking-wider">
            ⚔️ WAR ROOM
          </h1>
          <p className="mt-2 text-slate-400 text-xs sm:text-sm font-dmSans">
            Waiting for players · Game starts when all seats are filled
          </p>
        </motion.div>

        <div className="rounded-2xl border border-cyan-500/30 bg-slate-950/80 backdrop-blur-md p-5 sm:p-6 shadow-[0_0_40px_rgba(0,240,255,0.08)]">
          {/* QR + access code */}
          <div className="mb-6 p-4 rounded-xl bg-[#0a1516]/90 border border-cyan-500/40 shadow-[inset_0_0_30px_rgba(0,240,255,0.06),0_0_20px_rgba(0,240,255,0.12)]">
            <SectionLabel icon={<Scan className="w-3.5 h-3.5" />}>Scan to join battle</SectionLabel>
            <motion.div
              className="relative flex flex-col items-center gap-4"
              animate={{ boxShadow: ["0 0 15px rgba(0,240,255,0.15)", "0 0 28px rgba(0,240,255,0.35)", "0 0 15px rgba(0,240,255,0.15)"] }}
              transition={{ repeat: Infinity, duration: 3 }}
            >
              <ReticleCorners />
              {gameUrl3d ? (
                <motion.div
                  className="p-2 rounded-lg bg-[#0E282A] border border-cyan-500/50"
                  whileHover={{ scale: 1.02 }}
                >
                  <QRCodeSVG
                    value={gameUrl3d}
                    size={152}
                    level="M"
                    bgColor="#0E282A"
                    fgColor="#00F0FF"
                    marginSize={1}
                  />
                </motion.div>
              ) : (
                <div className="w-[152px] h-[152px] rounded-lg bg-slate-800 animate-pulse" />
              )}
              <div className="text-center">
                <p className="text-[10px] font-orbitron font-bold text-cyan-500/70 tracking-[0.25em] uppercase mb-1">
                  Access code
                </p>
                <p
                  className="font-mono text-2xl sm:text-3xl font-bold text-cyan-300 tracking-[0.35em]"
                  style={{ textShadow: "0 0 20px rgba(0,240,255,0.5)" }}
                >
                  {gameCode}
                </p>
              </div>
            </motion.div>
          </div>

          {/* Share link */}
          <motion.div className="mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            <SectionLabel>Share battle link</SectionLabel>
            <div className="flex items-stretch gap-2">
              <input
                type="text"
                readOnly
                value={gameUrl3d}
                aria-label="Join game URL"
                className="flex-1 min-w-0 bg-[#050a0b] border border-cyan-500/25 rounded-lg px-3 py-2.5 text-cyan-200/90 text-xs font-mono truncate focus:outline-none focus:ring-1 focus:ring-cyan-500/50 shadow-inner"
              />
              <motion.button
                type="button"
                onClick={handleCopyLink}
                disabled={actionLoading || !gameUrl3d}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="shrink-0 px-3 rounded-lg border-2 border-cyan-500 bg-cyan-500/10 text-cyan-300 hover:shadow-[0_0_16px_rgba(0,240,255,0.5)] disabled:opacity-40 disabled:pointer-events-none transition-shadow"
                title="Copy link"
              >
                <Copy className="w-5 h-5" />
              </motion.button>
            </motion.div>
            {copySuccess && (
              <p className="text-emerald-400 text-xs text-center mt-2 font-orbitron">{copySuccess}</p>
            )}
          </motion.div>

          {/* Combatants */}
          <motion.div className="mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
            <SectionLabel>Combatants</SectionLabel>
            <p className="text-center text-sm font-orbitron text-slate-300 mb-3">
              <span className="text-cyan-400 font-bold">{playersJoined}</span>
              <span className="text-slate-500"> / </span>
              <span className="text-slate-400">{maxPlayers}</span>
              <span className="text-slate-500 text-xs ml-1">players</span>
            </p>
            <motion.div className="flex flex-wrap justify-center gap-3 mb-3">
              {Array.from({ length: maxPlayers }).map((_, i) => {
                const p = game.players?.[i];
                const sym = p ? symbols.find((s) => s.value === p.symbol) : null;
                const filled = !!p;

                if (filled) {
                  return (
                    <motion.div
                      key={i}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-16 h-16 rounded-xl border-2 border-cyan-400 bg-cyan-500/15 flex flex-col items-center justify-center shadow-[0_0_16px_rgba(0,240,255,0.35)]"
                    >
                      <span className="text-2xl">{sym?.emoji ?? "⚔️"}</span>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={i}
                    className="w-16 h-16 rounded-xl border-2 border-dashed border-amber-500/50 bg-amber-950/20 flex items-center justify-center"
                    animate={{
                      borderColor: [
                        "rgba(245, 158, 11, 0.35)",
                        "rgba(245, 158, 11, 0.85)",
                        "rgba(245, 158, 11, 0.35)",
                      ],
                    }}
                    transition={{ repeat: Infinity, duration: 1.8 }}
                  >
                    <span className="text-[8px] font-orbitron font-bold text-amber-400/90 text-center leading-tight px-1">
                      WAITING…
                    </span>
                  </motion.div>
                );
              })}
            </motion.div>
            {slotsOpen && (
              <p className="flex items-center justify-center gap-2 text-xs text-amber-400/80 font-dmSans">
                <motion.span
                  className="w-1.5 h-1.5 rounded-full bg-amber-400"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                />
                Waiting for opponent to join…
              </p>
            )}
          </motion.div>

          {/* Join: piece + enter battle */}
          {!isJoined && game.players.length < maxPlayers && (
            <motion.div
              className="space-y-4 mb-6"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <SectionLabel>Select your piece</SectionLabel>
              <motion.div className="overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
                <div className="flex gap-2 min-w-min">
                  {availableSymbols.map((piece, idx) => {
                    const selected = playerSymbol?.value === piece.value;
                    return (
                      <motion.button
                        key={piece.value}
                        type="button"
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.04 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setPlayerSymbol(piece)}
                        className={`relative flex-shrink-0 w-[4.5rem] h-20 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
                          selected
                            ? "border-cyan-400 bg-cyan-500/20 shadow-[0_0_20px_rgba(0,240,255,0.45)]"
                            : "border-cyan-500/25 bg-slate-900/60 hover:border-cyan-400/50"
                        }`}
                      >
                        <span className="text-2xl mb-0.5">{piece.emoji}</span>
                        <span className="text-[8px] font-orbitron font-bold text-cyan-300/90 uppercase text-center leading-tight px-0.5">
                          {piece.name}
                        </span>
                        {selected && (
                          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center text-[10px] text-black font-bold shadow-lg shadow-cyan-500/60">
                            ✓
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
              {guestCannotJoinStaked && (
                <p className="text-amber-400 text-sm text-center">
                  Connect a wallet to join this staked game.
                </p>
              )}
              <WARoomLaunchButton
                onClick={handleJoinGame}
                disabled={
                  !playerSymbol ||
                  joinLoading ||
                  guestCannotJoinStaked
                }
                isSubmitting={joinLoading}
                approvePending={approvePending}
                approveConfirming={approveConfirming}
                canCreate={!guestCannotJoinStaked}
                text="ENTER BATTLE"
              />
            </motion.div>
          )}

          {isJoined && game.players.length < maxPlayers && (
            <button
              type="button"
              onClick={handleLeaveGame}
              disabled={actionLoading}
              className="w-full py-2.5 rounded-xl border border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-50 mb-6 transition font-orbitron text-sm tracking-wide"
            >
              {actionLoading ? "Leaving…" : "Leave war room"}
            </button>
          )}

          {stakePerPlayer > BigInt(0) && (
            <p className="text-amber-400/90 text-sm text-center mb-4 font-orbitron">
              Stake: {Number(stakePerPlayer) / 1e6} USDC
            </p>
          )}

          {(error || guestCannotJoinStaked || joinError || contractGameError) && (
            <p className="text-red-400 text-sm text-center mb-4 rounded-lg bg-red-900/20 border border-red-500/30 px-3 py-2">
              {error ??
                (guestCannotJoinStaked ? "Connect a wallet to join this staked game." : null) ??
                joinError?.message ??
                contractGameError?.message ??
                "Something went wrong"}
            </p>
          )}

          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleGoHome}
              className="px-4 py-2 rounded-full border border-slate-600/80 bg-slate-900/80 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300 text-xs font-orbitron tracking-wide transition"
            >
              🏠 HOME
            </button>
            <a
              href="/join-room-3d"
              className="px-4 py-2 rounded-full border border-cyan-500/30 bg-cyan-500/5 text-cyan-400/90 hover:border-cyan-400/60 hover:text-cyan-300 text-xs font-orbitron tracking-wide transition"
            >
              JOIN ANOTHER
            </a>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
