/**
 * MiniPay build: Privy is disabled. Stub keeps existing call sites working without
 * bundling @privy-io/react-auth on the critical path.
 */
export function usePrivy() {
  return {
    ready: true,
    authenticated: false,
    user: null,
    login: async () => {},
    logout: async () => {},
    connectWallet: async () => {},
    getAccessToken: async () => null as string | null,
  };
}
