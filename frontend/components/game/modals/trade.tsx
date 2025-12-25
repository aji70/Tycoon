import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Property } from "@/types/game";

interface TradeModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  my_properties: Property[];
  properties: Property[];
  game_properties: any[];
  offerProperties: number[];
  requestProperties: number[];
  setOfferProperties: React.Dispatch<React.SetStateAction<number[]>>;
  setRequestProperties: React.Dispatch<React.SetStateAction<number[]>>;
  offerCash: number;
  requestCash: number;
  setOfferCash: React.Dispatch<React.SetStateAction<number>>;
  setRequestCash: React.Dispatch<React.SetStateAction<number>>;
  toggleSelect: (id: number, arr: number[], setter: any) => void;
  targetPlayerAddress?: string | null;
}

const PropertyCard = ({
  prop,
  isSelected,
  onClick,
}: {
  prop: Property;
  isSelected: boolean;
  onClick: () => void;
}) => (
  <div
    onClick={onClick}
    className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex flex-col gap-2 relative overflow-hidden ${
      isSelected
        ? "border-cyan-400 bg-cyan-900/60 shadow-lg shadow-cyan-400/70"
        : "border-gray-700 hover:border-gray-500 bg-black/40"
    }`}
  >
    {isSelected && (
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 animate-pulse" />
    )}
    {prop.color && (
      <div className="h-6 rounded-t-md -m-3 -mt-3 mb-2" style={{ backgroundColor: prop.color }} />
    )}
    <div className="text-xs font-bold text-cyan-200 text-center leading-tight relative z-10">
      {prop.name}
    </div>
  </div>
);

export const TradeModal: React.FC<TradeModalProps> = (props) => {
  if (!props.open) return null;

  const {
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
  } = props;

  const targetOwnedProps = useMemo(() => {
    if (!targetPlayerAddress) return [];
    const ownedGameProps = game_properties.filter(
      (gp: any) => gp.address === targetPlayerAddress
    );
    return properties.filter((p: any) =>
      ownedGameProps.some((gp: any) => gp.property_id === p.id)
    );
  }, [game_properties, properties, targetPlayerAddress]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, rotateY: 10 }}
        animate={{ scale: 1, rotateY: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-gradient-to-br from-purple-950 via-black to-cyan-950 rounded-3xl border-4 border-cyan-500 shadow-2xl shadow-cyan-600/70 overflow-hidden max-w-5xl w-full max-h-[95vh] overflow-y-auto"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/10 via-cyan-500/10 to-purple-500/10" />
        <button onClick={onClose} className="absolute top-6 right-8 text-5xl text-red-400 hover:text-red-300 transition z-20">
          X
        </button>

        <div className="relative z-10 p-10">
          <h2 className="text-5xl font-bold text-cyan-300 text-center mb-12 drop-shadow-2xl">{title}</h2>

          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <h3 className="text-3xl font-bold text-green-400 mb-6 text-center drop-shadow-lg">YOU GIVE</h3>
              <div className="grid grid-cols-3 gap-4">
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
                className="w-full mt-8 bg-black/70 border-4 border-green-500 rounded-2xl px-6 py-6 text-green-400 font-bold text-3xl text-center placeholder-green-700 focus:outline-none focus:ring-4 focus:ring-green-500/50 transition"
              />
            </div>

            <div>
              <h3 className="text-3xl font-bold text-red-400 mb-6 text-center drop-shadow-lg">YOU GET</h3>
              <div className="grid grid-cols-3 gap-4">
                {targetOwnedProps.length > 0 ? (
                  targetOwnedProps.map((p) => (
                    <PropertyCard
                      key={p.id}
                      prop={p}
                      isSelected={requestProperties.includes(p.id)}
                      onClick={() => toggleSelect(p.id, requestProperties, setRequestProperties)}
                    />
                  ))
                ) : (
                  <div className="col-span-3 text-center text-gray-500 py-12 text-xl">
                    No properties available
                  </div>
                )}
              </div>
              <input
                type="number"
                placeholder="+$ CASH"
                value={requestCash || ""}
                onChange={(e) => setRequestCash(Math.max(0, Number(e.target.value) || 0))}
                className="w-full mt-8 bg-black/70 border-4 border-red-500 rounded-2xl px-6 py-6 text-red-400 font-bold text-3xl text-center placeholder-red-700 focus:outline-none focus:ring-4 focus:ring-red-500/50 transition"
              />
            </div>
          </div>

          <div className="flex justify-center gap-12 mt-16">
            <button onClick={onClose} className="px-16 py-6 bg-gradient-to-r from-gray-700 to-gray-800 rounded-2xl font-bold text-3xl text-gray-300 hover:from-gray-600 hover:to-gray-700 transition shadow-2xl">
              CANCEL
            </button>
            <button
              onClick={onSubmit}
              className="px-20 py-6 bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 rounded-2xl font-bold text-3xl text-white shadow-2xl hover:shadow-cyan-500/80 transition"
            >
              SEND DEAL
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};