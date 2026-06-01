import { apiClient } from "@/lib/api";
import { User as UserType } from "@/lib/types/users";
import { ApiResponse } from "@/types/api";
import { isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";
import { ensureMiniPayWagmiConnected } from "@/lib/connectMiniPayWallet";
import { isUserRejectedTransaction } from "@/lib/utils/contractErrors";
import type { Address, Hash, PublicClient } from "viem";

/** MiniPay / wallet providers often surface failures as viem UnknownRpcError instead of a clear revert. */
export function isUnknownRpcError(error: unknown): boolean {
  if (error == null) return false;
  const e = error as { name?: string; shortMessage?: string; message?: string };
  const hay = `${e.name ?? ""} ${e.shortMessage ?? ""} ${e.message ?? ""}`.toLowerCase();
  return hay.includes("unknownrpcerror") || hay.includes("unknown rpc error");
}

/**
 * On-chain registration failed in a way we can recover via backend-sponsored register-on-chain.
 * MiniPay: only when the user truly lacks gas — do not mask wallet/RPC errors (those broke after
 * routing MiniPay through a separate @wagmi/core write path).
 */
export function isRecoverableOnChainRegistrationError(error: unknown): boolean {
  if (error == null) return false;
  if (isUserRejectedTransaction(error)) return false;
  const e = error as { message?: string; shortMessage?: string };
  const hay = `${e.message ?? ""} ${e.shortMessage ?? ""}`.toLowerCase();
  const insufficient =
    hay.includes("insufficient") || hay.includes("insufficient funds");

  if (isMiniPayEmbeddedWallet()) {
    return insufficient;
  }

  if (insufficient) return true;
  if (hay.includes("permission denied") || hay.includes("not authorized")) return true;
  return isUnknownRpcError(error);
}

export async function registerOnChainWithWallet(params: {
  username: string;
  address?: Address;
  contractAddress?: Address;
  registerPlayer: (username: string) => Promise<Hash | undefined>;
  publicClient: PublicClient | undefined;
  refetchIsRegistered?: () => Promise<unknown>;
}): Promise<void> {
  if (isMiniPayEmbeddedWallet()) {
    await ensureMiniPayWagmiConnected();
  }

  // Same wagmi hook path as mobile browser / MetaMask (includes minipayContractWriteOverrides).
  const txHash = await params.registerPlayer(params.username);
  if (txHash && params.publicClient) {
    await params.publicClient.waitForTransactionReceipt({ hash: txHash });
  }
  await params.refetchIsRegistered?.();
}

/**
 * Backend creates the DB user (if needed) and registers the wallet on-chain without user gas.
 * Requires POST /users/register-on-chain (game-controller sponsored).
 */
export async function registerViaBackendSponsor(params: {
  address: Address;
  username: string;
  user: UserType | null;
  setUser: (user: UserType) => void;
  setLocalRegistered: (v: boolean) => void;
  setLocalUsername: (v: string) => void;
  refetchIsRegistered?: () => Promise<unknown>;
  refetchUsername?: () => Promise<unknown>;
}): Promise<void> {
  const { address, username, setUser, setLocalRegistered, setLocalUsername } = params;

  if (!params.user) {
    const createRes = await apiClient.post<ApiResponse>("/users", {
      username,
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

  setLocalRegistered(true);
  setLocalUsername(username);
  await Promise.all([params.refetchIsRegistered?.(), params.refetchUsername?.()]);
}
