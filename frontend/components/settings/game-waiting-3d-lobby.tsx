"use client";

import React from "react";
import { useWaitingRoom } from "./useWaitingRoom";
import GameRoomLoading from "./game-room-loading";
import { Copy, Home, Users } from "lucide-react";

const REDIRECT_TO_BOARD = "/board-3d-multi";

/**
 * Minimal 3D game waiting room. New file – does not edit the main game-waiting.
 * Uses same useWaitingRoom logic; redirects to board-3d-multi when game starts.
 */
export default function GameWaiting3DLobby(): React.ReactElement {
  const {
    router,
    gameCode,
    game,
    loading,
    contractGameLoading,
    error,
    setError,
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
    handleCopyLink,
    copySuccess,
    guestCannotJoinStaked,
    getPlayerSymbolData,
    symbols,
    stakePerPlayer,
    isJoining,
    joinError,
    contractGameError,
  } = useWaitingRoom({ redirectToBoard: REDIRECT_TO_BOARD });

  if (loading || contractGameLoading) {
    return <GameRoomLoading variant="waiting" />;
  }

  if (error || !game) {
    return (
      <section className="w-full min-h-[calc(100dvh-87px)] flex flex-col items-center justify-center bg-[#010F10] px-4">
        <p className="text-red-400 text-center mb-4">{error ?? "Game not found"}</p>
        <button
          type="button"
          onClick={() => gameCode ? router.push(`/game-waiting-3d?gameCode=${encodeURIComponent(gameCode)}`) : handleGoHome()}
          className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={handleGoHome}
          className="mt-4 px-4 py-2 rounded-lg bg-slate-600 text-slate-200"
        >
          Home
        </button>
      </section>
    );
  }

  return (
    <section className="w-full min-h-[calc(100dvh-87px)] bg-[#010F10] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-cyan-500/40 bg-slate-900/90 p-6 shadow-xl">
        <h1 className="text-xl font-bold text-cyan-400 text-center mb-1 tracking-wide">
          3D Lobby
        </h1>
        <p className="text-slate-500 text-sm text-center mb-6">
          When everyone is in, the game starts and you’ll open the 3D board.
        </p>

        {/* Code + copy */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="font-mono text-2xl font-bold text-cyan-300 tracking-widest">
            {gameCode}
          </span>
          <button
            type="button"
            onClick={handleCopyLink}
            disabled={actionLoading}
            className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition"
            title="Copy link"
          >
            <Copy className="w-5 h-5" />
          </button>
        </div>
        {copySuccess && (
          <p className="text-emerald-400 text-sm text-center mb-4">{copySuccess}</p>
        )}

        {/* Players */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <Users className="w-5 h-5 text-cyan-400" />
          <span className="text-slate-200 font-semibold">
            {playersJoined} / {maxPlayers} players
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {Array.from({ length: maxPlayers }).map((_, i) => {
            const p = game.players?.[i];
            const sym = p ? symbols.find((s) => s.value === p.symbol) : null;
            return (
              <div
                key={i}
                className="w-12 h-12 rounded-xl border border-slate-600 bg-slate-800 flex items-center justify-center text-2xl"
              >
                {sym?.emoji ?? "—"}
              </div>
            );
          })}
        </div>

        {/* Join: symbol + button */}
        {!isJoined && game.players.length < maxPlayers && (
          <div className="space-y-4 mb-6">
            <label className="block text-sm font-medium text-slate-300">
              Your token
            </label>
            <select
              value={playerSymbol?.value ?? ""}
              onChange={(e) =>
                setPlayerSymbol(getPlayerSymbolData(e.target.value) ?? null)
              }
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">Choose…</option>
              {availableSymbols.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.emoji} {s.name}
                </option>
              ))}
            </select>
            {guestCannotJoinStaked && (
              <p className="text-amber-400 text-sm">
                Connect a wallet to join this staked game.
              </p>
            )}
            <button
              type="button"
              onClick={handleJoinGame}
              disabled={
                !playerSymbol ||
                actionLoading ||
                isJoining ||
                approvePending ||
                approveConfirming ||
                guestCannotJoinStaked
              }
              className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition"
            >
              {actionLoading || isJoining || approvePending || approveConfirming ? "Joining…" : "Join game"}
            </button>
          </div>
        )}

        {/* Leave */}
        {isJoined && game.players.length < maxPlayers && (
          <button
            type="button"
            onClick={handleLeaveGame}
            disabled={actionLoading}
            className="w-full py-2.5 rounded-xl border border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-50 mb-6 transition"
          >
            {actionLoading ? "Leaving…" : "Leave lobby"}
          </button>
        )}

        {stakePerPlayer > BigInt(0) && (
          <p className="text-amber-400/90 text-sm text-center mb-4">
            Stake: {Number(stakePerPlayer) / 1e6} USDC
          </p>
        )}

        {(error || guestCannotJoinStaked || joinError || contractGameError) && (
          <p className="text-red-400 text-sm text-center mb-4 rounded-lg bg-red-900/20 px-3 py-2">
            {error ??
              (guestCannotJoinStaked
                ? "Connect a wallet to join this staked game."
                : null) ??
              joinError?.message ??
              contractGameError?.message ??
              "Something went wrong"}
          </p>
        )}

        <div className="flex justify-center gap-4 pt-2">
          <button
            type="button"
            onClick={handleGoHome}
            className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 text-sm transition"
          >
            <Home className="w-4 h-4" />
            Home
          </button>
          <a
            href="/join-room-3d"
            className="text-slate-400 hover:text-cyan-400 text-sm transition"
          >
            Join another
          </a>
        </div>
      </div>
    </section>
  );
}
