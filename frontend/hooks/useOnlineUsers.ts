"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { socketService } from "@/lib/socket";
import { apiClient } from "@/lib/api";
import type { PresenceStatus } from "@/lib/presenceStatus";

export type OnlineUser = {
  userId?: number;
  username?: string | null;
  address?: string | null;
  status?: PresenceStatus | null;
  gameCode?: string | null;
};

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
  /** Where this client currently is. Default lobby. */
  status?: PresenceStatus;
  gameCode?: string | null;
  /** When false, only subscribe to the online list (don't announce presence). Default true. */
  registerPresence?: boolean;
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
  const {
    enabled = true,
    userId,
    username,
    pollIntervalMs = 8000,
    status = "lobby",
    gameCode,
    registerPresence = true,
  } = options;
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const identityRef = useRef({ address, userId, username, status, gameCode });
  identityRef.current = { address, userId, username, status, gameCode };

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
    const { address: addr, userId: uid, username: uname, status: st, gameCode: code } =
      identityRef.current;
    if (!addr && uid == null && !uname) return;
    socketService.registerLobbyPresence({
      userId: typeof uid === "number" ? uid : undefined,
      username: uname?.trim() || undefined,
      address: addr,
      status: st,
      gameCode: code?.trim() || undefined,
    });
  }, []);

  // Connect, register presence immediately, enrich username in background
  useEffect(() => {
    if (!enabled || !registerPresence) return;
    if (!address && userId == null && !username) return;
    const SOCKET_URL = getSocketUrl();
    if (!SOCKET_URL) return;

    try {
      const socket = socketService.connect(SOCKET_URL);

      const register = () => {
        emitPresence();

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
                const { status: st, gameCode: code } = identityRef.current;
                socketService.registerLobbyPresence({
                  userId: typeof user?.id === "number" ? user.id : undefined,
                  username: user?.username ?? undefined,
                  address,
                  status: st,
                  gameCode: code?.trim() || undefined,
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
  }, [enabled, registerPresence, address, userId, username, status, gameCode, emitPresence]);

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
