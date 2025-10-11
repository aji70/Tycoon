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
        // assertEq(user.playerAddress, address(this));
        assertEq(user.id, playerId);
    }

    function test_Create_Game() public {
        // First register a player (msg.sender)
        uint256 playerId = blockopoly.registerPlayer("Alice");
        Blockopoly.User memory user = blockopoly.getUserById(playerId);
        assertEq(user.username, "Alice");

        uint256 initialBalance = lootToken.balanceOf(user.playerAddress);

        // Create a game: PUBLIC game type, choose symbol "hat" (lowercase expected by contract),
        // with 2 players, and a code "GAME123", starting balance 1500
        uint256 gameId = blockopoly.createGame(
            user.playerAddress,
            "PUBLIC", // game type (case-sensitive in helper)
            "hat", // player symbol must be lowercase per _stringToPlayerSymbol
            2, // numberOfPlayers
            "GAME123",
            1500
        );

        Blockopoly.Game memory game = blockopoly.getGame(gameId);
        uint256 balAfter = lootToken.balanceOf(user.playerAddress);
        assertEq(game.id, gameId);
        assertEq(game.code, "GAME123");
        assertEq(game.creator, user.playerAddress, "Creator address mismatch");
        assertEq(uint8(game.status), uint8(Blockopoly.GameStatus.Pending));
        assertEq(game.numberOfPlayers, 2);
        assertEq(uint8(game.mode), uint8(Blockopoly.GameType.PublicGame));
        // joinedPlayers should be 1 because creator auto-joins

        assertEq(balAfter, initialBalance - 1 * 10 ** 18);
        assertEq(game.joinedPlayers, 1);
    }

    function test_Join_Game() public {
        uint256 player1Id = blockopoly.registerPlayer("Alice");
        uint256 player2Id = blockopoly.registerPlayer("Bob");

        Blockopoly.User memory alice = blockopoly.getUserById(player1Id);
        Blockopoly.User memory bob = blockopoly.getUserById(player2Id);

        uint256 gameId = blockopoly.createGame(alice.playerAddress, "PUBLIC", "hat", 2, "GAME123", 1500);

        uint256 balBefore = lootToken.balanceOf(bob.playerAddress);

        uint8 order = blockopoly.joinGame(gameId, bob.playerAddress, "car");

        Blockopoly.Game memory game = blockopoly.getGame(gameId);
        Blockopoly.GamePlayer memory bobPlayer = blockopoly.getGamePlayer(gameId, bob.playerAddress);

        // Check that Bob joined correctly
        assertEq(order, 2);
        assertEq(game.joinedPlayers, 2);
        assertEq(uint8(game.status), uint8(Blockopoly.GameStatus.Ongoing)); // game should start now
        assertEq(bobPlayer.order, 2);

        // Bob's balance decreased by 1 token (staked)
        uint256 balAfter = lootToken.balanceOf(bob.playerAddress);
        assertEq(balBefore - balAfter, 1 * 10 ** 18);
    }

    function test_Remove_Player_Finalizes_Game() public {
        uint256 player1Id = blockopoly.registerPlayer("Alice");
        uint256 player2Id = blockopoly.registerPlayer("Bob");

        Blockopoly.User memory alice = blockopoly.getUserById(player1Id);
        Blockopoly.User memory bob = blockopoly.getUserById(player2Id);

        uint256 gameId = blockopoly.createGame(alice.playerAddress, "PUBLIC", "hat", 2, "GAME123", 1500);
        blockopoly.joinGame(gameId, bob.playerAddress, "car");

        Blockopoly.Game memory gameBefore = blockopoly.getGame(gameId);
        assertEq(uint8(gameBefore.status), uint8(Blockopoly.GameStatus.Ongoing));

        // Remove Alice -> Bob should be winner
        bool removed = blockopoly.removePlayerFromGame(gameId, alice.playerAddress, bob.playerAddress);
        assertTrue(removed);

        Blockopoly.Game memory gameAfter = blockopoly.getGame(gameId);
        Blockopoly.User memory bobUser = blockopoly.getUser(bob.playerAddress);

        assertEq(uint8(gameAfter.status), uint8(Blockopoly.GameStatus.Ended));
        assertEq(gameAfter.winner, bob.playerAddress);
        assertEq(bobUser.gamesWon, 1);
    }

    function test_Revert_Empty_Username() public {
        vm.expectRevert(bytes("Username cannot be empty"));
        blockopoly.registerPlayer("");
    }

    function test_Revert_Duplicate_Username() public {
        blockopoly.registerPlayer("Alice");
        vm.expectRevert(bytes("Username taken"));
        blockopoly.registerPlayer("Alice");
    }

    function test_Revert_Join_Full_Game() public {
        uint256 player1Id = blockopoly.registerPlayer("Alice");
        uint256 player2Id = blockopoly.registerPlayer("Bob");
        uint256 player3Id = blockopoly.registerPlayer("Charlie");

        Blockopoly.User memory alice = blockopoly.getUserById(player1Id);
        Blockopoly.User memory bob = blockopoly.getUserById(player2Id);
        Blockopoly.User memory charlie = blockopoly.getUserById(player3Id);

        uint256 gameId = blockopoly.createGame(alice.playerAddress, "PUBLIC", "hat", 2, "GAME123", 1500);
        blockopoly.joinGame(gameId, bob.playerAddress, "car");

        vm.expectRevert(bytes("Game not open"));
        blockopoly.joinGame(gameId, charlie.playerAddress, "dog");

    }

     function test_Update_Player_Position_And_Property() public {
        // Register two players
        uint256 aliceId = blockopoly.registerPlayer("Alice");
        Blockopoly.User memory alice = blockopoly.getUserById(aliceId);

        uint256 bobId = blockopoly.registerPlayer("Bob");
        Blockopoly.User memory bob = blockopoly.getUserById(bobId);

        // Create a 2-player PUBLIC game
        uint256 gameId = blockopoly.createGame(
            alice.playerAddress,
            "PUBLIC",
            "hat",
            2,
            "GAME123",
            1500
        );

        // Join second player to start the game
        blockopoly.joinGame(gameId, bob.playerAddress, "car");

        // At this point, game.status should be Ongoing
        Blockopoly.Game memory game = blockopoly.getGame(gameId);
        assertEq(uint8(game.status), uint8(Blockopoly.GameStatus.Ongoing));

        // Update Alice's position and balance
        uint8 newPosAlice = 5;
        uint256 newBalanceAlice = 1400;
        uint8 propertyId = 3;

        bool updated = blockopoly.updatePlayerPosition(
            gameId,
            alice.playerAddress,
            newPosAlice,
            newBalanceAlice,
            propertyId
        );
        assertTrue(updated);

        // Check Alice's state
        Blockopoly.GamePlayer memory gpAlice = blockopoly.getGamePlayer(gameId, alice.playerAddress);
        assertEq(gpAlice.position, newPosAlice);
        assertEq(gpAlice.balance, newBalanceAlice);

        // Check property ownership
        Blockopoly.Property memory prop = blockopoly.getProperty(gameId, propertyId);
        assertEq(prop.owner, alice.playerAddress);

        // Update Bob's position without property
        uint8 newPosBob = 8;
        uint256 newBalanceBob = 1300;

        updated = blockopoly.updatePlayerPosition(
            gameId,
            bob.playerAddress,
            newPosBob,
            newBalanceBob,
            0 // no property
        );
        assertTrue(updated);

        Blockopoly.GamePlayer memory gpBob = blockopoly.getGamePlayer(gameId, bob.playerAddress);
        assertEq(gpBob.position, newPosBob);
        assertEq(gpBob.balance, newBalanceBob);
    }
}
