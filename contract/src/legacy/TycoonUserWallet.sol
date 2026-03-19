// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface ITycoonRewardSystem {
    function tycToken() external view returns (address);
    function usdc() external view returns (address);
    function collectibleTycPrice(uint256 tokenId) external view returns (uint256);
    function collectibleUsdcPrice(uint256 tokenId) external view returns (uint256);
    function buyCollectible(uint256 tokenId, bool useUsdc) external;
    function burnCollectibleForPerk(uint256 tokenId) external;
    function buyBundle(uint256 bundleId, bool useUsdc) external;
    function bundles(uint256 bundleId) external view returns (
        uint256[] memory tokenIds,
        uint256[] memory amounts,
        uint256 tycPrice,
        uint256 usdcPrice,
        bool active
    );
}

/// @title TycoonUserWallet
/// @notice Smart wallet bound to a user profile. Holds CELO (native), ERC20 (USDC etc), ERC1155 (perks), ERC721 (e.g. ERC-8004).
/// @dev Owner (user EOA) can withdraw/send and approve the game/shop to pull tokens and perks for buy/burn during games.
contract TycoonUserWallet is ERC165, IERC1155Receiver, IERC721Receiver, IERC1271 {
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
    event OperatorUpdated(address indexed previous, address indexed newOperator);
    event AllowedRewardSystemUpdated(address indexed previous, address indexed newRewardSystem);
    event ShopActionExecuted(bytes32 indexed action, uint256 indexed id, bool useUsdc);

    error OnlyOwner();
    error OnlyRegistry();
    error InvalidAddress();
    error OnlyNairaVault();
    error OnlyOperator();
    error ShopNotConfigured();
    error NotAllowed();
    /// @notice Thrown when withdrawal would exceed the daily USD cap.
    error ExceedsDailyCap();

    /// @notice When set, the Naira vault can call sendCeloToNairaVault so backend can process CELO→Naira when user is not connected.
    address public nairaVault;
    /// @notice Backend operator: can withdraw only with a valid authority signature (issued after user PIN).
    address public operator;
    /// @notice Backend withdrawal authority: signs withdrawal requests only after user PIN verification.
    address public withdrawalAuthority;
    /// @notice Prevents replay of signed withdrawal requests.
    mapping(bytes32 => bool) public usedWithdrawalNonces;

    /// @notice Reward system (shop + burn) allowed to be called via operator-auth flows.
    address public rewardSystem;

    /// @notice Daily withdrawal cap in USD (6 decimals). 0 = no cap. Anti–money-laundering (e.g. 100e6 = $100/day).
    uint256 public dailyCapUsd6;
    /// @notice CELO price in USD (6 decimals), e.g. 2.5e6 = $2.5 per CELO. Used to convert CELO withdrawals to USD for the daily cap.
    uint256 public priceCeloUsd6;
    /// @notice Start of current withdrawal window (block.timestamp / 86400).
    uint256 public lastWithdrawDay;
    /// @notice Total USD (6 decimals) withdrawn in the current day.
    uint256 public totalWithdrawnUsd6InPeriod;

    uint256 private constant SECONDS_PER_DAY = 86400;

    event DailyCapUpdated(uint256 dailyCapUsd6, uint256 priceCeloUsd6);

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyOwnerOrOperator() {
        if (msg.sender != owner && msg.sender != operator) revert OnlyOperator();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert OnlyOperator();
        _;
    }

    /// @param _owner Profile owner (EOA).
    /// @param _registry TycoonUserRegistry that created this wallet.
    /// @param _nairaVault Optional Naira vault address; if set, CELO→Naira withdrawals work without user having to set it later.
    /// @param _dailyCapUsd6 Daily withdrawal cap in USD (6 decimals); 0 = no cap (e.g. 100e6 = $100/day).
    /// @param _priceCeloUsd6 CELO price in USD (6 decimals), e.g. 2.5e6 = $2.5 per CELO.
    constructor(address _owner, address _registry, address _nairaVault, uint256 _dailyCapUsd6, uint256 _priceCeloUsd6) {
        if (_owner == address(0)) revert InvalidAddress();
        if (_registry == address(0)) revert InvalidAddress();
        owner = _owner;
        registry = _registry;
        if (_nairaVault != address(0) && _nairaVault.code.length > 0) {
            nairaVault = _nairaVault;
        }
        dailyCapUsd6 = _dailyCapUsd6;
        priceCeloUsd6 = _priceCeloUsd6;
    }

    /// @notice Transfer ownership to a new address. Only callable by the registry when linking an EOA to an existing profile (e.g. Privy user links wallet).
    function transferOwnershipViaRegistry(address newOwner) external {
        if (msg.sender != registry) revert OnlyRegistry();
        if (newOwner == address(0)) revert InvalidAddress();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    /// @notice Set the backend operator so users can withdraw CELO/USDC when not connected. Only owner.
    function setOperator(address _operator) external onlyOwner {
        address previous = operator;
        operator = _operator;
        emit OperatorUpdated(previous, _operator);
    }

    /// @notice Set the backend operator. Only registry (so new wallets get it at creation).
    function setOperatorByRegistry(address _operator) external {
        if (msg.sender != registry) revert OnlyRegistry();
        address previous = operator;
        operator = _operator;
        emit OperatorUpdated(previous, _operator);
    }

    /// @notice Set withdrawal authority (backend signer). Only owner.
    function setWithdrawalAuthority(address _authority) external onlyOwner {
        withdrawalAuthority = _authority;
    }

    /// @notice Set withdrawal authority. Only registry.
    function setWithdrawalAuthorityByRegistry(address _authority) external {
        if (msg.sender != registry) revert OnlyRegistry();
        withdrawalAuthority = _authority;
    }

    /// @notice Configure reward system contract used for buy/burn flows. Only registry.
    function setRewardSystemByRegistry(address _rewardSystem) external {
        if (msg.sender != registry) revert OnlyRegistry();
        address previous = rewardSystem;
        rewardSystem = _rewardSystem;
        emit AllowedRewardSystemUpdated(previous, _rewardSystem);
    }

    /// @notice Set daily withdrawal cap and CELO price. Only registry. dailyCapUsd6 = 0 means no cap.
    function setDailyCapByRegistry(uint256 _dailyCapUsd6, uint256 _priceCeloUsd6) external {
        if (msg.sender != registry) revert OnlyRegistry();
        dailyCapUsd6 = _dailyCapUsd6;
        priceCeloUsd6 = _priceCeloUsd6;
        emit DailyCapUpdated(_dailyCapUsd6, _priceCeloUsd6);
    }

    function _requireValidAuthority(bytes32 hash, uint256 nonce, bytes calldata signature, bytes32 action) internal {
        if (withdrawalAuthority == address(0)) revert InvalidAddress();
        bytes32 nonceKey = keccak256(abi.encodePacked(address(this), action, hash, nonce));
        require(!usedWithdrawalNonces[nonceKey], "Nonce used");
        usedWithdrawalNonces[nonceKey] = true;
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(hash);
        address signer = ECDSA.recover(ethSignedHash, signature);
        require(signer == withdrawalAuthority, "Bad signature");
    }

    /// @notice Update daily withdrawal counter; revert if would exceed cap. USD amounts in 6 decimals.
    function _checkAndUpdateDailyCap(uint256 usdValue6) internal {
        if (dailyCapUsd6 == 0) return;
        uint256 day = block.timestamp / SECONDS_PER_DAY;
        if (day > lastWithdrawDay) {
            lastWithdrawDay = day;
            totalWithdrawnUsd6InPeriod = 0;
        }
        if (totalWithdrawnUsd6InPeriod + usdValue6 > dailyCapUsd6) revert ExceedsDailyCap();
        totalWithdrawnUsd6InPeriod += usdValue6;
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    // -------------------------------------------------------------------------
    // Execution (Smart Account behaviour)
    // -------------------------------------------------------------------------
    function executeCall(address target, uint256 value, bytes calldata data) external payable onlyOwner returns (bytes memory) {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            if (result.length > 0) {
                assembly {
                    let ptr := add(result, 0x20)
                    let size := mload(result)
                    revert(ptr, size)
                }
            } else {
                revert("executeCall failed");
            }
        }
        return result;
    }

    function executeCallWithAuth(address target, uint256 value, bytes calldata data, uint256 nonce, bytes calldata signature) external payable onlyOperator returns (bytes memory) {
        bytes32 action = keccak256("execute_call");
        bytes32 hash = keccak256(abi.encodePacked(address(this), target, value, keccak256(data), nonce));
        _requireValidAuthority(hash, nonce, signature, action);

        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            if (result.length > 0) {
                assembly {
                    let ptr := add(result, 0x20)
                    let size := mload(result)
                    revert(ptr, size)
                }
            } else {
                revert("executeCall failed");
            }
        }
        return result;
    }

    // -------------------------------------------------------------------------
    // Native (CELO / ETH)
    // -------------------------------------------------------------------------
    /// @notice Owner can withdraw directly when connected. Operator cannot use this.
    function withdrawNative(address payable to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        if (dailyCapUsd6 != 0 && priceCeloUsd6 != 0) {
            uint256 usd6 = (amount * priceCeloUsd6) / 1e18;
            _checkAndUpdateDailyCap(usd6);
        }
        require(address(this).balance >= amount, "Insufficient balance");
        (bool sent,) = to.call{value: amount}("");
        require(sent, "Transfer failed");
        emit WithdrewNative(to, amount);
    }

    /// @notice Operator withdraws only with a signature from withdrawalAuthority (backend signs after PIN).
    function withdrawNativeWithAuth(address payable to, uint256 amount, uint256 nonce, bytes calldata signature) external onlyOperator {
        if (withdrawalAuthority == address(0)) revert InvalidAddress();
        if (to == address(0)) revert InvalidAddress();
        if (dailyCapUsd6 != 0 && priceCeloUsd6 != 0) {
            uint256 usd6 = (amount * priceCeloUsd6) / 1e18;
            _checkAndUpdateDailyCap(usd6);
        }
        bytes32 nonceKey = keccak256(abi.encodePacked(address(this), to, amount, nonce));
        require(!usedWithdrawalNonces[nonceKey], "Nonce used");
        usedWithdrawalNonces[nonceKey] = true;
        bytes32 hash = keccak256(abi.encodePacked(address(this), to, amount, nonce));
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(hash);
        address signer = ECDSA.recover(ethSignedHash, signature);
        require(signer == withdrawalAuthority, "Bad signature");
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
        if (dailyCapUsd6 != 0 && priceCeloUsd6 != 0) {
            uint256 usd6 = (amount * priceCeloUsd6) / 1e18;
            _checkAndUpdateDailyCap(usd6);
        }
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

    /// @notice Owner can withdraw ERC20 directly when connected. USDC (6 decimals) counts toward same $100/day cap.
    function withdrawERC20(address token, address to, uint256 amount) external onlyOwner {
        if (token == address(0) || to == address(0)) revert InvalidAddress();
        if (dailyCapUsd6 != 0) _checkAndUpdateDailyCap(amount); // USDC is 6 decimals = USD
        require(IERC20(token).transfer(to, amount), "Transfer failed");
        emit WithdrewERC20(token, to, amount);
    }

    /// @notice Operator withdraws ERC20 only with a signature from withdrawalAuthority (backend signs after PIN).
    function withdrawERC20WithAuth(address token, address to, uint256 amount, uint256 nonce, bytes calldata signature) external onlyOperator {
        if (withdrawalAuthority == address(0)) revert InvalidAddress();
        if (token == address(0) || to == address(0)) revert InvalidAddress();
        if (dailyCapUsd6 != 0) _checkAndUpdateDailyCap(amount); // USDC is 6 decimals = USD
        bytes32 nonceKey = keccak256(abi.encodePacked(address(this), token, to, amount, nonce));
        require(!usedWithdrawalNonces[nonceKey], "Nonce used");
        usedWithdrawalNonces[nonceKey] = true;
        bytes32 hash = keccak256(abi.encodePacked(address(this), token, to, amount, nonce));
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(hash);
        address signer = ECDSA.recover(ethSignedHash, signature);
        require(signer == withdrawalAuthority, "Bad signature");
        require(IERC20(token).transfer(to, amount), "Transfer failed");
        emit WithdrewERC20(token, to, amount);
    }

    // -------------------------------------------------------------------------
    // Shop actions (RewardSystem) — operator calls with authority signature (PIN-gated)
    // -------------------------------------------------------------------------

    /// @notice Operator buys a collectible from the shop using wallet funds. Requires authority signature.
    /// @dev Internally approves exact price for RewardSystem then calls buyCollectible as this wallet.
    function buyCollectibleWithAuth(uint256 tokenId, bool useUsdc, uint256 maxPrice, uint256 nonce, bytes calldata signature)
        external
        onlyOperator
    {
        address rs = rewardSystem;
        if (rs == address(0)) revert ShopNotConfigured();

        uint256 price = useUsdc
            ? ITycoonRewardSystem(rs).collectibleUsdcPrice(tokenId)
            : ITycoonRewardSystem(rs).collectibleTycPrice(tokenId);
        require(price > 0, "Not for sale");
        require(price <= maxPrice, "Price too high");

        bytes32 action = keccak256("buy_collectible");
        bytes32 hash = keccak256(abi.encodePacked(address(this), rs, tokenId, useUsdc, price, maxPrice, nonce));
        _requireValidAuthority(hash, nonce, signature, action);

        address token = useUsdc ? ITycoonRewardSystem(rs).usdc() : ITycoonRewardSystem(rs).tycToken();
        if (token == address(0)) revert InvalidAddress();
        IERC20(token).approve(rs, price);
        emit ApprovalERC20(token, rs, price);

        ITycoonRewardSystem(rs).buyCollectible(tokenId, useUsdc);
        emit ShopActionExecuted(action, tokenId, useUsdc);
    }

    /// @notice Operator buys a bundle from RewardSystem using wallet funds. Requires authority signature.
    function buyBundleWithAuth(uint256 bundleId, bool useUsdc, uint256 maxPrice, uint256 nonce, bytes calldata signature)
        external
        onlyOperator
    {
        address rs = rewardSystem;
        if (rs == address(0)) revert ShopNotConfigured();

        (, , uint256 tycPrice, uint256 usdcPrice, bool active) = ITycoonRewardSystem(rs).bundles(bundleId);
        require(active, "Bundle inactive");
        uint256 price = useUsdc ? usdcPrice : tycPrice;
        require(price > 0, "Not for sale");
        require(price <= maxPrice, "Price too high");

        bytes32 action = keccak256("buy_bundle");
        bytes32 hash = keccak256(abi.encodePacked(address(this), rs, bundleId, useUsdc, price, maxPrice, nonce));
        _requireValidAuthority(hash, nonce, signature, action);

        address token = useUsdc ? ITycoonRewardSystem(rs).usdc() : ITycoonRewardSystem(rs).tycToken();
        if (token == address(0)) revert InvalidAddress();
        IERC20(token).approve(rs, price);
        emit ApprovalERC20(token, rs, price);

        ITycoonRewardSystem(rs).buyBundle(bundleId, useUsdc);
        emit ShopActionExecuted(action, bundleId, useUsdc);
    }

    /// @notice Operator burns a collectible in RewardSystem to activate a perk (burn happens from this wallet). Requires authority signature.
    function burnCollectibleForPerkWithAuth(uint256 tokenId, uint256 nonce, bytes calldata signature)
        external
        onlyOperator
    {
        address rs = rewardSystem;
        if (rs == address(0)) revert ShopNotConfigured();
        bytes32 action = keccak256("burn_collectible");
        bytes32 hash = keccak256(abi.encodePacked(address(this), rs, tokenId, nonce));
        _requireValidAuthority(hash, nonce, signature, action);

        ITycoonRewardSystem(rs).burnCollectibleForPerk(tokenId);
        emit ShopActionExecuted(action, tokenId, false);
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

    /// @notice Operator withdraws ERC1155 tokens only with a signature from withdrawalAuthority.
    function withdrawERC1155WithAuth(address collection, address to, uint256 id, uint256 amount, uint256 nonce, bytes calldata signature) external onlyOperator {
        if (withdrawalAuthority == address(0)) revert InvalidAddress();
        if (collection == address(0) || to == address(0)) revert InvalidAddress();
        bytes32 action = keccak256("withdraw_erc1155");
        bytes32 nonceKey = keccak256(abi.encodePacked(address(this), action, collection, to, id, amount, nonce));
        require(!usedWithdrawalNonces[nonceKey], "Nonce used");
        usedWithdrawalNonces[nonceKey] = true;
        bytes32 hash = keccak256(abi.encodePacked(address(this), collection, to, id, amount, nonce));
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(hash);
        address signer = ECDSA.recover(ethSignedHash, signature);
        require(signer == withdrawalAuthority, "Bad signature");
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
        return
            interfaceId == type(IERC1155Receiver).interfaceId ||
            interfaceId == type(IERC721Receiver).interfaceId ||
            interfaceId == type(IERC1271).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    // -------------------------------------------------------------------------
    // ERC1271 Signature Validation
    // -------------------------------------------------------------------------
    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4 magicValue) {
        address signer = ECDSA.recover(hash, signature);
        if (signer == owner) {
            return IERC1271.isValidSignature.selector; // 0x1626ba7e
        }
        return 0xffffffff;
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

    /// @notice Operator withdraws ERC721 tokens only with a signature from withdrawalAuthority.
    function withdrawERC721WithAuth(address collection, address to, uint256 tokenId, uint256 nonce, bytes calldata signature) external onlyOperator {
        if (withdrawalAuthority == address(0)) revert InvalidAddress();
        if (collection == address(0) || to == address(0)) revert InvalidAddress();
        bytes32 action = keccak256("withdraw_erc721");
        bytes32 nonceKey = keccak256(abi.encodePacked(address(this), action, collection, to, tokenId, nonce));
        require(!usedWithdrawalNonces[nonceKey], "Nonce used");
        usedWithdrawalNonces[nonceKey] = true;
        bytes32 hash = keccak256(abi.encodePacked(address(this), collection, to, tokenId, nonce));
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(hash);
        address signer = ECDSA.recover(ethSignedHash, signature);
        require(signer == withdrawalAuthority, "Bad signature");
        IERC721(collection).safeTransferFrom(address(this), to, tokenId);
        emit WithdrewERC721(collection, to, tokenId);
    }

    function balanceERC721(address collection) external view returns (uint256) {
        return IERC721(collection).balanceOf(address(this));
    }
}
