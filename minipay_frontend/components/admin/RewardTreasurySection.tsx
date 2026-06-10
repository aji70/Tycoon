"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  useChainId,
  usePublicClient,
  useReadContract,
  useWriteContract,
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
import { REWARD_CONTRACT_ADDRESSES } from "@/constants/contracts";
import RewardABI from "@/context/abi/rewardabi.json";
import { useRewardTokenAddresses } from "@/context/ContractProvider";

const WITHDRAW_TO_STORAGE_KEY = "tycoon_admin_treasury_withdraw_to";
const CELO_MAINNET_ID = 42220;

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

export default function RewardTreasurySection() {
  const { open } = useAppKit();
  const { address: connectedAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const rewardAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES];
  const { tycAddress, usdcAddress, cusdcAddress, usdtAddress, isLoading: tokensLoading } =
    useRewardTokenAddresses();

  const { data: contractOwner } = useReadContract({
    address: rewardAddress,
    abi: RewardABI,
    functionName: "owner",
    query: { enabled: !!rewardAddress },
  });

  const [withdrawTo, setWithdrawTo] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [busySymbol, setBusySymbol] = useState<string | null>(null);
  const [withdrawAllBusy, setWithdrawAllBusy] = useState(false);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(WITHDRAW_TO_STORAGE_KEY);
      if (saved && isAddress(saved)) setWithdrawTo(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const persistWithdrawTo = useCallback((value: string) => {
    setWithdrawTo(value);
    try {
      if (value && isAddress(value)) localStorage.setItem(WITHDRAW_TO_STORAGE_KEY, value);
      else localStorage.removeItem(WITHDRAW_TO_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const tokenRows: TokenRow[] = useMemo(
    () => [
      { symbol: "USDT", tokenAddress: usdtAddress, decimals: 6 },
      { symbol: "USDC", tokenAddress: usdcAddress, decimals: 6 },
      { symbol: "cUSD", tokenAddress: cusdcAddress, decimals: 6 },
      { symbol: "TYC", tokenAddress: tycAddress, decimals: 18 },
    ],
    [usdtAddress, usdcAddress, cusdcAddress, tycAddress]
  );

  const usdtBal = useBalance({
    address: rewardAddress,
    token: usdtAddress,
    query: { enabled: !!rewardAddress && !!usdtAddress },
  });
  const usdcBal = useBalance({
    address: rewardAddress,
    token: usdcAddress,
    query: { enabled: !!rewardAddress && !!usdcAddress },
  });
  const cusdcBal = useBalance({
    address: rewardAddress,
    token: cusdcAddress,
    query: { enabled: !!rewardAddress && !!cusdcAddress },
  });
  const tycBal = useBalance({
    address: rewardAddress,
    token: tycAddress,
    query: { enabled: !!rewardAddress && !!tycAddress },
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

  const withdrawToValid = withdrawTo.trim() !== "" && isAddress(withdrawTo.trim());
  const wrongChain = chainId !== CELO_MAINNET_ID;

  const refetchBalances = useCallback(() => {
    void usdtBal.refetch();
    void usdcBal.refetch();
    void cusdcBal.refetch();
    void tycBal.refetch();
  }, [usdtBal, usdcBal, cusdcBal, tycBal]);

  const executeWithdraw = useCallback(
    async (token: Address, symbol: string, amount: bigint) => {
      if (!rewardAddress) throw new Error("Reward contract not configured for this chain");
      if (!withdrawToValid) throw new Error("Enter a valid recipient address");
      if (amount <= 0n) throw new Error("Nothing to withdraw");
      if (!isOwner) throw new Error("Connected wallet is not the contract owner");

      setBusySymbol(symbol);
      setStatusError(null);
      setStatusMsg(`Withdrawing ${symbol}…`);
      setLastTxHash(null);

      const to = withdrawTo.trim() as Address;
      const hash = await writeContractAsync({
        address: rewardAddress,
        abi: RewardABI,
        functionName: "withdrawFunds",
        args: [token, to, amount],
      });
      setLastTxHash(hash);
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      setStatusMsg(`Withdrew ${symbol} successfully.`);
      refetchBalances();
    },
    [rewardAddress, withdrawToValid, isOwner, withdrawTo, writeContractAsync, publicClient, refetchBalances]
  );

  const handleWithdrawMax = async (row: TokenRow) => {
    const bal = balanceBySymbol[row.symbol];
    const raw = bal.data?.value;
    if (!row.tokenAddress || raw === undefined) return;
    try {
      await executeWithdraw(row.tokenAddress, row.symbol, raw);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Withdraw failed");
      setStatusMsg(null);
    } finally {
      setBusySymbol(null);
    }
  };

  const handleWithdrawCustom = async (row: TokenRow) => {
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
        setStatusError(`Amount exceeds contract balance (${formatUnits(max, row.decimals)} ${row.symbol})`);
        return;
      }
      await executeWithdraw(row.tokenAddress, row.symbol, amount);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Withdraw failed");
      setStatusMsg(null);
    } finally {
      setBusySymbol(null);
    }
  };

  const handleWithdrawAll = async () => {
    setWithdrawAllBusy(true);
    setStatusError(null);
    setLastTxHash(null);
    const withBalance = tokenRows.filter((row) => {
      const v = balanceBySymbol[row.symbol].data?.value ?? 0n;
      return row.tokenAddress && v > 0n;
    });
    if (withBalance.length === 0) {
      setStatusError("No token balances to withdraw");
      setWithdrawAllBusy(false);
      return;
    }
    try {
      for (let i = 0; i < withBalance.length; i++) {
        const row = withBalance[i];
        const raw = balanceBySymbol[row.symbol].data!.value!;
        setStatusMsg(`Withdrawing ${row.symbol} (${i + 1}/${withBalance.length})…`);
        await executeWithdraw(row.tokenAddress!, row.symbol, raw);
        setBusySymbol(null);
      }
      setStatusMsg(`Withdrew ${withBalance.length} token(s) to ${shortAddr(withdrawTo.trim())}.`);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Withdraw all failed");
      setStatusMsg(null);
    } finally {
      setBusySymbol(null);
      setWithdrawAllBusy(false);
      refetchBalances();
    }
  };

  const anyBusy = busySymbol !== null || withdrawAllBusy;
  const balancesLoading =
    tokensLoading || usdtBal.isLoading || usdcBal.isLoading || cusdcBal.isLoading || tycBal.isLoading;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-cyan-400" />
          TycoonRewardSystem · shop treasury
        </h2>
        <p className="text-xs text-slate-500 mt-2 max-w-3xl">
          Perk and bundle payments (USDT, USDC, cUSD, TYC) accumulate on the reward contract. Only the contract{" "}
          <code className="text-slate-400">owner</code> can call <code className="text-slate-400">withdrawFunds</code>.
          Naira / Flutterwave revenue is not held here.
        </p>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500 text-xs uppercase tracking-wide">Reward contract</dt>
            <dd className="font-mono text-cyan-200/90 text-xs mt-0.5 flex items-center gap-2 flex-wrap">
              {rewardAddress ? (
                <>
                  <a
                    href={celoscanUrl(rewardAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline inline-flex items-center gap-1"
                  >
                    {shortAddr(rewardAddress, 10, 8)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => copyText(rewardAddress)}
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
                  <CheckCircle2 className="w-3.5 h-3.5" /> Yes — can withdraw
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
            Switch wallet to <strong>Celo mainnet (42220)</strong> to read balances and withdraw.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <label className="text-xs text-slate-500 uppercase tracking-wide block mb-2">
          Withdraw to address
        </label>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            value={withdrawTo}
            onChange={(e) => persistWithdrawTo(e.target.value)}
            placeholder="0x… preferred recipient"
            className="flex-1 min-w-[240px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm font-mono"
          />
          <button
            type="button"
            disabled={!connectedAddress}
            onClick={() => connectedAddress && persistWithdrawTo(connectedAddress)}
            className="px-3 py-2 rounded-lg text-xs font-medium border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Use connected
          </button>
          <button
            type="button"
            disabled={!ownerAddr}
            onClick={() => ownerAddr && persistWithdrawTo(ownerAddr)}
            className="px-3 py-2 rounded-lg text-xs font-medium border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Use owner
          </button>
        </div>
        {withdrawTo.trim() && !withdrawToValid && (
          <p className="text-xs text-red-400 mt-2">Invalid Ethereum address</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-800">
          <span className="text-sm font-semibold text-slate-200">Balances on reward contract</span>
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
              onClick={() => void handleWithdrawAll()}
              disabled={
                anyBusy ||
                !isOwner ||
                !withdrawToValid ||
                !rewardAddress ||
                wrongChain ||
                balancesLoading
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600/80 hover:bg-cyan-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {withdrawAllBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Withdraw all (non-zero)
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
                const canWithdraw = hasToken && raw > 0n && isOwner && withdrawToValid && !wrongChain;
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
                          onClick={() => void handleWithdrawMax(row)}
                          disabled={!canWithdraw || anyBusy}
                          className="px-2.5 py-1.5 rounded-md text-xs font-medium border border-cyan-800/60 text-cyan-300 hover:bg-cyan-950/50 disabled:opacity-40"
                        >
                          {rowBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : null}
                          Max
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleWithdrawCustom(row)}
                          disabled={!canWithdraw || anyBusy || !(customAmounts[row.symbol]?.trim())}
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

      {(statusMsg || statusError || lastTxHash) && (
        <div
          className={`rounded-lg px-4 py-3 text-sm border ${
            statusError
              ? "border-red-900/50 bg-red-950/30 text-red-300"
              : "border-emerald-900/50 bg-emerald-950/20 text-emerald-200"
          }`}
        >
          {statusError && <p>{statusError}</p>}
          {statusMsg && !statusError && <p>{statusMsg}</p>}
          {lastTxHash && (
            <p className="mt-1 text-xs font-mono">
              Tx:{" "}
              <a
                href={celoscanTxUrl(lastTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:underline"
              >
                {shortAddr(lastTxHash, 12, 8)}
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
