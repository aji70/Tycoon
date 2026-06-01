import { apiClient } from "@/lib/api";
import { isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";
import type { ApiResponse } from "@/types/api";
import type { Address } from "viem";

type RedeemVoucherBody = {
  success?: boolean;
  message?: string;
  data?: { hash?: string; voucher_owner?: string };
};

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
 * Use backend redeem when the voucher is not on the connected EOA, or inside MiniPay
 * (wallet writes often fail with permission / unknown RPC errors).
 */
export function shouldRedeemVoucherViaBackend(
  connectedWallet: Address | undefined,
  voucherHolder: Address
): boolean {
  if (isMiniPayEmbeddedWallet()) return true;
  if (!connectedWallet) return true;
  return voucherHolder.toLowerCase() !== connectedWallet.toLowerCase();
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
