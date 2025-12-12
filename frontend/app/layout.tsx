import { dmSans, kronaOne, orbitron } from "@/components/shared/fonts";
import NavBar from "@/components/shared/navbar";
import ScrollToTopBtn from "@/components/shared/scroll-to-top-btn";
import "@/styles/globals.css";
import { getMetadata } from "@/utils/getMeatadata";
import { headers } from "next/headers";
import ContextProvider from "@/context";
import AppKitProviderWrapper from "@/components/AppKitProviderWrapper";
import { PlayerContractProvider } from "@/context/ContractProvider";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { SocketProvider } from "@/context/SocketContext";
import { Toaster } from "react-hot-toast";
import FarcasterReady from "@/components/FarcasterReady"; 
import { minikitConfig } from "../minikit.config";
import type { Metadata } from "next";
let cookies: string|null;


export async function generateMetadata(): Promise<Metadata> {
   const headersObj = await headers();
   cookies = headersObj.get("cookie");
  return {
    title: "Tycoon",
  description:
    "Tycoon is a decentralized on-chain game inspired by the classic Monopoly game, built on Base. It allows players to buy, sell, and trade digital properties in a trustless gaming environment.",
    other: {
      "base:app_id": "693bedf4e6be54f5ed71d772", 
      "fc:frame": JSON.stringify({
        version: minikitConfig.miniapp.version,
        imageUrl: minikitConfig.miniapp.heroImageUrl,
        button: {
          title: `Join the ${minikitConfig.miniapp.name} Waitlist`,
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
  const cookies = headersObj.get("cookie");

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${orbitron.variable} ${dmSans.variable} ${kronaOne.variable}`}
    >
      <body className="antialiased bg-[#010F10] w-full">
        <FarcasterReady />
        <ContextProvider cookies={cookies}>
          <PlayerContractProvider>
            <AppKitProviderWrapper>
              {/* <SocketProvider
                serverUrl={
                  "https://base-monopoly-production.up.railway.app/api"
                }
              > */}
              <NavBar />
              {children}
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
              {/* </SocketProvider> */}
            </AppKitProviderWrapper>
          </PlayerContractProvider>
        </ContextProvider>
      </body>
    </html>
  );
}