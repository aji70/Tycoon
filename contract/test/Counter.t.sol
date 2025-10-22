// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {Tycoon} from "../src/Tycoon.sol";
import {LootToken} from "../src/LootToken.sol";

contract DummyNFT {}

contract TycoonTest is Test {
    Tycoon public tycoon;
    LootToken public lootToken;
    address public owner = address(0x1);
    uint256 constant STAKE_AMOUNT = 1 * 10 ** 18;
    uint256 constant REWARD_AMOUNT = 15 * 10 ** 17; // 1.5 * 10**18, but wait, 150% of 1e18 = 1.5e18 = 15*10**17? No: 1.5e18 = 15*10**17 yes, but in code it's (1e18 * 150)/100 = 1.5e18

    function setUp() public {
        vm.prank(owner);
        lootToken = new LootToken(owner);
        DummyNFT dummyNFT = new DummyNFT();
        vm.prank(owner);
        tycoon = new Tycoon(address(lootToken), address(dummyNFT));

        vm.prank(owner);
        lootToken.mint(address(tycoon), 10000000000 * 10 ** 18); // Fund contract with tokens
        uint256 initialBalance = lootToken.balanceOf(address(tycoon));
        assertEq(initialBalance, 10000000000 * 10 ** 18);
    }

    function test_Register_Player() public {
        uint256 playerId = tycoon.registerPlayer("Alice");
        assertEq(playerId, 1);

        Tycoon.User memory user = tycoon.getUserById(playerId);

        // Check basic user fields
        assertEq(user.username, "Alice");
        assertEq(user.gamesPlayed, 0);
        assertEq(user.gamesWon, 0);
        assertEq(user.gamesLost, 0);
        assertEq(user.totalStaked, 0);
        assertEq(user.totalEarned, 0);
        assertEq(user.totalWithdrawn, 0);
        assertEq(user.id, playerId);

        // Check initial airdrop
        assertEq(lootToken.balanceOf(user.playerAddress), 10 * 10 ** 18);
    }

    function test_Create_Game() public {
        // First register a player
        uint256 playerId = tycoon.registerPlayer("Alice");
        Tycoon.User memory user = tycoon.getUserById(playerId);
        assertEq(user.username, "Alice");

        uint256 initialBalance = lootToken.balanceOf(user.playerAddress);

        // Create a game
        vm.prank(owner);
        uint256 gameId = tycoon.createGame(
            user.playerAddress,
            "PUBLIC",
            "hat",
            2,
            "GAME123",
            1500
        );

        Tycoon.Game memory game = tycoon.getGame(gameId);
        uint256 balAfter = lootToken.balanceOf(user.playerAddress);
        assertEq(game.id, gameId);
        assertEq(game.code, "GAME123");
        assertEq(game.creator, user.playerAddress);
        assertEq(uint8(game.status), uint8(Tycoon.GameStatus.Pending));
        assertEq(game.numberOfPlayers, 2);
        assertEq(uint8(game.mode), uint8(Tycoon.GameType.PublicGame));
        assertEq(game.joinedPlayers, 1);
        assertEq(game.totalStaked, STAKE_AMOUNT);

        assertEq(balAfter, initialBalance - STAKE_AMOUNT);

        // Check games played increased
        Tycoon.User memory updatedUser = tycoon.getUserById(playerId);
        assertEq(updatedUser.gamesPlayed, 1);
        assertEq(updatedUser.totalStaked, STAKE_AMOUNT);

        // Check creator's game player balance
        Tycoon.GamePlayer memory creatorPlayer = tycoon.getGamePlayer(gameId, user.playerAddress);
        assertEq(creatorPlayer.balance, 1500);
    }

    function test_Join_Game() public {
        uint256 player1Id = tycoon.registerPlayer("Alice");
        uint256 player2Id = tycoon.registerPlayer("Bob");

        Tycoon.User memory alice = tycoon.getUserById(player1Id);
        Tycoon.User memory bob = tycoon.getUserById(player2Id);

        vm.prank(owner);
        uint256 gameId = tycoon.createGame(alice.playerAddress, "PUBLIC", "hat", 2, "GAME123", 1500);

        uint256 balBefore = lootToken.balanceOf(bob.playerAddress);

        vm.prank(owner);
        uint8 order = tycoon.joinGame(gameId, bob.playerAddress, "car");

        Tycoon.Game memory game = tycoon.getGame(gameId);
        Tycoon.GamePlayer memory bobPlayer = tycoon.getGamePlayer(gameId, bob.playerAddress);

        // Check that Bob joined correctly
        assertEq(order, 2);
        assertEq(game.joinedPlayers, 2);
        assertEq(uint8(game.status), uint8(Tycoon.GameStatus.Ongoing));
        assertEq(bobPlayer.order, 2);
        assertEq(bobPlayer.balance, 1500);

        // Bob's balance decreased by 1 token (staked)
        uint256 balAfter = lootToken.balanceOf(bob.playerAddress);
        assertEq(balBefore - balAfter, STAKE_AMOUNT);

        // Check games played increased
        Tycoon.User memory updatedBob = tycoon.getUserById(player2Id);
        assertEq(updatedBob.gamesPlayed, 1);
        assertEq(updatedBob.totalStaked, STAKE_AMOUNT);

        // Check game totalStaked
        assertEq(game.totalStaked, 2 * STAKE_AMOUNT);
    }

    function test_Remove_Player_Finalizes_Game_With_Bonus() public {
        uint256 player1Id = tycoon.registerPlayer("Alice");
        uint256 player2Id = tycoon.registerPlayer("Bob");

        Tycoon.User memory alice = tycoon.getUserById(player1Id);
        Tycoon.User memory bob = tycoon.getUserById(player2Id);

        vm.prank(owner);
        uint256 gameId = tycoon.createGame(alice.playerAddress, "PUBLIC", "hat", 2, "GAME123", 1500);
        vm.prank(owner);
        tycoon.joinGame(gameId, bob.playerAddress, "car");

        Tycoon.Game memory gameBefore = tycoon.getGame(gameId);
        assertEq(uint8(gameBefore.status), uint8(Tycoon.GameStatus.Ongoing));

        uint256 bobBalBefore = lootToken.balanceOf(bob.playerAddress);
        uint256 bobEarnedBefore = tycoon.getUser(bob.playerAddress).totalEarned;

        // Remove Alice -> Bob should be winner with bonus (totalTurns >=40)
        vm.prank(owner);
        bool removed = tycoon.removePlayerFromGame(gameId, alice.playerAddress, bob.playerAddress, 50); // >40
        assertTrue(removed);

        Tycoon.Game memory gameAfter = tycoon.getGame(gameId);
        Tycoon.User memory bobUser = tycoon.getUser(bob.playerAddress);
        Tycoon.User memory aliceUser = tycoon.getUser(alice.playerAddress);

        assertEq(uint8(gameAfter.status), uint8(Tycoon.GameStatus.Ended));
        assertEq(gameAfter.winner, bob.playerAddress);
        assertEq(bobUser.gamesWon, 1);
        assertEq(aliceUser.gamesLost, 1);
        assertEq(bobUser.totalEarned, bobEarnedBefore + 1.5 * 10 ** 18); // 150% of stake

        // Check reward transferred
        uint256 bobBalAfter = lootToken.balanceOf(bob.playerAddress);
        assertEq(bobBalAfter, bobBalBefore + 1.5 * 10 ** 18);
    }

    function test_Remove_Player_Finalizes_Game_No_Bonus() public {
        uint256 player1Id = tycoon.registerPlayer("Alice");
        uint256 player2Id = tycoon.registerPlayer("Bob");

        Tycoon.User memory alice = tycoon.getUserById(player1Id);
        Tycoon.User memory bob = tycoon.getUserById(player2Id);

        vm.prank(owner);
        uint256 gameId = tycoon.createGame(alice.playerAddress, "PUBLIC", "hat", 2, "GAME123", 1500);
        vm.prank(owner);
        tycoon.joinGame(gameId, bob.playerAddress, "car");

        Tycoon.Game memory gameBefore = tycoon.getGame(gameId);
        assertEq(uint8(gameBefore.status), uint8(Tycoon.GameStatus.Ongoing));

        uint256 bobBalBefore = lootToken.balanceOf(bob.playerAddress);
        uint256 bobEarnedBefore = tycoon.getUser(bob.playerAddress).totalEarned;

        // Remove Alice -> Bob should be winner but no bonus (totalTurns <40)
        vm.prank(owner);
        bool removed = tycoon.removePlayerFromGame(gameId, alice.playerAddress, bob.playerAddress, 30); // <40
        assertTrue(removed);

        Tycoon.Game memory gameAfter = tycoon.getGame(gameId);
        Tycoon.User memory bobUser = tycoon.getUser(bob.playerAddress);
        Tycoon.User memory aliceUser = tycoon.getUser(alice.playerAddress);

        assertEq(uint8(gameAfter.status), uint8(Tycoon.GameStatus.Ended));
        assertEq(gameAfter.winner, bob.playerAddress);
        assertEq(bobUser.gamesWon, 1);
        assertEq(aliceUser.gamesLost, 1);
        assertEq(bobUser.totalEarned, bobEarnedBefore); // No reward added

        // Check no reward transferred
        uint256 bobBalAfter = lootToken.balanceOf(bob.playerAddress);
        assertEq(bobBalAfter, bobBalBefore); // No change
    }

    function test_Revert_Remove_Not_Paymaster() public {
        uint256 player1Id = tycoon.registerPlayer("Alice");
        uint256 player2Id = tycoon.registerPlayer("Bob");

        Tycoon.User memory alice = tycoon.getUserById(player1Id);
        Tycoon.User memory bob = tycoon.getUserById(player2Id);

        vm.prank(owner);
        uint256 gameId = tycoon.createGame(alice.playerAddress, "PUBLIC", "hat", 2, "GAME123", 1500);
        vm.prank(owner);
        tycoon.joinGame(gameId, bob.playerAddress, "car");

        // Revert if not paymaster
        vm.expectRevert(bytes("Not paymaster"));
        tycoon.removePlayerFromGame(gameId, alice.playerAddress, bob.playerAddress, 50);
    }

    function test_Revert_Update_Position_Not_Paymaster() public {
        uint256 player1Id = tycoon.registerPlayer("Alice");
        Tycoon.User memory alice = tycoon.getUserById(player1Id);

        vm.prank(owner);
        uint256 gameId = tycoon.createGame(alice.playerAddress, "PUBLIC", "hat", 2, "GAME123", 1500);

        // Revert if not paymaster
        vm.expectRevert(bytes("Not paymaster"));
        tycoon.updatePlayerPosition(gameId, alice.playerAddress, 5, 1400, 0);
    }

    function test_Revert_Empty_Username() public {
        vm.expectRevert(bytes("Username cannot be empty"));
        tycoon.registerPlayer("");
    }

    function test_Revert_Duplicate_Username() public {
        tycoon.registerPlayer("Alice");
        vm.expectRevert(bytes("Username taken"));
        tycoon.registerPlayer("Alice");
    }

    function test_Revert_Join_Full_Game() public {
        uint256 player1Id = tycoon.registerPlayer("Alice");
        uint256 player2Id = tycoon.registerPlayer("Bob");
        uint256 player3Id = tycoon.registerPlayer("Charlie");

        Tycoon.User memory alice = tycoon.getUserById(player1Id);
        Tycoon.User memory bob = tycoon.getUserById(player2Id);
        Tycoon.User memory charlie = tycoon.getUserById(player3Id);

        vm.prank(owner);
        uint256 gameId = tycoon.createGame(alice.playerAddress, "PUBLIC", "hat", 2, "GAME123", 1500);
        vm.prank(owner);
        tycoon.joinGame(gameId, bob.playerAddress, "car");

        vm.expectRevert(bytes("Game not open"));
        vm.prank(owner);
        tycoon.joinGame(gameId, charlie.playerAddress, "dog");
    }

    function test_Update_Player_Position_And_Property() public {
        // Register two players
        uint256 aliceId = tycoon.registerPlayer("Alice");
        Tycoon.User memory alice = tycoon.getUserById(aliceId);

        uint256 bobId = tycoon.registerPlayer("Bob");
        Tycoon.User memory bob = tycoon.getUserById(bobId);

        // Create a 2-player PUBLIC game
        vm.prank(owner);
        uint256 gameId = tycoon.createGame(
            alice.playerAddress,
            "PUBLIC",
            "hat",
            2,
            "GAME123",
            1500
        );

        // Join second player to start the game
        vm.prank(owner);
        tycoon.joinGame(gameId, bob.playerAddress, "car");

        // At this point, game.status should be Ongoing
        Tycoon.Game memory game = tycoon.getGame(gameId);
        assertEq(uint8(game.status), uint8(Tycoon.GameStatus.Ongoing));

        // Update Alice's position and balance
        uint8 newPosAlice = 5;
        uint256 newBalanceAlice = 1400;
        uint8 propertyId = 3;

        vm.prank(owner);
        bool updated = tycoon.updatePlayerPosition(
            gameId,
            alice.playerAddress,
            newPosAlice,
            newBalanceAlice,
            propertyId
        );
        assertTrue(updated);

        // Check Alice's state
        Tycoon.GamePlayer memory gpAlice = tycoon.getGamePlayer(gameId, alice.playerAddress);
        assertEq(gpAlice.position, newPosAlice);
        assertEq(gpAlice.balance, newBalanceAlice);

        // Check property ownership
        Tycoon.Property memory prop = tycoon.getProperty(gameId, propertyId);
        assertEq(prop.owner, alice.playerAddress);

        // Update Bob's position without property
        uint8 newPosBob = 8;
        uint256 newBalanceBob = 1300;

        vm.prank(owner);
        updated = tycoon.updatePlayerPosition(
            gameId,
            bob.playerAddress,
            newPosBob,
            newBalanceBob,
            0 // no property
        );
        assertTrue(updated);

        Tycoon.GamePlayer memory gpBob = tycoon.getGamePlayer(gameId, bob.playerAddress);
        assertEq(gpBob.position, newPosBob);
        assertEq(gpBob.balance, newBalanceBob);
    }

    function test_Revert_Remove_Player_Not_In_Game() public {
        uint256 player1Id = tycoon.registerPlayer("Alice");
        uint256 player2Id = tycoon.registerPlayer("Bob");

        Tycoon.User memory alice = tycoon.getUserById(player1Id);
        Tycoon.User memory bob = tycoon.getUserById(player2Id);

        vm.prank(owner);
        uint256 gameId = tycoon.createGame(alice.playerAddress, "PUBLIC", "hat", 2, "GAME123", 1500);
        vm.prank(owner);
        tycoon.joinGame(gameId, bob.playerAddress, "car");

        // Try remove non-player
        vm.expectRevert(bytes("Player not in game"));
        vm.prank(owner);
        tycoon.removePlayerFromGame(gameId, address(0x999), address(0), 50);
    }

    function test_Revert_Remove_Final_Phase_No_Candidate() public {
        uint256 player1Id = tycoon.registerPlayer("Alice");
        uint256 player2Id = tycoon.registerPlayer("Bob");

        Tycoon.User memory alice = tycoon.getUserById(player1Id);
        Tycoon.User memory bob = tycoon.getUserById(player2Id);

        vm.prank(owner);
        uint256 gameId = tycoon.createGame(alice.playerAddress, "PUBLIC", "hat", 2, "GAME123", 1500);
        vm.prank(owner);
        tycoon.joinGame(gameId, bob.playerAddress, "car");

        // Try remove without finalCandidate
        vm.expectRevert(bytes("Remaining player required"));
        vm.prank(owner);
        tycoon.removePlayerFromGame(gameId, alice.playerAddress, address(0), 50);
    }

    function test_Revert_Create_Invalid_Player_Count() public {
        uint256 playerId = tycoon.registerPlayer("Alice");
        Tycoon.User memory user = tycoon.getUserById(playerId);

        vm.prank(owner);
        vm.expectRevert(bytes("Invalid player count"));
        tycoon.createGame(user.playerAddress, "PUBLIC", "hat", 1, "GAME123", 1500);

        vm.prank(owner);
        vm.expectRevert(bytes("Invalid player count"));
        tycoon.createGame(user.playerAddress, "PUBLIC", "hat", 9, "GAME123", 1500);
    }
}