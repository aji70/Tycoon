// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {TycoonLib} from "./TycoonLib.sol";
import {TycoonRewardSystem} from "./TycoonRewardSystem.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface ITycoonUserRegistry {
    function createWalletForUser(address owner, string calldata username) external returns (address);
    function grantGameActionReward(address user, bytes32 action) external;
}

/// @notice Logic contract for TycoonUpgradeable (delegatecall target). Same storage layout as TycoonUpgradeable minus logicContract.
interface ITycoonUpgradeableLogic {
    function createGame(address actor, string calldata creatorUsername, string calldata gameType, string calldata playerSymbol, uint8 numberOfPlayers, string calldata code, uint256 startingBalance, uint256 stakeAmount) external returns (uint256 gameId);
    function createAIGame(address actor, string calldata creatorUsername, string calldata gameType, string calldata playerSymbol, uint8 numberOfAI, string calldata code, uint256 startingBalance) external returns (uint256 gameId);
    function joinGame(address actor, uint256 gameId, string calldata playerUsername, string calldata playerSymbol, string calldata joinCode) external returns (uint8 order);
    function leavePendingGame(address actor, uint256 gameId) external returns (bool);
    function exitOrRemovePlayer(uint256 gameId, address player, uint256 turnCount) external;
    function endAIGame(address actor, uint256 gameId, uint8 finalPosition, uint256 finalBalance, bool isWin) external returns (bool);
}

