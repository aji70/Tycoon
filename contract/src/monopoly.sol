// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Blockopoly {
uint256 public totalUsers;
uint256 public totalGames;
uint256 private nextGameId;
uint256 public constant BOARD_SIZE = 40; // Monopoly-style board

// -------------------------
// 📌 Structs
// -------------------------

struct User {
    uint256 id;
    string username;
    address playerAddress;
    uint64 registeredAt;
    uint256 gamesPlayed;
    uint256 gamesWon;
    uint256 gamesLost;
    uint256 totalStaked;
    uint256 totalEarned;
    uint256 totalWithdrawn;
}

enum GameStatus { Pending, Ongoing, Ended }
enum GameType   { PublicGame, PrivateGame }
enum PlayerSymbol {
    Hat, Car, Dog, Thimble, Iron,
    Battleship, Boot, Wheelbarrow
}

struct Game {
    uint256 id;
    string code;
    address creator;
    GameStatus status;
    uint256 nextPlayer; // 1-based index of current turn
    address winner;
    uint8 numberOfPlayers;
    uint8 joinedPlayers;
    GameType mode;
    uint64 createdAt;
    uint64 endedAt;
}

struct GamePlayer {
    uint256 gameId;
    address playerAddress;
    uint256 balance;
    uint8 position;
    uint8 order;
    PlayerSymbol symbol;
    bool chanceJailCard;
    bool communityChestJailCard;
    string username;
}

struct GameSettings {
    uint8 maxPlayers;
    bool auction;
    bool rentInPrison;
    bool mortgage;
    bool evenBuild;
    uint256 startingCash;
    bool randomizePlayOrder;
    string privateRoomCode; // Optional if private
}

struct Property {
    uint8 id;
    uint256 gameId;
    address owner;
}

// -------------------------
// 📌 Storage
// -------------------------

mapping(address => User) public users;
mapping(string => address) private usernameToAddress; // to enforce unique usernames
mapping(uint256 => address) private userIdToAddress;  // lookup by sequential ID
mapping(address => bool) public isRegistered;
mapping(address => string) public addressToUsername;

mapping(uint256 => Game) public games;
mapping(uint256 => GameSettings) public gameSettings;
mapping(uint256 => mapping(uint256 => Property)) public properties;
mapping(uint256 => mapping(address => GamePlayer)) public gamePlayers; // GameId => Player

// -------------------------
// 📌 Events
// -------------------------

event PlayerCreated(string indexed username, address indexed player, uint64 timestamp);
event GameCreated(uint256 indexed gameId, address indexed creator, uint64 timestamp);
event DiceRolled(uint256 indexed gameId, address player, uint256 die1, uint256 die2, uint256 newPos);

// -------------------------
// 📌 Modifiers
// -------------------------

modifier onlyRegistered() {
  require(isRegistered[msg.sender], "Player not registered");
    _;
}

modifier nonEmptyUsername(string memory username) {
    require(bytes(username).length > 0, "Username cannot be empty");
    _;
}

// -------------------------
// 📌 Player Management
// -------------------------

