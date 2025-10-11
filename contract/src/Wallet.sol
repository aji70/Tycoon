// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title Wallet - Minimal smart wallet controlled by the router/paymaster
contract Wallet {
    address public router; // router/paymaster address (only this address can withdraw)

    constructor(address _router) {
        require(_router != address(0), "Invalid router");
        router = _router;
    }

    modifier onlyOwner() {
        require(msg.sender == router, "Not authorized");
        _;
    }

    function withdrawETH(address payable recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        require(address(this).balance >= amount, "Insufficient balance");
        (bool sent,) = recipient.call{value: amount}("");
        require(sent, "ETH transfer failed");
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function withdrawERC20(address token, address recipient, uint256 amount) external onlyOwner returns (bool) {
        require(recipient != address(0), "Invalid recipient");
        IERC20 erc20 = IERC20(token);
        require(erc20.balanceOf(address(this)) >= amount, "Insufficient token balance");
        bool ok = erc20.transfer(recipient, amount);
        require(ok, "Token transfer failed");
        return true;
    }

    function getERC20Balance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    receive() external payable {}
}

interface IWallet {
    function withdrawETH(address payable recipient, uint256 amount) external;
    function getBalance() external view returns (uint256);
    function getERC20Balance(address token) external view returns (uint256);
    function withdrawERC20(address token, address recipient, uint256 amount) external returns (bool);
}

/// @title TagRouter - paymaster-controlled tag wallet router
contract TagRouter is ReentrancyGuard {
    address public owner;

    struct UserProfile {
        address wallet; // wallet contract deployed for tag
        bool exists;
    }

    mapping(string => UserProfile) private userProfiles; // tag -> profile
    mapping(string => bool) private tagTaken;
    mapping(string => address) private tagToAddress; // tag -> wallet address

    event TagRegistered(string indexed tag, address indexed tag_address);
    event DepositReceived(string indexed tag, address indexed from, uint256 amount);
    event DepositERC20Received(string indexed tag, address indexed from, address indexed token, uint256 amount);
    event SwappedFromWallet(
        address indexed wallet, address indexed token, uint256 ethAmount, uint256 tokenAmount, string tag
    );
    event SwappedFromToken(
        address indexed wallet, address indexed token, uint256 tokenAmount, uint256 ethAmount, string tag
    );

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    /// @notice Owner registers tags (paymaster model)
    function registerTag(string memory tag) external onlyOwner returns (address) {
        require(bytes(tag).length > 3, "Tag too short");
        require(!tagTaken[tag], "Tag taken");

        address userwallet = address(new Wallet(address(this)));
        userProfiles[tag] = UserProfile({wallet: userwallet, exists: true});
        tagToAddress[tag] = userwallet;
        tagTaken[tag] = true;

        emit TagRegistered(tag, userwallet);
        return userwallet;
    }

    function depositToTag(string memory tag) external payable nonReentrant {
        require(userProfiles[tag].exists, "Tag not registered");
        require(msg.value > 0, "No ETH sent");

        address userWallet = userProfiles[tag].wallet;
        require(userWallet != address(0), "User wallet not found");

        (bool success,) = userWallet.call{value: msg.value}("");
        require(success, "ETH transfer failed");

        emit DepositReceived(tag, msg.sender, msg.value);
    }

    function depositERC20ToTag(string memory tag, address token, uint256 amount) external nonReentrant {
        require(userProfiles[tag].exists, "Tag not registered");
        require(amount > 0, "No tokens sent");
        require(token != address(0), "Invalid token");

        address userWallet = userProfiles[tag].wallet;
        require(userWallet != address(0), "User wallet not found");

        IERC20 erc20 = IERC20(token);
        require(erc20.allowance(msg.sender, address(this)) >= amount, "Insufficient allowance");

        bool ok = erc20.transferFrom(msg.sender, userWallet, amount);
        require(ok, "Token transfer failed");

        emit DepositERC20Received(tag, msg.sender, token, amount);
    }

    function getUserChainAddress(string memory tag) external view returns (address) {
        require(userProfiles[tag].exists, "Tag does not exist");
        return userProfiles[tag].wallet;
    }

    function getTagBalance(string memory tag) external view returns (uint256) {
        address userwallet = userProfiles[tag].wallet;
        require(userwallet != address(0), "Tag not registered");
        return userwallet.balance;
    }

    function withdrawFromContract(address to) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid recipient");
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        (bool success,) = to.call{value: balance}("");
        require(success, "ETH transfer failed");
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Swap ETH (from user's wallet) -> token, executed by router (paymaster)
    function swapEthForToken(address token, uint256 rate, string memory _tag, uint256 _amountEth)
        public
        nonReentrant
        onlyOwner
    {
        require(_amountEth > 0, "No ETH amount");
        require(rate > 0, "Invalid rate");

        address walletAddr = userProfiles[_tag].wallet;
        require(walletAddr != address(0), "Tag not registered");

        IWallet wallet = IWallet(payable(walletAddr));
        require(wallet.getBalance() >= _amountEth, "Insufficient ETH in user wallet");

        uint256 before = address(this).balance;
        wallet.withdrawETH(payable(address(this)), _amountEth);
        require(address(this).balance >= before + _amountEth, "Withdraw failed");

        uint256 amountToSend = (_amountEth * rate) / 1 ether;
        IERC20 erc20 = IERC20(token);
        require(erc20.balanceOf(address(this)) >= amountToSend, "Insufficient token liquidity");

        bool ok = erc20.transfer(walletAddr, amountToSend);
        require(ok, "Token transfer failed");

        emit SwappedFromWallet(walletAddr, token, _amountEth, amountToSend, _tag);
    }

    /// @notice Swap token (from user's wallet) -> ETH, executed by router (paymaster)
    function swapTokenForEth(address token, uint256 amount, uint256 rate, string memory _tag)
        public
        nonReentrant
        onlyOwner
    {
        require(amount > 0, "No token amount");
        require(rate > 0, "Invalid rate");

        address walletAddr = userProfiles[_tag].wallet;
        require(walletAddr != address(0), "Tag not registered");

        uint256 ethToSend = (amount * 1 ether) / rate;
        require(address(this).balance >= ethToSend, "Insufficient ETH liquidity");

        IERC20 erc20 = IERC20(token);
        IWallet wallet = IWallet(payable(walletAddr));

        uint256 beforeBal = erc20.balanceOf(address(this));
        // router instructs wallet to move tokens into router
        wallet.withdrawERC20(address(erc20), address(this), amount);

        require(erc20.balanceOf(address(this)) >= beforeBal + amount, "Token transfer failed");

        (bool sent,) = payable(walletAddr).call{value: ethToSend}("");
        require(sent, "ETH transfer failed");

        emit SwappedFromToken(walletAddr, token, amount, ethToSend, _tag);
    }

    function getERC20Balance(address token, string memory _tag) external view returns (uint256) {
        address _address = userProfiles[_tag].wallet;
        require(_address != address(0), "Tag not registered");
        require(token != address(0), "Invalid token");
        return IERC20(token).balanceOf(_address);
    }

    /// @notice Owner (paymaster) can withdraw ETH FROM a user's wallet to any address
    function withdrawEthFromWallet(address to, uint256 amount, string memory _tag) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");

        IWallet wallet = IWallet(payable(userProfiles[_tag].wallet));
        uint256 balance = wallet.getBalance();
        require(balance >= amount, "Insufficient wallet balance");

        wallet.withdrawETH(payable(to), amount);
    }

    receive() external payable {}
}