/// @title TycoonUpgradeable
/// @notice UUPS-upgradeable version of the Tycoon game contract. Deploy via ERC1967Proxy and call initialize(owner, rewardSystem).
contract TycoonUpgradeable is ReentrancyGuard, Ownable, Initializable, UUPSUpgradeable {
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

    /// @dev Backend-registered users have a stored password hash; backend passes this when calling on their behalf.
    mapping(address => bytes32) private _passwordHashOf;
    /// @dev True if user registered themselves (msg.sender) or verified ownership via signature. Unverified get no win perks.
    mapping(address => bool) public addressVerified;

    TycoonRewardSystem public rewardSystem;

    /// @notice User registry: creates wallet per user, profile (email), and game-action faucet rewards. Set via setUserRegistry.
    address public userRegistry;

    // Backend can remove stalling players / vote-out; separate from reward minter
    address public backendGameController;
    /// @notice Game faucet (TycoonGameFaucet) is the only caller allowed to update property stats and can also submit turn counts.
    address public gameFaucet;

    /// @dev Min turns required to get full perks on exit (USDC + collectible + TYC). 0 = disabled.
    uint256 public minTurnsForPerks;

    uint256 constant CONSOLATION_VOUCHER = TOKEN_REWARD / 10; // 0.1 TYC

    /// @dev Delegatecall target for heavy game logic (Celo size limit). Set after deploy; use same storage layout as Logic.
    address public logicContract;

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
    event AddressVerified(address indexed player);
    event PlayerRegisteredByBackend(string indexed username, address indexed player);
    event UserRegistryUpdated(address indexed previous, address indexed newRegistry);
    event GameFaucetUpdated(address indexed previous, address indexed newFaucet);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() Ownable(address(1)) {
        _disableInitializers();
    }

    /// @notice Initializer for proxy deployment. Call once when deploying via ERC1967Proxy.
    function initialize(address initialOwner, address _rewardSystem) external initializer {
        require(initialOwner != address(0), "Invalid owner");
        require(_rewardSystem != address(0), "Invalid reward system");
        _transferOwnership(initialOwner);
        rewardSystem = TycoonRewardSystem(payable(_rewardSystem));
    }

    /// @notice Only owner can authorize an upgrade (UUPS).
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// @notice Set logic contract for delegatecall (required for Celo / 24KB limit). Deploy TycoonUpgradeableLogic and set its address here.
    function setLogicContract(address _logicContract) external onlyOwner {
        logicContract = _logicContract;
    }

    /// @param newController Pass address(0) to disable backend game controller.
    function setBackendGameController(address newController) external onlyOwner {
        backendGameController = newController;
        emit BackendGameControllerUpdated(newController);
    }

    /// @notice Set user registry (creates wallet per user, profile + email, game-action faucet). Pass address(0) to disable.
    function setUserRegistry(address _userRegistry) external onlyOwner {
        address previous = userRegistry;
        userRegistry = _userRegistry;
        emit UserRegistryUpdated(previous, _userRegistry);
    }

    /// @notice Set game faucet (TycoonGameFaucet). Only the faucet can call setPropertyStats; faucet can also call setTurnCount.
    function setGameFaucet(address _gameFaucet) external onlyOwner {
        address previous = gameFaucet;
        gameFaucet = _gameFaucet;
        emit GameFaucetUpdated(previous, _gameFaucet);
    }

    /// @notice Set minimum turns a player must have completed to receive full perks on exit. 0 = no minimum. Applies to both voluntary exit (uses turnsPlayed) and removePlayerFromGame (uses passed turnCount).
    function setMinTurnsForPerks(uint256 newMin) external onlyOwner {
        uint256 previous = minTurnsForPerks;
        minTurnsForPerks = newMin;
        emit MinTurnsForPerksUpdated(previous, newMin);
    }

    /// @notice Set a player's turn count for perk eligibility. Call once when they reach the threshold (e.g. 20). Only allows increasing. Callable by backend or game faucet.
    function setTurnCount(uint256 gameId, address player, uint256 count) external onlyGameControllerOrFaucet {
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

    modifier onlyGameFaucet() {
        require(msg.sender == gameFaucet || msg.sender == owner(), "Not game faucet");
        _;
    }

    modifier onlyGameControllerOrFaucet() {
        require(
            msg.sender == backendGameController || msg.sender == gameFaucet || msg.sender == owner(),
            "Not game controller or faucet"
        );
        _;
    }

    /// @dev Revert if not backend or password does not match stored hash for forPlayer.
    function _requireBackendAuth(address forPlayer, bytes32 passwordHash) internal view {
        require(
            msg.sender == backendGameController || msg.sender == owner(),
            "Not game controller"
        );
        require(forPlayer != address(0), "Zero address");
        require(_passwordHashOf[forPlayer] != bytes32(0), "No password set");
        require(_passwordHashOf[forPlayer] == passwordHash, "Wrong password");
    }

    /// @dev Resolve actor: by address or by username. One of forPlayer or forUsername must identify the account.
    function _resolvePlayer(address forPlayer, string memory forUsername) internal view returns (address) {
        if (forPlayer != address(0)) return forPlayer;
        require(bytes(forUsername).length > 0, "Need address or username");
        address a = users[forUsername].playerAddress;
        require(a != address(0), "Username not registered");
        return a;
    }

    /// @notice Verify ownership of this address (e.g. after backend registration). Sign message: "Tycoon verify: <your address>".
    function verifyAddress(bytes calldata signature) external {
        bytes32 messageHash = MessageHashUtils.toEthSignedMessageHash(
            keccak256(abi.encodePacked("Tycoon verify: ", msg.sender))
        );
        address signer = ECDSA.recover(messageHash, signature);
        require(signer == msg.sender, "Invalid signature");
        require(!addressVerified[msg.sender], "Already verified");
        addressVerified[msg.sender] = true;
        emit AddressVerified(msg.sender);
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
        addressVerified[msg.sender] = true;

        rewardSystem.mintVoucher(msg.sender, 2 * TOKEN_REWARD);

        if (userRegistry != address(0)) {
            try ITycoonUserRegistry(userRegistry).createWalletForUser(msg.sender, username) returns (address) {}
            catch {}
        }
        emit PlayerCreated(username, msg.sender, ts);
        return totalUsers;
    }

    /// @notice Backend registers a user on behalf of an address (e.g. before they connect wallet). They get no perks until verifyAddress(signature).
    function registerPlayerFor(address playerAddress, string memory username, bytes32 passwordHash)
        external
        onlyGameController
        returns (uint256)
    {
        TycoonLib.validateUsername(username);
        require(users[username].playerAddress == address(0), "Username taken");
        require(!registered[playerAddress], "Already registered");
        require(playerAddress != address(0), "Zero address");
        require(passwordHash != bytes32(0), "Password hash required");

        _passwordHashOf[playerAddress] = passwordHash;
        addressVerified[playerAddress] = false;

        totalUsers++;
        uint64 ts = uint64(block.timestamp);

        users[username] = TycoonLib.User({
            id: totalUsers,
            username: username,
            playerAddress: playerAddress,
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

        registered[playerAddress] = true;
        addressToUsername[playerAddress] = username;

        rewardSystem.mintVoucher(playerAddress, 2 * TOKEN_REWARD);

        if (userRegistry != address(0)) {
            try ITycoonUserRegistry(userRegistry).createWalletForUser(playerAddress, username) returns (address) {}
            catch {}
        }
        emit PlayerRegisteredByBackend(username, playerAddress);
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
        require(logicContract != address(0), "Logic not set");
        (bool ok, bytes memory data) = logicContract.delegatecall(abi.encodeWithSelector(ITycoonUpgradeableLogic.createGame.selector, msg.sender, creatorUsername, gameType, playerSymbol, numberOfPlayers, code, startingBalance, stakeAmount));
        require(ok, "Logic: createGame failed");
        return abi.decode(data, (uint256));
    }

    /// @notice Backend creates a game on behalf of a player. Pass either forPlayer or forUsername; passwordHash must match stored hash.
    function createGameByBackend(
        address forPlayer,
        string memory forUsername,
        bytes32 passwordHash,
        string memory creatorUsername,
        string memory gameType,
        string memory playerSymbol,
        uint8 numberOfPlayers,
        string memory code,
        uint256 startingBalance,
        uint256 stakeAmount
    ) external nonReentrant returns (uint256 gameId) {
        address actor = _resolvePlayer(forPlayer, forUsername);
        _requireBackendAuth(actor, passwordHash);
        require(logicContract != address(0), "Logic not set");
        (bool ok, bytes memory data) = logicContract.delegatecall(abi.encodeWithSelector(ITycoonUpgradeableLogic.createGame.selector, actor, creatorUsername, gameType, playerSymbol, numberOfPlayers, code, startingBalance, stakeAmount));
        require(ok, "Logic: createGame failed");
        return abi.decode(data, (uint256));
    }

    function createAIGame(
        string memory creatorUsername,
        string memory gameType,
        string memory playerSymbol,
        uint8 numberOfAI,
        string memory code,
        uint256 startingBalance
    ) external nonReentrant returns (uint256 gameId) {
        require(logicContract != address(0), "Logic not set");
        (bool ok, bytes memory data) = logicContract.delegatecall(abi.encodeWithSelector(ITycoonUpgradeableLogic.createAIGame.selector, msg.sender, creatorUsername, gameType, playerSymbol, numberOfAI, code, startingBalance));
        require(ok, "Logic: createAIGame failed");
        return abi.decode(data, (uint256));
    }

    function createAIGameByBackend(
        address forPlayer,
        string memory forUsername,
        bytes32 passwordHash,
        string memory creatorUsername,
        string memory gameType,
        string memory playerSymbol,
        uint8 numberOfAI,
        string memory code,
        uint256 startingBalance
    ) external nonReentrant returns (uint256 gameId) {
        address actor = _resolvePlayer(forPlayer, forUsername);
        _requireBackendAuth(actor, passwordHash);
        require(logicContract != address(0), "Logic not set");
        (bool ok, bytes memory data) = logicContract.delegatecall(abi.encodeWithSelector(ITycoonUpgradeableLogic.createAIGame.selector, actor, creatorUsername, gameType, playerSymbol, numberOfAI, code, startingBalance));
        require(ok, "Logic: createAIGame failed");
        return abi.decode(data, (uint256));
    }

    function endAIGame(
        uint256 gameId,
        uint8 finalPosition,
        uint256 finalBalance,
        bool isWin
    ) external nonReentrant returns (bool) {
        require(logicContract != address(0), "Logic not set");
        (bool ok, bytes memory data) = logicContract.delegatecall(abi.encodeWithSelector(ITycoonUpgradeableLogic.endAIGame.selector, msg.sender, gameId, finalPosition, finalBalance, isWin));
        require(ok, "Logic: endAIGame failed");
        return abi.decode(data, (bool));
    }

    function endAIGameByBackend(
        address forPlayer,
        string memory forUsername,
        bytes32 passwordHash,
        uint256 gameId,
        uint8 finalPosition,
        uint256 finalBalance,
        bool isWin
    ) external nonReentrant returns (bool) {
        address actor = _resolvePlayer(forPlayer, forUsername);
        _requireBackendAuth(actor, passwordHash);
        require(logicContract != address(0), "Logic not set");
        (bool ok, bytes memory data) = logicContract.delegatecall(abi.encodeWithSelector(ITycoonUpgradeableLogic.endAIGame.selector, actor, gameId, finalPosition, finalBalance, isWin));
        require(ok, "Logic: endAIGame failed");
        return abi.decode(data, (bool));
    }

    function joinGame(uint256 gameId, string memory playerUsername, string memory playerSymbol, string memory joinCode)
        external
        nonReentrant
        returns (uint8 order)
    {
        require(logicContract != address(0), "Logic not set");
        (bool ok, bytes memory data) = logicContract.delegatecall(abi.encodeWithSelector(ITycoonUpgradeableLogic.joinGame.selector, msg.sender, gameId, playerUsername, playerSymbol, joinCode));
        require(ok, "Logic: joinGame failed");
        return abi.decode(data, (uint8));
    }

    function joinGameByBackend(
        address forPlayer,
        string memory forUsername,
        bytes32 passwordHash,
        uint256 gameId,
        string memory playerUsername,
        string memory playerSymbol,
        string memory joinCode
    ) external nonReentrant returns (uint8 order) {
        address actor = _resolvePlayer(forPlayer, forUsername);
        _requireBackendAuth(actor, passwordHash);
        require(logicContract != address(0), "Logic not set");
        (bool ok, bytes memory data) = logicContract.delegatecall(abi.encodeWithSelector(ITycoonUpgradeableLogic.joinGame.selector, actor, gameId, playerUsername, playerSymbol, joinCode));
        require(ok, "Logic: joinGame failed");
        return abi.decode(data, (uint8));
    }

    /// @notice Leave a game before it starts (status still Pending). Refunds your full stake.
    function leavePendingGame(uint256 gameId) external nonReentrant returns (bool) {
        require(logicContract != address(0), "Logic not set");
        (bool ok, bytes memory data) = logicContract.delegatecall(abi.encodeWithSelector(ITycoonUpgradeableLogic.leavePendingGame.selector, msg.sender, gameId));
        require(ok, "Logic: leavePendingGame failed");
        return abi.decode(data, (bool));
    }

    function leavePendingGameByBackend(
        address forPlayer,
        string memory forUsername,
        bytes32 passwordHash,
        uint256 gameId
    ) external nonReentrant returns (bool) {
        address actor = _resolvePlayer(forPlayer, forUsername);
        _requireBackendAuth(actor, passwordHash);
        require(logicContract != address(0), "Logic not set");
        (bool ok, bytes memory data) = logicContract.delegatecall(abi.encodeWithSelector(ITycoonUpgradeableLogic.leavePendingGame.selector, actor, gameId));
        require(ok, "Logic: leavePendingGame failed");
        return abi.decode(data, (bool));
    }

    /// @notice Player voluntarily exits the game (payout by rank). Min-turns check uses on-chain turnsPlayed (backend calls setTurnCount once when player reaches threshold).
    function exitGame(uint256 gameId) public nonReentrant onlyPlayerInGame(gameId, msg.sender) returns (bool) {
        require(logicContract != address(0), "Logic not set");
        (bool ok,) = logicContract.delegatecall(abi.encodeWithSelector(ITycoonUpgradeableLogic.exitOrRemovePlayer.selector, gameId, msg.sender, type(uint256).max));
        require(ok, "Logic: exitGame failed");
        return true;
    }

    function exitGameByBackend(
        address forPlayer,
        string memory forUsername,
        bytes32 passwordHash,
        uint256 gameId
    ) external nonReentrant returns (bool) {
        address actor = _resolvePlayer(forPlayer, forUsername);
        _requireBackendAuth(actor, passwordHash);
        require(gamePlayers[gameId][actor].playerAddress != address(0), "Not in game");
        require(logicContract != address(0), "Logic not set");
        (bool ok,) = logicContract.delegatecall(abi.encodeWithSelector(ITycoonUpgradeableLogic.exitOrRemovePlayer.selector, gameId, actor, type(uint256).max));
        require(ok, "Logic: exitGame failed");
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
        require(logicContract != address(0), "Logic not set");
        (bool ok,) = logicContract.delegatecall(abi.encodeWithSelector(ITycoonUpgradeableLogic.exitOrRemovePlayer.selector, gameId, player, turnCount));
        require(ok, "Logic: removePlayer failed");
        emit PlayerRemovedByController(gameId, player, msg.sender);
        return true;
    }

    /// @notice Update property sale stats (seller sold one, buyer bought one). Only callable by game faucet. Replaces transferPropertyOwnership.
    function setPropertyStats(string calldata sellerUsername, string calldata buyerUsername) external onlyGameFaucet {
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
