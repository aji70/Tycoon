// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {TycoonUpgradeable} from "../src/TycoonUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title Upgrade the game proxy to new impl (with setRewardSystem) and point it at the new RewardSystem
/// @notice Run after DeployNewRewardSystemWithDualMinter.s.sol. Set NEW_TYCOON_REWARD_SYSTEM in .env to the logged address.
/// @dev Run with TYCOON_OWNER key. Requires .env: TYCOON_PROXY_ADDRESS, NEW_TYCOON_REWARD_SYSTEM.
contract UpgradeGameRewardSystemScript is Script {
    function run() external {
        address proxyAddr = vm.envAddress("TYCOON_PROXY_ADDRESS");
        address newRewardSystemAddr = vm.envAddress("NEW_TYCOON_REWARD_SYSTEM");

        vm.startBroadcast();

        TycoonUpgradeable newImpl = new TycoonUpgradeable();
        console.log("New TycoonUpgradeable impl:", address(newImpl));

        UUPSUpgradeable(proxyAddr).upgradeToAndCall(address(newImpl), "");
        console.log("Proxy upgraded to new impl");

        TycoonUpgradeable(payable(proxyAddr)).setRewardSystem(newRewardSystemAddr);
        console.log("setRewardSystem(%s) done", newRewardSystemAddr);

        vm.stopBroadcast();
    }
}
