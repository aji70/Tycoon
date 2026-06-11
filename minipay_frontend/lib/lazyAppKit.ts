import { wagmiAdapter, projectId, defaultNetwork } from "@/config";

let initStarted = false;
let initDone = false;

const siteUrl = (() => {
  const fromEnv = process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv?.trim()) return fromEnv.replace(/\/$/, "");
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return "https://www.playtycoon.xyz";
})();

/** Defer Reown AppKit until idle or first wallet interaction (cuts main-thread work on load). */
export function scheduleLazyAppKitInit(): void {
  if (typeof window === "undefined" || initStarted) return;
  initStarted = true;

  const run = async () => {
    if (initDone) return;
    initDone = true;
    const { createAppKit } = await import("@reown/appkit/react");
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
  };

  const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1));
  ric(() => void run(), { timeout: 4000 });

  const onIntent = () => {
    void run();
    document.removeEventListener("pointerdown", onIntent, true);
    document.removeEventListener("keydown", onIntent, true);
  };
  document.addEventListener("pointerdown", onIntent, true);
  document.addEventListener("keydown", onIntent, true);
}
