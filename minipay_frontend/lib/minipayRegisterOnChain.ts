import type { Address, Hash, PublicClient } from "viem";
import { apiClient } from "@/lib/api";
import { User as UserType } from "@/lib/types/users";
import { ApiResponse } from "@/types/api";

/** Wallet register failed — use backend-sponsored on-chain registration (no MiniPay sign). */
export function shouldFallbackToBackendRegistration(err: unknown): boolean {
  const parts: string[] = [];
  let current: unknown = err;
  for (let i = 0; i < 6 && current; i++) {
    if (typeof current === "string") {
      parts.push(current);
      break;
    }
    const e = current as { message?: string; shortMessage?: string; name?: string; cause?: unknown };
    if (e.message) parts.push(e.message);
    if (e.shortMessage) parts.push(e.shortMessage);
    if (e.name) parts.push(e.name);
    current = e.cause;
  }
  const hay = parts.join(" ").toLowerCase();
  if (hay.includes("insufficient")) return true;
  if (hay.includes("unknown rpc") || hay.includes("rpc error") || hay.includes("rpc request")) return true;
  if (
    hay.includes("failed to fetch") ||
    hay.includes("network") ||
    hay.includes("timeout") ||
    hay.includes("econnreset") ||
    hay.includes("econnrefused")
  ) {
    return true;
  }
  return false;
}

/** Same wallet path as createGame / shop: writeContract → MiniPay sign → wait for receipt. */
export async function registerViaWalletSign(params: {
  registerPlayer: (username: string) => Promise<Hash | undefined>;
  publicClient: PublicClient | undefined;
  finalUsername: string;
}): Promise<void> {
  const txHash = await params.registerPlayer(params.finalUsername.trim());
  if (txHash && params.publicClient) {
    await params.publicClient.waitForTransactionReceipt({ hash: txHash });
  }
}

export async function completeBackendRegistration(params: {
  address: Address;
  finalUsername: string;
  user: UserType | null;
  setUser: (user: UserType) => void;
}): Promise<void> {
  const { address, finalUsername, user, setUser } = params;

  if (!user) {
    const createRes = await apiClient.post<ApiResponse>("/users", {
      username: finalUsername,
      address,
      chain: "Celo",
    });
    if (createRes?.success && createRes?.data) {
      setUser(createRes.data as UserType);
    } else if (createRes?.status !== 409) {
      throw new Error("Failed to create user before backend registration");
    }
  }

  const backendRes = await apiClient.post<ApiResponse>("/users/register-on-chain", {
    address,
    chain: "Celo",
  });

  if (!backendRes?.success) throw new Error("Backend registration failed");

  const userRes = await apiClient.get<ApiResponse>(`/users/by-address/${address}?chain=Celo`);
  if (userRes?.success && userRes?.data) setUser(userRes.data as UserType);
}
