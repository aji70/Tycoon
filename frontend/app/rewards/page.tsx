'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown,
  DollarSign,
  Wallet,
  Package,
  AlertTriangle,
  Settings,
  PlusCircle,
  Gift,
  Gem,
  Banknote,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Edit2,
  Ticket,
  Star,
  Gamepad2,
  Shield,
  Swords,
  Trash2,
  Loader2,
  BookOpen,
  Copy,
} from 'lucide-react';

import {
  CollectiblePerk,
  PERK_NAMES,
  INITIAL_COLLECTIBLES,
} from '@/components/rewards/rewardsConstants';
import { AnimatedCounter } from '@/components/rewards/AnimatedCounter';
import { useRewardsAdmin } from './useRewardsAdmin';
import EscrowAdminSection from '@/components/admin/EscrowAdminSection';
import { apiClient } from '@/lib/api';

export default function RewardAdminPanel() {
  const {
    auth,
    state,
    contract,
    handlers,
    pending,
  } = useRewardsAdmin();

  const {
    activeSection,
    setActiveSection,
    status,
    isPaused,
    backendMinter,
    owner,
    totalGames,
    totalUsers,
    newMinter,
    setNewMinter,
    voucherRecipient,
    setVoucherRecipient,
    voucherValue,
    setVoucherValue,
    collectibleRecipient,
    setCollectibleRecipient,
    selectedPerk,
    setSelectedPerk,
    collectibleStrength,
    setCollectibleStrength,
    restockTokenId,
    setRestockTokenId,
    restockAmount,
    setRestockAmount,
    updateTokenId,
    setUpdateTokenId,
    updateTycPrice,
    setUpdateTycPrice,
    updateUsdcPrice,
    setUpdateUsdcPrice,
    withdrawToken,
    setWithdrawToken,
    withdrawAmount,
    setWithdrawAmount,
    withdrawTo,
    setWithdrawTo,
    tycoonMinStake,
    setTycoonMinStake,
    tycoonMinTurnsForPerks,
    setTycoonMinTurnsForPerks,
    tycoonGameController,
    setTycoonGameController,
    tycoonLogicContract,
    setTycoonLogicContract,
    tycoonUserRegistry,
    setTycoonUserRegistry,
    tycoonGameFaucet,
    setTycoonGameFaucet,
    tycoonRewardSystem,
    setTycoonRewardSystem,
    createWalletPlayerAddress,
    setCreateWalletPlayerAddress,
    readTestTokenId,
    setReadTestTokenId,
    tycoonReads,
    rewardTycToken,
    rewardUsdc,
    cashTierValues,
    readTestCollectibleInfo,
    readTestCollectibleInfoLoading,
    checkRegisteredAddress,
    setCheckRegisteredAddress,
    isRegistered,
    isRegisteredLoading,
    addressToUsername,
    hasSmartWallet,
    hasSmartWalletLoading,
    vaultNairaAddress,
    vaultUsdcTokenAddress,
    vaultCeloBalance,
    vaultUsdcBalance,
    vaultUsdcDecimals,
    vaultWithdrawAmount,
    setVaultWithdrawAmount,
    vaultWithdrawTo,
    setVaultWithdrawTo,
    vaultWithdrawUsdcAmount,
    setVaultWithdrawUsdcAmount,
    vaultWithdrawUsdcTo,
    setVaultWithdrawUsdcTo,
    stockAllProgress,
  } = state;

  const [adminTournaments, setAdminTournaments] = useState<{ id: number; name: string; code?: string; status: string; participant_count?: number; max_players: number }[]>([]);
  const [adminTournamentsLoading, setAdminTournamentsLoading] = useState(false);
  const [adminTournamentsError, setAdminTournamentsError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [vaultCopyFeedback, setVaultCopyFeedback] = useState(false);

  const fetchAdminTournaments = useCallback(async () => {
    setAdminTournamentsLoading(true);
    setAdminTournamentsError(null);
    try {
      const res = await apiClient.get<{ id: number; name: string; code?: string; status: string; participant_count?: number; max_players: number }[]>("tournaments", { limit: 100 });
      const data = res?.data;
      const list = Array.isArray(data) ? data : [];
      setAdminTournaments(list);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as { message?: string })?.message ?? "Failed to load tournaments";
      setAdminTournamentsError(msg);
      setAdminTournaments([]);
    } finally {
      setAdminTournamentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === "tournaments") fetchAdminTournaments();
  }, [activeSection, fetchAdminTournaments]);

  const handleDeleteTournament = useCallback(async (id: number) => {
    setDeletingId(id);
    try {
      await apiClient.delete(`tournaments/${id}`);
      setAdminTournaments((prev) => prev.filter((t) => t.id !== id));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as { message?: string })?.message ?? "Delete failed";
      setAdminTournamentsError(msg);
    } finally {
      setDeletingId(null);
    }
  }, []);

  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('section') === 'stock') setActiveSection('stock');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const { tokenCount, allTokens, tycBalance, usdcBalance, bundleDefsForStock } = contract;
  const { anyPending, currentTxHash, pendingMinter, pendingVoucher, pendingCollectible, pendingStock, pendingStockBundle, pendingRestock, pendingUpdate, pendingPause, pendingWithdraw, pendingTycoonMinStake, pendingTycoonMinTurns, pendingTycoonController, pendingTycoonLogic, pendingTycoonUserRegistry, pendingTycoonGameFaucet, pendingTycoonRewardSystem, pendingCreateWallet, pendingVaultWithdraw } = pending;

  if (!auth.isConnected || !auth.userAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0f1a] to-[#0f1a27]">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="p-10 bg-red-950/60 rounded-3xl border border-red-700/50 text-center"
        >
          <AlertTriangle className="w-16 h-16 mx-auto mb-6 text-red-400" />
          <h2 className="text-3xl font-bold">Wallet Not Connected</h2>
          <p className="text-gray-400 mt-2">Connect your wallet to access admin features</p>
        </motion.div>
      </div>
    );
  }

  if (!auth.contractAddress) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0f1a] to-[#0f1a27] text-rose-400 text-2xl">
        No Reward contract deployed on chain {auth.chainId}
      </div>
    );
  }

  if (!auth.isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0f1a] to-[#0f1a27]">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="p-10 bg-red-950/60 rounded-3xl border border-red-700/50 text-center"
        >
          <AlertTriangle className="w-16 h-16 mx-auto mb-6 text-red-400" />
          <h2 className="text-3xl font-bold">Access Denied</h2>
          <p className="text-gray-400 mt-2">Only the contract owner can access this panel</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1a] via-[#0d141f] to-[#0f1a27] text-white py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl md:text-6xl font-extrabold mb-4 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Tycoon Admin Panel
          </h1>
          <p className="text-xl text-gray-400">
            Manage minter • Mint items • Stock shop • Update prices • Control contract
          </p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-4 mb-10">
          {(['overview', 'mint', 'stock', 'manage', 'tycoon', 'escrow', 'tournaments', 'funds', 'vault', 'reads'] as const).map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                activeSection === section
                  ? 'bg-gradient-to-r from-cyan-600 to-purple-600 shadow-lg'
                  : 'bg-gray-800/60 hover:bg-gray-700/50'
              }`}
            >
              {section === 'overview' && <Settings className="w-5 h-5" />}
              {section === 'mint' && <PlusCircle className="w-5 h-5" />}
              {section === 'stock' && <Package className="w-5 h-5" />}
              {section === 'manage' && <Edit2 className="w-5 h-5" />}
              {section === 'tycoon' && <Gamepad2 className="w-5 h-5" />}
              {section === 'escrow' && <Shield className="w-5 h-5" />}
              {section === 'tournaments' && <Swords className="w-5 h-5" />}
              {section === 'funds' && <Wallet className="w-5 h-5" />}
              {section === 'vault' && <Banknote className="w-5 h-5" />}
              {section === 'reads' && <BookOpen className="w-5 h-5" />}
              {section === 'tycoon' ? 'Game Contract' : section === 'escrow' ? 'Tournament Escrow' : section === 'tournaments' ? 'Tournaments' : section === 'vault' ? 'Naira Vault' : section === 'reads' ? 'Reads' : section.charAt(0).toUpperCase() + section.slice(1)}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-8 p-6 rounded-2xl border text-center max-w-2xl mx-auto ${
                status.type === 'success'
                  ? 'bg-green-900/40 border-green-600'
                  : status.type === 'error'
                  ? 'bg-red-900/40 border-red-600'
                  : 'bg-blue-900/40 border-blue-600'
              }`}
            >
              <p className="font-medium">{status.message}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {activeSection === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Settings className="w-6 h-6 text-cyan-400" /> Contract Status
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-lg">
                <div>
                  Paused: <span className={isPaused ? 'text-red-400' : 'text-green-400'}>{isPaused ? 'Yes' : 'No'}</span>
                </div>
                <div>
                  Owner: <span className="font-mono text-sm">{owner ? `${owner.slice(0, 8)}...${owner.slice(-6)}` : '—'}</span>
                </div>
                <div>
                  Backend Minter: <span className="font-mono text-sm">{backendMinter ? `${backendMinter.slice(0, 8)}...${backendMinter.slice(-6)}` : 'Not set'}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Crown className="w-6 h-6 text-purple-400" /> Platform Statistics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-lg">
                <div>
                  Total Games Created: <motion.span className="text-green-400 font-bold" initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ duration: 0.5 }}><AnimatedCounter to={totalGames} /></motion.span>
                </div>
                <div>
                  Total Users Registered: <motion.span className="text-green-400 font-bold" initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ duration: 0.5 }}><AnimatedCounter to={totalUsers} /></motion.span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-bold mb-8 flex items-center gap-3">
                <Package className="w-8 h-8 text-purple-400" /> Contract Token Holdings
              </h3>

              {tokenCount === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <Package className="w-20 h-20 mx-auto mb-4 opacity-30" />
                  <p>No tokens held by contract yet</p>
                </div>
              ) : allTokens.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <div className="animate-pulse">Loading {tokenCount} tokens...</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {allTokens.map((item) => (
                    <motion.div
                      key={item.tokenId.toString()}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.05 }}
                      className={`relative overflow-hidden rounded-2xl border-2 p-6 text-center transition-all ${
                        item.type === 'voucher'
                          ? 'bg-gradient-to-br from-amber-900/40 to-orange-900/40 border-amber-600'
                          : 'bg-gradient-to-br from-purple-900/40 to-pink-900/40 border-purple-600'
                      }`}
                    >
                      <div className="absolute inset-0 bg-white/5 backdrop-blur-xl" />
                      <div className="relative z-10">
                        <div className={`mx-auto mb-4 p-4 rounded-full ${item.type === 'voucher' ? 'bg-amber-900/60' : 'bg-purple-900/60'}`}>
                          {item.type === 'voucher' ? <Ticket className="w-12 h-12" /> : <Star className="w-12 h-12" />}
                        </div>
                        <h4 className="font-bold text-lg mb-2 truncate">{item.name}</h4>
                        <p className="text-xs opacity-80 mb-4">ID: {item.tokenId.toString()}</p>
                        <div className="text-2xl font-bold text-emerald-400">{item.stock.toString()}</div>
                        <p className="text-xs opacity-75">In Stock</p>

                        {item.type === 'collectible' && item.tycPrice > 0 && (
                          <div className="mt-4 pt-4 border-t border-white/20">
                            {/* <p className="text-xs">
                              <span className="text-emerald-300">{formatUnits(item.tycPrice, 18)}</span> TYC
                            </p> */}
                            <p className="text-xs">
                              <span className="text-cyan-300">{formatUnits(item.usdcPrice, 6)}</span> USDC
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeSection === 'mint' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Gift className="w-6 h-6 text-blue-400" /> Mint Voucher
              </h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Recipient Address"
                  value={voucherRecipient}
                  onChange={(e) => setVoucherRecipient(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="TYC Value (e.g. 10)"
                  value={voucherValue}
                  onChange={(e) => setVoucherValue(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handlers.handleMintVoucher}
                  disabled={anyPending || !voucherRecipient || !voucherValue}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {pendingVoucher ? 'Minting...' : 'Mint Voucher'}
                </button>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Gem className="w-6 h-6 text-purple-400" /> Mint Collectible
              </h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Recipient Address"
                  value={collectibleRecipient}
                  onChange={(e) => setCollectibleRecipient(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <select
                  value={selectedPerk}
                  onChange={(e) => setSelectedPerk(Number(e.target.value) as CollectiblePerk)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 text-white"
                >
                  {Object.entries(PERK_NAMES).map(([value, name]) => (
                    <option key={value} value={value}>
                      {name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Strength (for tiered perks)"
                  value={collectibleStrength}
                  onChange={(e) => setCollectibleStrength(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={handlers.handleMintCollectible}
                  disabled={anyPending || !collectibleRecipient}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {pendingCollectible ? 'Minting...' : 'Mint Collectible'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeSection === 'stock' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-2 justify-center">
              <Package className="w-8 h-8 text-green-400" /> Stock Shop (50 Units Each)
            </h3>
            <p className="text-center text-gray-400 mb-6">
              Click any item to stock 50 units with pre-set prices, or stock all at once below.
            </p>

            <div className="flex justify-center mb-8">
              <button
                type="button"
                onClick={() => handlers.handleStockAllPerks()}
                disabled={anyPending || stockAllProgress.active}
                className="px-6 py-3 rounded-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {stockAllProgress.active
                  ? `Stocking ${stockAllProgress.current}/${stockAllProgress.total}…`
                  : 'Stock 50 of Each Perk'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {INITIAL_COLLECTIBLES.map((item) => (
                <motion.div
                  key={`${item.perk}-${item.strength}`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="rounded-2xl p-6 border-2 cursor-pointer transition-all text-center bg-gray-800/40 border-gray-700 hover:border-green-500/50"
                  onClick={() => {
                    setSelectedPerk(item.perk);
                    setCollectibleStrength(String(item.strength));
                  }}
                >
                  <div className="flex flex-col items-center mb-4">
                    <div className="p-4 rounded-full mb-3 bg-gray-700/50">
                      {item.icon}
                    </div>
                    <h4 className="font-bold text-lg">{item.name}</h4>
                    {item.strength > 1 && <p className="text-sm text-gray-400">Tier {item.strength}</p>}
                  </div>

                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-emerald-300">
                      <span className="font-semibold">{item.tycPrice} TYC</span>
                    </p>
                    <p className="text-sm text-cyan-300 font-semibold">
                      {item.usdcPrice} USDC
                    </p>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlers.handleStockShop(item.perk, item.strength);
                    }}
                    disabled={anyPending}
                    className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-xl font-bold transition disabled:opacity-50 shadow-md"
                  >
                    {pendingStock ? 'Stocking...' : 'Stock 50 Units'}
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Stock Bundles — register on-chain bundles (perks must be stocked first) */}
            <div className="mt-12 pt-8 border-t border-gray-700/50">
              <h4 className="text-lg font-bold mb-2 flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" /> Stock Bundles
              </h4>
              <p className="text-gray-400 text-sm mb-6">
                Register bundles so users can buy them in one go. Stock the perks above first, then add each bundle here.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {(bundleDefsForStock ?? []).map((bundle) => (
                  <div
                    key={bundle.name}
                    className="rounded-xl p-4 border border-amber-500/20 bg-gray-800/40"
                  >
                    <h5 className="font-semibold text-white mb-1">{bundle.name}</h5>
                    <p className="text-xs text-gray-500 mb-3">
                      {bundle.items.length} perk{bundle.items.length !== 1 ? 's' : ''} · ${bundle.price_usdc} USDC
                    </p>
                    <button
                      type="button"
                      onClick={() => handlers.handleStockBundle(bundle.name)}
                      disabled={anyPending || pendingStockBundle}
                      className="w-full py-2.5 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {pendingStockBundle ? 'Stocking…' : 'Stock bundle on-chain'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeSection === 'manage' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Settings className="w-6 h-6 text-yellow-400" /> Set Backend Minter
              </h3>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="New Minter Address"
                  value={newMinter}
                  onChange={(e) => setNewMinter(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
                <button
                  onClick={handlers.handleSetBackendMinter}
                  disabled={anyPending || !newMinter}
                  className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {pendingMinter ? 'Setting...' : 'Set Minter'}
                </button>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <PauseCircle className="w-6 h-6 text-red-400" /> Contract Control
              </h3>
              <div className="flex gap-4">
                <button
                  onClick={() => handlers.pause()}
                  disabled={anyPending || isPaused}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {pendingPause ? 'Pausing...' : 'Pause'}
                </button>
                <button
                  onClick={() => handlers.unpause()}
                  disabled={anyPending || !isPaused}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {pendingPause ? 'Unpausing...' : 'Unpause'}
                </button>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <RefreshCw className="w-6 h-6 text-blue-400" /> Restock Collectible
              </h3>
              <div className="space-y-4">
                <input
                  type="number"
                  placeholder="Token ID"
                  value={restockTokenId}
                  onChange={(e) => setRestockTokenId(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Amount to Add"
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handlers.handleRestock}
                  disabled={anyPending || !restockTokenId || !restockAmount}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {pendingRestock ? 'Restocking...' : 'Restock'}
                </button>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-green-400" /> Update Prices
              </h3>
              <div className="space-y-4">
                <input
                  type="number"
                  placeholder="Token ID"
                  value={updateTokenId}
                  onChange={(e) => setUpdateTokenId(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="New TYC Price"
                  value={updateTycPrice}
                  onChange={(e) => setUpdateTycPrice(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="New USDC Price"
                  value={updateUsdcPrice}
                  onChange={(e) => setUpdateUsdcPrice(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  onClick={handlers.handleUpdatePrices}
                  disabled={anyPending || !updateTokenId}
                  className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold transition disabled:opacity-50"
                >
                  {pendingUpdate ? 'Updating...' : 'Update Prices'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeSection === 'escrow' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto">
            <EscrowAdminSection />
          </motion.div>
        )}

        {activeSection === 'tournaments' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto">
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Swords className="w-8 h-8 text-cyan-400" /> Manage Tournaments
              </h3>
              <p className="text-gray-400 mb-6">Delete tournaments from the database. This cannot be undone.</p>
              {adminTournamentsLoading && (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                </div>
              )}
              {adminTournamentsError && (
                <p className="text-red-400 py-4">{adminTournamentsError}</p>
              )}
              {!adminTournamentsLoading && adminTournaments.length === 0 && !adminTournamentsError && (
                <p className="text-center text-white/60 py-12">No tournaments.</p>
              )}
              {!adminTournamentsLoading && adminTournaments.length > 0 && (
                <div className="space-y-3">
                  {adminTournaments.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-4 py-3 px-4 rounded-xl bg-gray-800/60 border border-gray-700/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white truncate">{t.name}</p>
                        <p className="text-sm text-gray-400">
                          ID: {t.id}
                          {t.code != null && t.code !== "" && ` · Code: ${t.code}`}
                          {" · "}
                          {t.status.replace(/_/g, " ")}
                          {typeof t.participant_count === "number" && ` · ${t.participant_count}/${t.max_players} players`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteTournament(t.id)}
                        disabled={deletingId !== null}
                        className="shrink-0 px-4 py-2 rounded-lg bg-red-600/80 hover:bg-red-500 text-white font-medium transition disabled:opacity-50 flex items-center gap-2"
                      >
                        {deletingId === t.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeSection === 'tycoon' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-8">
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                <Gamepad2 className="w-8 h-8 text-cyan-400" /> Tycoon Game Contract (Upgradeable)
              </h3>
              <p className="text-gray-400 mb-6">
                Owner-only settings. When using the upgradeable proxy: set logic contract, user registry, game faucet, and reward system. Min stake is in USDC (e.g. 1 = 1 USDC). Game controller can call removePlayerFromGame, setTurnCount, transferPropertyOwnership.
              </p>
              {tycoonReads.isLoading ? (
                <div className="text-gray-400">Loading...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-600/50">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Min Stake (USDC)</label>
                    <p className="text-xs text-gray-500 mb-2">Minimum USDC per player to join a staked game (6 decimals).</p>
                    <input
                      type="text"
                      placeholder="e.g. 1"
                      value={tycoonMinStake}
                      onChange={(e) => setTycoonMinStake(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-3"
                    />
                    <button
                      onClick={handlers.handleSetTycoonMinStake}
                      disabled={anyPending || !tycoonMinStake}
                      className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold transition disabled:opacity-50"
                    >
                      {pendingTycoonMinStake ? 'Updating...' : 'Set Min Stake'}
                    </button>
                  </div>
                  <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-600/50">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Min Turns for Perks</label>
                    <p className="text-xs text-gray-500 mb-2">Minimum turns played to get full exit perks (0 = disabled).</p>
                    <input
                      type="number"
                      min="0"
                      placeholder={tycoonReads.minTurnsForPerks?.toString() ?? '0'}
                      value={tycoonMinTurnsForPerks}
                      onChange={(e) => setTycoonMinTurnsForPerks(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-3"
                    />
                    <button
                      onClick={handlers.handleSetTycoonMinTurnsForPerks}
                      disabled={anyPending || tycoonMinTurnsForPerks === ''}
                      className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold transition disabled:opacity-50"
                    >
                      {pendingTycoonMinTurns ? 'Updating...' : 'Set Min Turns'}
                    </button>
                  </div>
                  <div className="md:col-span-2 bg-gray-800/50 rounded-xl p-6 border border-gray-600/50">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Backend Game Controller</label>
                    <p className="text-xs text-gray-500 mb-2">Address allowed to call removePlayerFromGame, setTurnCount, transferPropertyOwnership. Use 0x0 to clear.</p>
                    <input
                      type="text"
                      placeholder="0x..."
                      value={tycoonGameController}
                      onChange={(e) => setTycoonGameController(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-3 font-mono text-sm"
                    />
                    <button
                      onClick={handlers.handleSetTycoonGameController}
                      disabled={anyPending || !tycoonGameController.trim()}
                      className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold transition disabled:opacity-50"
                    >
                      {pendingTycoonController ? 'Updating...' : 'Set Game Controller'}
                    </button>
                  </div>
                  <div className="md:col-span-2 bg-gray-800/50 rounded-xl p-6 border border-cyan-900/50">
                    <label className="block text-sm font-medium text-cyan-200 mb-2">Logic Contract (Upgradeable)</label>
                    <p className="text-xs text-gray-500 mb-2">Delegatecall target for game logic (TycoonUpgradeableLogic). Required for Celo size limit.</p>
                    <input
                      type="text"
                      placeholder="0x..."
                      value={tycoonLogicContract}
                      onChange={(e) => setTycoonLogicContract(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-3 font-mono text-sm"
                    />
                    <button
                      onClick={handlers.handleSetTycoonLogicContract}
                      disabled={anyPending || !tycoonLogicContract.trim()}
                      className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold transition disabled:opacity-50"
                    >
                      {pendingTycoonLogic ? 'Updating...' : 'Set Logic Contract'}
                    </button>
                  </div>
                  <div className="md:col-span-2 bg-gray-800/50 rounded-xl p-6 border border-cyan-900/50">
                    <label className="block text-sm font-medium text-cyan-200 mb-2">User Registry</label>
                    <p className="text-xs text-gray-500 mb-2">Creates wallet per user, profile + email, game-action faucet. Use 0x0 to disable.</p>
                    <input
                      type="text"
                      placeholder="0x..."
                      value={tycoonUserRegistry}
                      onChange={(e) => setTycoonUserRegistry(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-3 font-mono text-sm"
                    />
                    <button
                      onClick={handlers.handleSetTycoonUserRegistry}
                      disabled={anyPending || !tycoonUserRegistry.trim()}
                      className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold transition disabled:opacity-50"
                    >
                      {pendingTycoonUserRegistry ? 'Updating...' : 'Set User Registry'}
                    </button>
                  </div>
                  <div className="md:col-span-2 bg-gray-800/50 rounded-xl p-6 border border-cyan-900/50">
                    <label className="block text-sm font-medium text-cyan-200 mb-2">Game Faucet</label>
                    <p className="text-xs text-gray-500 mb-2">Only this address can call setPropertyStats and setTurnCount (TycoonGameFaucet).</p>
                    <input
                      type="text"
                      placeholder="0x..."
                      value={tycoonGameFaucet}
                      onChange={(e) => setTycoonGameFaucet(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-3 font-mono text-sm"
                    />
                    <button
                      onClick={handlers.handleSetTycoonGameFaucet}
                      disabled={anyPending || !tycoonGameFaucet.trim()}
                      className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold transition disabled:opacity-50"
                    >
                      {pendingTycoonGameFaucet ? 'Updating...' : 'Set Game Faucet'}
                    </button>
                  </div>
                  <div className="md:col-span-2 bg-gray-800/50 rounded-xl p-6 border border-cyan-900/50">
                    <label className="block text-sm font-medium text-cyan-200 mb-2">Reward System</label>
                    <p className="text-xs text-gray-500 mb-2">TycoonRewardSystem contract address (rewards/shop).</p>
                    <input
                      type="text"
                      placeholder="0x..."
                      value={tycoonRewardSystem}
                      onChange={(e) => setTycoonRewardSystem(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-3 font-mono text-sm"
                    />
                    <button
                      onClick={handlers.handleSetTycoonRewardSystem}
                      disabled={anyPending || !tycoonRewardSystem.trim()}
                      className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold transition disabled:opacity-50"
                    >
                      {pendingTycoonRewardSystem ? 'Updating...' : 'Set Reward System'}
                    </button>
                  </div>
                  <div className="md:col-span-2 bg-gray-800/50 rounded-xl p-6 border border-amber-900/50">
                    <label className="block text-sm font-medium text-amber-200 mb-2">Create Wallet for Existing User</label>
                    <p className="text-xs text-gray-500 mb-2">Create a smart wallet in the User Registry for a player already registered on the game but without a registry profile.</p>
                    <input
                      type="text"
                      placeholder="Player address (0x...)"
                      value={createWalletPlayerAddress}
                      onChange={(e) => setCreateWalletPlayerAddress(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 mb-3 font-mono text-sm"
                    />
                    <button
                      onClick={handlers.handleCreateWalletForExistingUser}
                      disabled={anyPending || !createWalletPlayerAddress.trim()}
                      className="w-full py-3 bg-amber-600 hover:bg-amber-500 rounded-xl font-bold transition disabled:opacity-50"
                    >
                      {pendingCreateWallet ? 'Creating...' : 'Create Wallet'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeSection === 'funds' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Banknote className="w-6 h-6 text-yellow-400" /> Withdraw Funds
            </h3>
            <div className="space-y-4">
              <select
                value={withdrawToken}
                onChange={(e) => setWithdrawToken(e.target.value as 'TYC' | 'USDC')}
                className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 text-white"
              >
                <option value="TYC">TYC</option>
                <option value="USDC">USDC</option>
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="Amount"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <input
                type="text"
                placeholder="Recipient Address"
                value={withdrawTo}
                onChange={(e) => setWithdrawTo(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <button
                onClick={handlers.handleWithdraw}
                disabled={anyPending || !withdrawAmount || !withdrawTo}
                className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 rounded-xl font-bold transition disabled:opacity-50"
              >
                {pendingWithdraw ? 'Withdrawing...' : 'Withdraw'}
              </button>
            </div>
          </motion.div>
        )}

        {activeSection === 'vault' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-6">
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Banknote className="w-6 h-6 text-amber-400" /> Naira Vault
              </h3>
              <p className="text-gray-400 text-sm mb-4">Fund this vault with CELO so users can receive CELO when they pay Naira. Only owner/controller can withdraw via creditCelo.</p>
              {vaultNairaAddress ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="text-gray-400 text-sm">Vault address:</span>
                    <code className="text-cyan-300 text-sm break-all">{vaultNairaAddress}</code>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(vaultNairaAddress); setVaultCopyFeedback(true); setTimeout(() => setVaultCopyFeedback(false), 2000); }}
                      className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300"
                      aria-label="Copy"
                    >
                      {vaultCopyFeedback ? <span className="text-xs text-green-400">Copied!</span> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  {vaultUsdcTokenAddress && (
                    <div className="mb-4 p-3 rounded-xl bg-amber-900/20 border border-amber-600/40">
                      <p className="text-amber-200 text-sm font-medium mb-1">Vault’s USDC token (must use this contract)</p>
                      <p className="text-xs text-gray-400 mb-2">If you transferred a different token (e.g. another &quot;USDC&quot; or cUSD), the balance will stay 0. Send only this token to the vault address above.</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="text-cyan-300 text-xs break-all">{vaultUsdcTokenAddress}</code>
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(vaultUsdcTokenAddress); setVaultCopyFeedback(true); setTimeout(() => setVaultCopyFeedback(false), 2000); }}
                          className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                          aria-label="Copy USDC address"
                        >
                          {vaultCopyFeedback ? <span className="text-xs text-green-400">Copied!</span> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-800/50 rounded-xl p-4">
                      <span className="text-gray-400 text-sm block">CELO balance (native)</span>
                      <span className="text-lg font-semibold text-cyan-300">
                        {vaultCeloBalance != null ? formatUnits(vaultCeloBalance, 18) : '—'}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">From users sending CELO for Naira withdrawal</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-4">
                      <span className="text-gray-400 text-sm block">USDC balance (ERC20)</span>
                      <span className="text-lg font-semibold text-green-300">
                        {vaultUsdcBalance != null ? formatUnits(vaultUsdcBalance, vaultUsdcDecimals ?? 6) : '—'}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">Balance of the vault’s configured USDC token (see above). Send that token to the vault address.</p>
                    </div>
                  </div>
                  <div className="border-t border-gray-700/50 pt-4">
                    <h4 className="text-sm font-semibold text-amber-300 mb-2">Withdraw CELO (owner/controller)</h4>
                    <p className="text-gray-500 text-xs mb-3">Sends vault CELO to a recipient. Use your address to recover funds.</p>
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Recipient address (0x...)"
                        value={vaultWithdrawTo}
                        onChange={(e) => setVaultWithdrawTo(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-white placeholder-gray-500"
                      />
                      <input
                        type="number"
                        step="any"
                        placeholder="CELO amount"
                        value={vaultWithdrawAmount}
                        onChange={(e) => setVaultWithdrawAmount(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-white placeholder-gray-500"
                      />
                      <button
                        onClick={handlers.handleVaultWithdrawCelo}
                        disabled={anyPending || !vaultWithdrawAmount || !vaultWithdrawTo.trim()}
                        className="w-full py-3 bg-amber-600 hover:bg-amber-500 rounded-xl font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {pendingVaultWithdraw ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                        {pendingVaultWithdraw ? 'Withdrawing...' : 'Withdraw CELO'}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-gray-700/50 pt-4 mt-4">
                    <h4 className="text-sm font-semibold text-emerald-300 mb-2">Withdraw USDC (owner/controller)</h4>
                    <p className="text-gray-500 text-xs mb-3">Sends vault USDC to a recipient (uses the vault’s configured USDC token).</p>
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="Recipient address (0x...)"
                        value={vaultWithdrawUsdcTo}
                        onChange={(e) => setVaultWithdrawUsdcTo(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-gray-500"
                      />
                      <input
                        type="number"
                        step="any"
                        placeholder="USDC amount"
                        value={vaultWithdrawUsdcAmount}
                        onChange={(e) => setVaultWithdrawUsdcAmount(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-gray-500"
                      />
                      <button
                        onClick={handlers.handleVaultWithdrawUsdc}
                        disabled={anyPending || !vaultWithdrawUsdcAmount || !vaultWithdrawUsdcTo.trim()}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {pendingVaultWithdraw ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                        {pendingVaultWithdraw ? 'Withdrawing...' : 'Withdraw USDC'}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-gray-500">Naira vault not configured for this chain (set NEXT_PUBLIC_CELO_NAIRA_VAULT).</p>
              )}
            </div>
          </motion.div>
        )}

        {activeSection === 'reads' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto space-y-8">
            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <BookOpen className="w-8 h-8 text-cyan-400" /> Reward contract (view reads)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-mono">
                <div className="flex justify-between gap-2 py-2 border-b border-gray-700/50">
                  <span className="text-gray-400">paused</span>
                  <span className={isPaused ? 'text-red-400' : 'text-green-400'}>{String(isPaused)}</span>
                </div>
                <div className="flex justify-between gap-2 py-2 border-b border-gray-700/50">
                  <span className="text-gray-400">owner</span>
                  <span className="text-cyan-300 truncate">{owner ?? '—'}</span>
                </div>
                <div className="flex justify-between gap-2 py-2 border-b border-gray-700/50">
                  <span className="text-gray-400">backendMinter</span>
                  <span className="text-cyan-300 truncate">{backendMinter ?? '—'}</span>
                </div>
                <div className="flex justify-between gap-2 py-2 border-b border-gray-700/50">
                  <span className="text-gray-400">tycToken</span>
                  <span className="text-cyan-300 truncate">{rewardTycToken ?? '—'}</span>
                </div>
                <div className="flex justify-between gap-2 py-2 border-b border-gray-700/50">
                  <span className="text-gray-400">usdc</span>
                  <span className="text-cyan-300 truncate">{rewardUsdc ?? '—'}</span>
                </div>
                <div className="flex justify-between gap-2 py-2 border-b border-gray-700/50">
                  <span className="text-gray-400">ownedTokenCount(contract)</span>
                  <span className="text-cyan-300">{tokenCount}</span>
                </div>
                <div className="flex justify-between gap-2 py-2 border-b border-gray-700/50">
                  <span className="text-gray-400">balanceOf TYC (contract)</span>
                  <span className="text-cyan-300">{tycBalance != null ? formatUnits(BigInt(String(tycBalance)), 18) : '—'} TYC</span>
                </div>
                <div className="flex justify-between gap-2 py-2 border-b border-gray-700/50">
                  <span className="text-gray-400">balanceOf USDC (contract)</span>
                  <span className="text-cyan-300">{usdcBalance != null ? formatUnits(BigInt(String(usdcBalance)), 6) : '—'} USDC</span>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-700/50">
                <p className="text-gray-400 text-sm mb-2">getCashTierValue(tier) — tiers 1–5</p>
                <div className="flex flex-wrap gap-4 font-mono text-sm">
                  {[1, 2, 3, 4, 5].map((tier, i) => {
                    const val = cashTierValues[i];
                    return (
                      <span key={tier} className="text-cyan-300">
                        tier{tier}: {typeof val === 'bigint' ? formatUnits(val, 18) : '—'} TYC
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-700/50">
                <p className="text-gray-400 text-sm mb-2">getCollectibleInfo(tokenId)</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Token ID"
                    value={readTestTokenId}
                    onChange={(e) => setReadTestTokenId(e.target.value)}
                    className="w-32 px-3 py-2 bg-gray-800 rounded-lg font-mono text-sm"
                  />
                  {readTestCollectibleInfoLoading && <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />}
                </div>
                {readTestCollectibleInfo != null && (
                  <div className="mt-2 font-mono text-sm text-cyan-300">
                    perk={readTestCollectibleInfo[0]} strength={readTestCollectibleInfo[1].toString()} tycPrice={formatUnits(readTestCollectibleInfo[2], 18)} usdcPrice={formatUnits(readTestCollectibleInfo[3], 6)} shopStock={readTestCollectibleInfo[4].toString()}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Gamepad2 className="w-8 h-8 text-cyan-400" /> Tycoon contract (view reads)
              </h3>
              {!tycoonReads.isLoading && (String(tycoonReads.tycoonOwner ?? '').toLowerCase() === '0x0000000000000000000000000000000000000001' || String(tycoonReads.rewardSystem ?? '').toLowerCase() === '0x0000000000000000000000000000000000000000') && (
                <div className="mb-6 p-4 rounded-xl bg-amber-900/40 border border-amber-600/60 text-amber-200 text-sm">
                  <p className="font-semibold">Using implementation or uninitialized proxy</p>
                  <p className="mt-1 opacity-90">
                    Owner <code className="bg-black/30 px-1 rounded">0x...0001</code> or zero <code className="bg-black/30 px-1 rounded">rewardSystem</code> means you are reading the <strong>implementation</strong> (or a proxy that was never initialized). Game state lives in the <strong>proxy</strong>. In <code className="bg-black/30 px-1 rounded">.env.local</code> set the <strong>proxy</strong> address:
                  </p>
                  <p className="mt-2 font-mono text-cyan-300 break-all">
                    NEXT_PUBLIC_CELO=0xA97fC9666a41cDAE3EFb74A4CaC87B9d33A16F0e
                  </p>
                  <p className="mt-1 text-xs opacity-80">
                    (Backend: <code className="bg-black/30 px-1 rounded">TYCOON_CELO_CONTRACT_ADDRESS</code> = same proxy. Do not use the implementation address 0xC2da... in env.)
                  </p>
                </div>
              )}
              {tycoonReads.isLoading ? (
                <div className="text-gray-400 flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading…
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-mono">
                  <div className="flex justify-between gap-2 py-2 border-b border-gray-700/50">
                    <span className="text-gray-400">minStake</span>
                    <span className="text-cyan-300">{tycoonReads.minStake != null ? formatUnits(tycoonReads.minStake, 6) : '—'} USDC</span>
                  </div>
                  <div className="flex justify-between gap-2 py-2 border-b border-gray-700/50">
                    <span className="text-gray-400">minTurnsForPerks</span>
                    <span className="text-cyan-300">{tycoonReads.minTurnsForPerks?.toString() ?? '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2 py-2 border-b border-gray-700/50">
                    <span className="text-gray-400">totalGames</span>
                    <span className="text-cyan-300">{tycoonReads.totalGames?.toString() ?? '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2 py-2 border-b border-gray-700/50">
                    <span className="text-gray-400">totalUsers</span>
                    <span className="text-cyan-300">{tycoonReads.totalUsers?.toString() ?? '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2 py-2 border-b border-gray-700/50">
                    <span className="text-gray-400">owner</span>
                    <span className="text-cyan-300 truncate">{tycoonReads.tycoonOwner ?? '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2 py-2 border-b border-gray-700/50">
                    <span className="text-gray-400">backendGameController</span>
                    <span className="text-cyan-300 truncate">{tycoonReads.backendGameController ?? '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2 py-2 border-b border-gray-700/50">
                    <span className="text-gray-400">logicContract</span>
                    <span className="text-cyan-300 truncate">{tycoonReads.logicContract ?? '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2 py-2 border-b border-gray-700/50">
                    <span className="text-gray-400">userRegistry</span>
                    <span className="text-cyan-300 truncate">{tycoonReads.userRegistry ?? '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2 py-2 border-b border-gray-700/50">
                    <span className="text-gray-400">gameFaucet</span>
                    <span className="text-cyan-300 truncate">{tycoonReads.gameFaucet ?? '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2 py-2 border-b border-gray-700/50">
                    <span className="text-gray-400">rewardSystem</span>
                    <span className="text-cyan-300 truncate">{tycoonReads.rewardSystem ?? '—'}</span>
                  </div>
                </div>
              )}
              <div className="mt-6 pt-6 border-t border-gray-700/50">
                <p className="text-gray-400 text-sm mb-2">registered(address) — check if an address can create/join games; hasWallet (User Registry) — check if they have a smart wallet</p>
                <div className="flex gap-2 items-center flex-wrap">
                  <input
                    type="text"
                    placeholder="0x..."
                    value={checkRegisteredAddress}
                    onChange={(e) => setCheckRegisteredAddress(e.target.value)}
                    className="flex-1 min-w-[200px] px-3 py-2 bg-gray-800 rounded-lg font-mono text-sm"
                  />
                  {(isRegisteredLoading || hasSmartWalletLoading) && <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />}
                </div>
                {checkRegisteredAddress.trim() !== '' && !isRegisteredLoading && (
                  <div className="mt-2 font-mono text-sm space-y-1">
                    <div>
                      <span className="text-gray-400">registered: </span>
                      <span className={isRegistered ? 'text-green-400' : 'text-red-400'}>
                        {typeof isRegistered === 'boolean' ? (isRegistered ? 'true' : 'false') : '—'}
                      </span>
                      {typeof addressToUsername === 'string' && addressToUsername !== '' && (
                        <>
                          <span className="text-gray-400 ml-3">username: </span>
                          <span className="text-cyan-300">{addressToUsername}</span>
                        </>
                      )}
                    </div>
                    {!hasSmartWalletLoading && (
                      <div>
                        <span className="text-gray-400">has smart wallet: </span>
                        <span className={hasSmartWallet ? 'text-green-400' : 'text-amber-400'}>
                          {typeof hasSmartWallet === 'boolean' ? (hasSmartWallet ? 'true' : 'false') : '—'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {currentTxHash && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 p-6 bg-green-900/90 rounded-2xl border border-green-600 shadow-2xl z-50"
          >
            <p className="text-xl font-bold text-green-300 text-center">Transaction Sent!</p>
            <a
              href={`https://celoscan.io/tx/${currentTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-3 text-cyan-300 underline text-center"
            >
              View on Block Explorer
            </a>
          </motion.div>
        )}
      </div>
    </div>
  );
}