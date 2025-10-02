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

    struct Users {
        uint256 id;
        string username;
        address playerAddress;
        uint64 timestamp;
        uint256 gamesPlayed;
        uint256 gameWon;
        uint256 gameLost;
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
        uint256 order;
        PlayerSymbol symbol;
        bool chanceJailCard;
        bool communityChestJailCard;
        string username;
    }

    struct Gamesettings {
        uint8 maxPlayers;
        string privateRoom;
        bool auction;
        bool rentInPrison;
        bool mortgage;
        bool evenBuild;
        uint256 startingCash;
        bool randomizePlayOrder;
    }

    enum PropertyType {
        Go, Chance, CommunityChest, Jail, Utility,
        RailRoad, Tax, FreeParking, Property, VisitingJail
    }

    struct Property {
        uint8 id;
        string name;
        address owner;
        PropertyType property_type;
        uint256 cost_of_property;
        uint8 group_id;
        bool isOwned;
        uint256 rent;
    }

    // -------------------------
    // 📌 Storage
    // -------------------------

    mapping(address => bool) public isRegistered;
    mapping(address => string) public addressToUsername;
    mapping(string => address) public usernameToAddress;
    mapping(address => Users) public players;

    mapping(uint256 => Game) public games;
    mapping(uint256 => Gamesettings) public gameSettings;
    mapping(uint256 => mapping(uint256 => Property)) public properties;

    mapping(uint256 => mapping(address => PlayerSymbol)) public gamePlayerSymbols;
    mapping(uint256 => mapping(address => GamePlayer)) public gamePlayers;
    mapping(uint256 => mapping(address => bool)) public gamePlayersMap;

    mapping(uint256 => address) public playerIdToAddress;

    // -------------------------
    // 📌 Events
    // -------------------------

    event PlayerCreated(string indexed username, address indexed player, uint64 timestamp);
    event GameCreated(uint256 indexed gameId, address indexed creator, uint64 timestamp);
    event DiceRolled(uint256 indexed gameId, address player, uint256 die1, uint256 die2, uint256 newPos);

    // -------------------------
    // 📌 Modifiers
    // -------------------------

    modifier nonEmptyUsername(string memory username) {
        require(bytes(username).length > 0, "Username cannot be empty");
        _;
    }

    modifier onlyRegistered() {
        require(isRegistered[msg.sender], "Player not registered");
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
        address caller = msg.sender;
        require(usernameToAddress[username] == address(0), "Username taken");
        require(bytes(addressToUsername[caller]).length == 0, "Already registered");

        totalUsers++;
        uint64 timestamp = uint64(block.timestamp);

        isRegistered[caller] = true;
        addressToUsername[caller] = username;
        usernameToAddress[username] = caller;

        players[caller] = Users({
            id: totalUsers,
            username: username,
            playerAddress: caller,
            timestamp: timestamp,
            gamesPlayed: 0,
            gameWon: 0,
            gameLost: 0,
            totalStaked: 0,
            totalEarned: 0,
            totalWithdrawn: 0
        });

        playerIdToAddress[totalUsers] = caller;

        emit PlayerCreated(username, caller, timestamp);
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

        Game storage game = games[gameId];
        game.id = gameId;
        game.code = code;
        game.creator = msg.sender;
        game.status = GameStatus.Pending;
        game.nextPlayer = 1;
        game.numberOfPlayers = numberOfPlayers;
        game.joinedPlayers = 1;
        game.mode = GameType(gType);
        game.createdAt = uint64(block.timestamp);

        // register creator
        gamePlayersMap[gameId][msg.sender] = true;
        gamePlayerSymbols[gameId][msg.sender] = PlayerSymbol(pSym);

        GamePlayer storage gp = gamePlayers[gameId][msg.sender];
        gp.gameId = gameId;
        gp.playerAddress = msg.sender;
        gp.balance = startingBalance;
        gp.position = 0;
        gp.order = 1;
        gp.symbol = PlayerSymbol(pSym);
        gp.username = addressToUsername[msg.sender];

        totalGames++;
        emit GameCreated(gameId, msg.sender, uint64(block.timestamp));
        return gameId;
    }

  function joinGame(uint256 gameId, string memory playerSymbol) 
    public 
    onlyRegistered 
    returns (uint256) 
{
    Game storage game = games[gameId];
    require(game.creator != address(0), "Game not found");
    require(game.status == GameStatus.Pending, "Game not open");
    require(!gamePlayersMap[gameId][msg.sender], "Already joined");

    // convert string symbol to enum index (reverts if invalid)
    uint8 pSymIndex = _stringToPlayerSymbol(playerSymbol);
    PlayerSymbol pSym = PlayerSymbol(pSymIndex);

    // ensure symbol not already taken
    require(isPlayerSymbolAvailable(gameId, msg.sender, pSym), "Symbol taken");

    // register player in game maps
    gamePlayersMap[gameId][msg.sender] = true;
    gamePlayerSymbols[gameId][msg.sender] = pSym;

    GamePlayer storage gp = gamePlayers[gameId][msg.sender];
    gp.gameId = gameId;
    gp.playerAddress = msg.sender;

    // use game settings starting cash if available, otherwise default to 0
    gp.balance = gameSettings[gameId].startingCash;
    gp.position = 0;
    gp.order = uint256(game.joinedPlayers + 1);
    gp.symbol = pSym;
    gp.username = addressToUsername[msg.sender];

    // increment joined players
    game.joinedPlayers++;

    // ✅ if last player joined, start the game automatically
    if (game.joinedPlayers == game.numberOfPlayers) {
        game.status = GameStatus.Ongoing;
    }

    return gp.order;
}


