// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {TycoonRewardSystem} from "../src/TycoonRewardSystem.sol";
import {TycoonUpgradeable} from "../src/TycoonUpgradeable.sol";
import {TycoonRewardsFaucet} from "../src/legacy/TycoonRewardsFaucet.sol";
import {TycoonGameFaucet} from "../src/legacy/TycoonGameFaucet.sol";

/// @title Deploy all faucets (TycoonRewardsFaucet + TycoonGameFaucet) and wire them
/// @notice Requires .env: TYCOON_OWNER, TYCOON_REWARD_SYSTEM, TYCOON_PROXY_ADDRESS. Optional: GAME_CONTROLLER (defaults to owner).
/// @dev Run with --private-key for TYCOON_OWNER so setBackendMinter/setGameFaucet succeed.
contract DeployFaucetsScript is Script {
    function run() external {
        address owner = vm.envAddress("TYCOON_OWNER");
        address rewardSystem = vm.envAddress("TYCOON_REWARD_SYSTEM");
        address proxy = vm.envAddress("TYCOON_PROXY_ADDRESS");
        address gameController = vm.envOr("GAME_CONTROLLER", owner);

        vm.startBroadcast();

        TycoonRewardsFaucet rewardsFaucet = new TycoonRewardsFaucet(rewardSystem, owner);
        console.log("TycoonRewardsFaucet:", address(rewardsFaucet));
        TycoonRewardSystem(payable(rewardSystem)).setBackendMinter(address(rewardsFaucet));
        console.log("setBackendMinter done");

        TycoonGameFaucet gameFaucet = new TycoonGameFaucet(proxy, gameController, owner);
        console.log("TycoonGameFaucet:", address(gameFaucet));
        TycoonUpgradeable(payable(proxy)).setGameFaucet(address(gameFaucet));
        TycoonUpgradeable(payable(proxy)).setBackendGameController(gameController);
        console.log("setGameFaucet and setBackendGameController done");

        vm.stopBroadcast();
    }
}
