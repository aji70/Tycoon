// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {TycoonNairaVault} from "../src/legacy/TycoonNairaVault.sol";

/// @title Deploy only TycoonNairaVault (e.g. to use a different USDC token than the original vault).
/// @notice Set in .env: TYCOON_OWNER, USDC_ADDRESS. Optional: NAIRA_VAULT_CONTROLLER (defaults to GAME_CONTROLLER or owner).
/// @dev Use this when your USDC is 0xcebA9300f2b948710d2653dD7B07f33A8B32118C (Celo) and the existing vault was deployed with 0x765DE... — deploy a new vault with USDC_ADDRESS=0xcebA... then set NEXT_PUBLIC_CELO_NAIRA_VAULT and registry nairaVault to the new address.
contract DeployNairaVaultScript is Script {
    function run() external {
        address owner = vm.envAddress("TYCOON_OWNER");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address nairaController = vm.envOr("NAIRA_VAULT_CONTROLLER", vm.envOr("GAME_CONTROLLER", owner));

        vm.startBroadcast();

        TycoonNairaVault nairaVault = new TycoonNairaVault(usdc, nairaController, owner);
        console.log("TycoonNairaVault:", address(nairaVault));

        vm.stopBroadcast();
    }
}
