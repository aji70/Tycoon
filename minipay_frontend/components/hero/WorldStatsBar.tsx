"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface WorldStatsBarProps {
  playersOnline?: number;
  propertiesOwned?: number;
  tokensInPlay?: string;
}

export function WorldStatsBar({
  playersOnline = 1234,
  propertiesOwned = 5678,
  tokensInPlay = "12.5M",
}: WorldStatsBarProps) {
  const [displayStats, setDisplayStats] = useState({
    players: 0,
    properties: 0,
  });

  useEffect(() => {
    let animFrame: number;
    let frame = 0;

    const animate = () => {
      frame++;
      const progress = Math.min(frame / 30, 1);

      setDisplayStats({
        players: Math.floor(playersOnline * progress),
        properties: Math.floor(propertiesOwned * progress),
      });

      if (progress < 1) {
        animFrame = requestAnimationFrame(animate);
      }
    };

    animFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame);
  }, [playersOnline, propertiesOwned]);

  const stats = [
    { label: "Players Online", value: displayStats.players.toLocaleString() },
    { label: "Properties Owned", value: displayStats.properties.toLocaleString() },
    { label: "Tokens in Play", value: tokensInPlay },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.6 }}
      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#010F10] via-[#010F10]/80 to-transparent pt-8 pb-4"
    >
      <div className="w-full px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-center items-center gap-8 md:gap-16 flex-wrap">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.7 + i * 0.1 }}
                className="text-center"
              >
                <div className="text-xs font-orbitron text-[#00F0FF]/70 uppercase tracking-wider mb-1">
                  {stat.label}
                </div>
                <div className="relative">
                  <div className="text-sm md:text-lg font-orbitron font-bold text-[#17ffff]">
                    {stat.value}
                  </div>
                  <div className="absolute -inset-2 rounded opacity-0 group-hover:opacity-100 transition duration-300 blur-lg -z-10"
                    style={{
                      background: "linear-gradient(135deg, rgba(0, 240, 255, 0.2), rgba(15, 240, 252, 0.1))",
                    }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
