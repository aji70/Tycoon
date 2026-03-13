// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {TycoonUpgradeable} from "../src/TycoonUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title Upgrade the Tycoon game proxy to a new implementation
/// @notice Use this after changing TycoonUpgradeable.sol (e.g. revert-reason bubbling). Same proxy address, new code.
/// @dev Run with TYCOON_OWNER key. Requires .env: TYCOON_PROXY_ADDRESS.
contract UpgradeTycoonImplScript is Script {
    function run() external {
        address proxyAddr = vm.envAddress("TYCOON_PROXY_ADDRESS");

        vm.startBroadcast();

        TycoonUpgradeable newImpl = new TycoonUpgradeable();
        console.log("New TycoonUpgradeable impl:", address(newImpl));

        UUPSUpgradeable(proxyAddr).upgradeToAndCall(address(newImpl), "");
        console.log("Proxy upgraded. Game still at:", proxyAddr);

        vm.stopBroadcast();
    }
}
