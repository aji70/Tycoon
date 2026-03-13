// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {TycoonLib} from "./TycoonLib.sol";
import {TycoonRewardSystem} from "./TycoonRewardSystem.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITycoonUserRegistry {
    function createWalletForUser(address owner, string calldata username) external returns (address);
    function grantGameActionReward(address user, bytes32 action) external;
}

/// @title TycoonUpgradeableLogic
/// @notice Delegatecall target for TycoonUpgradeable. Storage layout MUST match TycoonUpgradeable (minus logicContract).
contract TycoonUpgradeableLogic {
    using TycoonLib for TycoonLib.Game;
    using TycoonLib for TycoonLib.GamePlayer;
    using TycoonLib for TycoonLib.GameSettings;

    // Slot 0: proxy uses this for Ownable._owner. Logic must not use it (delegatecall uses proxy storage).
    address private __proxyOwnerSlot;

    // Storage layout: after slot 0, same as TycoonUpgradeable (do not reorder)
    uint256 public totalUsers;
    uint256 public totalGames;
    uint256 private _nextGameId = 1;
    uint256 public houseUSDC;

    uint256 public constant TOKEN_REWARD = 1 ether;
    uint256 public minStake = 1000;

    mapping(uint256 => mapping(uint8 => address)) public gameOrderToPlayer;
    mapping(string => TycoonLib.User) public users;
    mapping(address => bool) public registered;
    mapping(address => string) public addressToUsername;
    mapping(uint256 => TycoonLib.Game) public games;
    mapping(uint256 => TycoonLib.GameSettings) public gameSettings;
    mapping(string => TycoonLib.Game) public codeToGame;
    mapping(uint256 => mapping(address => TycoonLib.GamePlayer)) public gamePlayers;
    mapping(address => string) public previousGameCode;
    mapping(uint256 => mapping(address => uint256)) public claims;
    mapping(uint256 => mapping(address => uint256)) public turnsPlayed;

    mapping(address => bytes32) private _passwordHashOf;
    mapping(address => bool) public addressVerified;

    TycoonRewardSystem public rewardSystem;
    address public userRegistry;
    address public backendGameController;
    address public gameFaucet;
    uint256 public minTurnsForPerks;

    uint256 constant CONSOLATION_VOUCHER = TOKEN_REWARD / 10;

    event GameCreated(uint256 indexed gameId, address indexed creator, uint64 timestamp);
    event PlayerJoined(uint256 indexed gameId, address indexed player, uint8 order);
    event PlayerLeftPendingGame(uint256 indexed gameId, address indexed player, uint256 stakeRefunded);
    event PlayerRemoved(uint256 indexed gameId, address indexed player, uint64 timestamp);
    event PlayerExited(uint256 indexed gameId, address indexed player);
    event GameEnded(uint256 indexed gameId, address indexed winner, uint64 timestamp);
    event RewardClaimed(uint256 indexed gameId, address indexed player, uint256 amountUSDC);
    event AIGameEnded(uint256 indexed gameId, address indexed player, uint64 timestamp);

    function createGame(address actor, string calldata creatorUsername, string calldata gameType, string calldata playerSymbol, uint8 numberOfPlayers, string calldata code, uint256 startingBalance, uint256 stakeAmount) external returns (uint256 gameId) {
        TycoonLib.validateUsername(creatorUsername);
        uint8 gType = TycoonLib.stringToGameType(gameType);
        TycoonLib.validateCode(code, gType == uint8(TycoonLib.GameType.PrivateGame));
        if (stakeAmount > 0) require(stakeAmount >= minStake, "Stake too low");
        require(numberOfPlayers >= 2 && numberOfPlayers <= 8, "Players 2-8");
        require(startingBalance > 0, "Invalid balance");
        require(registered[actor], "Not registered");

        TycoonLib.User storage user = users[creatorUsername];
        require(user.playerAddress == actor, "Username mismatch");
        if (gType == uint8(TycoonLib.GameType.PrivateGame)) require(bytes(code).length > 0, "Code required for private game");

        if (stakeAmount > 0) require(rewardSystem.usdc().transferFrom(actor, address(this), stakeAmount), "USDC transfer failed");

        gameId = _nextGameId++;
        gameSettings[gameId] = TycoonLib.GameSettings({ maxPlayers: numberOfPlayers, auction: true, rentInPrison: true, mortgage: true, evenBuild: true, startingCash: startingBalance, privateRoomCode: code });
        games[gameId] = TycoonLib.Game({ id: gameId, code: code, creator: actor, status: TycoonLib.GameStatus.Pending, winner: address(0), numberOfPlayers: numberOfPlayers, joinedPlayers: 1, mode: TycoonLib.GameType(gType), ai: false, createdAt: uint64(block.timestamp), endedAt: 0, totalStaked: stakeAmount, stakePerPlayer: stakeAmount });
        gamePlayers[gameId][actor] = TycoonLib.GamePlayer({ gameId: gameId, playerAddress: actor, balance: startingBalance, position: 0, order: 1, symbol: TycoonLib.PlayerSymbol(TycoonLib.stringToPlayerSymbol(playerSymbol)), username: creatorUsername });
        gameOrderToPlayer[gameId][1] = actor;
        codeToGame[code] = games[gameId];
        previousGameCode[actor] = code;
        user.gamesPlayed++;
        user.totalStaked += stakeAmount;
        totalGames++;
        if (userRegistry != address(0)) { try ITycoonUserRegistry(userRegistry).grantGameActionReward(actor, keccak256("create_game")) {} catch {} }
        emit GameCreated(gameId, actor, uint64(block.timestamp));
    }

    function createAIGame(address actor, string calldata creatorUsername, string calldata gameType, string calldata playerSymbol, uint8 numberOfAI, string calldata code, uint256 startingBalance) external returns (uint256 gameId) {
        TycoonLib.validateUsername(creatorUsername);
        TycoonLib.validateCode(code, false);
        require(numberOfAI >= 1 && numberOfAI <= 7, "AI players 1-7");
        require(bytes(gameType).length > 0 && bytes(playerSymbol).length > 0, "Invalid params");
        require(startingBalance > 0, "Invalid balance");
        require(registered[actor], "Not registered");
        TycoonLib.User storage user = users[creatorUsername];
        require(user.playerAddress == actor, "Username mismatch");
        uint8 gType = TycoonLib.stringToGameType(gameType);
        gameId = _nextGameId++;
        uint8 totalPlayers = 1 + numberOfAI;
        gameSettings[gameId] = TycoonLib.GameSettings({ maxPlayers: totalPlayers, auction: true, rentInPrison: true, mortgage: true, evenBuild: true, startingCash: startingBalance, privateRoomCode: code });
        games[gameId] = TycoonLib.Game({ id: gameId, code: code, creator: actor, status: TycoonLib.GameStatus.Ongoing, winner: address(0), numberOfPlayers: totalPlayers, joinedPlayers: 1, mode: TycoonLib.GameType(gType), ai: true, createdAt: uint64(block.timestamp), endedAt: 0, totalStaked: 0, stakePerPlayer: 0 });
        gamePlayers[gameId][actor] = TycoonLib.GamePlayer({ gameId: gameId, playerAddress: actor, balance: startingBalance, position: 0, order: 1, symbol: TycoonLib.PlayerSymbol(TycoonLib.stringToPlayerSymbol(playerSymbol)), username: creatorUsername });
        gameOrderToPlayer[gameId][1] = actor;
        for (uint8 i = 2; i <= totalPlayers; i++) {
            address aiAddr = address(uint160(i));
            gameOrderToPlayer[gameId][i] = aiAddr;
            gamePlayers[gameId][aiAddr] = TycoonLib.GamePlayer({ gameId: gameId, playerAddress: aiAddr, balance: startingBalance, position: 0, order: i, symbol: TycoonLib.PlayerSymbol(0), username: string(abi.encodePacked("AI_", TycoonLib.uintToString(i))) });
        }
        codeToGame[code] = games[gameId];
        previousGameCode[actor] = code;
        user.gamesPlayed++;
        totalGames++;
        emit GameCreated(gameId, actor, uint64(block.timestamp));
    }

    /// @notice Create a smart wallet in the User Registry for a player who is already registered on the game but has no registry profile (e.g. registered before registry was set).
    function createWalletForExistingUser(address player) external returns (address wallet) {
        require(registered[player], "Not registered");
        require(userRegistry != address(0), "User registry not set");
        string memory username = addressToUsername[player];
        require(bytes(username).length > 0, "No username");
        return ITycoonUserRegistry(userRegistry).createWalletForUser(player, username);
    }

    function joinGame(address actor, uint256 gameId, string calldata playerUsername, string calldata playerSymbol, string calldata joinCode) external returns (uint8 order) {
        TycoonLib.validateUsername(playerUsername);
        TycoonLib.Game storage game = games[gameId];
        require(!game.ai, "Cannot join AI game");
        require(game.creator != address(0), "Game not found");
        require(game.status == TycoonLib.GameStatus.Pending, "Game not open");
        require(game.joinedPlayers < game.numberOfPlayers, "Game is full");
        require(registered[actor], "Not registered");
        TycoonLib.User storage user = users[playerUsername];
        require(user.playerAddress == actor, "Username mismatch");
        require(gamePlayers[gameId][actor].playerAddress == address(0), "Already joined");
        if (game.mode == TycoonLib.GameType.PrivateGame) require(keccak256(bytes(joinCode)) == keccak256(bytes(game.code)), "Wrong code");
        if (game.stakePerPlayer > 0) require(rewardSystem.usdc().transferFrom(actor, address(this), game.stakePerPlayer), "Stake payment failed");
        user.gamesPlayed++;
        user.totalStaked += game.stakePerPlayer;
        game.totalStaked += game.stakePerPlayer;
        order = ++game.joinedPlayers;
        gamePlayers[gameId][actor] = TycoonLib.GamePlayer({ gameId: gameId, playerAddress: actor, balance: gameSettings[gameId].startingCash, position: 0, order: order, symbol: TycoonLib.PlayerSymbol(TycoonLib.stringToPlayerSymbol(playerSymbol)), username: playerUsername });
        gameOrderToPlayer[gameId][order] = actor;
        previousGameCode[actor] = game.code;
        if (userRegistry != address(0)) { try ITycoonUserRegistry(userRegistry).grantGameActionReward(actor, keccak256("join_game")) {} catch {} }
        emit PlayerJoined(gameId, actor, order);
        if (game.joinedPlayers == game.numberOfPlayers) game.status = TycoonLib.GameStatus.Ongoing;
        codeToGame[game.code] = game;
    }

    function leavePendingGame(address actor, uint256 gameId) external returns (bool) {
        TycoonLib.Game storage game = games[gameId];
        require(game.creator != address(0), "Game not found");
        require(game.status == TycoonLib.GameStatus.Pending, "Game already started");
        require(!game.ai, "Not for AI games");
        TycoonLib.GamePlayer storage gp = gamePlayers[gameId][actor];
        require(gp.playerAddress != address(0), "Not in game");
        uint256 stakeAmount = game.stakePerPlayer;
        if (stakeAmount > 0) {
            require(rewardSystem.usdc().transfer(actor, stakeAmount), "Refund failed");
            game.totalStaked -= stakeAmount;
        }
        TycoonLib.User storage user = users[gp.username];
        user.gamesPlayed--;
        user.totalStaked -= stakeAmount;
        uint8 order = gp.order;
        delete gamePlayers[gameId][actor];
        delete gameOrderToPlayer[gameId][order];
        game.joinedPlayers--;
        if (game.joinedPlayers == 0) game.status = TycoonLib.GameStatus.Ended;
        codeToGame[game.code] = game;
        emit PlayerLeftPendingGame(gameId, actor, stakeAmount);
        return true;
    }

    function exitOrRemovePlayer(uint256 gameId, address player, uint256 turnCount) external {
        TycoonLib.Game storage game = games[gameId];
        require(game.status == TycoonLib.GameStatus.Ongoing, "Game not ongoing");
        require(!game.ai, "Cannot exit AI game");
        require(gamePlayers[gameId][player].playerAddress != address(0), "Not in game");
        if (game.joinedPlayers == 1) {
            uint256 houseCut = (game.totalStaked * TycoonLib.getHousePercent()) / 100;
            houseUSDC += houseCut;
            claims[gameId][player] = 1;
            _payoutReward(gameId, player, 1, turnCount);
            users[gamePlayers[gameId][player].username].gamesWon++;
            game.status = TycoonLib.GameStatus.Ended;
            game.winner = player;
            game.endedAt = uint64(block.timestamp);
            codeToGame[game.code] = game;
            if (userRegistry != address(0)) { try ITycoonUserRegistry(userRegistry).grantGameActionReward(player, keccak256("end_game")) {} catch {} }
            emit GameEnded(gameId, player, uint64(block.timestamp));
        } else {
            uint256 rank = game.joinedPlayers;
            _removePlayer(gameId, player);
            claims[gameId][player] = rank;
            _payoutReward(gameId, player, rank, turnCount);
            if (game.joinedPlayers == 1) {
                address remaining = _getRemainingPlayer(gameId);
                require(remaining != address(0), "No remaining player");
                users[gamePlayers[gameId][remaining].username].gamesWon++;
                game.status = TycoonLib.GameStatus.Ended;
                game.winner = remaining;
                game.endedAt = uint64(block.timestamp);
                codeToGame[game.code] = game;
                claims[gameId][remaining] = 1;
                _payoutReward(gameId, remaining, 1, type(uint256).max);
                if (userRegistry != address(0)) { try ITycoonUserRegistry(userRegistry).grantGameActionReward(remaining, keccak256("end_game")) {} catch {} }
                emit GameEnded(gameId, remaining, uint64(block.timestamp));
            }
        }
        emit PlayerExited(gameId, player);
    }

    function endAIGame(address actor, uint256 gameId, uint8 finalPosition, uint256 finalBalance, bool isWin) external returns (bool) {
        TycoonLib.Game storage game = games[gameId];
        require(game.ai, "Not an AI game");
        require(game.status == TycoonLib.GameStatus.Ongoing, "Game already ended");
        require(game.creator == actor, "Only creator can end AI game");
        gamePlayers[gameId][actor].position = finalPosition;
        gamePlayers[gameId][actor].balance = finalBalance;
        game.status = TycoonLib.GameStatus.Ended;
        game.winner = isWin ? actor : address(0);
        game.endedAt = uint64(block.timestamp);
        codeToGame[game.code] = game;
        TycoonLib.User storage user = users[gamePlayers[gameId][actor].username];
        uint256 voucherAmount = 0;
        TycoonLib.CollectiblePerk perk = TycoonLib.CollectiblePerk.NONE;
        uint256 strength = 1;
        if (isWin) {
            user.gamesWon++;
            if (addressVerified[actor]) {
                voucherAmount = 2 * TOKEN_REWARD;
                uint8 r = uint8(block.prevrandao % 100);
                if (r < 40) perk = TycoonLib.CollectiblePerk.EXTRA_TURN;
                else if (r < 65) perk = TycoonLib.CollectiblePerk.JAIL_FREE;
                else if (r < 80) perk = TycoonLib.CollectiblePerk.SHIELD;
                else if (r < 90) perk = TycoonLib.CollectiblePerk.TELEPORT;
                else if (r < 97) perk = TycoonLib.CollectiblePerk.ROLL_EXACT;
                else perk = TycoonLib.CollectiblePerk.PROPERTY_DISCOUNT;
            } else voucherAmount = CONSOLATION_VOUCHER;
        } else { voucherAmount = CONSOLATION_VOUCHER; user.gamesLost++; }
        if (voucherAmount > 0) rewardSystem.mintVoucher(actor, voucherAmount);
        if (perk != TycoonLib.CollectiblePerk.NONE) rewardSystem.mintCollectible(actor, perk, strength);
        codeToGame[game.code] = game;
        emit AIGameEnded(gameId, actor, uint64(block.timestamp));
        return true;
    }

    function _removePlayer(uint256 gameId, address playerToRemove) private {
        TycoonLib.Game storage game = games[gameId];
        TycoonLib.GamePlayer storage gp = gamePlayers[gameId][playerToRemove];
        users[gp.username].gamesLost++;
        uint8 order = gp.order;
        delete gamePlayers[gameId][playerToRemove];
        delete gameOrderToPlayer[gameId][order];
        claims[gameId][playerToRemove] = game.joinedPlayers;
        game.joinedPlayers--;
        emit PlayerRemoved(gameId, playerToRemove, uint64(block.timestamp));
    }

    function _getRemainingPlayer(uint256 gameId) private view returns (address) {
        TycoonLib.Game storage game = games[gameId];
        for (uint8 i = 1; i <= game.numberOfPlayers; i++) {
            address a = gameOrderToPlayer[gameId][i];
            if (a != address(0)) return a;
        }
        return address(0);
    }

    function _payoutReward(uint256 gameId, address player, uint256 rank, uint256 turnCount) private {
        TycoonLib.Game storage game = games[gameId];
        uint256 pot = game.totalStaked;
        IERC20 usdcToken = rewardSystem.usdc();
        if (pot == 0 || rank == 0) { rewardSystem.mintVoucher(player, CONSOLATION_VOUCHER); emit RewardClaimed(gameId, player, 0); return; }
        if (!addressVerified[player]) { rewardSystem.mintVoucher(player, CONSOLATION_VOUCHER); emit RewardClaimed(gameId, player, 0); return; }
        uint256 effectiveTurns = turnCount == type(uint256).max ? turnsPlayed[gameId][player] : turnCount;
        if (minTurnsForPerks > 0 && effectiveTurns < minTurnsForPerks) { rewardSystem.mintVoucher(player, CONSOLATION_VOUCHER); emit RewardClaimed(gameId, player, 0); return; }
        uint256 distributable = TycoonLib.getDistributablePot(pot);
        uint256 rewardAmount = TycoonLib.getRankRewardAmount(distributable, rank);
        if (rewardAmount == 0) { rewardSystem.mintVoucher(player, CONSOLATION_VOUCHER); emit RewardClaimed(gameId, player, 0); return; }
        uint256 available = usdcToken.balanceOf(address(this));
        if (available < rewardAmount) { rewardSystem.mintVoucher(player, CONSOLATION_VOUCHER); emit RewardClaimed(gameId, player, 0); return; }
        require(usdcToken.transfer(player, rewardAmount), "USDC transfer failed");
        require(bytes(addressToUsername[player]).length > 0, "Player not registered");
        users[addressToUsername[player]].totalEarned += rewardAmount;
        if (rank <= 3) _mintPlacementReward(player, rank);
        emit RewardClaimed(gameId, player, rewardAmount);
    }

    function _mintPlacementReward(address player, uint256 rank) private {
        require(rank <= 3, "Only top 3 get collectibles");
        TycoonLib.CollectiblePerk perk;
        uint256 strength = rank == 1 ? 2 : 1;
        uint8 r = uint8(block.prevrandao % 100);
        if (rank == 1) {
            if (r < 30) perk = TycoonLib.CollectiblePerk.JAIL_FREE;
            else if (r < 55) perk = TycoonLib.CollectiblePerk.SHIELD;
            else if (r < 75) perk = TycoonLib.CollectiblePerk.EXTRA_TURN;
            else if (r < 90) perk = TycoonLib.CollectiblePerk.TELEPORT;
            else perk = TycoonLib.CollectiblePerk.PROPERTY_DISCOUNT;
        } else if (rank == 2) {
            if (r < 35) perk = TycoonLib.CollectiblePerk.EXTRA_TURN;
            else if (r < 60) perk = TycoonLib.CollectiblePerk.JAIL_FREE;
            else if (r < 80) perk = TycoonLib.CollectiblePerk.ROLL_BOOST;
            else perk = TycoonLib.CollectiblePerk.PROPERTY_DISCOUNT;
        } else {
            if (r < 40) perk = TycoonLib.CollectiblePerk.ROLL_BOOST;
            else if (r < 70) perk = TycoonLib.CollectiblePerk.EXTRA_TURN;
            else if (r < 90) perk = TycoonLib.CollectiblePerk.PROPERTY_DISCOUNT;
            else perk = TycoonLib.CollectiblePerk.SHIELD;
        }
        if (perk != TycoonLib.CollectiblePerk.NONE) rewardSystem.mintCollectible(player, perk, strength);
        rewardSystem.mintVoucher(player, TOKEN_REWARD);
    }
}
