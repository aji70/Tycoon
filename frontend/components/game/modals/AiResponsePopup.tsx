import React from "react";
import { motion } from "framer-motion";

interface AiResponsePopupProps {
  popup: any | null;
  properties: any[];
  onClose: () => void;
}

export const AiResponsePopup: React.FC<AiResponsePopupProps> = ({ popup, properties, onClose }) => {
  if (!popup) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-gradient-to-br from-purple-900 via-indigo-900 to-cyan-900 rounded-3xl border-4 border-yellow-400 shadow-2xl shadow-yellow-600/60 overflow-hidden max-w-md w-full"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-3xl text-red-300 hover:text-red-200 transition z-20"
        >
          X
        </button>

        <div className="relative z-10 p-8">
          <h3 className="text-4xl font-bold text-yellow-300 text-center mb-8 drop-shadow-2xl">
            🤖 AI Responds...
          </h3>

          <div className="text-center mb-8 bg-black/60 backdrop-blur-md rounded-2xl py-6 px-8 border border-yellow-500/50">
            <p className="text-2xl text-white mb-3">Your offer was</p>
            <span className={`text-5xl font-bold drop-shadow-2xl ${popup.favorability >= 0 ? "text-green-400" : "text-red-400"}`}>
              {popup.favorability >= 0 ? "+" : ""}{popup.favorability}%
            </span>
            <p className="text-xl text-white mt-3">favorable for the AI</p>
          </div>

          <div className="text-center mb-8">
            <div className={`text-4xl font-bold ${popup.decision === "accepted" ? "text-green-400" : "text-red-400"}`}>
              {popup.decision === "accepted" ? "✅ ACCEPTED!" : "❌ DECLINED"}
            </div>
            <p className="text-2xl italic text-gray-200 mt-4">"{popup.remark}"</p>
          </div>

          <div className="space-y-4 text-base">
            <div className="bg-gradient-to-r from-green-900/60 to-emerald-900/60 rounded-xl p-4 border border-green-500/50">
              <span className="font-bold text-green-300">You Offered:</span>{" "}
              <span className="text-white">
                {properties.filter((p: any) => popup.trade.offer_properties?.includes(p.id)).map((p: any) => p.name).join(", ") || "nothing"}{" "}
                {popup.trade.offer_amount > 0 && `+ $${popup.trade.offer_amount}`}
              </span>
            </div>
            <div className="bg-gradient-to-r from-red-900/60 to-pink-900/60 rounded-xl p-4 border border-red-500/50">
              <span className="font-bold text-red-300">You Asked For:</span>{" "}
              <span className="text-white">
                {properties.filter((p: any) => popup.trade.requested_properties?.includes(p.id)).map((p: any) => p.name).join(", ") || "nothing"}{" "}
                {popup.trade.requested_amount > 0 && `+ $${popup.trade.requested_amount}`}
              </span>
            </div>
          </div>

          <div className="mt-10 text-center">
            <button
              onClick={onClose}
              className="px-16 py-5 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-2xl font-bold text-black text-2xl shadow-2xl hover:shadow-yellow-500/80 transition"
            >
              CLOSE
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};