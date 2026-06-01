import { apiClient, ONCHAIN_BATCH_REQUEST_TIMEOUT_MS } from "@/lib/api";
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

type RegisterOnChainPayload = {
  success?: boolean;
  alreadyRegistered?: boolean;
  message?: string;
};

/** Best-effort contract reads after backend registration; must not fail the flow. */
async function safeRefetchRegistrationState(
  refetchIsRegistered?: () => Promise<unknown>,
  refetchUsername?: () => Promise<unknown>
): Promise<void> {
  const tasks = [refetchIsRegistered?.(), refetchUsername?.()].filter(Boolean) as Promise<unknown>[];
  if (tasks.length === 0) return;
  const results = await Promise.allSettled(tasks);
  for (const r of results) {
    if (r.status === "rejected") {
      console.warn("[register] contract refetch failed (non-fatal):", r.reason);
    }
  }
}

async function fetchUserByAddress(address: string, chain: string): Promise<UserType | null> {
  try {
    const userRes = await apiClient.get<UserType>(`/users/by-address/${address}?chain=${chain}`);
    return (userRes?.data as UserType) ?? null;
  } catch {
    return null;
  }
}

async function postRegisterOnChainNoGas(
  address: string,
  chain: string
): Promise<RegisterOnChainPayload> {
  const backendRes = await apiClient.post<RegisterOnChainPayload>(
    "/users/register-on-chain",
    { address, chain },
    { timeout: ONCHAIN_BATCH_REQUEST_TIMEOUT_MS }
  );
  const payload = (backendRes.data as RegisterOnChainPayload) ?? {};
  if (payload.success === false) {
    throw new Error(payload.message ?? "Backend registration failed");
  }
  return payload;
}

/**
 * Returning player with a DB row: idempotent on-chain sync only (no duplicate POST /users).
 */
export async function syncReturningUserRegistration(
  params: RegisterViaBackendSponsorParams
): Promise<{ alreadyRegistered: boolean }> {
  const chain = params.chain ?? "Celo";
  let dbUser = params.user;

  if (!dbUser) {
    dbUser = await fetchUserByAddress(params.address, chain);
    if (dbUser) params.setUser(dbUser);
  }

  const payload = await postRegisterOnChainNoGas(params.address, chain);

  if (dbUser) {
    params.setUser(dbUser);
    params.setLocalUsername(dbUser.username || params.username);
  } else {
    params.setLocalUsername(params.username);
  }
  params.setLocalRegistered(true);
  await safeRefetchRegistrationState(params.refetchIsRegistered, params.refetchUsername);

  return { alreadyRegistered: payload.alreadyRegistered === true };
}

/**
 * New player: create backend user (if needed) and register on-chain via backend-sponsored tx.
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
  if (user) {
    await syncReturningUserRegistration({
      address,
      username,
      user,
      setUser,
      setLocalRegistered,
      setLocalUsername,
      refetchIsRegistered,
      refetchUsername,
      chain,
    });
    return;
  }

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
    if (status === 409 || status === 400) {
      const existing = await fetchUserByAddress(address, chain);
      if (existing) {
        setUser(existing);
      } else if (status !== 409) {
        throw err;
      }
    } else {
      throw err;
    }
  }

  await postRegisterOnChainNoGas(address, chain);

  const refreshed = await fetchUserByAddress(address, chain);
  if (refreshed) {
    setUser(refreshed);
    setLocalUsername(refreshed.username || username);
  } else {
    setLocalUsername(username);
  }

  setLocalRegistered(true);
  await safeRefetchRegistrationState(refetchIsRegistered, refetchUsername);
}
