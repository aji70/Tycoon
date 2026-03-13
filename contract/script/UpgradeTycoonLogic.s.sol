// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {TycoonUpgradeable} from "../src/TycoonUpgradeable.sol";
import {TycoonUpgradeableLogic} from "../src/TycoonUpgradeableLogic.sol";

/// @title Deploy new TycoonUpgradeableLogic and set it on the proxy (e.g. after adding createWalletForExistingUser to the logic).
/// @notice Run with TYCOON_OWNER key. Requires .env: TYCOON_PROXY_ADDRESS.
contract UpgradeTycoonLogicScript is Script {
    function run() external {
        address proxyAddr = vm.envAddress("TYCOON_PROXY_ADDRESS");

        vm.startBroadcast();

        TycoonUpgradeableLogic newLogic = new TycoonUpgradeableLogic();
        console.log("New TycoonUpgradeableLogic:", address(newLogic));

        TycoonUpgradeable(payable(proxyAddr)).setLogicContract(address(newLogic));
        console.log("setLogicContract done. Proxy:", proxyAddr);

        vm.stopBroadcast();
    }
}
