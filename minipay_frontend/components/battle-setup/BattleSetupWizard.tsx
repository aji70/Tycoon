"use client";

import React, { useState, useMemo } from "react";
import { FaRobot, FaCoins } from "react-icons/fa6";
import { Clock, ShieldCheck } from "lucide-react";
import { RiAuctionFill } from "react-icons/ri";
import { GiPrisoner, GiBank } from "react-icons/gi";
import { IoBuild } from "react-icons/io5";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAIGameCreate } from "@/hooks/useAIGameCreate";
import { usePreventDoubleSubmit } from "@/hooks/usePreventDoubleSubmit";
import { BattleHeader } from "./BattleHeader";
import { LoadoutCard } from "./LoadoutCard";
import { PieceSelector } from "./PieceSelector";
import { DifficultySelector } from "./DifficultySelector";
import { OpponentSlots } from "./OpponentSlots";
import { HouseRulesPanel } from "./HouseRulesPanel";
import { LaunchButton } from "./LaunchButton";
import { ScanlineOverlay } from "@/components/hero/ScanlineOverlay";
import { StepProgressBar } from "./StepProgressBar";

export default function BattleSetupWizard() {
  const router = useRouter();
  const playGuard = usePreventDoubleSubmit();
  const [currentStep, setCurrentStep] = useState(1);
  const [expandedRules, setExpandedRules] = useState(false);

  const {
    settings,
    setSettings,
    handlePlay,
    canCreate,
    isCreatePending,
    isGuest,
    isRegisteredLoading,
    registeredAgents,
    agentsLoading,
    registrySupported,
  } = useAIGameCreate({ redirectTo3D: true });

  if (!isGuest && isRegisteredLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-[#0E282A] to-slate-950">
        <p className="text-cyan-400 text-2xl font-medium animate-pulse">
          Initializing Battle System...
        </p>
      </div>
    );
  }

  const houseRules = [
    { icon: RiAuctionFill, label: "Auction Unsold", key: "auction", desc: "Automatic property auctions" },
    { icon: GiPrisoner, label: "Rent in Jail", key: "rentInPrison", desc: "Pay rent while imprisoned" },
    { icon: GiBank, label: "Allow Mortgages", key: "mortgage", desc: "Mortgage property for cash" },
    { icon: IoBuild, label: "Even Building", key: "evenBuild", desc: "Balanced house distribution" },
  ];

  const stepTitles = ["YOUR LOADOUT", "MATCH CONFIG", "RULES"];

  const handleNext = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0E282A] via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Scanline overlay */}
      <ScanlineOverlay />

      {/* Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-3 sm:p-4 md:p-6 lg:p-8">
        <div className="w-full max-w-[1100px] mx-auto">
          {/* Header */}
          <BattleHeader onBack={() => router.push("/")} />

          {/* Step Progress Bar */}
          <StepProgressBar currentStep={currentStep} totalSteps={3} />

          {/* Step Indicator */}
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center mb-6 md:mb-8"
          >
            <p className="text-cyan-400/70 font-orbitron text-xs sm:text-sm uppercase tracking-widest">
              STEP {currentStep} OF 3 · {stepTitles[currentStep - 1]}
            </p>
          </motion.div>

          {/* Step 1: Piece & Opponents */}
          {currentStep === 1 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6 mb-8"
            >
              <LoadoutCard icon="🎯" title="Select Piece" glow>
                <PieceSelector
                  selected={settings.symbol}
                  onChange={(v) => setSettings((p) => ({ ...p, symbol: v }))}
                />
              </LoadoutCard>

              <LoadoutCard
                icon={<FaRobot className="w-6 h-6" />}
                title="Enemy Formation"
                glow
              >
                <OpponentSlots
                  count={settings.aiCount}
                  onChange={(count) => setSettings((p) => ({ ...p, aiCount: count }))}
                />
                {registrySupported && registeredAgents.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-cyan-500/20">
                    <p className="text-xs text-cyan-300/70 flex items-center gap-1 mb-2">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {registeredAgents.length} verified agents
                    </p>
                  </div>
                )}
              </LoadoutCard>
            </motion.div>
          )}

          {/* Step 2: Difficulty, Cash, Duration */}
          {currentStep === 2 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6 mb-8"
            >
              <LoadoutCard
                icon="⚡"
                title="Battle Difficulty"
                variant={settings.aiDifficulty === "boss" ? "danger" : "default"}
                danger={settings.aiDifficulty === "boss"}
                glow
              >
                <DifficultySelector
                  selected={settings.aiDifficulty}
                  onChange={(v) => setSettings((p) => ({ ...p, aiDifficulty: v as any }))}
                  showRandomOption={settings.aiCount > 1}
                  randomMode={settings.aiDifficultyMode}
                  onRandomModeChange={(mode) =>
                    setSettings((p) => ({ ...p, aiDifficultyMode: mode as any }))
                  }
                />
              </LoadoutCard>

              <LoadoutCard
                icon={<FaCoins className="w-6 h-6" />}
                title="Starting Capital"
                glow
              >
                <div className="grid grid-cols-2 gap-2">
                  {[500, 1000, 1500, 2000].map((amount) => (
                    <motion.button
                      key={amount}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSettings((p) => ({ ...p, startingCash: amount }))}
                      className={`py-3 px-3 rounded-lg font-orbitron text-sm font-bold transition-all border-2 ${
                        settings.startingCash === amount
                          ? "border-cyan-400 bg-cyan-500/20 text-cyan-300"
                          : "border-cyan-500/30 bg-slate-800/40 text-cyan-400/60 hover:border-cyan-400/60"
                      }`}
                    >
                      ${amount}
                    </motion.button>
                  ))}
                </div>
              </LoadoutCard>

              <LoadoutCard
                icon={<Clock className="w-6 h-6" />}
                title="Match Duration"
                glow
              >
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 30, label: "30m" },
                    { value: 45, label: "45m" },
                    { value: 60, label: "60m" },
                    { value: 90, label: "90m" },
                    { value: 0, label: "No Limit", full: true },
                  ].map((duration) => (
                    <motion.button
                      key={duration.value}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSettings((p) => ({ ...p, duration: duration.value }))}
                      className={`py-3 px-2 rounded-lg font-orbitron text-sm font-bold transition-all border-2 ${
                        settings.duration === duration.value
                          ? "border-cyan-400 bg-cyan-500/20 text-cyan-300"
                          : "border-cyan-500/30 bg-slate-800/40 text-cyan-400/60 hover:border-cyan-400/60"
                      } ${duration.full ? "col-span-2" : ""}`}
                    >
                      {duration.label}
                    </motion.button>
                  ))}
                </div>
              </LoadoutCard>
            </motion.div>
          )}

          {/* Step 3: Rules & Launch */}
          {currentStep === 3 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6 mb-8"
            >
              {/* Collapsible Rules Section */}
              <motion.button
                onClick={() => setExpandedRules(!expandedRules)}
                className="w-full"
              >
                <div className="bg-gradient-to-br from-slate-800/60 via-slate-800/40 to-slate-900/40 rounded-lg md:rounded-xl p-3 md:p-4 border-2 border-cyan-500/30 transition-all hover:border-cyan-400/60 group flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg md:text-xl text-cyan-400">⚙️</span>
                    <h3 className="text-sm md:text-base font-orbitron font-bold text-white uppercase tracking-wide">
                      Customize Rules
                    </h3>
                  </div>
                  <motion.div
                    animate={{ rotate: expandedRules ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-cyan-400"
                  >
                    ▼
                  </motion.div>
                </div>
              </motion.button>

              {/* Expanded Rules */}
              {expandedRules && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <LoadoutCard icon="⚙️" title="House Rules" glow>
                    <HouseRulesPanel
                      rules={houseRules}
                      settings={settings}
                      onChange={(key, value) =>
                        setSettings((p) => ({ ...p, [key]: value }))
                      }
                    />
                  </LoadoutCard>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center gap-4 mb-8">
            {currentStep > 1 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleBack}
                className="px-6 py-3 rounded-lg font-orbitron font-bold text-sm uppercase transition-all border-2 border-cyan-500/40 bg-slate-800/60 text-cyan-400 hover:border-cyan-400/70 hover:bg-slate-800/80"
              >
                ← BACK
              </motion.button>
            )}

            <div className="flex-1" />

            {currentStep < 3 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleNext}
                className="px-6 py-3 rounded-lg font-orbitron font-bold text-sm uppercase transition-all border-2 border-cyan-400 bg-cyan-500/30 text-cyan-300 hover:border-cyan-300 hover:bg-cyan-500/40"
              >
                NEXT →
              </motion.button>
            )}
          </div>

          {/* Launch Button - Step 3 Only */}
          {currentStep === 3 && (
            <div className="flex justify-center">
              <LaunchButton
                onClick={() => playGuard.submit(() => handlePlay())}
                disabled={!canCreate || playGuard.isSubmitting || (!isGuest && isCreatePending)}
                loading={playGuard.isSubmitting || (!isGuest && isCreatePending)}
                children="LAUNCH BATTLE"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
