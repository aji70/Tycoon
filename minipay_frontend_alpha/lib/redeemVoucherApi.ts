import { waitForTransactionReceipt, writeContract } from "@wagmi/core";
import { celo } from "wagmi/chains";
import type { Address, Hash } from "viem";
import RewardABI from "@/context/abi/rewardabi.json";
import { wagmiConfig } from "@/config";
import { apiClient, ApiError } from "@/lib/api";
import { ensureMiniPayWagmiConnected } from "@/lib/connectMiniPayWallet";
import { minipayContractWriteOverrides } from "@/lib/celoTransportForWagmi";
import { isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";
import type { ApiResponse } from "@/types/api";

type RedeemVoucherBackendBody = {
  success?: boolean;
  message?: string;
  data?: { hash?: string; voucher_owner?: string };
};

const TOKEN_KEY = "token";

function hasAuthSession(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage?.getItem(TOKEN_KEY);
  } catch {
    return false;
  }
}

function parseRedeemBackendResponse(res: ApiResponse): { hash: string; voucher_owner?: string } {
  const body = res.data as RedeemVoucherBackendBody | undefined;
  if (body?.success === false) {
    throw new Error(body.message || "Failed to redeem voucher");
  }
  const hash = body?.data?.hash;
  if (!hash || typeof hash !== "string") {
    throw new Error(body?.message || "Redeem did not complete — no transaction hash");
  }
  return { hash, voucher_owner: body?.data?.voucher_owner };
}

/** JWT guest / smart-wallet redeem */
export async function redeemVoucherViaBackend(
  tokenId: bigint,
  voucherOwner?: Address
): Promise<{ hash: string; voucher_owner?: string }> {
  const res = await apiClient.post<ApiResponse>("/auth/redeem-voucher", {
    tokenId: tokenId.toString(),
    chain: "CELO",
    ...(voucherOwner ? { voucher_owner: voucherOwner } : {}),
  });
  return parseRedeemBackendResponse(res);
}

/** MiniPay / wallet-only — backend redeems for EOA (no JWT). */
export async function redeemVoucherViaBackendForAddress(
  tokenId: bigint,
  address: Address
): Promise<{ hash: string; voucher_owner?: string }> {
  const res = await apiClient.post<ApiResponse>("/users/redeem-voucher", {
    tokenId: tokenId.toString(),
    address,
    chain: "Celo",
  });
  return parseRedeemBackendResponse(res);
}

export function shouldRedeemVoucherViaBackend(
  connectedWallet: Address | undefined,
  voucherHolder: Address
): boolean {
  if (!connectedWallet) return true;
  return voucherHolder.toLowerCase() !== connectedWallet.toLowerCase();
}

/** Wallet-signed redeem — waits for confirmation (do not toast before this resolves). */
export async function redeemVoucherOnChainWallet(
  tokenId: bigint,
  rewardAddress: Address
): Promise<Hash> {
  if (isMiniPayEmbeddedWallet()) {
    await ensureMiniPayWagmiConnected();
  }

  const hash = await writeContract(wagmiConfig, {
    address: rewardAddress,
    abi: RewardABI,
    functionName: "redeemVoucher",
    args: [tokenId],
    chainId: celo.id,
    ...minipayContractWriteOverrides(),
  });

  await waitForTransactionReceipt(wagmiConfig, { hash, chainId: celo.id });
  return hash;
}

function isRecoverableRedeemError(error: unknown): boolean {
  if (error == null) return false;
  const e = error as { message?: string; shortMessage?: string };
  const hay = `${e.message ?? ""} ${e.shortMessage ?? ""}`.toLowerCase();
  if (hay.includes("rejected") || hay.includes("denied") || hay.includes("cancelled")) {
    return false;
  }
  return (
    hay.includes("insufficient") ||
    hay.includes("not enough") ||
    hay.includes("usdm") ||
    hay.includes("usdcm") ||
    hay.includes("unknown rpc")
  );
}

/**
 * Redeem voucher: on-chain when held by connected wallet; otherwise backend.
 * MiniPay without JWT uses sponsored /users/redeem-voucher when wallet tx fails.
 */
export async function executeRedeemVoucher(params: {
  tokenId: bigint;
  voucherHolder: Address;
  connectedWallet?: Address;
  rewardAddress: Address;
}): Promise<{ hash: string; via: "wallet" | "backend" }> {
  const { tokenId, voucherHolder, connectedWallet, rewardAddress } = params;
  const holder = voucherHolder;
  const useBackendForHolder = shouldRedeemVoucherViaBackend(connectedWallet, holder);

  if (!useBackendForHolder && connectedWallet) {
    try {
      const hash = await redeemVoucherOnChainWallet(tokenId, rewardAddress);
      return { hash, via: "wallet" };
    } catch (walletErr) {
      if (!isMiniPayEmbeddedWallet() && !isRecoverableRedeemError(walletErr)) {
        throw walletErr;
      }
      const sponsored = await redeemVoucherViaBackendForAddress(tokenId, connectedWallet);
      return { hash: sponsored.hash, via: "backend" };
    }
  }

  if (hasAuthSession()) {
    const data = await redeemVoucherViaBackend(tokenId, holder);
    return { hash: data.hash, via: "backend" };
  }

  const sponsorAddress = (connectedWallet ?? holder) as Address;
  const data = await redeemVoucherViaBackendForAddress(tokenId, sponsorAddress);
  return { hash: data.hash, via: "backend" };
}

export function getRedeemVoucherErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const owner = (err.data as { voucher_owner?: string })?.voucher_owner;
    const msg = err.message || "Failed to redeem voucher";
    return owner ? `${msg} (Owner: ${owner})` : msg;
  }
  const e = err as {
    response?: { data?: { message?: string; voucher_owner?: string | null } };
    message?: string;
  };
  const owner = e?.response?.data?.voucher_owner;
  const msg = e?.response?.data?.message ?? e?.message ?? "Failed to redeem voucher";
  return owner ? `${msg} (Owner: ${owner})` : msg;
}
