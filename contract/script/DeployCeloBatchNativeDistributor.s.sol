// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {CeloBatchNativeDistributor} from "../src/CeloBatchNativeDistributor.sol";

/// @notice Deploy CeloBatchNativeDistributor. Set CELO_RPC_URL / --rpc-url for Celo.
/// forge script script/DeployCeloBatchNativeDistributor.s.sol:DeployCeloBatchNativeDistributor --rpc-url $CELO_RPC_URL --broadcast
contract DeployCeloBatchNativeDistributor is Script {
    function run() external {
        vm.startBroadcast();
        address deployed = address(new CeloBatchNativeDistributor());
        vm.stopBroadcast();
        console.log("CeloBatchNativeDistributor:", deployed);
    }
}
