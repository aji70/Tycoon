import { wagmiAdapter, projectId, defaultNetwork } from "@/config";
import { createAppKit } from "@reown/appkit/react";

const siteUrl = (() => {
  const fromEnv = process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv?.trim()) return fromEnv.replace(/\/$/, "");
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return "https://www.playtycoon.xyz";
})();

let isInitialized = false;

/** Load Reown AppKit only when needed (shop modal, non-MiniPay browser testing). */
export function ensureAppKit(): void {
  if (typeof window === "undefined" || isInitialized) return;
  void import("@/styles/deferred-ui.css");
  createAppKit({
    adapters: [wagmiAdapter],
    networks: [defaultNetwork],
    projectId,
    defaultNetwork,
    themeVariables: {
      "--w3m-z-index": 10000,
    },
    metadata: {
      name: "Tycoon",
      description: "Play Monopoly onchain",
      url: siteUrl,
      icons: [`${siteUrl}/logo.png`],
    },
    features: {
      analytics: true,
    },
  });
  isInitialized = true;
}
