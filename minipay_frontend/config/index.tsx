"use client";

import { cookieStorage, createStorage, createConfig } from "wagmi";
import { celo } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { custom, http, type Transport } from "viem";

export const appChain = "CELO";
export const defaultNetwork = celo;
export const chains = [celo] as const;

const publicCeloRpc =
  process.env.NEXT_PUBLIC_CELO_RPC_URL?.trim() || "https://forno.celo.org";

/** Injected-only transport when ethereum is present (MiniPay). */
export function createMiniPayWagmiConfig() {
  const eth =
    typeof window !== "undefined"
      ? (window as Window & { ethereum?: unknown }).ethereum
      : undefined;

  let transport: Transport;
  if (eth) {
    transport = custom(eth);
  } else {
    transport = http(publicCeloRpc);
  }

  return createConfig({
    chains,
    connectors: [injected()],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      [celo.id]: transport,
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

/** @deprecated Use `getWagmiConfig()` */
export const config = { get value() { return getWagmiConfig(); } };
