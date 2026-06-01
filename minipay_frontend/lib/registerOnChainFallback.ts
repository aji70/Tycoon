import { apiClient } from "@/lib/api";
import { User as UserType } from "@/lib/types/users";

export type RegisterViaBackendSponsorParams = {
  address: string;
  username: string;
  user: UserType | null;
  setUser: (user: UserType | null) => void;
  setLocalRegistered: (registered: boolean) => void;
  setLocalUsername: (username: string) => void;
  refetchIsRegistered?: () => Promise<unknown>;
  refetchUsername?: () => Promise<unknown>;
  chain?: string;
};

/**
 * Create backend user (if needed) and register on-chain via backend-sponsored tx (no wallet gas).
 */
export async function registerViaBackendSponsor({
  address,
  username,
  user,
  setUser,
  setLocalRegistered,
  setLocalUsername,
  refetchIsRegistered,
  refetchUsername,
  chain = "Celo",
}: RegisterViaBackendSponsorParams): Promise<void> {
  if (!user) {
    try {
      const createRes = await apiClient.post<UserType>("/users", {
        username,
        address,
        chain,
      });
      if (createRes?.data) {
        setUser(createRes.data as UserType);
      }
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status !== 409) throw err;
    }
  }

  const backendRes = await apiClient.post<{
    success?: boolean;
    alreadyRegistered?: boolean;
    message?: string;
  }>("/users/register-on-chain", { address, chain });

  const payload = backendRes.data as { success?: boolean; message?: string } | undefined;
  if (payload?.success === false) {
    throw new Error(payload.message ?? "Backend registration failed");
  }

  try {
    const userRes = await apiClient.get<UserType>(`/users/by-address/${address}?chain=${chain}`);
    if (userRes?.data) {
      setUser(userRes.data as UserType);
    }
  } catch {
    if (!user) setUser({ username } as UserType);
  }

  setLocalRegistered(true);
  setLocalUsername(username);

  await Promise.all([refetchIsRegistered?.(), refetchUsername?.()]);
}
