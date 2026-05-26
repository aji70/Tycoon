"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import QueryProvider from "@/app/QueryProvider";
import ClientLayout from "@/clients/ClientLayout";
import Web3ProviderTree from "@/components/Web3ProviderTree";
import { MOUNT_EVENT, Web3ReadyProvider } from "@/context/Web3ReadyContext";
import { dmSans, kronaOne, orbitron } from "@/components/shared/fonts";

function isHomePath(pathname: string | null): boolean {
  const path = pathname?.split("?")[0] ?? "";
  return path === "/" || path === "";
}

type Props = {
  children: ReactNode;
  cookies: string | null;
};

/**
 * On the marketing homepage, delay mounting Privy/wagmi/AppKit until the browser is idle
 * (or the user taps Connect wallet). Other routes mount immediately.
 */
export default function Web3MountGate({ children, cookies }: Props) {
  const pathname = usePathname();
  const home = isHomePath(pathname);
  const [web3Ready, setWeb3Ready] = useState(() => !isHomePath(pathname));

  const mount = useCallback(() => {
    setWeb3Ready(true);
  }, []);

  useEffect(() => {
    if (!home) {
      mount();
      return;
    }

    if (web3Ready) return;

    const onMountRequest = () => mount();
    window.addEventListener(MOUNT_EVENT, onMountRequest);

    const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1));
    const cancelRic =
      window.cancelIdleCallback ?? ((id: number) => window.clearTimeout(id));
    const idleId = ric(() => mount(), { timeout: 2500 });

    return () => {
      window.removeEventListener(MOUNT_EVENT, onMountRequest);
      cancelRic(idleId as number);
    };
  }, [home, mount, web3Ready]);

  if (web3Ready) {
    return (
      <Web3ReadyProvider ready>
        <Web3ProviderTree cookies={cookies}>{children}</Web3ProviderTree>
      </Web3ReadyProvider>
    );
  }

  return (
    <Web3ReadyProvider ready={false}>
      <div className={`${orbitron.variable} ${dmSans.variable} ${kronaOne.variable}`}>
        <QueryProvider>
          <ClientLayout cookies={cookies} minimal>
            {children}
          </ClientLayout>
        </QueryProvider>
      </div>
    </Web3ReadyProvider>
  );
}
