import { injected } from "wagmi/connectors";
import type { Config } from "wagmi";
import { connect, getAccount } from "@wagmi/core";
import { wagmiConfig } from "@/config";
import { isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";

/** Connect injected MiniPay provider (use from click handlers). */
export async function connectMiniPayWallet(): Promise<void> {
  const config = wagmiConfig as Config;
  await connect(config, { connector: injected() });
}

/**
 * MiniPay auto-connect can lag behind `eth_accounts`. Ensure wagmi is connected before writes.
 */
export async function ensureMiniPayWagmiConnected(): Promise<void> {
  if (!isMiniPayEmbeddedWallet()) return;

  const config = wagmiConfig as Config;
  let account = getAccount(config);
  if (account.status === "connected" && account.address) return;

  await connect(config, { connector: injected() });

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 100));
    account = getAccount(config);
    if (account.status === "connected" && account.address) return;
  }

  throw new Error(
    "MiniPay wallet is still connecting. Close and reopen the app, then try again."
  );
}
