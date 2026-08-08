"use client";

import { useWriteContract } from "@/hooks/useTaggedWriteContract";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  useChainId,
  usePublicClient,
  useReadContract,
} from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { formatUnits, isAddress, parseUnits, type Address } from "viem";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
  Wallet,
} from "lucide-react";
import {
  TYCOON_CONTRACT_ADDRESSES,
  TYC_TOKEN_ADDRESS,
  USDC_TOKEN_ADDRESS,
} from "@/constants/contracts";
import TycoonABI from "@/context/abi/tycoonabi.json";
import { useRewardTokenAddresses } from "@/context/ContractProvider";

const RESCUE_TO_STORAGE_KEY = "tycoon_admin_game_proxy_rescue_to";
const CELO_MAINNET_ID = 42220;

/** Celo mainnet defaults when reward-contract reads / env are missing. */
const CELO_USDT = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as Address;
const CELO_CUSD = "0x765de816845861e75A25Fca8693AA1d4d8e6cDd6" as Address;

type TokenRow = {
  symbol: string;
  tokenAddress: Address | undefined;
  decimals: number;
};

function copyText(text: string) {
  void navigator.clipboard?.writeText(text);
}

function shortAddr(addr: string, left = 8, right = 6) {
  if (addr.length <= left + right + 2) return addr;
  return `${addr.slice(0, left)}…${addr.slice(-right)}`;
}

function celoscanUrl(addr: string) {
  return `https://celoscan.io/address/${addr}`;
}

function celoscanTxUrl(hash: string) {
  return `https://celoscan.io/tx/${hash}`;
}

