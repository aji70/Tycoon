"use client";

import { getWagmiConfig } from "@/config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { type ReactNode } from "react";
import { cookieToInitialState, WagmiProvider } from "wagmi";

const queryClient = new QueryClient();

function ContextProvider({ children, cookies }: { children: ReactNode; cookies: string | null }) {
  const config = getWagmiConfig();
  const initialState = cookieToInitialState(config, cookies);

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

export default ContextProvider;
