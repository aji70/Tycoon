// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {TycoonRewardSystem} from "../src/TycoonRewardSystem.sol";

/// @title Let the Tycoon proxy mint on TycoonRewardSystem (fixes "Not minter" on register)
/// @notice Sets backendMinter = proxy on the existing RewardSystem. Registration then works; faucet daily login will get "Not minter".
/// @dev Run with RewardSystem owner key. Requires .env: TYCOON_REWARD_SYSTEM, TYCOON_PROXY_ADDRESS.
contract SetRewardSystemMinterForGameScript is Script {
    function run() external {
        address rewardSystemAddr = vm.envAddress("TYCOON_REWARD_SYSTEM");
        address proxyAddr = vm.envAddress("TYCOON_PROXY_ADDRESS");

        vm.startBroadcast();

        TycoonRewardSystem(payable(rewardSystemAddr)).setBackendMinter(proxyAddr);
        console.log("setBackendMinter(proxy) done - registration will work");

        vm.stopBroadcast();
    }
}
