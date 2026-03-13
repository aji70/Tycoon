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
    event EmailUpdated(address indexed owner, string email);
    event GameContractUpdated(address indexed previous, address indexed newContract);
    event FaucetUpdated(address indexed previous, address indexed newFaucet);
    event GameActionRewardGranted(address indexed user, bytes32 action, address indexed recipient);

    error OnlyGame();
    error AlreadyRegistered();
    error NoProfile();
    error UsernameTaken();

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

    /// @notice Create a smart wallet for the user and bind profile. Called by game contract when user registers.
    function createWalletForUser(address ownerAddress, string calldata username) external onlyGame nonReentrant returns (address wallet) {
        if (profileByAddress[ownerAddress].exists) revert AlreadyRegistered();
        bytes32 nameHash = keccak256(bytes(username));
        if (ownerByUsername[nameHash] != address(0)) revert UsernameTaken();

        wallet = address(new TycoonUserWallet(ownerAddress));
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
