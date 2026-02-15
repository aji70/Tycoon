import { GameProperty, Property } from "@/types/game";
import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Accent = "offer" | "request";

const PropertyCard = ({
  prop,
  isSelected,
  onClick,
  accent,
}: {
  prop: Property;
  isSelected: boolean;
  onClick: () => void;
  accent: Accent;
}) => (
  <motion.button
    type="button"
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`
      w-full text-left p-3 rounded-xl border-2 transition-all duration-200 flex items-center gap-3
      focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-slate-900
      ${isSelected
        ? accent === "offer"
          ? "border-emerald-400 bg-emerald-500/20 shadow-sm shadow-emerald-500/30"
          : "border-amber-400 bg-amber-500/20 shadow-sm shadow-amber-500/30"
        : "border-slate-600/80 bg-slate-800/50 active:border-slate-500 active:bg-slate-700/50"
      }
    `}
  >
    {prop.color && (
      <div
        className="w-8 h-8 rounded-lg flex-shrink-0 border border-white/10"
        style={{ backgroundColor: prop.color }}
      />
    )}
    <span className="text-sm font-medium text-slate-200 truncate">{prop.name}</span>
  </motion.button>
);

export default function TradeModal({
  open,
  title,
  onClose,
  onSubmit,
  my_properties,
  properties,
  game_properties,
  offerProperties,
  requestProperties,
  setOfferProperties,
  setRequestProperties,
  offerCash,
  requestCash,
  setOfferCash,
  setRequestCash,
  toggleSelect,
  targetPlayerAddress,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  my_properties: Property[];
  properties: Property[];
  game_properties: GameProperty[];
  offerProperties: number[];
  requestProperties: number[];
  setOfferProperties: React.Dispatch<React.SetStateAction<number[]>>;
  setRequestProperties: React.Dispatch<React.SetStateAction<number[]>>;
  offerCash: number;
  requestCash: number;
  setOfferCash: React.Dispatch<React.SetStateAction<number>>;
  setRequestCash: React.Dispatch<React.SetStateAction<number>>;
  toggleSelect: (id: number, arr: number[], setter: React.Dispatch<React.SetStateAction<number[]>>) => void;
  targetPlayerAddress?: string | null;
}) {
  const targetProps = useMemo(() => {
    if (!targetPlayerAddress) return [];
    return properties.filter((p) =>
      game_properties.some((gp) => gp.property_id === p.id && gp.address === targetPlayerAddress)
    );
  }, [properties, game_properties, targetPlayerAddress]);

  const totalOfferValue = useMemo(() => {
    const propsValue = offerProperties.reduce((sum, id) => {
      const prop = my_properties.find((p) => p.id === id);
      return sum + (prop?.price || 0);
    }, 0);
    return propsValue + offerCash;
  }, [offerProperties, offerCash, my_properties]);

  const totalRequestValue = useMemo(() => {
    const propsValue = requestProperties.reduce((sum, id) => {
      const prop = targetProps.find((p) => p.id === id);
      return sum + (prop?.price || 0);
    }, 0);
    return propsValue + requestCash;
  }, [requestProperties, requestCash, targetProps]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 35 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-slate-600/50 sm:border-t shadow-2xl overflow-hidden"
        >
          {/* Handle bar (mobile) */}
          <div className="sm:hidden flex justify-center pt-3 pb-1">
            <div className="w-12 h-1 rounded-full bg-slate-500" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/80 bg-slate-800/50">
            <h2 className="text-lg font-bold text-slate-100">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-700/80 transition touch-manipulation"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content - scrollable (min-h-0 lets flex shrink so footer stays visible) */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-6">
            {/* You offer */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                You offer
              </h3>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {my_properties.length > 0 ? (
                  my_properties.map((p) => (
                    <PropertyCard
                      key={p.id}
                      prop={p}
                      isSelected={offerProperties.includes(p.id)}
                      onClick={() => toggleSelect(p.id, offerProperties, setOfferProperties)}
                      accent="offer"
                    />
                  ))
                ) : (
                  <p className="text-sm text-slate-500 py-4 text-center">No properties</p>
                )}
              </div>
              <label className="block">
                <span className="text-xs text-slate-400 block mb-1">Cash ($)</span>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={offerCash || ""}
                  onChange={(e) => setOfferCash(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-base"
                />
              </label>
              {totalOfferValue > 0 && (
                <p className="text-xs text-emerald-400/90 font-medium">Total: ${totalOfferValue.toLocaleString()}</p>
              )}
            </div>

            {/* You request */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                You request
              </h3>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {targetProps.length > 0 ? (
                  targetProps.map((p) => (
                    <PropertyCard
                      key={p.id}
                      prop={p}
                      isSelected={requestProperties.includes(p.id)}
                      onClick={() => toggleSelect(p.id, requestProperties, setRequestProperties)}
                      accent="request"
                    />
                  ))
                ) : (
                  <p className="text-sm text-slate-500 py-4 text-center">No properties</p>
                )}
              </div>
              <label className="block">
                <span className="text-xs text-slate-400 block mb-1">Cash ($)</span>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={requestCash || ""}
                  onChange={(e) => setRequestCash(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 text-base"
                />
              </label>
              {totalRequestValue > 0 && (
                <p className="text-xs text-amber-400/90 font-medium">Total: ${totalRequestValue.toLocaleString()}</p>
              )}
            </div>
          </div>

          {/* Footer - flex-shrink-0 so it's always visible on mobile */}
          <div className="flex-shrink-0 flex gap-3 px-5 py-4 pb-safe border-t border-slate-700/80 bg-slate-800/90 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 rounded-xl font-semibold text-slate-300 bg-slate-700 hover:bg-slate-600 active:bg-slate-600 transition touch-manipulation"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={totalOfferValue === 0 && totalRequestValue === 0}
              className="flex-1 py-3.5 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-500 transition focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              Send deal
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
