"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Game, Player, Property, GameProperty } from "@/types/game";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { useEndAiGame, useGetGameByCode } from "@/context/ContractProvider";
import { ApiResponse } from "@/types/api";
import PlayerList from "./player-list";
import { MyEmpire } from "./my-empire";
import { TradeSection } from "./trade-section";
import { PropertyActionModal } from "../../modals/property-action";
import { AiResponsePopup } from "../../modals/ai-response";
import { VictoryModal } from "../../modals/victory";
import { TradeModal } from "../../modals/trade-mobile";
import { useGameTrades } from "@/hooks/useGameTrades";

import { isAIPlayer, calculateAiFavorability } from "@/utils/gameUtils";
import CollectibleInventoryBar from "@/components/collectibles/collectibles-invetory-mobile";

import { Sparkles, X } from "lucide-react";

interface GamePlayersProps {
  game: Game;
  properties: Property[];
  game_properties: GameProperty[];
  my_properties: Property[];
  me: Player | null;
  currentPlayer: Player | null;
  roll: { die1: number; die2: number; total: number } | null;
  isAITurn: boolean;
}

export default function MobileGamePlayers({
  game,
  properties,
  game_properties,
  my_properties,
  me,
  currentPlayer,
  isAITurn,
}: GamePlayersProps) {
  const { address } = useAccount();

  // Perks modal state
  const [showPerksModal, setShowPerksModal] = useState(false);

  // Trade-related states
  const [tradeModal, setTradeModal] = useState<{ open: boolean; target: Player | null }>({
    open: false,
    target: null,
  });
  const [counterModal, setCounterModal] = useState<{ open: boolean; trade: any | null }>({
    open: false,
    trade: null,
  });
  const [aiResponsePopup, setAiResponsePopup] = useState<any | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);
  const [endGameCandidate, setEndGameCandidate] = useState<{
    winner: Player | null;
    position: number;
    balance: bigint;
  }>({ winner: null, position: 0, balance: BigInt(0) });

  const [offerProperties, setOfferProperties] = useState<number[]>([]);
  const [requestProperties, setRequestProperties] = useState<number[]>([]);
  const [offerCash, setOfferCash] = useState<number>(0);
  const [requestCash, setRequestCash] = useState<number>(0);

  const { data: contractGame } = useGetGameByCode(game.code, { enabled: !!game.code });
  const onChainGameId = contractGame?.id;
  const { write: endGame, isPending: endGamePending, reset: endGameReset } = useEndAiGame(
    Number(onChainGameId),
    endGameCandidate.position,
    endGameCandidate.balance,
    !!endGameCandidate.winner
  );

  const isNext = !!me && game.next_player_id === me.user_id;

  const {
    openTrades,
    tradeRequests,
    closeAiTradePopup,
    refreshTrades,
  } = useGameTrades({
    gameId: game?.id,
    myUserId: me?.user_id,
    players: game?.players ?? [],
  });

  const resetTradeFields = () => {
    setOfferCash(0);
    setRequestCash(0);
    setOfferProperties([]);
    setRequestProperties([]);
  };

  const toggleSelect = (
    id: number,
    arr: number[],
    setter: React.Dispatch<React.SetStateAction<number[]>>
  ) => {
    setter((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const startTrade = (targetPlayer: Player) => {
    if (!isNext) {
      toast.error("Not your turn!");
      return;
    }
    setTradeModal({ open: true, target: targetPlayer });
    resetTradeFields();
  };

  const sortedPlayers = useMemo(
    () =>
      [...(game?.players ?? [])].sort(
        (a, b) => (a.turn_order ?? Infinity) - (b.turn_order ?? Infinity)
      ),
    [game?.players]
  );

  const handleCreateTrade = async () => {
    if (!me || !tradeModal.target) return;

    const targetPlayer = tradeModal.target;
    const isAI = isAIPlayer(targetPlayer);

    try {
      const payload = {
        game_id: game.id,
        player_id: me.user_id,
        target_player_id: targetPlayer.user_id,
        offer_properties: offerProperties,
        offer_amount: offerCash,
        requested_properties: requestProperties,
        requested_amount: requestCash,
        status: "pending",
      };

      const res = await apiClient.post<ApiResponse>("/game-trade-requests", payload);
      if (res?.data?.success) {
        toast.success("Trade sent successfully!");
        setTradeModal({ open: false, target: null });
        resetTradeFields();
        refreshTrades();

        if (isAI) {
          const sentTrade = {
            ...payload,
            id: res.data?.data?.id || Date.now(),
          };

          const favorability = calculateAiFavorability(sentTrade, properties);

          let decision: "accepted" | "declined" = "declined";
          let remark = "";

          if (favorability >= 30) {
            decision = "accepted";
            remark = "This is a fantastic deal! 🤖";
          } else if (favorability >= 10) {
            decision = Math.random() < 0.7 ? "accepted" : "declined";
            remark = decision === "accepted" ? "Fair enough, I'll take it." : "Not quite good enough.";
          } else if (favorability >= 0) {
            decision = Math.random() < 0.3 ? "accepted" : "declined";
            remark = decision === "accepted" ? "Okay, deal." : "Nah, too weak.";
          } else {
            remark = "This deal is terrible for me! 😤";
          }

          if (decision === "accepted") {
            await apiClient.post("/game-trade-requests/accept", { id: sentTrade.id });
            toast.success("AI accepted your trade instantly! 🎉");
            refreshTrades();
          }

          setAiResponsePopup({
            trade: sentTrade,
            favorability,
            decision,
            remark,
          });
        }
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to create trade");
    }
  };

  const handleTradeAction = async (id: number, action: "accepted" | "declined" | "counter") => {
    if (action === "counter") {
      const trade = tradeRequests.find((t) => t.id === id);
      if (trade) {
        setCounterModal({ open: true, trade });
        setOfferProperties(trade.requested_properties || []);
        setRequestProperties(trade.offer_properties || []);
        setOfferCash(trade.requested_amount || 0);
        setRequestCash(trade.offer_amount || 0);
      }
      return;
    }

    try {
      const res = await apiClient.post<ApiResponse>(
        `/game-trade-requests/${action === "accepted" ? "accept" : "decline"}`,
        { id }
      );
      if (res?.data?.success) {
        toast.success(`Trade ${action}`);
        closeAiTradePopup();
        refreshTrades();
      }
    } catch (error) {
      toast.error("Failed to update trade");
    }
  };

  const submitCounterTrade = async () => {
    if (!counterModal.trade) return;
    try {
      const payload = {
        offer_properties: offerProperties,
        offer_amount: offerCash,
        requested_properties: requestProperties,
        requested_amount: requestCash,
        status: "counter",
      };
      const res = await apiClient.put<ApiResponse>(`/game-trade-requests/${counterModal.trade.id}`, payload);
      if (res?.data?.success) {
        toast.success("Counter offer sent");
        setCounterModal({ open: false, trade: null });
        resetTradeFields();
        refreshTrades();
      }
    } catch (error) {
      toast.error("Failed to send counter trade");
    }
  };

  const handleDevelopment = async (id: number) => {
    if (!isNext || !me) return;
    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/development", {
        game_id: game.id,
        user_id: me.user_id,
        property_id: id,
      });
      if (res?.data?.success) toast.success("Property developed successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to develop property");
    }
  };

  const handleDowngrade = async (id: number) => {
    if (!isNext || !me) return;
    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/downgrade", {
        game_id: game.id,
        user_id: me.user_id,
        property_id: id,
      });
      if (res?.data?.success) toast.success("Property downgraded successfully");
      else toast.error(res.data?.message ?? "Failed to downgrade property");
    } catch (error: any) {
      toast.error(error?.message || "Failed to downgrade property");
    }
  };

  const handleMortgage = async (id: number) => {
    if (!isNext || !me) return;
    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/mortgage", {
        game_id: game.id,
        user_id: me.user_id,
        property_id: id,
      });
      if (res?.data?.success) toast.success("Property mortgaged successfully");
      else toast.error(res.data?.message ?? "Failed to mortgage property");
    } catch (error: any) {
      toast.error(error?.message || "Failed to mortgage property");
    }
  };

  const handleUnmortgage = async (id: number) => {
    if (!isNext || !me) return;
    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/unmortgage", {
        game_id: game.id,
        user_id: me.user_id,
        property_id: id,
      });
      if (res?.data?.success) toast.success("Property unmortgaged successfully");
      else toast.error(res.data?.message ?? "Failed to unmortgage property");
    } catch (error: any) {
      toast.error(error?.message || "Failed to unmortgage property");
    }
  };

  const handlePropertyTransfer = async (propertyId: number, newPlayerId: number, player_address: string) => {
    if (!propertyId || !newPlayerId) {
      toast("Cannot transfer: missing property or player");
      return;
    }

    try {
      const response = await apiClient.put<ApiResponse>(
        `/game-properties/${propertyId}`,
        {
          game_id: game.id,
          player_id: newPlayerId,
        }
      );

      if (response.data?.success) {
        toast.success("Property transferred successfully! 🎉");
      } else {
        throw new Error(response.data?.message || "Transfer failed");
      }
    } catch (error: any) {
      const message =
        error.response?.data?.message ||
        error.message ||
        "Failed to transfer property";

      toast.error(message);
      console.error("Property transfer failed:", error);
    }
  };

  const handleDeleteGameProperty = async (id: number) => {
    if (!id) return;
    try {
      const res = await apiClient.delete<ApiResponse>(`/game-properties/${id}`, {
        data: {
          game_id: game.id,
        }
      });
      if (res?.data?.success) toast.success("Property returned to bank successfully");
      else toast.error(res.data?.message ?? "Failed to return property");
    } catch (error: any) {
      toast.error(error?.message || "Failed to return property");
    }
  };

  const aiSellHouses = async (needed: number) => {
    const improved = game_properties
      .filter(gp => gp.address === currentPlayer?.address && (gp.development ?? 0) > 0)
      .sort((a, b) => {
        const pa = properties.find(p => p.id === a.property_id);
        const pb = properties.find(p => p.id === b.property_id);
        return (pb?.rent_hotel || 0) - (pa?.rent_hotel || 0);
      });

    let raised = 0;
    for (const gp of improved) {
      if (raised >= needed) break;
      const prop = properties.find(p => p.id === gp.property_id);
      if (!prop?.cost_of_house) continue;

      const sellValue = Math.floor(prop.cost_of_house / 2);
      const houses = gp.development ?? 0;

      for (let i = 0; i < houses && raised < needed; i++) {
        try {
          await apiClient.post("/game-properties/downgrade", {
            game_id: game.id,
            user_id: currentPlayer!.user_id,
            property_id: gp.property_id,
          });
          raised += sellValue;
          toast(`AI sold a house on ${prop.name} (raised $${raised})`);
        } catch (err) {
          console.error("AI failed to sell house", err);
          break;
        }
      }
    }
    return raised;
  };

  const aiMortgageProperties = async (needed: number) => {
    const unmortgaged = game_properties
      .filter(gp => gp.address === currentPlayer?.address && !gp.mortgaged && gp.development === 0)
      .map(gp => ({ gp, prop: properties.find(p => p.id === gp.property_id) }))
      .filter(({ prop }) => prop?.price)
      .sort((a, b) => (b.prop?.price || 0) - (a.prop?.price || 0));

    let raised = 0;
    for (const { gp, prop } of unmortgaged) {
      if (raised >= needed || !prop) continue;
      const mortgageValue = Math.floor(prop.price / 2);
      try {
        await apiClient.post("/game-properties/mortgage", {
          game_id: game.id,
          user_id: currentPlayer!.user_id,
          property_id: gp.property_id,
        });
        raised += mortgageValue;
        toast(`AI mortgaged ${prop.name} (raised $${raised})`);
      } catch (err) {
        console.error("AI failed to mortgage", err);
      }
    }
    return raised;
  };

  const getGamePlayerId = (walletAddress: string | undefined): number | null => {
    if (!walletAddress) return null;
    const ownedProp = game_properties.find(gp => gp.address?.toLowerCase() === walletAddress.toLowerCase());
    return ownedProp?.player_id ?? null;
  };

  const handleClaimProperty = async (propertyId: number, player: Player) => {
    const gamePlayerId = getGamePlayerId(player.address);

    if (!gamePlayerId) {
      toast.error("Cannot claim: unable to determine your game player ID");
      return;
    }

    const toastId = toast.loading(`Claiming property #${propertyId}...`);

    try {
      const payload = {
        game_id: game.id,
        player_id: gamePlayerId,
      };

      const res = await apiClient.put<ApiResponse>(`/game-properties/${propertyId}`, payload);

      if (res.data?.success) {
        toast.success(
          `You now own ${res.data.data?.property_name || `#${propertyId}`}!`,
          { id: toastId }
        );
      } else {
        throw new Error(res.data?.message || "Claim unsuccessful");
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Failed to claim property";
      console.error("Claim failed:", err);
      toast.error(errorMessage, { id: toastId });
    }
  };

  useEffect(() => {
    if (!isAITurn || !currentPlayer || currentPlayer.balance >= 0) return;

    const handleAiLiquidationAndPossibleBankruptcy = async () => {
      toast(`${currentPlayer.username} cannot pay — attempting to raise funds...`);

      const raisedFromHouses = await aiSellHouses(Infinity);
      const raisedFromMortgages = await aiMortgageProperties(Infinity);
      const totalRaised = raisedFromHouses + raisedFromMortgages;

      if (currentPlayer.balance >= 0) {
        toast.success(`${currentPlayer.username} raised $${totalRaised} and survived! 💪`);
        return;
      }

      toast(`${currentPlayer.username} still cannot pay — bankrupt!`);

      try {
        try {
          await apiClient.post("/game-players/end-turn", {
            user_id: currentPlayer.user_id,
            game_id: game.id,
          });
        } catch (err) {
          console.warn("Failed to end AI turn before bankruptcy", err);
        }

        const landedGameProperty = game_properties.find(
          gp => gp.property_id === currentPlayer.position
        );

        const creditorAddress =
          landedGameProperty?.address && landedGameProperty.address !== "bank"
            ? landedGameProperty.address
            : null;

        const creditorPlayer = creditorAddress
          ? game.players.find(
              p => p.address?.toLowerCase() === creditorAddress.toLowerCase()
            )
          : null;

        const aiProperties = game_properties.filter(
          gp => gp.address === currentPlayer.address
        );

        let successCount = 0;

        if (creditorPlayer && !isAIPlayer(creditorPlayer)) {
          const creditorRealPlayerId = getGamePlayerId(creditorPlayer.address);

          if (!creditorRealPlayerId) {
            toast.error(`Cannot transfer: ${creditorPlayer.username} has no valid player_id`);
            for (const prop of aiProperties) {
              await handleDeleteGameProperty(prop.id);
              successCount++;
            }
          } else {
            toast(`Transferring properties to ${creditorPlayer.username}...`);
            for (const prop of aiProperties) {
              try {
                await handlePropertyTransfer(prop.id, creditorRealPlayerId, "");
                successCount++;
              } catch (err) {
                console.error(`Transfer failed for property ${prop.id}`, err);
              }
            }
            toast.success(
              `${successCount}/${aiProperties.length} properties transferred to ${creditorPlayer.username}!`
            );
          }
        } else {
          toast(`Returning properties to bank...`);
          for (const prop of aiProperties) {
            try {
              await handleDeleteGameProperty(prop.id);
              successCount++;
            } catch (err) {
              console.error(`Delete failed for property ${prop.id}`, err);
            }
          }
          toast.success(`${successCount}/${aiProperties.length} properties returned to bank.`);
        }

        await apiClient.post("/game-players/leave", {
          address: currentPlayer.address,
          code: game.code,
          reason: "bankruptcy",
        });

        toast.success(`${currentPlayer.username} has been eliminated.`, { duration: 6000 });
      } catch (err: any) {
        console.error("Bankruptcy handling failed:", err);
        toast.error("AI bankruptcy process failed");
      }
    };

    handleAiLiquidationAndPossibleBankruptcy();
  }, [isAITurn, currentPlayer?.balance, currentPlayer, game_properties, game.id, game.code, game.players]);

  useEffect(() => {
    if (!me || game.players.length !== 2) return;

    const aiPlayer = game.players.find(p => isAIPlayer(p));
    const humanPlayer = me;

    if ((!aiPlayer || aiPlayer.balance <= 0) && humanPlayer.balance > 0) {
      setWinner(humanPlayer);
      setEndGameCandidate({
        winner: humanPlayer,
        position: humanPlayer.position ?? 0,
        balance: BigInt(humanPlayer.balance),
      });
    }
  }, [game.players, me]);

  const handleFinalizeAndLeave = async () => {
    const toastId = toast.loading(
      winner?.user_id === me?.user_id
        ? "Claiming your prize..."
        : "Finalizing game..."
    );

    try {
      if (endGame) await endGame();

      toast.success(
        winner?.user_id === me?.user_id
          ? "Prize claimed! 🎉"
          : "Game completed — thanks for playing!",
        { id: toastId, duration: 5000 }
      );

      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch (err: any) {
      toast.error(
        err?.message || "Something went wrong — try again later",
        { id: toastId, duration: 8000 }
      );
    } finally {
      if (endGameReset) endGameReset();
    }
  };

  // Persistent collapsible states — survives re-renders!
  const [sectionOpen, setSectionOpen] = useState<{
    players: boolean;
    empire: boolean;
    trades: boolean;
  }>({
    players: true,
    empire: false,
    trades: false, // will be auto-opened below if needed
  });

  const totalActiveTrades = openTrades.length + tradeRequests.length;

  // Auto-open trades section when new trades appear
  useEffect(() => {
    if (totalActiveTrades > 0) {
      setSectionOpen(prev => ({ ...prev, trades: true }));
    }
  }, [totalActiveTrades]);

  // Controlled Collapsible Section
  const CollapsibleSection = ({
    title,
    children,
    isOpen,
    onToggle,
    badgeCount,
    borderColor = "purple-500",
  }: {
    title: string;
    children: React.ReactNode;
    isOpen: boolean;
    onToggle: () => void;
    badgeCount?: number;
    borderColor?: string;
  }) => {
    return (
      <section className={`bg-black/30 backdrop-blur-sm rounded-2xl border border-${borderColor}/30 shadow-lg overflow-hidden relative`}>
        {badgeCount !== undefined && badgeCount > 0 && (
          <div className="absolute -top-3 -right-3 w-10 h-10 bg-gradient-to-br from-pink-500 to-red-600 rounded-full flex items-center justify-center text-white text-sm font-bold animate-pulse shadow-lg z-10">
            {badgeCount}
          </div>
        )}
        <button
          onClick={onToggle}
          className="w-full px-5 py-4 flex items-center justify-between text-left"
        >
          <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-400">
            {title}
          </h3>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            className="text-cyan-300"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </motion.div>
        </button>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-6 pt-2">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    );
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-[#0a001a] via-[#15082a] to-[#1a0033] text-white relative overflow-x-hidden">
      {/* Top Neon Glow Bar */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-pink-500 via-cyan-400 to-purple-600 shadow-lg shadow-cyan-400/70 z-50" />

      {/* Header */}
      <div className="relative z-10 px-4 pt-5 pb-3 backdrop-blur-xl bg-black/30 border-b border-purple-500/40">
        <motion.h2
          animate={{
            textShadow: ["0 0 10px #06b6d4", "0 0 20px #06b6d4", "0 0 10px #06b6d4"],
          }}
          transition={{ duration: 3, repeat: Infinity }}
          className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-400 text-center tracking-wider"
        >
          PLAYERS
        </motion.h2>

        <div className="mt-2 text-center text-sm text-purple-200 opacity-80">
          Game Code: <span className="font-mono font-bold text-cyan-300">{game.code}</span>
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="px-4 py-6 space-y-6 pb-32">
        {/* Players Section */}
        <CollapsibleSection
          title="PLAYERS"
          isOpen={sectionOpen.players}
          onToggle={() => setSectionOpen(prev => ({ ...prev, players: !prev.players }))}
          borderColor="purple-500"
        >
          <PlayerList
            game={game}
            sortedPlayers={sortedPlayers}
            startTrade={startTrade}
            isNext={isNext}
          />
        </CollapsibleSection>

        {/* My Empire */}
        <CollapsibleSection
          title="MY EMPIRE"
          isOpen={sectionOpen.empire}
          onToggle={() => setSectionOpen(prev => ({ ...prev, empire: !prev.empire }))}
          borderColor="cyan-500"
        >
          <MyEmpire
            showEmpire={true}
            toggleEmpire={() => {}}
            my_properties={my_properties}
            properties={properties}
            game_properties={game_properties}
            setSelectedProperty={setSelectedProperty}
          />
        </CollapsibleSection>

        {/* Active Trades */}
        <CollapsibleSection
          title={`ACTIVE TRADES${totalActiveTrades > 0 ? ` (${totalActiveTrades})` : ""}`}
          isOpen={sectionOpen.trades}
          onToggle={() => setSectionOpen(prev => ({ ...prev, trades: !prev.trades }))}
          badgeCount={totalActiveTrades > 0 ? totalActiveTrades : undefined}
          borderColor="pink-500"
        >
          <TradeSection
            showTrade={true}
            toggleTrade={() => {}}
            openTrades={openTrades}
            tradeRequests={tradeRequests}
            properties={properties}
            game={game}
            handleTradeAction={handleTradeAction}
          />
        </CollapsibleSection>
      </div>

      {/* Floating Perks Button */}
      <button
        onClick={() => setShowPerksModal(true)}
        className="fixed bottom-20 right-6 z-40 w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 shadow-2xl shadow-cyan-500/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
      >
        <Sparkles className="w-8 h-8 text-black" />
      </button>

      {/* Perks Full-Screen Modal */}
      <AnimatePresence>
        {showPerksModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPerksModal(false)}
              className="fixed inset-0 bg-black/80 z-50"
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 top-16 z-50 bg-[#0A1C1E] rounded-t-3xl border-t border-cyan-500/50 overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-cyan-900/50 flex items-center justify-between">
                <h2 className="text-3xl font-bold flex items-center gap-4">
                  <Sparkles className="w-10 h-10 text-[#00F0FF]" />
                  My Perks
                </h2>
                <button
                  onClick={() => setShowPerksModal(false)}
                  className="text-gray-400 hover:text-white p-2"
                >
                  <X className="w-8 h-8" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-8">
                <CollectibleInventoryBar
                  game={game}
                  game_properties={game_properties}
                  isMyTurn={isNext}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* All Other Modals */}
      <AnimatePresence>
        <PropertyActionModal
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          onDevelop={handleDevelopment}
          onDowngrade={handleDowngrade}
          onMortgage={handleMortgage}
          onUnmortgage={handleUnmortgage}
        />

        <AiResponsePopup
          popup={aiResponsePopup}
          properties={properties}
          onClose={() => setAiResponsePopup(null)}
        />

        <VictoryModal
          winner={winner}
          me={me}
          onClaim={handleFinalizeAndLeave}
          claiming={endGamePending}
        />

        <TradeModal
          open={tradeModal.open}
          title={`Trade with ${tradeModal.target?.username || "Player"}`}
          onClose={() => {
            setTradeModal({ open: false, target: null });
            resetTradeFields();
          }}
          onSubmit={handleCreateTrade}
          my_properties={my_properties}
          properties={properties}
          game_properties={game_properties}
          offerProperties={offerProperties}
          requestProperties={requestProperties}
          setOfferProperties={setOfferProperties}
          setRequestProperties={setRequestProperties}
          offerCash={offerCash}
          requestCash={requestCash}
          setOfferCash={setOfferCash}
          setRequestCash={setRequestCash}
          toggleSelect={toggleSelect}
          targetPlayerAddress={tradeModal.target?.address}
        />

        <TradeModal
          open={counterModal.open}
          title="Counter Offer"
          onClose={() => {
            setCounterModal({ open: false, trade: null });
            resetTradeFields();
          }}
          onSubmit={submitCounterTrade}
          my_properties={my_properties}
          properties={properties}
          game_properties={game_properties}
          offerProperties={offerProperties}
          requestProperties={requestProperties}
          setOfferProperties={setOfferProperties}
          setRequestProperties={setRequestProperties}
          offerCash={offerCash}
          requestCash={requestCash}
          setOfferCash={setOfferCash}
          setRequestCash={setRequestCash}
          toggleSelect={toggleSelect}
          targetPlayerAddress={
            game.players.find((p) => p.user_id === counterModal.trade?.target_player_id)?.address
          }
        />
      </AnimatePresence>
    </div>
  );
}