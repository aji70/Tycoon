import { cookieStorage, createStorage, http } from "@wagmi/core";
import { createConfig } from "wagmi";
import { celo } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { getCeloRpcUrlForChainId } from "@/lib/utils/erc8004InjectedEoa";

export const appChain = "CELO";
export const defaultNetwork = celo;
export const chains = [celo] as const;

/** MiniPay-only wagmi config — injected provider only, no WalletConnect / AppKit. */
export const wagmiConfig = createConfig({
  chains,
  connectors: [injected()],
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  transports: {
    [celo.id]: http(getCeloRpcUrlForChainId(celo.id)),
  },
});

/** @deprecated Use `wagmiConfig` — kept for any stale imports. */
export const config = wagmiConfig;
