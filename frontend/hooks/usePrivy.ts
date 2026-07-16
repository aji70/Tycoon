"use client";

/**
 * Compatibility shim: same shape as Privy's usePrivy, backed by Web3Auth.
 * Existing call sites can keep importing usePrivy from this module.
 */
import { useCallback, useMemo } from "react";
import {
  useAuthTokenInfo,
  useWeb3Auth,
  useWeb3AuthConnect,
  useWeb3AuthDisconnect,
  useWeb3AuthUser,
} from "@web3auth/modal/react";

export function usePrivy() {
  const { isInitialized, isConnected: providerConnected } = useWeb3Auth();
  const { connect, isConnected, loading: connectLoading } = useWeb3AuthConnect();
  const { disconnect } = useWeb3AuthDisconnect();
  const { userInfo } = useWeb3AuthUser();
  const { getAuthTokenInfo } = useAuthTokenInfo();

  const ready = Boolean(isInitialized);
  const authenticated = Boolean(isConnected || providerConnected);

  const login = useCallback(async () => {
    await connect();
  }, [connect]);

  const logout = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  /** Returns Web3Auth identity token for POST /auth/web3auth-signin. */
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    try {
      const token = await getAuthTokenInfo();
      return typeof token === "string" && token.length > 0 ? token : null;
    } catch {
      return null;
    }
  }, [getAuthTokenInfo]);

  /** Opens Web3Auth connect modal (external wallets live there / AppKit separately). */
  const connectWallet = useCallback(async () => {
    await connect();
  }, [connect]);

  const user = useMemo(() => {
    if (!userInfo) return null;
    return {
      ...userInfo,
      email: userInfo.email
        ? { address: typeof userInfo.email === "string" ? userInfo.email : (userInfo.email as { address?: string })?.address }
        : undefined,
    };
  }, [userInfo]);

  return {
    ready,
    authenticated,
    login,
    logout,
    user,
    getAccessToken,
    connectWallet,
    /** Extra: true while the Web3Auth modal connect is in flight */
    connecting: connectLoading,
  };
}

export default usePrivy;