export default function GameProxyTreasurySection() {
  const { open } = useAppKit();
  const { address: connectedAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const proxyAddress = TYCOON_CONTRACT_ADDRESSES[chainId as keyof typeof TYCOON_CONTRACT_ADDRESSES];
  const {
    tycAddress,
    usdcAddress,
    cusdcAddress,
    usdtAddress,
    isLoading: tokensLoading,
  } = useRewardTokenAddresses();

  const resolvedUsdt = (usdtAddress || CELO_USDT) as Address;
  const resolvedUsdc = (usdcAddress ||
    USDC_TOKEN_ADDRESS[chainId as keyof typeof USDC_TOKEN_ADDRESS] ||
    USDC_TOKEN_ADDRESS[42220]) as Address | undefined;
  const resolvedCusd = (cusdcAddress || CELO_CUSD) as Address;
  const resolvedTyc = (tycAddress ||
    TYC_TOKEN_ADDRESS[chainId as keyof typeof TYC_TOKEN_ADDRESS]) as Address | undefined;

  const { data: contractOwner } = useReadContract({
    address: proxyAddress,
    abi: TycoonABI,
    functionName: "owner",
    query: { enabled: !!proxyAddress },
  });

  const [rescueTo, setRescueTo] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [busySymbol, setBusySymbol] = useState<string | null>(null);
  const [rescueAllBusy, setRescueAllBusy] = useState(false);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [upgradeHint, setUpgradeHint] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RESCUE_TO_STORAGE_KEY);
      if (saved && isAddress(saved)) setRescueTo(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const persistRescueTo = useCallback((value: string) => {
    setRescueTo(value);
    try {
      if (value && isAddress(value)) localStorage.setItem(RESCUE_TO_STORAGE_KEY, value);
      else localStorage.removeItem(RESCUE_TO_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const tokenRows: TokenRow[] = useMemo(
    () => [
      { symbol: "USDT", tokenAddress: resolvedUsdt, decimals: 6 },
      { symbol: "USDC", tokenAddress: resolvedUsdc, decimals: 6 },
      { symbol: "cUSD", tokenAddress: resolvedCusd, decimals: 18 },
      { symbol: "TYC", tokenAddress: resolvedTyc, decimals: 18 },
    ],
    [resolvedUsdt, resolvedUsdc, resolvedCusd, resolvedTyc]
  );

  const usdtBal = useBalance({
    address: proxyAddress,
    token: resolvedUsdt,
    query: { enabled: !!proxyAddress && !!resolvedUsdt },
  });
  const usdcBal = useBalance({
    address: proxyAddress,
    token: resolvedUsdc,
    query: { enabled: !!proxyAddress && !!resolvedUsdc },
  });
  const cusdcBal = useBalance({
    address: proxyAddress,
    token: resolvedCusd,
    query: { enabled: !!proxyAddress && !!resolvedCusd },
  });
  const tycBal = useBalance({
    address: proxyAddress,
    token: resolvedTyc,
    query: { enabled: !!proxyAddress && !!resolvedTyc },
  });

  const balanceBySymbol: Record<string, ReturnType<typeof useBalance>> = {
    USDT: usdtBal,
    USDC: usdcBal,
    cUSD: cusdcBal,
    TYC: tycBal,
  };

  const ownerAddr = contractOwner as Address | undefined;
  const isOwner =
    !!connectedAddress &&
    !!ownerAddr &&
    connectedAddress.toLowerCase() === ownerAddr.toLowerCase();

  const rescueToValid = rescueTo.trim() !== "" && isAddress(rescueTo.trim());
  const wrongChain = chainId !== CELO_MAINNET_ID;

  const refetchBalances = useCallback(() => {
    void usdtBal.refetch();
    void usdcBal.refetch();
    void cusdcBal.refetch();
    void tycBal.refetch();
  }, [usdtBal, usdcBal, cusdcBal, tycBal]);

  const executeRescue = useCallback(
    async (token: Address, symbol: string, amount: bigint) => {
      if (!proxyAddress) throw new Error("Game proxy not configured for this chain");
      if (!rescueToValid) throw new Error("Enter a valid recipient address");
      if (amount <= 0n) throw new Error("Nothing to rescue");
      if (!isOwner) throw new Error("Connected wallet is not the contract owner");

      setBusySymbol(symbol);
      setStatusError(null);
      setUpgradeHint(false);
      setStatusMsg(`Rescuing ${symbol}…`);
      setLastTxHash(null);

      const to = rescueTo.trim() as Address;
      try {
        const hash = await writeContractAsync({
          address: proxyAddress,
          abi: TycoonABI,
          functionName: "rescueERC20",
          args: [token, to, amount],
        });
        setLastTxHash(hash);
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }
        setStatusMsg(`Rescued ${symbol} to ${shortAddr(to)}.`);
        refetchBalances();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/rescueERC20|function selector|execution reverted/i.test(msg)) {
          setUpgradeHint(true);
        }
        throw e;
      }
    },
    [
      proxyAddress,
      rescueToValid,
      isOwner,
      rescueTo,
      writeContractAsync,
      publicClient,
      refetchBalances,
    ]
  );

  const handleRescueMax = async (row: TokenRow) => {
    const bal = balanceBySymbol[row.symbol];
    const raw = bal.data?.value;
    if (!row.tokenAddress || raw === undefined) return;
    try {
      await executeRescue(row.tokenAddress, row.symbol, raw);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Rescue failed");
      setStatusMsg(null);
    } finally {
      setBusySymbol(null);
    }
  };

  const handleRescueCustom = async (row: TokenRow) => {
    const custom = customAmounts[row.symbol]?.trim();
    if (!custom) {
      setStatusError("Enter an amount");
      return;
    }
    const num = Number(custom);
    if (!Number.isFinite(num) || num <= 0) {
      setStatusError("Invalid amount");
      return;
    }
    if (!row.tokenAddress) return;
    try {
      const amount = parseUnits(custom, row.decimals);
      const max = balanceBySymbol[row.symbol].data?.value ?? 0n;
      if (amount > max) {
        setStatusError(
          `Amount exceeds proxy balance (${formatUnits(max, row.decimals)} ${row.symbol})`
        );
        return;
      }
      await executeRescue(row.tokenAddress, row.symbol, amount);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Rescue failed");
      setStatusMsg(null);
    } finally {
      setBusySymbol(null);
    }
  };

  const handleRescueAll = async () => {
    setRescueAllBusy(true);
    setStatusError(null);
    setLastTxHash(null);
    const withBalance = tokenRows.filter((row) => {
      const v = balanceBySymbol[row.symbol].data?.value ?? 0n;
      return row.tokenAddress && v > 0n;
    });
    if (withBalance.length === 0) {
      setStatusError("No token balances to rescue");
      setRescueAllBusy(false);
      return;
    }
    try {
      for (let i = 0; i < withBalance.length; i++) {
        const row = withBalance[i];
        const raw = balanceBySymbol[row.symbol].data!.value!;
        setStatusMsg(`Rescuing ${row.symbol} (${i + 1}/${withBalance.length})…`);
        await executeRescue(row.tokenAddress!, row.symbol, raw);
        setBusySymbol(null);
      }
      setStatusMsg(`Rescued ${withBalance.length} token(s) to ${shortAddr(rescueTo.trim())}.`);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Rescue all failed");
      setStatusMsg(null);
    } finally {
      setBusySymbol(null);
      setRescueAllBusy(false);
      refetchBalances();
    }
  };

  const anyBusy = busySymbol !== null || rescueAllBusy;
  const balancesLoading =
    tokensLoading || usdtBal.isLoading || usdcBal.isLoading || cusdcBal.isLoading || tycBal.isLoading;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-cyan-400" />
          Game proxy · stranded tokens
        </h2>
        <p className="text-xs text-slate-500 mt-2 max-w-3xl">
          Tokens sitting on the UUPS game proxy (not player wallets). Owner calls{" "}
          <code className="text-slate-400">rescueERC20</code> and chooses the destination. Requires a
          proxy upgrade that includes this function.
        </p>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500 text-xs uppercase tracking-wide">Game proxy</dt>
            <dd className="font-mono text-cyan-200/90 text-xs mt-0.5 flex items-center gap-2 flex-wrap">
              {proxyAddress ? (
                <>
                  <a
                    href={celoscanUrl(proxyAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline inline-flex items-center gap-1"
                  >
                    {shortAddr(proxyAddress, 10, 8)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => copyText(proxyAddress)}
                    className="text-slate-500 hover:text-slate-300"
                    title="Copy address"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <span className="text-amber-300">Not set for chain {chainId}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase tracking-wide">Contract owner</dt>
            <dd className="font-mono text-slate-300 text-xs mt-0.5">
              {ownerAddr ? shortAddr(ownerAddr, 10, 8) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase tracking-wide">Connected wallet</dt>
            <dd className="text-xs mt-0.5">
              {isConnected && connectedAddress ? (
                <span className="font-mono text-slate-300">{shortAddr(connectedAddress)}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => open()}
                  className="text-cyan-400 hover:text-cyan-300 font-medium"
                >
                  Connect wallet
                </button>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase tracking-wide">Owner match</dt>
            <dd className="mt-0.5">
              {isOwner ? (
                <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Yes — can rescue
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-300 text-xs">
                  <AlertCircle className="w-3.5 h-3.5" /> Connect owner wallet
                </span>
              )}
            </dd>
          </div>
        </dl>

        {wrongChain && (
          <p className="mt-3 text-xs text-amber-300 border border-amber-800/50 bg-amber-950/30 rounded-lg px-3 py-2">
            Switch wallet to <strong>Celo mainnet (42220)</strong> to read balances and rescue.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <label className="text-xs text-slate-500 uppercase tracking-wide block mb-2">
          Rescue to address
        </label>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            value={rescueTo}
            onChange={(e) => persistRescueTo(e.target.value)}
            placeholder="0x… where funds should go"
            className="flex-1 min-w-[240px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm font-mono"
          />
          <button
            type="button"
            disabled={!connectedAddress}
            onClick={() => connectedAddress && persistRescueTo(connectedAddress)}
            className="px-3 py-2 rounded-lg text-xs font-medium border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Use connected
          </button>
          <button
            type="button"
            disabled={!ownerAddr}
            onClick={() => ownerAddr && persistRescueTo(ownerAddr)}
            className="px-3 py-2 rounded-lg text-xs font-medium border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Use owner
          </button>
        </div>
        {rescueTo.trim() && !rescueToValid && (
          <p className="text-xs text-red-400 mt-2">Invalid Ethereum address</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-800">
          <span className="text-sm font-semibold text-slate-200">Balances on game proxy</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => refetchBalances()}
              disabled={balancesLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${balancesLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void handleRescueAll()}
              disabled={
                anyBusy || !isOwner || !rescueToValid || !proxyAddress || wrongChain || balancesLoading
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600/80 hover:bg-cyan-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {rescueAllBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Rescue all (non-zero)
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                <th className="px-4 py-2 font-medium">Token</th>
                <th className="px-4 py-2 font-medium">Balance</th>
                <th className="px-4 py-2 font-medium">Custom amount</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tokenRows.map((row) => {
                const bal = balanceBySymbol[row.symbol];
                const formatted = bal.data?.formatted ?? "—";
                const raw = bal.data?.value ?? 0n;
                const hasToken = !!row.tokenAddress;
                const canRescue = hasToken && raw > 0n && isOwner && rescueToValid && !wrongChain;
                const rowBusy = busySymbol === row.symbol;

                return (
                  <tr key={row.symbol} className="border-b border-slate-800/80 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-200">{row.symbol}</td>
                    <td className="px-4 py-3 tabular-nums text-cyan-100/90">
                      {bal.isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                      ) : !hasToken ? (
                        <span className="text-slate-500 text-xs">Not configured</span>
                      ) : (
                        `${formatted} ${row.symbol}`
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder={`Max ${formatted}`}
                        value={customAmounts[row.symbol] ?? ""}
                        onChange={(e) =>
                          setCustomAmounts((p) => ({ ...p, [row.symbol]: e.target.value }))
                        }
                        disabled={!hasToken || anyBusy}
                        className="w-28 px-2 py-1.5 rounded-md bg-slate-950 border border-slate-700 text-white text-xs"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleRescueMax(row)}
                          disabled={!canRescue || anyBusy}
                          className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-cyan-800/60 text-cyan-300 hover:bg-cyan-950/50 disabled:opacity-40"
                        >
                          {rowBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : null}{" "}
                          Rescue max
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRescueCustom(row)}
                          disabled={!canRescue || anyBusy || !customAmounts[row.symbol]?.trim()}
                          className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-slate-600 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                        >
                          Custom
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {(statusMsg || statusError || lastTxHash || upgradeHint) && (
        <div className="space-y-2">
          {statusMsg && (
            <p className="text-sm text-emerald-400 border border-emerald-900/40 bg-emerald-950/20 rounded-lg px-3 py-2">
              {statusMsg}
            </p>
          )}
          {statusError && (
            <p className="text-sm text-red-400 border border-red-900/50 bg-red-950/30 rounded-lg px-3 py-2">
              {statusError}
            </p>
          )}
          {upgradeHint && (
            <p className="text-sm text-amber-300 border border-amber-800/50 bg-amber-950/30 rounded-lg px-3 py-2">
              Proxy may not have <code className="text-amber-200">rescueERC20</code> yet. Upgrade
              with{" "}
              <code className="text-amber-200">
                forge script script/UpgradeTycoonImpl.s.sol --rpc-url $CELO_RPC --broadcast
              </code>{" "}
              using the owner key, then try again.
            </p>
          )}
          {lastTxHash && (
            <a
              href={celoscanTxUrl(lastTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cyan-400 hover:underline inline-flex items-center gap-1"
            >
              View tx {shortAddr(lastTxHash, 10, 8)}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
