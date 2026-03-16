// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {CeloSwapExecutor} from "../src/legacy/CeloSwapExecutor.sol";

/// @title Deploy CeloSwapExecutor for in-app CELO→USDC swap (smart wallet sends CELO here, receives USDC back).
/// @notice Run on Celo. Use run-deploy-celo-swap-executor.sh (loads contract/.env).
/// Set in frontend as NEXT_PUBLIC_CELO_SWAP_EXECUTOR_ADDRESS.
///
/// .env (contract/.env):
///   RPC_URL, PRIVATE_KEY  (required for broadcast; run script sources these)
///   USDC_ADDRESS          (optional; used as USDC token for the swap path)
/// Optional overrides: SWAP_EXECUTOR_ROUTER, SWAP_EXECUTOR_WCELO, SWAP_EXECUTOR_USDC
contract DeployCeloSwapExecutorScript is Script {
    address constant DEFAULT_ROUTER = 0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121;
    address constant DEFAULT_WCELO = 0x471EcE3750Da237f93B8E339c536989b8978a438;
    address constant DEFAULT_USDC = 0x765DE816845861e75A25fCA122bb6898B8B1282a;

    function run() external {
        address router = vm.envOr("SWAP_EXECUTOR_ROUTER", DEFAULT_ROUTER);
        address wcelo = vm.envOr("SWAP_EXECUTOR_WCELO", DEFAULT_WCELO);
        address usdc = vm.envOr("SWAP_EXECUTOR_USDC", vm.envOr("USDC_ADDRESS", DEFAULT_USDC));

        vm.startBroadcast();
        CeloSwapExecutor executor = new CeloSwapExecutor(router, wcelo, usdc);
        console.log("CeloSwapExecutor:", address(executor));
        vm.stopBroadcast();
    }
}
