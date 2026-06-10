import { injected } from "wagmi/connectors";
import type { Config } from "wagmi";
import { connect } from "@wagmi/core";
import { config } from "@/config";

/** Connect injected MiniPay provider (use from click handlers). */
export async function connectMiniPayWallet(): Promise<void> {
  await connect(config as Config, { connector: injected() });
}
