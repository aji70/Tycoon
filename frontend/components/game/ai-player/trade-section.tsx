import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Property } from "@/types/game";

interface TradeSectionProps {
  showTrade: boolean;
  toggleTrade: () => void;
  openTrades: any[];
  tradeRequests: any[];
  properties: Property[];
  game: any;
  handleTradeAction: (id: number, action: "accepted" | "declined" | "counter") => void;
}

export const TradeSection: React.FC<TradeSectionProps> = ({
  showTrade,
  toggleTrade,
  openTrades,
  tradeRequests,
  properties,
  game,
  handleTradeAction,
}) => {
  const renderTradeItem = (trade: any, isIncoming: boolean) => {
    const offeredProps = properties.filter((p) =>
      trade.offer_properties?.includes(p.id)
    );
    const requestedProps = properties.filter((p) =>
      trade.requested_properties?.includes(p.id)
    );
    const player = game.players.find((pl: any) =>
      isIncoming ? pl.user_id === trade.player_id : pl.user_id === trade.target_player_id
    );

    return (
      <div key={trade.id} className="bg-black/40 border border-cyan-800 rounded-lg p-3 text-sm">
        <div className="font-medium text-cyan-200 mb-1">
          {isIncoming ? "From" : "To"} {player?.username || "Player"}
        </div>
        <div className="text-xs space-y-1 mb-2">
          <div className="text-green-400">
            {isIncoming ? "Gives" : "Offer"}:{" "}
            {offeredProps.length ? offeredProps.map((p) => p.name).join(", ") : "nothing"}{" "}
            {trade.offer_amount > 0 && `+ $${trade.offer_amount}`}
          </div>
          <div className="text-red-400">
            {isIncoming ? "Wants" : "Want"}:{" "}
            {requestedProps.length ? requestedProps.map((p) => p.name).join(", ") : "nothing"}{" "}
            {trade.requested_amount > 0 && `+ $${trade.requested_amount}`}
          </div>
        </div>
        {isIncoming && (
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => handleTradeAction(trade.id, "accepted")}
              className="py-1.5 bg-green-600 rounded text-xs font-bold text-white hover:bg-green-500"
            >
              ACCEPT
            </button>
            <button
              onClick={() => handleTradeAction(trade.id, "declined")}
              className="py-1.5 bg-red-600 rounded text-xs font-bold text-white hover:bg-red-500"
            >
              DECLINE
            </button>
            <button
              onClick={() => handleTradeAction(trade.id, "counter")}
              className="py-1.5 bg-yellow-600 rounded text-xs font-bold text-black hover:bg-yellow-500"
            >
              COUNTER
            </button>
          </div>
        )}
        {!isIncoming && (
          <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${
            trade.status === 'accepted' ? 'bg-green-900/50 text-green-300' :
            trade.status === 'declined' ? 'bg-red-900/50 text-red-300' :
            'bg-yellow-900/50 text-yellow-300'
          }`}>
            {trade.status.toUpperCase()}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="border-t-4 border-pink-600 pt-4">
      <button
        onClick={toggleTrade}
        className="w-full text-xl font-bold text-pink-300 flex justify-between items-center"
      >
        <span>TRADES {tradeRequests.length > 0 && `(${tradeRequests.length} pending)`}</span>
        <motion.span animate={{ rotate: showTrade ? 180 : 0 }} className="text-3xl text-cyan-400">
          ▼
        </motion.span>
      </button>

      <AnimatePresence>
        {showTrade && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden mt-3 space-y-3"
          >
            {/* Active trades */}
            {openTrades.length > 0 && (
              <div>
                <h4 className="text-lg font-bold text-cyan-400 mb-2 flex items-center gap-2">
                  <span>📤</span> <span>MY ACTIVE TRADES</span>
                </h4>
                <div className="space-y-2">{openTrades.map((t) => renderTradeItem(t, false))}</div>
              </div>
            )}

            {/* Incoming */}
            {tradeRequests.length > 0 && (
              <div>
                <h4 className="text-lg font-bold text-cyan-400 mb-2 flex items-center gap-2">
                  <span>📥</span> <span>INCOMING REQUESTS</span>
                </h4>
                <div className="space-y-2">{tradeRequests.map((t) => renderTradeItem(t, true))}</div>
              </div>
            )}

            {openTrades.length === 0 && tradeRequests.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                <div className="text-3xl mb-1">💱</div>
                <p className="text-sm">No trades yet..</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};