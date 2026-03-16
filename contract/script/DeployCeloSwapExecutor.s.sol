// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {CeloSwapExecutor} from "../src/legacy/CeloSwapExecutor.sol";

/// @title Deploy CeloSwapExecutor for in-app CELO→USDC swap (smart wallet sends CELO here, receives USDC back).
/// @notice Run on Celo. Set in frontend as NEXT_PUBLIC_CELO_SWAP_EXECUTOR_ADDRESS.
///
/// Default Celo mainnet:
///   UbeswapRouter V2: 0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121
///   WCELO:            0x471EcE3750Da237f93B8E339c536989b8978a438
///   USDC:             0x765DE816845861e75A25fCA122bb6898B8B1282a
///
/// Optional .env: SWAP_EXECUTOR_ROUTER, SWAP_EXECUTOR_WCELO, SWAP_EXECUTOR_USDC
contract DeployCeloSwapExecutorScript is Script {
    function run() external {
        address router = vm.envOr("SWAP_EXECUTOR_ROUTER", address(0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121));
        address wcelo = vm.envOr("SWAP_EXECUTOR_WCELO", address(0x471EcE3750Da237f93B8E339c536989b8978a438));
        address usdc = vm.envOr("SWAP_EXECUTOR_USDC", address(0x765DE816845861e75A25fCA122bb6898B8B1282a));

        vm.startBroadcast();
        CeloSwapExecutor executor = new CeloSwapExecutor(router, wcelo, usdc);
        console.log("CeloSwapExecutor:", address(executor));
        vm.stopBroadcast();
    }
}
