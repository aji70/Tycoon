// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";

/// @notice Minimal ABI for TycoonTournamentEscrow.setBackend
interface ITycoonTournamentEscrow {
    function setBackend(address newBackend) external;
    function backend() external view returns (address);
}

/// @title Set tournament escrow backend to the game-controller wallet
/// @dev Run with the escrow owner key via forge --private-key.
///      Backend address is passed as BACKEND_ADDRESS (shell sets from game controller PK).
contract SetTournamentEscrowBackendScript is Script {
    function run() external {
        address escrow = vm.envAddress("TOURNAMENT_ESCROW_ADDRESS");
        address newBackend = vm.envAddress("BACKEND_ADDRESS");
        require(newBackend != address(0), "BACKEND_ADDRESS required");

        address previous = ITycoonTournamentEscrow(escrow).backend();
        console.log("Escrow:", escrow);
        console.log("Previous backend:", previous);
        console.log("New backend:     ", newBackend);

        vm.startBroadcast();
        ITycoonTournamentEscrow(escrow).setBackend(newBackend);
        vm.stopBroadcast();

        console.log("setBackend transaction submitted. Verify with escrow.backend() on a block explorer.");
    }
}
