"use client";
import { useRouter } from "next/navigation";
import { House } from "lucide-react";

export function WARoomHeader() {
  const router = useRouter();

  return (
    <div>
      <div className="flex justify-between items-center mb-12">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-3 text-cyan-400 hover:text-cyan-300 transition group"
        >
          <House className="w-6 h-6 group-hover:-translate-x-1 transition" />
          <span className="font-bold text-lg">BACK TO BASE</span>
        </button>

        <div className="relative">
          <h1 className="text-5xl font-orbitron font-extrabold text-center animate-flicker"
            style={{
              backgroundImage: 'linear-gradient(135deg, #00F0FF 0%, #00F0FF 50%, #B026FF 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 0 30px rgba(0, 240, 255, 0.6), 0 0 60px rgba(176, 38, 255, 0.4)',
              filter: 'drop-shadow(0 0 20px rgba(0, 240, 255, 0.5))',
              letterSpacing: '0.1em',
            }}
          >
            ⚔️ CREATE GAME
          </h1>
          {/* Scanline texture overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `repeating-linear-gradient(
                0deg,
                rgba(0, 240, 255, 0.03) 0px,
                rgba(0, 240, 255, 0.03) 1px,
                transparent 1px,
                transparent 2px
              )`,
              mixBlendMode: 'overlay',
            }}
          />
        </div>

        <div className="w-24" />
      </div>

      <p className="text-sm text-cyan-400/70 text-center mb-8">
        LOAD YOUR WARROOM • CONFIGURE YOUR MATCH • PREPARE FOR BATTLE
      </p>

      <style>{`
        @keyframes flicker {
          0%, 19%, 21%, 100% { opacity: 1; }
          20% { opacity: 0.8; }
        }
        .animate-flicker {
          animation: flicker 0.15s infinite;
        }
      `}</style>
    </div>
  );
}
