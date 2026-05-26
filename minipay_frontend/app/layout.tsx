import { dmSans, kronaOne, orbitron } from "@/components/shared/fonts";
import NavBar from "@/components/shared/navbar"; // Remove if not used elsewhere
import ScrollToTopBtn from "@/components/shared/scroll-to-top-btn";
import "@/styles/globals.css";
import { headers } from "next/headers";
import ContextProvider from "@/context";
import ReferralCapture from "@/components/ReferralCapture";
import MinipayAutoConnect from "@/components/MinipayAutoConnect";
import { TycoonProvider } from "@/context/ContractProvider";
import { GuestAuthProvider } from "@/context/GuestAuthContext";
import DeferredToasts from "@/components/DeferredToasts";
import DeferredUiStyles from "@/components/DeferredUiStyles";
import { SocketProvider } from "@/context/SocketContext";
import { TournamentProvider } from "@/context/TournamentContext";
import { Toaster } from "react-hot-toast";
import FarcasterReady from "@/components/FarcasterReady"; 
import { minikitConfig } from "../minikit.config";
import type { Metadata } from "next";
import Script from "next/script";
import ClientLayout from "../clients/ClientLayout"; // ← Import the new wrapper
import QueryProvider from "./QueryProvider";
import BfcacheReloadGuard from "@/components/BfcacheReloadGuard";

// Run before React: (1) Reload board when restored from bfcache so WebGL is fresh. (2) Disable bfcache on board so back button does full load instead of restore (avoids Context Lost + .style crash).
const BFCACHE_RELOAD_SCRIPT = `
(function(){
  var boardPath = /\\/board-3d-(mobile|multi-mobile)(\\/|$)/;
  function isBoard() { return boardPath.test(window.location.pathname); }
  window.addEventListener('pageshow', function(e) {
    if (e.persisted && isBoard()) { window.location.reload(); }
  });
  if (isBoard()) {
    window.addEventListener('unload', function() {});
  }
})();
`;

// Remove the duplicate 'cookies' global variable—it's not needed

/** Safe metadataBase — invalid env (missing protocol, spaces) must not 500 the whole site. */
function resolveMetadataBase(): URL {
  const fallback = "https://www.playtycoon.xyz";
  const raw = (process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_SITE_URL || "")
    .trim()
    .replace(/\/$/, "");
  const candidate = raw || fallback;
  try {
    if (/^https?:\/\//i.test(candidate)) {
      return new URL(candidate);
    }
    return new URL(`https://${candidate}`);
  } catch {
    return new URL(fallback);
  }
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: resolveMetadataBase(),
    title: {
      default: "Tycoon — On-chain Monopoly on Celo",
      template: "%s | Tycoon",
    },
    description:
      "Tycoon is a decentralized on-chain game inspired by the classic Monopoly game, built on Celo. It allows players to buy, sell, and trade digital properties in a trustless gaming environment.",
    other: {
      "talentapp:project_verification":
        "5d078ddf22e877e4b4a4508b55b82c826e0b7d2bef4d1505b4b14945a216f62eaf013de3c9fe99c4fd58ae7fc896455a9ada31130565d32c8a5eb785b394113a",
      "base:app_id": "695d328c3ee38216e9af4359", 
      "fc:frame": JSON.stringify({
        version: minikitConfig.miniapp.version,
        imageUrl: minikitConfig.miniapp.heroImageUrl,
        images: {
          url: minikitConfig.miniapp.heroImageUrl,
          alt: "Tycoon - Monopoly Game Onchain",
        },
        button: {
          title: `Play ${minikitConfig.miniapp.name} `,
          action: {
            name: `Launch ${minikitConfig.miniapp.name}`,
            type: "launch_frame",
          },
        },
      }),
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersObj = await headers();
  const cookies = headersObj.get("cookie"); // Local var—no need for global

  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className="antialiased bg-[#010F10] w-full">
        <Script id="bfcache-reload" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: BFCACHE_RELOAD_SCRIPT }} />
        <FarcasterReady />
        <ContextProvider cookies={cookies}>
            <TycoonProvider>
              <GuestAuthProvider>
              <ReferralCapture />
              <MinipayAutoConnect />
              <TournamentProvider>
                <QueryProvider>
                <BfcacheReloadGuard />
                <ClientLayout cookies={cookies}>
                  {children}
                </ClientLayout>
                
                <ScrollToTopBtn />
                <DeferredUiStyles />
                <DeferredToasts />
                <Toaster position="top-center" />
                </QueryProvider>
              </TournamentProvider>
              </GuestAuthProvider>
            </TycoonProvider>
        </ContextProvider>
      </body>
    </html>
  );
}