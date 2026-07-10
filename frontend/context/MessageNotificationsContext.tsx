"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAccount } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { getGuestUserPlayAddress } from "@/lib/minipayGuestFlow";
import { canAccessDirectMessages } from "@/lib/featureAccess";
import { apiClient } from "@/lib/api";
import { socketService } from "@/lib/socket";

const LOBBY_READ_KEY = "tycoon_lobby_last_read_id";
const DM_READ_KEY = "tycoon_dm_last_read_map";

export type DmUnreadItem = {
  conversationId: number;
  count: number;
  otherUserId?: number | null;
  otherUsername?: string | null;
  preview?: string | null;
};

type MessageNotificationsValue = {
  lobbyUnread: number;
  dmUnreadTotal: number;
  dmItems: DmUnreadItem[];
  totalUnread: number;
  markLobbyRead: (lastId?: number | string | null) => void;
  markDmRead: (conversationId: number, lastMessageId?: number | null) => void;
  setLobbyOpen: (open: boolean) => void;
  setActiveDmConversationId: (id: number | null) => void;
};

const MessageNotificationsContext = createContext<MessageNotificationsValue | null>(null);

function readLobbyLastId(): number {
  try {
    const v = Number(localStorage.getItem(LOBBY_READ_KEY) || 0);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

function writeLobbyLastId(id: number) {
  try {
    localStorage.setItem(LOBBY_READ_KEY, String(id));
  } catch {
    // ignore
  }
}

function readDmMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DM_READ_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeDmMap(map: Record<string, number>) {
  try {
    localStorage.setItem(DM_READ_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function getSocketUrl(): string {
  if (typeof window === "undefined") return "";
  return (
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "")
  );
}

function unwrapData<T>(res: unknown): T | null {
  const body = res as { data?: T | { data?: T } } | null;
  if (!body?.data) return null;
  const inner = body.data as T | { data?: T };
  if (inner && typeof inner === "object" && "data" in (inner as object) && (inner as { data?: T }).data) {
    return (inner as { data: T }).data;
  }
  return inner as T;
}

export function MessageNotificationsProvider({
  children,
  username,
}: {
  children: ReactNode;
  username?: string | null;
}) {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { address: appKitAddress, isConnected: appKitConnected } = useAppKitAccount();
  const address = wagmiAddress ?? appKitAddress;
  const isConnected = wagmiConnected || appKitConnected;
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const myUserId = guestUser?.id ?? null;
  const myUsername = guestUser?.username ?? username ?? null;
  const canDm =
    canAccessDirectMessages(myUsername) || canAccessDirectMessages(guestUser?.username);

  const [lobbyUnread, setLobbyUnread] = useState(0);
  const [dmItems, setDmItems] = useState<DmUnreadItem[]>([]);
  const lobbyOpenRef = useRef(false);
  const activeDmRef = useRef<number | null>(null);
  const lobbyLastIdRef = useRef(0);
  const dmReadMapRef = useRef<Record<string, number>>({});

  useEffect(() => {
    lobbyLastIdRef.current = readLobbyLastId();
    dmReadMapRef.current = readDmMap();
  }, []);

  const presenceAddress = useMemo(() => {
    if (address) return address;
    if (guestUser) return getGuestUserPlayAddress(guestUser) ?? guestUser.address ?? undefined;
    return undefined;
  }, [address, guestUser]);

  const signedIn = !!(isConnected || guestUser);

  const refreshLobbyUnread = useCallback(async () => {
    if (!signedIn) {
      setLobbyUnread(0);
      return;
    }
    try {
      const res = await apiClient.get("/messages/lobby");
      const body = res?.data as
        | { data?: Array<{ id?: number | string; user_id?: number | null }> }
        | Array<{ id?: number | string; user_id?: number | null }>
        | undefined;
      const list = Array.isArray(body)
        ? body
        : Array.isArray((body as { data?: unknown })?.data)
          ? ((body as { data: Array<{ id?: number | string; user_id?: number | null }> }).data)
          : [];
      const lastRead = lobbyLastIdRef.current;
      let maxId = lastRead;
      let unread = 0;
      for (const m of list) {
        const id = Number(m.id);
        if (!Number.isFinite(id)) continue;
        if (id > maxId) maxId = id;
        if (id > lastRead && (myUserId == null || m.user_id !== myUserId)) unread += 1;
      }
      if (lobbyOpenRef.current) {
        lobbyLastIdRef.current = maxId;
        writeLobbyLastId(maxId);
        setLobbyUnread(0);
      } else {
        setLobbyUnread(unread);
      }
    } catch {
      // ignore
    }
  }, [signedIn, myUserId]);

  const refreshDmUnread = useCallback(async () => {
    if (!signedIn || !canDm) {
      setDmItems([]);
      return;
    }
    try {
      const res = await apiClient.get("/dms");
      const list = unwrapData<
        Array<{
          id: number;
          otherUser?: { userId?: number; username?: string | null };
          lastMessage?: { id?: number; body?: string; senderId?: number } | null;
        }>
      >(res);
      if (!Array.isArray(list)) {
        setDmItems([]);
        return;
      }
      const map = dmReadMapRef.current;
      const items: DmUnreadItem[] = [];
      for (const c of list) {
        const last = c.lastMessage;
        if (!last?.id) continue;
        const lastRead = Number(map[String(c.id)] || 0);
        const isMine = myUserId != null && last.senderId === myUserId;
        const isActive = activeDmRef.current === c.id;
        if (isActive) {
          map[String(c.id)] = Number(last.id);
          continue;
        }
        if (!isMine && Number(last.id) > lastRead) {
          items.push({
            conversationId: c.id,
            count: 1,
            otherUserId: c.otherUser?.userId,
            otherUsername: c.otherUser?.username,
            preview: last.body ?? null,
          });
        }
      }
      dmReadMapRef.current = map;
      writeDmMap(map);
      setDmItems(items);
    } catch {
      // preview users without token etc.
    }
  }, [signedIn, canDm, myUserId]);

  useEffect(() => {
    if (!signedIn) return;
    const url = getSocketUrl();
    if (url) {
      try {
        socketService.connect(url);
        if (presenceAddress || myUserId || myUsername) {
          socketService.registerLobbyPresence({
            userId: typeof myUserId === "number" ? myUserId : undefined,
            username: myUsername ?? undefined,
            address: presenceAddress,
          });
        }
      } catch {
        // ignore
      }
    }

    void refreshLobbyUnread();
    void refreshDmUnread();

    const onLobby = (data: {
      message?: { id?: number | string; user_id?: number | null };
    }) => {
      const msg = data?.message;
      if (!msg) return;
      const id = Number(msg.id);
      if (!Number.isFinite(id)) return;
      if (myUserId != null && msg.user_id === myUserId) {
        lobbyLastIdRef.current = Math.max(lobbyLastIdRef.current, id);
        writeLobbyLastId(lobbyLastIdRef.current);
        return;
      }
      if (lobbyOpenRef.current) {
        lobbyLastIdRef.current = Math.max(lobbyLastIdRef.current, id);
        writeLobbyLastId(lobbyLastIdRef.current);
        setLobbyUnread(0);
        return;
      }
      if (id > lobbyLastIdRef.current) {
        setLobbyUnread((n) => n + 1);
      }
    };

    const onDm = (data: {
      conversationId?: number;
      message?: { id?: number; senderId?: number; body?: string; username?: string | null };
    }) => {
      if (!canDm) return;
      const convId = data?.conversationId;
      const msg = data?.message;
      if (convId == null || !msg?.id) return;
      if (myUserId != null && msg.senderId === myUserId) {
        dmReadMapRef.current[String(convId)] = Number(msg.id);
        writeDmMap(dmReadMapRef.current);
        return;
      }
      if (activeDmRef.current === convId) {
        dmReadMapRef.current[String(convId)] = Number(msg.id);
        writeDmMap(dmReadMapRef.current);
        setDmItems((prev) => prev.filter((i) => i.conversationId !== convId));
        return;
      }
      setDmItems((prev) => {
        const existing = prev.find((i) => i.conversationId === convId);
        if (existing) {
          return prev.map((i) =>
            i.conversationId === convId
              ? { ...i, count: i.count + 1, preview: msg.body ?? i.preview }
              : i
          );
        }
        return [
          {
            conversationId: convId,
            count: 1,
            otherUsername: msg.username ?? null,
            preview: msg.body ?? null,
          },
          ...prev,
        ];
      });
    };

    try {
      socketService.onLobbyMessage(onLobby);
      socketService.onDmMessage(onDm);
    } catch {
      // ignore
    }

    const poll = window.setInterval(() => {
      void refreshLobbyUnread();
      void refreshDmUnread();
    }, 12000);

    return () => {
      try {
        socketService.removeListener("lobby-message", onLobby);
        socketService.removeListener("dm-message", onDm);
      } catch {
        // ignore
      }
      window.clearInterval(poll);
    };
  }, [
    signedIn,
    canDm,
    myUserId,
    myUsername,
    presenceAddress,
    refreshLobbyUnread,
    refreshDmUnread,
  ]);

  const markLobbyRead = useCallback((lastId?: number | string | null) => {
    const id = lastId != null ? Number(lastId) : lobbyLastIdRef.current;
    if (Number.isFinite(id) && id > lobbyLastIdRef.current) {
      lobbyLastIdRef.current = id;
    } else if (!Number.isFinite(id)) {
      // keep
    }
    // If no id passed, bump to "now" by refreshing
    writeLobbyLastId(lobbyLastIdRef.current);
    setLobbyUnread(0);
    void (async () => {
      try {
        const res = await apiClient.get("/messages/lobby");
        const body = res?.data as { data?: Array<{ id?: number | string }> } | Array<{ id?: number | string }>;
        const list = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
        let max = lobbyLastIdRef.current;
        for (const m of list) {
          const mid = Number(m.id);
          if (Number.isFinite(mid) && mid > max) max = mid;
        }
        lobbyLastIdRef.current = max;
        writeLobbyLastId(max);
      } catch {
        // ignore
      }
      setLobbyUnread(0);
    })();
  }, []);

  const markDmRead = useCallback((conversationId: number, lastMessageId?: number | null) => {
    if (lastMessageId != null && Number.isFinite(Number(lastMessageId))) {
      dmReadMapRef.current[String(conversationId)] = Number(lastMessageId);
    } else {
      // mark current as read at least to now-ish by setting high watermark from items
      const item = null;
      void item;
      dmReadMapRef.current[String(conversationId)] = Math.max(
        Number(dmReadMapRef.current[String(conversationId)] || 0),
        Date.now() > 2e12 ? 0 : Number(dmReadMapRef.current[String(conversationId)] || 0)
      );
    }
    writeDmMap(dmReadMapRef.current);
    setDmItems((prev) => prev.filter((i) => i.conversationId !== conversationId));
    void refreshDmUnread();
  }, [refreshDmUnread]);

  const setLobbyOpen = useCallback(
    (open: boolean) => {
      lobbyOpenRef.current = open;
      if (open) markLobbyRead();
    },
    [markLobbyRead]
  );

  const setActiveDmConversationId = useCallback(
    (id: number | null) => {
      activeDmRef.current = id;
      if (id != null) markDmRead(id);
    },
    [markDmRead]
  );

  const dmUnreadTotal = dmItems.reduce((sum, i) => sum + i.count, 0);
  const totalUnread = lobbyUnread + (canDm ? dmUnreadTotal : 0);

  const value: MessageNotificationsValue = {
    lobbyUnread,
    dmUnreadTotal: canDm ? dmUnreadTotal : 0,
    dmItems: canDm ? dmItems : [],
    totalUnread,
    markLobbyRead,
    markDmRead,
    setLobbyOpen,
    setActiveDmConversationId,
  };

  return (
    <MessageNotificationsContext.Provider value={value}>{children}</MessageNotificationsContext.Provider>
  );
}

export function useMessageNotifications() {
  const ctx = useContext(MessageNotificationsContext);
  if (!ctx) {
    return {
      lobbyUnread: 0,
      dmUnreadTotal: 0,
      dmItems: [] as DmUnreadItem[],
      totalUnread: 0,
      markLobbyRead: () => {},
      markDmRead: () => {},
      setLobbyOpen: () => {},
      setActiveDmConversationId: () => {},
    };
  }
  return ctx;
}
