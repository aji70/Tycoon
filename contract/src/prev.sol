// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {TycoonLib} from "./TycoonLib.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "./Wallet.sol";

contract Tycoon is ReentrancyGuard, Ownable {
    using TycoonLib for TycoonLib.Game;
    using TycoonLib for TycoonLib.GamePlayer;
    using TycoonLib for TycoonLib.GameSettings;
    using TycoonLib for TycoonLib.Property;

    uint256 public totalUsers;
    uint256 public totalGames;
    uint256 private nextGameId = 1; // Start at 1 for cleaner IDs
    uint256 public houseBalance; // Tracks protocol fees from losers' pool
    address public immutable token; // in-game ERC20 token for staking/rewards
    uint256 public constant STAKE_AMOUNT = 1 * 10 ** 14; // 1 token stake per player
    // Add to storage (for efficient winner detection on low player counts)
    mapping(uint256 => mapping(uint8 => address)) public gameOrderToPlayer; // GameId => Order => Address (max 8)

    // -------------------------
    // 📌 Storage
    // -------------------------

    mapping(string => TycoonLib.User) public users;
    mapping(address => bool) public registered;
    mapping(address => string) public addressToUsername;
    mapping(uint256 => TycoonLib.Game) public games;
    mapping(uint256 => TycoonLib.GameSettings) public gameSettings;
    mapping(uint256 => mapping(uint8 => TycoonLib.Property)) public properties; // GameId => PropertyId => Property
    mapping(uint256 => mapping(address => TycoonLib.GamePlayer)) public gamePlayers; // GameId => PlayerAddress => Player

    // -------------------------
    // 📌 Events
    // -------------------------

    event PlayerCreated(string indexed username, address indexed player, uint64 timestamp);
    event GameCreated(uint256 indexed gameId, address indexed creator, uint64 timestamp);
    event PlayerJoined(uint256 indexed gameId, address indexed player, uint8 order);
    event DiceRolled(uint256 indexed gameId, address player, uint256 newPos);
    event PlayerRemoved(uint256 indexed gameId, address indexed player, uint64 timestamp);
    event GameEnded(uint256 indexed gameId, address indexed winner, uint64 timestamp);
    event RewardClaimed(uint256 indexed gameId, address indexed winner, uint256 amount);
    event AIGameEnded(uint256 indexed gameId, address indexed player, uint64 timestamp);
    event HouseWithdrawn(uint256 amount, address indexed owner);

    // constructor(address _token) {
    //     require(_token != address(0), "Invalid token address");
    //     token = _token;
    // }

    constructor(address initialOwner) Ownable(initialOwner) {
        // Optional: Uncomment and integrate token if needed
        // require(_token != address(0), "Invalid token address");
        // token = _token;
    }

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
        TycoonLib.GamePlayer storage gp = gamePlayers[gameId][player];
        require(gp.playerAddress != address(0), "Target not in game");
        require(gp.order == game.nextPlayer, "Not your turn");
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
        addressToUsername[msg.sender] = username;
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
    ) public payable onlyRegistered nonReentrant nonEmptyUsername(creatorUsername) returns (uint256) {
        require(numberOfPlayers >= 2 && numberOfPlayers <= 8, "Invalid player count");
        require(bytes(gameType).length > 0, "Invalid game type");
        require(msg.value == STAKE_AMOUNT, "Incorrect stake amount");
        require(bytes(playerSymbol).length > 0, "Invalid player symbol");
        require(startingBalance > 0, "Invalid starting balance");

        TycoonLib.User storage user = users[creatorUsername];
        require(user.playerAddress != address(0), "User not registered");
        require(user.playerAddress == msg.sender, "Must use own username");
        address creator = user.playerAddress;
        user.gamesPlayed += 1;
        user.totalStaked += STAKE_AMOUNT;

        uint8 gType = TycoonLib.stringToGameType(gameType);
        if (gType == uint8(TycoonLib.GameType.PrivateGame)) {
            require(bytes(code).length > 0, "Private code required");
        }
        uint8 pSym = TycoonLib.stringToPlayerSymbol(playerSymbol);

        uint256 gameId = nextGameId++;

        // Initialize game settings
        gameSettings[gameId] = TycoonLib.GameSettings({
            maxPlayers: numberOfPlayers,
            auction: true, // default
            rentInPrison: true, // default
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
        // In createGame, after setting gamePlayers[gameId][creator]:
        gameOrderToPlayer[gameId][1] = creator;

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
    ) public payable onlyRegistered nonReentrant nonEmptyUsername(creatorUsername) returns (uint256) {
        require(numberOfAI >= 1 && numberOfAI <= 7, "Invalid AI count: 1-7");
        require(msg.value == STAKE_AMOUNT, "Incorrect stake amount");
        require(bytes(gameType).length > 0, "Invalid game type");
        require(bytes(playerSymbol).length > 0, "Invalid player symbol");
        require(startingBalance > 0, "Invalid starting balance");

        TycoonLib.User storage user = users[creatorUsername];
        require(user.playerAddress != address(0), "User not registered");
        require(user.playerAddress == msg.sender, "Must use own username");
        address creator = user.playerAddress;
        user.gamesPlayed += 1;
        user.totalStaked += STAKE_AMOUNT;

        uint8 gType = TycoonLib.stringToGameType(gameType);
        uint8 pSym = TycoonLib.stringToPlayerSymbol(playerSymbol);

        uint256 gameId = nextGameId++;

        uint8 totalPlayers = 1 + numberOfAI;

        // Initialize game settings
        gameSettings[gameId] = TycoonLib.GameSettings({
            maxPlayers: totalPlayers,
            auction: true, // default
            rentInPrison: true, // default
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
        // Set dummy AI orders for consistency (virtual, no full GamePlayer)
        gameOrderToPlayer[gameId][1] = creator;
        for (uint8 i = 2; i <= totalPlayers; i++) {
            address dummyAI = address(uint160(i)); // Simple dummy addresses
            gameOrderToPlayer[gameId][i] = dummyAI;
            // Minimal AI state (optional, for views)
            gamePlayers[gameId][dummyAI] = TycoonLib.GamePlayer({
                gameId: gameId,
                playerAddress: dummyAI,
                balance: startingBalance,
                position: 0,
                order: i,
                symbol: TycoonLib.PlayerSymbol(uint8(0)), // Default symbol
                username: string(abi.encodePacked("AI_", uint2str(i)))
            });
        }

        totalGames++;
        emit GameCreated(gameId, creator, uint64(block.timestamp));
        return gameId;
    }

    function joinGame(uint256 gameId, string memory playerUsername, string memory playerSymbol, string memory joinCode)
        public
        payable
        onlyRegistered
        nonReentrant
        nonEmptyUsername(playerUsername)
        returns (uint8)
    {
        TycoonLib.Game storage game = games[gameId];
        require(game.ai == false, "Cannot join AI game"); // Prevent joins to AI games
        require(msg.value == STAKE_AMOUNT, "Incorrect stake amount");
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

        // In joinGame, after setting gamePlayers[gameId][player]:
        gameOrderToPlayer[gameId][order] = player;
        emit PlayerJoined(gameId, player, order);

        if (game.joinedPlayers == game.numberOfPlayers) {
            game.status = TycoonLib.GameStatus.Ongoing;
        }
        return order;
    }

    // Updated removePlayerFromGame (params switched to addresses for backend ease; usernames optional via views)
    function removePlayerFromGame(uint256 gameId, address playerToRemove)
        // address finalCandidate // Optional for final phase; auto-detect otherwise
        public
        onlyRegistered
        nonReentrant
        returns (bool)
    {
        TycoonLib.Game storage game = games[gameId];
        require(game.ai == false, "Cannot remove from AI game");
        require(game.creator != address(0), "Game not found");
        require(game.status == TycoonLib.GameStatus.Ongoing, "Game not ongoing");
        require(gamePlayers[gameId][playerToRemove].playerAddress != address(0), "Player not in game");

        // Only self or creator can remove
        require(msg.sender == playerToRemove || msg.sender == game.creator, "Unauthorized removal");

        // Find usernames for stats (via existing mapping)
        string memory removeUsername = gamePlayers[gameId][playerToRemove].username;
        TycoonLib.User storage userLost = users[removeUsername];
        userLost.gamesLost += 1;

        // No refund: Stake stays in pot (per design)

        // Clear mappings
        uint8 removeOrder = gamePlayers[gameId][playerToRemove].order;
        delete gamePlayers[gameId][playerToRemove];
        delete gameOrderToPlayer[gameId][removeOrder];
        game.joinedPlayers -= 1;

        emit PlayerRemoved(gameId, playerToRemove, uint64(block.timestamp));

        // If one player left, auto-end as winner
        if (game.joinedPlayers == 1) {
            // Auto-detect remaining player
            address winnerAddr = address(0);
            for (uint8 i = 1; i <= game.numberOfPlayers; i++) {
                address potential = gameOrderToPlayer[gameId][i];
                if (potential != address(0)) {
                    winnerAddr = potential;
                    break;
                }
            }
            require(winnerAddr != address(0), "No remaining player found"); // Safety

            string memory winnerUsername = gamePlayers[gameId][winnerAddr].username;
            TycoonLib.User storage winnerUser = users[winnerUsername];
            winnerUser.gamesWon += 1;

            game.status = TycoonLib.GameStatus.Ended;
            game.winner = winnerAddr;
            game.endedAt = uint64(block.timestamp);

            emit GameEnded(gameId, winnerAddr, uint64(block.timestamp));
        }

        return true;
    }

    /**
     * @dev Ends an AI game when the human player wins. Refunds the stake (no pot from AI).
     * Call this after off-chain AI simulation determines win. Updates position as final.
     * Also handles human concession (loss) via a separate path.
     */
    function endAIGame(
        uint256 gameId,
        uint8 finalPosition,
        uint256 finalBalance,
        uint8 finalPropertyId,
        bool isWin // New param: true for win (refund + earned), false for loss (no refund)
    ) public nonReentrant isPlayerInGame(gameId, msg.sender) returns (bool) {
        TycoonLib.Game storage game = games[gameId];
        require(game.ai == true, "Not an AI game");
        require(game.status == TycoonLib.GameStatus.Ongoing, "Game already ended");
        require(game.creator == msg.sender, "Only creator can end AI game");
        require(finalPosition < TycoonLib.BOARD_SIZE, "Invalid final position");
        require(finalBalance <= gameSettings[gameId].startingCash * 2, "Invalid final balance"); // Cap to prevent fakes

        // Update final player position/balance
        TycoonLib.GamePlayer storage gp = gamePlayers[gameId][msg.sender];
        gp.position = finalPosition;
        gp.balance = finalBalance;

        if (finalPropertyId != 0 && finalPropertyId < TycoonLib.BOARD_SIZE) {
            // Only set owner; id and gameId are redundant (mapping keys)
            properties[gameId][finalPropertyId].owner = msg.sender;
        }

        // End game
        game.status = TycoonLib.GameStatus.Ended;
        game.winner = isWin ? msg.sender : address(0);
        game.endedAt = uint64(block.timestamp);

        TycoonLib.User storage user = users[gp.username];
        if (isWin) {
            // Win: Refund stake + track as earned
            (bool success,) = payable(msg.sender).call{value: STAKE_AMOUNT}("");
            require(success, "Refund failed");
            user.gamesWon += 1;
            user.totalEarned += STAKE_AMOUNT;
            emit AIGameEnded(gameId, msg.sender, uint64(block.timestamp));
        } else {
            // Loss: No refund (stake to house), track loss
            houseBalance += STAKE_AMOUNT;
            user.gamesLost += 1;
            emit AIGameEnded(gameId, msg.sender, uint64(block.timestamp)); // Reuse event, or add Loss variant
        }

        game.totalStaked = 0; // Clear in both cases

        return true;
    }

    function claimReward(uint256 gameId) public nonReentrant isPlayerInGame(gameId, msg.sender) returns (uint256) {
        TycoonLib.Game storage game = games[gameId];
        require(game.status == TycoonLib.GameStatus.Ended, "Game not ended");
        require(game.ai == false, "Use endAIGame for AI rewards");
        require(game.winner == msg.sender, "Not the winner");
        require(game.totalStaked >= 2 * STAKE_AMOUNT, "Min 2 players required"); // Your rule

        uint256 pot = game.totalStaked;
        uint256 losersPool = pot - STAKE_AMOUNT; // Exclude winner's stake
        uint256 reward = STAKE_AMOUNT + (losersPool / 2); // Own + half losers
        uint256 houseCut = losersPool / 2; // Other half to house

        game.totalStaked = 0; // Clear pot
        houseBalance += houseCut; // Accrue (withdraw via owner func later)

        // Safe ETH transfer (better than transfer for gas/compatibility)
        (bool success,) = payable(msg.sender).call{value: reward}("");
        require(success, "Transfer failed");

        TycoonLib.User storage user = users[gamePlayers[gameId][msg.sender].username];
        user.totalEarned += reward;

        emit RewardClaimed(gameId, msg.sender, reward);
        return reward;
    }

    // -------------------------
    // 📌 House Management
    // -------------------------

    /**
     * @dev Owner withdraws from house balance.
     */
    function withdrawHouse(uint256 amount) external onlyOwner {
        require(amount <= houseBalance, "Insufficient house balance");
        houseBalance -= amount;
        (bool success,) = payable(owner()).call{value: amount}("");
        require(success, "Withdrawal failed");
        emit HouseWithdrawn(amount, owner());
    }

    // -------------------------
    // 📌 Gameplay
    // -------------------------

    function updatePlayerPosition(
        uint256 gameId,
        address targetPlayer,
        uint8 newPosition,
        uint256 newBalance,
        int256 balanceDelta, // New: For validation
        uint8[] calldata propertyIds // New: Array for multiple properties
    ) public onlyRegistered nonReentrant isCurrentPlayer(gameId, targetPlayer) returns (bool) {
        TycoonLib.Game storage game = games[gameId];
        require(game.status == TycoonLib.GameStatus.Ongoing, "Game not ongoing");
        require(targetPlayer != address(0), "Invalid target player");
        require(newPosition < TycoonLib.BOARD_SIZE, "Invalid position");
        // Allow self or oracle for AI (add oracle check if needed)

        TycoonLib.GamePlayer storage gp = gamePlayers[gameId][targetPlayer];
        // Balance validation (simple delta check; expand as needed)
        require(balanceDelta >= -1000, "Excessive loss");
        uint256 expectedBalance;
        if (balanceDelta >= 0) {
            expectedBalance = gp.balance + uint256(balanceDelta);
        } else {
            uint256 loss = uint256(-balanceDelta);
            require(gp.balance >= loss, "Insufficient balance for loss");
            expectedBalance = gp.balance - loss;
        }
        require(newBalance == expectedBalance, "Invalid balance change");

        gp.position = newPosition;
        gp.balance = newBalance;

        // Multiple property updates - use a helper to avoid stack issues
        _updateProperties(gameId, targetPlayer, propertyIds);

        // Advance turn
        game.nextPlayer = game.nextPlayer % game.numberOfPlayers + 1;

        emit DiceRolled(gameId, targetPlayer, newPosition);

        return true;
    }

    function _updateProperties(uint256 gameId, address owner, uint8[] calldata propIds) internal {
        for (uint256 i = 0; i < propIds.length; i++) {
            uint8 propId = propIds[i];
            if (propId != 0 && propId < TycoonLib.BOARD_SIZE) {
                // Only set owner; id and gameId are redundant (mapping keys)
                properties[gameId][propId].owner = owner;
            }
        }
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

    function getGamePlayerByAddress(uint256 gameId, address playerAddr) public view returns (TycoonLib.GamePlayer memory) {
        return gamePlayers[gameId][playerAddr];
    }

    function getProperty(uint256 gameId, uint8 propertyId) public view returns (TycoonLib.Property memory) {
        require(propertyId < TycoonLib.BOARD_SIZE, "Property not found");
        return properties[gameId][propertyId];
    }

    function getGameSettings(uint256 gameId) public view returns(TycoonLib.GameSettings memory settings){
        settings = gameSettings[gameId];
        return settings;
    }

    // Helper for uint to string (for AI usernames)
    function uint2str(uint256 _i) internal pure returns (string memory str) {
        if (_i == 0) return "0";
        uint256 j = _i;
        uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bstr[k] = bytes1(temp);
            _i /= 10;
        }
        str = string(bstr);
    }
}