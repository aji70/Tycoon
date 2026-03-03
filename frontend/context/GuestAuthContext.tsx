"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";

export type GuestUser = {
  id: number;
  username: string;
  address: string;
  is_guest: boolean;
  linked_wallet_address?: string | null;
  linked_wallet_chain?: string | null;
  email?: string | null;
  email_verified?: boolean;
};

type GuestAuthContextValue = {
  guestUser: GuestUser | null;
  isLoading: boolean;
  registerGuest: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  loginGuest: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logoutGuest: () => void;
  refetchGuest: () => Promise<void>;
  linkWallet: (params: { walletAddress: string; chain: string; message: string; signature: string }) => Promise<{ success: boolean; message?: string }>;
  unlinkWallet: () => Promise<{ success: boolean; message?: string }>;
  loginByWallet: (params: { address: string; chain: string; message: string; signature: string }) => Promise<{ success: boolean; message?: string }>;
  connectEmail: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  verifyEmail: (token: string) => Promise<{ success: boolean; message?: string }>;
  loginEmail: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
};

const GuestAuthContext = createContext<GuestAuthContextValue | null>(null);

const TOKEN_KEY = "token";

export function GuestAuthProvider({ children }: { children: React.ReactNode }) {
  const [guestUser, setGuestUser] = useState<GuestUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refetchGuest = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) {
      setGuestUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await apiClient.get<ApiResponse & { data?: { id: number; username: string; address: string; is_guest?: boolean } }>("auth/me");
      if (res?.data?.data) {
        const d = res.data.data as Record<string, unknown>;
        setGuestUser({
          id: d.id as number,
          username: d.username as string,
          address: d.address as string,
          is_guest: (d.is_guest ?? true) as boolean,
          linked_wallet_address: d.linked_wallet_address as string | null | undefined,
          linked_wallet_chain: d.linked_wallet_chain as string | null | undefined,
          email: d.email as string | null | undefined,
          email_verified: d.email_verified as boolean | undefined,
        });
      } else {
        setGuestUser(null);
      }
    } catch {
      setGuestUser(null);
      if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetchGuest();
  }, [refetchGuest]);

  const registerGuest = useCallback(async (username: string, password: string) => {
    try {
      const res = await apiClient.post<ApiResponse & { data?: { token: string; user: GuestUser } }>("auth/guest-register", {
        username: username.trim(),
        password,
        chain: "Celo",
      });
      const data = res?.data as any;
      if (data?.data?.token && data?.data?.user) {
        if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, data.data.token);
        setGuestUser(data.data.user);
        return { success: true };
      }
      return { success: false, message: (data?.message as string) || "Registration failed" };
    } catch (err: any) {
      const message = err?.response?.data?.message ?? err?.message ?? "Registration failed";
      return { success: false, message };
    }
  }, []);

  const loginGuest = useCallback(async (username: string, password: string) => {
    try {
      const res = await apiClient.post<ApiResponse & { data?: { token: string; user: GuestUser } }>("auth/guest-login", { username: username.trim(), password });
      const data = res?.data as any;
      if (data?.data?.token && data?.data?.user) {
        if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, data.data.token);
        setGuestUser(data.data.user);
        return { success: true };
      }
      return { success: false, message: (data?.message as string) || "Login failed" };
    } catch (err: any) {
      const message = err?.response?.data?.message ?? err?.message ?? "Login failed";
      return { success: false, message };
    }
  }, []);

  const logoutGuest = useCallback(() => {
    if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
    setGuestUser(null);
  }, []);

  const linkWallet = useCallback(
    async (params: { walletAddress: string; chain: string; message: string; signature: string }) => {
      try {
        const res = await apiClient.post<ApiResponse & { data?: GuestUser }>("auth/link-wallet", params);
        const data = res?.data as { data?: GuestUser };
        if (data?.data) {
          setGuestUser({
            id: data.data.id,
            username: data.data.username,
            address: data.data.address,
            is_guest: data.data.is_guest ?? true,
            linked_wallet_address: data.data.linked_wallet_address ?? null,
            linked_wallet_chain: data.data.linked_wallet_chain ?? null,
            email: data.data.email,
            email_verified: data.data.email_verified,
          });
          return { success: true };
        }
        return { success: false, message: (res?.data as { message?: string })?.message };
      } catch (err: unknown) {
        const message = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as Error)?.message ?? "Link failed";
        return { success: false, message };
      }
    },
    []
  );

  const unlinkWallet = useCallback(async () => {
    try {
      const res = await apiClient.post<ApiResponse & { data?: GuestUser }>("auth/unlink-wallet");
      const data = res?.data as { data?: GuestUser };
      if (data?.data) {
        setGuestUser({
          id: data.data.id,
          username: data.data.username,
          address: data.data.address,
          is_guest: data.data.is_guest ?? true,
          linked_wallet_address: null,
          linked_wallet_chain: null,
          email: data.data.email,
          email_verified: data.data.email_verified,
        });
        return { success: true };
      }
      return { success: false, message: (res?.data as { message?: string })?.message };
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as Error)?.message ?? "Unlink failed";
      return { success: false, message };
    }
  }, []);

  const loginByWallet = useCallback(
    async (params: { address: string; chain: string; message: string; signature: string }) => {
      try {
        const res = await apiClient.post<ApiResponse & { data?: { token: string; user: GuestUser } }>("auth/login-by-wallet", params);
        const data = res?.data as { data?: { token: string; user: GuestUser } };
        if (data?.data?.token && data?.data?.user) {
          if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, data.data.token);
          setGuestUser(data.data.user);
          return { success: true };
        }
        return { success: false, message: (res?.data as { message?: string })?.message };
      } catch (err: unknown) {
        const message = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as Error)?.message ?? "Login failed";
        return { success: false, message };
      }
    },
    []
  );

  const connectEmail = useCallback(async (email: string, password: string) => {
    try {
      await apiClient.post("auth/connect-email", { email: email.trim(), password });
      await refetchGuest();
      return { success: true };
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as Error)?.message ?? "Connect email failed";
      return { success: false, message };
    }
  }, [refetchGuest]);

  const verifyEmail = useCallback(async (token: string) => {
    try {
      const res = await apiClient.get<ApiResponse & { data?: GuestUser }>(`auth/verify-email?token=${encodeURIComponent(token)}`);
      const data = res?.data as { data?: GuestUser };
      if (data?.data) {
        await refetchGuest();
        return { success: true };
      }
      return { success: false, message: (res?.data as { message?: string })?.message };
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as Error)?.message ?? "Verification failed";
      return { success: false, message };
    }
  }, [refetchGuest]);

  const loginEmail = useCallback(async (email: string, password: string) => {
    try {
      const res = await apiClient.post<ApiResponse & { data?: { token: string; user: GuestUser } }>("auth/login-email", { email: email.trim(), password });
      const data = res?.data as { data?: { token: string; user: GuestUser } };
      if (data?.data?.token && data?.data?.user) {
        if (typeof window !== "undefined") localStorage.setItem(TOKEN_KEY, data.data.token);
        setGuestUser(data.data.user);
        return { success: true };
      }
      return { success: false, message: (res?.data as { message?: string })?.message };
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (err as Error)?.message ?? "Login failed";
      return { success: false, message };
    }
  }, []);

  const value: GuestAuthContextValue = {
    guestUser,
    isLoading,
    registerGuest,
    loginGuest,
    logoutGuest,
    refetchGuest,
    linkWallet,
    unlinkWallet,
    loginByWallet,
    connectEmail,
    verifyEmail,
    loginEmail,
  };

  return <GuestAuthContext.Provider value={value}>{children}</GuestAuthContext.Provider>;
}

export function useGuestAuth() {
  const ctx = useContext(GuestAuthContext);
  if (!ctx) throw new Error("useGuestAuth must be used within GuestAuthProvider");
  return ctx;
}

export function useGuestAuthOptional() {
  return useContext(GuestAuthContext);
}
