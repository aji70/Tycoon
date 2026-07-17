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
  const { isInitialized, isConnected: providerConnected, isAuthorized } = useWeb3Auth();
  const { connect, isConnected, loading: connectLoading } = useWeb3AuthConnect();
  const { disconnect } = useWeb3AuthDisconnect();
  const { userInfo } = useWeb3AuthUser();
  const { getAuthTokenInfo, token: cachedToken } = useAuthTokenInfo();

  const ready = Boolean(isInitialized);
  /** CONNECT_AND_SIGN mode issues idToken on AUTHORIZED, not only CONNECTED. */
  const authenticated = Boolean(isConnected || providerConnected || isAuthorized);

  const login = useCallback(async () => {
    if (isAuthorized || isConnected || providerConnected) return;
    await connect();
  }, [connect, isAuthorized, isConnected, providerConnected]);

  const logout = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  /** Returns Web3Auth identity token for POST /auth/web3auth-signin. */
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (typeof cachedToken === "string" && cachedToken.length > 0) {
      return cachedToken;
    }
    try {
      const token = await getAuthTokenInfo();
      return typeof token === "string" && token.length > 0 ? token : null;
    } catch {
      return null;
    }
  }, [cachedToken, getAuthTokenInfo]);

  /** Opens Web3Auth connect modal (external wallets live there / AppKit separately). */
  const connectWallet = useCallback(async () => {
    if (isAuthorized || isConnected || providerConnected) return;
    await connect();
  }, [connect, isAuthorized, isConnected, providerConnected]);

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
    /** True once Web3Auth has issued an id token (CONNECT_AND_SIGN terminal state). */
    isAuthorized: Boolean(isAuthorized),
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
