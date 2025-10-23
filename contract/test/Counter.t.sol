// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {Tycoon} from "../src/Tycoon.sol";
import {TycoonLib} from "../src/TycoonLib.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

// Stub ERC20 if not defined elsewhere (simple mintable token)
contract TycoonT is IERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint8 public constant decimals = 18;
    string public name = "Tycoon Token";
    string public symbol = "TYC";

    function totalSupply() external pure returns (uint256) { return type(uint256).max; }
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (allowance[from][msg.sender] != type(uint256).max) allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract TycoonTest is Test {
    Tycoon public tycoon;
    TycoonT public lootToken;
    address public owner = address(0x1);
    uint256 constant STAKE_AMOUNT = 1 * 10 ** 18;
    uint256 constant REWARD_AMOUNT = 1.5 * 10 ** 18; // 150% of stake
    string constant FIXED_TOKEN_URI =
        "https://gateway.pinata.cloud/ipfs/bafkreicu5ldq3bgvd2cqq3732bmrbyhcowl5i7fb24htopelrktorhuu6i";

    function setUp() public {
        vm.prank(owner);
        lootToken = new TycoonT();
        vm.prank(owner);
        tycoon = new Tycoon(address(lootToken));

        vm.prank(owner);
        lootToken.mint(address(tycoon), 10000000000 * 10 ** 18); // Fund contract with tokens
        uint256 initialBalance = lootToken.balanceOf(address(tycoon));
        assertEq(initialBalance, 10000000000 * 10 ** 18);
    }

    function test_Register_Player() public {
        uint256 playerId = tycoon.registerPlayer("Alice");
        assertEq(playerId, 1);

        TycoonLib.User memory user = tycoon.getUser("Alice");

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

        // Check NFT minting
        assertEq(tycoon.balanceOf(user.playerAddress), 3);
        assertEq(tycoon.ownerOf(1), user.playerAddress);
        // assertEq(tycoon.tokenURI(1), FIXED_TOKEN_URI);
    }

    function test_Create_Game() public {
        // First register a player
        uint256 playerId = tycoon.registerPlayer("Alice");
        TycoonLib.User memory user = tycoon.getUser("Alice");
        assertEq(user.username, "Alice");

        uint256 initialBalance = lootToken.balanceOf(user.playerAddress);

        // Create a game
        vm.prank(owner);
        uint256 gameId = tycoon.createGame(
            "Alice",
            "PUBLIC",
            "hat",
            2,
            "GAME123",
            1500
        );

        TycoonLib.Game memory game = tycoon.getGame(gameId);
        uint256 balAfter = lootToken.balanceOf(user.playerAddress);
        assertEq(game.id, gameId);
        assertEq(game.code, "GAME123");
        assertEq(game.creator, user.playerAddress);
        assertEq(uint8(game.status), uint8(TycoonLib.GameStatus.Pending));
        assertEq(game.numberOfPlayers, 2);
        assertEq(uint8(game.mode), uint8(TycoonLib.GameType.PublicGame));
        assertEq(game.joinedPlayers, 1);
        assertEq(game.totalStaked, STAKE_AMOUNT);

        assertEq(balAfter, initialBalance - STAKE_AMOUNT);

        // Check games played increased
        TycoonLib.User memory updatedUser = tycoon.getUser("Alice");
        assertEq(updatedUser.gamesPlayed, 1);
        assertEq(updatedUser.totalStaked, STAKE_AMOUNT);

        // Check creator's game player balance
        TycoonLib.GamePlayer memory creatorPlayer = tycoon.getGamePlayer(gameId, "Alice");
        assertEq(creatorPlayer.balance, 1500);
    }

    function test_Join_Game() public {
        uint256 player1Id = tycoon.registerPlayer("Alice");
        uint256 player2Id = tycoon.registerPlayer("Bob");

        TycoonLib.User memory alice = tycoon.getUser("Alice");
        TycoonLib.User memory bob = tycoon.getUser("Bob");

        vm.prank(owner);
        uint256 gameId = tycoon.createGame("Alice", "PUBLIC", "hat", 2, "GAME123", 1500);

        uint256 balBefore = lootToken.balanceOf(bob.playerAddress);

        vm.prank(owner);
        uint8 order = tycoon.joinGame(gameId, "Bob", "car");

        TycoonLib.Game memory game = tycoon.getGame(gameId);
        TycoonLib.GamePlayer memory bobPlayer = tycoon.getGamePlayer(gameId, "Bob");

        // Check that Bob joined correctly
        assertEq(order, 2);
        assertEq(game.joinedPlayers, 2);
        assertEq(uint8(game.status), uint8(TycoonLib.GameStatus.Ongoing));
        assertEq(bobPlayer.order, 2);
        assertEq(bobPlayer.balance, 1500);

        // Bob's balance decreased by 1 token (staked)
        uint256 balAfter = lootToken.balanceOf(bob.playerAddress);
        assertEq(balBefore - balAfter, STAKE_AMOUNT);

        // Check games played increased
        TycoonLib.User memory updatedBob = tycoon.getUser("Bob");
        assertEq(updatedBob.gamesPlayed, 1);
        assertEq(updatedBob.totalStaked, STAKE_AMOUNT);

        // Check game totalStaked
        assertEq(game.totalStaked, 2 * STAKE_AMOUNT);
    }

    function test_Remove_Player_Finalizes_Game_With_Bonus() public {
        uint256 player1Id = tycoon.registerPlayer("Alice");
        uint256 player2Id = tycoon.registerPlayer("Bob");

        TycoonLib.User memory alice = tycoon.getUser("Alice");
        TycoonLib.User memory bob = tycoon.getUser("Bob");

        vm.prank(owner);
        uint256 gameId = tycoon.createGame("Alice", "PUBLIC", "hat", 2, "GAME123", 1500);
        vm.prank(owner);
        tycoon.joinGame(gameId, "Bob", "car");

        TycoonLib.Game memory gameBefore = tycoon.getGame(gameId);
        assertEq(uint8(gameBefore.status), uint8(TycoonLib.GameStatus.Ongoing));

        uint256 bobBalBefore = lootToken.balanceOf(bob.playerAddress);
        uint256 bobEarnedBefore = tycoon.getUser("Bob").totalEarned;

        // Remove Alice -> Bob should be winner with bonus (totalTurns >=40)
        vm.prank(owner);
        bool removed = tycoon.removePlayerFromGame(gameId, "Alice", "Bob", 50); // >40
        assertTrue(removed);

        TycoonLib.Game memory gameAfter = tycoon.getGame(gameId);
        TycoonLib.User memory bobUser = tycoon.getUser("Bob");
        TycoonLib.User memory aliceUser = tycoon.getUser("Alice");

        assertEq(uint8(gameAfter.status), uint8(TycoonLib.GameStatus.Ended));
        assertEq(gameAfter.winner, bob.playerAddress);
        assertEq(bobUser.gamesWon, 1);
        assertEq(aliceUser.gamesLost, 1);
        assertEq(bobUser.totalEarned, bobEarnedBefore + REWARD_AMOUNT); // 150% of stake

        // Check reward transferred
        uint256 bobBalAfter = lootToken.balanceOf(bob.playerAddress);
        assertEq(bobBalAfter, bobBalBefore + REWARD_AMOUNT);
    }

    function test_Remove_Player_Finalizes_Game_No_Bonus() public {
        uint256 player1Id = tycoon.registerPlayer("Alice");
        uint256 player2Id = tycoon.registerPlayer("Bob");

        TycoonLib.User memory alice = tycoon.getUser("Alice");
        TycoonLib.User memory bob = tycoon.getUser("Bob");

        vm.prank(owner);
        uint256 gameId = tycoon.createGame("Alice", "PUBLIC", "hat", 2, "GAME123", 1500);
        vm.prank(owner);
        tycoon.joinGame(gameId, "Bob", "car");

        TycoonLib.Game memory gameBefore = tycoon.getGame(gameId);
        assertEq(uint8(gameBefore.status), uint8(TycoonLib.GameStatus.Ongoing));

        uint256 bobBalBefore = lootToken.balanceOf(bob.playerAddress);
        uint256 bobEarnedBefore = tycoon.getUser("Bob").totalEarned;

        // Remove Alice -> Bob should be winner but no bonus (totalTurns <40)
        vm.prank(owner);
        bool removed = tycoon.removePlayerFromGame(gameId, "Alice", "Bob", 30); // <40
        assertTrue(removed);

        TycoonLib.Game memory gameAfter = tycoon.getGame(gameId);
        TycoonLib.User memory bobUser = tycoon.getUser("Bob");
        TycoonLib.User memory aliceUser = tycoon.getUser("Alice");

        assertEq(uint8(gameAfter.status), uint8(TycoonLib.GameStatus.Ended));
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

        TycoonLib.User memory alice = tycoon.getUser("Alice");
        TycoonLib.User memory bob = tycoon.getUser("Bob");

        vm.prank(owner);
        uint256 gameId = tycoon.createGame("Alice", "PUBLIC", "hat", 2, "GAME123", 1500);
        vm.prank(owner);
        tycoon.joinGame(gameId, "Bob", "car");

        // Revert if not paymaster
        vm.prank(address(0x2));  // Not owner/paymaster
        vm.expectRevert(bytes("Not paymaster"));
        tycoon.removePlayerFromGame(gameId, "Alice", "Bob", 50);
    }

    function test_Revert_Update_Position_Not_Paymaster() public {
        uint256 player1Id = tycoon.registerPlayer("Alice");
        TycoonLib.User memory alice = tycoon.getUser("Alice");

        vm.prank(owner);
        uint256 gameId = tycoon.createGame("Alice", "PUBLIC", "hat", 2, "GAME123", 1500);

        // Revert if not paymaster
        vm.prank(address(0x2));  // Not owner/paymaster
        vm.expectRevert(bytes("Not paymaster"));
        tycoon.updatePlayerPosition(gameId, "Alice", 5, 1400, 0);
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

        TycoonLib.User memory alice = tycoon.getUser("Alice");
        TycoonLib.User memory bob = tycoon.getUser("Bob");
        TycoonLib.User memory charlie = tycoon.getUser("Charlie");

        vm.prank(owner);
        uint256 gameId = tycoon.createGame("Alice", "PUBLIC", "hat", 2, "GAME123", 1500);
        vm.prank(owner);
        tycoon.joinGame(gameId, "Bob", "car");

        // After full, status Ongoing, so revert on "Game not open"
        vm.expectRevert(bytes("Game not open"));
        vm.prank(owner);
        tycoon.joinGame(gameId, "Charlie", "dog");
    }

    function test_Update_Player_Position_And_Property() public {
        // Register two players
        uint256 aliceId = tycoon.registerPlayer("Alice");
        TycoonLib.User memory alice = tycoon.getUser("Alice");

        uint256 bobId = tycoon.registerPlayer("Bob");
        TycoonLib.User memory bob = tycoon.getUser("Bob");

        // Create a 2-player PUBLIC game
        vm.prank(owner);
        uint256 gameId = tycoon.createGame(
            "Alice",
            "PUBLIC",
            "hat",
            2,
            "GAME123",
            1500
        );

        // Join second player to start the game
        vm.prank(owner);
        tycoon.joinGame(gameId, "Bob", "car");

        // At this point, game.status should be Ongoing
        TycoonLib.Game memory game = tycoon.getGame(gameId);
        assertEq(uint8(game.status), uint8(TycoonLib.GameStatus.Ongoing));

        // Update Alice's position and balance
        uint8 newPosAlice = 5;
        uint256 newBalanceAlice = 1400;
        uint8 propertyId = 3;

        vm.prank(owner);
        bool updated = tycoon.updatePlayerPosition(
            gameId,
            "Alice",
            newPosAlice,
            newBalanceAlice,
            propertyId
        );
        assertTrue(updated);

        // Check Alice's state
        TycoonLib.GamePlayer memory gpAlice = tycoon.getGamePlayer(gameId, "Alice");
        assertEq(gpAlice.position, newPosAlice);
        assertEq(gpAlice.balance, newBalanceAlice);

        // Check property ownership (now with ID set)
        TycoonLib.Property memory prop = tycoon.getProperty(gameId, propertyId);
        assertEq(prop.id, propertyId);
        assertEq(prop.owner, alice.playerAddress);

        // Update Bob's position without property
        uint8 newPosBob = 8;
        uint256 newBalanceBob = 1300;

        vm.prank(owner);
        updated = tycoon.updatePlayerPosition(
            gameId,
            "Bob",
            newPosBob,
            newBalanceBob,
            0 // no property
        );
        assertTrue(updated);

        TycoonLib.GamePlayer memory gpBob = tycoon.getGamePlayer(gameId, "Bob");
        assertEq(gpBob.position, newPosBob);
        assertEq(gpBob.balance, newBalanceBob);
    }

    function test_Revert_Remove_Player_Not_In_Game() public {
        uint256 player1Id = tycoon.registerPlayer("Alice");
        uint256 player2Id = tycoon.registerPlayer("Bob");
        uint256 player3Id = tycoon.registerPlayer("Charlie");

        TycoonLib.User memory alice = tycoon.getUser("Alice");
        TycoonLib.User memory bob = tycoon.getUser("Bob");
        TycoonLib.User memory charlie = tycoon.getUser("Charlie");

        vm.prank(owner);
        uint256 gameId = tycoon.createGame("Alice", "PUBLIC", "hat", 2, "GAME123", 1500);
        vm.prank(owner);
        tycoon.joinGame(gameId, "Bob", "car");

        // Try remove non-player (Charlie is registered but not in game)
        vm.expectRevert(bytes("Player not in game"));
        vm.prank(owner);
        tycoon.removePlayerFromGame(gameId, "Charlie", "Bob", 50);
    }

    function test_Revert_Remove_Final_Phase_No_Candidate() public {
        uint256 player1Id = tycoon.registerPlayer("Alice");
        uint256 player2Id = tycoon.registerPlayer("Bob");

        TycoonLib.User memory alice = tycoon.getUser("Alice");
        TycoonLib.User memory bob = tycoon.getUser("Bob");

        vm.prank(owner);
        uint256 gameId = tycoon.createGame("Alice", "PUBLIC", "hat", 2, "GAME123", 1500);
        vm.prank(owner);
        tycoon.joinGame(gameId, "Bob", "car");

        // Try remove without finalCandidate
        vm.expectRevert(bytes("Remaining player required"));
        vm.prank(owner);
        tycoon.removePlayerFromGame(gameId, "Alice", "", 50);
    }

    function test_Revert_Create_Invalid_Player_Count() public {
        uint256 playerId = tycoon.registerPlayer("Alice");
        TycoonLib.User memory user = tycoon.getUser("Alice");

        vm.prank(owner);
        vm.expectRevert(bytes("Invalid player count"));
        tycoon.createGame("Alice", "PUBLIC", "hat", 1, "GAME123", 1500);

        vm.prank(owner);
        vm.expectRevert(bytes("Invalid player count"));
        tycoon.createGame("Alice", "PUBLIC", "hat", 9, "GAME123", 1500);
    }

    function test_GetUser() public {
        tycoon.registerPlayer("Alice");
        TycoonLib.User memory userByName = tycoon.getUser("Alice");
        assertEq(userByName.username, "Alice");

        vm.expectRevert(bytes("User not registered"));
        tycoon.getUser("NonExistent");
    }

    // Bonus: Test invalid game type/symbol reverts
    function test_Revert_Invalid_GameType() public {
        uint256 playerId = tycoon.registerPlayer("Alice");
        TycoonLib.User memory user = tycoon.getUser("Alice");

        vm.prank(owner);
        vm.expectRevert(bytes("Invalid game type"));
        tycoon.createGame("Alice", "INVALID", "hat", 2, "GAME123", 1500);
    }

    function test_Revert_Invalid_PlayerSymbol() public {
        uint256 playerId = tycoon.registerPlayer("Alice");
        TycoonLib.User memory user = tycoon.getUser("Alice");

        vm.prank(owner);
        vm.expectRevert(bytes("Invalid player symbol"));
        tycoon.createGame("Alice", "PUBLIC", "invalid", 2, "GAME123", 1500);
    }
}