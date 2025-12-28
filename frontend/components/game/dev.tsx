import { Game, GameProperty, Player, Property } from "@/types/game";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
// ── Debug Claim Modal ───────────────────────────────────────────────────────────
interface ClaimPropertyModalProps {
  open: boolean;
  game_properties: GameProperty[];
  properties: Property[];
  me: Player | null;
  game: Game;
  onClose: () => void;
  onClaim: (propertyId: number, player: Player) => Promise<unknown>;
  onDelete: (id: number) => Promise<void>;
  onTransfer: (propertyId: number, newPlayerId: number, player_address: string) => Promise<void>;
}

export default function ClaimPropertyModal({
  open,
  game_properties,
  properties,
  me,
  game,
  onClose,
  onClaim,
  onDelete,
  onTransfer,
}: ClaimPropertyModalProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [targetPlayerId, setTargetPlayerId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"claim" | "delete" | "transfer">("claim");

  if (!open || !me) return null;

  const allProperties = game_properties
    .map(gp => ({
      ...gp,
      base: properties.find(p => p.id === gp.property_id),
    }))
    .filter((gp): gp is typeof gp & { base: Property } => !!gp.base)
    .sort((a, b) => (b.base.price || 0) - (a.base.price || 0));

  const selected = selectedId ? allProperties.find(gp => gp.id === selectedId) : null;

  const currentOwner = selected
    ? game.players.find(p => p.address?.toLowerCase() === selected.address?.toLowerCase()) ||
      (selected.address === "bank" ? { username: "Bank" } : { username: selected.address?.slice(0, 8) + "..." })
    : null;

  // Helper: get real player_id from a player's existing game_property
  const getRecipientPlayerId = (walletAddress: string): number | null => {
    const owned = game_properties.find(
      gp => gp.address?.toLowerCase() === walletAddress.toLowerCase()
    );
    return owned?.player_id ?? null;
  };

  // Players who already own properties → eligible for receiving transfer
  const eligibleRecipients = game.players.filter(player => {
    if (player.user_id === me.user_id) return false; // exclude self
    return game_properties.some(
      gp => gp.address?.toLowerCase() === player.address?.toLowerCase()
    );
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-gray-900 border border-cyan-500/50 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl shadow-cyan-500/20"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-cyan-800/40 bg-gradient-to-r from-cyan-900/20 to-purple-900/20 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-bold text-cyan-300">DEV Tools: Property Control</h2>
              <p className="text-cyan-400/70 text-sm mt-1">Select a property and choose an action</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-3xl font-light transition"
            >
              ×
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Left: Scrollable Property List */}
          <div className="w-full md:w-1/2 border-b md:border-b-0 md:border-r border-cyan-800/30 flex flex-col">
            <div className="p-6 flex-shrink-0">
              <h3 className="text-lg font-semibold text-white">Select Property ({allProperties.length})</h3>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {allProperties.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No properties in game</div>
              ) : (
                <div className="space-y-3">
                  {allProperties.map(({ id, base, address }) => {
                    const owner = game.players.find(p => p.address?.toLowerCase() === address?.toLowerCase()) ||
                      (address === "bank" ? { username: "Bank" } : { username: address?.slice(0, 8) + "..." });
                    const isSelected = selectedId === id;

                    return (
                      <button
                        key={id}
                        onClick={() => {
                          setSelectedId(id);
                          setTargetPlayerId(null);
                          setActiveTab("claim");
                        }}
                        className={`w-full p-5 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? "border-cyan-400 bg-cyan-900/40 shadow-lg shadow-cyan-500/40 ring-2 ring-cyan-400/50"
                            : "border-gray-700 hover:border-cyan-600/70 bg-gray-800/40"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-bold text-xl text-white">{base.name}</div>
                            <div className="text-cyan-300 mt-1">Price: ${base.price?.toLocaleString()}</div>
                            <div className="text-sm text-gray-400 mt-2">
                              Owner: <span className="text-cyan-200 font-medium">{owner?.username}</span>
                            </div>
                          </div>
                          {isSelected && <span className="text-3xl text-cyan-400 ml-4">✓</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions Panel */}
          <div className="w-full md:w-1/2 flex flex-col">
            <div className="flex-1 flex flex-col p-6">
              {!selected ? (
                <div className="h-full flex items-center justify-center text-gray-500">
                  <p className="text-xl text-center">← Select a property from the list to manage it</p>
                </div>
              ) : (
                <div className="space-y-6 flex-1 flex flex-col">
                  {/* Selected Property Preview */}
                  <div className="p-5 bg-gradient-to-br from-cyan-900/30 to-purple-900/30 rounded-xl border border-cyan-600/50 flex-shrink-0">
                    <h4 className="text-xl font-bold text-white">{selected.base.name}</h4>
                    <p className="text-cyan-300">Price: ${selected.base.price?.toLocaleString()}</p>
                    <p className="text-sm text-gray-300 mt-2">
                      Current owner: <span className="text-cyan-200 font-medium">{currentOwner?.username}</span>
                    </p>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 border-b border-gray-700 flex-shrink-0">
                    <button
                      onClick={() => setActiveTab("claim")}
                      className={`px-6 py-3 font-medium transition rounded-t-lg ${
                        activeTab === "claim"
                          ? "text-cyan-300 bg-cyan-900/30 border-b-3 border-cyan-300"
                          : "text-gray-500 hover:text-white"
                      }`}
                    >
                      Claim to Self
                    </button>
                    <button
                      onClick={() => setActiveTab("delete")}
                      className={`px-6 py-3 font-medium transition rounded-t-lg ${
                        activeTab === "delete"
                          ? "text-red-400 bg-red-900/20 border-b-3 border-red-400"
                          : "text-gray-500 hover:text-white"
                      }`}
                    >
                      Return to Bank
                    </button>
                    <button
                      onClick={() => setActiveTab("transfer")}
                      className={`px-6 py-3 font-medium transition rounded-t-lg ${
                        activeTab === "transfer"
                          ? "text-purple-400 bg-purple-900/20 border-b-3 border-purple-400"
                          : "text-gray-500 hover:text-white"
                      }`}
                    >
                      Transfer
                    </button>
                  </div>

                  {/* Action Content */}
                  <div className="flex-1 flex items-start justify-center">
                    <div className="w-full max-w-sm space-y-4">
                      {activeTab === "claim" && (
                        <button
                          onClick={() => onClaim(selected.id, me)}
                          className="w-full py-5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 rounded-xl text-white font-bold text-xl shadow-lg shadow-cyan-600/40 transition transform hover:scale-105"
                        >
                          Claim {selected.base.name} for Yourself
                        </button>
                      )}

                      {activeTab === "delete" && (
                        <button
                          onClick={() => onDelete(selected.id)}
                          className="w-full py-5 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 rounded-xl text-white font-bold text-xl shadow-lg shadow-red-600/40 transition transform hover:scale-105"
                        >
                          Return {selected.base.name} to Bank
                        </button>
                      )}

                      {activeTab === "transfer" && (
                        <>
                          <select
                            value={targetPlayerId ?? ""}
                            onChange={(e) => setTargetPlayerId(e.target.value ? Number(e.target.value) : null)}
                            className="w-full bg-gray-800 p-4 rounded-xl border border-gray-600 text-white focus:border-purple-500 focus:outline-none transition text-base"
                          >
                            <option value="">Choose recipient player...</option>
                            {eligibleRecipients.map((player) => (
                              <option key={player.user_id} value={player.user_id}>
                                {player.username} ({player.address?.slice(0, 6)}...{player.address?.slice(-4)})
                              </option>
                            ))}
                          </select>

                          {eligibleRecipients.length === 0 && (
                            <p className="text-sm text-gray-400 text-center">
                              No eligible recipients (must already own a property)
                            </p>
                          )}

                          <button
                            disabled={!targetPlayerId}
                            onClick={() => {
                              if (!targetPlayerId || !selected) return;

                              const targetPlayer = game.players.find(p => p.user_id === targetPlayerId);
                              if (!targetPlayer?.address) {
                                toast.error("Recipient has no wallet address");
                                return;
                              }

                              const realPlayerId = getRecipientPlayerId(targetPlayer.address);
                              if (!realPlayerId) {
                                toast.error("Could not find valid player_id for recipient");
                                return;
                              }

                              onTransfer(selected.id, realPlayerId, targetPlayer.address);
                            }}
                            className="w-full py-5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold text-xl shadow-lg shadow-purple-600/40 transition transform hover:scale-105 disabled:hover:scale-100"
                          >
                            Transfer to Selected Player
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}