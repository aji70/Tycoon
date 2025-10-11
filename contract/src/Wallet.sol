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
