// components/game/game-log.tsx
import React, { useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { Game } from "@/types/game";

type ActionLogProps = {
  history: Game["history"];
};

function dedupeHistory(history: Game["history"]): Game["history"] {
  if (!history?.length) return history ?? [];
  const out: Game["history"] = [];
  let prevKey = "";
  for (const entry of history) {
    const name = typeof entry === "object" && entry !== null && "player_name" in entry ? String((entry as { player_name?: string }).player_name ?? "") : "";
    const comment = typeof entry === "object" && entry !== null && "comment" in entry ? String((entry as { comment?: string }).comment ?? "") : String(entry ?? "");
    if (`${name}|${comment}` !== prevKey) {
      out.push(entry);
      prevKey = `${name}|${comment}`;
    }
  }
  return out;
}

export default function GameLog({ history }: ActionLogProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const deduped = useMemo(() => dedupeHistory(history), [history]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [deduped?.length]);

  return (
    <div
      ref={logRef}
      className="mt-6 mb-6 w-full max-w-md bg-gray-900/95 backdrop-blur-md rounded-xl border border-cyan-500/30 shadow-2xl overflow-hidden flex flex-col h-48"
    >
      <div className="p-3 border-b border-cyan-500/20 bg-gray-800/80">
        <h3 className="text-sm font-bold text-cyan-300 tracking-wider">Action Log</h3>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-thin scrollbar-thumb-cyan-600">
        {(!deduped || deduped.length === 0) ? (
          <p className="text-center text-gray-500 text-xs italic py-8">No actions yet</p>
        ) : (
          deduped.map((entry, i) => {
            const name = typeof entry === "object" && entry !== null && "player_name" in entry ? (entry as { player_name?: string }).player_name : "";
            const comment = typeof entry === "object" && entry !== null && "comment" in entry ? (entry as { comment?: string }).comment : "(no comment)";
            const rolled = typeof entry === "object" && entry !== null && "rolled" in entry ? (entry as { rolled?: number }).rolled : undefined;
            const key = typeof entry === "object" && entry !== null && "id" in entry ? (entry as { id?: number }).id : i;
            return (
              <motion.p
                key={`${key}-${String(name).slice(0, 20)}-${String(comment).slice(0, 30)}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="text-xs text-gray-300"
              >
                <span className="font-medium text-cyan-200">{name}</span>{" "}
                {comment || "(no comment)"}
                {rolled != null && (
                  <span className="text-cyan-400 font-bold ml-1">[Rolled {rolled}]</span>
                )}
              </motion.p>
            );
          })
        )}
      </div>
    </div>
  );
}