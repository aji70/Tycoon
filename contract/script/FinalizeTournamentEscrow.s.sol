// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";

/// @notice TycoonTournamentEscrow — lock + finalize payouts (same tournament id as backend DB)
interface ITycoonTournamentEscrow {
    function lockTournament(uint256 tournamentId) external;
    function finalizeTournament(uint256 tournamentId, address[] calldata recipients, uint256[] calldata amounts)
        external;
    function tournaments(uint256 tournamentId)
        external
        view
        returns (
            uint256 entryFee,
            uint256 prizePoolDeposited,
            uint256 totalEntryFees,
            uint8 status,
            address creator
        );
}

/// @title Finalize tournament on TycoonTournamentEscrow (on-chain USDC payout)
/// @dev Sign with escrow **owner** or **backend** (same wallet that backend uses for escrow txs).
///
/// Env:
///   TOURNAMENT_ESCROW_ADDRESS — escrow proxy
///   TOURNAMENT_ID             — uint256, same as DB id (e.g. 42)
///   FINALIZE_RECIPIENT_COUNT — default 1; max 16
///   FINALIZE_RECIPIENT_0 .. FINALIZE_RECIPIENT_(n-1) — payee addresses (use players’ **smart wallet** if that is what the app uses)
///   FINALIZE_AMOUNT_WEI_0 .. FINALIZE_AMOUNT_WEI_(n-1) — USDC amounts, 6 decimals (e.g. 190000 = 0.19 USDC)
///
/// Sum of amounts must be <= (totalEntryFees + prizePoolDeposited) on-chain for this tournament.
/// Residual stays in escrow as pendingResidualUSDC until owner sweeps.
///
/// Run: ./run-finalize-tournament-escrow.sh   (or forge script ... --broadcast --private-key ...)
contract FinalizeTournamentEscrowScript is Script {
    uint8 internal constant STATUS_OPEN = 1;
    uint8 internal constant STATUS_LOCKED = 2;

    function run() external {
        address escrow = vm.envAddress("TOURNAMENT_ESCROW_ADDRESS");
        uint256 tid = vm.envUint("TOURNAMENT_ID");
        uint256 n = vm.envOr("FINALIZE_RECIPIENT_COUNT", uint256(1));
        require(n > 0 && n <= 16, "FINALIZE_RECIPIENT_COUNT must be 1..16");

        address[] memory recipients = new address[](n);
        uint256[] memory amounts = new uint256[](n);
        uint256 sum;
        for (uint256 i = 0; i < n; i++) {
            recipients[i] = vm.envAddress(string.concat("FINALIZE_RECIPIENT_", vm.toString(i)));
            amounts[i] = vm.envUint(string.concat("FINALIZE_AMOUNT_WEI_", vm.toString(i)));
            require(recipients[i] != address(0), "zero recipient");
            require(amounts[i] > 0, "zero amount");
            sum += amounts[i];
        }

        ITycoonTournamentEscrow t = ITycoonTournamentEscrow(escrow);
        (, uint256 prizePool, uint256 totalFees,,) = t.tournaments(tid);
        uint256 pool = totalFees + prizePool;

        console.log("Escrow:     ", escrow);
        console.log("Tournament: ", tid);
        console.log("On-chain pool (totalEntryFees + prizePoolDeposited):", pool);
        console.log("Payout sum: ", sum);
        require(sum <= pool, "payout sum exceeds on-chain pool");

        uint8 status;
        (,,, status,) = t.tournaments(tid);
        console.log("On-chain status (1=Open,2=Locked,3=Finalized,...):", status);

        vm.startBroadcast();
        if (status == STATUS_OPEN) {
            console.log("Calling lockTournament...");
            t.lockTournament(tid);
        } else if (status != STATUS_LOCKED) {
            revert("Tournament not Open or Locked; cannot finalize from this script");
        }

        console.log("Calling finalizeTournament...");
        t.finalizeTournament(tid, recipients, amounts);
        vm.stopBroadcast();

        console.log("Done. Check Payout events and pendingResidualUSDC on the explorer.");
    }
}