function registerPlayer(string memory username)
    public
    nonEmptyUsername(username)
    returns (uint256)
{
    require(usernameToAddress[username] == address(0), "Username taken");
    require(users[msg.sender].playerAddress == address(0), "Already registered");

    totalUsers++;
    uint64 nowTime = uint64(block.timestamp);
    isRegistered[msg.sender] = true;

    users[msg.sender] = User({
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

    usernameToAddress[username] = msg.sender;
    userIdToAddress[totalUsers] = msg.sender;
    addressToUsername[msg.sender] = username;

    emit PlayerCreated(username, msg.sender, nowTime);
    return totalUsers;
}

// -------------------------
// 📌 Game Lifecycle
// -------------------------

function createGame(
    string memory gameType,
    string memory playerSymbol,
    uint8 numberOfPlayers,
    string memory code,
    uint256 startingBalance
) public onlyRegistered returns (uint256) {
    require(numberOfPlayers >= 2 && numberOfPlayers <= 8, "Invalid player count");

    uint8 gType = _stringToGameType(gameType);
    uint8 pSym  = _stringToPlayerSymbol(playerSymbol);

    uint256 gameId = nextGameId++;

    games[gameId] = Game({
        id: gameId,
        code: code,
        creator: msg.sender,
        status: GameStatus.Pending,
        nextPlayer: 1,
        winner: address(0),
        numberOfPlayers: numberOfPlayers,
        joinedPlayers: 1,
        mode: GameType(gType),
        createdAt: uint64(block.timestamp),
        endedAt: 0
    });

    // Register creator in game
    gamePlayers[gameId][msg.sender] = GamePlayer({
        gameId: gameId,
        playerAddress: msg.sender,
        balance: startingBalance,
        position: 0,
        order: 1,
        symbol: PlayerSymbol(pSym),
        chanceJailCard: false,
        communityChestJailCard: false,
        username: users[msg.sender].username
    });

    totalGames++;
    emit GameCreated(gameId, msg.sender, uint64(block.timestamp));
    return gameId;
}

function joinGame(uint256 gameId, string memory playerSymbol) public onlyRegistered returns (uint8) {
    Game storage game = games[gameId];
    require(game.creator != address(0), "Game not found");
    require(game.status == GameStatus.Pending, "Game not open");
    require(game.joinedPlayers < game.numberOfPlayers, "Game full");
    require(gamePlayers[gameId][msg.sender].playerAddress == address(0), "Already joined");

    uint8 pSym = _stringToPlayerSymbol(playerSymbol);

    uint8 order = game.joinedPlayers + 1;
    game.joinedPlayers++;

    gamePlayers[gameId][msg.sender] = GamePlayer({
        gameId: gameId,
        playerAddress: msg.sender,
        balance: gameSettings[gameId].startingCash,
        position: 0,
        order: order,
        symbol: PlayerSymbol(pSym),
        chanceJailCard: false,
        communityChestJailCard: false,
        username: users[msg.sender].username
    });

    return order;
}

function startGame(uint256 gameId) public {
    Game storage game = games[gameId];
    require(msg.sender == game.creator, "Only creator");
    require(game.status == GameStatus.Pending, "Already started");
    game.status = GameStatus.Ongoing;
}

function endGame(uint256 gameId, address winnerAddr) public {
    Game storage game = games[gameId];
    require(msg.sender == game.creator, "Only creator");
    require(game.status != GameStatus.Ended, "Already ended");
    game.status = GameStatus.Ended;
    game.winner = winnerAddr;
    game.endedAt = uint64(block.timestamp);
}

// -------------------------
// 📌 Gameplay
// -------------------------

function rollDice() external view returns (uint256 die1, uint256 die2, uint256 total) {
    bytes32 randomness = keccak256(
        abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            block.number,
            msg.sender
        )
    );
    die1 = (uint256(randomness) % 6) + 1;
    die2 = (uint256(randomness >> 16) % 6) + 1;
    total = die1 + die2;
}

function updatePlayerPosition(uint256 gameId, address player, uint8 newPosition, uint256 newBalance, uint8 propertyId) public returns (bool) {
    Game storage game = games[gameId];
    require(game.status == GameStatus.Ongoing, "Game not ongoing");

    GamePlayer storage gp = gamePlayers[gameId][player];
    require(gp.playerAddress != address(0), "Player not found");

    gp.position = newPosition;
    gp.balance = newBalance;

    if (propertyId != 0) {
        Property storage prop = properties[gameId][propertyId];
        prop.owner = player;
    }

    return true;
}

// -------------------------
// 📌 Views & Helpers
// -------------------------

function getUser(address a) public view returns (User memory) {
    require(users[a].playerAddress != address(0), "Not registered");
    return users[a];
}

function getUserById(uint256 id) public view returns (User memory) {
    address addr = userIdToAddress[id];
    require(addr != address(0), "Player not found");
    return users[addr];
}

function getGame(uint256 gameId) public view returns (Game memory) {
    require(games[gameId].creator != address(0), "Game not found");
    return games[gameId];
}

function getGameByCode(string memory code) public view returns (Game memory) {
    for (uint256 i = 0; i < nextGameId; i++) {
        if (keccak256(bytes(games[i].code)) == keccak256(bytes(code))) {
            return games[i];
        }
    }
    revert("Game not found");
}

function getGamePlayer(uint256 gameId, address a) public view returns (GamePlayer memory) {
    require(gamePlayers[gameId][a].playerAddress != address(0), "Player not in game");
    return gamePlayers[gameId][a];
}

function getProperty(uint256 gameId, uint8 propertyId) public view returns (Property memory) {
    require(properties[gameId][propertyId].id != 0, "Property not found");
    return properties[gameId][propertyId];
}

// -------------------------
// 📌 String → Enum Helpers
// -------------------------

function _stringToGameType(string memory g) internal pure returns (uint8) {
    bytes32 h = keccak256(bytes(g));
    if (h == keccak256("PUBLIC"))  return uint8(GameType.PublicGame);
    if (h == keccak256("PRIVATE")) return uint8(GameType.PrivateGame);
    revert("Invalid game type");
}

function _stringToPlayerSymbol(string memory s) internal pure returns (uint8) {
    bytes32 h = keccak256(bytes(s));
    if (h == keccak256("hat"))        return uint8(PlayerSymbol.Hat);
    if (h == keccak256("car"))        return uint8(PlayerSymbol.Car);
    if (h == keccak256("dog"))        return uint8(PlayerSymbol.Dog);
    if (h == keccak256("thimble"))    return uint8(PlayerSymbol.Thimble);
    if (h == keccak256("iron"))       return uint8(PlayerSymbol.Iron);
    if (h == keccak256("battleship")) return uint8(PlayerSymbol.Battleship);
    if (h == keccak256("boot"))       return uint8(PlayerSymbol.Boot);
    if (h == keccak256("wheelbarrow"))return uint8(PlayerSymbol.Wheelbarrow);
    revert("Invalid player symbol");
}


}
