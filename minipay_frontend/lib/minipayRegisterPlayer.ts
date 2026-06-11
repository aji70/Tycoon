"use client";

import { getAddress, type Address } from "viem";
import { apiClient } from "@/lib/api";

/** Backend-sponsored on-chain registration (no wallet sign). User must exist in DB. */
export async function registerViaBackendNoGas(
  address: Address,
  chain = "Celo"
): Promise<{ alreadyRegistered?: boolean }> {
  const checksummed = getAddress(address);
  const res = await apiClient.post<{
    success?: boolean;
    alreadyRegistered?: boolean;
    message?: string;
  }>("/users/register-on-chain", { address: checksummed, chain });

  const body = res.data;
  if (!body?.success) {
    throw new Error(body?.message || "Backend registration failed");
  }
  return { alreadyRegistered: body.alreadyRegistered };
}
