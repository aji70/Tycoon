// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {TycoonUpgradeable} from "../src/TycoonUpgradeable.sol";

/// @title Create a smart wallet in the User Registry for an already-registered game player
/// @notice Use when a player registered before the User Registry was set and has no smart wallet. Run with TYCOON_OWNER key.
/// @dev Requires .env: TYCOON_PROXY_ADDRESS, PLAYER_ADDRESS (the wallet to backfill, e.g. 0xE870b4814Ec306B88F77833cd6c98Eb388A30cbc).
contract CreateWalletForExistingUserScript is Script {
    function run() external {
        address proxy = vm.envAddress("TYCOON_PROXY_ADDRESS");
        address player = vm.envAddress("PLAYER_ADDRESS");

        vm.startBroadcast();

        address wallet = TycoonUpgradeable(payable(proxy)).createWalletForExistingUser(player);
        console.log("Smart wallet created for player %s: %s", player, wallet);

        vm.stopBroadcast();
    }
}
