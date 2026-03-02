"use client";

import { useEffect, useState, useCallback } from "react";
import { socketService } from "@/lib/socket";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";

export type OnlineUser = { userId?: number; username?: string | null; address?: string | null };

const SOCKET_URL =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_SOCKET_URL ||
      (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "")
    : "";

export function useOnlineUsers(address: string | undefined) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);

  const fetchOnlineFromApi = useCallback(async () => {
    try {
      const res = await apiClient.get<ApiResponse<{ users: OnlineUser[]; count: number }>>("/users/online");
      if (res?.data?.success && res.data.data) {
        setOnlineUsers(res.data.data.users ?? []);
        setOnlineCount(res.data.data.count ?? 0);
      }
    } catch {
      // ignore
    }
  }, []);

  // Register presence when wallet is connected and socket is ready
  useEffect(() => {
    if (!address || !SOCKET_URL) return;
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
  }, [address]);

  // Subscribe to online-users and optionally fetch once from API
  useEffect(() => {
    fetchOnlineFromApi();
    const handler = (data: { users: OnlineUser[]; count: number }) => {
      setOnlineUsers(data.users ?? []);
      setOnlineCount(data.count ?? 0);
    };
    socketService.onOnlineUsers(handler);
    return () => socketService.removeListener("online-users", handler);
  }, [fetchOnlineFromApi]);

  return { onlineUsers, onlineCount };
}
