// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {TycoonLib} from "./TycoonLib.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {ERC1155} from "lib/openzeppelin-contracts/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Burnable} from "lib/openzeppelin-contracts/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import {Pausable} from "lib/openzeppelin-contracts/contracts/utils/Pausable.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC1155/utils/ERC1155Holder.sol";

// ============================================================================
//                  TYCOON REWARD & COLLECTIBLES SYSTEM (ERC-1155)
// ============================================================================
// Features:
// - Unique redeemable TYC vouchers
// - Unique and semi-fungible collectible perks (shop supports multiple copies)
// - Dynamic metadata via on-chain uri()
// - Fixed cash perk tiers: [0, 10, 25, 50, 100, 250]
contract TycoonRewardSystem is ERC1155, ERC1155Burnable, ERC1155Holder, Ownable, Pausable, ReentrancyGuard {
    IERC20 public tycToken;
    IERC20 public immutable usdc;

    // Token ID ranges
    uint256 private _nextVoucherId = 1_000_000_000;
    uint256 private _nextCollectibleId = 2_000_000_000;

    // Voucher data
    mapping(uint256 => uint256) public voucherRedeemValue;

    // Fixed cash tiers (index 1–5)
    uint256[] private CASH_TIERS = [0, 10, 25, 50, 100, 250];

    // Dynamic metadata
    string private _baseURI = "https://gateway.pinata.cloud/ipfs/bafkreiabe7dquw4ekh2p4b2b4fysqckzyclk5mcycih462xvqgxcwlgjjy";

    // Collectible data (shared across all copies of the same tokenId)
    mapping(uint256 => TycoonLib.CollectiblePerk) public collectiblePerk;
    mapping(uint256 => uint256) public collectiblePerkStrength;
    mapping(uint256 => uint256) public collectibleTycPrice;
    mapping(uint256 => uint256) public collectibleUsdcPrice;

    // Admin
    address public backendMinter;

    // Owner enumeration
    mapping(address => uint256[]) private _ownedTokens;
    mapping(address => mapping(uint256 => uint256)) private _ownedTokensIndex;

    // Events
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
    event BaseURIUpdated(string newBaseURI);

    constructor(address _tycToken, address _usdc, address initialOwner)
        ERC1155("") // URI handled dynamically
        Ownable(initialOwner)
    {
        require(_tycToken != address(0), "Invalid TYC token");
        require(_usdc != address(0), "Invalid USDC token");
        tycToken = IERC20(_tycToken);
        usdc = IERC20(_usdc);
    }

    modifier onlyBackend() {
        require(msg.sender == backendMinter || msg.sender == owner(), "Unauthorized: backend or owner");
        _;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155, ERC1155Holder)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ============================= ADMIN =============================
    function setBackendMinter(address newMinter) external onlyOwner {
        require(newMinter != address(0), "Invalid address");
        backendMinter = newMinter;
        emit BackendMinterUpdated(newMinter);
    }

    function setBaseURI(string memory newBaseURI) external onlyOwner {
        require(bytes(newBaseURI).length > 0, "Empty URI");
        _baseURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function withdrawFunds(IERC20 token, address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid recipient");
        require(token.transfer(to, amount), "Transfer failed");
        emit FundsWithdrawn(address(token), to, amount);
    }

    function setTycToken(address newTycToken) external onlyOwner {
        require(newTycToken != address(0), "Invalid token");
        tycToken = IERC20(newTycToken);
    }

    // ============================= METADATA =============================
    function uri(uint256 tokenId) public view virtual override returns (string memory) {
        return string(abi.encodePacked(_baseURI, _uintToString(tokenId), ".json"));
    }

    // ============================= VOUCHERS =============================
    function mintVoucher(address to, uint256 tycValue) external onlyBackend returns (uint256 tokenId) {
        require(to != address(0), "Invalid recipient");
        require(tycValue > 0, "Value > 0");

        tokenId = _nextVoucherId++;
        voucherRedeemValue[tokenId] = tycValue;

        _mint(to, tokenId, 1, "");
        emit VoucherMinted(tokenId, to, tycValue);
    }

    function redeemVoucher(uint256 tokenId) external whenNotPaused {
        require(balanceOf(msg.sender, tokenId) == 1, "Must own voucher");
        uint256 value = voucherRedeemValue[tokenId];
        require(value > 0, "Invalid voucher");

        require(tycToken.transfer(msg.sender, value), "TYC transfer failed");

        _burn(msg.sender, tokenId, 1);
        delete voucherRedeemValue[tokenId];

        emit VoucherRedeemed(tokenId, msg.sender, value);
    }

    // ============================= COLLECTIBLES =============================
    function mintCollectible(address to, TycoonLib.CollectiblePerk perk, uint256 strength)
        external
        onlyBackend
        returns (uint256 tokenId)
    {
        require(to != address(0), "Invalid recipient");
        require(perk != TycoonLib.CollectiblePerk.NONE, "Invalid perk");
        _validateStrength(perk, strength);

        tokenId = _nextCollectibleId++;
        collectiblePerk[tokenId] = perk;
        collectiblePerkStrength[tokenId] = strength;

        _mint(to, tokenId, 1, "");
        emit CollectibleMinted(tokenId, to, perk, strength);
    }

    // Shop
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

    function buyCollectible(uint256 tokenId, bool useUsdc) external whenNotPaused nonReentrant {
        uint256 price = useUsdc ? collectibleUsdcPrice[tokenId] : collectibleTycPrice[tokenId];
        IERC20 paymentToken = useUsdc ? usdc : tycToken;

        require(price > 0, "Not for sale");
        require(balanceOf(address(this), tokenId) >= 1, "Out of stock");

        require(paymentToken.transferFrom(msg.sender, address(this), price), "Payment failed");
        _safeTransferFrom(address(this), msg.sender, tokenId, 1, "");

        emit CollectibleBought(tokenId, msg.sender, price, useUsdc);
    }

    // Fixed burn function
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
        // Metadata intentionally preserved for remaining copies
    }

    // ============================= HELPERS =============================
    function _validateStrength(TycoonLib.CollectiblePerk perk, uint256 strength) internal pure {
        if (perk == TycoonLib.CollectiblePerk.CASH_TIERED || perk == TycoonLib.CollectiblePerk.TAX_REFUND) {
            require(strength >= 1 && strength <= 5, "Tier must be 1-5");
        }
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

    // Enumeration
    function _addTokenToOwnerEnumeration(address owner, uint256 tokenId) private {
        if (balanceOf(owner, tokenId) == 0) return;
        uint256 index = _ownedTokensIndex[owner][tokenId];
        if (_ownedTokens[owner].length == 0 || _ownedTokens[owner][index] != tokenId) {
            _ownedTokens[owner].push(tokenId);
            _ownedTokensIndex[owner][tokenId] = _ownedTokens[owner].length - 1;
        }
    }

    function _removeTokenFromOwnerEnumeration(address owner, uint256 tokenId) private {
        if (balanceOf(owner, tokenId) > 0) return;

        uint256 lastIndex = _ownedTokens[owner].length - 1;
        uint256 tokenIndex = _ownedTokensIndex[owner][tokenId];

        if (tokenIndex <= lastIndex) {
            uint256 lastTokenId = _ownedTokens[owner][lastIndex];
            _ownedTokens[owner][tokenIndex] = lastTokenId;
            _ownedTokensIndex[owner][lastTokenId] = tokenIndex;
        }

        _ownedTokens[owner].pop();
        delete _ownedTokensIndex[owner][tokenId];
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        virtual
        override
    {
        super._update(from, to, ids, values);

        for (uint256 i = 0; i < ids.length; ++i) {
            uint256 id = ids[i];
            uint256 val = values[i];
            if (from != address(0) && val > 0) _removeTokenFromOwnerEnumeration(from, id);
            if (to != address(0) && val > 0) _addTokenToOwnerEnumeration(to, id);
        }
    }

    // ============================= VIEWS =============================
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

    function ownedTokenCount(address owner) external view returns (uint256) {
        return _ownedTokens[owner].length;
    }

    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256) {
        require(index < _ownedTokens[owner].length, "Index out of bounds");
        return _ownedTokens[owner][index];
    }

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
    uint256 public houseBalance;
    uint256 public constant TOKEN_REWARD = 1 ether;

    uint256 public minStake = 0.01 ether;

    mapping(uint256 => mapping(uint8 => address)) public gameOrderToPlayer;
    mapping(string => TycoonLib.User) public users;
    mapping(address => bool) public registered;
    mapping(address => string) public addressToUsername;
    mapping(uint256 => TycoonLib.Game) public games;
    mapping(uint256 => TycoonLib.GameSettings) public gameSettings;
    mapping(string => TycoonLib.Game) public codeToGame;
    mapping(uint256 => mapping(address => TycoonLib.GamePlayer)) public gamePlayers;
    mapping(address => string) public previousGameCode;
    mapping(string => TycoonLib.GamePosition) public gameFinalPositions;
    mapping(uint256 => mapping(address => bool)) public hasClaimedReward;

    TycoonRewardSystem public immutable rewardSystem;

    event PlayerCreated(string indexed username, address indexed player, uint64 timestamp);
    event GameCreated(uint256 indexed gameId, address indexed creator, uint64 timestamp);
    event PlayerJoined(uint256 indexed gameId, address indexed player, uint8 order);
    event PlayerRemoved(uint256 indexed gameId, address indexed player, uint64 timestamp);
    event GameEnded(uint256 indexed gameId, address indexed winner, uint64 timestamp);
    event RewardClaimed(uint256 indexed gameId, address indexed player, uint256 amount);
    event AIGameEnded(uint256 indexed gameId, address indexed player, uint64 timestamp);
    event HouseWithdrawn(uint256 amount, address indexed to);
    event PlayerWonWithRewards(uint256 indexed gameId, address indexed winner, uint256 ethReward, uint256 tycVoucher);
    event PlayerWonWithVoucher(uint256 indexed gameId, address indexed player, uint256 ethReward, uint256 tycVoucher);

    constructor(address initialOwner, address _rewardSystem) Ownable(initialOwner) {
        require(_rewardSystem != address(0), "Invalid reward system address");
        rewardSystem = TycoonRewardSystem(payable(_rewardSystem));
    }

    modifier nonEmptyUsername(string memory username) {
        require(bytes(username).length > 0, "Username empty");
        _;
    }

    modifier onlyPlayerInGame(uint256 gameId, address player) {
        require(gamePlayers[gameId][player].playerAddress != address(0), "Not in game");
        _;
    }

    function registerPlayer(string memory username) external nonEmptyUsername(username) returns (uint256) {
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
            totalWithdrawn: 0
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
    ) external payable nonReentrant nonEmptyUsername(creatorUsername) returns (uint256 gameId) {
        require(numberOfPlayers >= 2 && numberOfPlayers <= 8, "Players 2-8");
        require(msg.value == stakeAmount, "Wrong ETH");
        require(stakeAmount >= minStake, "Below min stake");
        require(bytes(gameType).length > 0 && bytes(playerSymbol).length > 0, "Invalid params");
        require(startingBalance > 0, "Invalid balance");
        require(registered[msg.sender], "Not registered");

        TycoonLib.User storage user = users[creatorUsername];
        require(user.playerAddress == msg.sender, "Username mismatch");

        uint8 gType = TycoonLib.stringToGameType(gameType);
        if (gType == uint8(TycoonLib.GameType.PrivateGame)) {
            require(bytes(code).length > 0, "Code required");
        }

        gameId = _nextGameId++;
        address creator = msg.sender;

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
        codeToGame[code] = games[gameId];
        previousGameCode[msg.sender] = code;

        user.gamesPlayed++;
        user.totalStaked += stakeAmount;
        totalGames++;

        emit GameCreated(gameId, creator, uint64(block.timestamp));
    }

    function createAIGame(
        string memory creatorUsername,
        string memory gameType,
        string memory playerSymbol,
        uint8 numberOfAI,
        string memory code,
        uint256 startingBalance,
        uint256 stakeAmount
    ) external payable nonReentrant nonEmptyUsername(creatorUsername) returns (uint256 gameId) {
        require(numberOfAI >= 1 && numberOfAI <= 7, "AI players 1-7");
        require(msg.value == stakeAmount, "Wrong ETH");
        require(stakeAmount >= minStake, "Below min stake");
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
            totalStaked: stakeAmount,
            stakePerPlayer: stakeAmount
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
                username: string(abi.encodePacked("AI_", _uintToString(i)))
            });
        }

        codeToGame[code] = games[gameId];
        previousGameCode[msg.sender] = code;

        user.gamesPlayed++;
        user.totalStaked += stakeAmount;
        totalGames++;

        emit GameCreated(gameId, creator, uint64(block.timestamp));
    }

    function joinGame(uint256 gameId, string memory playerUsername, string memory playerSymbol, string memory joinCode)
        external
        payable
        nonReentrant
        nonEmptyUsername(playerUsername)
        returns (uint8 order)
    {
        TycoonLib.Game storage game = games[gameId];
        require(!game.ai, "Cannot join AI game");
        require(msg.value == game.stakePerPlayer, "Wrong stake");
        require(game.creator != address(0), "Game not found");
        require(game.status == TycoonLib.GameStatus.Pending, "Not open");
        require(game.joinedPlayers < game.numberOfPlayers, "Full");
        require(registered[msg.sender], "Not registered");

        TycoonLib.User storage user = users[playerUsername];
        require(user.playerAddress == msg.sender, "Username mismatch");
        require(gamePlayers[gameId][msg.sender].playerAddress == address(0), "Already joined");
        require(bytes(playerSymbol).length > 0, "Invalid symbol");

        if (game.mode == TycoonLib.GameType.PrivateGame) {
            require(keccak256(bytes(joinCode)) == keccak256(bytes(game.code)), "Wrong code");
        }

        user.gamesPlayed++;
        user.totalStaked += msg.value;
        game.totalStaked += msg.value;

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
    }

    function _removePlayer(uint256 gameId, address playerToRemove) internal {
        TycoonLib.Game storage game = games[gameId];
        TycoonLib.GamePlayer storage gp = gamePlayers[gameId][playerToRemove];

        users[gp.username].gamesLost++;

        uint8 order = gp.order;
        delete gamePlayers[gameId][playerToRemove];
        delete gameOrderToPlayer[gameId][order];

        uint8 before = game.joinedPlayers;
        game.joinedPlayers--;

        emit PlayerRemoved(gameId, playerToRemove, uint64(block.timestamp));

        if (before == 2) gameFinalPositions[game.code].runnersup = playerToRemove;
        else if (before == 3) gameFinalPositions[game.code].losers = playerToRemove;

        if (game.joinedPlayers == 1) {
            address winner;
            for (uint8 i = 1; i <= game.numberOfPlayers; i++) {
                address p = gameOrderToPlayer[gameId][i];
                if (p != address(0)) {
                    winner = p;
                    break;
                }
            }
            require(winner != address(0), "No winner");

            users[gamePlayers[gameId][winner].username].gamesWon++;

            gameFinalPositions[game.code].winner = winner;
            game.status = TycoonLib.GameStatus.Ended;
            game.winner = winner;
            game.endedAt = uint64(block.timestamp);

            emit GameEnded(gameId, winner, uint64(block.timestamp));
        }
    }

    function endAIGameAndClaim(uint256 gameId, uint8 finalPosition, uint256 finalBalance, bool isWin)
        external
        nonReentrant
        returns (bool)
    {
        TycoonLib.Game storage game = games[gameId];
        require(game.ai, "Not AI game");
        require(game.status == TycoonLib.GameStatus.Ongoing, "Already ended");
        require(game.creator == msg.sender, "Only creator");

        gamePlayers[gameId][msg.sender].position = finalPosition;
        gamePlayers[gameId][msg.sender].balance = finalBalance;

        game.status = TycoonLib.GameStatus.Ended;
        game.winner = isWin ? msg.sender : address(0);
        game.endedAt = uint64(block.timestamp);

        TycoonLib.User storage user = users[gamePlayers[gameId][msg.sender].username];
        uint256 stake = game.stakePerPlayer;
        uint256 voucherAmount;
        TycoonLib.CollectiblePerk perk;
        uint256 strength = 1;

        if (isWin) {
            (bool sent,) = payable(msg.sender).call{value: stake}("");
            require(sent, "Refund failed");

            voucherAmount = 2 * TOKEN_REWARD;

            uint8 r = uint8(block.prevrandao % 100);
            if (r < 40) perk = TycoonLib.CollectiblePerk.EXTRA_TURN;
            else if (r < 65) perk = TycoonLib.CollectiblePerk.JAIL_FREE;
            else if (r < 80) perk = TycoonLib.CollectiblePerk.SHIELD;
            else if (r < 90) perk = TycoonLib.CollectiblePerk.TELEPORT;
            else if (r < 97) perk = TycoonLib.CollectiblePerk.ROLL_EXACT;
            else perk = TycoonLib.CollectiblePerk.PROPERTY_DISCOUNT;

            user.gamesWon++;
            user.totalEarned += stake;
        } else {
            houseBalance += stake;
            voucherAmount = TOKEN_REWARD;

            uint8 r = uint8(block.prevrandao % 100);
            if (r < 50) perk = TycoonLib.CollectiblePerk.EXTRA_TURN;
            else if (r < 80) perk = TycoonLib.CollectiblePerk.ROLL_BOOST;
            else perk = TycoonLib.CollectiblePerk.PROPERTY_DISCOUNT;

            user.gamesLost++;
        }

        rewardSystem.mintVoucher(msg.sender, voucherAmount);
        rewardSystem.mintCollectible(msg.sender, perk, strength);

        emit PlayerWonWithVoucher(gameId, msg.sender, isWin ? stake : 0, voucherAmount);
        emit AIGameEnded(gameId, msg.sender, uint64(block.timestamp));
        return true;
    }

    function claimReward(uint256 gameId)
        external
        nonReentrant
        onlyPlayerInGame(gameId, msg.sender)
        returns (uint256 reward)
    {
        TycoonLib.Game storage game = games[gameId];
        require(game.status == TycoonLib.GameStatus.Ended, "Not ended");
        require(!game.ai, "Use AI claim");
        require(!hasClaimedReward[gameId][msg.sender], "Already claimed");

        TycoonLib.GamePosition storage pos = gameFinalPositions[game.code];
        uint256 pot = game.totalStaked;
        uint256 stake = game.stakePerPlayer;

        if (pos.winner == msg.sender) {
            require(pot >= 2 * stake, "Min 2 players");
            uint256 losersPool = pot - stake;
            uint256 houseCut = (losersPool * 40) / 100;
            reward = stake + (losersPool * 60) / 100;
            houseBalance += houseCut;
            rewardSystem.mintVoucher(msg.sender, TOKEN_REWARD);
            emit PlayerWonWithRewards(gameId, msg.sender, reward, TOKEN_REWARD);
        } else if (pos.runnersup == msg.sender) {
            uint256 earlyPool = pot - 2 * stake;
            if (earlyPool > 0) reward = (earlyPool * 30) / 100;
            if (reward > 0) rewardSystem.mintVoucher(msg.sender, TOKEN_REWARD / 2);
        } else if (pos.losers == msg.sender && game.numberOfPlayers >= 4) {
            uint256 earlyPool = pot - 3 * stake;
            if (earlyPool > 0) reward = (earlyPool * 20) / 100;
            else if (game.numberOfPlayers == 4) reward = stake / 10;
            if (reward > 0) rewardSystem.mintVoucher(msg.sender, TOKEN_REWARD / 4);
        } else {
            revert("No reward");
        }

        require(reward > 0, "No reward");

        (bool sent,) = payable(msg.sender).call{value: reward}("");
        require(sent, "Transfer failed");

        users[gamePlayers[gameId][msg.sender].username].totalEarned += reward;
        hasClaimedReward[gameId][msg.sender] = true;

        if (pos.winner == msg.sender) pos.winner = address(0);
        else if (pos.runnersup == msg.sender) pos.runnersup = address(0);
        else if (pos.losers == msg.sender) pos.losers = address(0);

        emit RewardClaimed(gameId, msg.sender, reward);
    }

    function setMinStake(uint256 newMin) external onlyOwner {
        require(newMin > 0, "Min > 0");
        minStake = newMin;
    }

    function withdrawHouse(uint256 amount) external onlyOwner {
        require(amount <= houseBalance, "Insufficient");
        houseBalance -= amount;
        (bool sent,) = payable(owner()).call{value: amount}("");
        require(sent);
        emit HouseWithdrawn(amount, owner());
    }

    function drainContract() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "No balance");
        (bool sent,) = payable(owner()).call{value: bal}("");
        require(sent);
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

    function getGamePlayer(uint256 gameId, string memory username)
        external
        view
        returns (TycoonLib.GamePlayer memory)
    {
        address addr = users[username].playerAddress;
        require(addr != address(0), "Not registered");
        require(gamePlayers[gameId][addr].playerAddress != address(0), "Not in game");
        return gamePlayers[gameId][addr];
    }

    function getGamePlayerByAddress(uint256 gameId, address player)
        external
        view
        returns (TycoonLib.GamePlayer memory)
    {
        return gamePlayers[gameId][player];
    }

    function getGameSettings(uint256 gameId) external view returns (TycoonLib.GameSettings memory) {
        return gameSettings[gameId];
    }

    function getGameByCode(string memory code) external view returns (TycoonLib.Game memory) {
        TycoonLib.Game memory game = codeToGame[code];
        require(game.creator != address(0), "Not found");
        return game;
    }

    function _uintToString(uint256 value) private pure returns (string memory) {
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
}
