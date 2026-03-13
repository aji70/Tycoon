// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {TycoonNairaVault} from "../src/legacy/TycoonNairaVault.sol";
import {TycoonAIAgentRegistry} from "../src/legacy/TycoonAIAgent.sol";
import {TycoonTournamentEscrow} from "../src/legacy/TycoonTournamentEscrow.sol";
import {TycoonNft} from "../src/legacy/TycoonNFT.sol";

/// @title Deploy all optional contracts: NairaVault, AIAgentRegistry, TournamentEscrow, NFT
/// @notice Requires .env: TYCOON_OWNER, USDC_ADDRESS. Optional: NAIRA_VAULT_CONTROLLER (defaults to GAME_CONTROLLER or owner).
/// @dev Run with --private-key for TYCOON_OWNER.
contract DeployOptionalScript is Script {
    function run() external {
        address owner = vm.envAddress("TYCOON_OWNER");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address nairaController = vm.envOr("NAIRA_VAULT_CONTROLLER", vm.envOr("GAME_CONTROLLER", owner));

        vm.startBroadcast();

        TycoonNairaVault nairaVault = new TycoonNairaVault(usdc, nairaController, owner);
        console.log("TycoonNairaVault:", address(nairaVault));

        TycoonAIAgentRegistry aiRegistry = new TycoonAIAgentRegistry(owner);
        console.log("TycoonAIAgentRegistry:", address(aiRegistry));

        TycoonTournamentEscrow tournamentEscrow = new TycoonTournamentEscrow(usdc, owner);
        console.log("TycoonTournamentEscrow:", address(tournamentEscrow));

        TycoonNft nft = new TycoonNft(owner);
        console.log("TycoonNFT:", address(nft));

        vm.stopBroadcast();
    }
}
