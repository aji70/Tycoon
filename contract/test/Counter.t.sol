// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {Blockopoly} from "../src/monopoly.sol";
import {LootToken} from "../src/LootToken.sol";
import {Looters} from "../src/NFT.sol";

contract BlockopolyTest is Test {
    Blockopoly public blockopoly;
    LootToken public lootToken;
    Looters public lootersNft;
    address public owner = address(0x1);

    function setUp() public {
        vm.prank(owner);
        lootToken = new LootToken(owner);
        vm.prank(owner);
        lootersNft = new Looters(owner);
        blockopoly = new Blockopoly(address(lootToken), address(lootersNft));

        vm.prank(owner);
        lootToken.mint(address(blockopoly), 10000000000 * 10 ** 18); // Fund contract with tokens
        uint256 initialBalance = lootToken.balanceOf(address(blockopoly));
        assertEq(initialBalance, 10000000000 * 10 ** 18);
    }

    function test_Register_Player() public {
        uint256 playerId = blockopoly.registerPlayer("Alice");
        assertEq(playerId, 1);

        Blockopoly.User memory user = blockopoly.getUserById(playerId);

        // Check basic user fields
        assertEq(user.username, "Alice");
        assertEq(user.gamesPlayed, 0);
        assertEq(user.gamesWon, 0);
        assertEq(user.gamesLost, 0);
        assertEq(user.totalStaked, 0);
        assertEq(user.totalEarned, 0);
        assertEq(user.totalWithdrawn, 0);
        // Ensure address and id match expected
        assertEq(user.playerAddress, address(this));
        assertEq(user.id, playerId);
    }

    function test_Create_Game() public {
        // First register a player (msg.sender)
        uint256 playerId = blockopoly.registerPlayer("Alice");
        Blockopoly.User memory user = blockopoly.getUserById(playerId);
        assertEq(user.username, "Alice");

        uint256 initialBalance = lootToken.balanceOf(user.wallet);

        // Create a game: PUBLIC game type, choose symbol "hat" (lowercase expected by contract),
        // with 2 players, and a code "GAME123", starting balance 1500
        uint256 gameId = blockopoly.createGame(
            "PUBLIC", // game type (case-sensitive in helper)
            "hat", // player symbol must be lowercase per _stringToPlayerSymbol
            2, // numberOfPlayers
            "GAME123",
            1500
        );

        Blockopoly.Game memory game = blockopoly.getGame(gameId);
        uint256 balAfter = lootToken.balanceOf(user.wallet);
        assertEq(game.id, gameId);
        assertEq(game.code, "GAME123");
        assertEq(game.creator, address(this));
        assertEq(uint8(game.status), uint8(Blockopoly.GameStatus.Pending));
        assertEq(game.numberOfPlayers, 2);
        assertEq(uint8(game.mode), uint8(Blockopoly.GameType.PublicGame));
        // joinedPlayers should be 1 because creator auto-joins

        assertEq(balAfter, initialBalance - 1 * 10 ** 18);
        assertEq(game.joinedPlayers, 1);
    }
}
