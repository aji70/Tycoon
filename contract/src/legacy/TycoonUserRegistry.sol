// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {TycoonUserWallet} from "./TycoonUserWallet.sol";
import {TycoonRewardsFaucet} from "./TycoonRewardsFaucet.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TycoonUserRegistry
/// @notice Maps each registered user to a smart wallet and profile (username, email). Game faucet: grants rewards for register / create / join / end.
/// @dev Game contract calls createWalletForUser on first register and grantGameActionReward after create/join/end. Set this contract as gameContract on TycoonRewardsFaucet.
contract TycoonUserRegistry is Ownable, ReentrancyGuard {
    struct UserProfile {
        address owner;
        string username;
        address wallet;
        string email;
        bool exists;
    }

    address public gameContract;
    TycoonRewardsFaucet public faucet;
    /// @notice Naira vault address; passed to new wallets so CELO→Naira works without user setup.
    address public nairaVaultAddress;
    /// @notice Backend operator address; set on new wallets so users can withdraw when not connected.
    address public operatorAddress;
    /// @notice Backend withdrawal authority; signs withdrawals only after user PIN. Set on new wallets.
    address public withdrawalAuthorityAddress;
    /// @notice RewardSystem address (shop + burn). Set on new wallets so backend operator can buy/burn via wallet auth flows.
    address public rewardSystemAddress;
    /// @notice Default daily withdrawal cap in USD (6 decimals), e.g. 100e6 = $100/day. 0 = no cap.
    uint256 public defaultDailyCapUsd6;
    /// @notice Default CELO price in USD (6 decimals), e.g. 2.5e6 = $2.5 per CELO. Used for daily cap.
    uint256 public defaultPriceCeloUsd6;

    /// @notice owner => profile (wallet, username, email)
    mapping(address => UserProfile) public profileByAddress;
    /// @notice username (keccak256) => owner address (for lookup)
    mapping(bytes32 => address) public ownerByUsername;
    /// @notice wallet => owner (reverse lookup)
    mapping(address => address) public ownerByWallet;

    bytes32 public constant REWARD_REGISTER = keccak256("register");
    bytes32 public constant REWARD_CREATE_GAME = keccak256("create_game");
    bytes32 public constant REWARD_JOIN_GAME = keccak256("join_game");
    bytes32 public constant REWARD_END_GAME = keccak256("end_game");

    event WalletCreated(address indexed owner, string username, address indexed wallet);
    event WalletRecreated(address indexed owner, address indexed oldWallet, address indexed newWallet);
    event ProfileTransferred(address indexed previousOwner, address indexed newOwner, address indexed wallet);
    event EmailUpdated(address indexed owner, string email);
    event GameContractUpdated(address indexed previous, address indexed newContract);
    event FaucetUpdated(address indexed previous, address indexed newFaucet);
    event GameActionRewardGranted(address indexed user, bytes32 action, address indexed recipient);
    event NairaVaultUpdated(address indexed previous, address indexed vault);
    event OperatorUpdated(address indexed previous, address indexed newOperator);
    event WithdrawalAuthorityUpdated(address indexed previous, address indexed newAuthority);
    event DailyCapUpdated(uint256 dailyCapUsd6, uint256 priceCeloUsd6);
    event RewardSystemUpdated(address indexed previous, address indexed newRewardSystem);

    error OnlyGame();
    error AlreadyRegistered();
    error NoProfile();
    error UsernameTaken();
    error InvalidAddress();
    error CannotTransferToSelf();
    error NewOwnerHasProfile();

    modifier onlyGame() {
        if (msg.sender != gameContract && msg.sender != owner()) revert OnlyGame();
        _;
    }

    constructor(address _gameContract, address _faucet, address initialOwner) Ownable(initialOwner) {
        gameContract = _gameContract;
        faucet = TycoonRewardsFaucet(payable(_faucet));
    }

    function setGameContract(address _gameContract) external onlyOwner {
        address previous = gameContract;
        gameContract = _gameContract;
        emit GameContractUpdated(previous, _gameContract);
    }

    function setFaucet(address _faucet) external onlyOwner {
        address previous = address(faucet);
        faucet = TycoonRewardsFaucet(payable(_faucet));
        emit FaucetUpdated(previous, _faucet);
    }

    function setNairaVault(address _vault) external onlyOwner {
        address previous = nairaVaultAddress;
        nairaVaultAddress = _vault;
        emit NairaVaultUpdated(previous, _vault);
    }

    function setOperator(address _operator) external onlyOwner {
        address previous = operatorAddress;
        operatorAddress = _operator;
        emit OperatorUpdated(previous, _operator);
    }

    function setWithdrawalAuthority(address _authority) external onlyOwner {
        address previous = withdrawalAuthorityAddress;
        withdrawalAuthorityAddress = _authority;
        emit WithdrawalAuthorityUpdated(previous, _authority);
    }

    function setRewardSystem(address _rewardSystem) external onlyOwner {
        address previous = rewardSystemAddress;
        rewardSystemAddress = _rewardSystem;
        emit RewardSystemUpdated(previous, _rewardSystem);
    }

    /// @notice Set default daily cap ($100 = 100e6) and CELO price for new wallets. 0 = no cap.
    function setDefaultDailyCap(uint256 _dailyCapUsd6, uint256 _priceCeloUsd6) external onlyOwner {
        defaultDailyCapUsd6 = _dailyCapUsd6;
        defaultPriceCeloUsd6 = _priceCeloUsd6;
        emit DailyCapUpdated(_dailyCapUsd6, _priceCeloUsd6);
    }

    /// @notice Update daily cap on an existing wallet (e.g. after changing policy or CELO price).
    function setWalletDailyCap(address wallet, uint256 _dailyCapUsd6, uint256 _priceCeloUsd6) external onlyOwner {
        if (wallet == address(0)) revert InvalidAddress();
        TycoonUserWallet(payable(wallet)).setDailyCapByRegistry(_dailyCapUsd6, _priceCeloUsd6);
    }

    /// @notice Create a smart wallet for the user and bind profile. Called by game contract when user registers.
    function createWalletForUser(address ownerAddress, string calldata username) external onlyGame nonReentrant returns (address wallet) {
        // Idempotent for wallet-first users: if ownerAddress is already a wallet we know about, return it.
        // This is needed because Tycoon.registerPlayerFor(wallet, ...) will still call createWalletForUser(wallet, username).
        if (ownerByWallet[ownerAddress] != address(0)) {
            return ownerAddress;
        }
        if (profileByAddress[ownerAddress].exists) revert AlreadyRegistered();
        bytes32 nameHash = keccak256(bytes(username));
        if (ownerByUsername[nameHash] != address(0)) revert UsernameTaken();

        wallet = address(new TycoonUserWallet(ownerAddress, address(this), nairaVaultAddress, defaultDailyCapUsd6, defaultPriceCeloUsd6));
        if (operatorAddress != address(0)) {
            TycoonUserWallet(payable(wallet)).setOperatorByRegistry(operatorAddress);
        }
        if (withdrawalAuthorityAddress != address(0)) {
            TycoonUserWallet(payable(wallet)).setWithdrawalAuthorityByRegistry(withdrawalAuthorityAddress);
        }
        if (rewardSystemAddress != address(0)) {
            TycoonUserWallet(payable(wallet)).setRewardSystemByRegistry(rewardSystemAddress);
        }
        profileByAddress[ownerAddress] = UserProfile({
            owner: ownerAddress,
            username: username,
            wallet: wallet,
            email: "",
            exists: true
        });
        ownerByUsername[nameHash] = ownerAddress;
        ownerByWallet[wallet] = ownerAddress;

        emit WalletCreated(ownerAddress, username, wallet);

        if (address(faucet) != address(0)) {
            try faucet.grantReward(wallet, REWARD_REGISTER) returns (bool) {}
            catch {}
            emit GameActionRewardGranted(ownerAddress, REWARD_REGISTER, wallet);
        }
        return wallet;
    }

    /// @notice Wallet-first signup: create a wallet and profile without an EOA yet.
    /// @dev Profile is keyed by the wallet address itself (owner = wallet). Later, linkEOAToProfile moves it to the user's EOA.
    function createWalletForUserByBackend(string calldata username) external onlyGame nonReentrant returns (address wallet) {
        bytes32 nameHash = keccak256(bytes(username));
        if (ownerByUsername[nameHash] != address(0)) revert UsernameTaken();

        // Temporary wallet owner is this registry; backend/operator flows do not require owner.
        wallet = address(new TycoonUserWallet(address(this), address(this), nairaVaultAddress, defaultDailyCapUsd6, defaultPriceCeloUsd6));
        if (operatorAddress != address(0)) {
            TycoonUserWallet(payable(wallet)).setOperatorByRegistry(operatorAddress);
        }
        if (withdrawalAuthorityAddress != address(0)) {
            TycoonUserWallet(payable(wallet)).setWithdrawalAuthorityByRegistry(withdrawalAuthorityAddress);
        }
        if (rewardSystemAddress != address(0)) {
            TycoonUserWallet(payable(wallet)).setRewardSystemByRegistry(rewardSystemAddress);
        }

        profileByAddress[wallet] = UserProfile({
            owner: wallet,
            username: username,
            wallet: wallet,
            email: "",
            exists: true
        });
        ownerByUsername[nameHash] = wallet;
        ownerByWallet[wallet] = wallet;

        emit WalletCreated(wallet, username, wallet);

        if (address(faucet) != address(0)) {
            try faucet.grantReward(wallet, REWARD_REGISTER) returns (bool) {}
            catch {}
            emit GameActionRewardGranted(wallet, REWARD_REGISTER, wallet);
        }
        return wallet;
    }

    /// @notice Link an external EOA to a wallet-first profile.
    /// @dev Callable by game/backend after user signs a message off-chain proving EOA ownership.
    function linkEOAToProfile(address wallet, address newOwner) external onlyGame nonReentrant {
        if (wallet == address(0) || newOwner == address(0)) revert InvalidAddress();
        UserProfile storage p = profileByAddress[wallet];
        if (!p.exists) revert NoProfile();
        // Only wallet-first profiles are eligible
        require(p.wallet == wallet && p.owner == wallet, "Not wallet-first");
        if (profileByAddress[newOwner].exists) revert NewOwnerHasProfile();

        string memory uname = p.username;
        string memory em = p.email;
        bytes32 nameHash = keccak256(bytes(uname));

        delete profileByAddress[wallet];
        profileByAddress[newOwner] = UserProfile({
            owner: newOwner,
            username: uname,
            wallet: wallet,
            email: em,
            exists: true
        });
        ownerByUsername[nameHash] = newOwner;
        ownerByWallet[wallet] = newOwner;

        TycoonUserWallet(payable(wallet)).transferOwnershipViaRegistry(newOwner);
        emit ProfileTransferred(wallet, newOwner, wallet);
    }

    /// @notice Existing user creates a new smart wallet; profile is updated to the new wallet. Callable by the profile owner.
    /// @dev Old wallet is unchanged (same owner, funds remain). User can withdraw from old wallet to new one manually.
    /// New wallet gets current defaults: operator, withdrawal authority, daily cap, Naira vault.
    function recreateWalletForUser() external nonReentrant returns (address newWallet) {
        UserProfile storage profile = profileByAddress[msg.sender];
        if (!profile.exists) revert NoProfile();
        address ownerAddress = msg.sender;
        address oldWallet = profile.wallet;

        newWallet = address(new TycoonUserWallet(ownerAddress, address(this), nairaVaultAddress, defaultDailyCapUsd6, defaultPriceCeloUsd6));
        if (operatorAddress != address(0)) {
            TycoonUserWallet(payable(newWallet)).setOperatorByRegistry(operatorAddress);
        }
        if (withdrawalAuthorityAddress != address(0)) {
            TycoonUserWallet(payable(newWallet)).setWithdrawalAuthorityByRegistry(withdrawalAuthorityAddress);
        }
        if (rewardSystemAddress != address(0)) {
            TycoonUserWallet(payable(newWallet)).setRewardSystemByRegistry(rewardSystemAddress);
        }

        profile.wallet = newWallet;
        if (oldWallet != address(0)) {
            ownerByWallet[oldWallet] = address(0);
        }
        ownerByWallet[newWallet] = ownerAddress;

        emit WalletRecreated(ownerAddress, oldWallet, newWallet);
        return newWallet;
    }

    /// @notice Transfer this profile (and smart wallet ownership) to a new EOA. Callable by current profile owner (e.g. when linking a wallet so the linked EOA becomes owner).
    function transferProfileTo(address newOwner) external nonReentrant {
        UserProfile storage profile = profileByAddress[msg.sender];
        if (!profile.exists) revert NoProfile();
        if (newOwner == msg.sender) revert CannotTransferToSelf();
        if (newOwner == address(0)) revert InvalidAddress();
        if (profileByAddress[newOwner].exists) revert NewOwnerHasProfile();

        address walletAddr = profile.wallet;
        string memory uname = profile.username;
        string memory em = profile.email;
        bytes32 nameHash = keccak256(bytes(uname));

        delete profileByAddress[msg.sender];
        profileByAddress[newOwner] = UserProfile({
            owner: newOwner,
            username: uname,
            wallet: walletAddr,
            email: em,
            exists: true
        });
        ownerByUsername[nameHash] = newOwner;
        ownerByWallet[walletAddr] = newOwner;

        TycoonUserWallet(payable(walletAddr)).transferOwnershipViaRegistry(newOwner);
        emit ProfileTransferred(msg.sender, newOwner, walletAddr);
    }

    /// @notice User sets their email (stored in profile).
    function setEmail(string calldata email) external nonReentrant {
        UserProfile storage profile = profileByAddress[msg.sender];
        if (!profile.exists) revert NoProfile();
        profile.email = email;
        emit EmailUpdated(msg.sender, email);
    }

    /// @notice Grant game-action faucet reward (create/join/end). Game calls this after the action. Reward goes to user's wallet if they have one, else to EOA.
    function grantGameActionReward(address user, bytes32 action) external onlyGame nonReentrant {
        if (address(faucet) == address(0)) return;
        address recipient = profileByAddress[user].exists ? profileByAddress[user].wallet : user;
        if (recipient == address(0)) recipient = user;
        try faucet.grantReward(recipient, action) returns (bool) {
            emit GameActionRewardGranted(user, action, recipient);
        } catch {}
    }

    function getWallet(address ownerAddress) external view returns (address) {
        return profileByAddress[ownerAddress].wallet;
    }

    function getProfile(address ownerAddress) external view returns (address, string memory, address, string memory) {
        UserProfile storage p = profileByAddress[ownerAddress];
        return (p.owner, p.username, p.wallet, p.email);
    }

    function getProfileByUsername(string calldata username) external view returns (address owner, address wallet, string memory email) {
        owner = ownerByUsername[keccak256(bytes(username))];
        if (owner == address(0)) return (address(0), address(0), "");
        UserProfile storage p = profileByAddress[owner];
        return (p.owner, p.wallet, p.email);
    }

    function hasWallet(address ownerAddress) external view returns (bool) {
        return profileByAddress[ownerAddress].exists && profileByAddress[ownerAddress].wallet != address(0);
    }
}
