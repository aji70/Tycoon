// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {TycoonUpgradeable} from "../src/TycoonUpgradeable.sol";

/// @title Set the backend game controller on the Tycoon proxy
/// @notice The backend uses BACKEND_GAME_CONTROLLER_*_PRIVATE_KEY; the address of that key must be set here.
/// @dev Run with owner --private-key. Requires .env: TYCOON_PROXY_ADDRESS, GAME_CONTROLLER (the backend wallet address).
contract SetBackendGameControllerScript is Script {
    function run() external {
        address proxy = vm.envAddress("TYCOON_PROXY_ADDRESS");
        address controller = vm.envAddress("GAME_CONTROLLER");

        vm.startBroadcast();

        TycoonUpgradeable(payable(proxy)).setBackendGameController(controller);
        console.log("setBackendGameController(%s) done", controller);

        vm.stopBroadcast();
    }
}
