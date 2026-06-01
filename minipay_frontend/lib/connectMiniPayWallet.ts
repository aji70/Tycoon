import { injected } from "wagmi/connectors";
import type { Config } from "wagmi";
import { connect } from "@wagmi/core";
import { wagmiConfig } from "@/config";

/** Connect injected MiniPay provider (use from click handlers). */
export async function connectMiniPayWallet(): Promise<void> {
  const config = wagmiConfig as Config;
  await connect(config, { connector: injected() });
}
