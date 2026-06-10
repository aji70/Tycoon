"use client";

import { cookieStorage, createStorage, createConfig } from "wagmi";
import { celo } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { celoTransportForWagmi } from "@/lib/celoTransportForWagmi";

export const appChain = "CELO";
export const defaultNetwork = celo;
export const chains = [celo] as const;

export function createMiniPayWagmiConfig() {
  return createConfig({
    chains,
    connectors: [injected()],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      [celo.id]: celoTransportForWagmi(),
    },
  });
}

let injectedConfig: ReturnType<typeof createMiniPayWagmiConfig> | null = null;
let ssrConfig: ReturnType<typeof createMiniPayWagmiConfig> | null = null;

/** Wagmi config: injected transport in browser when `window.ethereum` exists; HTTP only for SSR. */
export function getWagmiConfig() {
  const hasEth =
    typeof window !== "undefined" &&
    !!(window as Window & { ethereum?: unknown }).ethereum;

  if (hasEth) {
    if (!injectedConfig) {
      injectedConfig = createMiniPayWagmiConfig();
    }
    return injectedConfig;
  }

  if (!ssrConfig) {
    ssrConfig = createMiniPayWagmiConfig();
  }
  return ssrConfig;
}
