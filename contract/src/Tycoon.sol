// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {TycoonLib} from "./TycoonLib.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Burnable} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

// ============================================================================
//                  TYCOON REWARD & COLLECTIBLES SYSTEM (ERC-1155)
// ============================================================================
// Features:
// - Claimable vouchers → redeem for TYC tokens
// - Burnable collectibles → burn to get in-game perks
// - Cash perk now uses fixed tiers: [0, 10, 25, 50, 100, 250]
contract TycoonRewardSystem is ERC1155, ERC1155Burnable, ERC1155Holder, Ownable, Pausable, ReentrancyGuard {
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

    // Cash / Refund tiers: index 1–5
    uint256[] private CASH_TIERS = [0, 10, 25, 50, 100, 250];

    mapping(uint256 => TycoonLib.CollectiblePerk) public collectiblePerk;
    mapping(uint256 => uint256) public collectiblePerkStrength; // tier or strength value

    // SHOP PRICES (0 = not for sale in that currency)
    mapping(uint256 => uint256) public collectibleTycPrice;
    mapping(uint256 => uint256) public collectibleUsdcPrice;

    // Admin / backend
    address public backendMinter;

    // Enumeration: Track unique token IDs owned by each address (balance > 0)
    mapping(address => uint256[]) private _ownedTokens;
    mapping(address => mapping(uint256 => uint256)) private _ownedTokensIndex;

    // ------------------------------------------------------------------------
    // EVENTS
    // ------------------------------------------------------------------------
    event VoucherMinted(uint256 indexed tokenId, address indexed to, uint256 tycValue);
    event CollectibleMinted(
        uint256 indexed tokenId, address indexed to, TycoonLib.CollectiblePerk perk, uint256 strength
    );
    event CollectibleBurned(
        uint256 indexed tokenId, address indexed burner, TycoonLib.CollectiblePerk perk, uint256 strength
    );
    event VoucherRedeemed(uint256 indexed tokenId, address indexed redeemer, uint256 tycValue);
    event CollectibleBought(uint256 indexed tokenId, address indexed buyer, uint256 price, bool usedUsdc);
    event CollectibleRestocked(uint256 indexed tokenId, uint256 amount);
    event CollectiblePricesUpdated(uint256 indexed tokenId, uint256 tycPrice, uint256 usdcPrice);
    event CashPerkActivated(uint256 indexed tokenId, address indexed burner, uint256 cashAmount);
    event BackendMinterUpdated(address indexed newMinter);
    event FundsWithdrawn(address indexed token, address indexed to, uint256 amount);

    constructor(address _tycToken, address _usdc, address initialOwner)
        ERC1155("https://gateway.pinata.cloud/ipfs/bafkreiabe7dquw4ekh2p4b2b4fysqckzyclk5mcycih462xvqgxcwlgjjy")
        Ownable(initialOwner)
    {
        require(_tycToken != address(0), "Invalid TYC token");
        require(_usdc != address(0), "Invalid USDC token");
        tycToken = IERC20(_tycToken);
        usdc = IERC20(_usdc);
    }

    modifier onlyBackend() {
        require(msg.sender == backendMinter || msg.sender == owner(), "Unauthorized");
        _;
    }

    // ------------------------------------------------------------------------
    // INTERFACE OVERRIDE (required due to ERC1155 + ERC1155Holder inheritance)
    // ------------------------------------------------------------------------
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155, ERC1155Holder)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
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
    function mintVoucher(address to, uint256 tycValue) external onlyBackend returns (uint256 tokenId) {
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
    function mintCollectible(address to, TycoonLib.CollectiblePerk perk, uint256 strength)
        external
        onlyBackend
        returns (uint256 tokenId)
    {
        require(perk != TycoonLib.CollectiblePerk.NONE, "Invalid perk");
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
    function stockShop(
        uint256 amount,
        TycoonLib.CollectiblePerk perk,
        uint256 strength,
        uint256 tycPrice,
        uint256 usdcPrice
    ) external onlyBackend {
        require(amount > 0, "Amount > 0");
        require(perk != TycoonLib.CollectiblePerk.NONE, "Invalid perk");
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
        require(collectiblePerk[tokenId] != TycoonLib.CollectiblePerk.NONE, "Invalid collectible");

        _mint(address(this), tokenId, additionalAmount, "");
        emit CollectibleRestocked(tokenId, additionalAmount);
    }

    function updateCollectiblePrices(uint256 tokenId, uint256 newTycPrice, uint256 newUsdcPrice) external onlyBackend {
        require(collectiblePerk[tokenId] != TycoonLib.CollectiblePerk.NONE, "Invalid collectible");
        collectibleTycPrice[tokenId] = newTycPrice;
        collectibleUsdcPrice[tokenId] = newUsdcPrice;
        emit CollectiblePricesUpdated(tokenId, newTycPrice, newUsdcPrice);
    }

    // ------------------------------------------------------------------------
    // BUY FROM SHOP
    // ------------------------------------------------------------------------
    function buyCollectible(uint256 tokenId, bool useUsdc) external whenNotPaused nonReentrant {
        uint256 price = useUsdc ? collectibleUsdcPrice[tokenId] : collectibleTycPrice[tokenId];
        IERC20 paymentToken = useUsdc ? usdc : tycToken;

        require(price > 0, "Not for sale");
        require(balanceOf(address(this), tokenId) >= 1, "Out of stock");

        require(paymentToken.transferFrom(msg.sender, address(this), price), "Payment failed");
        _safeTransferFrom(address(this), msg.sender, tokenId, 1, "");

        emit CollectibleBought(tokenId, msg.sender, price, useUsdc);
    }

    // ------------------------------------------------------------------------
    // BURN FOR PERK
    // ------------------------------------------------------------------------
    function burnCollectibleForPerk(uint256 tokenId) external whenNotPaused {
        require(balanceOf(msg.sender, tokenId) >= 1, "Insufficient balance");

        TycoonLib.CollectiblePerk perk = collectiblePerk[tokenId];
        require(perk != TycoonLib.CollectiblePerk.NONE, "No perk");

        uint256 strength = collectiblePerkStrength[tokenId];

        if (perk == TycoonLib.CollectiblePerk.CASH_TIERED || perk == TycoonLib.CollectiblePerk.TAX_REFUND) {
            require(strength >= 1 && strength <= 5, "Invalid tier");
            emit CashPerkActivated(tokenId, msg.sender, CASH_TIERS[strength]);
        }

        _burn(msg.sender, tokenId, 1);
        emit CollectibleBurned(tokenId, msg.sender, perk, strength);
    }

    // ------------------------------------------------------------------------
    // INTERNAL HELPERS
    // ------------------------------------------------------------------------
    function _validateStrength(TycoonLib.CollectiblePerk perk, uint256 strength) internal pure {
        if (perk == TycoonLib.CollectiblePerk.CASH_TIERED || perk == TycoonLib.CollectiblePerk.TAX_REFUND) {
            require(strength >= 1 && strength <= 5, "Invalid tier (1-5)");
        }
        // Add more validations here if you create new tiered perks
    }

    function _uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _addTokenToOwnerEnumeration(address owner, uint256 tokenId) private {
        if (balanceOf(owner, tokenId) == 0) return; // Only add if balance > 0
        uint256 index = _ownedTokensIndex[owner][tokenId];
        if (_ownedTokens[owner].length == 0 || _ownedTokens[owner][index] != tokenId) {
            uint256 length = _ownedTokens[owner].length;
            _ownedTokens[owner].push(tokenId);
            _ownedTokensIndex[owner][tokenId] = length;
        }
    }

    function _removeTokenFromOwnerEnumeration(address owner, uint256 tokenId) private {
        if (balanceOf(owner, tokenId) > 0) return; // Only remove if balance == 0

        uint256 lastTokenIndex = _ownedTokens[owner].length - 1;
        uint256 tokenIndex = _ownedTokensIndex[owner][tokenId];

        if (tokenIndex <= lastTokenIndex) {
            uint256 lastTokenId = _ownedTokens[owner][lastTokenIndex];

            _ownedTokens[owner][tokenIndex] = lastTokenId;
            _ownedTokensIndex[owner][lastTokenId] = tokenIndex;
        }

        _ownedTokens[owner].pop();
        delete _ownedTokensIndex[owner][tokenId];
    }

    // Override _update to handle enumeration
    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        virtual
        override
    {
        super._update(from, to, ids, values);

        uint256 length = ids.length;
        for (uint256 i = 0; i < length; i++) {
            uint256 id = ids[i];
            uint256 value = values[i];

            if (from != address(0) && value > 0) {
                _removeTokenFromOwnerEnumeration(from, id);
            }
            if (to != address(0) && value > 0) {
                _addTokenToOwnerEnumeration(to, id);
            }
        }
    }

    // ------------------------------------------------------------------------
    // VIEW FUNCTIONS
    // ------------------------------------------------------------------------
    function getCollectibleInfo(uint256 tokenId)
        external
        view
        returns (
            TycoonLib.CollectiblePerk perk,
            uint256 strength,
            uint256 tycPrice,
            uint256 usdcPrice,
            uint256 shopStock
        )
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

    // Total unique token IDs owned by an address (vouchers + collectibles)
    function ownedTokenCount(address owner) external view returns (uint256) {
        return _ownedTokens[owner].length;
    }

    // Get token ID at index for an owner (0-based index)
    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256) {
        require(index < _ownedTokens[owner].length, "Index out of bounds");
        return _ownedTokens[owner][index];
    }

    // Optional: allow contract to receive ETH if accidentally sent
    receive() external payable {}
}
// ============================================================================
//                          MAIN TYCOON GAME CONTRACT
// ============================================================================