function gamePlayerInGame(uint256 gameId, address player) public view returns (bool) {
    return gamePlayersMap[gameId][player];
}
event PlayerLeft(uint256 indexed gameId, address indexed player);

function leaveGame(uint256 gameId) public onlyRegistered {
    Game storage game = games[gameId];
    require(game.creator != address(0), "Game not found");
    require(gamePlayersMap[gameId][msg.sender], "You are not in this game");
    require(game.status != GameStatus.Ended, "Game already ended");

    // remove player from maps
    delete gamePlayers[gameId][msg.sender];
    delete gamePlayerSymbols[gameId][msg.sender];
    gamePlayersMap[gameId][msg.sender] = false;

    // reduce joined players count
    if (game.joinedPlayers > 0) {
        game.joinedPlayers--;
    }

    // ✅ If only 1 player remains, declare them winner
    if (game.status == GameStatus.Ongoing && game.joinedPlayers == 1) {
        address winner;
        for (uint256 i = 1; i <= totalUsers; i++) {
            address p = playerIdToAddress[i];
            if (gamePlayersMap[gameId][p]) {
                winner = p;
                break;
            }
        }
        require(winner != address(0), "No winner found");
        game.status = GameStatus.Ended;
        game.winner = winner;
        game.endedAt = uint64(block.timestamp);
    }

    emit PlayerLeft(gameId, msg.sender);
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

    function rollDice(uint256 gameId) external {
        Game storage game = games[gameId];
        require(game.status == GameStatus.Ongoing, "Game not active");

        // find current turn
        address currentPlayer;
        for (uint256 i = 1; i <= totalUsers; i++) {
            address p = playerIdToAddress[i];
            if (gamePlayersMap[gameId][p] &&
                gamePlayers[gameId][p].order == game.nextPlayer) {
                currentPlayer = p;
                break;
            }
        }
        require(currentPlayer == msg.sender, "Not your turn");

        uint256 die1 = (uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, "D1"))) % 6) + 1;
        uint256 die2 = (uint256(keccak256(abi.encodePacked(block.prevrandao, msg.sender, "D2"))) % 6) + 1;
        uint256 total = die1 + die2;

        GamePlayer storage gp = gamePlayers[gameId][msg.sender];
        gp.position = uint8((gp.position + total) % BOARD_SIZE);

        emit DiceRolled(gameId, msg.sender, die1, die2, gp.position);

        // rent logic
        Property storage landed = properties[gameId][gp.position];
        if (landed.isOwned && landed.owner != msg.sender) {
            require(gp.balance >= landed.rent, "Not enough balance");
            gp.balance -= landed.rent;
            gamePlayers[gameId][landed.owner].balance += landed.rent;
        }

        // next player
        game.nextPlayer = (game.nextPlayer == game.numberOfPlayers) ? 1 : game.nextPlayer + 1;
    }

    // -------------------------
    // 📌 Views & Helpers
    // -------------------------

    function getPlayer(address a) public view returns (Users memory) {
        require(isRegistered[a], "Not registered");
        return players[a];
    }

    function getPlayerById(uint256 id) public view returns (Users memory) {
        address addr = playerIdToAddress[id];
        require(addr != address(0), "Player not found");
        return players[addr];
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

    function getGamePlayer(uint256 gameId, address a)
        public
        view
        returns (GamePlayer memory)
    {
        require(gamePlayersMap[gameId][a], "Player not in game");
        return gamePlayers[gameId][a];
    }

    function isPlayerSymbolAvailable(
        uint256 gameId,
        address player,
        PlayerSymbol symbol
    ) internal view returns (bool) {
        for (uint256 i = 1; i <= totalUsers; i++) {
            address other = playerIdToAddress[i];
            if (gamePlayersMap[gameId][other] && other != player) {
                if (gamePlayerSymbols[gameId][other] == symbol) return false;
            }
        }
        return true;
    }

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

    // Draw card helpers remain if needed later
    function drawChanceCard(uint256 gameId) public view returns (uint256) {
        require(games[gameId].creator != address(0), "Game not found");
        return uint256(
            keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender, gameId))
        ) % 15;
    }

    function drawCommunityCard(uint256 gameId) public view returns (uint256) {
        require(games[gameId].creator != address(0), "Game not found");
        return uint256(
            keccak256(abi.encodePacked(blockhash(block.number - 1), block.prevrandao, msg.sender, gameId))
        ) % 15;
    }
}
