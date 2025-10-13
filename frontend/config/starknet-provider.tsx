"use client";
import React from "react";

import { sepolia, mainnet } from "@starknet-react/chains";
import {
  StarknetConfig,
  jsonRpcProvider,
  cartridge, // Import for explorer
} from "@starknet-react/core";
import { ControllerConnector } from "@cartridge/connector";
import { constants } from "starknet";

// Create the connector *outside* the component (simplified, no theme/namespace/slot)
const cartridgeConnector = new ControllerConnector({
  defaultChainId: constants.StarknetChainId.SN_SEPOLIA,
  chains: [
    {
      ...mainnet,
      rpcUrl: "https://api.cartridge.gg/x/starknet/mainnet",
    },
    {
      ...sepolia,
      rpcUrl: "https://api.cartridge.gg/x/starknet/sepolia/rpc/v0_8",
    },
  ],
});

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  // Custom provider with Cartridge RPCs
  const provider = jsonRpcProvider({
    rpc: (chain) => {
      switch (chain) {
        case mainnet:
          return { nodeUrl: "https://api.cartridge.gg/x/starknet/mainnet" };
        case sepolia:
        default:
          return { nodeUrl: "https://api.cartridge.gg/x/starknet/sepolia/rpc/v0_8" };
      }
    },
  });

  // Optional: Include other connectors if you want multi-wallet support
  const connectors = [
    cartridgeConnector,
  ];

  return (
    <StarknetConfig
      chains={[mainnet, sepolia]}
      provider={provider}
      connectors={connectors}
      explorer={cartridge}
      autoConnect={true}
      defaultChainId={sepolia.id} // Matches your Sepolia focus
    >
      {children}
    </StarknetConfig>
  );
}