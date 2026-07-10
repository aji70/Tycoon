"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { useGetUsername } from "@/context/ContractProvider";
import { getGuestUserPlayAddress } from "@/lib/minipayGuestFlow";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { resolvePresenceFromPath } from "@/lib/presenceStatus";
import { isAddress } from "viem";

/**
 * Silent beacon: any signed-in user registers presence (lobby / waiting / in-game)
 * so they appear in the global online list with the right status.
 */
export default function LobbyPresenceBeacon() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { address: appKitAddress, isConnected: appKitConnected } = useAppKitAccount();
  const address = wagmiAddress ?? appKitAddress;
  const isConnected = wagmiConnected || appKitConnected;
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;

  const gameCode = searchParams?.get("gameCode") ?? null;
  const { status, gameCode: presenceCode } = useMemo(
    () => resolvePresenceFromPath(pathname, gameCode),
    [pathname, gameCode]
  );

  const safeAddress =
    address && isAddress(address) ? (address as `0x${string}`) : undefined;
  const { data: onChainUsername } = useGetUsername(safeAddress);

  const presenceAddress = useMemo(() => {
    if (address) return address;
    if (guestUser) return getGuestUserPlayAddress(guestUser) ?? guestUser.address ?? undefined;
    return undefined;
  }, [address, guestUser]);

  const username =
    guestUser?.username ??
    (onChainUsername != null ? String(onChainUsername).trim() : null);

  const enabled = !!(isConnected || guestUser) && !!(presenceAddress || username || guestUser?.id);

  useOnlineUsers(presenceAddress, {
    enabled,
    userId: guestUser?.id,
    username,
    status,
    gameCode: presenceCode,
    pollIntervalMs: 12000,
  });

  return null;
}
