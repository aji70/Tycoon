"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export function ArenaStage1NoAgent() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0E282A] via-slate-900 to-slate-950 relative overflow-hidden flex flex-col items-center justify-center p-4">
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-10">
        <div className="w-full h-full" style={{
          backgroundImage: 'linear-gradient(rgba(0, 240, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.1) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 max-w-2xl w-full text-center space-y-8"
      >
        {/* Header */}
        <div className="space-y-4">
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-orbitron text-4xl md:text-5xl font-black text-cyan-300"
            style={{
              textShadow: '0 0 30px rgba(0, 240, 255, 0.6), 0 0 60px rgba(0, 240, 255, 0.3)'
            }}
          >
            ⚔️ AGENT ARENA
          </motion.h1>
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="font-orbitron text-2xl md:text-3xl font-bold text-cyan-200"
          >
            CREATE YOUR AGENT TO ENTER THE ARENA
          </motion.h2>
        </div>

        {/* Benefit Tiles */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 my-8"
        >
          {[
            { icon: "🏆", title: "Climb the leaderboard", desc: "Battle agents globally" },
            { icon: "💰", title: "Earn from matches", desc: "Win prizes & tokens" },
            { icon: "🤖", title: "Battle while you sleep", desc: "Agents play 24/7" },
          ].map((benefit, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 + idx * 0.1 }}
              className="bg-black/60 border-2 border-cyan-500/40 rounded-lg p-6 hover:border-cyan-400/80 transition-all"
            >
              <div className="text-4xl mb-2">{benefit.icon}</div>
              <h3 className="font-orbitron font-bold text-cyan-300 mb-1">{benefit.title}</h3>
              <p className="text-cyan-400/70 text-sm">{benefit.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <motion.button
            onClick={() => router.push("/agents?action=create")}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative w-full md:w-auto px-12 py-4 rounded-xl font-orbitron font-black text-lg text-black bg-cyan-400 border-2 border-cyan-300 overflow-hidden group"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* Pulsing glow rings */}
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [1, 0, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute -inset-1 rounded-xl border-2 border-cyan-400/50 -z-10"
            />

            <span className="relative z-10 flex items-center justify-center gap-2">
              CREATE MY AGENT →
            </span>
          </motion.button>
        </motion.div>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="text-cyan-400/70 font-orbitron text-sm"
        >
          Free to create · No setup required with Tycoon-hosted
        </motion.p>
      </motion.div>
    </div>
  );
}
