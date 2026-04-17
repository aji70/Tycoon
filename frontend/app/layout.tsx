import { dmSans, kronaOne, orbitron } from "@/components/shared/fonts";
import NavBar from "@/components/shared/navbar"; // Remove if not used elsewhere
import ScrollToTopBtn from "@/components/shared/scroll-to-top-btn";
import "@/styles/globals.css";
import { getMetadata } from "@/utils/getMeatadata";
import { headers } from "next/headers";
import ContextProvider from "@/context";
import AppKitProviderWrapper from "@/components/AppKitProviderWrapper";
import PrivyProviderWrapper from "@/components/PrivyProviderWrapper";
import PrivyBackendSync from "@/components/PrivyBackendSync";
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

export async function generateMetadata(): Promise<Metadata> {
  const headersObj = await headers();
  const cookies = headersObj.get("cookie"); // Local var is fine here
  return {
    title: "Tycoon",
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
      <head>
        <link rel="dns-prefetch" href="https://api.web3modal.org" />
        <link rel="dns-prefetch" href="https://fonts.reown.com" />
        <link rel="preconnect" href="https://auth.privy.io" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://api.web3modal.org" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.reown.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased bg-[#010F10] w-full">
        <Script id="bfcache-reload" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: BFCACHE_RELOAD_SCRIPT }} />
        <FarcasterReady />
        <PrivyProviderWrapper>
          <ContextProvider cookies={cookies}>
            <TycoonProvider>
              <GuestAuthProvider>
              <ReferralCapture />
              <PrivyBackendSync />
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
        </PrivyProviderWrapper>
      </body>
    </html>
  );
}