"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";

interface AgentCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateAgent: (data: any) => Promise<void>;
  isCreating?: boolean;
}

export function AgentCreationWizard({ isOpen, onClose, onCreateAgent, isCreating = false }: AgentCreationWizardProps) {
  const [step, setStep] = useState(1);
  const [agentName, setAgentName] = useState("");
  const [hostingMethod, setHostingMethod] = useState("tycoon");
  const [goal, setGoal] = useState("Win");
  const [risk, setRisk] = useState("Medium");
  const [trading, setTrading] = useState("Smart");
  const [building, setBuilding] = useState("Balanced");
  const [buying, setBuying] = useState("Balanced");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [extraInstructions, setExtraInstructions] = useState("");

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleCreate = async () => {
    await onCreateAgent({
      name: agentName,
      hosting_method: hostingMethod,
      behavior: {
        goal,
        risk,
        trading,
        building,
        buying,
      },
      extra_instructions: extraInstructions,
    });
  };

  if (!isOpen) return null;

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
    }),
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-gradient-to-br from-[#0E282A] via-slate-900 to-slate-950 rounded-2xl border-2 border-cyan-500/40 p-8"
      >
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-orbitron font-bold text-cyan-300">Step {step} of 3</h2>
            {step > 1 && (
              <button
                onClick={onClose}
                className="text-cyan-400/70 hover:text-cyan-300 transition-colors"
              >
                ✕
              </button>
            )}
          </div>
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400"
              animate={{ width: `${(step / 3) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait" custom={step}>
          {/* STEP 1: NAME */}
          {step === 1 && (
            <motion.div
              key="step1"
              custom={1}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div>
                <label className="block font-orbitron text-cyan-300 mb-3 text-sm">Agent Name</label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g. AlphaBot, TradeKing"
                  className="w-full bg-black/60 border-2 border-cyan-500/60 rounded-lg p-3 font-orbitron text-cyan-300 placeholder-cyan-500/40 focus:outline-none focus:border-cyan-400"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-orbitron text-cyan-300 mb-3 text-sm">Hosting Method</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "tycoon", name: "Tycoon-hosted", icon: "☁️" },
                    { id: "api", name: "My API Key", icon: "🔑" },
                    { id: "url", name: "My URL", icon: "🌐" },
                  ].map((method) => (
                    <motion.button
                      key={method.id}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setHostingMethod(method.id)}
                      className={`p-4 rounded-lg border-2 transition-all text-center ${
                        hostingMethod === method.id
                          ? "border-cyan-400 bg-cyan-500/20 shadow-lg shadow-cyan-500/40"
                          : "border-cyan-500/30 bg-black/40 hover:border-cyan-400/60"
                      }`}
                    >
                      <div className="text-2xl mb-1">{method.icon}</div>
                      <div className="font-orbitron text-xs text-cyan-300">{method.name}</div>
                      {method.id === "tycoon" && (
                        <div className="text-[10px] text-green-400 mt-1">Recommended</div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 rounded-lg font-orbitron text-cyan-300 border-2 border-cyan-500/30 hover:border-cyan-400/60 transition-all"
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleNext}
                  disabled={!agentName.trim()}
                  className="flex-1 px-4 py-3 rounded-lg font-orbitron font-bold bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300 hover:shadow-lg hover:shadow-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  NEXT →
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: BEHAVIOR */}
          {step === 2 && (
            <motion.div
              key="step2"
              custom={2}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-6 max-h-96 overflow-y-auto"
            >
              {[
                { label: "Goal", options: ["Win", "Cash", "Survive"], value: goal, setValue: setGoal },
                { label: "Risk", options: ["Low", "Medium", "High"], value: risk, setValue: setRisk },
                { label: "Trading", options: ["Never sell", "Smart", "Generous"], value: trading, setValue: setTrading },
                { label: "Building", options: ["Conservative", "Balanced", "Aggressive"], value: building, setValue: setBuilding },
                { label: "Buying", options: ["Conservative", "Balanced", "Aggressive"], value: buying, setValue: setBuying },
              ].map((field) => (
                <div key={field.label}>
                  <label className="block font-orbitron text-cyan-300 mb-2 text-sm">{field.label}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {field.options.map((option) => (
                      <motion.button
                        key={option}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => field.setValue(option)}
                        className={`p-2 rounded-lg border-2 transition-all text-sm font-orbitron ${
                          field.value === option
                            ? "border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-lg shadow-cyan-500/30"
                            : "border-cyan-500/20 bg-black/40 text-cyan-400/70 hover:border-cyan-400/60"
                        }`}
                      >
                        {option}
                      </motion.button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Advanced Options */}
              <details className="bg-black/40 border border-cyan-500/20 rounded-lg p-3">
                <summary className="font-orbitron text-cyan-300 cursor-pointer text-sm">Advanced ▼</summary>
                <textarea
                  value={extraInstructions}
                  onChange={(e) => setExtraInstructions(e.target.value)}
                  placeholder="Custom instructions for your agent..."
                  className="w-full mt-3 bg-black/60 border border-cyan-500/30 rounded p-2 text-cyan-300 text-sm font-mono placeholder-cyan-500/40 focus:outline-none focus:border-cyan-400"
                  rows={4}
                />
              </details>

              <div className="flex gap-3 pt-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={handleBack}
                  className="px-4 py-3 rounded-lg font-orbitron text-cyan-300 border-2 border-cyan-500/30 hover:border-cyan-400/60 transition-all"
                >
                  ← BACK
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={handleNext}
                  className="flex-1 px-4 py-3 rounded-lg font-orbitron font-bold bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300 hover:shadow-lg hover:shadow-cyan-500/40 transition-all"
                >
                  NEXT →
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: LAUNCH */}
          {step === 3 && (
            <motion.div
              key="step3"
              custom={3}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <div className="bg-black/60 border-2 border-cyan-500/40 rounded-lg p-6 space-y-4">
                <h3 className="font-orbitron text-cyan-300 font-bold">Agent Summary</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="text-cyan-400">Name:</span> <span className="font-orbitron font-bold">{agentName}</span></p>
                  <p><span className="text-cyan-400">Hosting:</span> <span className="font-orbitron font-bold capitalize">{hostingMethod}</span></p>
                  <p><span className="text-cyan-400">Goal:</span> <span className="font-orbitron">{goal}</span> · <span className="text-cyan-400">Risk:</span> <span className="font-orbitron">{risk}</span></p>
                  <p><span className="text-cyan-400">Trading:</span> <span className="font-orbitron">{trading}</span> · <span className="text-cyan-400">Building:</span> <span className="font-orbitron">{building}</span> · <span className="text-cyan-400">Buying:</span> <span className="font-orbitron">{buying}</span></p>
                </div>
              </div>

              <div className="bg-amber-900/30 border-2 border-amber-500/40 rounded-lg p-4">
                <p className="font-orbitron text-amber-300 text-sm">
                  💡 <strong>OPTIONAL:</strong> Register on-chain (ERC-8004) after creation to unlock tournaments & challenges
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={handleBack}
                  className="px-4 py-3 rounded-lg font-orbitron text-cyan-300 border-2 border-cyan-500/30 hover:border-cyan-400/60 transition-all"
                >
                  ← BACK
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="flex-1 px-4 py-3 rounded-lg font-orbitron font-bold bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300 hover:shadow-lg hover:shadow-cyan-500/40 disabled:opacity-50 transition-all"
                >
                  {isCreating ? "CREATING..." : "⚡ CREATE AGENT"}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
