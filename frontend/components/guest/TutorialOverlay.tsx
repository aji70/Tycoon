"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "tycoon_tutorial_seen";

const SLIDES = [
  {
    icon: "🏆",
    title: "Become the Tycoon",
    body: "Buy properties, collect rent, and bankrupt your opponents. Last one standing wins.",
  },
  {
    icon: "🎮",
    title: "Pick Your Battle",
    body: "Challenge AI for solo practice, join a Multiplayer room with others, or send your Agent to battle automatically.",
  },
  {
    icon: "🤖",
    title: "Your AI Fighter",
    body: "Create an AI Agent that plays Tycoon for you 24/7. Train its strategy, set spending limits, and watch it climb the leaderboard.",
  },
  {
    icon: "💰",
    title: "Play & Earn",
    body: "Stake USDC on matches, win games, collect TYC tokens, and redeem vouchers from your profile.",
  },
];

export default function TutorialOverlay() {
  const [open, setOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const [dir, setDir] = useState(1);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  };

  const next = () => {
    setDir(1);
    setSlide((s) => s + 1);
  };

  const back = () => {
    setDir(-1);
    setSlide((s) => s - 1);
  };

  if (!open) return null;

  const isLast = slide === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative w-full h-full sm:h-auto sm:max-w-md bg-[#0A1618] border border-cyan-500/40 shadow-[0_0_60px_rgba(0,240,255,0.15)] rounded-none sm:rounded-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-cyan-500/20">
          <p className="font-orbitron text-xs text-cyan-400/70 uppercase tracking-widest mb-1">
            Tutorial
          </p>
          <h2 className="font-orbitron text-xl font-bold text-white">⚔️ WELCOME TO TYCOON</h2>
        </div>

        {/* Slide content */}
        <div className="flex-1 relative overflow-hidden px-6 py-6">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={slide}
              custom={dir}
              variants={{
                enter: (d) => ({ x: d * 60, opacity: 0 }),
                center: { x: 0, opacity: 1 },
                exit: (d) => ({ x: d * -60, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="absolute inset-0 px-6 py-6 flex flex-col justify-center"
            >
              <div className="text-5xl mb-4">{SLIDES[slide].icon}</div>
              <h3 className="font-orbitron text-lg font-bold text-cyan-300 mb-3">
                {SLIDES[slide].title}
              </h3>
              <p className="text-sm text-slate-300 font-dmSans leading-relaxed">
                {SLIDES[slide].body}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2 pb-4">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i === slide ? "bg-cyan-400 w-4" : "bg-cyan-500/30"
              }`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="px-6 pb-4 flex items-center justify-between gap-3">
          <button
            onClick={back}
            disabled={slide === 0}
            className="px-4 py-2 rounded-xl border border-cyan-500/30 text-cyan-400 text-sm font-orbitron disabled:opacity-30 hover:border-cyan-400 transition"
          >
            ← BACK
          </button>
          {isLast ? (
            <button
              onClick={dismiss}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 text-[#010F10] font-orbitron font-bold text-sm hover:opacity-90 transition"
            >
              ⚡ LET'S PLAY
            </button>
          ) : (
            <button
              onClick={next}
              className="px-4 py-2 rounded-xl border border-cyan-500/30 text-cyan-400 text-sm font-orbitron hover:border-cyan-400 transition"
            >
              NEXT →
            </button>
          )}
        </div>

        {/* Skip link */}
        <div className="text-center pb-5">
          <button
            onClick={dismiss}
            className="text-slate-500 text-xs font-dmSans hover:text-slate-300 transition"
          >
            Skip tutorial
          </button>
        </div>
      </div>
    </div>
  );
}
