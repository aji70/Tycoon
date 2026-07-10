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
import { canAccessChallenges, canAccessDirectMessages } from "@/lib/featureAccess";
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

export type ChallengeItem = {
  id: number;
  challengerId: number;
  opponentId: number;
  gameId?: number | null;
  gameCode: string;
  status: string;
  stake?: number;
  challengerUsername?: string | null;
  challengerAddress?: string | null;
  opponentUsername?: string | null;
  opponentAddress?: string | null;
  expiresAt?: string | null;
  createdAt?: string | null;
};

type MessageNotificationsValue = {
  lobbyUnread: number;
  dmUnreadTotal: number;
  dmItems: DmUnreadItem[];
  challengeItems: ChallengeItem[];
  challengeUnread: number;
  totalUnread: number;
  markLobbyRead: (lastId?: number | string | null) => void;
  markDmRead: (conversationId: number, lastMessageId?: number | null) => void;
  dismissChallenge: (id: number) => void;
  refreshChallenges: () => Promise<void>;
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
  const { address, isConnected: wagmiConnected } = useAccount();
  const { isConnected: appKitConnected } = useAppKitAccount();
  const isConnected = wagmiConnected || appKitConnected;
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const myUserId = guestUser?.id ?? null;
  const myUsername = guestUser?.username ?? username ?? null;
  const canDm =
    canAccessDirectMessages(myUsername) || canAccessDirectMessages(guestUser?.username);
  const canChallenge =
    canAccessChallenges(myUsername) || canAccessChallenges(guestUser?.username);

  const [lobbyUnread, setLobbyUnread] = useState(0);
  const [dmItems, setDmItems] = useState<DmUnreadItem[]>([]);
  const [challengeItems, setChallengeItems] = useState<ChallengeItem[]>([]);
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

  const refreshChallenges = useCallback(async () => {
    if (!signedIn || !canChallenge) {
      setChallengeItems([]);
      return;
    }
    try {
      const res = await apiClient.get("/challenges");
      const data = unwrapData<{ incoming?: ChallengeItem[]; outgoing?: ChallengeItem[] }>(res);
      const incoming = Array.isArray(data?.incoming) ? data.incoming : [];
      setChallengeItems(incoming.filter((c) => c.status === "pending"));
    } catch {
      // ignore
    }
  }, [signedIn, canChallenge]);

  useEffect(() => {
    if (!signedIn) return;
    const url = getSocketUrl();
    if (url) {
      try {
        socketService.connect(url);
      } catch {
        // ignore
      }
    }

    void refreshLobbyUnread();
    void refreshDmUnread();
    void refreshChallenges();

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

    const onChallenge = (data: {
      type?: string;
      challenge?: ChallengeItem;
    }) => {
      if (!canChallenge || !data?.challenge?.id) return;
      const c = data.challenge;
      if (data.type === "incoming" || (c.status === "pending" && myUserId != null && c.opponentId === myUserId)) {
        setChallengeItems((prev) => {
          if (prev.some((x) => x.id === c.id)) {
            return prev.map((x) => (x.id === c.id ? { ...x, ...c } : x));
          }
          return [c, ...prev];
        });
        return;
      }
      if (
        data.type === "accepted" ||
        data.type === "rejected" ||
        data.type === "cancelled" ||
        data.type === "expired" ||
        c.status !== "pending"
      ) {
        setChallengeItems((prev) => prev.filter((x) => x.id !== c.id));
      }
    };

    try {
      socketService.onLobbyMessage(onLobby);
      socketService.onDmMessage(onDm);
      socketService.onPlayerChallenge(onChallenge);
    } catch {
      // ignore
    }

    const ensureUserRoom = () => {
      if (myUserId != null) {
        socketService.registerLobbyPresence({
          userId: myUserId,
          username: myUsername?.trim() || undefined,
          address: presenceAddress,
          status: "lobby",
        });
        return;
      }
      if (!presenceAddress && !myUsername) return;
      socketService.registerLobbyPresence({
        username: myUsername?.trim() || undefined,
        address: presenceAddress,
        status: "lobby",
      });
      if (presenceAddress) {
        void apiClient
          .get<{ id?: number; username?: string; data?: { id?: number; username?: string } }>(
            `/users/by-address/${presenceAddress}`,
            { params: { chain: "CELO" } }
          )
          .then((res) => {
            const body = res?.data as
              | { id?: number; username?: string; data?: { id?: number; username?: string } }
              | undefined;
            const user = body?.data ?? body;
            if (user?.id != null) {
              socketService.registerLobbyPresence({
                userId: Number(user.id),
                username: (user.username ?? myUsername)?.trim() || undefined,
                address: presenceAddress,
                status: "lobby",
              });
            }
          })
          .catch(() => {
            // ignore
          });
      }
    };
    try {
      const sock = socketService.connect(url);
      if (sock.connected) ensureUserRoom();
      sock.on("connect", ensureUserRoom);
    } catch {
      // ignore
    }

    const poll = window.setInterval(() => {
      void refreshLobbyUnread();
      void refreshDmUnread();
      void refreshChallenges();
    }, 12000);

    return () => {
      try {
        socketService.removeListener("lobby-message", onLobby);
        socketService.removeListener("dm-message", onDm);
        socketService.removeListener("player-challenge", onChallenge);
        const sock = socketService.connect(url);
        sock.off("connect", ensureUserRoom);
      } catch {
        // ignore
      }
      window.clearInterval(poll);
    };
  }, [
    signedIn,
    canDm,
    canChallenge,
    myUserId,
    myUsername,
    presenceAddress,
    refreshLobbyUnread,
    refreshDmUnread,
    refreshChallenges,
  ]);

  const markLobbyRead = useCallback((lastId?: number | string | null) => {
    const id = lastId != null ? Number(lastId) : lobbyLastIdRef.current;
    if (Number.isFinite(id) && id > lobbyLastIdRef.current) {
      lobbyLastIdRef.current = id;
    }
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
      dmReadMapRef.current[String(conversationId)] = Math.max(
        Number(dmReadMapRef.current[String(conversationId)] || 0),
        Date.now() > 2e12 ? 0 : Number(dmReadMapRef.current[String(conversationId)] || 0)
      );
    }
    writeDmMap(dmReadMapRef.current);
    setDmItems((prev) => prev.filter((i) => i.conversationId !== conversationId));
    void refreshDmUnread();
  }, [refreshDmUnread]);

  const dismissChallenge = useCallback((id: number) => {
    setChallengeItems((prev) => prev.filter((c) => c.id !== id));
  }, []);

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
  const challengeUnread = canChallenge ? challengeItems.length : 0;
  // Challenges use ChallengeInviteBanner; exclude from bell badge.
  const totalUnread = lobbyUnread + (canDm ? dmUnreadTotal : 0);

  const value: MessageNotificationsValue = {
    lobbyUnread,
    dmUnreadTotal: canDm ? dmUnreadTotal : 0,
    dmItems: canDm ? dmItems : [],
    challengeItems: canChallenge ? challengeItems : [],
    challengeUnread,
    totalUnread,
    markLobbyRead,
    markDmRead,
    dismissChallenge,
    refreshChallenges,
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
      challengeItems: [] as ChallengeItem[],
      challengeUnread: 0,
      totalUnread: 0,
      markLobbyRead: () => {},
      markDmRead: () => {},
      dismissChallenge: () => {},
      refreshChallenges: async () => {},
      setLobbyOpen: () => {},
      setActiveDmConversationId: () => {},
    };
  }
  return ctx;
}
