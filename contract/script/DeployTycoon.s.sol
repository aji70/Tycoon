// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {TycoonUpgradeable} from "../src/TycoonUpgradeable.sol";
import {TycoonUpgradeableLogic} from "../src/TycoonUpgradeableLogic.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title Deploy Tycoon (logic + implementation + proxy)
/// @notice Run with: forge script script/DeployTycoon.s.sol --rpc-url <RPC> --broadcast --private-key <OWNER_KEY>
/// @dev The wallet you pass to --private-key MUST be the same as TYCOON_OWNER (proxy owner). Otherwise setLogicContract reverts (onlyOwner).
contract DeployTycoonScript is Script {
    function run() external {
        address owner = vm.envAddress("TYCOON_OWNER");
        address rewardSystem = vm.envAddress("TYCOON_REWARD_SYSTEM");

        vm.startBroadcast();
        // Signer (--private-key) must equal TYCOON_OWNER so the final setLogicContract call succeeds.

        // Deploy logic contract (delegatecall target; required for Celo size limit)
        TycoonUpgradeableLogic logic = new TycoonUpgradeableLogic();
        console.log("TycoonUpgradeableLogic:", address(logic));

        // Deploy implementation
        TycoonUpgradeable impl = new TycoonUpgradeable();
        console.log("TycoonUpgradeable impl:", address(impl));

        // Deploy proxy and initialize
        bytes memory initData = abi.encodeCall(TycoonUpgradeable.initialize, (owner, rewardSystem));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        console.log("Game proxy (use this address):", address(proxy));

        // Wire logic into proxy (required so createGame/joinGame/exitGame etc. work)
        TycoonUpgradeable(payable(address(proxy))).setLogicContract(address(logic));
        console.log("setLogicContract done");

        vm.stopBroadcast();
    }
}
