// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {Tycoon} from "../src/Tycoon.sol";
import {TycoonLib} from "../src/TycoonLib.sol";

contract TycoonTest is Test {
    Tycoon public tycoon;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");

    function setUp() public {
        tycoon = new Tycoon();
    }

    function test_Register_Player() public {
        vm.prank(alice);
        uint256 playerId = tycoon.registerPlayer("Alice");
        assertEq(playerId, 1);

        TycoonLib.User memory user = tycoon.getUser("Alice");

        // Check basic user fields
        assertEq(user.username, "Alice");
        assertEq(user.playerAddress, alice);
        assertEq(user.gamesPlayed, 0);
        assertEq(user.gamesWon, 0);
        assertEq(user.gamesLost, 0);
        assertEq(user.id, playerId);
    }

    function test_Create_Game() public {
        // First register a player
        vm.prank(alice);
        uint256 playerId = tycoon.registerPlayer("Alice");
        TycoonLib.User memory user = tycoon.getUser("Alice");
        assertEq(user.username, "Alice");

        // Create a game
        vm.prank(alice);
        uint256 gameId = tycoon.createGame("Alice", "PUBLIC", "hat", 2, "GAME123", 1500);

        TycoonLib.Game memory game = tycoon.getGame(gameId);
        assertEq(game.id, gameId);
        assertEq(game.code, "GAME123");
        assertEq(game.creator, alice);
        assertEq(uint8(game.status), uint8(TycoonLib.GameStatus.Pending));
        assertEq(game.nextPlayer, 1);
        assertEq(game.winner, address(0));
        assertEq(game.numberOfPlayers, 2);
        assertEq(game.joinedPlayers, 1);
        assertEq(uint8(game.mode), uint8(TycoonLib.GameType.PublicGame));
        assertEq(game.ai, false);

        // Check games played increased
        TycoonLib.User memory updatedUser = tycoon.getUser("Alice");
        assertEq(updatedUser.gamesPlayed, 1);

        // Check creator's game player balance
        TycoonLib.GamePlayer memory creatorPlayer = tycoon.getGamePlayer(gameId, "Alice");
        assertEq(creatorPlayer.gameId, gameId);
        assertEq(creatorPlayer.playerAddress, alice);
        assertEq(creatorPlayer.balance, 1500);
        assertEq(creatorPlayer.position, 0);
        assertEq(creatorPlayer.order, 1);
        assertEq(uint8(creatorPlayer.symbol), uint8(TycoonLib.PlayerSymbol.Hat));
        assertEq(keccak256(bytes(creatorPlayer.username)), keccak256(bytes("Alice")));
    }

    function test_Join_Game() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame("Alice", "PUBLIC", "hat", 2, "GAME123", 1500);

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(bob);
        uint8 order = tycoon.joinGame(gameId, "Bob", "car", "");

        TycoonLib.Game memory game = tycoon.getGame(gameId);
        TycoonLib.GamePlayer memory bobPlayer = tycoon.getGamePlayer(gameId, "Bob");

        // Check that Bob joined correctly
        assertEq(order, 2);
        assertEq(game.joinedPlayers, 2);
        assertEq(uint8(game.status), uint8(TycoonLib.GameStatus.Ongoing));
        assertEq(bobPlayer.order, 2);
        assertEq(bobPlayer.balance, 1500);
        assertEq(bobPlayer.position, 0);
        assertEq(uint8(bobPlayer.symbol), uint8(TycoonLib.PlayerSymbol.Car));
        assertEq(keccak256(bytes(bobPlayer.username)), keccak256(bytes("Bob")));

        // Check games played increased
        TycoonLib.User memory updatedBob = tycoon.getUser("Bob");
        assertEq(updatedBob.gamesPlayed, 1);
    }

    function test_Remove_Player_Finalizes_Game() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame("Alice", "PUBLIC", "hat", 2, "GAME123", 1500);
        vm.prank(bob);
        tycoon.joinGame(gameId, "Bob", "car", "");

        TycoonLib.Game memory gameBefore = tycoon.getGame(gameId);
        assertEq(uint8(gameBefore.status), uint8(TycoonLib.GameStatus.Ongoing));

        // Remove Alice -> Bob should be winner
        vm.prank(alice); // Self-remove or creator
        bool removed = tycoon.removePlayerFromGame(gameId, "Alice", "Bob");
        assertTrue(removed);

        TycoonLib.Game memory gameAfter = tycoon.getGame(gameId);
        TycoonLib.User memory bobUser = tycoon.getUser("Bob");
        TycoonLib.User memory aliceUser = tycoon.getUser("Alice");

        assertEq(uint8(gameAfter.status), uint8(TycoonLib.GameStatus.Ended));
        assertEq(gameAfter.winner, bob);
        assertEq(gameAfter.endedAt, uint64(block.timestamp));
        assertEq(bobUser.gamesWon, 1);
        assertEq(aliceUser.gamesLost, 1);
    }

    function test_Revert_Unauthorized_Remove() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame("Alice", "PUBLIC", "hat", 2, "GAME123", 1500);
        vm.prank(bob);
        tycoon.joinGame(gameId, "Bob", "car", "");

        // Revert if not player or creator
        vm.prank(charlie);
        vm.expectRevert(bytes("Unauthorized removal"));
        tycoon.removePlayerFromGame(gameId, "Alice", "Bob");
    }

    function test_Revert_Update_Position_Not_Registered() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame("Alice", "PUBLIC", "hat", 2, "GAME123", 1500);

        // Revert if not registered
        vm.prank(charlie);
        vm.expectRevert(bytes("not registered"));
        tycoon.updatePlayerPosition(gameId, 5, 1400, 0, 1, 1);
    }

    function test_Revert_Empty_Username() public {
        vm.expectRevert(bytes("Username cannot be empty"));
        tycoon.registerPlayer("");
    }

    function test_Revert_Duplicate_Username() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");
        vm.prank(alice);
        vm.expectRevert(bytes("Username taken"));
        tycoon.registerPlayer("Alice");
    }

    function test_Revert_Join_Full_Game() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(charlie);
        tycoon.registerPlayer("Charlie");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame("Alice", "PUBLIC", "hat", 2, "GAME123", 1500);
        vm.prank(bob);
        tycoon.joinGame(gameId, "Bob", "car", "");

        // After full, status Ongoing, so revert on "Game not open"
        vm.prank(charlie);
        vm.expectRevert(bytes("Game not open"));
        tycoon.joinGame(gameId, "Charlie", "dog", "");
    }

    function test_Update_Player_Position_And_Property() public {
        // Register two players
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        // Create a 2-player PUBLIC game
        vm.prank(alice);
        uint256 gameId = tycoon.createGame("Alice", "PUBLIC", "hat", 2, "GAME123", 1500);

        // Join second player to start the game
        vm.prank(bob);
        tycoon.joinGame(gameId, "Bob", "car", "");

        // At this point, game.status should be Ongoing, nextPlayer=1 (Alice's turn)
        TycoonLib.Game memory game = tycoon.getGame(gameId);
        assertEq(uint8(game.status), uint8(TycoonLib.GameStatus.Ongoing));

        // Update Alice's position and balance (dice 3+4=7, but pos=5 for test)
        uint8 newPosAlice = 5;
        uint256 newBalanceAlice = 1400;
        uint8 propertyId = 3;
        uint256 die1 = 3;
        uint256 die2 = 4;

        vm.prank(alice);
        bool updated = tycoon.updatePlayerPosition(gameId, newPosAlice, newBalanceAlice, propertyId, die1, die2);
        assertTrue(updated);

        // Check Alice's state
        TycoonLib.GamePlayer memory gpAlice = tycoon.getGamePlayer(gameId, "Alice");
        assertEq(gpAlice.position, newPosAlice);
        assertEq(gpAlice.balance, newBalanceAlice);

        // Check property ownership
        TycoonLib.Property memory prop = tycoon.getProperty(gameId, propertyId);
        assertEq(prop.id, propertyId);
        assertEq(prop.gameId, gameId);
        assertEq(prop.owner, alice);

        // Check turn advanced to 2 (Bob)
        game = tycoon.getGame(gameId);
        assertEq(game.nextPlayer, 2);

        // Update Bob's position without property (now Bob's turn)
        uint8 newPosBob = 8;
        uint256 newBalanceBob = 1300;
        uint256 die1Bob = 2;
        uint256 die2Bob = 6;

        vm.prank(bob);
        updated = tycoon.updatePlayerPosition(gameId, newPosBob, newBalanceBob, 0, die1Bob, die2Bob);
        assertTrue(updated);

        TycoonLib.GamePlayer memory gpBob = tycoon.getGamePlayer(gameId, "Bob");
        assertEq(gpBob.position, newPosBob);
        assertEq(gpBob.balance, newBalanceBob);

        // Check turn advanced back to 1
        game = tycoon.getGame(gameId);
        assertEq(game.nextPlayer, 1);
    }

    function test_Revert_Remove_Player_Not_In_Game() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(charlie);
        tycoon.registerPlayer("Charlie");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame("Alice", "PUBLIC", "hat", 2, "GAME123", 1500);
        vm.prank(bob);
        tycoon.joinGame(gameId, "Bob", "car", "");

        // Try remove non-player (Charlie is registered but not in game)
        vm.prank(alice);
        vm.expectRevert(bytes("Player not in game"));
        tycoon.removePlayerFromGame(gameId, "Charlie", "Bob");
    }

    function test_Revert_Remove_Final_Phase_No_Candidate() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame("Alice", "PUBLIC", "hat", 2, "GAME123", 1500);
        vm.prank(bob);
        tycoon.joinGame(gameId, "Bob", "car", "");

        // Try remove without finalCandidate
        vm.prank(alice);
        vm.expectRevert(bytes("Remaining player required"));
        tycoon.removePlayerFromGame(gameId, "Alice", "");
    }

    function test_Revert_Create_Invalid_Player_Count() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        vm.expectRevert(bytes("Invalid player count"));
        tycoon.createGame("Alice", "PUBLIC", "hat", 1, "GAME123", 1500);

        vm.prank(alice);
        vm.expectRevert(bytes("Invalid player count"));
        tycoon.createGame("Alice", "PUBLIC", "hat", 9, "GAME123", 1500);
    }

    function test_GetUser() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");
        TycoonLib.User memory userByName = tycoon.getUser("Alice");
        assertEq(userByName.username, "Alice");

        vm.expectRevert(bytes("User not registered"));
        tycoon.getUser("NonExistent");
    }

    // Bonus: Test invalid game type/symbol reverts
    function test_Revert_Invalid_GameType() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        vm.expectRevert(bytes("Invalid game type"));
        tycoon.createGame("Alice", "INVALID", "hat", 2, "GAME123", 1500);
    }

    function test_Revert_Invalid_PlayerSymbol() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        vm.expectRevert(bytes("Invalid player symbol"));
        tycoon.createGame("Alice", "PUBLIC", "invalid", 2, "GAME123", 1500);
    }

    function test_Revert_Join_Invalid_Symbol() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame("Alice", "PUBLIC", "hat", 2, "GAME123", 1500);

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(bob);
        vm.expectRevert(bytes("Invalid player symbol"));
        tycoon.joinGame(gameId, "Bob", "invalid", "");
    }

    function test_Revert_Join_Wrong_Username() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame("Alice", "PUBLIC", "hat", 2, "GAME123", 1500);

        // Bob not registered
        vm.prank(bob);
        vm.expectRevert(bytes("User not registered"));
        tycoon.joinGame(gameId, "Bob", "car", "");

        // Wrong username for caller
        vm.prank(bob);
        tycoon.registerPlayer("Bob");
        vm.prank(bob);
        vm.expectRevert(bytes("Must use own username"));
        tycoon.joinGame(gameId, "Alice", "car", "");
    }

    function test_Revert_Update_Not_Current_Player() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame("Alice", "PUBLIC", "hat", 2, "GAME123", 1500);
        vm.prank(bob);
        tycoon.joinGame(gameId, "Bob", "car", "");

        // Bob tries first (not turn)
        vm.prank(bob);
        vm.expectRevert(bytes("Not your turn"));
        tycoon.updatePlayerPosition(gameId, 5, 1400, 0, 1, 1);
    }

    function test_Revert_Update_Invalid_Dice() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame("Alice", "PUBLIC", "hat", 2, "GAME123", 1500);
        vm.prank(bob);
        tycoon.registerPlayer("Bob");
        vm.prank(bob);
        tycoon.joinGame(gameId, "Bob", "car", "");

        // Invalid dice
        vm.prank(alice);
        vm.expectRevert(bytes("Invalid dice"));
        tycoon.updatePlayerPosition(gameId, 5, 1400, 0, 0, 1); // die1=0 invalid
    }

    function test_Create_AIGame() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createAIGame("Alice", "PUBLIC", "hat", 1, "GAME123", 1500); // 1 AI, total 2 players

        TycoonLib.Game memory game = tycoon.getGame(gameId);
        assertEq(game.id, gameId);
        assertEq(game.creator, alice);
        assertEq(uint8(game.status), uint8(TycoonLib.GameStatus.Ongoing));
        assertEq(game.numberOfPlayers, 2);
        assertEq(game.joinedPlayers, 1);
        assertEq(game.ai, true);

        TycoonLib.User memory updatedUser = tycoon.getUser("Alice");
        assertEq(updatedUser.gamesPlayed, 1);

        TycoonLib.GamePlayer memory creatorPlayer = tycoon.getGamePlayer(gameId, "Alice");
        assertEq(creatorPlayer.balance, 1500);
    }

    function test_End_AIGame() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createAIGame("Alice", "PUBLIC", "hat", 1, "GAME123", 1500);

        uint8 finalPos = 10;
        uint256 finalBal = 2000;
        uint8 finalProp = 5;

        vm.prank(alice);
        bool ended = tycoon.endAIGame(gameId, finalPos, finalBal, finalProp);
        assertTrue(ended);

        TycoonLib.Game memory game = tycoon.getGame(gameId);
        assertEq(uint8(game.status), uint8(TycoonLib.GameStatus.Ended));
        assertEq(game.winner, alice);

        TycoonLib.GamePlayer memory gp = tycoon.getGamePlayer(gameId, "Alice");
        assertEq(gp.position, finalPos);
        assertEq(gp.balance, finalBal);

        TycoonLib.Property memory prop = tycoon.getProperty(gameId, finalProp);
        assertEq(prop.owner, alice);

        TycoonLib.User memory user = tycoon.getUser("Alice");
        assertEq(user.gamesWon, 1);
    }

    function test_Revert_End_AIGame_Not_Creator() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createAIGame("Alice", "PUBLIC", "hat", 1, "GAME123", 1500);

        vm.prank(bob);
        vm.expectRevert(bytes("Only creator can end AI game"));
        tycoon.endAIGame(gameId, 10, 2000, 5);
    }

    function test_Revert_Join_AI_Game() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createAIGame("Alice", "PUBLIC", "hat", 1, "GAME123", 1500);

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(bob);
        vm.expectRevert(bytes("Cannot join AI game"));
        tycoon.joinGame(gameId, "Bob", "car", "");
    }
}