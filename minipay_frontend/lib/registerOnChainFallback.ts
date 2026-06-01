import { apiClient, ApiError } from "@/lib/api";
import { User as UserType } from "@/lib/types/users";
import { ApiResponse } from "@/types/api";
import { isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";
import type { Address } from "viem";

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
 * MiniPay: register on-chain via backend only (no wallet-signed registerPlayer* tx).
 */
export async function registerOnChainMinipay(params: SponsorParams): Promise<void> {
  if (!isMiniPayEmbeddedWallet()) {
    throw new Error("registerOnChainMinipay is for MiniPay only");
  }
  await registerViaBackendSponsor(params);
}

/**
 * Backend creates the DB user (if needed) and registers on-chain without user gas.
 * POST /users/register-on-chain
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
