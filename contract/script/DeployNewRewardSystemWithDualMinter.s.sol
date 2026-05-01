// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {TycoonRewardSystem} from "../src/TycoonRewardSystem.sol";

/// @title Deploy a new TycoonRewardSystem with gameMinter support (faucet + game can both mint)
/// @notice Uses same TYC, USDC, owner as existing. Sets backendMinter=faucet, gameMinter=proxy.
///         Then run UpgradeGameRewardSystem.s.sol to point the game at this new address.
/// @dev Run with TYCOON_OWNER key. Requires .env: TYC_ADDRESS, USDC_ADDRESS, TYCOON_OWNER,
///      TYCOON_REWARDS_FAUCET_ADDRESS, TYCOON_PROXY_ADDRESS.
contract DeployNewRewardSystemWithDualMinterScript is Script {
    function run() external {
        address tyc = vm.envAddress("TYC_ADDRESS");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address cusdc = vm.envOr("CUSDC_ADDRESS", usdc);
        address usdt = vm.envOr("USDT_ADDRESS", usdc);
        address owner = vm.envAddress("TYCOON_OWNER");
        address rewardsFaucet = vm.envAddress("TYCOON_REWARDS_FAUCET_ADDRESS");
        address proxy = vm.envAddress("TYCOON_PROXY_ADDRESS");

        vm.startBroadcast();

        TycoonRewardSystem newRewardSystem = new TycoonRewardSystem(tyc, usdc, cusdc, usdt, owner);
        console.log("New TycoonRewardSystem:", address(newRewardSystem));

        newRewardSystem.setBackendMinter(rewardsFaucet);
        console.log("setBackendMinter(faucet) done");

        newRewardSystem.setGameMinter(proxy);
        console.log("setGameMinter(proxy) done");

        console.log("Add to .env: NEW_TYCOON_REWARD_SYSTEM=%s", address(newRewardSystem));

        vm.stopBroadcast();
    }
}
