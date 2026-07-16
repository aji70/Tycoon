import { dmSans, kronaOne, orbitron } from "@/components/shared/fonts";
import NavBar from "@/components/shared/navbar"; // Remove if not used elsewhere
import ScrollToTopBtn from "@/components/shared/scroll-to-top-btn";
import "@/styles/globals.css";
import { headers } from "next/headers";
import ContextProvider from "@/context";
import AppKitProviderWrapper from "@/components/AppKitProviderWrapper";
import Web3AuthProviderWrapper from "@/components/Web3AuthProviderWrapper";
import Web3AuthBackendSync from "@/components/Web3AuthBackendSync";
import ReferralCapture from "@/components/ReferralCapture";
import AddWalletPromptModal from "@/components/guest/AddWalletPromptModal";
import { TycoonProvider } from "@/context/ContractProvider";
import { GuestAuthProvider } from "@/context/GuestAuthContext";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
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
  const fallback = "https://www.tycoonworld.xyz";
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
    icons: {
      icon: [
        { url: "/favicon.png", sizes: "192x192", type: "image/png" },
        { url: "/metadata/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/metadata/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      ],
      apple: [{ url: "/metadata/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
      shortcut: [{ url: "/metadata/favicon.ico", sizes: "48x48", type: "image/x-icon" }],
    },
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
      <head>
        <link rel="dns-prefetch" href="https://auth.web3auth.io" />
        <link rel="dns-prefetch" href="https://api-auth.web3auth.io" />
        <link rel="dns-prefetch" href="https://api.web3modal.org" />
        <link rel="dns-prefetch" href="https://pulse.walletconnect.org" />
        <link rel="dns-prefetch" href="https://fonts.reown.com" />
        <link rel="preconnect" href="https://fonts.reown.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased bg-[#010F10] w-full">
        <Script id="bfcache-reload" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: BFCACHE_RELOAD_SCRIPT }} />
        <FarcasterReady />
        <Web3AuthProviderWrapper>
          <ContextProvider cookies={cookies}>
            <TycoonProvider>
              <GuestAuthProvider>
              <ReferralCapture />
              <Web3AuthBackendSync />
              <AddWalletPromptModal />
              <TournamentProvider>
              <AppKitProviderWrapper>
                {/* SocketProvider commented out as in your code */}
                {/* <SocketProvider serverUrl="https://base-monopoly-production.up.railway.app/api"> */}
                
                {/* ← Use the client wrapper here—no more useMediaQuery! */}
                <QueryProvider>
                <BfcacheReloadGuard />
                <ClientLayout cookies={cookies}>
                  {children}
                </ClientLayout>
                
                <ScrollToTopBtn />
                <ToastContainer
                  position="top-right"
                  autoClose={5000}
                  hideProgressBar={false}
                  newestOnTop
                  closeOnClick
                  rtl={false}
                  pauseOnFocusLoss
                  draggable
                  pauseOnHover
                  theme="dark"
                  toastStyle={{
                    fontFamily: "Orbitron, sans-serif",
                    background: "#0E1415",
                    color: "#00F0FF",
                    border: "1px solid #003B3E",
                  }}
                />
                <Toaster position="top-center" />
                </QueryProvider>
                
                {/* </SocketProvider> */}
              </AppKitProviderWrapper>
              </TournamentProvider>
              </GuestAuthProvider>
            </TycoonProvider>
          </ContextProvider>
        </Web3AuthProviderWrapper>
      </body>
    </html>
  );
}