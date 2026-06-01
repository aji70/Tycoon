"use client";

import { getWagmiConfig } from "@/config";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useEffect, useState, type ReactNode } from "react";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";

const queryClient = new QueryClient();

function ContextProvider({ children, cookies }: { children: ReactNode; cookies: string | null }) {
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    setConfig(getWagmiConfig());
  }, []);

  if (!config) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  const initialState = cookieToInitialState(config, cookies);

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

export default ContextProvider;
