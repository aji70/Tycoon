"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAccount, useBalance, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { useUserRegistryWallet, useProfileOwner, useTransferProfileTo } from "@/context/ContractProvider";
import { useRewardTokenAddresses } from "@/context/ContractProvider";
import { USDC_TOKEN_ADDRESS, NAIRA_VAULT_ADDRESSES, SMART_WALLET_OPERATOR_ADDRESSES, WITHDRAWAL_AUTHORITY_ADDRESSES } from "@/constants/contracts";
import { parseEther, type Address } from "viem";
import { toast } from "react-toastify";
import { Copy, Wallet, Coins, Loader2, Send, ArrowRightLeft, Banknote, ExternalLink } from "lucide-react";
import { apiClient } from "@/lib/api";

const UserWalletABI = [
  { inputs: [], name: "balanceNative", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "token", type: "address" }], name: "balanceERC20", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "owner", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "operator", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "withdrawalAuthority", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "nairaVault", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "withdrawNative", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "token", type: "address" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "withdrawERC20", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "vault", type: "address" }], name: "setNairaVault", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "_operator", type: "address" }], name: "setOperator", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "_authority", type: "address" }], name: "setWithdrawalAuthority", outputs: [], stateMutability: "nonpayable", type: "function" },
] as const;

export default function ManageSmartWalletPage() {
  const { address: walletAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const auth = useGuestAuthOptional();
  const guestUser = auth?.guestUser ?? null;

  const fromRegistry = useUserRegistryWallet(walletAddress as Address | undefined);
  const smartWalletFromConnection = fromRegistry.data;
  const smartWalletFromGuest = guestUser?.smart_wallet_address && String(guestUser.smart_wallet_address).trim() && guestUser.smart_wallet_address !== "0x0000000000000000000000000000000000000000"
    ? (guestUser.smart_wallet_address as Address)
    : undefined;

  const zeroAddr = "0x0000000000000000000000000000000000000000" as Address;
  const isZeroAddress = (a: string | undefined) => !a || a.toLowerCase() === zeroAddr.toLowerCase();

  const rawSmartWallet = isConnected ? smartWalletFromConnection : smartWalletFromGuest;
  /** Treat zero address (registry "no profile") as no wallet so we show "Create from Profile" flow. */
  const smartWalletAddress = rawSmartWallet && !isZeroAddress(rawSmartWallet) ? rawSmartWallet : undefined;
  const hasSmartWallet = !!smartWalletAddress;

  const { data: profileOwner } = useProfileOwner(smartWalletAddress);
  const isOwner = isConnected && !!walletAddress && !!profileOwner && profileOwner !== zeroAddr && walletAddress.toLowerCase() === (profileOwner as string).toLowerCase();

  const { tycAddress: tycTokenAddress, usdcAddress: usdcTokenAddress } = useRewardTokenAddresses();
  const usdcAddress = USDC_TOKEN_ADDRESS[chainId as keyof typeof USDC_TOKEN_ADDRESS];

  const celoBalance = useBalance({ address: smartWalletAddress, query: { enabled: !!smartWalletAddress } });
  const usdcBalance = useBalance({ address: smartWalletAddress, token: usdcTokenAddress ?? usdcAddress, query: { enabled: !!smartWalletAddress && !!(usdcTokenAddress ?? usdcAddress) } });
  const tycBalance = useBalance({ address: smartWalletAddress, token: tycTokenAddress, query: { enabled: !!smartWalletAddress && !!tycTokenAddress } });

  const { data: currentNairaVault } = useReadContract({
    address: smartWalletAddress,
    abi: UserWalletABI,
    functionName: "nairaVault",
    query: { enabled: !!smartWalletAddress },
  });
  const appVaultAddress = NAIRA_VAULT_ADDRESSES[chainId as keyof typeof NAIRA_VAULT_ADDRESSES];
  const needsEnableNgn = isOwner && appVaultAddress && (!currentNairaVault || currentNairaVault === zeroAddr || String(currentNairaVault).toLowerCase() === zeroAddr.toLowerCase());

  const { data: currentOperator } = useReadContract({
    address: smartWalletAddress,
    abi: UserWalletABI,
    functionName: "operator",
    query: { enabled: !!smartWalletAddress },
  });
  const appOperatorAddress = SMART_WALLET_OPERATOR_ADDRESSES[chainId as keyof typeof SMART_WALLET_OPERATOR_ADDRESSES];
  const needsEnableOperator = isOwner && appOperatorAddress && (!currentOperator || currentOperator === zeroAddr || String(currentOperator).toLowerCase() === zeroAddr.toLowerCase());

  const { data: currentWithdrawalAuthority } = useReadContract({
    address: smartWalletAddress,
    abi: UserWalletABI,
    functionName: "withdrawalAuthority",
    query: { enabled: !!smartWalletAddress },
  });
  const appAuthorityAddress = WITHDRAWAL_AUTHORITY_ADDRESSES[chainId as keyof typeof WITHDRAWAL_AUTHORITY_ADDRESSES];
  const needsEnableAuthority = isOwner && appAuthorityAddress && (!currentWithdrawalAuthority || currentWithdrawalAuthority === zeroAddr || String(currentWithdrawalAuthority).toLowerCase() === zeroAddr.toLowerCase());

  const [withdrawCeloTo, setWithdrawCeloTo] = useState("");
  const [withdrawCeloAmount, setWithdrawCeloAmount] = useState("");
  const [withdrawUsdcTo, setWithdrawUsdcTo] = useState("");
  const [withdrawUsdcAmount, setWithdrawUsdcAmount] = useState("");
  const [withdrawCeloApiTo, setWithdrawCeloApiTo] = useState("");
  const [withdrawCeloApiAmount, setWithdrawCeloApiAmount] = useState("");
  const [withdrawCeloApiPin, setWithdrawCeloApiPin] = useState("");
  const [withdrawUsdcApiTo, setWithdrawUsdcApiTo] = useState("");
  const [withdrawUsdcApiAmount, setWithdrawUsdcApiAmount] = useState("");
  const [withdrawUsdcApiPin, setWithdrawUsdcApiPin] = useState("");
  const [apiWithdrawLoading, setApiWithdrawLoading] = useState(false);
  const [apiWithdrawError, setApiWithdrawError] = useState<string | null>(null);
  const [withdrawalPin, setWithdrawalPin] = useState("");
  const [withdrawalPinConfirm, setWithdrawalPinConfirm] = useState("");
  const [setPinLoading, setSetPinLoading] = useState(false);
  const [setPinError, setSetPinError] = useState<string | null>(null);
  const [nairaWithdrawAmount, setNairaWithdrawAmount] = useState("");
  const [nairaWithdrawLoading, setNairaWithdrawLoading] = useState(false);
  const [nairaWithdrawError, setNairaWithdrawError] = useState<string | null>(null);
  const [transferToAddress, setTransferToAddress] = useState("");

  const { writeContractAsync, isPending: writePending, data: txHash } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });
  const { transfer: transferProfileTo, isPending: transferPending } = useTransferProfileTo();

  const handleWithdrawCelo = async () => {
    if (!smartWalletAddress || !withdrawCeloTo.trim() || !withdrawCeloAmount) return;
    const to = withdrawCeloTo.trim() as Address;
    const amount = parseEther(withdrawCeloAmount);
    try {
      await writeContractAsync({
        address: smartWalletAddress,
        abi: UserWalletABI,
        functionName: "withdrawNative",
        args: [to, amount],
      });
      toast.success("Withdraw submitted. Confirm in your wallet.");
      setWithdrawCeloAmount("");
      setWithdrawCeloTo("");
    } catch (e) {
      toast.error((e as Error)?.message ?? "Withdraw failed");
    }
  };

  const handleWithdrawUsdc = async () => {
    if (!smartWalletAddress || !withdrawUsdcTo.trim() || !withdrawUsdcAmount || !(usdcTokenAddress ?? usdcAddress)) return;
    const to = withdrawUsdcTo.trim() as Address;
    const decimals = usdcBalance.data?.decimals ?? 6;
    const amount = BigInt(Math.floor(Number(withdrawUsdcAmount) * 10 ** decimals));
    try {
      await writeContractAsync({
        address: smartWalletAddress,
        abi: UserWalletABI,
        functionName: "withdrawERC20",
        args: [usdcTokenAddress ?? usdcAddress!, to, amount],
      });
      toast.success("Withdraw submitted. Confirm in your wallet.");
      setWithdrawUsdcAmount("");
      setWithdrawUsdcTo("");
    } catch (e) {
      toast.error((e as Error)?.message ?? "Withdraw failed");
    }
  };

  const handleTransferProfile = async () => {
    const addr = transferToAddress.trim();
    if (!addr) return;
    try {
      await transferProfileTo(addr as Address);
      setTransferToAddress("");
      toast.success("Transfer submitted. Confirm in your wallet.");
      auth?.refetchGuest?.();
    } catch (e) {
      toast.error((e as Error)?.message ?? "Transfer failed");
    }
  };

  const handleWithdrawCeloViaApi = async (e: React.FormEvent) => {
    e.preventDefault();
    const to = withdrawCeloApiTo.trim();
    const amount = withdrawCeloApiAmount.trim();
    const pin = withdrawCeloApiPin.trim();
    if (!to || !amount || Number(amount) <= 0) return;
    if (!pin) {
      setApiWithdrawError("Enter your withdrawal PIN.");
      return;
    }
    setApiWithdrawError(null);
    setApiWithdrawLoading(true);
    try {
      const res = await apiClient.post<{ success?: boolean; message?: string }>("auth/smart-wallet/withdraw-celo", { to, amount, pin });
      if (res.data?.success) {
        toast.success("Withdrawal submitted.");
        setWithdrawCeloApiTo("");
        setWithdrawCeloApiAmount("");
        setWithdrawCeloApiPin("");
      } else {
        setApiWithdrawError((res.data as { message?: string })?.message ?? "Failed");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (err as Error)?.message ?? "Failed";
      setApiWithdrawError(String(msg));
    } finally {
      setApiWithdrawLoading(false);
    }
  };

  const handleWithdrawUsdcViaApi = async (e: React.FormEvent) => {
    e.preventDefault();
    const to = withdrawUsdcApiTo.trim();
    const amount = withdrawUsdcApiAmount.trim();
    const pin = withdrawUsdcApiPin.trim();
    if (!to || !amount || Number(amount) <= 0) return;
    if (!pin) {
      setApiWithdrawError("Enter your withdrawal PIN.");
      return;
    }
    setApiWithdrawError(null);
    setApiWithdrawLoading(true);
    try {
      const res = await apiClient.post<{ success?: boolean; message?: string }>("auth/smart-wallet/withdraw-usdc", { to, amount, pin });
      if (res.data?.success) {
        toast.success("Withdrawal submitted.");
        setWithdrawUsdcApiTo("");
        setWithdrawUsdcApiAmount("");
        setWithdrawUsdcApiPin("");
      } else {
        setApiWithdrawError((res.data as { message?: string })?.message ?? "Failed");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (err as Error)?.message ?? "Failed";
      setApiWithdrawError(String(msg));
    } finally {
      setApiWithdrawLoading(false);
    }
  };

  const handleSetWithdrawalPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const pin = withdrawalPin.trim();
    const confirm = withdrawalPinConfirm.trim();
    if (!/^\d{4,8}$/.test(pin)) {
      setSetPinError("PIN must be 4–8 digits.");
      return;
    }
    if (pin !== confirm) {
      setSetPinError("PIN and confirmation do not match.");
      return;
    }
    setSetPinError(null);
    setSetPinLoading(true);
    try {
      const res = await apiClient.post<{ success?: boolean; message?: string }>("auth/set-withdrawal-pin", { pin });
      if (res.data?.success) {
        toast.success("Withdrawal PIN set.");
        setWithdrawalPin("");
        setWithdrawalPinConfirm("");
        auth?.refetchGuest?.();
      } else {
        setSetPinError((res.data as { message?: string })?.message ?? "Failed");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (err as Error)?.message ?? "Failed";
      setSetPinError(String(msg));
    } finally {
      setSetPinLoading(false);
    }
  };

  const handleNairaWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = nairaWithdrawAmount.trim();
    if (!amount || Number(amount) <= 0) return;
    setNairaWithdrawError(null);
    setNairaWithdrawLoading(true);
    try {
      const res = await apiClient.post<{ success?: boolean; message?: string }>("auth/naira-withdraw", { amountCelo: amount });
      if (res.data?.success) {
        toast.success("Withdrawal requested. You will receive Naira once processed.");
        setNairaWithdrawAmount("");
      } else {
        setNairaWithdrawError(res.data?.message ?? "Request failed");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? (err as Error)?.message ?? "Request failed";
      setNairaWithdrawError(String(msg));
    } finally {
      setNairaWithdrawLoading(false);
    }
  };

  const [createWalletLoading, setCreateWalletLoading] = useState(false);
  const [createWalletError, setCreateWalletError] = useState<string | null>(null);

  if (!hasSmartWallet) {
    const handleCreateSmartWallet = async () => {
      if (!auth?.createSmartWallet) return;
      setCreateWalletError(null);
      setCreateWalletLoading(true);
      try {
        const res = await auth.createSmartWallet({ chain: "CELO" });
        if (res.success) {
          toast.success("Smart wallet created.");
          auth.refetchGuest?.();
          fromRegistry.refetch();
        } else {
          setCreateWalletError(res.message ?? "Failed to create wallet");
        }
      } catch (e) {
        const msg = (e as Error)?.message ?? "Failed";
        setCreateWalletError(msg);
        toast.error(msg);
      } finally {
        setCreateWalletLoading(false);
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#010F10] via-[#0A1C1E] to-[#0E1415]">
        <header className="sticky top-0 z-20 border-b border-white/5 bg-[#030c0d]/90 backdrop-blur-xl">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between max-w-5xl">
            <Link href="/profile" className="flex items-center gap-2 text-cyan-300/90 hover:text-cyan-200 text-sm font-medium">
              <span className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">←</span>
              Back
            </Link>
            <h1 className="text-lg font-semibold text-white/90">Manage smart wallet</h1>
            <div className="w-20" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-12 max-w-xl text-center space-y-4">
          <p className="text-white/80">You don’t have a smart wallet yet. Create one below (no gas required) or from your Profile.</p>
          {createWalletError && <p className="text-sm text-red-300">{createWalletError}</p>}
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              onClick={handleCreateSmartWallet}
              disabled={createWalletLoading || !auth?.createSmartWallet}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/25 border border-cyan-500/50 text-cyan-300 font-medium disabled:opacity-50"
            >
              {createWalletLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
              Create smart wallet
            </button>
            <Link href="/profile" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white font-medium">
              Go to Profile
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const pendingAny = writePending || isConfirming || transferPending;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#010F10] via-[#0A1C1E] to-[#0E1415]">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#030c0d]/90 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between max-w-5xl">
          <Link href="/profile" className="flex items-center gap-2 text-cyan-300/90 hover:text-cyan-200 text-sm font-medium">
            <span className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">←</span>
            Back
          </Link>
          <h1 className="text-lg font-semibold text-white/90">Manage smart wallet</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        <section className="rounded-2xl border border-cyan-500/20 bg-[#011112]/80 p-5">
          <h2 className="text-base font-semibold text-cyan-400 mb-3 flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Smart wallet address
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-cyan-200 break-all">{smartWalletAddress}</span>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(smartWalletAddress!); toast.success("Copied"); }}
              className="p-2 rounded-lg bg-white/10 hover:bg-cyan-500/20 text-cyan-300"
              aria-label="Copy"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          {!isConnected && (
            <p className="text-xs text-white/50 mt-2">You can withdraw CELO/USDC below without connecting (if you’ve enabled managed withdrawals).</p>
          )}
        </section>

        <section className="rounded-2xl border border-cyan-500/20 bg-[#011112]/80 p-5">
          <h2 className="text-base font-semibold text-cyan-400 mb-4 flex items-center gap-2">
            <Coins className="w-4 h-4" /> Balances
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/50">CELO</p>
              <p className="text-lg font-bold text-white mt-0.5">
                {celoBalance.isLoading ? "…" : (celoBalance.data ? Number(celoBalance.data.formatted).toFixed(4) : "0")}
              </p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/50">USDC</p>
              <p className="text-lg font-bold text-white mt-0.5">
                {usdcBalance.isLoading ? "…" : (usdcBalance.data ? Number(usdcBalance.data.formatted).toFixed(2) : "0")}
              </p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-[10px] uppercase tracking-wider text-white/50">TYC</p>
              <p className="text-lg font-bold text-white mt-0.5">
                {tycBalance.isLoading ? "…" : (tycBalance.data ? Number(tycBalance.data.formatted).toFixed(2) : "0")}
              </p>
            </div>
          </div>
        </section>

        {!guestUser?.withdrawal_pin_set && hasSmartWallet && (
          <section className="rounded-2xl border border-amber-500/20 bg-[#011112]/80 p-5">
            <h2 className="text-base font-semibold text-amber-400 mb-2 flex items-center gap-2">Withdrawal PIN (2FA)</h2>
            <p className="text-xs text-white/60 mb-4">Set a 4–8 digit PIN to authorize withdrawals when you’re not connected. This protects your funds even if someone gains API access.</p>
            {setPinError && <p className="text-sm text-red-400 mb-2">{setPinError}</p>}
            <form onSubmit={handleSetWithdrawalPin} className="flex flex-col sm:flex-row flex-wrap gap-2">
              <input type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="PIN (4–8 digits)" value={withdrawalPin} onChange={(e) => setWithdrawalPin(e.target.value)} maxLength={8} className="flex-1 min-w-[120px] px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-white/40 text-sm" />
              <input type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="Confirm PIN" value={withdrawalPinConfirm} onChange={(e) => setWithdrawalPinConfirm(e.target.value)} maxLength={8} className="flex-1 min-w-[120px] px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-white/40 text-sm" />
              <button type="submit" disabled={setPinLoading} className="px-4 py-2 rounded-xl bg-amber-500/25 border border-amber-500/50 text-amber-300 text-sm font-medium disabled:opacity-50">
                {setPinLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Set PIN
              </button>
            </form>
          </section>
        )}

        {!isConnected && hasSmartWallet && (
          <section className="rounded-2xl border border-cyan-500/20 bg-[#011112]/80 p-5">
            <h2 className="text-base font-semibold text-cyan-400 mb-3 flex items-center gap-2">
              <Send className="w-4 h-4" /> Withdraw without connecting
            </h2>
            {!guestUser?.withdrawal_pin_set ? (
              <p className="text-sm text-amber-400/90">Set a withdrawal PIN above first. Withdrawals require your PIN as 2FA.</p>
            ) : (
              <>
                <p className="text-xs text-white/60 mb-4">Withdraw CELO or USDC from your smart wallet. Enter your PIN each time. Enable managed withdrawals once (when connected) if you haven’t.</p>
                {apiWithdrawError && <p className="text-sm text-red-400 mb-2">{apiWithdrawError}</p>}
                <form onSubmit={handleWithdrawCeloViaApi} className="flex flex-wrap gap-2 mb-3">
                  <input type="text" placeholder="Amount (CELO)" value={withdrawCeloApiAmount} onChange={(e) => setWithdrawCeloApiAmount(e.target.value)} className="flex-1 min-w-[100px] px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-white/40 text-sm" />
                  <input type="text" placeholder="To address (0x...)" value={withdrawCeloApiTo} onChange={(e) => setWithdrawCeloApiTo(e.target.value)} className="flex-1 min-w-[180px] px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-white/40 text-sm font-mono" />
                  <input type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="PIN" value={withdrawCeloApiPin} onChange={(e) => setWithdrawCeloApiPin(e.target.value)} maxLength={8} className="w-20 px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-white/40 text-sm" />
                  <button type="submit" disabled={apiWithdrawLoading} className="px-4 py-2 rounded-xl bg-cyan-500/25 border border-cyan-500/50 text-cyan-300 text-sm font-medium disabled:opacity-50">
                    {apiWithdrawLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Withdraw CELO
                  </button>
                </form>
                <form onSubmit={handleWithdrawUsdcViaApi} className="flex flex-wrap gap-2">
                  <input type="text" placeholder="Amount (USDC)" value={withdrawUsdcApiAmount} onChange={(e) => setWithdrawUsdcApiAmount(e.target.value)} className="flex-1 min-w-[100px] px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-white/40 text-sm" />
                  <input type="text" placeholder="To address (0x...)" value={withdrawUsdcApiTo} onChange={(e) => setWithdrawUsdcApiTo(e.target.value)} className="flex-1 min-w-[180px] px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-white/40 text-sm font-mono" />
                  <input type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="PIN" value={withdrawUsdcApiPin} onChange={(e) => setWithdrawUsdcApiPin(e.target.value)} maxLength={8} className="w-20 px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-white/40 text-sm" />
                  <button type="submit" disabled={apiWithdrawLoading} className="px-4 py-2 rounded-xl bg-cyan-500/25 border border-cyan-500/50 text-cyan-300 text-sm font-medium disabled:opacity-50">
                    {apiWithdrawLoading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null} Withdraw USDC
                  </button>
                </form>
              </>
            )}
          </section>
        )}

        {isOwner && (
          <>
            <section className="rounded-2xl border border-cyan-500/20 bg-[#011112]/80 p-5">
              <h2 className="text-base font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                <Send className="w-4 h-4" /> Withdraw CELO
              </h2>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Amount (CELO)"
                  value={withdrawCeloAmount}
                  onChange={(e) => setWithdrawCeloAmount(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-white/40 text-sm"
                />
                <input
                  type="text"
                  placeholder="To address (0x...)"
                  value={withdrawCeloTo}
                  onChange={(e) => setWithdrawCeloTo(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-white/40 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={handleWithdrawCelo}
                  disabled={pendingAny || !withdrawCeloAmount || !withdrawCeloTo.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/25 border border-cyan-500/50 text-cyan-300 text-sm font-medium disabled:opacity-50"
                >
                  {pendingAny ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Withdraw
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-cyan-500/20 bg-[#011112]/80 p-5">
              <h2 className="text-base font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                <Send className="w-4 h-4" /> Withdraw USDC
              </h2>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Amount (USDC)"
                  value={withdrawUsdcAmount}
                  onChange={(e) => setWithdrawUsdcAmount(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-white/40 text-sm"
                />
                <input
                  type="text"
                  placeholder="To address (0x...)"
                  value={withdrawUsdcTo}
                  onChange={(e) => setWithdrawUsdcTo(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-white/40 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={handleWithdrawUsdc}
                  disabled={pendingAny || !withdrawUsdcAmount || !withdrawUsdcTo.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/25 border border-cyan-500/50 text-cyan-300 text-sm font-medium disabled:opacity-50"
                >
                  {pendingAny ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Withdraw
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-cyan-500/20 bg-[#011112]/80 p-5">
              <h2 className="text-base font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" /> Transfer profile to address
              </h2>
              <p className="text-xs text-white/60 mb-2">Move smart wallet ownership to another EOA. You will need to connect with that wallet and link it in Profile.</p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  placeholder="New owner address (0x...)"
                  value={transferToAddress}
                  onChange={(e) => setTransferToAddress(e.target.value)}
                  className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-white/40 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={handleTransferProfile}
                  disabled={transferPending || !transferToAddress.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/25 border border-amber-500/50 text-amber-300 text-sm font-medium disabled:opacity-50"
                >
                  {transferPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                  Transfer
                </button>
              </div>
            </section>

            {needsEnableNgn && (
              <section className="rounded-2xl border border-amber-500/20 bg-[#011112]/80 p-5">
                <h2 className="text-base font-semibold text-amber-400 mb-2">Enable NGN withdrawals</h2>
                <p className="text-xs text-white/60 mb-3">Your wallet was created before we enabled this. One quick step lets you withdraw CELO to Naira (NGN) from this page without reconnecting.</p>
                <button
                  type="button"
                  onClick={async () => {
                    if (!smartWalletAddress || !appVaultAddress) return;
                    try {
                      await writeContractAsync({
                        address: smartWalletAddress,
                        abi: UserWalletABI,
                        functionName: "setNairaVault",
                        args: [appVaultAddress],
                      });
                      toast.success("NGN withdrawals enabled. Confirm in your wallet.");
                    } catch (e) {
                      toast.error((e as Error)?.message ?? "Failed");
                    }
                  }}
                  disabled={pendingAny}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/25 border border-amber-500/50 text-amber-300 text-sm font-medium hover:bg-amber-500/35 disabled:opacity-50"
                >
                  {pendingAny ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                  Enable NGN withdrawals (one-time)
                </button>
              </section>
            )}

            {needsEnableOperator && (
              <section className="rounded-2xl border border-cyan-500/20 bg-[#011112]/80 p-5">
                <h2 className="text-base font-semibold text-cyan-400 mb-2">Enable managed withdrawals</h2>
                <p className="text-xs text-white/60 mb-3">Allow withdrawals when you’re not connected. One quick step so you can withdraw CELO/USDC from this page without connecting your wallet.</p>
                <button
                  type="button"
                  onClick={async () => {
                    if (!smartWalletAddress || !appOperatorAddress) return;
                    try {
                      await writeContractAsync({
                        address: smartWalletAddress,
                        abi: UserWalletABI,
                        functionName: "setOperator",
                        args: [appOperatorAddress],
                      });
                      toast.success("Managed withdrawals enabled. Confirm in your wallet.");
                    } catch (e) {
                      toast.error((e as Error)?.message ?? "Failed");
                    }
                  }}
                  disabled={pendingAny}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/25 border border-cyan-500/50 text-cyan-300 text-sm font-medium hover:bg-cyan-500/35 disabled:opacity-50"
                >
                  {pendingAny ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enable managed withdrawals (one-time)
                </button>
              </section>
            )}

            {needsEnableAuthority && (
              <section className="rounded-2xl border border-amber-500/20 bg-[#011112]/80 p-5">
                <h2 className="text-base font-semibold text-amber-400 mb-2">Enable PIN withdrawals (one-time)</h2>
                <p className="text-xs text-white/60 mb-3">Allow the app to process withdrawals only after you enter your PIN. Required for withdrawing when not connected.</p>
                <button
                  type="button"
                  onClick={async () => {
                    if (!smartWalletAddress || !appAuthorityAddress) return;
                    try {
                      await writeContractAsync({
                        address: smartWalletAddress,
                        abi: UserWalletABI,
                        functionName: "setWithdrawalAuthority",
                        args: [appAuthorityAddress],
                      });
                      toast.success("PIN withdrawals enabled. Set your PIN below if you haven’t.");
                    } catch (e) {
                      toast.error((e as Error)?.message ?? "Failed");
                    }
                  }}
                  disabled={pendingAny}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/25 border border-amber-500/50 text-amber-300 text-sm font-medium hover:bg-amber-500/35 disabled:opacity-50"
                >
                  {pendingAny ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Enable PIN withdrawals (one-time)
                </button>
              </section>
            )}
          </>
        )}

        <section className="rounded-2xl border border-amber-500/20 bg-[#011112]/80 p-5">
          <h2 className="text-base font-semibold text-amber-400 mb-3 flex items-center gap-2">
            <Banknote className="w-4 h-4" /> Naira ↔ CELO
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-white/80 mb-1">Add funds (Naira → CELO/USDC)</p>
              <p className="text-xs text-white/50 mb-2">Pay in Naira; we credit your smart wallet with CELO or USDC.</p>
              <Link
                href="/game-shop"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/25 border border-cyan-500/50 text-cyan-300 text-sm font-medium hover:bg-cyan-500/35"
              >
                <ExternalLink className="w-4 h-4" /> Open Shop
              </Link>
            </div>
            <div className="pt-3 border-t border-white/10">
              <p className="text-sm text-white/80 mb-1">Withdraw to Naira (CELO → Naira)</p>
              <p className="text-xs text-white/50 mb-2">
                Send CELO from your smart wallet; we pay you in Naira (NGN) after processing.
                {currentNairaVault && currentNairaVault !== zeroAddr && String(currentNairaVault).toLowerCase() !== zeroAddr.toLowerCase() ? " NGN withdrawals are enabled." : " Enable NGN withdrawals above (one-time) if you have an older wallet."}
              </p>
              <form onSubmit={handleNairaWithdraw} className="flex flex-wrap gap-2 items-end">
                <input
                  type="text"
                  placeholder="Amount (CELO)"
                  value={nairaWithdrawAmount}
                  onChange={(e) => setNairaWithdrawAmount(e.target.value)}
                  className="flex-1 min-w-[120px] px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-white/40 text-sm"
                />
                <button
                  type="submit"
                  disabled={nairaWithdrawLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/25 border border-amber-500/50 text-amber-300 text-sm font-medium disabled:opacity-50"
                >
                  {nairaWithdrawLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                  Request Naira
                </button>
              </form>
              {nairaWithdrawError && <p className="text-sm text-red-400 mt-2">{nairaWithdrawError}</p>}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
