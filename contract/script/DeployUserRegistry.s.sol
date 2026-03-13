// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {TycoonUserRegistry} from "../src/legacy/TycoonUserRegistry.sol";
import {TycoonUpgradeable} from "../src/TycoonUpgradeable.sol";

/// @title Deploy TycoonUserRegistry and wire it to the game (so each new register gets a smart wallet)
/// @notice Requires .env: TYCOON_OWNER, TYCOON_PROXY_ADDRESS, TYCOON_REWARDS_FAUCET_ADDRESS.
/// @dev Run with --private-key for TYCOON_OWNER so setUserRegistry succeeds.
contract DeployUserRegistryScript is Script {
    function run() external {
        address owner = vm.envAddress("TYCOON_OWNER");
        address proxy = vm.envAddress("TYCOON_PROXY_ADDRESS");
        address rewardsFaucet = vm.envAddress("TYCOON_REWARDS_FAUCET_ADDRESS");

        vm.startBroadcast();

        TycoonUserRegistry registry = new TycoonUserRegistry(proxy, rewardsFaucet, owner);
        console.log("TycoonUserRegistry:", address(registry));

        TycoonUpgradeable(payable(proxy)).setUserRegistry(address(registry));
        console.log("setUserRegistry done");

        vm.stopBroadcast();
    }
}
