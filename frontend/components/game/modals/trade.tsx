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
    className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 flex items-center gap-3 relative overflow-hidden ${
      isSelected
        ? "border-cyan-400 bg-cyan-900/70 shadow-md shadow-cyan-400/50"
        : "border-gray-700 hover:border-cyan-600/60 bg-black/40"
    }`}
  >
    {isSelected && (
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/15 to-teal-500/15" />
    )}
    {prop.color && (
      <div
        className="w-10 h-10 rounded flex-shrink-0"
        style={{ backgroundColor: prop.color }}
      />
    )}
    <div className="text-xs font-semibold text-cyan-200 relative z-10 truncate">
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
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-50" // Semi-transparent + blur to see board
      onClick={onClose}
    >
      {/* Slim left sidebar panel */}
      <motion.div
        initial={{ x: -500 }}
        animate={{ x: 0 }}
        exit={{ x: -500 }}
        transition={{ type: "spring", stiffness: 130, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
        className="
          absolute left-0 top-0 h-full w-full max-w-sm sm:max-w-md
          bg-gradient-to-b from-black/95 via-cyan-950/90 to-black/95
          border-r-4 border-cyan-500
          shadow-2xl shadow-cyan-700/50
          overflow-hidden flex flex-col
        "
      >
        {/* Header */}
        <div className="relative p-6 pb-4 border-b border-cyan-800/50">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-3xl text-red-400 hover:text-red-300 transition"
          >
            ×
          </button>
          <h2 className="text-3xl font-black text-cyan-300 text-center pr-8 drop-shadow-lg">
            {title}
          </h2>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-10">
          {/* YOU OFFER */}
          <div>
            <h3 className="text-xl font-bold text-green-400 mb-4 text-center">
              YOU OFFER
            </h3>
            <div className="space-y-2 mb-6 max-h-60 overflow-y-auto pr-2">
              {my_properties.length > 0 ? (
                my_properties.map((p) => (
                  <PropertyCard
                    key={p.id}
                    prop={p}
                    isSelected={offerProperties.includes(p.id)}
                    onClick={() => toggleSelect(p.id, offerProperties, setOfferProperties)}
                  />
                ))
              ) : (
                <p className="text-center text-gray-500 py-6 text-sm">
                  No properties to offer
                </p>
              )}
            </div>

            <input
              type="number"
              min="0"
              placeholder="Offer Cash ($)"
              value={offerCash || ""}
              onChange={(e) => setOfferCash(Math.max(0, Number(e.target.value) || 0))}
              className="
                w-full bg-black/50 border-3 border-green-500 rounded-xl
                px-4 py-3 text-green-400 font-bold text-xl text-center
                placeholder-green-600 focus:outline-none focus:ring-3 focus:ring-green-500/50
              "
            />
          </div>

          {/* YOU REQUEST */}
          <div>
            <h3 className="text-xl font-bold text-red-400 mb-4 text-center">
              YOU REQUEST
            </h3>
            <div className="space-y-2 mb-6 max-h-60 overflow-y-auto pr-2">
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
                <p className="text-center text-gray-500 py-6 text-sm">
                  Opponent has no properties
                </p>
              )}
            </div>

            <input
              type="number"
              min="0"
              placeholder="Request Cash ($)"
              value={requestCash || ""}
              onChange={(e) => setRequestCash(Math.max(0, Number(e.target.value) || 0))}
              className="
                w-full bg-black/50 border-3 border-red-500 rounded-xl
                px-4 py-3 text-red-400 font-bold text-xl text-center
                placeholder-red-600 focus:outline-none focus:ring-3 focus:ring-red-500/50
              "
            />
          </div>
        </div>

        {/* Fixed bottom buttons */}
        <div className="p-6 pt-4 border-t border-cyan-800/50 space-y-4">
          <button
            onClick={onClose}
            className="
              w-full py-4 rounded-xl font-bold text-xl text-gray-300
              bg-gradient-to-r from-gray-700 to-gray-800
              hover:from-gray-600 hover:to-gray-700 shadow-lg transition
            "
          >
            CANCEL
          </button>

          <button
            onClick={onSubmit}
            className="
              w-full py-5 rounded-xl font-black text-xl text-white
              bg-gradient-to-r from-cyan-500 via-teal-500 to-cyan-600
              shadow-xl shadow-cyan-500/50 hover:shadow-cyan-400/70
              hover:scale-105 transition-all duration-200
            "
          >
            SEND DEAL
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};