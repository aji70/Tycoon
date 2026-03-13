// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TycoonNairaVault
/// @notice Naira ↔ CELO/USDC gateway. Backend (controller) credits user/smart wallet when they pay Naira; processes withdrawals (crypto → Naira).
/// @dev Recipient for credits can be user EOA or user's TycoonUserWallet so the wallet "stands in" when user is not connected.
interface ITycoonUserWalletNaira {
    function sendCeloToNairaVault(uint256 amount) external;
}

contract TycoonNairaVault is Ownable, ReentrancyGuard {
    IERC20 public immutable usdc;

    /// @notice Backend controller: only this address can credit (Naira→crypto) and process withdrawals (crypto→Naira).
    address public controller;

    event ControllerUpdated(address indexed previous, address indexed newController);
    event CreditedUsdc(address indexed recipient, uint256 amount);
    event CreditedCelo(address indexed recipient, uint256 amount);
    event NairaWithdrawalUsdc(address indexed from, uint256 amount);
    event CeloReceived(address indexed from, uint256 amount);

    error OnlyController();
    error InvalidAddress();
    error InsufficientBalance();
    error TransferFailed();

    modifier onlyController() {
        if (msg.sender != controller && msg.sender != owner()) revert OnlyController();
        _;
    }

    constructor(address _usdc, address _controller, address initialOwner) Ownable(initialOwner) {
        if (_usdc == address(0)) revert InvalidAddress();
        usdc = IERC20(_usdc);
        controller = _controller == address(0) ? initialOwner : _controller;
    }

    function setController(address _controller) external onlyOwner {
        address previous = controller;
        controller = _controller;
        emit ControllerUpdated(previous, _controller);
    }

    /// @notice Receive CELO (e.g. user or smart wallet sends CELO for Naira withdrawal). Backend listens and pays Naira.
    receive() external payable {
        if (msg.value > 0) emit CeloReceived(msg.sender, msg.value);
    }

    // -------------------------------------------------------------------------
    // Naira → Crypto (backend credits user/smart wallet after Naira payment)
    // -------------------------------------------------------------------------

    /// @notice Credit recipient with USDC after they paid in Naira. Recipient can be user EOA or their TycoonUserWallet.
    function creditUsdc(address recipient, uint256 amount) external onlyController nonReentrant {
        if (recipient == address(0)) revert InvalidAddress();
        if (amount == 0) return;
        if (usdc.balanceOf(address(this)) < amount) revert InsufficientBalance();
        if (!usdc.transfer(recipient, amount)) revert TransferFailed();
        emit CreditedUsdc(recipient, amount);
    }

    /// @notice Credit recipient with CELO after they paid in Naira. Recipient can be user EOA or their TycoonUserWallet.
    function creditCelo(address recipient, uint256 amount) external onlyController nonReentrant {
        if (recipient == address(0)) revert InvalidAddress();
        if (amount == 0) return;
        if (address(this).balance < amount) revert InsufficientBalance();
        (bool sent,) = payable(recipient).call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit CreditedCelo(recipient, amount);
    }

    // -------------------------------------------------------------------------
    // Crypto → Naira (backend pulls from user/smart wallet, then pays Naira off-chain)
    // -------------------------------------------------------------------------

    /// @notice Pull USDC from `from` (user EOA or smart wallet). They must have approved this contract. Backend then pays Naira.
    function processNairaWithdrawalUsdc(address from, uint256 amount) external onlyController nonReentrant {
        if (from == address(0)) revert InvalidAddress();
        if (amount == 0) return;
        if (!usdc.transferFrom(from, address(this), amount)) revert TransferFailed();
        emit NairaWithdrawalUsdc(from, amount);
    }

    /// @notice Pull CELO from a TycoonUserWallet that has set this contract as nairaVault. Backend then pays Naira.
    /// @param fromWallet Address of TycoonUserWallet (must implement sendCeloToNairaVault).
    function processNairaWithdrawalCelo(address fromWallet, uint256 amount) external onlyController nonReentrant {
        if (fromWallet == address(0)) revert InvalidAddress();
        if (amount == 0) return;
        if (fromWallet.code.length == 0) revert InvalidAddress(); // EOA cannot be pulled; use receive() flow
        ITycoonUserWalletNaira(fromWallet).sendCeloToNairaVault(amount);
        emit CeloReceived(fromWallet, amount);
    }

    /// @notice USDC balance held by this vault (for Naira→crypto payouts).
    function balanceUsdc() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /// @notice CELO balance held by this vault.
    function balanceCelo() external view returns (uint256) {
        return address(this).balance;
    }
}
