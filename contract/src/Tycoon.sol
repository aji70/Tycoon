// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TycoonLib} from "./TycoonLib.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Burnable} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

// ============================================================================
//                  TYCOON REWARD & COLLECTIBLES SYSTEM (ERC-1155)
// ============================================================================
// Features:
// - Claimable vouchers → redeem for TYC tokens
// - Burnable collectibles → burn to get in-game perks
// - Cash perk now uses fixed tiers: [0, 10, 25, 50, 100, 250]
contract TycoonRewardSystem is ERC1155, ERC1155Burnable, Ownable, Pausable, ReentrancyGuard {
    IERC20 public immutable tycToken;
    IERC20 public immutable usdc;

    // ------------------------------------------------------------------------
    // TOKEN ID RANGES
    // ------------------------------------------------------------------------
    // 1_000_000_000+ → Claimable TYC vouchers
    // 2_000_000_000+ → Collectibles (perks)
    uint256 private _nextVoucherId = 1_000_000_000;
    uint256 private _nextCollectibleId = 2_000_000_000;

    // VOUCHERS: redeemable value in TYC
    mapping(uint256 => uint256) public voucherRedeemValue;

    // COLLECTIBLES: expanded burnable perks
    enum CollectiblePerk {
        NONE,
        EXTRA_TURN, // +extra turns
        JAIL_FREE, // Get out of jail free
        DOUBLE_RENT, // Next rent payment doubled
        ROLL_BOOST, // +bonus to dice roll
        CASH_TIERED, // In-game cash: uses CASH_TIERS
        TELEPORT, // Move to any property (no roll next turn)
        SHIELD, // Immune to rent/payments for 1-2 turns
        PROPERTY_DISCOUNT, // Next property purchase 30-50% off
        TAX_REFUND, // Instant cash from bank (tiered)
        ROLL_EXACT // Choose exact roll 2-12 once

    }

    // Cash / Refund tiers: index 1–5
    uint256[] private CASH_TIERS = [0, 10, 25, 50, 100, 250];

    mapping(uint256 => CollectiblePerk) public collectiblePerk;
    mapping(uint256 => uint256) public collectiblePerkStrength; // tier or strength value

    // SHOP PRICES (0 = not for sale in that currency)
    mapping(uint256 => uint256) public collectibleTycPrice;
    mapping(uint256 => uint256) public collectibleUsdcPrice;

    // Admin / backend
    address public backendMinter;

    // ------------------------------------------------------------------------
    // EVENTS
    // ------------------------------------------------------------------------
    event VoucherMinted(uint256 indexed tokenId, address indexed to, uint256 tycValue);
    event CollectibleMinted(uint256 indexed tokenId, address indexed to, CollectiblePerk perk, uint256 strength);
    event CollectibleBurned(uint256 indexed tokenId, address indexed burner, CollectiblePerk perk, uint256 strength);
    event VoucherRedeemed(uint256 indexed tokenId, address indexed redeemer, uint256 tycValue);
    event CollectibleBought(uint256 indexed tokenId, address indexed buyer, uint256 price, bool usedUsdc);
    event CollectibleRestocked(uint256 indexed tokenId, uint256 amount);
    event CollectiblePricesUpdated(uint256 indexed tokenId, uint256 tycPrice, uint256 usdcPrice);
    event CashPerkActivated(uint256 indexed tokenId, address indexed burner, uint256 cashAmount);
    event BackendMinterUpdated(address indexed newMinter);
    event FundsWithdrawn(address indexed token, address indexed to, uint256 amount);

    constructor(address _tycToken, address _usdc, address initialOwner)
        ERC1155("https://gateway.pinata.cloud/ipfs/bafkreicv2hqqxn64opc6euvynsvnfk2zfyfj42eeengzvknz7y2o7o5fxe")
        Ownable(initialOwner)
    {
        tycToken = IERC20(_tycToken);
        usdc = IERC20(_usdc);
    }

    modifier onlyBackend() {
        require(msg.sender == backendMinter || msg.sender == owner(), "Unauthorized");
        _;
    }

    // ------------------------------------------------------------------------
    // ADMIN FUNCTIONS
    // ------------------------------------------------------------------------
    function setBackendMinter(address newMinter) external onlyOwner {
        require(newMinter != address(0), "Invalid address");
        backendMinter = newMinter;
        emit BackendMinterUpdated(newMinter);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Withdraw collected TYC/USDC revenue
    function withdrawFunds(IERC20 token, address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid address");
        require(token.transfer(to, amount), "Transfer failed");
        emit FundsWithdrawn(address(token), to, amount);
    }

    // ------------------------------------------------------------------------
    // VOUCHER FUNCTIONS
    // ------------------------------------------------------------------------
    function mintVoucher(address to, uint256 tycValue) external onlyOwner returns (uint256 tokenId) {
        require(tycValue > 0, "Value must be positive");
        require(to != address(0), "Invalid recipient");

        tokenId = _nextVoucherId++;
        voucherRedeemValue[tokenId] = tycValue;

        _mint(to, tokenId, 1, "");
        emit VoucherMinted(tokenId, to, tycValue);
    }

    function redeemVoucher(uint256 tokenId) external whenNotPaused {
        require(balanceOf(msg.sender, tokenId) == 1, "Not owner");
        uint256 value = voucherRedeemValue[tokenId];
        require(value > 0, "Invalid voucher");

        require(tycToken.transfer(msg.sender, value), "TYC transfer failed");

        _burn(msg.sender, tokenId, 1);
        delete voucherRedeemValue[tokenId];

        emit VoucherRedeemed(tokenId, msg.sender, value);
    }

    // ------------------------------------------------------------------------
    // COLLECTIBLE MINTING (non-shop rewards)
    // ------------------------------------------------------------------------
    function mintCollectible(address to, CollectiblePerk perk, uint256 strength)
        external
        onlyBackend
        returns (uint256 tokenId)
    {
        require(perk != CollectiblePerk.NONE, "Invalid perk");
        require(to != address(0), "Invalid recipient");
        _validateStrength(perk, strength);

        tokenId = _nextCollectibleId++;
        collectiblePerk[tokenId] = perk;
        collectiblePerkStrength[tokenId] = strength;

        _mint(to, tokenId, 1, "");
        emit CollectibleMinted(tokenId, to, perk, strength);
    }

    // ------------------------------------------------------------------------
    // SHOP MANAGEMENT
    // ------------------------------------------------------------------------
    function stockShop(uint256 amount, CollectiblePerk perk, uint256 strength, uint256 tycPrice, uint256 usdcPrice)
        external
        onlyBackend
    {
        require(amount > 0, "Amount > 0");
        require(perk != CollectiblePerk.NONE, "Invalid perk");
        _validateStrength(perk, strength);

        uint256 tokenId = _nextCollectibleId++;
        collectiblePerk[tokenId] = perk;
        collectiblePerkStrength[tokenId] = strength;
        collectibleTycPrice[tokenId] = tycPrice;
        collectibleUsdcPrice[tokenId] = usdcPrice;

        _mint(address(this), tokenId, amount, "");
        emit CollectibleMinted(tokenId, address(this), perk, strength);
    }

    function restockCollectible(uint256 tokenId, uint256 additionalAmount) external onlyBackend {
        require(additionalAmount > 0, "Amount > 0");
        require(collectiblePerk[tokenId] != CollectiblePerk.NONE, "Not a collectible");

        _mint(address(this), tokenId, additionalAmount, "");
        emit CollectibleRestocked(tokenId, additionalAmount);
    }

    function updateCollectiblePrices(uint256 tokenId, uint256 newTycPrice, uint256 newUsdcPrice) external onlyBackend {
        require(collectiblePerk[tokenId] != CollectiblePerk.NONE, "Not a collectible");

        collectibleTycPrice[tokenId] = newTycPrice;
        collectibleUsdcPrice[tokenId] = newUsdcPrice;

        emit CollectiblePricesUpdated(tokenId, newTycPrice, newUsdcPrice);
    }

    // ------------------------------------------------------------------------
    // BUY FROM SHOP
    // ------------------------------------------------------------------------
    function buyCollectible(uint256 tokenId, bool useUsdc) external whenNotPaused nonReentrant {
        uint256 price;
        IERC20 paymentToken;

        if (useUsdc) {
            price = collectibleUsdcPrice[tokenId];
            require(price > 0, "Not for sale in USDC");
            paymentToken = usdc;
        } else {
            price = collectibleTycPrice[tokenId];
            require(price > 0, "Not for sale in TYC");
            paymentToken = tycToken;
        }

        require(balanceOf(address(this), tokenId) >= 1, "Out of stock");

        require(paymentToken.transferFrom(msg.sender, address(this), price), "Payment failed");

        _safeTransferFrom(address(this), msg.sender, tokenId, 1, "");

        emit CollectibleBought(tokenId, msg.sender, price, useUsdc);
    }

    // ------------------------------------------------------------------------
    // BURN FOR PERK
    // ------------------------------------------------------------------------
    function burnCollectibleForPerk(uint256 tokenId) external whenNotPaused {
        require(balanceOf(msg.sender, tokenId) == 1, "Not owner");
        CollectiblePerk perk = collectiblePerk[tokenId];
        require(perk != CollectiblePerk.NONE, "No perk");

        uint256 strength = collectiblePerkStrength[tokenId];

        // Special handling for tiered cash/refund perks
        if (perk == CollectiblePerk.CASH_TIERED || perk == CollectiblePerk.TAX_REFUND) {
            require(strength >= 1 && strength <= 5, "Invalid tier");
            uint256 cashAmount = CASH_TIERS[strength];
            emit CashPerkActivated(tokenId, msg.sender, cashAmount);
        }

        _burn(msg.sender, tokenId, 1);

        // Cleanup storage
        delete collectiblePerk[tokenId];
        delete collectiblePerkStrength[tokenId];
        delete collectibleTycPrice[tokenId];
        delete collectibleUsdcPrice[tokenId];

        emit CollectibleBurned(tokenId, msg.sender, perk, strength);
    }

    // ------------------------------------------------------------------------
    // INTERNAL HELPERS
    // ------------------------------------------------------------------------
    function _validateStrength(CollectiblePerk perk, uint256 strength) internal pure {
        if (perk == CollectiblePerk.CASH_TIERED || perk == CollectiblePerk.TAX_REFUND) {
            require(strength >= 1 && strength <= 5, "Invalid tier (1-5)");
        }
        // Add more validations here if you create new tiered perks
    }

    // ------------------------------------------------------------------------
    // VIEW FUNCTIONS
    // ------------------------------------------------------------------------
    function getCollectibleInfo(uint256 tokenId)
        external
        view
        returns (CollectiblePerk perk, uint256 strength, uint256 tycPrice, uint256 usdcPrice, uint256 shopStock)
    {
        perk = collectiblePerk[tokenId];
        strength = collectiblePerkStrength[tokenId];
        tycPrice = collectibleTycPrice[tokenId];
        usdcPrice = collectibleUsdcPrice[tokenId];
        shopStock = balanceOf(address(this), tokenId);
    }

    function getCashTierValue(uint256 tier) external view returns (uint256) {
        require(tier > 0 && tier <= 5, "Invalid tier");
        return CASH_TIERS[tier];
    }
}

// ============================================================================
//                          MAIN TYCOON GAME CONTRACT
// ============================================================================
contract Tycoon is ReentrancyGuard, Ownable {
    using TycoonLib for TycoonLib.Game;
    using TycoonLib for TycoonLib.GamePlayer;
    using TycoonLib for TycoonLib.GameSettings;
    using TycoonLib for TycoonLib.Property;

    uint256 public totalUsers;
    uint256 public totalGames;
    uint256 private nextGameId = 1;
    uint256 public houseBalance;
    address public immutable token;
    uint256 public constant TOKEN_REWARD = 10 ** 18;
    uint256 public constant STAKE_AMOUNT = 1;

    mapping(uint256 => mapping(uint8 => address)) public gameOrderToPlayer;

    mapping(string => TycoonLib.User) public users;
    mapping(address => bool) public registered;
    mapping(address => string) public addressToUsername;
    mapping(uint256 => TycoonLib.Game) public games;
    mapping(uint256 => TycoonLib.GameSettings) public gameSettings;
    mapping(string => TycoonLib.Game) public getToCode;
    mapping(uint256 => mapping(uint8 => TycoonLib.Property)) public properties;
    mapping(uint256 => mapping(address => TycoonLib.GamePlayer)) public gamePlayers;

    TycoonRewardSystem public immutable rewardSystem;

    event PlayerCreated(string indexed username, address indexed player, uint64 timestamp);
    event GameCreated(uint256 indexed gameId, address indexed creator, uint64 timestamp);
    event PlayerJoined(uint256 indexed gameId, address indexed player, uint8 order);
    event TurnCommitted(uint256 indexed gameId, address indexed player, uint8 newPosition, uint256 newBalance);
    event PlayerRemoved(uint256 indexed gameId, address indexed player, uint64 timestamp);
    event GameEnded(uint256 indexed gameId, address indexed winner, uint64 timestamp);
    event RewardClaimed(uint256 indexed gameId, address indexed winner, uint256 amount);
    event AIGameEnded(uint256 indexed gameId, address indexed player, uint64 timestamp);
    event HouseWithdrawn(uint256 amount, address indexed owner);

    event PlayerWonWithRewards(
        uint256 indexed gameId, address indexed winner, uint256 ethReward, uint256 tycVoucherAmount
    );

    constructor(address initialOwner, address _token, address _rewardSystem) Ownable(initialOwner) {
        token = _token;
        rewardSystem = TycoonRewardSystem(_rewardSystem);
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

    function registerPlayer(string memory username) private nonEmptyUsername(username) returns (uint256) {
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

    function createGame(
        string memory creatorUsername,
        string memory gameType,
        string memory playerSymbol,
        uint8 numberOfPlayers,
        string memory code,
        uint256 startingBalance
    ) public payable nonReentrant nonEmptyUsername(creatorUsername) returns (uint256) {
        require(numberOfPlayers >= 2 && numberOfPlayers <= 8, "Invalid player count");
        require(bytes(gameType).length > 0, "Invalid game type");
        require(msg.value == STAKE_AMOUNT, "Incorrect stake amount");
        require(bytes(playerSymbol).length > 0, "Invalid player symbol");
        require(startingBalance > 0, "Invalid starting balance");

        if (!registered[msg.sender]) {
            registerPlayer(creatorUsername);
        }

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

        gameSettings[gameId] = TycoonLib.GameSettings({
            maxPlayers: numberOfPlayers,
            auction: true,
            rentInPrison: true,
            mortgage: true,
            evenBuild: true,
            startingCash: startingBalance,
            privateRoomCode: code
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
            totalStaked: STAKE_AMOUNT
        });

        gamePlayers[gameId][creator] = TycoonLib.GamePlayer({
            gameId: gameId,
            playerAddress: creator,
            balance: startingBalance,
            position: 0,
            order: 1,
            symbol: TycoonLib.PlayerSymbol(pSym),
            username: user.username
        });

        gameOrderToPlayer[gameId][1] = creator;
        getToCode[code] = games[gameId];

        totalGames++;
        emit GameCreated(gameId, creator, uint64(block.timestamp));
        return gameId;
    }

    function createAIGame(
        string memory creatorUsername,
        string memory gameType,
        string memory playerSymbol,
        uint8 numberOfAI,
        string memory code,
        uint256 startingBalance
    ) public payable nonReentrant nonEmptyUsername(creatorUsername) returns (uint256) {
        require(numberOfAI >= 1 && numberOfAI <= 7, "Invalid AI count: 1-7");
        require(msg.value == STAKE_AMOUNT, "Incorrect stake amount");
        require(bytes(gameType).length > 0, "Invalid game type");
        require(bytes(playerSymbol).length > 0, "Invalid player symbol");
        require(startingBalance > 0, "Invalid starting balance");

        if (!registered[msg.sender]) {
            registerPlayer(creatorUsername);
        }

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

        gameSettings[gameId] = TycoonLib.GameSettings({
            maxPlayers: totalPlayers,
            auction: true,
            rentInPrison: true,
            mortgage: true,
            evenBuild: true,
            startingCash: startingBalance,
            privateRoomCode: code
        });

        games[gameId] = TycoonLib.Game({
            id: gameId,
            code: code,
            creator: creator,
            status: TycoonLib.GameStatus.Ongoing,
            nextPlayer: 1,
            winner: address(0),
            numberOfPlayers: totalPlayers,
            joinedPlayers: 1,
            mode: TycoonLib.GameType(gType),
            ai: true,
            createdAt: uint64(block.timestamp),
            endedAt: 0,
            totalStaked: STAKE_AMOUNT
        });

        gamePlayers[gameId][creator] = TycoonLib.GamePlayer({
            gameId: gameId,
            playerAddress: creator,
            balance: startingBalance,
            position: 0,
            order: 1,
            symbol: TycoonLib.PlayerSymbol(pSym),
            username: user.username
        });

        gameOrderToPlayer[gameId][1] = creator;
        for (uint8 i = 2; i <= totalPlayers; i++) {
            address dummyAI = address(uint160(i));
            gameOrderToPlayer[gameId][i] = dummyAI;
            gamePlayers[gameId][dummyAI] = TycoonLib.GamePlayer({
                gameId: gameId,
                playerAddress: dummyAI,
                balance: startingBalance,
                position: 0,
                order: i,
                symbol: TycoonLib.PlayerSymbol(uint8(0)),
                username: string(abi.encodePacked("AI_", uint2str(i)))
            });
        }

        getToCode[code] = games[gameId];

        totalGames++;
        emit GameCreated(gameId, creator, uint64(block.timestamp));
        return gameId;
    }

    function joinGame(uint256 gameId, string memory playerUsername, string memory playerSymbol, string memory joinCode)
        public
        payable
        nonReentrant
        nonEmptyUsername(playerUsername)
        returns (uint8)
    {
        TycoonLib.Game storage game = games[gameId];
        require(game.ai == false, "Cannot join AI game");
        require(msg.value == STAKE_AMOUNT, "Incorrect stake amount");
        require(game.creator != address(0), "Game not found");
        require(game.status == TycoonLib.GameStatus.Pending, "Game not open");
        require(game.joinedPlayers < game.numberOfPlayers, "Game full");

        TycoonLib.User storage user = users[playerUsername];
        if (!registered[msg.sender]) {
            registerPlayer(playerUsername);
        }
        require(user.playerAddress != address(0), "User not registered");
        require(user.playerAddress == msg.sender, "Must use own username");
        address player = user.playerAddress;
        require(gamePlayers[gameId][player].playerAddress == address(0), "Already joined");
        require(bytes(playerSymbol).length > 0, "Invalid player symbol");

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

        gameOrderToPlayer[gameId][order] = player;
        emit PlayerJoined(gameId, player, order);

        if (game.joinedPlayers == game.numberOfPlayers) {
            game.status = TycoonLib.GameStatus.Ongoing;
        }
        return order;
    }

    function removePlayerFromGame(uint256 gameId, address playerToRemove) public nonReentrant returns (bool) {
        TycoonLib.Game storage game = games[gameId];
        require(game.ai == false, "Cannot remove from AI game");
        require(game.creator != address(0), "Game not found");
        require(game.status == TycoonLib.GameStatus.Ongoing, "Game not ongoing");
        require(gamePlayers[gameId][playerToRemove].playerAddress != address(0), "Player not in game");

        require(msg.sender == playerToRemove || msg.sender == game.creator, "Unauthorized removal");

        string memory removeUsername = gamePlayers[gameId][playerToRemove].username;
        TycoonLib.User storage userLost = users[removeUsername];
        userLost.gamesLost += 1;

        uint8 removeOrder = gamePlayers[gameId][playerToRemove].order;
        delete gamePlayers[gameId][playerToRemove];
        delete gameOrderToPlayer[gameId][removeOrder];
        game.joinedPlayers -= 1;

        emit PlayerRemoved(gameId, playerToRemove, uint64(block.timestamp));

        if (game.joinedPlayers == 1) {
            address winnerAddr = address(0);
            for (uint8 i = 1; i <= game.numberOfPlayers; i++) {
                address potential = gameOrderToPlayer[gameId][i];
                if (potential != address(0)) {
                    winnerAddr = potential;
                    break;
                }
            }
            require(winnerAddr != address(0), "No remaining player found");

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

    function endAIGame(uint256 gameId, uint8 finalPosition, uint256 finalBalance, bool isWin)
        public
        nonReentrant
        returns (bool)
    {
        TycoonLib.Game storage game = games[gameId];
        require(game.ai == true, "Not an AI game");
        require(game.status == TycoonLib.GameStatus.Ongoing, "Game already ended");
        require(game.creator == msg.sender, "Only creator can end AI game");
        require(finalPosition < TycoonLib.BOARD_SIZE, "Invalid final position");
        require(finalBalance <= gameSettings[gameId].startingCash * 2, "Invalid final balance");

        TycoonLib.GamePlayer storage gp = gamePlayers[gameId][msg.sender];
        gp.position = finalPosition;
        gp.balance = finalBalance;

        game.status = TycoonLib.GameStatus.Ended;
        game.winner = isWin ? msg.sender : address(0);
        game.endedAt = uint64(block.timestamp);

        TycoonLib.User storage user = users[gp.username];

        if (isWin) {
            (bool success,) = payable(msg.sender).call{value: STAKE_AMOUNT}("");
            require(success, "Refund failed");

            rewardSystem.mintVoucher(msg.sender, TOKEN_REWARD);

            // NEW: Mint strong collectible for winner (e.g., CASH_TIERED perk with max strength=5 for 250 cash)
            rewardSystem.mintCollectible(
                msg.sender,
                TycoonRewardSystem.CollectiblePerk.CASH_TIERED,
                5 // Strong strength (tier 5 = 250 cash)
            );

            emit PlayerWonWithRewards(gameId, msg.sender, STAKE_AMOUNT, TOKEN_REWARD);

            user.gamesWon += 1;
            user.totalEarned += STAKE_AMOUNT;
        } else {
            houseBalance += STAKE_AMOUNT;
            user.gamesLost += 1;
            uint256 amount = TOKEN_REWARD / 2;

            // CHANGED: Mint voucher instead of direct transfer for loser
            rewardSystem.mintVoucher(msg.sender, amount);

            // NEW: Mint weak collectible for loser (e.g., CASH_TIERED perk with min strength=1 for 10 cash)
            rewardSystem.mintCollectible(
                msg.sender,
                TycoonRewardSystem.CollectiblePerk.CASH_TIERED,
                1 // Weak strength (tier 1 = 10 cash)
            );
        }

        game.totalStaked = 0;
        emit AIGameEnded(gameId, msg.sender, uint64(block.timestamp));
        return true;
    }

    function claimReward(uint256 gameId) public nonReentrant isPlayerInGame(gameId, msg.sender) returns (uint256) {
        TycoonLib.Game storage game = games[gameId];
        require(game.status == TycoonLib.GameStatus.Ended, "Game not ended");
        require(game.ai == false, "Use endAIGame for AI rewards");
        require(game.winner == msg.sender, "Not the winner");
        require(game.totalStaked >= 2 * STAKE_AMOUNT, "Min 2 players required");

        uint256 pot = game.totalStaked;
        uint256 losersPool = pot - STAKE_AMOUNT;
        uint256 reward = STAKE_AMOUNT + (losersPool / 2);
        uint256 houseCut = losersPool / 2;

        game.totalStaked = 0;
        houseBalance += houseCut;

        (bool success,) = payable(msg.sender).call{value: reward}("");
        require(success, "Transfer failed");

        rewardSystem.mintVoucher(msg.sender, TOKEN_REWARD);

        emit PlayerWonWithRewards(gameId, msg.sender, reward, TOKEN_REWARD);

        TycoonLib.User storage user = users[gamePlayers[gameId][msg.sender].username];
        user.totalEarned += reward;

        emit RewardClaimed(gameId, msg.sender, reward);
        return reward;
    }

    function withdrawHouse(uint256 amount) external onlyOwner {
        require(amount <= houseBalance, "Insufficient house balance");
        houseBalance -= amount;
        (bool success,) = payable(owner()).call{value: amount}("");
        require(success, "Withdrawal failed");
        emit HouseWithdrawn(amount, owner());
    }

    function drainContract() external onlyOwner {
        uint256 contractBalance = address(this).balance;
        require(contractBalance > 0, "No balance to drain");
        (bool success,) = payable(owner()).call{value: contractBalance}("");
        require(success, "Drain failed");
    }

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

    function getGamePlayerByAddress(uint256 gameId, address playerAddr)
        public
        view
        returns (TycoonLib.GamePlayer memory)
    {
        return gamePlayers[gameId][playerAddr];
    }

    function getProperty(uint256 gameId, uint8 propertyId) public view returns (TycoonLib.Property memory) {
        require(propertyId < TycoonLib.BOARD_SIZE, "Property not found");
        return properties[gameId][propertyId];
    }

    function getGameSettings(uint256 gameId) public view returns (TycoonLib.GameSettings memory settings) {
        settings = gameSettings[gameId];
        return settings;
    }

    function getGameByCode(string memory code) public view returns (TycoonLib.Game memory) {
        TycoonLib.Game storage game = getToCode[code];
        require(game.creator != address(0), "Game not found");
        return game;
    }

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
