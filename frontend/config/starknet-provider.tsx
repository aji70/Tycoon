"use client";
import React from "react";

import { sepolia, mainnet } from "@starknet-react/chains";
import {
    StarknetConfig,
    publicProvider,
    argent,
    braavos,
    useInjectedConnectors,
    voyager,
} from "@starknet-react/core";
import { ControllerConnector } from "@cartridge/connector";
import { constants } from "starknet";

const cartridgeConnector = new ControllerConnector({
  chains: [
    {
      rpcUrl: "https://api.cartridge.gg/x/starknet/sepolia",
    },
    {
      rpcUrl: "https://api.cartridge.gg/x/starknet/mainnet",
    },
  ],
  defaultChainId: constants.StarknetChainId.SN_SEPOLIA,
});

export function StarknetProvider({ children }: { children: React.ReactNode }) {
  const { connectors } = useInjectedConnectors({
    // Show these connectors if the user has no connector installed.
    recommended: [argent(), braavos(), cartridgeConnector],
    // Hide recommended connectors if the user has any connector installed.
    includeRecommended: "onlyIfNoConnectors",
    // Randomize the order of the connectors.
    order: "random",
  });

    return (
     <StarknetConfig
        chains={[mainnet, sepolia]}
        provider={publicProvider()}
        connectors={connectors}
        explorer={voyager}
        autoConnect={true}
        >
            {children}
        </StarknetConfig>
    );
}
