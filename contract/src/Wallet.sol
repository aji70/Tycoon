// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "lib/openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";

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

    /**
     * @dev Withdraws an ERC721 NFT from the wallet to a recipient.
     * @param nft The ERC721 contract address.
     * @param recipient The recipient address.
     * @param tokenId The token ID to transfer.
     */
    function withdrawERC721(address nft, address recipient, uint256 tokenId) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        IERC721 erc721 = IERC721(nft);
        require(erc721.ownerOf(tokenId) == address(this), "NFT not owned by wallet");
        erc721.safeTransferFrom(address(this), recipient, tokenId);
    }

    /**
     * @dev Gets the balance of ERC721 tokens owned by the wallet for a given contract.
     * @param nft The ERC721 contract address.
     * @return The number of tokens owned.
     */
    function getERC721Balance(address nft) external view returns (uint256) {
        return IERC721(nft).balanceOf(address(this));
    }

    receive() external payable {}
}

interface IWallet {
    function withdrawETH(address payable recipient, uint256 amount) external;
    function getBalance() external view returns (uint256);
    function getERC20Balance(address token) external view returns (uint256);
    function withdrawERC20(address token, address recipient, uint256 amount) external returns (bool);
    function withdrawERC721(address nft, address recipient, uint256 tokenId) external;
    function getERC721Balance(address nft) external view returns (uint256);
}