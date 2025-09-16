// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {Blockopoly} from "../src/monopoly.sol";

contract BlockopolyTest is Test {
    Blockopoly public blockopoly;

    function setUp() public {
        blockopoly = new Blockopoly();
    }

    function test_Register_Player() public {
        uint256 playerId = blockopoly.registerPlayer("Alice");
        assertEq(playerId, 1);

        Blockopoly.Users memory user = blockopoly.getPlayerById(playerId);

        assertEq(user.username, "Alice");
        assertEq(user.gamesPlayed, 0);
        assertEq(user.gameWon, 0);
        assertEq(user.gameLost, 0);
        assertEq(user.totalStaked, 0);
        assertEq(user.totalEarned, 0);
        assertEq(user.totalWithdrawn, 0);
    }

    function test_Create_Game() public {
        // First register a player
        uint256 playerId = blockopoly.registerPlayer("Alice");
        Blockopoly.Users memory user = blockopoly.getPlayerById(playerId);
        assertEq(user.username, "Alice");

        // Blockopoly.Gamesettings memory settings = Blockopoly.Gamesettings({
        //     maxPlayers: 2,
        //     privateRoom: "PUBLIC",
        //     auction: true,
        //     rentInPrison: false,
        //     mortgage: true,
        //     evenBuild: true,
        //     startingCash: 1500,
        //     randomizePlayOrder: true
        // });

        // Create a game: PublicGame (0), choose symbol Hat (0), with 2 players, and a code
        uint256 gameId = blockopoly.createGame(
            "PUBLIC", // game type
            "Hat", // player symbol
            2, // numberOfPlayers
            "GAME123",
            1500
        );

        Blockopoly.Game memory game = blockopoly.getGame(gameId);

        assertEq(game.id, gameId);
        assertEq(game.code, "GAME123");
        assertEq(game.creator, address(this));
        assertEq(uint8(game.status), uint8(Blockopoly.GameStatus.Pending));
        assertEq(game.numberOfPlayers, 2);
        assertEq(uint8(game.mode), uint8(Blockopoly.GameType.PublicGame));
    }

    // function test_Join_Game() public {
    //     // Define unique addresses
    //     address alice = address(0xA11CE);
    //     address bob = address(0xB0B);
    //     address carol = address(0xB0BB);

    //     // Alice registers
    //     vm.prank(alice);
    //     blockopoly.registerPlayer("Alice");

    //     // Alice creates a game
    //     vm.prank(alice);
    //     uint256 gameId = blockopoly.createGame(
    //         0, // PublicGame
    //         0, // Hat
    //         3, // numberOfPlayers
    //         "GAME123"
    //     );

    //     // Bob registers
    //     vm.prank(bob);
    //     blockopoly.registerPlayer("Bob");

    //     // Bob joins Alice's game
    //     vm.prank(bob);
    //     blockopoly.joinGame(gameId, 1); // symbol = Car

    //     // Carol registers
    //     vm.prank(carol);
    //     blockopoly.registerPlayer("Carol");

    //     // Carol joins the game
    //     vm.prank(carol);
    //     blockopoly.joinGame(gameId, 2); // symbol = Dog

    //     // Fetch the game to check players
    //     Blockopoly.Game memory game = blockopoly.getGame(gameId);
    //     assertEq(game.numberOfPlayers, 3);

    //     // Verify Alice is registered in-game
    //     Blockopoly.GamePlayer memory pAlice = blockopoly.getGamePlayer(gameId, alice);
    //     assertEq(pAlice.username, "Alice");
    //     assertEq(uint8(pAlice.symbol), 0); // Hat

    //     // Verify Bob is registered in-game
    //     Blockopoly.GamePlayer memory pBob = blockopoly.getGamePlayer(gameId, bob);
    //     assertEq(pBob.username, "Bob");
    //     assertEq(uint8(pBob.symbol), 1); // Car

    //     // Verify Carol is registered in-game
    //     Blockopoly.GamePlayer memory pCarol = blockopoly.getGamePlayer(gameId, carol);
    //     assertEq(pCarol.username, "Carol");
    //     assertEq(uint8(pCarol.symbol), 2); // Dog
    // }

    // function test_Start_Game() public {
    //     address alice = address(0xA11CE);
    //     address bob = address(0xB0B);

    //     // Alice registers
    //     vm.prank(alice);
    //     blockopoly.registerPlayer("Alice");

    //     // Alice creates a game
    //     vm.prank(alice);
    //     uint256 gameId = blockopoly.createGame(
    //         0, // PublicGame
    //         0, // Hat
    //         2, // players
    //         "START123"
    //     );

    //     // Bob registers
    //     vm.prank(bob);
    //     blockopoly.registerPlayer("Bob");

    //     // Bob joins Alice's game
    //     vm.prank(bob);
    //     blockopoly.joinGame(gameId, 1); // Car

    //     // Game should be Pending before start
    //     Blockopoly.Game memory gameBefore = blockopoly.getGame(gameId);
    //     assertEq(uint8(gameBefore.status), uint8(Blockopoly.GameStatus.Pending));

    //     // ❌ Bob cannot start the game (should revert)
    //     vm.prank(bob);
    //     vm.expectRevert("Only creator can start");
    //     blockopoly.startGame(gameId);

    //     // ✅ Alice (creator) starts the game
    //     vm.prank(alice);
    //     blockopoly.startGame(gameId);

    //     // Game should now be Ongoing
    //     Blockopoly.Game memory gameAfter = blockopoly.getGame(gameId);
    //     assertEq(uint8(gameAfter.status), uint8(Blockopoly.GameStatus.Ongoing));
    // }

    // function test_PlayerPaysRent() public {
    //     address alice = address(0xA11CE);
    //     address bob = address(0xB0B);

    //     // Alice registers
    //     vm.prank(alice);
    //     blockopoly.registerPlayer("Alice");

    //     // Alice creates a game
    //     vm.prank(alice);
    //     uint256 gameId = blockopoly.createGame(
    //         0, // PublicGame
    //         0, // Hat
    //         2, // players
    //         "RENT123"
    //     );

    //     // Bob registers
    //     vm.prank(bob);
    //     blockopoly.registerPlayer("Bob");

    //     // Bob joins Alice's game
    //     vm.prank(bob);
    //     blockopoly.joinGame(gameId, 1); // Car

    //     // Alice starts the game
    //     vm.prank(alice);
    //     blockopoly.startGame(gameId);

    //     // ---- Setup property manually (owned by Alice) ----
    //     // This assumes your contract exposes a mapping like properties[gameId][pos]
    //     uint256 pos = 5;
    //     blockopoly.setProperty(gameId, pos, alice, 100, true);
    //     // ^ You may need a helper setter for testing only (not prod)

    //     // ---- Give both players balances ----
    //     blockopoly.setBalance(gameId, alice, 200); // again via helper in contract
    //     blockopoly.setBalance(gameId, bob, 300);

    //     // ---- Bob lands on position 5 ----
    //     vm.prank(bob);
    //     blockopoly.testMoveTo(gameId, pos);
    //     // ^ helper that applies the rent-paying logic

    //     // ---- Check balances ----
    //     uint256 aliceBal = blockopoly.getBalance(gameId, alice);
    //     uint256 bobBal = blockopoly.getBalance(gameId, bob);

    //     assertEq(bobBal, 200, "Bob should pay 100 rent");
    //     assertEq(aliceBal, 300, "Alice should receive 100 rent");
    // }
}
