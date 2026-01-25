import { GameProperty, Property } from "@/types/game";
import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  if (!open) return null;

  const targetProps = useMemo(() => {
    if (!targetPlayerAddress) return [];
    return properties.filter((p) =>
      game_properties.some((gp) => gp.property_id === p.id && gp.address === targetPlayerAddress)
    );
  }, [properties, game_properties, targetPlayerAddress]);

  const PropertyCard = ({ prop, isSelected, onClick }: { prop: Property; isSelected: boolean; onClick: () => void }) => (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex flex-col gap-2 ${
        isSelected
          ? "border-cyan-400 bg-cyan-900/50 shadow-lg shadow-cyan-400/50"
          : "border-gray-700 hover:border-gray-500"
      }`}
    >
      {prop.color && (
        <div className="h-6 rounded-t-md -m-3 -mt-3 mb-2" style={{ backgroundColor: prop.color }} />
      )}
      <div className="text-xs font-bold text-cyan-200 text-center leading-tight">{prop.name}</div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-gradient-to-br from-purple-900 to-black rounded-2xl border-4 border-cyan-500 shadow-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      >
        <button onClick={onClose} className="absolute top-4 right-6 text-4xl text-red-400 hover:text-red-300 transition z-10">
          X
        </button>

        <h2 className="text-4xl font-bold text-cyan-300 text-center mb-8">{title}</h2>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            < h3 className="text-2xl font-bold text-green-400 mb-4 text-center">YOU GIVE</h3>
            <div className="grid grid-cols-3 gap-3">
              {my_properties.map((p) => (
                <PropertyCard
                  key={p.id}
                  prop={p}
                  isSelected={offerProperties.includes(p.id)}
                  onClick={() => toggleSelect(p.id, offerProperties, setOfferProperties)}
                />
              ))}
            </div>
            <input
              type="number"
              placeholder="+$ CASH"
              value={offerCash || ""}
              onChange={(e) => setOfferCash(Math.max(0, Number(e.target.value) || 0))}
              className="w-full mt-6 bg-black/60 border-2 border-green-500 rounded-lg px-4 py-4 text-green-400 font-bold text-2xl text-center placeholder-green-700"
            />
          </div>

          <div>
            <h3 className="text-2xl font-bold text-red-400 mb-4 text-center">YOU GET</h3>
            <div className="grid grid-cols-3 gap-3">
              {targetProps.length > 0 ? (
                targetProps.map((p) => (
                  <PropertyCard
                    key={p.id}
                    prop={p}
                    isSelected={requestProperties.includes(p.id)}
                    onClick={() => toggleSelect(p.id, requestProperties, setRequestProperties)}
                  />
                ))
              ) : (
                <div className="col-span-3 text-center text-gray-500 py-8">
                  No properties available
                </div>
              )}
            </div>
            <input
              type="number"
              placeholder="+$ CASH"
              value={requestCash || ""}
              onChange={(e) => setRequestCash(Math.max(0, Number(e.target.value) || 0))}
              className="w-full mt-6 bg-black/60 border-2 border-red-500 rounded-lg px-4 py-4 text-red-400 font-bold text-2xl text-center placeholder-red-700"
            />
          </div>
        </div>

        <div className="flex justify-center gap-8 mt-12">
          <button onClick={onClose} className="px-12 py-5 bg-gray-800 rounded-xl font-bold text-2xl text-gray-300 hover:bg-gray-700 transition">
            CANCEL
          </button>
          <button
            onClick={onSubmit}
            className="px-16 py-5 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl font-bold text-2xl text-white shadow-lg hover:shadow-cyan-500/50 transition"
          >
            SEND DEAL
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}