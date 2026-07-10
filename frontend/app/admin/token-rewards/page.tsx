"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { ApiError } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { INITIAL_COLLECTIBLES } from "@/components/rewards/rewardsConstants";

const CHAINS = ["CELO", "BASE", "POLYGON"] as const;

const GRANT_TIMEOUT_MS = 180_000;

const SHOP_PERK_OPTIONS = INITIAL_COLLECTIBLES.map((row) => ({
  key: `${row.perk}:${row.strength}`,
  perk: row.perk,
  strength: row.strength,
  label: row.strength > 1 ? `${row.name}` : row.name,
  usdcPrice: row.usdcPrice,
}));

type CollectibleOption = {
  tokenId: string | null;
  perk: number;
  strength: number;
  label: string;
  inShop: boolean;
};

function collectibleOptionKey(opt: CollectibleOption): string {
  return opt.tokenId ? `token:${opt.tokenId}` : `mint:${opt.perk}:${opt.strength}`;
}

function formatCollectibleOptionLabel(opt: CollectibleOption): string {
  const stock = opt.inShop && opt.tokenId ? ` — #${opt.tokenId}` : opt.inShop ? "" : " (mint if out of stock)";
  return `${opt.label}${stock}`;
}

type OverviewData = {
  totals: { totalEarnedSum: number; totalWithdrawnSum: number; totalStakedSum: number };
  dailyClaim: { usersClaimedTodayUtc: number; usersWithNonZeroStreak: number };
};

type ConfigData = {
  dailyClaim: {
    dailyRewardTycBase: string;
    streakBonusTycPerDay: number | string;
    effectiveSource?: string;
    envFallback?: { dailyRewardTycBase: string; streakBonusTycPerDay: string };
    envKeys: string[];
  };
  note: string;
};

