"use client";

import { useEffect, useState, useCallback } from "react";
import { socketService } from "@/lib/socket";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";

export type OnlineUser = { userId?: number; username?: string | null; address?: string | null };

function getSocketUrl(): string {
  if (typeof window === "undefined") return "";
  try {
    return (
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "")
    );
  } catch {
    return "";
  }
}

export interface UseOnlineUsersOptions {
  /** When false, skips API fetch and socket subscription (e.g. until client mounted). Default true. */
  enabled?: boolean;
}

export function useOnlineUsers(
  address: string | undefined,
  options: UseOnlineUsersOptions = {}
) {
  const { enabled = true } = options;
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);

  const fetchOnlineFromApi = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await apiClient.get<ApiResponse<{ users: OnlineUser[]; count: number }>>("/users/online");
      if (res?.data?.success && res.data.data) {
        setOnlineUsers(res.data.data.users ?? []);
        setOnlineCount(res.data.data.count ?? 0);
      }
    } catch {
      // ignore
    }
  }, [enabled]);

  // Register presence when wallet is connected and socket is ready (only when enabled and client-side)
  useEffect(() => {
    if (!enabled || !address) return;
    const SOCKET_URL = getSocketUrl();
    if (!SOCKET_URL) return;
    try {
      const socket = socketService.connect(SOCKET_URL);
      const register = () => {
        apiClient
          .get<{ id: number; username?: string }>(`/users/by-address/${address}?chain=BASE`)
          .then((res) => {
            const user = (res as { data?: { id?: number; username?: string } })?.data;
            socketService.registerLobbyPresence({
              userId: typeof user?.id === "number" ? user.id : undefined,
              username: user?.username ?? undefined,
              address,
            });
          })
          .catch(() => {
            socketService.registerLobbyPresence({ address });
          });
      };
      if (socket.connected) register();
      else socket.once("connect", register);
    } catch {
      // ignore socket errors (e.g. on mobile when not ready)
    }
  }, [enabled, address]);

  // Subscribe to online-users and fetch once from API (only when enabled)
  useEffect(() => {
    if (!enabled) return;
    fetchOnlineFromApi();
    const handler = (data: { users?: OnlineUser[]; count?: number }) => {
      setOnlineUsers(Array.isArray(data?.users) ? data.users : []);
      setOnlineCount(typeof data?.count === "number" ? data.count : 0);
    };
    try {
      socketService.onOnlineUsers(handler);
    } catch {
      // ignore
    }
    return () => {
      try {
        socketService.removeListener("online-users", handler);
      } catch {
        // ignore
      }
    };
  }, [enabled, fetchOnlineFromApi]);

  return { onlineUsers, onlineCount };
}
