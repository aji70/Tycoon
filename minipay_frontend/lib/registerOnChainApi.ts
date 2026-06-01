import { apiClient } from "@/lib/api";
import type { Address } from "viem";

export type RegisterOnChainResult = {
  success?: boolean;
  alreadyRegistered?: boolean;
  message?: string;
};

/**
 * Register user on-chain via backend (no wallet tx).
 * Uses JWT auth/register-on-chain when logged in; otherwise /users/register-on-chain with address.
 */
export async function postRegisterOnChain(opts: {
  chain: string;
  address?: Address;
  username?: string;
}): Promise<RegisterOnChainResult> {
  const chain = opts.chain || "CELO";
  const token =
    typeof window !== "undefined" ? window.localStorage.getItem("token") : null;

  if (token) {
    const res = await apiClient.post<RegisterOnChainResult>("auth/register-on-chain", { chain });
    const body = res.data as RegisterOnChainResult | undefined;
    if (body?.success === false) {
      throw new Error(body.message ?? "Registration failed");
    }
    return body ?? { success: true };
  }

  if (!opts.address) {
    throw new Error("Wallet address required");
  }

  if (opts.username?.trim()) {
    try {
      await apiClient.post("/users", {
        username: opts.username.trim(),
        address: opts.address,
        chain,
      });
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status !== 409) throw err;
    }
  }

  const res = await apiClient.post<RegisterOnChainResult>("/users/register-on-chain", {
    address: opts.address,
    chain,
  });
  const body = res.data as RegisterOnChainResult | undefined;
  if (body?.success === false) {
    throw new Error(body.message ?? "Registration failed");
  }
  return body ?? { success: true };
}
