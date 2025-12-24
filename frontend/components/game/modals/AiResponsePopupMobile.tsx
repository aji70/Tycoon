import React from "react";
import { motion } from "framer-motion";

interface AiResponsePopupProps {
  popup: any | null;
  properties: any[];
  onClose: () => void;
}

export const AiResponsePopup: React.FC<AiResponsePopupProps> = ({ popup, properties, onClose }) => {
  if (!popup) return null;

  const offeredProps = properties
    .filter((p: any) => popup.trade.offer_properties?.includes(p.id))
    .map((p: any) => p.name)
    .join(", ") || "nothing";

  const requestedProps = properties
    .filter((p: any) => popup.trade.requested_properties?.includes(p.id))
    .map((p: any) => p.name)
    .join(", ") || "nothing";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-end justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-gradient-to-b from-purple-950 via-indigo-900 to-black rounded-t-3xl border-x-4 border-t-4 border-yellow-500 shadow-2xl w-full max-h-[92vh] overflow-y-auto"
      >
        {/* Handle bar */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-yellow-400/70 rounded-full" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-3xl text-red-400 hover:text-red-300 z-10"
        >
          ×
        </button>

        <div className="pt-10 pb-6 px-5">
          {/* Header */}
          <h3 className="text-3xl font-bold text-yellow-300 text-center mb-6 drop-shadow-lg">
            🤖 AI Responds...
          </h3>

          {/* Favorability Rating */}
          <div className="bg-black/60 backdrop-blur-md rounded-2xl py-5 px-6 border border-yellow-500/50 mb-8">
            <p className="text-lg text-white text-center mb-2">Your offer was</p>
            <div className={`text-5xl font-black text-center drop-shadow-2xl ${popup.favorability >= 0 ? "text-green-400" : "text-red-400"}`}>
              {popup.favorability >= 0 ? "+" : ""}{popup.favorability}%
            </div>
            <p className="text-lg text-white text-center mt-2">favorable for the AI</p>
          </div>

          {/* Decision */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className={`text-4xl font-black ${popup.decision === "accepted" ? "text-green-400" : "text-red-400"}`}
            >
              {popup.decision === "accepted" ? "✅ ACCEPTED!" : "❌ DECLINED"}
            </motion.div>
            <p className="text-xl italic text-gray-200 mt-4 leading-relaxed px-4">
              "{popup.remark}"
            </p>
          </div>

          {/* Trade Summary */}
          <div className="space-y-4 mb-10">
            <div className="bg-gradient-to-r from-green-900/60 to-emerald-900/60 rounded-xl p-4 border border-green-500/50">
              <p className="font-bold text-green-300 text-lg">You Offered:</p>
              <p className="text-white text-base mt-2 break-words">
                {offeredProps}{" "}
                {popup.trade.offer_amount > 0 && <span className="text-green-300">+ ${popup.trade.offer_amount}</span>}
              </p>
            </div>

            <div className="bg-gradient-to-r from-red-900/60 to-pink-900/60 rounded-xl p-4 border border-red-500/50">
              <p className="font-bold text-red-300 text-lg">You Asked For:</p>
              <p className="text-white text-base mt-2 break-words">
                {requestedProps}{" "}
                {popup.trade.requested_amount > 0 && <span className="text-red-300">+ ${popup.trade.requested_amount}</span>}
              </p>
            </div>
          </div>

          {/* Fixed Bottom Button */}
          <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/90 to-transparent pt-8 pb-8 px-5">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onClose}
              className="w-full max-w-md mx-auto py-4 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-2xl font-bold text-black text-xl shadow-2xl hover:shadow-yellow-500/70 transition"
            >
              CLOSE
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};