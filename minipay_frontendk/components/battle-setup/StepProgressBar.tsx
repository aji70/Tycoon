"use client";
import { motion } from "framer-motion";

interface StepProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export function StepProgressBar({ currentStep, totalSteps }: StepProgressBarProps) {
  return (
    <div className="flex justify-center items-center gap-3 md:gap-4 mb-8 md:mb-10">
      {Array.from({ length: totalSteps }).map((_, idx) => {
        const stepNum = idx + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;

        return (
          <motion.div
            key={idx}
            className="flex items-center gap-3 md:gap-4"
          >
            {/* Step Dot */}
            <motion.div
              animate={{
                scale: isActive ? 1.2 : 1,
                boxShadow: isActive
                  ? "0 0 20px rgba(0, 240, 255, 0.6)"
                  : isCompleted
                  ? "0 0 10px rgba(0, 240, 255, 0.3)"
                  : "none",
              }}
              transition={{ duration: 0.3 }}
              className={`relative w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border-2 font-orbitron font-bold text-sm md:text-base transition-all ${
                isActive
                  ? "border-cyan-400 bg-cyan-500/30 text-cyan-300"
                  : isCompleted
                  ? "border-cyan-500/60 bg-cyan-600/20 text-cyan-400"
                  : "border-cyan-500/30 bg-slate-800/40 text-cyan-500/50"
              }`}
            >
              {isCompleted ? "✓" : stepNum}
            </motion.div>

            {/* Connector Line */}
            {stepNum < totalSteps && (
              <motion.div
                animate={{
                  background: isCompleted
                    ? "linear-gradient(90deg, rgb(0, 240, 255, 0.5), rgb(0, 240, 255, 0.3))"
                    : "linear-gradient(90deg, rgb(0, 240, 255, 0.2), rgb(0, 240, 255, 0.1))",
                }}
                transition={{ duration: 0.3 }}
                className="w-8 h-1 md:w-12 md:h-1 rounded-full"
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
