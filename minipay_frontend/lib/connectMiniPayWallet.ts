import { injected } from "wagmi/connectors";
import type { Config } from "wagmi";
import { connect } from "@wagmi/core";
import { wagmiAdapter } from "@/config";
import { isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";

/** Connect injected MiniPay provider (use from click handlers). */
export async function connectMiniPayWallet(): Promise<void> {
  if (!isMiniPayEmbeddedWallet()) return;
  const config = wagmiAdapter.wagmiConfig as Config;
  await connect(config, { connector: injected() });
}
