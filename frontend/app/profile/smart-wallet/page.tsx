"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAccount, useBalance, useChainId, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { useUserRegistryWallet, useProfileOwner, useTransferProfileTo } from "@/context/ContractProvider";
import { useRewardTokenAddresses } from "@/context/ContractProvider";
import { USDC_TOKEN_ADDRESS } from "@/constants/contracts";
import { parseEther, type Address } from "viem";
import { toast } from "react-toastify";
import { Copy, Wallet, Coins, Loader2, Send, ArrowRightLeft, Banknote, ExternalLink } from "lucide-react";
import { apiClient } from "@/lib/api";

const UserWalletABI = [
  { inputs: [], name: "balanceNative", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "token", type: "address" }], name: "balanceERC20", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "owner", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "nairaVault", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "withdrawNative", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "token", type: "address" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "withdrawERC20", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "vault", type: "address" }], name: "setNairaVault", outputs: [], stateMutability: "nonpayable", type: "function" },
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

  const smartWalletAddress = isConnected ? smartWalletFromConnection : smartWalletFromGuest;
  const hasSmartWallet = !!smartWalletAddress;

  const { data: profileOwner } = useProfileOwner(smartWalletAddress);
  const zeroAddr = "0x0000000000000000000000000000000000000000" as Address;
  const isOwner = isConnected && !!walletAddress && !!profileOwner && profileOwner !== zeroAddr && walletAddress.toLowerCase() === (profileOwner as string).toLowerCase();

  const { tycAddress: tycTokenAddress, usdcAddress: usdcTokenAddress } = useRewardTokenAddresses();
  const usdcAddress = USDC_TOKEN_ADDRESS[chainId as keyof typeof USDC_TOKEN_ADDRESS];

  const celoBalance = useBalance({ address: smartWalletAddress, query: { enabled: !!smartWalletAddress } });
  const usdcBalance = useBalance({ address: smartWalletAddress, token: usdcTokenAddress ?? usdcAddress, query: { enabled: !!smartWalletAddress && !!(usdcTokenAddress ?? usdcAddress) } });
  const tycBalance = useBalance({ address: smartWalletAddress, token: tycTokenAddress, query: { enabled: !!smartWalletAddress && !!tycTokenAddress } });

  const [withdrawCeloTo, setWithdrawCeloTo] = useState("");
  const [withdrawCeloAmount, setWithdrawCeloAmount] = useState("");
  const [withdrawUsdcTo, setWithdrawUsdcTo] = useState("");
  const [withdrawUsdcAmount, setWithdrawUsdcAmount] = useState("");
  const [nairaWithdrawAmount, setNairaWithdrawAmount] = useState("");
  const [nairaWithdrawLoading, setNairaWithdrawLoading] = useState(false);
  const [nairaWithdrawError, setNairaWithdrawError] = useState<string | null>(null);
  const [transferToAddress, setTransferToAddress] = useState("");
  const [nairaVaultAddress, setNairaVaultAddress] = useState("");

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

  const handleSetNairaVault = async () => {
    if (!smartWalletAddress || !nairaVaultAddress.trim()) return;
    const vault = nairaVaultAddress.trim() as Address;
    try {
      await writeContractAsync({
        address: smartWalletAddress,
        abi: UserWalletABI,
        functionName: "setNairaVault",
        args: [vault],
      });
      toast.success("Naira vault set. Confirm in your wallet.");
      setNairaVaultAddress("");
    } catch (e) {
      toast.error((e as Error)?.message ?? "Set vault failed");
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

  if (!hasSmartWallet) {
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
        <main className="container mx-auto px-4 py-12 max-w-xl text-center">
          <p className="text-white/80 mb-4">You don’t have a smart wallet yet. Create one from your Profile first.</p>
          <Link href="/profile" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/25 border border-cyan-500/50 text-cyan-300 font-medium">
            Go to Profile
          </Link>
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
            <p className="text-xs text-white/50 mt-2">Connect your owner wallet to withdraw or change settings.</p>
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

            <section className="rounded-2xl border border-cyan-500/20 bg-[#011112]/80 p-5">
              <h2 className="text-base font-semibold text-cyan-400 mb-3">Set Naira vault</h2>
              <p className="text-xs text-white/60 mb-2">Allow the Naira vault to pull CELO for CELO → Naira withdrawals when you’re not connected.</p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  placeholder="Naira vault contract (0x...)"
                  value={nairaVaultAddress}
                  onChange={(e) => setNairaVaultAddress(e.target.value)}
                  className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white placeholder-white/40 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={handleSetNairaVault}
                  disabled={pendingAny || !nairaVaultAddress.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/25 border border-cyan-500/50 text-cyan-300 text-sm font-medium disabled:opacity-50"
                >
                  {pendingAny ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Set vault
                </button>
              </div>
            </section>
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
              <p className="text-xs text-white/50 mb-2">Send CELO from your smart wallet; we pay you in Naira (NGN) after processing.</p>
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
