"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import "react-toastify/dist/ReactToastify.css";
import ContextProvider from "@/context";
import AppKitProviderWrapper from "@/components/AppKitProviderWrapper";
import PrivyProviderWrapper from "@/components/PrivyProviderWrapper";
import { TycoonProvider } from "@/context/ContractProvider";
import { GuestAuthProvider } from "@/context/GuestAuthContext";
import ReferralCapture from "@/components/ReferralCapture";
import { TournamentProvider } from "@/context/TournamentContext";
import QueryProvider from "@/app/QueryProvider";
import ClientLayout from "@/clients/ClientLayout";
import ScrollToTopBtn from "@/components/shared/scroll-to-top-btn";
import { Toaster } from "react-hot-toast";
import BfcacheReloadGuard from "@/components/BfcacheReloadGuard";

const PrivyBackendSync = dynamic(() => import("@/components/PrivyBackendSync"), {
  ssr: false,
});
const AddWalletPromptModal = dynamic(
  () => import("@/components/guest/AddWalletPromptModal"),
  { ssr: false }
);
const ToastContainer = dynamic(
  () => import("react-toastify").then((m) => m.ToastContainer),
  { ssr: false }
);

type Props = {
  children: ReactNode;
  cookies: string | null;
};

/** Full wallet + contract provider stack (deferred on homepage until idle). */
export default function Web3ProviderTree({ children, cookies }: Props) {
  return (
    <PrivyProviderWrapper>
      <ContextProvider cookies={cookies}>
        <TycoonProvider>
          <GuestAuthProvider>
            <ReferralCapture />
            <PrivyBackendSync />
            <AddWalletPromptModal />
            <TournamentProvider>
              <AppKitProviderWrapper>
                <QueryProvider>
                  <BfcacheReloadGuard />
                  <ClientLayout cookies={cookies}>{children}</ClientLayout>
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
              </AppKitProviderWrapper>
            </TournamentProvider>
          </GuestAuthProvider>
        </TycoonProvider>
      </ContextProvider>
    </PrivyProviderWrapper>
  );
}
