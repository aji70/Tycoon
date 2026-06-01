import { apiClient, ApiError } from "@/lib/api";
import { User as UserType } from "@/lib/types/users";
import { ApiResponse } from "@/types/api";
import { isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";
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

type SponsorParams = {
  address: Address;
  username: string;
  user: UserType | null;
  setUser: (user: UserType) => void;
  setLocalRegistered: (v: boolean) => void;
  setLocalUsername: (v: string) => void;
  refetchIsRegistered?: () => Promise<unknown>;
  refetchUsername?: () => Promise<unknown>;
};

/**
 * MiniPay: always register on-chain via backend (game-controller sponsors gas).
 * Never asks the user to sign `registerPlayerWithoutWallet`.
 */
export async function registerOnChainMinipay(
  params: SponsorParams
): Promise<{ via: "backend" }> {
  if (!isMiniPayEmbeddedWallet()) {
    throw new Error("registerOnChainMinipay is for MiniPay only");
  }
  await registerViaBackendSponsor(params);
  return { via: "backend" };
};

export async function registerOnChainWithWallet(params: {
  username: string;
  contractAddress?: Address;
  address?: Address;
  registerPlayer: (username: string) => Promise<Hash | undefined>;
  refetchIsRegistered?: () => Promise<unknown>;
  /** Required when called from MiniPay — uses backend sponsor instead of a wallet tx. */
  sponsor?: Omit<SponsorParams, "username"> & { username: string };
}): Promise<Hash | undefined> {
  if (isMiniPayEmbeddedWallet()) {
    if (!params.address || !params.sponsor) {
      throw new Error("MiniPay registration requires a connected address and sponsor context");
    }
    await registerViaBackendSponsor({
      address: params.address,
      username: params.username,
      user: params.sponsor.user,
      setUser: params.sponsor.setUser,
      setLocalRegistered: params.sponsor.setLocalRegistered,
      setLocalUsername: params.sponsor.setLocalUsername,
      refetchIsRegistered: params.refetchIsRegistered ?? params.sponsor.refetchIsRegistered,
      refetchUsername: params.sponsor.refetchUsername,
    });
    return undefined;
  }

  const txHash = await params.registerPlayer(params.username);
  await params.refetchIsRegistered?.();
  return txHash;
}

/**
 * Backend creates the DB user (if needed) and registers the wallet on-chain without user gas.
 * Requires POST /users/register-on-chain (game-controller sponsored).
 */
export async function registerViaBackendSponsor(params: SponsorParams): Promise<void> {
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

/** MiniPay AI-game / utility: sponsor on-chain registration when not yet registered. */
export async function sponsorMinipayRegistrationIfNeeded(params: {
  address: Address;
  username: string;
  refetchRegistered?: () => Promise<{ data: boolean | undefined }>;
}): Promise<boolean> {
  if (!isMiniPayEmbeddedWallet()) return false;

  try {
    await registerViaBackendSponsor({
      address: params.address,
      username: params.username,
      user: null,
      setUser: () => {},
      setLocalRegistered: () => {},
      setLocalUsername: () => {},
      refetchIsRegistered: async () => {
        await params.refetchRegistered?.();
      },
    });
    return true;
  } catch {
    return false;
  }
}
