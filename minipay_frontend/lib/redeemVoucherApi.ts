import { apiClient } from "@/lib/api";
import { ensureMiniPayWagmiConnected } from "@/lib/connectMiniPayWallet";
import { isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";
import type { ApiResponse } from "@/types/api";
import type { Address } from "viem";

type RedeemVoucherBody = {
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

/** Backend-sponsored redeem (no wallet popup). Requires auth session. */
export async function redeemVoucherViaBackend(
  tokenId: bigint,
  voucherOwner?: Address
): Promise<{ hash?: string; voucher_owner?: string }> {
  const res = await apiClient.post<ApiResponse>(`/auth/redeem-voucher`, {
    tokenId: tokenId.toString(),
    chain: "CELO",
    ...(voucherOwner ? { voucher_owner: voucherOwner } : {}),
  });
  const body = res.data as RedeemVoucherBody | undefined;
  if (body?.success === false) {
    throw new Error(body.message || "Failed to redeem voucher");
  }
  return body?.data ?? {};
}

/**
 * Backend redeem when the voucher is held on a different address than the connected wallet.
 * MiniPay EOAs redeem on-chain (same as web) when the voucher is on the connected wallet.
 */
export function shouldRedeemVoucherViaBackend(
  connectedWallet: Address | undefined,
  voucherHolder: Address
): boolean {
  if (!connectedWallet) return true;
  return voucherHolder.toLowerCase() !== connectedWallet.toLowerCase();
}

/**
 * Prefer wallet redeem when the voucher is on the connected EOA; otherwise backend (smart wallet / guest JWT).
 */
export async function executeRedeemVoucher(params: {
  tokenId: bigint;
  voucherHolder: Address;
  connectedWallet?: Address;
  redeemOnChain: () => Promise<unknown>;
}): Promise<void> {
  const { tokenId, voucherHolder, connectedWallet, redeemOnChain } = params;

  if (!shouldRedeemVoucherViaBackend(connectedWallet, voucherHolder)) {
    if (isMiniPayEmbeddedWallet()) {
      await ensureMiniPayWagmiConnected();
    }
    await redeemOnChain();
    return;
  }

  if (hasAuthSession()) {
    await redeemVoucherViaBackend(tokenId, voucherHolder);
    return;
  }

  throw new Error(
    "This voucher is on another wallet. Sign in to your Tycoon account or connect the wallet that holds it."
  );
}

export function getRedeemVoucherErrorMessage(err: unknown): string {
  const e = err as {
    response?: { data?: { message?: string; voucher_owner?: string | null } };
    message?: string;
  };
  const owner = e?.response?.data?.voucher_owner;
  const msg = e?.response?.data?.message ?? e?.message ?? "Failed to redeem voucher";
  return owner ? `${msg} (Owner: ${owner})` : msg;
}
