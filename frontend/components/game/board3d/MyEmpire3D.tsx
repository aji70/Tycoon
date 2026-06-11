"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Property, GameProperty } from "@/types/game";
import { rentPrice, isMortgaged } from "@/utils/gameUtils";

interface MyEmpire3DProps {
  showEmpire: boolean;
  toggleEmpire: () => void;
  my_properties: Property[];
  properties: Property[];
  game_properties: GameProperty[];
  onPropertyClick: (prop: Property) => void;
}

export default function MyEmpire3D({
  showEmpire,
  toggleEmpire,
  my_properties,
  properties,
  game_properties,
  onPropertyClick,
}: MyEmpire3DProps) {
  return (
    <div className="space-y-2">
      <button
        onClick={toggleEmpire}
        className="w-full flex items-center justify-between py-2 text-left group"
      >
        <span className="text-sm font-black text-amber-200 tracking-widest uppercase">
          My Empire
        </span>
        <motion.span
          animate={{ rotate: showEmpire ? 180 : 0 }}
          className="text-amber-400/80 group-hover:text-amber-300 transition"
        >
          ▼
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {showEmpire && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {my_properties.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-slate-500 text-sm">No properties yet</p>
                <p className="text-slate-600 text-xs mt-1">Land on unowned spaces to buy</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {my_properties.map((prop, i) => {
                  const rent = rentPrice(prop.id, properties, game_properties);
                  const mortgaged = isMortgaged(prop.id, game_properties);
                  return (
                    <motion.button
                      key={prop.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => onPropertyClick(prop)}
                      className="rounded-xl border-2 border-amber-500/40 bg-slate-800/80 p-2.5 text-left hover:border-amber-400/60 hover:bg-slate-700/80 transition-all"
                    >
                      {prop.color && (
                        <div
                          className="h-1.5 rounded mb-1.5"
                          style={{ backgroundColor: prop.color }}
                        />
                      )}
                      <p className="text-xs font-bold text-amber-100 truncate">{prop.name}</p>
                      {rent > 0 && (
                        <p className="text-[10px] text-emerald-400">Rent: ${rent}</p>
                      )}
                      {mortgaged && (
                        <p className="text-[10px] text-red-400 font-bold">MORTGAGED</p>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
