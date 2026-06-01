"use client";

import { cookieStorage, createStorage, createConfig } from "wagmi";
import { celo } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { custom, fallback, http, type Transport } from "viem";

export const appChain = "CELO";
export const defaultNetwork = celo;
export const chains = [celo] as const;

const publicCeloRpc =
  process.env.NEXT_PUBLIC_CELO_RPC_URL?.trim() || "https://forno.celo.org";

/**
 * MiniPay WebView often blocks public Forno HTTP; wallet actions must use `window.ethereum`.
 * Prefer injected provider on the client; HTTP only for SSR / non-wallet environments.
 */
function celoTransport(): Transport {
  const httpTransport = http(publicCeloRpc);
  if (typeof window !== "undefined") {
    const eth = (window as Window & { ethereum?: unknown }).ethereum;
    if (eth) {
      return fallback([custom(eth), httpTransport]);
    }
  }
  return httpTransport;
}

/** MiniPay-only wagmi config — injected provider only, no WalletConnect / AppKit. */
export const wagmiConfig = createConfig({
  chains,
  connectors: [injected()],
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  transports: {
    [celo.id]: celoTransport(),
  },
});

/** @deprecated Use `wagmiConfig` — kept for any stale imports. */
export const config = wagmiConfig;
