"use client";

import { motion, AnimatePresence } from "framer-motion";
import { GameProperty, Player, Property } from "@/types/game";

const PROPERTY_COLOR_CLASS: Record<string, string> = {
  brown: "bg-amber-800",
  lightblue: "bg-sky-400",
  pink: "bg-pink-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  yellow: "bg-yellow-400",
  green: "bg-green-500",
  darkblue: "bg-blue-800",
  gray: "bg-gray-600",
};

interface PropertyDetailModal3DProps {
  property: Property | null;
  gameProperty: GameProperty | undefined;
  players: Player[];
  me: Player | null;
  isMyTurn: boolean;
  getCurrentRent: (prop: Property, gp: GameProperty | undefined) => number;
  onClose: () => void;
  onBuild: (propertyId: number) => void;
  onSellBuilding: (propertyId: number) => void;
  onMortgageToggle: (propertyId: number, isMortgaged: boolean) => void;
  onSellToBank: (propertyId: number) => void;
}

export default function PropertyDetailModal3D({
  property,
  gameProperty,
  players,
  me,
  isMyTurn,
  getCurrentRent,
  onClose,
  onBuild,
  onSellBuilding,
  onMortgageToggle,
  onSellToBank,
}: PropertyDetailModal3DProps) {
  if (!property) return null;

  const isOwner =
    gameProperty?.address?.toLowerCase() === me?.address?.toLowerCase();
  const canManage = isOwner && isMyTurn && gameProperty;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
        style={{ zIndex: 2147483647 }}
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative max-w-sm w-full overflow-hidden rounded-2xl border-2 border-amber-500/60 shadow-2xl shadow-amber-500/20"
          style={{
            background: "linear-gradient(165deg, #1e293b 0%, #0f172a 40%, #020617 100%)",
            boxShadow: "0 0 40px rgba(245,158,11,0.15), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <div
            className={`h-20 border-b-2 border-amber-500/30 relative ${PROPERTY_COLOR_CLASS[property.color || ""] ?? "bg-gray-600"}`}
          >
            <button
              onClick={onClose}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 border border-amber-400/50 flex items-center justify-center text-amber-100 font-bold text-lg transition"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="p-6 pt-4">
            <h2 className="text-2xl font-bold text-center mb-1 text-amber-100 drop-shadow-sm">
              {property.name}
            </h2>
            <p className="text-center text-amber-300/90 text-sm mb-4">${property.price}</p>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-200">
                <span className="text-slate-400">Current Rent</span>
                <span className="font-bold text-amber-300">
                  ${getCurrentRent(property, gameProperty)}
                </span>
              </div>
              {property.cost_of_house != null && property.cost_of_house > 0 && (
                <div className="flex justify-between text-slate-200">
                  <span className="text-slate-400">Cost per house</span>
                  <span className="font-bold text-emerald-300">
                    ${property.cost_of_house}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-200">
                <span className="text-slate-400">Owner</span>
                <span className="font-semibold text-amber-200">
                  {gameProperty?.address
                    ? players.find(
                        (p) =>
                          p.address?.toLowerCase() ===
                          gameProperty.address?.toLowerCase()
                      )?.username || "Player"
                    : "Bank"}
                </span>
              </div>
              <div className="flex justify-between text-slate-200">
                <span className="text-slate-400">Houses</span>
                <span className="font-semibold text-cyan-300">
                  {gameProperty?.development === 5
                    ? "Hotel"
                    : gameProperty?.development != null && gameProperty.development > 0
                      ? `${gameProperty.development} house${gameProperty.development === 1 ? "" : "s"}`
                      : "0 houses"}
                </span>
              </div>
              {gameProperty && (
                <div className="flex justify-between text-slate-200">
                  <span className="text-slate-400">Mortgage</span>
                  <span className={`font-semibold ${gameProperty.mortgaged ? "text-red-400" : "text-emerald-400"}`}>
                    {gameProperty.mortgaged ? "Mortgaged" : "Not mortgaged"}
                  </span>
                </div>
              )}
              {gameProperty?.mortgaged && (
                <div className="text-red-400 font-bold text-center mt-2 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm">
                  No rent while mortgaged
                </div>
              )}
            </div>

            {canManage && (
              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  onClick={() => onBuild(gameProperty.property_id)}
                  disabled={gameProperty.development === 5}
                  className="py-3 bg-emerald-600/90 hover:bg-emerald-500 rounded-xl font-bold text-white border border-emerald-400/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {gameProperty.development === 4 ? "Build Hotel" : "Build House"}
                </button>
                <button
                  onClick={() => onSellBuilding(gameProperty.property_id)}
                  disabled={
                    !gameProperty.development || gameProperty.development === 0
                  }
                  className="py-3 bg-orange-600/90 hover:bg-orange-500 rounded-xl font-bold text-white border border-orange-400/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Sell House/Hotel
                </button>
                <button
                  onClick={() =>
                    onMortgageToggle(
                      gameProperty.property_id,
                      !!gameProperty.mortgaged
                    )
                  }
                  className="py-3 bg-rose-600/90 hover:bg-rose-500 rounded-xl font-bold text-white border border-rose-400/30 transition"
                >
                  {gameProperty.mortgaged ? "Redeem" : "Mortgage"}
                </button>
                <button
                  onClick={() => onSellToBank(gameProperty.property_id)}
                  disabled={(gameProperty.development ?? 0) > 0}
                  className="py-3 bg-violet-600/90 hover:bg-violet-500 rounded-xl font-bold text-white border border-violet-400/30 disabled:opacity-50 transition"
                >
                  Sell Property
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full mt-6 py-3 bg-amber-600/30 hover:bg-amber-500/40 rounded-xl font-bold text-amber-100 border border-amber-400/40 transition"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
