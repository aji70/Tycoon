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
  isAITrade?: boolean;
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
  <motion.div
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={`
      relative p-3 rounded-xl border-2 cursor-pointer transition-all
      flex flex-col gap-1.5 overflow-hidden shadow-md
      ${isSelected
        ? "border-cyan-400 bg-cyan-900/70 shadow-lg shadow-cyan-400/50"
        : "border-gray-700 bg-black/50 hover:border-gray-500"
      }
    `}
  >
    {isSelected && (
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/30 to-purple-600/20 animate-pulse" />
    )}
    {prop.color && (
      <div
        className="h-5 rounded-t-lg -m-3 -mt-3 mb-2"
        style={{ backgroundColor: prop.color }}
      />
    )}
    <div className="text-xs font-bold text-cyan-200 text-center leading-tight relative z-10 truncate px-1">
      {prop.name}
    </div>
  </motion.div>
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
    isAITrade = false,
  } = props;

  const targetOwnedProps = useMemo(() => {
    if (!targetPlayerAddress) return [];
    const owned = game_properties.filter(
      (gp: any) => gp.address === targetPlayerAddress
    );
    return properties.filter((p: any) =>
      owned.some((gp: any) => gp.property_id === p.id)
    );
  }, [game_properties, properties, targetPlayerAddress]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-50 px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 400, opacity: 0 }}
        animate={{ y: -10, opacity: 1 }}
        exit={{ y: 400, opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-gradient-to-b from-purple-950 via-black to-cyan-950 rounded-3xl border-4 border-cyan-500 shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
      >
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-cyan-400/60 rounded-full" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-3xl text-red-400 hover:text-red-300 z-10"
        >
          ×
        </button>

        <div className="pt-12 pb-10 px-5">
          <h2 className="text-3xl font-bold text-cyan-300 text-center mb-8 drop-shadow-lg">
            {title}
          </h2>

          <div className="space-y-10">
            {/* YOU GIVE */}
            <div>
              <h3 className="text-2xl font-bold text-green-400 text-center mb-4">
                YOU GIVE
              </h3>
              <div className="grid grid-cols-3 gap-3">
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
                  <p className="col-span-3 text-center text-gray-500 py-6 text-sm">
                    No properties to offer
                  </p>
                )}
              </div>

              <input
                type="number"
                min="0"
                placeholder="+$ CASH"
                value={offerCash || ""}
                onChange={(e) => setOfferCash(Math.max(0, Number(e.target.value) || 0))}
                className="w-full mt-5 bg-black/60 border-2 border-green-500 rounded-xl px-4 py-3.5 text-green-400 font-bold text-xl text-center placeholder-green-700 focus:outline-none focus:border-green-400 transition"
              />
            </div>

            {/* YOU GET */}
            <div>
              <h3 className="text-2xl font-bold text-red-400 text-center mb-4">
                YOU GET
              </h3>
              <div className="grid grid-cols-3 gap-3">
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
                  <p className="col-span-3 text-center text-gray-500 py-6 text-sm">
                    No properties available
                  </p>
                )}
              </div>

              <input
                type="number"
                min="0"
                placeholder="+$ CASH"
                value={requestCash || ""}
                onChange={(e) => setRequestCash(Math.max(0, Number(e.target.value) || 0))}
                className="w-full mt-5 bg-black/60 border-2 border-red-500 rounded-xl px-4 py-3.5 text-red-400 font-bold text-xl text-center placeholder-red-700 focus:outline-none focus:border-red-400 transition"
              />
            </div>

            {/* AI Extra Incentive */}
            {isAITrade && (
              <div className="bg-yellow-900/30 border-2 border-yellow-600/50 rounded-xl p-4">
                <h4 className="text-lg font-bold text-yellow-300 text-center mb-3">
                  🤖 Extra Amount to Send for AI
                </h4>
                <input
                  type="number"
                  min="0"
                  placeholder="$0"
                  value={offerCash || ""}
                  onChange={(e) => setOfferCash(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full bg-black/70 border-2 border-yellow-500 rounded-lg px-4 py-3 text-yellow-300 font-bold text-2xl text-center placeholder-yellow-600 focus:outline-none focus:border-yellow-400 transition"
                />
                <p className="text-xs text-yellow-200/80 text-center mt-2">
                  AI loves good deals! Extra cash increases acceptance chance.
                </p>
              </div>
            )}
          </div>

          {/* SIDE-BY-SIDE BUTTONS */}
          <div className="mt-10 px-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onClose}
                className="py-3.5 bg-gray-800/90 backdrop-blur rounded-xl font-bold text-lg text-gray-300 hover:bg-gray-700 transition shadow-md"
              >
                CANCEL
              </button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onSubmit}
                className="py-3.5 bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 rounded-xl font-bold text-lg text-white shadow-lg hover:shadow-cyan-500/50 transition"
              >
                SEND DEAL
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};