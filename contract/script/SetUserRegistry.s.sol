// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {TycoonUpgradeable} from "../src/TycoonUpgradeable.sol";

/// @title Point Tycoon proxy at the User Registry from .env
/// @notice Requires .env: TYCOON_PROXY_ADDRESS, TYCOON_USER_REGISTRY_ADDRESS. Run with owner --private-key.
contract SetUserRegistryScript is Script {
    function run() external {
        address proxy = vm.envAddress("TYCOON_PROXY_ADDRESS");
        address registry = vm.envAddress("TYCOON_USER_REGISTRY_ADDRESS");

        vm.startBroadcast();

        TycoonUpgradeable(payable(proxy)).setUserRegistry(registry);
        console.log("setUserRegistry(%s) done", registry);

        vm.stopBroadcast();
    }
}
