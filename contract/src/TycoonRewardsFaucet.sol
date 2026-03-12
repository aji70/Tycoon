// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {TycoonLib} from "./TycoonLib.sol";
import {TycoonRewardSystem} from "./Tycoon.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TycoonRewardsFaucet
/// @notice Faucet for daily login rewards, streaks, and extensible reward types. Plug into TycoonUpgradeable by setting this contract as backendMinter on TycoonRewardSystem.
/// @dev Deploy after TycoonRewardSystem; call rewardSystem.setBackendMinter(address(this)); then set gameContract to your TycoonUpgradeable proxy.
contract TycoonRewardsFaucet is Ownable, ReentrancyGuard {
    TycoonRewardSystem public rewardSystem;

    /// @notice Only the game contract (e.g. TycoonUpgradeable proxy) can grant rewards for in-game actions.
    address public gameContract;

    uint256 public constant DAY = 24 * 60 * 60;

    /// @notice Reward type config: voucher amount, optional collectible perk, cooldown between claims.
    struct RewardTypeConfig {
        uint256 voucherAmount;   // TYC voucher value (e.g. 0.1 ether)
        uint8 perkId;            // TycoonLib.CollectiblePerk as uint8; 0 = NONE
        uint256 perkStrength;    // 1-5 for tiered perks
        uint256 cooldownSeconds; // Min seconds between claims (0 = one-time or no cooldown for grant-only)
        bool active;
        bool grantCollectibleRandom; // If true, daily login picks a random perk from dailyPerkPool
    }

    /// @notice Reward type id => config. Use _rewardId("daily_login"), _rewardId("streak_3"), etc.
    mapping(bytes32 => RewardTypeConfig) public rewardTypes;

    /// @notice Last timestamp when user claimed daily login.
    mapping(address => uint256) public lastDailyClaimAt;

    /// @notice Current consecutive daily login streak (days).
    mapping(address => uint256) public loginStreak;

    /// @notice Last calendar day (timestamp / DAY) when user claimed (for streak logic).
    mapping(address => uint256) public lastClaimDay;

    /// @notice Pool of CollectiblePerk ids (uint8) that can be randomly granted on daily login. Owner can push new perks.
    uint8[] public dailyPerkPool;

    /// @notice Default voucher amount for daily login if reward type not set.
    uint256 public defaultDailyVoucherAmount = 0.1 ether;

    event DailyLoginClaimed(address indexed user, uint256 voucherAmount, uint256 streak, bool collectibleGranted);
    event RewardGranted(address indexed user, bytes32 indexed rewardTypeId, uint256 voucherAmount, bool collectibleGranted);
    event RewardTypeRegistered(bytes32 indexed rewardTypeId, uint256 voucherAmount, uint8 perkId, uint256 cooldownSeconds);
    event RewardTypeUpdated(bytes32 indexed rewardTypeId, bool active);
    event GameContractUpdated(address indexed previous, address indexed newContract);
    event DailyPerkPoolUpdated(uint8[] newPool);
    event DefaultDailyVoucherUpdated(uint256 previous, uint256 newAmount);

    bytes32 public constant REWARD_ID_DAILY = keccak256("daily_login");
    bytes32 public constant REWARD_ID_STREAK_3 = keccak256("streak_3");
    bytes32 public constant REWARD_ID_STREAK_7 = keccak256("streak_7");
    bytes32 public constant REWARD_ID_WEEKLY = keccak256("weekly_bonus");
    bytes32 public constant REWARD_ID_REGISTER = keccak256("register");
    bytes32 public constant REWARD_ID_CREATE_GAME = keccak256("create_game");
    bytes32 public constant REWARD_ID_JOIN_GAME = keccak256("join_game");
    bytes32 public constant REWARD_ID_END_GAME = keccak256("end_game");

    constructor(address _rewardSystem, address initialOwner) Ownable(initialOwner) {
        require(_rewardSystem != address(0), "Invalid reward system");
        rewardSystem = TycoonRewardSystem(payable(_rewardSystem));
        _registerDefaultRewardTypes();
    }

    function _registerDefaultRewardTypes() internal {
        // daily_login: 0.1 TYC, optional random collectible, 24h cooldown
        rewardTypes[REWARD_ID_DAILY] = RewardTypeConfig({
            voucherAmount: defaultDailyVoucherAmount,
            perkId: 0,
            perkStrength: 1,
            cooldownSeconds: DAY,
            active: true,
            grantCollectibleRandom: true
        });
        // streak_3: bonus for 3-day streak (used when granting from game or claim)
        rewardTypes[REWARD_ID_STREAK_3] = RewardTypeConfig({
            voucherAmount: 0.3 ether,
            perkId: 0,
            perkStrength: 1,
            cooldownSeconds: 0,
            active: true,
            grantCollectibleRandom: true
        });
        rewardTypes[REWARD_ID_STREAK_7] = RewardTypeConfig({
            voucherAmount: 1 ether,
            perkId: 0,
            perkStrength: 1,
            cooldownSeconds: 0,
            active: true,
            grantCollectibleRandom: true
        });
        rewardTypes[REWARD_ID_WEEKLY] = RewardTypeConfig({
            voucherAmount: 0.5 ether,
            perkId: 0,
            perkStrength: 1,
            cooldownSeconds: 7 * DAY,
            active: true,
            grantCollectibleRandom: true
        });
        rewardTypes[REWARD_ID_REGISTER] = RewardTypeConfig({
            voucherAmount: 0.05 ether,
            perkId: 0,
            perkStrength: 1,
            cooldownSeconds: 0,
            active: true,
            grantCollectibleRandom: false
        });
        rewardTypes[REWARD_ID_CREATE_GAME] = RewardTypeConfig({
            voucherAmount: 0.02 ether,
            perkId: 0,
            perkStrength: 1,
            cooldownSeconds: 0,
            active: true,
            grantCollectibleRandom: false
        });
        rewardTypes[REWARD_ID_JOIN_GAME] = RewardTypeConfig({
            voucherAmount: 0.02 ether,
            perkId: 0,
            perkStrength: 1,
            cooldownSeconds: 0,
            active: true,
            grantCollectibleRandom: false
        });
        rewardTypes[REWARD_ID_END_GAME] = RewardTypeConfig({
            voucherAmount: 0.05 ether,
            perkId: 0,
            perkStrength: 1,
            cooldownSeconds: 0,
            active: true,
            grantCollectibleRandom: true
        });
        _initDailyPerkPool();
    }

    function _initDailyPerkPool() internal {
        // EXTRA_TURN=1, JAIL_FREE=2, ROLL_BOOST=4, TELEPORT=6, SHIELD=7, PROPERTY_DISCOUNT=8, ROLL_EXACT=10 (skip CASH_TIERED/TAX_REFUND)
        dailyPerkPool.push(1);  // EXTRA_TURN
        dailyPerkPool.push(2);  // JAIL_FREE
        dailyPerkPool.push(4);  // ROLL_BOOST
        dailyPerkPool.push(6);  // TELEPORT
        dailyPerkPool.push(7);  // SHIELD
        dailyPerkPool.push(8);  // PROPERTY_DISCOUNT
        dailyPerkPool.push(10); // ROLL_EXACT
    }

    modifier onlyGame() {
        require(msg.sender == gameContract || msg.sender == owner(), "Not game or owner");
        _;
    }

    /// @notice Set the game contract that can call grantReward. Set to TycoonUpgradeable proxy.
    function setGameContract(address _gameContract) external onlyOwner {
        address previous = gameContract;
        gameContract = _gameContract;
        emit GameContractUpdated(previous, _gameContract);
    }

    /// @notice Register or override a reward type. Use _rewardId("my_perk") for custom ids.
    function registerRewardType(
        bytes32 rewardTypeId,
        uint256 voucherAmount,
        uint8 perkId,
        uint256 perkStrength,
        uint256 cooldownSeconds,
        bool grantCollectibleRandom
    ) external onlyOwner {
        rewardTypes[rewardTypeId] = RewardTypeConfig({
            voucherAmount: voucherAmount,
            perkId: perkId,
            perkStrength: perkStrength,
            cooldownSeconds: cooldownSeconds,
            active: true,
            grantCollectibleRandom: grantCollectibleRandom
        });
        emit RewardTypeRegistered(rewardTypeId, voucherAmount, perkId, cooldownSeconds);
    }

    /// @notice Enable or disable a reward type.
    function setRewardTypeActive(bytes32 rewardTypeId, bool active) external onlyOwner {
        require(rewardTypes[rewardTypeId].cooldownSeconds != 0 || rewardTypeId == REWARD_ID_DAILY, "Unknown type");
        rewardTypes[rewardTypeId].active = active;
        emit RewardTypeUpdated(rewardTypeId, active);
    }

    /// @notice Set the default daily voucher amount (used for daily_login if not overridden).
    function setDefaultDailyVoucherAmount(uint256 newAmount) external onlyOwner {
        uint256 previous = defaultDailyVoucherAmount;
        defaultDailyVoucherAmount = newAmount;
        rewardTypes[REWARD_ID_DAILY].voucherAmount = newAmount;
        emit DefaultDailyVoucherUpdated(previous, newAmount);
    }

    /// @notice Set the pool of perk ids (uint8 = CollectiblePerk) that can be randomly granted on daily login.
    function setDailyPerkPool(uint8[] calldata newPool) external onlyOwner {
        dailyPerkPool = newPool;
        emit DailyPerkPoolUpdated(newPool);
    }

    /// @notice Claim daily login reward. Call once per 24h. Grants voucher and optionally a random collectible; updates streak.
    function claimDailyLogin() external nonReentrant {
        RewardTypeConfig storage daily = rewardTypes[REWARD_ID_DAILY];
        require(daily.active, "Daily reward disabled");
        require(block.timestamp >= lastDailyClaimAt[msg.sender] + daily.cooldownSeconds, "Cooldown");

        uint256 currentDay = block.timestamp / DAY;
        uint256 lastDay = lastClaimDay[msg.sender];
        if (lastDay == 0) {
            loginStreak[msg.sender] = 1;
        } else if (currentDay == lastDay) {
            revert("Already claimed today");
        } else if (currentDay == lastDay + 1) {
            loginStreak[msg.sender] += 1;
        } else {
            loginStreak[msg.sender] = 1;
        }

        lastDailyClaimAt[msg.sender] = block.timestamp;
        lastClaimDay[msg.sender] = currentDay;

        uint256 voucherAmount = daily.voucherAmount;
        rewardSystem.mintVoucher(msg.sender, voucherAmount);

        bool collectibleGranted = false;
        if (daily.grantCollectibleRandom && dailyPerkPool.length > 0) {
            uint8 idx = uint8(uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, block.prevrandao))) % dailyPerkPool.length);
            uint8 perkId = dailyPerkPool[idx];
            if (perkId != 0) {
                rewardSystem.mintCollectible(msg.sender, TycoonLib.CollectiblePerk(perkId), 1);
                collectibleGranted = true;
            }
        }

        // Streak bonuses (extra voucher for 3 and 7 day streaks)
        uint256 streak = loginStreak[msg.sender];
        if (streak >= 7 && rewardTypes[REWARD_ID_STREAK_7].active) {
            rewardSystem.mintVoucher(msg.sender, rewardTypes[REWARD_ID_STREAK_7].voucherAmount);
            if (rewardTypes[REWARD_ID_STREAK_7].grantCollectibleRandom && dailyPerkPool.length > 0) {
                uint8 idx = uint8(uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, streak))) % dailyPerkPool.length);
                rewardSystem.mintCollectible(msg.sender, TycoonLib.CollectiblePerk(dailyPerkPool[idx]), 2);
                collectibleGranted = true;
            }
        } else if (streak >= 3 && rewardTypes[REWARD_ID_STREAK_3].active) {
            rewardSystem.mintVoucher(msg.sender, rewardTypes[REWARD_ID_STREAK_3].voucherAmount);
            if (rewardTypes[REWARD_ID_STREAK_3].grantCollectibleRandom && dailyPerkPool.length > 0) {
                uint8 idx = uint8(uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, streak))) % dailyPerkPool.length);
                rewardSystem.mintCollectible(msg.sender, TycoonLib.CollectiblePerk(dailyPerkPool[idx]), 1);
                collectibleGranted = true;
            }
        }

        emit DailyLoginClaimed(msg.sender, voucherAmount, streak, collectibleGranted);
    }

    /// @notice Grant a reward type to a user. Callable by game contract or owner (e.g. for achievements, weekly bonus).
    function grantReward(address user, bytes32 rewardTypeId) external onlyGame nonReentrant returns (bool) {
        RewardTypeConfig storage cfg = rewardTypes[rewardTypeId];
        require(cfg.active, "Reward type inactive");
        require(user != address(0), "Zero user");
        if (cfg.voucherAmount > 0) {
            rewardSystem.mintVoucher(user, cfg.voucherAmount);
        }
        if (cfg.perkId != 0) {
            rewardSystem.mintCollectible(user, TycoonLib.CollectiblePerk(cfg.perkId), cfg.perkStrength);
        }
        if (cfg.grantCollectibleRandom && dailyPerkPool.length > 0) {
            uint8 idx = uint8(uint256(keccak256(abi.encodePacked(block.timestamp, user, rewardTypeId))) % dailyPerkPool.length);
            rewardSystem.mintCollectible(user, TycoonLib.CollectiblePerk(dailyPerkPool[idx]), cfg.perkStrength);
        }
        emit RewardGranted(user, rewardTypeId, cfg.voucherAmount, cfg.perkId != 0 || cfg.grantCollectibleRandom);
        return true;
    }

    /// @notice Helper to compute reward type id from string (e.g. "weekly_bonus").
    function rewardId(string calldata name) external pure returns (bytes32) {
        return keccak256(bytes(name));
    }

    /// @notice When user can next claim daily login (timestamp).
    function nextDailyClaimAt(address user) external view returns (uint256) {
        return lastDailyClaimAt[user] + rewardTypes[REWARD_ID_DAILY].cooldownSeconds;
    }

    /// @notice Whether user can claim daily login now.
    function canClaimDaily(address user) external view returns (bool) {
        if (!rewardTypes[REWARD_ID_DAILY].active) return false;
        return block.timestamp >= lastDailyClaimAt[user] + rewardTypes[REWARD_ID_DAILY].cooldownSeconds;
    }

    /// @notice Get config for a reward type.
    function getRewardType(bytes32 rewardTypeId)
        external
        view
        returns (
            uint256 voucherAmount,
            uint8 perkId,
            uint256 perkStrength,
            uint256 cooldownSeconds,
            bool active,
            bool grantCollectibleRandom
        )
    {
        RewardTypeConfig storage cfg = rewardTypes[rewardTypeId];
        return (
            cfg.voucherAmount,
            cfg.perkId,
            cfg.perkStrength,
            cfg.cooldownSeconds,
            cfg.active,
            cfg.grantCollectibleRandom
        );
    }
}
