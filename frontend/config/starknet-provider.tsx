"use client";
import React from "react";

import { sepolia, mainnet } from "@starknet-react/chains";
import {
  StarknetConfig,
  jsonRpcProvider,
  argent,
  braavos,
  cartridge,
} from "@starknet-react/core";
import { ControllerConnector } from "@cartridge/connector";
import { constants } from "starknet";

// Connector unchanged (uses Cartridge RPC for wallet ops)
const cartridgeConnector = new ControllerConnector({
  defaultChainId: constants.StarknetChainId.SN_SEPOLIA,
  chains: [
    {
      ...mainnet,
      rpcUrl: "https://api.cartridge.gg/x/starknet/mainnet",
    },
    {
      ...sepolia,
      rpcUrl: "https://api.cartridge.gg/x/starknet/sepolia",
    },
  ],
});

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  // Switch to official Starknet RPCs (supports pending for reads)
  const provider = jsonRpcProvider({
    rpc: (chain) => {
      switch (chain) {
        case mainnet:
          return { nodeUrl: "https://rpc.mainnet.starknet.io/rpc/v0_8_0" };
        case sepolia:
        default:
          return { nodeUrl: "https://rpc.sepolia.starknet.io/rpc/v0_8_0" };
      }
    },
  });

  const connectors = [cartridgeConnector, argent(), braavos()];

  return (
    <StarknetConfig
      chains={[mainnet, sepolia]}
      provider={provider}
      connectors={connectors}
      explorer={cartridge}
      autoConnect={true}
      defaultChainId={sepolia.id}
    >
      {children}
    </StarknetConfig>
  );
}