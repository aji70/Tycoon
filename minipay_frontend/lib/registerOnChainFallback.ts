import { apiClient, ApiError } from "@/lib/api";
import { User as UserType } from "@/lib/types/users";
import { ApiResponse } from "@/types/api";
import { isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";
import { registerPlayerWalletSignedMinipay } from "@/lib/minipayRegister";
import { isUserRejectedTransaction } from "@/lib/utils/contractErrors";
import type { Address, Hash } from "viem";

/** MiniPay / wallet providers often surface failures as viem UnknownRpcError instead of a clear revert. */
export function isUnknownRpcError(error: unknown): boolean {
  if (error == null) return false;
  const e = error as { name?: string; shortMessage?: string; message?: string };
  const hay = `${e.name ?? ""} ${e.shortMessage ?? ""} ${e.message ?? ""}`.toLowerCase();
  return hay.includes("unknownrpcerror") || hay.includes("unknown rpc error");
}

/**
 * Backend fallback when the wallet tx failed for lack of gas/fees or opaque MiniPay RPC errors.
 */
export function isRecoverableOnChainRegistrationError(error: unknown): boolean {
  if (error == null) return false;
  if (isUserRejectedTransaction(error)) return false;
  if (isUnknownRpcError(error)) return true;
  const e = error as { message?: string; shortMessage?: string };
  const hay = `${e.message ?? ""} ${e.shortMessage ?? ""}`.toLowerCase();
  return (
    hay.includes("insufficient") ||
    hay.includes("insufficient funds") ||
    hay.includes("not enough") ||
    hay.includes("usdm") ||
    hay.includes("usdcm") ||
    hay.includes("estimate") ||
    hay.includes("gas required")
  );
}

export async function registerOnChainWithWallet(params: {
  username: string;
  contractAddress?: Address;
  registerPlayer: (username: string) => Promise<Hash | undefined>;
  refetchIsRegistered?: () => Promise<unknown>;
}): Promise<Hash | undefined> {
  if (isMiniPayEmbeddedWallet()) {
    if (!params.contractAddress) {
      throw new Error("Contract not deployed on this chain");
    }
    const txHash = await registerPlayerWalletSignedMinipay({
      contractAddress: params.contractAddress,
      username: params.username,
    });
    await params.refetchIsRegistered?.();
    return txHash;
  }

  const txHash = await params.registerPlayer(params.username);
  await params.refetchIsRegistered?.();
  return txHash;
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
    try {
      const createRes = await apiClient.post<ApiResponse>("/users", {
        username,
        address,
        chain: "Celo",
      });
      if (createRes?.success && createRes?.data) {
        setUser(createRes.data as UserType);
      }
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 409) {
        throw new Error("Failed to create user before backend registration");
      }
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
