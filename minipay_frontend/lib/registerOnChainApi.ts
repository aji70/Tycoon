import { apiClient, ApiError } from "@/lib/api";
import { isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";
import { registerViaBackendSponsor } from "@/lib/registerOnChainFallback";
import type { ApiResponse } from "@/types/api";
import type { Address } from "viem";

export type RegisterOnChainResult = {
  success?: boolean;
  alreadyRegistered?: boolean;
  message?: string;
};

/** Sponsored on-chain registration (MiniPay → /users/register-on-chain; web → /auth with fallback). */
export async function postRegisterOnChain(params: {
  chain: string;
  address?: Address;
  username?: string;
}): Promise<RegisterOnChainResult> {
  const { chain, address, username } = params;

  if (isMiniPayEmbeddedWallet()) {
    if (!address) throw new Error("Connect your MiniPay wallet to register");
    await registerViaBackendSponsor({
      address,
      username: username?.trim() || "Player",
      user: null,
      setUser: () => {},
      setLocalRegistered: () => {},
      setLocalUsername: () => {},
    });
    return { success: true };
  }

  try {
    const res = await apiClient.post<ApiResponse>("/auth/register-on-chain", { chain });
    return (res.data ?? {}) as RegisterOnChainResult;
  } catch (err) {
    const status =
      err instanceof ApiError
        ? err.status
        : (err as { response?: { status?: number } })?.response?.status;
    if ((status === 401 || status === 403) && address) {
      const res = await apiClient.post<ApiResponse>("/users/register-on-chain", {
        chain,
        address,
      });
      return (res.data ?? {}) as RegisterOnChainResult;
    }
    throw err;
  }
}