export default function AdminTokenRewardsPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [userId, setUserId] = useState("");
  const [tycAmount, setTycAmount] = useState("");
  const [chain, setChain] = useState<string>("CELO");
  const [reason, setReason] = useState("");
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantOk, setGrantOk] = useState<string | null>(null);

  const [collectibleAddress, setCollectibleAddress] = useState("");
  const [collectibleUserId, setCollectibleUserId] = useState("");
  const [collectibleChain, setCollectibleChain] = useState<string>("CELO");
  const [selectedCollectibleKey, setSelectedCollectibleKey] = useState("");
  const [collectibleOptions, setCollectibleOptions] = useState<CollectibleOption[]>([]);
  const [collectibleOptionsLoading, setCollectibleOptionsLoading] = useState(false);
  const [collectibleOptionsError, setCollectibleOptionsError] = useState<string | null>(null);
  const [collectibleReason, setCollectibleReason] = useState("");
  const [collectibleBusy, setCollectibleBusy] = useState(false);
  const [collectibleError, setCollectibleError] = useState<string | null>(null);
  const [collectibleOk, setCollectibleOk] = useState<string | null>(null);

  const [ecoBase, setEcoBase] = useState("");
  const [ecoStreak, setEcoStreak] = useState("");
  const [ecoBusy, setEcoBusy] = useState(false);
  const [ecoMsg, setEcoMsg] = useState<string | null>(null);

  const [shopStockChain, setShopStockChain] = useState<string>("CELO");
  const [shopAddAmount, setShopAddAmount] = useState("200");
  const [shopStockBusy, setShopStockBusy] = useState(false);
  const [shopStockError, setShopStockError] = useState<string | null>(null);
  const [shopStockOk, setShopStockOk] = useState<string | null>(null);

  const [singlePerkKey, setSinglePerkKey] = useState(SHOP_PERK_OPTIONS[0]?.key ?? "1:1");
  const [singlePerkAmount, setSinglePerkAmount] = useState("200");
  const [singlePerkChain, setSinglePerkChain] = useState<string>("CELO");
  const [singlePerkBusy, setSinglePerkBusy] = useState(false);
  const [singlePerkError, setSinglePerkError] = useState<string | null>(null);
  const [singlePerkOk, setSinglePerkOk] = useState<string | null>(null);

  const SHOP_STOCK_TIMEOUT_MS = 600_000;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ov, cf] = await Promise.all([
        adminApi.get<{ success: boolean; data?: OverviewData }>("admin/economy/overview"),
        adminApi.get<{ success: boolean; data?: ConfigData }>("admin/economy/config"),
      ]);
      if (!ov.data?.success || !ov.data.data) throw new Error("Overview failed");
      if (!cf.data?.success || !cf.data.data) throw new Error("Config failed");
      setOverview(ov.data.data);
      setConfig(cf.data.data);
      const dc = cf.data.data.dailyClaim;
      setEcoBase(String(dc.dailyRewardTycBase ?? ""));
      setEcoStreak(String(dc.streakBonusTycPerDay ?? ""));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Load failed");
      setOverview(null);
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadCollectibleOptions = useCallback(async (chain: string) => {
    setCollectibleOptionsLoading(true);
    setCollectibleOptionsError(null);
    setSelectedCollectibleKey("");
    try {
      const { data: res } = await adminApi.get<{ success: boolean; data?: CollectibleOption[]; error?: string }>(
        "admin/economy/collectible-options",
        { params: { chain } }
      );
      if (!res?.success) {
        throw new Error(res?.error || "Failed to load collectibles");
      }
      setCollectibleOptions(res.data || []);
    } catch (e) {
      setCollectibleOptions([]);
      setCollectibleOptionsError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Load failed");
    } finally {
      setCollectibleOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCollectibleOptions(collectibleChain);
  }, [collectibleChain, loadCollectibleOptions]);

  async function saveEconomyOverrides(e: React.FormEvent) {
    e.preventDefault();
    setEcoBusy(true);
    setEcoMsg(null);
    try {
      await adminApi.patch("admin/economy/config", {
        dailyRewardTycBase: ecoBase.trim() || null,
        streakBonusTycPerDay: ecoStreak.trim() === "" ? null : Number(ecoStreak),
      });
      await load();
      setEcoMsg("Saved economy overrides.");
    } catch (err) {
      setEcoMsg(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setEcoBusy(false);
    }
  }

  async function clearEconomyOverrides() {
    if (!window.confirm("Remove DB overrides and revert daily claim to env only?")) return;
    setEcoBusy(true);
    setEcoMsg(null);
    try {
      await adminApi.patch("admin/economy/config", {
        dailyRewardTycBase: null,
        streakBonusTycPerDay: null,
      });
      await load();
      setEcoMsg("Cleared overrides.");
    } catch (err) {
      setEcoMsg(err instanceof ApiError ? err.message : "Clear failed");
    } finally {
      setEcoBusy(false);
    }
  }

  async function onGrant(e: React.FormEvent) {
    e.preventDefault();
    setGrantBusy(true);
    setGrantError(null);
    setGrantOk(null);
    const uid = parseInt(userId, 10);
    const amt = parseFloat(tycAmount);
    if (!Number.isFinite(uid) || uid < 1) {
      setGrantError("Enter a valid user id");
      setGrantBusy(false);
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setGrantError("Enter a positive TYC amount");
      setGrantBusy(false);
      return;
    }
    try {
      const { data: body } = await adminApi.post<{
        success: boolean;
        data?: { txHash?: string; tokenId?: string | null; mintTo: string; chain: string; tycAmount: number };
        error?: string;
      }>(
        "admin/economy/grant-voucher",
        { userId: uid, tycAmount: amt, chain, reason: reason.trim() || undefined },
        { timeout: GRANT_TIMEOUT_MS }
      );
      if (!body?.success || !body.data) {
        setGrantError((body as { error?: string })?.error || "Grant failed");
        return;
      }
      const d = body.data;
      setGrantOk(
        `Minted ~${d.tycAmount} TYC voucher to ${d.mintTo.slice(0, 10)}… on ${d.chain}. Tx: ${d.txHash || "—"}${d.tokenId ? ` · token ${d.tokenId}` : ""}`
      );
    } catch (e) {
      setGrantError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Grant failed");
    } finally {
      setGrantBusy(false);
    }
  }

  async function onDeliverCollectible(e: React.FormEvent) {
    e.preventDefault();
    setCollectibleBusy(true);
    setCollectibleError(null);
    setCollectibleOk(null);

    const addr = collectibleAddress.trim();
    const uidRaw = collectibleUserId.trim();
    const selected = collectibleOptions.find((opt) => collectibleOptionKey(opt) === selectedCollectibleKey);

    if (!selected) {
      setCollectibleError("Select a collectible from the list");
      setCollectibleBusy(false);
      return;
    }
    if (!addr && !uidRaw) {
      setCollectibleError("Enter wallet address or user id");
      setCollectibleBusy(false);
      return;
    }

    const body: Record<string, string | number> = {
      chain: collectibleChain,
      reason: collectibleReason.trim() || undefined,
    };
    if (selected.tokenId) {
      body.tokenId = selected.tokenId;
    } else {
      body.perk = selected.perk;
      body.strength = selected.strength;
    }
    if (addr) body.toAddress = addr;
    if (uidRaw) {
      const uid = parseInt(uidRaw, 10);
      if (!Number.isFinite(uid) || uid < 1) {
        setCollectibleError("Invalid user id");
        setCollectibleBusy(false);
        return;
      }
      body.userId = uid;
    }

    try {
      const { data: resBody } = await adminApi.post<{
        success: boolean;
        data?: {
          txHash?: string;
          deliverTo: string;
          chain: string;
          tokenId?: string | null;
          method?: string;
        };
        error?: string;
      }>("admin/economy/deliver-collectible", body, { timeout: GRANT_TIMEOUT_MS });

      if (!resBody?.success || !resBody.data) {
        setCollectibleError((resBody as { error?: string })?.error || "Send failed");
        return;
      }
      const d = resBody.data;
      const sentLabel = selected.label + (d.tokenId ? ` (#${d.tokenId})` : "");
      setCollectibleOk(
        `Sent ${sentLabel} to ${d.deliverTo.slice(0, 10)}… on ${d.chain} (${d.method || "deliver"}). Tx: ${d.txHash || "—"}`
      );
    } catch (e) {
      setCollectibleError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Send failed");
    } finally {
      setCollectibleBusy(false);
    }
  }

  async function onAddShopStock(e: React.FormEvent) {
    e.preventDefault();
    setShopStockBusy(true);
    setShopStockError(null);
    setShopStockOk(null);
    const amount = Number(shopAddAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setShopStockError("Enter a positive amount (e.g. 200)");
      setShopStockBusy(false);
      return;
    }
    try {
      const { data: body } = await adminApi.post<{
        success: boolean;
        data?: { processed: number; restocked: number; newlyStocked: number; failed: number };
        message?: string;
        error?: string;
      }>(
        "admin/economy/shop-add-all-perks",
        { chain: shopStockChain, amount },
        { timeout: SHOP_STOCK_TIMEOUT_MS }
      );
      if (!body?.success) {
        setShopStockError(body?.error || body?.message || "Shop restock failed");
        return;
      }
      setShopStockOk(
        body.message ||
          `Added ${amount} to ${body.data?.processed ?? 0} perk row(s) (${body.data?.restocked ?? 0} restocked, ${body.data?.newlyStocked ?? 0} new).`
      );
    } catch (e) {
      setShopStockError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Shop restock failed");
    } finally {
      setShopStockBusy(false);
    }
  }

  async function onAddSinglePerkStock(e: React.FormEvent) {
    e.preventDefault();
    setSinglePerkBusy(true);
    setSinglePerkError(null);
    setSinglePerkOk(null);
    const selected = SHOP_PERK_OPTIONS.find((opt) => opt.key === singlePerkKey);
    const amount = Number(singlePerkAmount);
    if (!selected) {
      setSinglePerkError("Select a perk");
      setSinglePerkBusy(false);
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setSinglePerkError("Enter a positive amount (e.g. 200)");
      setSinglePerkBusy(false);
      return;
    }
    try {
      const { data: body } = await adminApi.post<{
        success: boolean;
        data?: { method?: string; label?: string; tokenId?: string | null; txHash?: string };
        message?: string;
        error?: string;
      }>(
        "admin/economy/shop-add-perk",
        {
          chain: singlePerkChain,
          perk: selected.perk,
          strength: selected.strength,
          amount,
        },
        { timeout: GRANT_TIMEOUT_MS }
      );
      if (!body?.success) {
        setSinglePerkError(body?.error || body?.message || "Failed to add perk stock");
        return;
      }
      setSinglePerkOk(
        body.message ||
          `Added ${amount} × ${selected.label}${body.data?.txHash ? ` · ${body.data.txHash.slice(0, 10)}…` : ""}`
      );
    } catch (e) {
      setSinglePerkError(
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to add perk stock"
      );
    } finally {
      setSinglePerkBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">Token & rewards</h1>
      <p className="mt-1 text-sm text-slate-400 max-w-2xl">
        Economy aggregates, daily-claim env hints, <strong>manual TYC voucher mint</strong>, and <strong>one-click collectible delivery</strong> (backend minter on Celo).
      </p>

      {loading && (
        <div className="mt-8 flex items-center gap-2 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
          Loading…
        </div>
      )}

      {loadError && !loading && (
        <p className="mt-6 text-sm text-red-400 border border-red-900/50 bg-red-950/30 rounded-lg px-3 py-2 max-w-xl">
          {loadError}
        </p>
      )}

      {overview && config && !loading && (
        <>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">Σ total_earned (users)</p>
              <p className="text-xl font-semibold text-cyan-100 tabular-nums mt-1">
                {overview.totals.totalEarnedSum.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">Σ total_withdrawn</p>
              <p className="text-xl font-semibold text-slate-200 tabular-nums mt-1">
                {overview.totals.totalWithdrawnSum.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">Σ total_staked</p>
              <p className="text-xl font-semibold text-slate-200 tabular-nums mt-1">
                {overview.totals.totalStakedSum.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">Daily claims today (UTC)</p>
              <p className="text-xl font-semibold text-slate-200 tabular-nums mt-1">
                {overview.dailyClaim.usersClaimedTodayUtc.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
              <p className="text-xs uppercase text-slate-500">Users with streak &gt; 0</p>
              <p className="text-xl font-semibold text-slate-200 tabular-nums mt-1">
                {overview.dailyClaim.usersWithNonZeroStreak.toLocaleString()}
              </p>
            </div>
          </div>

          <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/30 p-4 max-w-2xl">
            <h2 className="text-sm font-semibold text-slate-200">Daily claim (effective)</h2>
            <p className="text-xs text-slate-500 mt-1">{config.note}</p>
            <p className="text-xs text-cyan-500/90 mt-1">
              Source: <strong>{config.dailyClaim.effectiveSource ?? "—"}</strong>
            </p>
            <dl className="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-slate-500">Base TYC</dt>
                <dd className="text-slate-200 font-mono">{config.dailyClaim.dailyRewardTycBase}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Streak bonus TYC / day</dt>
                <dd className="text-slate-200 font-mono">{String(config.dailyClaim.streakBonusTycPerDay)}</dd>
              </div>
              {config.dailyClaim.envFallback && (
                <>
                  <div>
                    <dt className="text-slate-500">Env fallback base</dt>
                    <dd className="text-slate-500 font-mono text-xs">{config.dailyClaim.envFallback.dailyRewardTycBase}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Env fallback streak</dt>
                    <dd className="text-slate-500 font-mono text-xs">{config.dailyClaim.envFallback.streakBonusTycPerDay}</dd>
                  </div>
                </>
              )}
            </dl>
            <p className="text-xs text-slate-600 mt-2 font-mono">{config.dailyClaim.envKeys.join(", ")}</p>

            <form onSubmit={saveEconomyOverrides} className="mt-6 space-y-3 border-t border-slate-800 pt-4">
              <p className="text-xs text-slate-500">Override daily claim (stored in DB). Use integers / decimals as needed.</p>
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">Base TYC (override)</span>
                <input
                  value={ecoBase}
                  onChange={(e) => setEcoBase(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200 font-mono text-sm"
                  placeholder="e.g. 1"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">Streak bonus per day (TYC)</span>
                <input
                  value={ecoStreak}
                  onChange={(e) => setEcoStreak(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200 font-mono text-sm"
                  placeholder="e.g. 0.5"
                />
              </label>
              {ecoMsg && (
                <p
                  className={`text-xs ${ecoMsg.includes("failed") || ecoMsg.includes("400") ? "text-red-400" : "text-emerald-400/90"}`}
                >
                  {ecoMsg}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={ecoBusy}
                  className="rounded-lg bg-cyan-800 hover:bg-cyan-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {ecoBusy ? "Saving…" : "Save overrides"}
                </button>
                <button
                  type="button"
                  disabled={ecoBusy}
                  onClick={clearEconomyOverrides}
                  className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  Clear DB overrides
                </button>
              </div>
            </form>
          </section>

          <section className="mt-8 rounded-xl border border-amber-900/40 bg-amber-950/15 p-4 max-w-xl">
            <h2 className="text-sm font-semibold text-amber-200/95">Grant TYC voucher</h2>
            <p className="text-xs text-amber-200/70 mt-1">
              Mints to the user’s smart wallet when set, else linked wallet, else primary address. Requires chain contract config and backend minter role.
            </p>
            <form onSubmit={onGrant} className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">User id</span>
                <input
                  type="number"
                  min={1}
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200 tabular-nums"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">Amount (TYC)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={tycAmount}
                  onChange={(e) => setTycAmount(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">Chain</span>
                <select
                  value={chain}
                  onChange={(e) => setChain(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200"
                >
                  {CHAINS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">Reason (optional)</span>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200 text-sm"
                />
              </label>
              {grantError && (
                <p className="text-sm text-red-400 border border-red-900/40 rounded-lg px-2 py-1.5 bg-red-950/30">
                  {grantError}
                </p>
              )}
              {grantOk && (
                <p className="text-sm text-emerald-400/90 border border-emerald-900/40 rounded-lg px-2 py-1.5 bg-emerald-950/30">
                  {grantOk}
                </p>
              )}
              <button
                type="submit"
                disabled={grantBusy}
                className="rounded-lg bg-cyan-800 hover:bg-cyan-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {grantBusy ? "Minting…" : "Mint voucher"}
              </button>
            </form>
          </section>

          <section className="mt-8 rounded-xl border border-emerald-900/40 bg-emerald-950/15 p-4 max-w-xl">
            <h2 className="text-sm font-semibold text-emerald-200/95">Send collectible (backend)</h2>
            <p className="text-xs text-emerald-200/70 mt-1">
              One-click delivery via backend minter — pulls from shop stock, or mints the same perk if out of stock. Use the
              wallet the player actually uses in MiniPay (connected address).
            </p>
            <form onSubmit={onDeliverCollectible} className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">Wallet address (0x…)</span>
                <input
                  value={collectibleAddress}
                  onChange={(e) => setCollectibleAddress(e.target.value)}
                  placeholder="0x08D7… or leave blank if using user id"
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200 font-mono text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">Or user id (uses smart → linked → primary wallet)</span>
                <input
                  type="number"
                  min={1}
                  value={collectibleUserId}
                  onChange={(e) => setCollectibleUserId(e.target.value)}
                  placeholder="Optional"
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200 tabular-nums"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">Chain</span>
                <select
                  value={collectibleChain}
                  onChange={(e) => setCollectibleChain(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200"
                >
                  {CHAINS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">Collectible</span>
                <select
                  value={selectedCollectibleKey}
                  onChange={(e) => setSelectedCollectibleKey(e.target.value)}
                  required
                  disabled={collectibleOptionsLoading || collectibleOptions.length === 0}
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200 disabled:opacity-60"
                >
                  <option value="">
                    {collectibleOptionsLoading
                      ? "Loading collectibles…"
                      : collectibleOptions.length === 0
                        ? "No collectibles available"
                        : "Choose a perk…"}
                  </option>
                  {collectibleOptions.map((opt) => (
                    <option key={collectibleOptionKey(opt)} value={collectibleOptionKey(opt)}>
                      {formatCollectibleOptionLabel(opt)}
                    </option>
                  ))}
                </select>
                {collectibleOptionsError && (
                  <p className="mt-1 text-xs text-amber-400/90">{collectibleOptionsError}</p>
                )}
                {!collectibleOptionsLoading && collectibleOptions.length > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    In-shop perks show their token ID. Others mint on delivery if not in stock.
                  </p>
                )}
              </label>
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">Reason (optional, audit log)</span>
                <input
                  value={collectibleReason}
                  onChange={(e) => setCollectibleReason(e.target.value)}
                  maxLength={500}
                  placeholder="e.g. July bounty prize, support make-good"
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200 text-sm"
                />
              </label>
              {collectibleError && (
                <p className="text-sm text-red-400 border border-red-900/40 rounded-lg px-2 py-1.5 bg-red-950/30">
                  {collectibleError}
                </p>
              )}
              {collectibleOk && (
                <p className="text-sm text-emerald-400/90 border border-emerald-900/40 rounded-lg px-2 py-1.5 bg-emerald-950/30 break-all">
                  {collectibleOk}
                </p>
              )}
              <button
                type="submit"
                disabled={collectibleBusy}
                className="w-full rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-3 text-sm font-semibold disabled:opacity-50 shadow-lg shadow-emerald-950/40"
              >
                {collectibleBusy ? "Sending on-chain…" : "Send collectible"}
              </button>
            </form>
          </section>

          <section className="mt-8 rounded-xl border border-fuchsia-900/40 bg-fuchsia-950/15 p-4 max-w-xl">
            <h2 className="text-sm font-semibold text-fuchsia-200/95">Shop — add stock for one perk</h2>
            <p className="text-xs text-fuchsia-200/70 mt-1">
              Pick a catalog perk and add units on-chain. Restocks if it already exists in the shop; otherwise stocks it
              at the catalog price.
            </p>
            <form onSubmit={onAddSinglePerkStock} className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">Perk</span>
                <select
                  value={singlePerkKey}
                  onChange={(e) => setSinglePerkKey(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200"
                >
                  {SHOP_PERK_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label} · ${opt.usdcPrice} USDC
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">Chain</span>
                <select
                  value={singlePerkChain}
                  onChange={(e) => setSinglePerkChain(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200"
                >
                  {CHAINS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">Units to add</span>
                <input
                  type="number"
                  min={1}
                  value={singlePerkAmount}
                  onChange={(e) => setSinglePerkAmount(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200 tabular-nums"
                />
              </label>
              {singlePerkError && (
                <p className="text-sm text-red-400 border border-red-900/40 rounded-lg px-2 py-1.5 bg-red-950/30">
                  {singlePerkError}
                </p>
              )}
              {singlePerkOk && (
                <p className="text-sm text-emerald-400/90 border border-emerald-900/40 rounded-lg px-2 py-1.5 bg-emerald-950/30">
                  {singlePerkOk}
                </p>
              )}
              <button
                type="submit"
                disabled={singlePerkBusy}
                className="w-full rounded-lg bg-fuchsia-700 hover:bg-fuchsia-600 text-white px-4 py-3 text-sm font-semibold disabled:opacity-50"
              >
                {singlePerkBusy
                  ? "Adding on-chain stock…"
                  : `Add ${singlePerkAmount || "200"} of selected perk`}
              </button>
            </form>
          </section>

          <section className="mt-8 rounded-xl border border-violet-900/40 bg-violet-950/15 p-4 max-w-xl">
            <h2 className="text-sm font-semibold text-violet-200/95">Shop — add stock to all perks</h2>
            <p className="text-xs text-violet-200/70 mt-1">
              Adds units to every catalog perk on-chain. Restocks perks already in the shop; stocks any that are missing.
              Unlike the old &quot;Stock 50&quot; on /rewards, this works even when inventory is not empty.
            </p>
            <form onSubmit={onAddShopStock} className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">Chain</span>
                <select
                  value={shopStockChain}
                  onChange={(e) => setShopStockChain(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200"
                >
                  {CHAINS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-500 text-xs">Units per perk</span>
                <input
                  type="number"
                  min={1}
                  value={shopAddAmount}
                  onChange={(e) => setShopAddAmount(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-slate-200 tabular-nums"
                />
              </label>
              {shopStockError && (
                <p className="text-sm text-red-400 border border-red-900/40 rounded-lg px-2 py-1.5 bg-red-950/30">
                  {shopStockError}
                </p>
              )}
              {shopStockOk && (
                <p className="text-sm text-emerald-400/90 border border-emerald-900/40 rounded-lg px-2 py-1.5 bg-emerald-950/30">
                  {shopStockOk}
                </p>
              )}
              <button
                type="submit"
                disabled={shopStockBusy}
                className="w-full rounded-lg bg-violet-700 hover:bg-violet-600 text-white px-4 py-3 text-sm font-semibold disabled:opacity-50"
              >
                {shopStockBusy ? "Adding on-chain stock… (several minutes)" : `Add ${shopAddAmount || "200"} of each perk`}
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