contract Tycoon is ReentrancyGuard, Ownable {
    using TycoonLib for TycoonLib.Game;
    using TycoonLib for TycoonLib.GamePlayer;
    using TycoonLib for TycoonLib.GameSettings;

    uint256 public totalUsers;
    uint256 public totalGames;
    uint256 private _nextGameId = 1;
    uint256 public houseUSDC; // only house balance (5%)

    uint256 public constant TOKEN_REWARD = 1 ether;
    uint256 public minStake = 1000; // adjust to your USDC decimals (6)

    mapping(uint256 => mapping(uint8 => address)) public gameOrderToPlayer;
    mapping(string => TycoonLib.User) public users;
    mapping(address => bool) public registered;
    mapping(address => string) public addressToUsername;
    mapping(uint256 => TycoonLib.Game) public games;
    mapping(uint256 => TycoonLib.GameSettings) public gameSettings;
    mapping(string => TycoonLib.Game) public codeToGame;
    mapping(uint256 => mapping(address => TycoonLib.GamePlayer)) public gamePlayers;
    mapping(address => string) public previousGameCode;
    mapping(uint256 => mapping(address => uint256)) public claims; // rank or removal flag
    /// @dev Turn count per player per game. Backend calls setTurnCount once when player reaches min turns (e.g. 20) for perks.
    mapping(uint256 => mapping(address => uint256)) public turnsPlayed;

    TycoonRewardSystem public immutable rewardSystem;

    // Backend can remove stalling players / vote-out; separate from reward minter
    address public backendGameController;

    /// @dev Min turns required to get full perks on exit (USDC + collectible + TYC). 0 = disabled.
    uint256 public minTurnsForPerks;

    uint256 constant CONSOLATION_VOUCHER = TOKEN_REWARD / 10; // 0.1 TYC

    event PlayerCreated(string indexed username, address indexed player, uint64 timestamp);
    event GameCreated(uint256 indexed gameId, address indexed creator, uint64 timestamp);
    event PlayerJoined(uint256 indexed gameId, address indexed player, uint8 order);
    event PlayerExited(uint256 indexed gameId, address indexed player);
    event PlayerRemoved(uint256 indexed gameId, address indexed player, uint64 timestamp);
    event GameEnded(uint256 indexed gameId, address indexed winner, uint64 timestamp);
    event RewardClaimed(uint256 indexed gameId, address indexed player, uint256 amountUSDC);
    event HouseWithdrawn(uint256 amount, address indexed to);
    event AIGameEnded(uint256 indexed gameId, address indexed player, uint64 timestamp);
    event BackendGameControllerUpdated(address indexed newController);
    event PlayerRemovedByController(uint256 indexed gameId, address indexed player, address indexed removedBy);
    event MinStakeUpdated(uint256 previousMinStake, uint256 newMinStake);
    event PlayerLeftPendingGame(uint256 indexed gameId, address indexed player, uint256 stakeRefunded);
    event TurnCountSet(uint256 indexed gameId, address indexed player, uint256 count);
    event MinTurnsForPerksUpdated(uint256 previous, uint256 newMin);

    constructor(address initialOwner, address _rewardSystem) Ownable(initialOwner) {
        require(_rewardSystem != address(0), "Invalid reward system");
        rewardSystem = TycoonRewardSystem(payable(_rewardSystem));
    }

    /// @param newController Pass address(0) to disable backend game controller.
    function setBackendGameController(address newController) external onlyOwner {
        backendGameController = newController;
        emit BackendGameControllerUpdated(newController);
    }

    /// @notice Set minimum turns a player must have completed to receive full perks on exit. 0 = no minimum. Applies to both voluntary exit (uses turnsPlayed) and removePlayerFromGame (uses passed turnCount).
    function setMinTurnsForPerks(uint256 newMin) external onlyOwner {
        uint256 previous = minTurnsForPerks;
        minTurnsForPerks = newMin;
        emit MinTurnsForPerksUpdated(previous, newMin);
    }

    /// @notice Set a player's turn count for perk eligibility. Call once when they reach the threshold (e.g. 20). Only allows increasing.
    function setTurnCount(uint256 gameId, address player, uint256 count) external onlyGameController {
        require(gamePlayers[gameId][player].playerAddress != address(0), "Not in game");
        require(count > turnsPlayed[gameId][player], "Can only increase");
        turnsPlayed[gameId][player] = count;
        emit TurnCountSet(gameId, player, count);
    }

    modifier onlyPlayerInGame(uint256 gameId, address player) {
        require(gamePlayers[gameId][player].playerAddress != address(0), "Not in game");
        _;
    }

    modifier onlyGameController() {
        require(
            msg.sender == backendGameController || msg.sender == owner(),
            "Not game controller"
        );
        _;
    }

    function registerPlayer(string memory username) external returns (uint256) {
        TycoonLib.validateUsername(username);
        require(users[username].playerAddress == address(0), "Username taken");
        require(!registered[msg.sender], "Already registered");

        totalUsers++;
        uint64 ts = uint64(block.timestamp);

        users[username] = TycoonLib.User({
            id: totalUsers,
            username: username,
            playerAddress: msg.sender,
            registeredAt: ts,
            gamesPlayed: 0,
            gamesWon: 0,
            gamesLost: 0,
            totalStaked: 0,
            totalEarned: 0,
            totalWithdrawn: 0,
            propertiesbought: 0,
            propertiesSold: 0
        });

        registered[msg.sender] = true;
        addressToUsername[msg.sender] = username;

        rewardSystem.mintVoucher(msg.sender, 2 * TOKEN_REWARD);

        emit PlayerCreated(username, msg.sender, ts);
        return totalUsers;
    }

    function createGame(
        string memory creatorUsername,
        string memory gameType,
        string memory playerSymbol,
        uint8 numberOfPlayers,
        string memory code,
        uint256 startingBalance,
        uint256 stakeAmount
    ) external nonReentrant returns (uint256 gameId) {
        TycoonLib.validateUsername(creatorUsername);
        uint8 gType = TycoonLib.stringToGameType(gameType);
        TycoonLib.validateCode(code, gType == uint8(TycoonLib.GameType.PrivateGame));
        if (stakeAmount > 0) {
            require(stakeAmount >= minStake, "Stake too low");
        }

        require(numberOfPlayers >= 2 && numberOfPlayers <= 8, "Players 2-8");
        require(startingBalance > 0, "Invalid balance");
        require(registered[msg.sender], "Not registered");

        TycoonLib.User storage user = users[creatorUsername];
        require(user.playerAddress == msg.sender, "Username mismatch");

        if (gType == uint8(TycoonLib.GameType.PrivateGame)) {
            require(bytes(code).length > 0, "Code required for private game");
        }

        if (stakeAmount > 0) {
            require(rewardSystem.usdc().transferFrom(msg.sender, address(this), stakeAmount), "USDC transfer failed");
        }

        gameId = _nextGameId++;

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
            creator: msg.sender,
            status: TycoonLib.GameStatus.Pending,
            winner: address(0),
            numberOfPlayers: numberOfPlayers,
            joinedPlayers: 1,
            mode: TycoonLib.GameType(gType),
            ai: false,
            createdAt: uint64(block.timestamp),
            endedAt: 0,
            totalStaked: stakeAmount,
            stakePerPlayer: stakeAmount
        });

        gamePlayers[gameId][msg.sender] = TycoonLib.GamePlayer({
            gameId: gameId,
            playerAddress: msg.sender,
            balance: startingBalance,
            position: 0,
            order: 1,
            symbol: TycoonLib.PlayerSymbol(TycoonLib.stringToPlayerSymbol(playerSymbol)),
            username: creatorUsername
        });

        gameOrderToPlayer[gameId][1] = msg.sender;
        codeToGame[code] = games[gameId];
        previousGameCode[msg.sender] = code;

        user.gamesPlayed++;
        user.totalStaked += stakeAmount;
        totalGames++;

        emit GameCreated(gameId, msg.sender, uint64(block.timestamp));
    }

    // createAIGame remains unchanged (already no stake)
    function createAIGame(
        string memory creatorUsername,
        string memory gameType,
        string memory playerSymbol,
        uint8 numberOfAI,
        string memory code,
        uint256 startingBalance
    ) external nonReentrant returns (uint256 gameId) {
        TycoonLib.validateUsername(creatorUsername);
        TycoonLib.validateCode(code, false);
        require(numberOfAI >= 1 && numberOfAI <= 7, "AI players 1-7");
        require(bytes(gameType).length > 0 && bytes(playerSymbol).length > 0, "Invalid params");
        require(startingBalance > 0, "Invalid balance");
        require(registered[msg.sender], "Not registered");

        TycoonLib.User storage user = users[creatorUsername];
        require(user.playerAddress == msg.sender, "Username mismatch");

        uint8 gType = TycoonLib.stringToGameType(gameType);
        gameId = _nextGameId++;
        address creator = msg.sender;

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
            winner: address(0),
            numberOfPlayers: totalPlayers,
            joinedPlayers: 1,
            mode: TycoonLib.GameType(gType),
            ai: true,
            createdAt: uint64(block.timestamp),
            endedAt: 0,
            totalStaked: 0,
            stakePerPlayer: 0
        });

        gamePlayers[gameId][creator] = TycoonLib.GamePlayer({
            gameId: gameId,
            playerAddress: creator,
            balance: startingBalance,
            position: 0,
            order: 1,
            symbol: TycoonLib.PlayerSymbol(TycoonLib.stringToPlayerSymbol(playerSymbol)),
            username: creatorUsername
        });

        gameOrderToPlayer[gameId][1] = creator;

        for (uint8 i = 2; i <= totalPlayers; i++) {
            address aiAddr = address(uint160(i));
            gameOrderToPlayer[gameId][i] = aiAddr;
            gamePlayers[gameId][aiAddr] = TycoonLib.GamePlayer({
                gameId: gameId,
                playerAddress: aiAddr,
                balance: startingBalance,
                position: 0,
                order: i,
                symbol: TycoonLib.PlayerSymbol(0),
                username: string(abi.encodePacked("AI_", TycoonLib.uintToString(i)))
            });
        }

        codeToGame[code] = games[gameId];
        previousGameCode[msg.sender] = code;

        user.gamesPlayed++;
        totalGames++;

        emit GameCreated(gameId, creator, uint64(block.timestamp));
    }

    function endAIGame(
        uint256 gameId,
        uint8 finalPosition, // 1 = win, 2+ = placement/lose
        uint256 finalBalance, // optional: for logging/screenshots
        bool isWin
    ) external nonReentrant returns (bool) {
        TycoonLib.Game storage game = games[gameId];

        require(game.ai, "Not an AI game");
        require(game.status == TycoonLib.GameStatus.Ongoing, "Game already ended");
        require(game.creator == msg.sender, "Only creator can end AI game");

        // Update player state
        gamePlayers[gameId][msg.sender].position = finalPosition;
        gamePlayers[gameId][msg.sender].balance = finalBalance;

        game.status = TycoonLib.GameStatus.Ended;
        game.winner = isWin ? msg.sender : address(0);
        game.endedAt = uint64(block.timestamp);

        TycoonLib.User storage user = users[gamePlayers[gameId][msg.sender].username];

        uint256 voucherAmount = 0;
        TycoonLib.CollectiblePerk perk = TycoonLib.CollectiblePerk.NONE;
        uint256 strength = 1;

        // Very simple reward logic (no pot → no house cut needed)
        if (isWin) {
            voucherAmount = 2 * TOKEN_REWARD; // 2 TYC

            // Random collectible drop (same ranges as before)
            uint8 r = uint8(block.prevrandao % 100);
            if (r < 40) perk = TycoonLib.CollectiblePerk.EXTRA_TURN;
            else if (r < 65) perk = TycoonLib.CollectiblePerk.JAIL_FREE;
            else if (r < 80) perk = TycoonLib.CollectiblePerk.SHIELD;
            else if (r < 90) perk = TycoonLib.CollectiblePerk.TELEPORT;
            else if (r < 97) perk = TycoonLib.CollectiblePerk.ROLL_EXACT;
            else perk = TycoonLib.CollectiblePerk.PROPERTY_DISCOUNT;

            user.gamesWon++;
            // totalEarned not increased (no real money)
        } else {
            // Small consolation for participation/loss
            voucherAmount = CONSOLATION_VOUCHER; // 0.1 TYC
            user.gamesLost++;
        }

        // Mint rewards
        if (voucherAmount > 0) {
            rewardSystem.mintVoucher(msg.sender, voucherAmount);
        }
        if (perk != TycoonLib.CollectiblePerk.NONE) {
            rewardSystem.mintCollectible(msg.sender, perk, strength);
        }

        codeToGame[game.code] = game;

        emit AIGameEnded(gameId, msg.sender, uint64(block.timestamp));

        return true;
    }

    function joinGame(uint256 gameId, string memory playerUsername, string memory playerSymbol, string memory joinCode)
        external
        nonReentrant
        returns (uint8 order)
    {
        TycoonLib.validateUsername(playerUsername);
        TycoonLib.Game storage game = games[gameId];
        require(!game.ai, "Cannot join AI game");
        require(game.creator != address(0), "Game not found");
        require(game.status == TycoonLib.GameStatus.Pending, "Game not open");
        require(game.joinedPlayers < game.numberOfPlayers, "Game is full");
        require(registered[msg.sender], "Not registered");

        TycoonLib.User storage user = users[playerUsername];
        require(user.playerAddress == msg.sender, "Username mismatch");
        require(gamePlayers[gameId][msg.sender].playerAddress == address(0), "Already joined");

        if (game.mode == TycoonLib.GameType.PrivateGame) {
            require(keccak256(bytes(joinCode)) == keccak256(bytes(game.code)), "Wrong code");
        }

        if (game.stakePerPlayer > 0) {
            require(
                rewardSystem.usdc().transferFrom(msg.sender, address(this), game.stakePerPlayer), "Stake payment failed"
            );
        }

        user.gamesPlayed++;
        user.totalStaked += game.stakePerPlayer;
        game.totalStaked += game.stakePerPlayer;

        order = ++game.joinedPlayers;

        gamePlayers[gameId][msg.sender] = TycoonLib.GamePlayer({
            gameId: gameId,
            playerAddress: msg.sender,
            balance: gameSettings[gameId].startingCash,
            position: 0,
            order: order,
            symbol: TycoonLib.PlayerSymbol(TycoonLib.stringToPlayerSymbol(playerSymbol)),
            username: playerUsername
        });

        gameOrderToPlayer[gameId][order] = msg.sender;
        previousGameCode[msg.sender] = game.code;

        emit PlayerJoined(gameId, msg.sender, order);

        if (game.joinedPlayers == game.numberOfPlayers) {
            game.status = TycoonLib.GameStatus.Ongoing;
        }

        codeToGame[game.code] = game;
    }

    /// @notice Leave a game before it starts (status still Pending). Refunds your full stake.
    function leavePendingGame(uint256 gameId) external nonReentrant returns (bool) {
        TycoonLib.Game storage game = games[gameId];
        require(game.creator != address(0), "Game not found");
        require(game.status == TycoonLib.GameStatus.Pending, "Game already started");
        require(!game.ai, "Not for AI games");

        TycoonLib.GamePlayer storage gp = gamePlayers[gameId][msg.sender];
        require(gp.playerAddress != address(0), "Not in game");

        uint256 stakeAmount = game.stakePerPlayer;
        if (stakeAmount > 0) {
            require(rewardSystem.usdc().transfer(msg.sender, stakeAmount), "Refund failed");
            game.totalStaked -= stakeAmount;
        }

        TycoonLib.User storage user = users[gp.username];
        user.gamesPlayed--;
        user.totalStaked -= stakeAmount;

        uint8 order = gp.order;
        delete gamePlayers[gameId][msg.sender];
        delete gameOrderToPlayer[gameId][order];
        game.joinedPlayers--;

        if (game.joinedPlayers == 0) {
            game.status = TycoonLib.GameStatus.Ended;
        }
        codeToGame[game.code] = game;

        emit PlayerLeftPendingGame(gameId, msg.sender, stakeAmount);
        return true;
    }

    function _removePlayer(uint256 gameId, address playerToRemove) internal {
        TycoonLib.Game storage game = games[gameId];
        TycoonLib.GamePlayer storage gp = gamePlayers[gameId][playerToRemove];

        users[gp.username].gamesLost++;

        uint8 order = gp.order;
        delete gamePlayers[gameId][playerToRemove];
        delete gameOrderToPlayer[gameId][order];

        uint8 before = game.joinedPlayers;
        claims[gameId][playerToRemove] = before; // used as removal marker
        game.joinedPlayers--;

        emit PlayerRemoved(gameId, playerToRemove, uint64(block.timestamp));
    }

    /// @param turnCount Pass type(uint256).max to skip min-turns check (e.g. voluntary exit). Otherwise backend-reported turn count for removePlayerFromGame.
    function _payoutReward(uint256 gameId, address player, uint256 rank, uint256 turnCount) private {
        TycoonLib.Game storage game = games[gameId];
        uint256 pot = game.totalStaked;
        IERC20 usdcToken = rewardSystem.usdc();

        if (pot == 0 || rank == 0) {
            rewardSystem.mintVoucher(player, CONSOLATION_VOUCHER);
            emit RewardClaimed(gameId, player, 0);
            return;
        }

        // type(uint256).max = voluntary exit: use on-chain turnsPlayed. Otherwise use passed turnCount (removePlayerFromGame).
        uint256 effectiveTurns = turnCount == type(uint256).max ? turnsPlayed[gameId][player] : turnCount;
        if (minTurnsForPerks > 0 && effectiveTurns < minTurnsForPerks) {
            rewardSystem.mintVoucher(player, CONSOLATION_VOUCHER);
            emit RewardClaimed(gameId, player, 0);
            return;
        }

        uint256 distributable = TycoonLib.getDistributablePot(pot);
        uint256 rewardAmount = TycoonLib.getRankRewardAmount(distributable, rank);

        if (rewardAmount == 0) {
            rewardSystem.mintVoucher(player, CONSOLATION_VOUCHER);
            emit RewardClaimed(gameId, player, 0);
            return;
        }

        require(usdcToken.transfer(player, rewardAmount), "USDC transfer failed");
        require(bytes(addressToUsername[player]).length > 0, "Player not registered");
        users[addressToUsername[player]].totalEarned += rewardAmount;

        if (rank <= 3) {
            _mintPlacementReward(player, rank);
        }

        emit RewardClaimed(gameId, player, rewardAmount);
    }

    function _mintPlacementReward(address player, uint256 rank) internal {
        require(rank <= 3, "Only top 3 get collectibles");

        TycoonLib.CollectiblePerk perk;
        uint256 strength = 1;

        if (rank == 1) {
            strength = 2;
        }

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
        } else if (rank == 3) {
            if (r < 40) perk = TycoonLib.CollectiblePerk.ROLL_BOOST;
            else if (r < 70) perk = TycoonLib.CollectiblePerk.EXTRA_TURN;
            else if (r < 90) perk = TycoonLib.CollectiblePerk.PROPERTY_DISCOUNT;
            else perk = TycoonLib.CollectiblePerk.SHIELD;
        }

        if (perk != TycoonLib.CollectiblePerk.NONE) {
            rewardSystem.mintCollectible(player, perk, strength);
        }

        rewardSystem.mintVoucher(player, TOKEN_REWARD);
    }

    /// @dev turnCount: use type(uint256).max for voluntary exit (no min-turns check); use backend value when removing so contract can enforce minTurnsForPerks.
    function _exitOrRemovePlayer(uint256 gameId, address player, uint256 turnCount) internal {
        TycoonLib.Game storage game = games[gameId];
        require(game.status == TycoonLib.GameStatus.Ongoing, "Game not ongoing");
        require(!game.ai, "Cannot exit AI game");
        require(gamePlayers[gameId][player].playerAddress != address(0), "Not in game");

        uint256 rank;

        if (game.joinedPlayers == 1) {
            uint256 houseCut = (game.totalStaked * TycoonLib.getHousePercent()) / 100;
            houseUSDC += houseCut;

            rank = 1;
            claims[gameId][player] = rank;

            _payoutReward(gameId, player, rank, turnCount);

            users[gamePlayers[gameId][player].username].gamesWon++;

            game.status = TycoonLib.GameStatus.Ended;
            game.winner = player;
            game.endedAt = uint64(block.timestamp);

            emit GameEnded(gameId, player, uint64(block.timestamp));
        } else {
            rank = game.joinedPlayers;
            _removePlayer(gameId, player);
            claims[gameId][player] = rank;

            _payoutReward(gameId, player, rank, turnCount);
        }

        emit PlayerExited(gameId, player);
    }

    /// @notice Player voluntarily exits the game (payout by rank). Min-turns check uses on-chain turnsPlayed (backend calls setTurnCount once when player reaches threshold).
    function exitGame(uint256 gameId) public nonReentrant onlyPlayerInGame(gameId, msg.sender) returns (bool) {
        _exitOrRemovePlayer(gameId, msg.sender, type(uint256).max);
        return true;
    }

    /// @notice Backend removes a player (e.g. vote-out, stalling). Pass turnCount from your DB; if below minTurnsForPerks they get consolation only.
    function removePlayerFromGame(uint256 gameId, address player, uint256 turnCount)
        external
        nonReentrant
        onlyGameController
        onlyPlayerInGame(gameId, player)
        returns (bool)
    {
        _exitOrRemovePlayer(gameId, player, turnCount);
        emit PlayerRemovedByController(gameId, player, msg.sender);
        return true;
    }

    // ------------------------------------------------------------------------
    // Property ownership (backend / game controller only)
    /// @notice Record a property sale for stats. Callable only by backend game controller.
    /// @param sellerUsername Username of the seller (must be registered).
    /// @param buyerUsername Username of the buyer (must be registered).
    function transferPropertyOwnership(string memory sellerUsername, string memory buyerUsername)
        external
        onlyGameController
    {
        TycoonLib.validateUsername(sellerUsername);
        TycoonLib.validateUsername(buyerUsername);

        TycoonLib.User storage seller = users[sellerUsername];
        TycoonLib.User storage buyer = users[buyerUsername];

        require(seller.playerAddress != address(0), "Seller not registered");
        require(buyer.playerAddress != address(0), "Buyer not registered");
        require(seller.playerAddress != buyer.playerAddress, "Seller and buyer must differ");

        seller.propertiesSold++;
        buyer.propertiesbought++;
    }

    function setMinStake(uint256 newMinStake) external onlyOwner {
        uint256 previous = minStake;
        minStake = newMinStake;
        emit MinStakeUpdated(previous, newMinStake);
    }

    function withdrawHouse(uint256 amount) external onlyOwner {
        require(amount <= houseUSDC, "Insufficient house balance");
        houseUSDC -= amount;
        require(rewardSystem.usdc().transfer(owner(), amount), "Withdraw failed");
        emit HouseWithdrawn(amount, owner());
    }

    function drainContract() external onlyOwner {
        IERC20 usdcToken = rewardSystem.usdc();
        uint256 amount = usdcToken.balanceOf(address(this));
        if (amount > 0) {
            require(usdcToken.transfer(owner(), amount), "Transfer failed");
            emit HouseWithdrawn(amount, owner());
        }
    }

    // View helpers
    function getUser(string memory username) external view returns (TycoonLib.User memory) {
        require(users[username].playerAddress != address(0), "Not registered");
        return users[username];
    }

    function getGame(uint256 gameId) external view returns (TycoonLib.Game memory) {
        require(games[gameId].creator != address(0), "Not found");
        return games[gameId];
    }

    function getLastGameCode(address user) external view returns (string memory) {
        return previousGameCode[user];
    }

    function getGamePlayer(uint256 gameId, address player)
        external
        view
        returns (TycoonLib.GamePlayer memory)
    {
        return gamePlayers[gameId][player];
    }

    /// @return Array of current player addresses in the game (order 1..numberOfPlayers; holes if someone exited).
    function getPlayersInGame(uint256 gameId) external view returns (address[] memory) {
        TycoonLib.Game storage game = games[gameId];
        require(game.creator != address(0), "Game not found");
        address[] memory out = new address[](game.numberOfPlayers);
        for (uint8 i = 1; i <= game.numberOfPlayers; i++) {
            out[i - 1] = gameOrderToPlayer[gameId][i];
        }
        return out;
    }

    function getGameSettings(uint256 gameId) external view returns (TycoonLib.GameSettings memory) {
        return gameSettings[gameId];
    }

    function getGameByCode(string memory code) external view returns (TycoonLib.Game memory) {
        TycoonLib.Game memory game = codeToGame[code];
        require(game.creator != address(0), "Not found");
        return game;
    }
}
