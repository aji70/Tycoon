// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

/// @title TycoonUserWallet
/// @notice Smart wallet bound to a user profile. Holds CELO (native), ERC20 (USDC etc), ERC1155 (perks), ERC721 (e.g. ERC-8004).
/// @dev Owner (user EOA) can withdraw/send and approve the game/shop to pull tokens and perks for buy/burn during games.
contract TycoonUserWallet is ERC165, IERC1155Receiver {
    address public owner;
    /// @notice Registry that created this wallet; only it may call transferOwnershipViaRegistry.
    address public registry;

    event Received(address indexed from, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event WithdrewNative(address indexed to, uint256 amount);
    event WithdrewERC20(address indexed token, address indexed to, uint256 amount);
    event WithdrewERC1155(address indexed collection, address indexed to, uint256 id, uint256 amount);
    event WithdrewERC721(address indexed collection, address indexed to, uint256 tokenId);
    event ApprovalERC20(address indexed token, address indexed spender, uint256 amount);
    event ApprovalForAllERC1155(address indexed collection, address indexed operator, bool approved);
    event ApprovalForAllERC721(address indexed collection, address indexed operator, bool approved);
    event NairaVaultUpdated(address indexed previous, address indexed vault);
    event SentCeloToNairaVault(uint256 amount);

    error OnlyOwner();
    error OnlyRegistry();
    error InvalidAddress();
    error OnlyNairaVault();

    /// @notice When set, the Naira vault can call sendCeloToNairaVault so backend can process CELO→Naira when user is not connected.
    address public nairaVault;

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(address _owner, address _registry) {
        if (_owner == address(0)) revert InvalidAddress();
        if (_registry == address(0)) revert InvalidAddress();
        owner = _owner;
        registry = _registry;
    }

    /// @notice Transfer ownership to a new address. Only callable by the registry when linking an EOA to an existing profile (e.g. Privy user links wallet).
    function transferOwnershipViaRegistry(address newOwner) external {
        if (msg.sender != registry) revert OnlyRegistry();
        if (newOwner == address(0)) revert InvalidAddress();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    // -------------------------------------------------------------------------
    // Native (CELO / ETH)
    // -------------------------------------------------------------------------
    function withdrawNative(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        require(address(this).balance >= amount, "Insufficient balance");
        (bool sent,) = to.call{value: amount}("");
        require(sent, "Transfer failed");
        emit WithdrewNative(to, amount);
    }

    function balanceNative() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Set the Naira vault so backend can process CELO→Naira from this wallet via vault.processNairaWithdrawalCelo(address(this), amount).
    function setNairaVault(address vault) external onlyOwner {
        if (vault != address(0) && vault.code.length == 0) revert InvalidAddress();
        address previous = nairaVault;
        nairaVault = vault;
        emit NairaVaultUpdated(previous, vault);
    }

    /// @notice Send CELO to the Naira vault (only callable by nairaVault). Used when backend processes CELO→Naira for user when they are not connected.
    function sendCeloToNairaVault(uint256 amount) external {
        if (msg.sender != nairaVault) revert OnlyNairaVault();
        if (nairaVault == address(0)) revert InvalidAddress();
        require(amount > 0 && address(this).balance >= amount, "Invalid amount or balance");
        (bool sent,) = payable(nairaVault).call{value: amount}("");
        require(sent, "Transfer failed");
        emit SentCeloToNairaVault(amount);
    }

    // -------------------------------------------------------------------------
    // ERC20 (USDC, TYC, etc.)
    // -------------------------------------------------------------------------
    function approveERC20(address token, address spender, uint256 amount) external onlyOwner {
        if (token == address(0) || spender == address(0)) revert InvalidAddress();
        IERC20(token).approve(spender, amount);
        emit ApprovalERC20(token, spender, amount);
    }

    function withdrawERC20(address token, address to, uint256 amount) external onlyOwner {
        if (token == address(0) || to == address(0)) revert InvalidAddress();
        require(IERC20(token).transfer(to, amount), "Transfer failed");
        emit WithdrewERC20(token, to, amount);
    }

    function balanceERC20(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // -------------------------------------------------------------------------
    // ERC1155 (perks) – receive + approve for shop/game to pull or burn
    // -------------------------------------------------------------------------
    function setApprovalForAllERC1155(address collection, address operator, bool approved) external onlyOwner {
        if (collection == address(0) || operator == address(0)) revert InvalidAddress();
        IERC1155(collection).setApprovalForAll(operator, approved);
        emit ApprovalForAllERC1155(collection, operator, approved);
    }

    function withdrawERC1155(address collection, address to, uint256 id, uint256 amount) external onlyOwner {
        if (collection == address(0) || to == address(0)) revert InvalidAddress();
        IERC1155(collection).safeTransferFrom(address(this), to, id, amount, "");
        emit WithdrewERC1155(collection, to, id, amount);
    }

    function balanceERC1155(address collection, uint256 id) external view returns (uint256) {
        return IERC1155(collection).balanceOf(address(this), id);
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId || super.supportsInterface(interfaceId);
    }

    // -------------------------------------------------------------------------
    // ERC721 (e.g. ERC-8004 identity)
    // -------------------------------------------------------------------------
    function setApprovalForAllERC721(address collection, address operator, bool approved) external onlyOwner {
        if (collection == address(0) || operator == address(0)) revert InvalidAddress();
        IERC721(collection).setApprovalForAll(operator, approved);
        emit ApprovalForAllERC721(collection, operator, approved);
    }

    function withdrawERC721(address collection, address to, uint256 tokenId) external onlyOwner {
        if (collection == address(0) || to == address(0)) revert InvalidAddress();
        IERC721(collection).safeTransferFrom(address(this), to, tokenId);
        emit WithdrewERC721(collection, to, tokenId);
    }

    function balanceERC721(address collection) external view returns (uint256) {
        return IERC721(collection).balanceOf(address(this));
    }
}
