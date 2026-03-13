// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {TycoonUserRegistry} from "../src/legacy/TycoonUserRegistry.sol";

/// @title Set TycoonUserRegistry.gameContract to the current Tycoon proxy
/// @notice If the registry was deployed with a different game address, or the proxy was upgraded,
///         the registry must accept calls from the current proxy. Run with TYCOON_OWNER key.
/// @dev Requires .env: TYCOON_USER_REGISTRY_ADDRESS, TYCOON_PROXY_ADDRESS.
contract SetUserRegistryGameContractScript is Script {
    function run() external {
        address registryAddr = vm.envAddress("TYCOON_USER_REGISTRY_ADDRESS");
        address proxyAddr = vm.envAddress("TYCOON_PROXY_ADDRESS");

        vm.startBroadcast();

        TycoonUserRegistry registry = TycoonUserRegistry(registryAddr);
        registry.setGameContract(proxyAddr);
        console.log("TycoonUserRegistry.gameContract set to proxy:", proxyAddr);

        vm.stopBroadcast();
    }
}
