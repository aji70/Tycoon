// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";

/// @notice Game proxy (TycoonUpgradeable) exposes `rewardSystem` as public.
interface IGameProxyReward {
    function rewardSystem() external view returns (address);
}

/// @notice TycoonUserRegistry exposes `rewardSystemAddress` as public.
interface IUserRegistryReward {
    function rewardSystemAddress() external view returns (address);
}

/// @title Read-only check: game proxy vs user registry perk/reward addresses
/// @dev Requires .env: RPC_URL, TYCOON_PROXY_ADDRESS, TYCOON_USER_REGISTRY_ADDRESS.
///      Run: ./run-check-reward-system-alignment.sh  (no tx, no private key)
contract CheckRewardSystemAlignmentScript is Script {
    function run() external view {
        address proxy = vm.envAddress("TYCOON_PROXY_ADDRESS");
        address registry = vm.envAddress("TYCOON_USER_REGISTRY_ADDRESS");

        address proxyRs = IGameProxyReward(proxy).rewardSystem();
        address registryRs = IUserRegistryReward(registry).rewardSystemAddress();

        console.log("");
        console.log("=== Reward / perk contract alignment ===");
        console.log("Game proxy (TYCOON_PROXY_ADDRESS):     ", proxy);
        console.log("  rewardSystem():                      ", proxyRs);
        console.log("User registry (TYCOON_USER_REGISTRY):", registry);
        console.log("  rewardSystemAddress():               ", registryRs);
        console.log("");

        if (proxyRs == address(0)) {
            console.log("WARN: Proxy rewardSystem is zero - set it on the game proxy.");
        }
        if (registryRs == address(0)) {
            console.log("WARN: Registry rewardSystemAddress is zero - new wallets get no shop until set.");
        }

        if (proxyRs != address(0) && registryRs != address(0) && proxyRs == registryRs) {
            console.log("OK: Proxy and registry reference the same reward system.");
            console.log("    Smart wallets recreated after this should match the app.");
        } else if (proxyRs != address(0) && registryRs != address(0) && proxyRs != registryRs) {
            console.log("BUG: Mismatch.");
            console.log("     App/backend use proxy.rewardSystem(); new wallets copy registry.rewardSystemAddress().");
            console.log("Fix: As registry owner, call:");
            console.log("     TycoonUserRegistry.setRewardSystem( <proxy.rewardSystem()> );");
            console.log("     i.e. setRewardSystem(%s)", proxyRs);
        }

        string memory optional = vm.envOr("TYCOON_EXPECTED_REWARD_SYSTEM", string(""));
        if (bytes(optional).length > 0) {
            address expected = vm.parseAddress(optional);
            console.log("");
            console.log("Optional TYCOON_EXPECTED_REWARD_SYSTEM:", expected);
            if (proxyRs != expected) {
                console.log("  proxy.rewardSystem() != expected");
            }
            if (registryRs != expected) {
                console.log("  registry.rewardSystemAddress() != expected");
            }
            if (proxyRs == expected && registryRs == expected) {
                console.log("  Both match expected.");
            }
        }
        console.log("");
    }
}
