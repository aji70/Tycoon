// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {TycoonTournamentEscrow} from "../src/legacy/TycoonTournamentEscrow.sol";

/// @title Deploy TycoonTournamentEscrow only (USDC + owner).
/// @notice Not upgradeable: new logic requires a new deployment and env updates.
/// @dev Env: TYCOON_OWNER, USDC_ADDRESS. Run via ../run-deploy-tournament-escrow.sh
contract DeployTournamentEscrowScript is Script {
    function run() external {
        address owner = vm.envAddress("TYCOON_OWNER");
        address usdc = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast();

        TycoonTournamentEscrow escrow = new TycoonTournamentEscrow(usdc, owner);
        console.log("TycoonTournamentEscrow:", address(escrow));

        vm.stopBroadcast();
    }
}
