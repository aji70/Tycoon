import { createDojoConfig } from "@dojoengine/core";

import manifest from "../contract/manifest_sepolia.json";

export const dojoConfig = createDojoConfig({
  manifest,
  rpcUrl: "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_8/g8riPvuz6RyNrAHHdsVvLL6mnRls0Iug", // Official Starknet RPC (supports "pending" for reads)
});