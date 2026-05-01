// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {TycoonRewardSystem} from "../src/TycoonRewardSystem.sol";
import {TycoonUpgradeable} from "../src/TycoonUpgradeable.sol";

// Interfaces for existing contracts
interface ITycoonUserRegistry {
    function setRewardSystem(address _rewardSystem) external;
}

contract DeployAndConfigureRewardSystemScript is Script {
    function run() external {
        address tyc = vm.envAddress("TYC_ADDRESS");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address cusdc = vm.envOr("CUSDC_ADDRESS", usdc);
        address usdt = vm.envOr("USDT_ADDRESS", usdc);
        address owner = vm.envAddress("TYCOON_OWNER");
        address proxy = vm.envAddress("TYCOON_PROXY_ADDRESS");
        address gameController = vm.envAddress("GAME_CONTROLLER");
        
        vm.startBroadcast();

        // 1. Deploy the new reward system
        TycoonRewardSystem newRewardSystem = new TycoonRewardSystem(tyc, usdc, cusdc, usdt, owner);
        console.log("Deployed new TycoonRewardSystem at:", address(newRewardSystem));

        // 2. Configure Minters (Backend + Game)
        newRewardSystem.setBackendMinter(gameController);
        console.log("setBackendMinter to GAME_CONTROLLER (%s) done", gameController);

        newRewardSystem.setGameMinter(proxy);
        console.log("setGameMinter to PROXY (%s) done", proxy);

        // Backend controller also acts as voucher redeemer so server can redeem
        // smart-wallet-owned vouchers without user wallet connection.
        newRewardSystem.setVoucherRedeemer(gameController, true);
        console.log("setVoucherRedeemer to GAME_CONTROLLER (%s) done", gameController);

        // 3. Point proxy to the new Reward System
        TycoonUpgradeable(payable(proxy)).setRewardSystem(address(newRewardSystem));
        console.log("Updated proxy with setRewardSystem done");

        // 4. Update the User Registry's reward system reference
        address registry = vm.envOr("TYCOON_USER_REGISTRY_ADDRESS", address(0));
        if (registry != address(0)) {
            try ITycoonUserRegistry(registry).setRewardSystem(address(newRewardSystem)) {
                console.log("Updated UserRegistry with setRewardSystem done");
            } catch {
                console.log("Skipping UserRegistry RewardSystem - may not have permission or unsupported.");
            }
        }

        console.log("");
        console.log("SUCCESS! Please update your .env with:");
        console.log("NEW_TYCOON_REWARD_SYSTEM=%s", address(newRewardSystem));
        console.log("TYCOON_REWARD_SYSTEM=%s", address(newRewardSystem));

        vm.stopBroadcast();
    }
}
