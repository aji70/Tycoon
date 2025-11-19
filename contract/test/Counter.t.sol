// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, console} from "forge-std/Test.sol";
import {Tycoon} from "../src/Tycoon.sol";
import {TycoonLib} from "../src/TycoonLib.sol";

contract TycoonTest is Test {
    Tycoon public tycoon;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");
    address public owner = makeAddr("owner");

    uint256 public constant STAKE_AMOUNT = 1 * 10**14;
    uint256 public constant STARTING_BALANCE = 1500;
    string public constant GAME_CODE = "GAME123";
    uint256 public constant BOARD_SIZE = 40; // Assumed from TycoonLib

    function setUp() public {
        tycoon = new Tycoon(owner);
        // Fund players for stakes
        deal(alice, 10 ether);
        deal(bob, 10 ether);
        deal(charlie, 10 ether);
        deal(owner, 10 ether);
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
        assertTrue(tycoon.registered(alice));
        assertEq(tycoon.totalUsers(), 1);
    }

    function test_Revert_Empty_Username() public {
        vm.prank(alice);
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

    function test_Revert_Already_Registered() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");
        vm.prank(alice);
        vm.expectRevert(bytes("already registered"));
        tycoon.registerPlayer("Alice2");
    }

    function test_GetUser_Revert_Not_Registered() public {
        vm.expectRevert(bytes("User not registered"));
        tycoon.getUser("NonExistent");
    }

    function test_Create_Game() public {
        // First register a player
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        // Create a game
        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);

        TycoonLib.Game memory game = tycoon.getGame(gameId);
        assertEq(game.id, gameId);
        assertEq(game.code, GAME_CODE);
        assertEq(game.creator, alice);
        assertEq(uint8(game.status), uint8(TycoonLib.GameStatus.Pending));
        assertEq(game.nextPlayer, 1);
        assertEq(game.winner, address(0));
        assertEq(game.numberOfPlayers, 2);
        assertEq(game.joinedPlayers, 1);
        assertEq(uint8(game.mode), uint8(TycoonLib.GameType.PublicGame));
        assertEq(game.ai, false);
        assertEq(game.totalStaked, STAKE_AMOUNT);

        // Check games played increased
        TycoonLib.User memory updatedUser = tycoon.getUser("Alice");
        assertEq(updatedUser.gamesPlayed, 1);
        assertEq(updatedUser.totalStaked, STAKE_AMOUNT);

        // Check creator's game player balance
        TycoonLib.GamePlayer memory creatorPlayer = tycoon.getGamePlayer(gameId, "Alice");
        assertEq(creatorPlayer.gameId, gameId);
        assertEq(creatorPlayer.playerAddress, alice);
        assertEq(creatorPlayer.balance, STARTING_BALANCE);
        assertEq(creatorPlayer.position, 0);
        assertEq(creatorPlayer.order, 1);
        assertEq(uint8(creatorPlayer.symbol), uint8(TycoonLib.PlayerSymbol.Hat));
        assertEq(keccak256(bytes(creatorPlayer.username)), keccak256(bytes("Alice")));

        // Check game settings
        TycoonLib.GameSettings memory settings = tycoon.getGameSettings(gameId);
        assertEq(settings.maxPlayers, 2);
        assertTrue(settings.auction);
        assertTrue(settings.rentInPrison);
        assertTrue(settings.mortgage);
        assertTrue(settings.evenBuild);
        assertEq(settings.startingCash, STARTING_BALANCE);
        assertEq(settings.privateRoomCode, GAME_CODE);

        assertEq(tycoon.totalGames(), 1);
    }

    function test_Revert_Create_Invalid_Stake() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        vm.expectRevert(bytes("Incorrect stake amount"));
        tycoon.createGame{value: STAKE_AMOUNT + 1}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);
    }

    function test_Revert_Create_Invalid_Player_Count() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        vm.expectRevert(bytes("Invalid player count"));
        tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 1, GAME_CODE, STARTING_BALANCE);

        vm.prank(alice);
        vm.expectRevert(bytes("Invalid player count"));
        tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 9, GAME_CODE, STARTING_BALANCE);
    }

    function test_Revert_Create_Invalid_Game_Type() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        vm.expectRevert(bytes("Invalid game type"));
        tycoon.createGame{value: STAKE_AMOUNT}("Alice", "INVALID", "hat", 2, GAME_CODE, STARTING_BALANCE);
    }

    function test_Revert_Create_Invalid_Player_Symbol() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        vm.expectRevert(bytes("Invalid player symbol"));
        tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "invalid", 2, GAME_CODE, STARTING_BALANCE);
    }

    function test_Revert_Create_User_Not_Registered() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice2");

        vm.prank(alice);
        vm.expectRevert(bytes("User not registered"));
        tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);
    }

    function test_Revert_Create_Wrong_Username() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bobster");

        vm.prank(bob);
        vm.expectRevert(bytes("Must use own username"));
        tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);
    }

    function test_Revert_Create_Private_No_Code() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        vm.expectRevert(bytes("Private code required"));
        tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PRIVATE", "hat", 2, "", STARTING_BALANCE);
    }

    function test_Create_Private_Game() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PRIVATE", "hat", 2, GAME_CODE, STARTING_BALANCE);

        TycoonLib.Game memory game = tycoon.getGame(gameId);
        assertEq(uint8(game.mode), uint8(TycoonLib.GameType.PrivateGame));
    }

    function test_Join_Game() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(bob);
        uint8 order = tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "car", "");

        TycoonLib.Game memory game = tycoon.getGame(gameId);
        TycoonLib.GamePlayer memory bobPlayer = tycoon.getGamePlayer(gameId, "Bob");

        // Check that Bob joined correctly
        assertEq(order, 2);
        assertEq(game.joinedPlayers, 2);
        assertEq(uint8(game.status), uint8(TycoonLib.GameStatus.Ongoing));
        assertEq(bobPlayer.order, 2);
        assertEq(bobPlayer.balance, STARTING_BALANCE);
        assertEq(bobPlayer.position, 0);
        assertEq(uint8(bobPlayer.symbol), uint8(TycoonLib.PlayerSymbol.Car));
        assertEq(keccak256(bytes(bobPlayer.username)), keccak256(bytes("Bob")));

        // Check games played increased
        TycoonLib.User memory updatedBob = tycoon.getUser("Bob");
        assertEq(updatedBob.gamesPlayed, 1);
        assertEq(updatedBob.totalStaked, STAKE_AMOUNT);

        // Check total staked
        assertEq(game.totalStaked, 2 * STAKE_AMOUNT);

        // Check order mapping
        assertEq(tycoon.gameOrderToPlayer(gameId, 1), alice);
        assertEq(tycoon.gameOrderToPlayer(gameId, 2), bob);
    }

    function test_Revert_Join_Invalid_Stake() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(bob);
        vm.expectRevert(bytes("Incorrect stake amount"));
        tycoon.joinGame{value: STAKE_AMOUNT + 1}(gameId, "Bob", "car", "");
    }

    function test_Revert_Join_Not_Registered() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);

        vm.prank(bob);
        tycoon.registerPlayer("Bobster");

        vm.prank(bob);
        vm.expectRevert(bytes("User not registered"));
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "car", "");
    }

    function test_Revert_Join_Wrong_Username() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(bob);
        vm.expectRevert(bytes("Must use own username"));
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Alice", "car", "");
    }

    function test_Revert_Join_Already_Joined() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 3, GAME_CODE, STARTING_BALANCE);

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(bob);
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "car", "");

        vm.prank(bob);
        vm.expectRevert(bytes("Already joined"));
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "dog", "");
    }


    function test_Revert_Join_Not_Open() public {
        // Game full -> Ongoing
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);
        vm.prank(bob);
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "car", "");

        vm.prank(charlie);
        tycoon.registerPlayer("Charlie");

        vm.prank(charlie);
        vm.expectRevert(bytes("Game not open"));
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Charlie", "dog", "");
    }

    function test_Revert_Join_Invalid_Symbol() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(bob);
        vm.expectRevert(bytes("Invalid player symbol"));
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "invalid", "");
    }

    function test_Revert_Join_Private_Invalid_Code() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PRIVATE", "hat", 2, GAME_CODE, STARTING_BALANCE);

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(bob);
        vm.expectRevert(bytes("Invalid private code"));
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "car", "WRONG");
    }

    function test_Join_Private_Valid_Code() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PRIVATE", "hat", 2, GAME_CODE, STARTING_BALANCE);

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(bob);
        uint8 order = tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "car", GAME_CODE);
        assertEq(order, 2);
    }

    function test_Revert_Join_AI_Game() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createAIGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 1, GAME_CODE, STARTING_BALANCE);

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(bob);
        vm.expectRevert(bytes("Cannot join AI game"));
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "car", "");
    }

    function test_Create_AIGame() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createAIGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 1, GAME_CODE, STARTING_BALANCE); // 1 AI, total 2

        TycoonLib.Game memory game = tycoon.getGame(gameId);
        assertEq(game.id, gameId);
        assertEq(game.creator, alice);
        assertEq(uint8(game.status), uint8(TycoonLib.GameStatus.Ongoing));
        assertEq(game.numberOfPlayers, 2);
        assertEq(game.joinedPlayers, 1);
        assertEq(game.ai, true);
        assertEq(game.totalStaked, STAKE_AMOUNT);

        TycoonLib.User memory updatedUser = tycoon.getUser("Alice");
        assertEq(updatedUser.gamesPlayed, 1);
        assertEq(updatedUser.totalStaked, STAKE_AMOUNT);

        TycoonLib.GamePlayer memory creatorPlayer = tycoon.getGamePlayer(gameId, "Alice");
        assertEq(creatorPlayer.balance, STARTING_BALANCE);
        assertEq(creatorPlayer.order, 1);
        assertEq(uint8(creatorPlayer.symbol), uint8(TycoonLib.PlayerSymbol.Hat));

        // Check dummy AI
        address dummyAI = address(uint160(2));
        TycoonLib.GamePlayer memory aiPlayer = tycoon.getGamePlayerByAddress(gameId, dummyAI);
        assertEq(aiPlayer.order, 2);
        assertEq(aiPlayer.balance, STARTING_BALANCE);
        assertEq(keccak256(bytes(aiPlayer.username)), keccak256(bytes("AI_2")));

        assertEq(tycoon.gameOrderToPlayer(gameId, 2), dummyAI);
    }

    function test_Revert_Create_AIGame_Invalid_Count() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        vm.expectRevert(bytes("Invalid AI count: 1-7"));
        tycoon.createAIGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 0, GAME_CODE, STARTING_BALANCE);

        vm.prank(alice);
        vm.expectRevert(bytes("Invalid AI count: 1-7"));
        tycoon.createAIGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 8, GAME_CODE, STARTING_BALANCE);
    }

    function test_Revert_Create_AIGame_Invalid_Stake() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        vm.expectRevert(bytes("Incorrect stake amount"));
        tycoon.createAIGame{value: STAKE_AMOUNT + 1}("Alice", "PUBLIC", "hat", 1, GAME_CODE, STARTING_BALANCE);
    }

    function test_End_AIGame_Win() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createAIGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 1, GAME_CODE, STARTING_BALANCE);

        uint8 finalPos = 10;
        uint256 finalBal = 2000; // Within cap
        uint8 finalProp = 5;

        uint256 aliceBalBefore = alice.balance;

        vm.prank(alice);
        bool ended = tycoon.endAIGame(gameId, finalPos, finalBal, finalProp, true);
        assertTrue(ended);

        TycoonLib.Game memory game = tycoon.getGame(gameId);
        assertEq(uint8(game.status), uint8(TycoonLib.GameStatus.Ended));
        assertEq(game.winner, alice);
        assertEq(game.endedAt, uint64(block.timestamp));
        assertEq(game.totalStaked, 0);

        TycoonLib.GamePlayer memory gp = tycoon.getGamePlayer(gameId, "Alice");
        assertEq(gp.position, finalPos);
        assertEq(gp.balance, finalBal);

        TycoonLib.Property memory prop = tycoon.getProperty(gameId, finalProp);
        assertEq(prop.owner, alice);

        TycoonLib.User memory user = tycoon.getUser("Alice");
        assertEq(user.gamesWon, 1);
        assertEq(user.totalEarned, STAKE_AMOUNT);

        // Check refund
        assertEq(alice.balance, aliceBalBefore + STAKE_AMOUNT);

        // Event emitted (can check with expectEmit if needed)
    }

    function test_End_AIGame_Loss() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createAIGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 1, GAME_CODE, STARTING_BALANCE);

        uint256 houseBefore = tycoon.houseBalance();

        vm.prank(alice);
        bool ended = tycoon.endAIGame(gameId, 10, 1000, 0, false);
        assertTrue(ended);

        TycoonLib.Game memory game = tycoon.getGame(gameId);
        assertEq(uint8(game.status), uint8(TycoonLib.GameStatus.Ended));
        assertEq(game.winner, address(0));
        assertEq(game.totalStaked, 0);

        TycoonLib.User memory user = tycoon.getUser("Alice");
        assertEq(user.gamesLost, 1);

        assertEq(tycoon.houseBalance(), houseBefore + STAKE_AMOUNT);
    }

    function test_Revert_End_AIGame_Not_AI() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);

        vm.prank(alice);
        vm.expectRevert(bytes("Not an AI game"));
        tycoon.endAIGame(gameId, 10, 2000, 5, true);
    }

    function test_Revert_End_AIGame_Already_Ended() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createAIGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 1, GAME_CODE, STARTING_BALANCE);

        vm.prank(alice);
        tycoon.endAIGame(gameId, 10, 2000, 5, true);

        vm.prank(alice);
        vm.expectRevert(bytes("Game already ended"));
        tycoon.endAIGame(gameId, 15, 1500, 6, true);
    }

    function test_Revert_End_AIGame_Not_Creator() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createAIGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 1, GAME_CODE, STARTING_BALANCE);

        address dummyAI = address(uint160(2));
        vm.prank(dummyAI);
        vm.expectRevert(bytes("Only creator can end AI game"));
        tycoon.endAIGame(gameId, 10, 2000, 5, true);
    }

    function test_Revert_End_AIGame_Invalid_Position() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createAIGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 1, GAME_CODE, STARTING_BALANCE);

        vm.prank(alice);
        vm.expectRevert(bytes("Invalid final position"));
        tycoon.endAIGame(gameId, uint8(BOARD_SIZE), 2000, 5, true);
    }

    function test_Revert_End_AIGame_Invalid_Balance() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createAIGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 1, GAME_CODE, STARTING_BALANCE);

        vm.prank(alice);
        vm.expectRevert(bytes("Invalid final balance"));
        tycoon.endAIGame(gameId, 10, STARTING_BALANCE * 3, 5, true);
    }

    function test_Revert_End_AIGame_Not_In_Game() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createAIGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 1, GAME_CODE, STARTING_BALANCE);

        vm.prank(bob);
        vm.expectRevert(bytes("Not in game"));
        tycoon.endAIGame(gameId, 10, 2000, 5, true);
    }

    function test_Remove_Player() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);
        vm.prank(bob);
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "car", "");

        TycoonLib.Game memory gameBefore = tycoon.getGame(gameId);
        assertEq(uint8(gameBefore.status), uint8(TycoonLib.GameStatus.Ongoing));
        assertEq(gameBefore.joinedPlayers, 2);

        // Alice removes self
        vm.prank(alice);
        bool removed = tycoon.removePlayerFromGame(gameId, alice);
        assertTrue(removed);

        TycoonLib.Game memory gameAfter = tycoon.getGame(gameId);
        TycoonLib.User memory bobUser = tycoon.getUser("Bob");
        TycoonLib.User memory aliceUser = tycoon.getUser("Alice");

        // Game auto-ends with Bob as winner
        assertEq(uint8(gameAfter.status), uint8(TycoonLib.GameStatus.Ended));
        assertEq(gameAfter.winner, bob);
        assertEq(gameAfter.endedAt, uint64(block.timestamp));
        assertEq(gameAfter.joinedPlayers, 1); // Still 1, but ended
        assertEq(bobUser.gamesWon, 1);
        assertEq(aliceUser.gamesLost, 1);

        // Player mappings cleared for Alice
        TycoonLib.GamePlayer memory removedPlayer = tycoon.getGamePlayerByAddress(gameId, alice);
        assertEq(removedPlayer.playerAddress, address(0));
        assertEq(tycoon.gameOrderToPlayer(gameId, 1), address(0));
    }

    function test_Remove_Player_Not_Final() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(charlie);
        tycoon.registerPlayer("Charlie");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 3, GAME_CODE, STARTING_BALANCE);
        vm.prank(bob);
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "car", "");
        vm.prank(charlie);
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Charlie", "dog", "");

        // Remove Bob (non-final)
        vm.prank(bob);
        bool removed = tycoon.removePlayerFromGame(gameId, bob);
        assertTrue(removed);

        TycoonLib.Game memory gameAfter = tycoon.getGame(gameId);
        assertEq(uint8(gameAfter.status), uint8(TycoonLib.GameStatus.Ongoing)); // Still ongoing
        assertEq(gameAfter.joinedPlayers, 2);
        assertEq(gameAfter.winner, address(0));

        TycoonLib.User memory bobUser = tycoon.getUser("Bob");
        assertEq(bobUser.gamesLost, 1);

        // Order cleared
        assertEq(tycoon.gameOrderToPlayer(gameId, 2), address(0));
    }

    function test_Revert_Remove_Unauthorized() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(charlie);
        tycoon.registerPlayer("Charlie");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);
        vm.prank(bob);
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "car", "");

        vm.prank(charlie);
        vm.expectRevert(bytes("Unauthorized removal"));
        tycoon.removePlayerFromGame(gameId, alice);
    }

    function test_Revert_Remove_Not_In_Game() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);
        vm.prank(bob);
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "car", "");

        vm.prank(alice);
        vm.expectRevert(bytes("Player not in game"));
        tycoon.removePlayerFromGame(gameId, charlie);
    }

    function test_Revert_Remove_Not_Ongoing() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);

        vm.prank(alice);
        vm.expectRevert(bytes("Game not ongoing"));
        tycoon.removePlayerFromGame(gameId, alice);
    }

    function test_Revert_Remove_From_AI() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createAIGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 1, GAME_CODE, STARTING_BALANCE);

        vm.prank(alice);
        vm.expectRevert(bytes("Cannot remove from AI game"));
        tycoon.removePlayerFromGame(gameId, alice);
    }

    function test_Claim_Reward() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);
        vm.prank(bob);
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "car", "");

        uint256 houseBefore = tycoon.houseBalance();

        // Remove Alice, Bob wins
        vm.prank(alice);
        tycoon.removePlayerFromGame(gameId, alice);

        // Bob claims
        uint256 bobBalBefore = bob.balance;
        vm.prank(bob);
        uint256 reward = tycoon.claimReward(gameId);
        uint256 expectedReward = STAKE_AMOUNT + (STAKE_AMOUNT / 2); // 1.5 * STAKE
        uint256 expectedHouseCut = STAKE_AMOUNT / 2;

        assertEq(reward, expectedReward);
        assertEq(tycoon.houseBalance(), houseBefore + expectedHouseCut);
        assertEq(bob.balance, bobBalBefore + expectedReward);

        TycoonLib.User memory bobUser = tycoon.getUser("Bob");
        assertEq(bobUser.totalEarned, expectedReward);
        assertEq(bobUser.gamesWon, 1); // From remove

        // totalStaked cleared
        TycoonLib.Game memory game = tycoon.getGame(gameId);
        assertEq(game.totalStaked, 0);

        // Revert if claim again
        vm.prank(bob);
        vm.expectRevert(bytes("Min 2 players required"));
        tycoon.claimReward(gameId);
    }

    function test_Revert_Claim_Not_Winner() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);
        vm.prank(bob);
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "car", "");

        vm.prank(alice);
        tycoon.removePlayerFromGame(gameId, alice); // Bob wins

        vm.prank(alice);
        vm.expectRevert(bytes("Not in game"));
        tycoon.claimReward(gameId);
    }

    function test_Revert_Claim_Not_Ended() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);
        vm.prank(bob);
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "car", "");

        vm.prank(bob);
        vm.expectRevert(bytes("Game not ended"));
        tycoon.claimReward(gameId);
    }

    function test_Revert_Claim_AI() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createAIGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 1, GAME_CODE, STARTING_BALANCE);

        vm.prank(alice);
        tycoon.endAIGame(gameId, 10, 2000, 0, true);

        vm.prank(alice);
        vm.expectRevert(bytes("Use endAIGame for AI rewards"));
        tycoon.claimReward(gameId);
    }

    function test_Revert_Claim_Not_In_Game() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);

        vm.prank(bob);
        vm.expectRevert(bytes("Not in game"));
        tycoon.claimReward(gameId);
    }

    function test_Update_Player_Position_Single_Property() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);
        vm.prank(bob);
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "car", "");

        // Alice's turn (nextPlayer=1)
        uint8 newPos = 5;
        int256 delta = -100; // Paid rent or something
        uint256 newBal = STARTING_BALANCE + uint256(delta < 0 ? -delta : delta);
        if (delta < 0) newBal = STARTING_BALANCE - uint256(-delta);
        uint8[] memory props = new uint8[](1);
        props[0] = 3;

        vm.prank(alice);
        bool updated = tycoon.updatePlayerPosition(gameId, alice, newPos, newBal, delta, props);
        assertTrue(updated);

        // Check state
        TycoonLib.GamePlayer memory gpAlice = tycoon.getGamePlayer(gameId, "Alice");
        assertEq(gpAlice.position, newPos);
        assertEq(gpAlice.balance, newBal);

        TycoonLib.Property memory prop = tycoon.getProperty(gameId, 3);
        assertEq(prop.owner, alice);

        TycoonLib.Game memory game = tycoon.getGame(gameId);
        assertEq(game.nextPlayer, 2); // Advanced to Bob
    }

    function test_Update_Player_Position_Multiple_Properties() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);
        vm.prank(bob);
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "car", "");

        uint8 newPos = 10;
        int256 delta = -200;
        uint256 newBal = STARTING_BALANCE + uint256(delta < 0 ? -delta : delta);
        if (delta < 0) newBal = STARTING_BALANCE - uint256(-delta);
        uint8[] memory props = new uint8[](2);
        props[0] = 4;
        props[1] = 6;

        vm.prank(alice);
        bool updated = tycoon.updatePlayerPosition(gameId, alice, newPos, newBal, delta, props);
        assertTrue(updated);

        TycoonLib.Property memory prop1 = tycoon.getProperty(gameId, 4);
        TycoonLib.Property memory prop2 = tycoon.getProperty(gameId, 6);
        assertEq(prop1.owner, alice);
        assertEq(prop2.owner, alice);
    }

    function test_Update_Player_Position_No_Property() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);
        vm.prank(bob);
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "car", "");

        uint8 newPos = 7;
        int256 delta = 0;
        uint256 newBal = STARTING_BALANCE + uint256(delta < 0 ? -delta : delta);
        if (delta < 0) newBal = STARTING_BALANCE - uint256(-delta);
        uint8[] memory props = new uint8[](0);

        vm.prank(alice);
        bool updated = tycoon.updatePlayerPosition(gameId, alice, newPos, newBal, delta, props);
        assertTrue(updated);

        TycoonLib.GamePlayer memory gp = tycoon.getGamePlayer(gameId, "Alice");
        assertEq(gp.position, newPos);
        assertEq(gp.balance, newBal);

        // No props changed
    }

    function test_Revert_Update_Not_Registered() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);
        vm.prank(bob);
        tycoon.registerPlayer("Bob");
        vm.prank(bob);
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "car", "");

        int256 delta = -100;
        uint256 newBal = STARTING_BALANCE + uint256(delta < 0 ? -delta : delta);
        if (delta < 0) newBal = STARTING_BALANCE - uint256(-delta);
        uint8[] memory props = new uint8[](0);

        vm.prank(charlie);
        vm.expectRevert(bytes("not registered"));
        tycoon.updatePlayerPosition(gameId, alice, 5, newBal, delta, props);
    }

    function test_Revert_Update_Not_Current_Player() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);
        vm.prank(bob);
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "car", "");

        int256 delta = -100;
        uint256 newBal = STARTING_BALANCE + uint256(delta < 0 ? -delta : delta);
        if (delta < 0) newBal = STARTING_BALANCE - uint256(-delta);
        uint8[] memory props = new uint8[](0);

        // Bob tries first (Alice's turn)
        vm.prank(bob);
        vm.expectRevert(bytes("Not your turn"));
        tycoon.updatePlayerPosition(gameId, bob, 5, newBal, delta, props);
    }

    function test_Revert_Update_Invalid_Balance_Delta() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);
        vm.prank(bob);
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "car", "");

        // Mismatch newBal != old + delta
        int256 delta = -100;
        uint256 wrongNewBal = STARTING_BALANCE + 50; // Wrong
        uint8[] memory props = new uint8[](0);

        vm.prank(alice);
        vm.expectRevert(bytes("Invalid balance change"));
        tycoon.updatePlayerPosition(gameId, alice, 5, wrongNewBal, delta, props);
    }

    function test_Revert_Update_Excessive_Loss() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);
        vm.prank(bob);
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "car", "");

        int256 excessiveDelta = -1001;
        uint256 newBal = STARTING_BALANCE + uint256(excessiveDelta < 0 ? -excessiveDelta : excessiveDelta);
        if (excessiveDelta < 0) newBal = STARTING_BALANCE - uint256(-excessiveDelta);
        uint8[] memory props = new uint8[](0);

        vm.prank(alice);
        vm.expectRevert(bytes("Excessive loss"));
        tycoon.updatePlayerPosition(gameId, alice, 5, newBal, excessiveDelta, props);
    }

    function test_Revert_Update_Invalid_Position() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);
        vm.prank(bob);
        tycoon.joinGame{value: STAKE_AMOUNT}(gameId, "Bob", "car", "");

        int256 delta = 0;
        uint256 newBal = STARTING_BALANCE;
        uint8[] memory props = new uint8[](0);

        vm.prank(alice);
        vm.expectRevert(bytes("Invalid position"));
        tycoon.updatePlayerPosition(gameId, alice, uint8(BOARD_SIZE), newBal, delta, props);
    }

    function test_Revert_Update_Not_In_Game_Target() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);

        int256 delta = 0;
        uint256 newBal = STARTING_BALANCE;
        uint8[] memory props = new uint8[](0);

        vm.prank(alice);
        vm.expectRevert(bytes("Target not in game"));
        tycoon.updatePlayerPosition(gameId, charlie, 5, newBal, delta, props);
    }

    function test_Revert_Update_Not_Ongoing() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);

        int256 delta = 0;
        uint256 newBal = STARTING_BALANCE;
        uint8[] memory props = new uint8[](0);

        vm.prank(alice);
        vm.expectRevert(bytes("Game not ongoing"));
        tycoon.updatePlayerPosition(gameId, alice, 5, newBal, delta, props);
    }

    function test_Withdraw_House() public {
        // Setup house balance via AI loss
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createAIGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 1, GAME_CODE, STARTING_BALANCE);

        uint256 houseBefore = tycoon.houseBalance();
        uint256 ownerBalBefore = owner.balance;

        vm.prank(alice);
        tycoon.endAIGame(gameId, 10, 1000, 0, false); // Loss, house += STAKE

        uint256 withdrawAmt = STAKE_AMOUNT;
        assertEq(tycoon.houseBalance(), houseBefore + withdrawAmt);

        vm.prank(owner);
        tycoon.withdrawHouse(withdrawAmt);

        assertEq(tycoon.houseBalance(), 0);
        assertEq(owner.balance, ownerBalBefore + withdrawAmt);
    }

    function test_Revert_Withdraw_House_Insufficient() public {
        vm.prank(owner);
        vm.expectRevert(bytes("Insufficient house balance"));
        tycoon.withdrawHouse(1);
    }

    function test_Revert_Withdraw_House_Not_Owner() public {
        vm.prank(alice);
        vm.expectRevert(); // Ownable not owner
        tycoon.withdrawHouse(0);
    }

    function test_Get_Game_Revert_Not_Found() public {
        vm.expectRevert(bytes("Game not found"));
        tycoon.getGame(999);
    }

    function test_Get_Game_Player_Revert_Not_In_Game() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(bob);
        tycoon.registerPlayer("Bob");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);

        vm.expectRevert(bytes("Player not in game"));
        tycoon.getGamePlayer(gameId, "Bob");
    }

    function test_Get_Property_Invalid_Id() public {
        vm.prank(alice);
        tycoon.registerPlayer("Alice");

        vm.prank(alice);
        uint256 gameId = tycoon.createGame{value: STAKE_AMOUNT}("Alice", "PUBLIC", "hat", 2, GAME_CODE, STARTING_BALANCE);

        vm.expectRevert(bytes("Property not found"));
        tycoon.getProperty(gameId, uint8(BOARD_SIZE));
    }
}