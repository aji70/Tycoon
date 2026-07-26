// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {TycoonSoftPerkCatalog} from "../src/TycoonSoftPerkCatalog.sol";

/// @notice Deploy SoftPerk catalog pointing treasury at the EXISTING RewardSystem (no Reward redeploy).
/// Env: TYC_ADDRESS, USDC_ADDRESS, CUSDC_ADDRESS (opt), USDT_ADDRESS (opt),
///      TYCOON_REWARD_SYSTEM (treasury), TYCOON_OWNER, GAME_CONTROLLER (backend minter, opt)
contract DeploySoftPerkCatalogScript is Script {
    function run() external {
        address tyc = vm.envAddress("TYC_ADDRESS");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address cusdc = vm.envOr("CUSDC_ADDRESS", usdc);
        address usdt = vm.envOr("USDT_ADDRESS", usdc);
        address treasury = vm.envAddress("TYCOON_REWARD_SYSTEM");
        address owner = vm.envAddress("TYCOON_OWNER");
        address gameController = vm.envOr("GAME_CONTROLLER", address(0));

        // Optional seed: tip pack $0.05 USDC (6 decimals)
        bool seedTipPack = vm.envOr("SEED_TIP_PACK", true);
        uint256 tipPackUsdc = vm.envOr("TIP_PACK_USDC_UNITS", uint256(50_000));

        vm.startBroadcast();

        TycoonSoftPerkCatalog catalog =
            new TycoonSoftPerkCatalog(tyc, usdc, cusdc, usdt, treasury, owner);
        console.log("TycoonSoftPerkCatalog:", address(catalog));
        console.log("Treasury (existing RewardSystem):", treasury);

        if (gameController != address(0)) {
            catalog.setBackendMinter(gameController);
            console.log("setBackendMinter:", gameController);
        }

        if (seedTipPack) {
            bytes32 tipPackId = keccak256("ai_tip_pack_v1");
            catalog.setSoftPerk(tipPackId, 0, tipPackUsdc, 0, 0, true);
            console.log("Seeded ai_tip_pack_v1 usdcPrice:", tipPackUsdc);
            console.logBytes32(tipPackId);
        }

        vm.stopBroadcast();

        console.log("");
        console.log("Update backend/frontend env:");
        console.log("SOFT_PERK_CATALOG_ADDRESS=%s", address(catalog));
        console.log("(Do NOT change TYCOON_REWARD_SYSTEM - funds still settle there.)");
    }
}
