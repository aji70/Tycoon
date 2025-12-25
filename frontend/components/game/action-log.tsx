import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Game } from "@/types/game";

type ActionLogProps = {
  history: Game["history"];
};

export default function ActionLog({ history }: ActionLogProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [history?.length]);

  return (
    <div
      ref={logRef}
      className="mt-6 w-full max-w-md bg-gray-900/95 backdrop-blur-md rounded-xl border border-cyan-500/30 shadow-2xl overflow-hidden flex flex-col h-48"
    >
      <div className="p-3 border-b border-cyan-500/20 bg-gray-800/80">
        <h3 className="text-sm font-bold text-cyan-300 tracking-wider">Action Log</h3>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-thin scrollbar-thumb-cyan-600">
        {(!history || history.length === 0) ? (
          <p className="text-center text-gray-500 text-xs italic py-8">No actions yet</p>
        ) : (
          history.map((h, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-gray-300"
            >
              <span className="font-medium text-cyan-200">{h.player_name}</span> {h.comment}
              {h.rolled && <span className="text-cyan-400 font-bold ml-1">[Rolled {h.rolled}]</span>}
            </motion.p>
          ))
        )}
      </div>
    </div>
  );
}