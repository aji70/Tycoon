"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { socketService } from "@/lib/socket";
import { apiClient } from "@/lib/api";

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
  /** When false, skips API fetch and socket subscription. Default true. */
  enabled?: boolean;
  userId?: number;
  username?: string | null;
  /** Poll REST as a safety net (ms). 0 disables. Default 8000. */
  pollIntervalMs?: number;
}

/**
 * Registers lobby presence + live online list.
 * Presence is registered as soon as we have any identity (address/username/id) —
 * we do not wait on /users/by-address before announcing "I'm online".
 */
export function useOnlineUsers(
  address: string | undefined,
  options: UseOnlineUsersOptions = {}
) {
  const { enabled = true, userId, username, pollIntervalMs = 8000 } = options;
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const identityRef = useRef({ address, userId, username });
  identityRef.current = { address, userId, username };

  const applyList = useCallback((users?: OnlineUser[], count?: number) => {
    if (!Array.isArray(users)) return;
    setOnlineUsers(users);
    setOnlineCount(typeof count === "number" ? count : users.length);
  }, []);

  const fetchOnlineFromApi = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await apiClient.get<
        | { users: OnlineUser[]; count: number }
        | { success?: boolean; data?: { users: OnlineUser[]; count: number } }
      >("/users/online");
      const body = res?.data as
        | {
            success?: boolean;
            data?: { users?: OnlineUser[]; count?: number };
            users?: OnlineUser[];
            count?: number;
          }
        | undefined;
      const payload = body?.data ?? body;
      applyList(payload?.users, payload?.count);
    } catch {
      // ignore
    }
  }, [enabled, applyList]);

  const emitPresence = useCallback(() => {
    const { address: addr, userId: uid, username: uname } = identityRef.current;
    if (!addr && uid == null && !uname) return;
    socketService.registerLobbyPresence({
      userId: typeof uid === "number" ? uid : undefined,
      username: uname?.trim() || undefined,
      address: addr,
    });
  }, []);

  // Connect, register presence immediately, enrich username in background
  useEffect(() => {
    if (!enabled) return;
    if (!address && userId == null && !username) return;
    const SOCKET_URL = getSocketUrl();
    if (!SOCKET_URL) return;

    try {
      const socket = socketService.connect(SOCKET_URL);

      const register = () => {
        // Announce immediately — don't block on profile lookup
        emitPresence();

        // Enrich with DB username when we only have an address
        if (address && userId == null && !username) {
          apiClient
            .get<{ id: number; username?: string }>(`/users/by-address/${address}`, {
              params: { chain: "CELO" },
            })
            .then((res) => {
              const body = res?.data as
                | { id?: number; username?: string; data?: { id?: number; username?: string } }
                | undefined;
              const user = body?.data ?? body;
              if (user?.id != null || user?.username) {
                socketService.registerLobbyPresence({
                  userId: typeof user?.id === "number" ? user.id : undefined,
                  username: user?.username ?? undefined,
                  address,
                });
              }
            })
            .catch(() => {
              // already registered with address
            });
        }
      };

      if (socket.connected) register();
      socket.on("connect", register);

      return () => {
        socket.off("connect", register);
      };
    } catch {
      // ignore
    }
  }, [enabled, address, userId, username, emitPresence]);

  // Live updates + initial fetch + light poll backup
  useEffect(() => {
    if (!enabled) return;
    const SOCKET_URL = getSocketUrl();
    if (SOCKET_URL) {
      try {
        socketService.connect(SOCKET_URL);
      } catch {
        // ignore
      }
    }

    fetchOnlineFromApi();

    const handler = (data: { users?: OnlineUser[]; count?: number }) => {
      applyList(data?.users, data?.count);
    };

    try {
      socketService.onOnlineUsers(handler);
    } catch {
      // ignore
    }

    const poll =
      pollIntervalMs > 0
        ? window.setInterval(() => {
            fetchOnlineFromApi();
          }, pollIntervalMs)
        : null;

    return () => {
      try {
        socketService.removeListener("online-users", handler);
      } catch {
        // ignore
      }
      if (poll) window.clearInterval(poll);
    };
  }, [enabled, fetchOnlineFromApi, applyList, pollIntervalMs]);

  return { onlineUsers, onlineCount };
}
