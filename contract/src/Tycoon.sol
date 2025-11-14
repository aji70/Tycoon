// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {TycoonLib} from "./TycoonLib.sol";
import "./Wallet.sol";

contract Tycoon is ReentrancyGuard {
    using TycoonLib for TycoonLib.Game;
    using TycoonLib for TycoonLib.GamePlayer;
    using TycoonLib for TycoonLib.GameSettings;
    using TycoonLib for TycoonLib.Property;

    uint256 public totalUsers;
    uint256 public totalGames;
    uint256 private nextGameId = 1; // Start at 1 for cleaner IDs
    address public immutable token; // in-game ERC20 token for staking/rewards
    uint256 public constant STAKE_AMOUNT = 1 * 10 ** 18; // 1 token stake per player

    // -------------------------
    // 📌 Storage
    // -------------------------

    mapping(string => TycoonLib.User) public users;
    mapping(address => bool) public registered;
    mapping(uint256 => TycoonLib.Game) public games;
    mapping(uint256 => TycoonLib.GameSettings) public gameSettings;
    mapping(uint256 => mapping(uint8 => TycoonLib.Property)) public properties; // GameId => PropertyId => Property
    mapping(uint256 => mapping(address => TycoonLib.GamePlayer)) public gamePlayers; // GameId => PlayerAddress => Player

    // -------------------------
    // 📌 Events
    // -------------------------

    event PlayerCreated(string indexed username, address indexed player, uint64 timestamp);
    event GameCreated(uint256 indexed gameId, address indexed creator, uint64 timestamp);
    event DiceRolled(uint256 indexed gameId, address player, uint256 die1, uint256 die2, uint256 newPos);
    event PlayerRemoved(uint256 indexed gameId, address indexed player, uint64 timestamp);
    event GameEnded(uint256 indexed gameId, address indexed winner, uint64 timestamp);
    event RewardClaimed(uint256 indexed gameId, address indexed winner, uint256 amount);
    event AIGameEnded(uint256 indexed gameId, address indexed player, uint64 timestamp);

    // constructor(address _token) {
    //     require(_token != address(0), "Invalid token address");
    //     token = _token;
    // }

    // -------------------------
    // 📌 Modifiers
    // -------------------------

    modifier onlyRegistered() {
        require(registered[msg.sender], "not registered");
        _;
    }

    modifier nonEmptyUsername(string memory username) {
        require(bytes(username).length > 0, "Username cannot be empty");
        _;
    }

    modifier isPlayerInGame(uint256 gameId, address player) {
        require(gamePlayers[gameId][player].playerAddress != address(0), "Not in game");
        _;
    }

    modifier isCurrentPlayer(uint256 gameId, address player) {
        TycoonLib.Game storage game = games[gameId];
        require(gamePlayers[gameId][player].order == game.nextPlayer, "Not your turn");
        _;
    }

    // -------------------------
    // 📌 Player Management
    // -------------------------

    /**
     * @dev Registers a new player with a username (no NFT/wallet).
     */
    function registerPlayer(string memory username) public nonEmptyUsername(username) returns (uint256) {
        require(users[username].playerAddress == address(0), "Username taken");
        require(!registered[msg.sender], "already registered");
        totalUsers++;
        uint64 nowTime = uint64(block.timestamp);

        users[username] = TycoonLib.User({
            id: totalUsers,
            username: username,
            playerAddress: msg.sender,
            registeredAt: nowTime,
            gamesPlayed: 0,
            gamesWon: 0,
            gamesLost: 0,
            totalStaked: 0,
            totalEarned: 0,
            totalWithdrawn: 0
        });

        registered[msg.sender] = true;
        emit PlayerCreated(username, msg.sender, nowTime);
        return totalUsers;
    }

    // -------------------------
    // 📌 Game Lifecycle
    // -------------------------

    function createGame(
        string memory creatorUsername,
        string memory gameType,
        string memory playerSymbol,
        uint8 numberOfPlayers,
        string memory code,
        uint256 startingBalance
    ) public onlyRegistered nonReentrant nonEmptyUsername(creatorUsername) returns (uint256) {
        require(numberOfPlayers >= 2 && numberOfPlayers <= 8, "Invalid player count");
        require(bytes(gameType).length > 0, "Invalid game type");
        require(bytes(playerSymbol).length > 0, "Invalid player symbol");
        require(startingBalance > 0, "Invalid starting balance");

        TycoonLib.User storage user = users[creatorUsername];
        require(user.playerAddress != address(0), "User not registered");
        require(user.playerAddress == msg.sender, "Must use own username");
        address creator = user.playerAddress;
        user.gamesPlayed += 1;
        user.totalStaked += STAKE_AMOUNT;

        // Stake tokens directly from msg.sender
        // IERC20(token).transferFrom(msg.sender, address(this), STAKE_AMOUNT);

        uint8 gType = TycoonLib.stringToGameType(gameType);
        uint8 pSym = TycoonLib.stringToPlayerSymbol(playerSymbol);

        uint256 gameId = nextGameId++;

        // Initialize game settings
        gameSettings[gameId] = TycoonLib.GameSettings({
            maxPlayers: numberOfPlayers,
            auction: true, // default
            rentInPrison: false, // default
            mortgage: true, // default
            evenBuild: true, // default
            startingCash: startingBalance,
            privateRoomCode: code // reuse code for private if needed
        });

        games[gameId] = TycoonLib.Game({
            id: gameId,
            code: code,
            creator: creator,
            status: TycoonLib.GameStatus.Pending,
            nextPlayer: 1,
            winner: address(0),
            numberOfPlayers: numberOfPlayers,
            joinedPlayers: 1,
            mode: TycoonLib.GameType(gType),
            ai: false,
            createdAt: uint64(block.timestamp),
            endedAt: 0,
            totalStaked: STAKE_AMOUNT // Start with creator's stake
        });

        // Register creator in game
        gamePlayers[gameId][creator] = TycoonLib.GamePlayer({
            gameId: gameId,
            playerAddress: creator,
            balance: startingBalance,
            position: 0,
            order: 1,
            symbol: TycoonLib.PlayerSymbol(pSym),
            username: user.username
        });

        totalGames++;
        emit GameCreated(gameId, creator, uint64(block.timestamp));
        return gameId;
    }

    /**
     * @dev Creates a game against AI opponents. Only the creator stakes; AI does not.
     * Game starts as Ongoing. Off-chain AI logic handles moves and calls updates.
     * For simplicity, this is a solo human vs. virtual AI (no AI addresses stored).
     * User can call endAIGame to claim win and get stake back.
     */
    function createAIGame(
        string memory creatorUsername,
        string memory gameType,
        string memory playerSymbol,
        uint8 numberOfAI, // Number of AI opponents (total players = 1 + numberOfAI)
        string memory code,
        uint256 startingBalance
    ) public onlyRegistered nonReentrant nonEmptyUsername(creatorUsername) returns (uint256) {
        require(numberOfAI >= 1 && numberOfAI <= 7, "Invalid AI count: 1-7");
        require(bytes(gameType).length > 0, "Invalid game type");
        require(bytes(playerSymbol).length > 0, "Invalid player symbol");
        require(startingBalance > 0, "Invalid starting balance");

        TycoonLib.User storage user = users[creatorUsername];
        require(user.playerAddress != address(0), "User not registered");
        require(user.playerAddress == msg.sender, "Must use own username");
        address creator = user.playerAddress;
        user.gamesPlayed += 1;
        user.totalStaked += STAKE_AMOUNT;

        // Stake tokens directly from msg.sender (only human stakes)
        // IERC20(token).transferFrom(msg.sender, address(this), STAKE_AMOUNT);

        uint8 gType = TycoonLib.stringToGameType(gameType);
        uint8 pSym = TycoonLib.stringToPlayerSymbol(playerSymbol);

        uint256 gameId = nextGameId++;

        uint8 totalPlayers = 1 + numberOfAI;

        // Initialize game settings
        gameSettings[gameId] = TycoonLib.GameSettings({
            maxPlayers: totalPlayers,
            auction: true, // default
            rentInPrison: false, // default
            mortgage: true, // default
            evenBuild: true, // default
            startingCash: startingBalance,
            privateRoomCode: code
        });

        games[gameId] = TycoonLib.Game({
            id: gameId,
            code: code,
            creator: creator,
            status: TycoonLib.GameStatus.Ongoing, // Starts immediately vs AI
            nextPlayer: 1,
            winner: address(0),
            numberOfPlayers: totalPlayers,
            joinedPlayers: 1, // Only human joined; AI virtual
            mode: TycoonLib.GameType(gType),
            ai: true,
            createdAt: uint64(block.timestamp),
            endedAt: 0,
            totalStaked: STAKE_AMOUNT // Only human stake
        });

        // Register creator (human) in game
        gamePlayers[gameId][creator] = TycoonLib.GamePlayer({
            gameId: gameId,
            playerAddress: creator,
            balance: startingBalance,
            position: 0,
            order: 1,
            symbol: TycoonLib.PlayerSymbol(pSym),
            username: user.username
        });

        totalGames++;
        emit GameCreated(gameId, creator, uint64(block.timestamp));
        return gameId;
    }

    function joinGame(uint256 gameId, string memory playerUsername, string memory playerSymbol, string memory joinCode)
        public
        onlyRegistered
        nonReentrant
        nonEmptyUsername(playerUsername)
        returns (uint8)
    {
        TycoonLib.Game storage game = games[gameId];
        require(game.ai == false, "Cannot join AI game"); // Prevent joins to AI games
        require(game.creator != address(0), "Game not found");
        require(game.status == TycoonLib.GameStatus.Pending, "Game not open");
        require(game.joinedPlayers < game.numberOfPlayers, "Game full");
        TycoonLib.User storage user = users[playerUsername];
        require(user.playerAddress != address(0), "User not registered");
        require(user.playerAddress == msg.sender, "Must use own username");
        address player = user.playerAddress;
        require(gamePlayers[gameId][player].playerAddress == address(0), "Already joined");
        require(bytes(playerSymbol).length > 0, "Invalid player symbol");

        // Enforce private code if applicable
        if (game.mode == TycoonLib.GameType.PrivateGame) {
            require(keccak256(bytes(joinCode)) == keccak256(bytes(game.code)), "Invalid private code");
        }

        user.gamesPlayed += 1;
        user.totalStaked += STAKE_AMOUNT;

        // Stake tokens directly from msg.sender
        // IERC20(token).transferFrom(msg.sender, address(this), STAKE_AMOUNT);
        game.totalStaked += STAKE_AMOUNT;

        uint8 pSym = TycoonLib.stringToPlayerSymbol(playerSymbol);

        uint8 order = game.joinedPlayers + 1;
        game.joinedPlayers++;

        gamePlayers[gameId][player] = TycoonLib.GamePlayer({
            gameId: gameId,
            playerAddress: player,
            balance: gameSettings[gameId].startingCash,
            position: 0,
            order: order,
            symbol: TycoonLib.PlayerSymbol(pSym),
            username: user.username
        });

        if (game.joinedPlayers == game.numberOfPlayers) {
            game.status = TycoonLib.GameStatus.Ongoing;
        }
        return order;
    }

    function removePlayerFromGame(
        uint256 gameId,
        string memory playerUsername,
        string memory finalCandidateUsername
    ) public onlyRegistered nonReentrant returns (bool) {
        TycoonLib.Game storage game = games[gameId];
        require(game.ai == false, "Cannot remove from AI game"); // AI games handled differently
        require(game.creator != address(0), "Game not found");
        require(game.status == TycoonLib.GameStatus.Ongoing, "Game not ongoing");
        require(bytes(playerUsername).length > 0, "Invalid player username");
        TycoonLib.User storage userLost = users[playerUsername];
        require(userLost.playerAddress != address(0), "User not registered");
        address player = userLost.playerAddress;
        require(gamePlayers[gameId][player].playerAddress != address(0), "Player not in game");

        // Only allow removal by the player themselves or creator (to prevent griefing)
        require(msg.sender == player || msg.sender == game.creator, "Unauthorized removal");

        bool isFinalPhase = TycoonLib.isFinalPhase(game.joinedPlayers);
        address finalCandidate;
        if (isFinalPhase) {
            require(bytes(finalCandidateUsername).length > 0, "Remaining player required");
            TycoonLib.User storage finalUser = users[finalCandidateUsername];
            require(finalUser.playerAddress != address(0), "Remaining player not registered");
            finalCandidate = finalUser.playerAddress;
            require(finalCandidate != player, "Candidate was removed");
            require(gamePlayers[gameId][finalCandidate].playerAddress != address(0), "Remaining player not in game");
        }

        // Update player lost
        userLost.gamesLost += 1;

        // Remove the player
        delete gamePlayers[gameId][player];
        game.joinedPlayers -= 1;

        emit PlayerRemoved(gameId, player, uint64(block.timestamp));

        // If only one player remains, finalize game
        if (game.joinedPlayers <= 1) {
            address winnerAddr = address(0);
            string memory winnerUsername;
            if (finalCandidate != address(0)) {
                winnerAddr = finalCandidate;
                // Find username (simple, but inefficient; track in game if needed)
                // For now, assume provided via param
                winnerUsername = finalCandidateUsername;
            } else {
                // Handle 1-player left: find the remaining one (placeholder - add player list storage for real)
                revert("No winner identified");
            }

            game.status = TycoonLib.GameStatus.Ended;
            game.winner = winnerAddr;
            game.endedAt = uint64(block.timestamp);

            TycoonLib.User storage winnerUser = users[winnerUsername];
            winnerUser.gamesWon += 1;

            emit GameEnded(gameId, winnerAddr, uint64(block.timestamp));
        }

        return true;
    }

    /**
     * @dev Ends an AI game when the human player wins. Refunds the stake (no pot from AI).
     * Call this after off-chain AI simulation determines win. Updates position as final.
     */
    function endAIGame(
        uint256 gameId,
        uint8 finalPosition,
        uint256 finalBalance,
        uint8 finalPropertyId
    ) public nonReentrant isPlayerInGame(gameId, msg.sender) returns (bool) {
        TycoonLib.Game storage game = games[gameId];
        require(game.ai == true, "Not an AI game");
        require(game.status == TycoonLib.GameStatus.Ongoing, "Game already ended");
        require(game.creator == msg.sender, "Only creator can end AI game");
        require(finalPosition < TycoonLib.BOARD_SIZE, "Invalid final position");

        // Update final player position/balance/property before ending
        TycoonLib.GamePlayer storage gp = gamePlayers[gameId][msg.sender];
        gp.position = finalPosition;
        gp.balance = finalBalance;

        if (finalPropertyId != 0 && finalPropertyId < TycoonLib.BOARD_SIZE) {
            TycoonLib.Property storage prop = properties[gameId][finalPropertyId];
            prop.id = finalPropertyId;
            prop.gameId = gameId;
            prop.owner = msg.sender;
        }

        // End game
        game.status = TycoonLib.GameStatus.Ended;
        game.winner = msg.sender;
        game.endedAt = uint64(block.timestamp);

        // Refund stake (for now, just get back own stake)
        // IERC20(token).transfer(msg.sender, STAKE_AMOUNT);
        game.totalStaked = 0;

        TycoonLib.User storage user = users[gp.username];
        user.gamesWon += 1;
        user.totalEarned += STAKE_AMOUNT;

        emit AIGameEnded(gameId, msg.sender, uint64(block.timestamp));
        return true;
    }

    function claimReward(uint256 gameId) public nonReentrant isPlayerInGame(gameId, msg.sender) returns (uint256) {
        TycoonLib.Game storage game = games[gameId];
        require(game.status == TycoonLib.GameStatus.Ended, "Game not ended");
        require(game.winner == msg.sender, "Not the winner");
        require(game.totalStaked > 0, "No reward to claim");
        require(game.ai == false, "Use endAIGame for AI rewards"); // AI handled separately

        uint256 reward = game.totalStaked;
        game.totalStaked = 0; // Prevent double-claim

        // Optional bonus based on turns (add totalTurns param if tracking)
        // uint256 totalTurns = ...; // Track on-chain or pass as param
        // if (totalTurns >= TycoonLib.MIN_TURNS_FOR_BONUS) {
        //     reward += (STAKE_AMOUNT * TycoonLib.WINNER_REWARD_MULTIPLIER) / TycoonLib.REWARD_DIVISOR;
        // }

        // IERC20(token).transfer(msg.sender, reward);

        TycoonLib.User storage user = users[gamePlayers[gameId][msg.sender].username];
        user.totalEarned += reward;

        emit RewardClaimed(gameId, msg.sender, reward);
        return reward;
    }

    // -------------------------
    // 📌 Gameplay
    // -------------------------

    function updatePlayerPosition(
        uint256 gameId,
        uint8 newPosition,
        uint256 newBalance,
        uint8 propertyId,
        uint256 die1,
        uint256 die2
    ) public onlyRegistered nonReentrant returns (bool) {
        TycoonLib.Game storage game = games[gameId];
        require(game.status == TycoonLib.GameStatus.Ongoing, "Game not ongoing");
        require(gamePlayers[gameId][msg.sender].playerAddress != address(0), "Not in game");
        require(gamePlayers[gameId][msg.sender].order == game.nextPlayer, "Not your turn");
        require(newPosition < TycoonLib.BOARD_SIZE, "Invalid position");
        require(die1 >= 1 && die1 <= 6 && die2 >= 1 && die2 <= 6, "Invalid dice");

        TycoonLib.GamePlayer storage gp = gamePlayers[gameId][msg.sender];
        gp.position = newPosition;
        gp.balance = newBalance;

        // Simple property ownership update (self-validation off-chain; on-chain only records)
        if (propertyId != 0 && propertyId < TycoonLib.BOARD_SIZE) {
            TycoonLib.Property storage prop = properties[gameId][propertyId];
            prop.id = propertyId;
            prop.gameId = gameId;
            prop.owner = msg.sender;
        }

        // Advance turn
        game.nextPlayer = game.nextPlayer % game.numberOfPlayers + 1;

        emit DiceRolled(gameId, msg.sender, die1, die2, newPosition);

        return true;
    }

    // -------------------------
    // 📌 Views & Helpers
    // -------------------------

    function getUser(string memory username) public view returns (TycoonLib.User memory) {
        require(users[username].playerAddress != address(0), "User not registered");
        return users[username];
    }

    function getGame(uint256 gameId) public view returns (TycoonLib.Game memory) {
        require(games[gameId].creator != address(0), "Game not found");
        return games[gameId];
    }

    function getGamePlayer(uint256 gameId, string memory username) public view returns (TycoonLib.GamePlayer memory) {
        TycoonLib.User storage user = users[username];
        require(user.playerAddress != address(0), "User not registered");
        address playerAddr = user.playerAddress;
        require(gamePlayers[gameId][playerAddr].playerAddress != address(0), "Player not in game");
        return gamePlayers[gameId][playerAddr];
    }

    function getProperty(uint256 gameId, uint8 propertyId) public view returns (TycoonLib.Property memory) {
        require(propertyId < TycoonLib.BOARD_SIZE, "Property not found");
        return properties[gameId][propertyId];
    }
}