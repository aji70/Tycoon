// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {TycoonLib} from "./TycoonLib.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

/// @title TycoonRewardSystem
/// @notice ERC-1155 contract for vouchers (redeemable for TYC) and collectibles (perks). Supports shop, burn-for-perk, and on-chain bundles.
contract TycoonRewardSystem is ERC1155, Ownable, Pausable, ReentrancyGuard, IERC1155Receiver {
    // Token ID ranges
    uint256 public constant VOUCHER_BASE = 1_000_000_000;
    uint256 public constant COLLECTIBLE_BASE = 2_000_000_000;

    // Cash tiers for CASH_TIERED and TAX_REFUND (strength 1-5): 0, 10, 25, 50, 100, 250

    IERC20 public tycToken;
    IERC20 public usdc;

    address public backendMinter;
    /// @notice Game contract (Tycoon proxy) can mint for register/game-end rewards. Set via setGameMinter.
    address public gameMinter;
    /// @notice Addresses allowed to redeem vouchers on behalf of any owner (server-side, no user wallet connection required).
    mapping(address => bool) public voucherRedeemers;
    uint256 private _nextVoucherId = VOUCHER_BASE;
    uint256 private _nextCollectibleId = COLLECTIBLE_BASE;

    // Collectible metadata
    mapping(uint256 => TycoonLib.CollectiblePerk) public collectiblePerk;
    mapping(uint256 => uint256) public collectiblePerkStrength;
    mapping(uint256 => uint256) public collectibleTycPrice;
    mapping(uint256 => uint256) public collectibleUsdcPrice;
    mapping(uint256 => uint256) public shopStock;
    mapping(uint256 => uint256) public voucherRedeemValue;

    // Owner index for enumeration
    mapping(address => uint256[]) private _ownedIds;
    mapping(address => mapping(uint256 => uint256)) private _ownedIndex;

    // Bundles
    struct Bundle {
        uint256[] tokenIds;
        uint256[] amounts;
        uint256 tycPrice;
        uint256 usdcPrice;
        bool active;
    }
    uint256 private _nextBundleId = 1;
    mapping(uint256 => Bundle) public bundles;

    event BackendMinterUpdated(address indexed newMinter);
    event GameMinterUpdated(address indexed previous, address indexed newGameMinter);
    event VoucherRedeemerUpdated(address indexed account, bool allowed);
    event BaseURIUpdated(string newBaseURI);
    event CashPerkActivated(uint256 indexed tokenId, address indexed burner, uint256 cashAmount);
    event CollectibleBought(uint256 indexed tokenId, address indexed buyer, uint256 price, bool usedUsdc);
    event CollectibleBurned(uint256 indexed tokenId, address indexed burner, TycoonLib.CollectiblePerk perk, uint256 strength);
    event CollectibleMinted(uint256 indexed tokenId, address indexed to, TycoonLib.CollectiblePerk perk, uint256 strength);
    event CollectiblePricesUpdated(uint256 indexed tokenId, uint256 tycPrice, uint256 usdcPrice);
    event CollectibleRestocked(uint256 indexed tokenId, uint256 amount);
    event FundsWithdrawn(address indexed token, address indexed to, uint256 amount);
    event VoucherMinted(uint256 indexed tokenId, address indexed to, uint256 tycValue);
    event VoucherRedeemed(uint256 indexed tokenId, address indexed redeemer, uint256 tycValue);
    event BundleStocked(uint256 indexed bundleId, uint256[] tokenIds, uint256 tycPrice, uint256 usdcPrice);
    event BundleBought(uint256 indexed bundleId, address indexed buyer, uint256 price, bool usedUsdc);
    event BundleUpdated(uint256 indexed bundleId, bool active);

    constructor(address _tycToken, address _usdc, address initialOwner)
        ERC1155("https://tycoon.game/api/metadata/")
        Ownable(initialOwner)
    {
        require(_tycToken != address(0) && _usdc != address(0), "Invalid tokens");
        tycToken = IERC20(_tycToken);
        usdc = IERC20(_usdc);
    }

    modifier onlyMinter() {
        require(
            msg.sender == backendMinter || msg.sender == gameMinter || msg.sender == owner(),
            "Not minter"
        );
        _;
    }

    function setBackendMinter(address newMinter) external onlyOwner {
        backendMinter = newMinter;
        emit BackendMinterUpdated(newMinter);
    }

    /// @notice Set the game contract (Tycoon proxy) so it can mint on register/game-end. Keeps backendMinter for faucet (daily login).
    function setGameMinter(address newGameMinter) external onlyOwner {
        address previous = gameMinter;
        gameMinter = newGameMinter;
        emit GameMinterUpdated(previous, newGameMinter);
    }

    /// @notice Allow/revoke a backend signer that can call redeemVoucherFor without wallet-owner approval.
    function setVoucherRedeemer(address account, bool allowed) external onlyOwner {
        require(account != address(0), "Zero account");
        voucherRedeemers[account] = allowed;
        emit VoucherRedeemerUpdated(account, allowed);
    }

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _setURI(newBaseURI);
        emit BaseURIUpdated(newBaseURI);
    }

    function setTycToken(address newTycToken) external onlyOwner {
        require(newTycToken != address(0), "Invalid TYC");
        tycToken = IERC20(newTycToken);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function getCashTierValue(uint256 tier) external pure returns (uint256) {
        require(tier >= 1 && tier <= 5, "Tier 1-5");
        if (tier == 1) return 10;
        if (tier == 2) return 25;
        if (tier == 3) return 50;
        if (tier == 4) return 100;
        return 250; // tier 5
    }

    function _getCashTierValue(uint256 tier) internal pure returns (uint256) {
        if (tier == 1) return 10;
        if (tier == 2) return 25;
        if (tier == 3) return 50;
        if (tier == 4) return 100;
        if (tier == 5) return 250;
        return 0;
    }

    function _isVoucher(uint256 tokenId) internal pure returns (bool) {
        return tokenId >= VOUCHER_BASE && tokenId < COLLECTIBLE_BASE;
    }

    function _isCollectible(uint256 tokenId) internal pure returns (bool) {
        return tokenId >= COLLECTIBLE_BASE;
    }

    function _validateStrength(TycoonLib.CollectiblePerk perk, uint256 strength) internal pure {
        if (perk == TycoonLib.CollectiblePerk.CASH_TIERED || perk == TycoonLib.CollectiblePerk.TAX_REFUND) {
            require(strength >= 1 && strength <= 5, "Strength 1-5 for cash perks");
        } else {
            require(strength >= 1, "Strength >= 1");
        }
    }

    function _addToOwned(address to, uint256 id, uint256 amount) internal {
        if (amount == 0) return;
        if (_ownedIndex[to][id] == 0) {
            _ownedIds[to].push(id);
            _ownedIndex[to][id] = _ownedIds[to].length;
        }
    }

    /// @dev After `super._update`, balance is already final. Remove id from enumeration when this owner holds none (burn / full transfer out).
    ///      Previous `bal == amount` check was wrong: after a burn, bal is 0 so it never removed; partial transfers could remove too early.
    function _removeFromOwned(address from, uint256 id, uint256 amount) internal {
        if (amount == 0 || from == address(0)) return;
        if (balanceOf(from, id) > 0) return;
        uint256 idx = _ownedIndex[from][id];
        if (idx == 0) return;
        uint256 lastIdx = _ownedIds[from].length;
        uint256 lastId = _ownedIds[from][lastIdx - 1];
        _ownedIds[from][idx - 1] = lastId;
        _ownedIndex[from][lastId] = idx;
        _ownedIds[from].pop();
        delete _ownedIndex[from][id];
    }

    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256) {
        require(index < _ownedIds[owner].length, "Index out of bounds");
        return _ownedIds[owner][index];
    }

    function ownedTokenCount(address owner) external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < _ownedIds[owner].length; i++) {
            if (balanceOf(owner, _ownedIds[owner][i]) > 0) count++;
        }
        return count;
    }

    function mintVoucher(address to, uint256 tycValue) external onlyMinter returns (uint256 tokenId) {
        require(to != address(0) && tycValue > 0, "Invalid params");
        tokenId = _nextVoucherId++;
        voucherRedeemValue[tokenId] = tycValue;
        _mint(to, tokenId, 1, "");
        _addToOwned(to, tokenId, 1);
        emit VoucherMinted(tokenId, to, tycValue);
    }

    function redeemVoucher(uint256 tokenId) external whenNotPaused nonReentrant {
        require(_isVoucher(tokenId), "Not voucher");
        uint256 val = voucherRedeemValue[tokenId];
        require(val > 0, "Unknown voucher");
        _burn(msg.sender, tokenId, 1);
        _removeFromOwned(msg.sender, tokenId, 1);
        require(tycToken.transfer(msg.sender, val), "TYC transfer failed");
        emit VoucherRedeemed(tokenId, msg.sender, val);
    }

    /// @notice Burn a voucher owned by another address (e.g. smart wallet) and send TYC to that owner. Callable by the voucher owner or by the on-chain owner of the owner (e.g. EOA owner of a smart wallet).
    function redeemVoucherFor(address voucherOwner, uint256 tokenId) external whenNotPaused nonReentrant {
        require(_isVoucher(tokenId), "Not voucher");
        uint256 val = voucherRedeemValue[tokenId];
        require(val > 0, "Unknown voucher");
        require(voucherOwner != address(0), "Zero owner");
        if (
            msg.sender != voucherOwner &&
            msg.sender != backendMinter &&
            msg.sender != gameMinter &&
            msg.sender != owner() &&
            !voucherRedeemers[msg.sender]
        ) {
            // Caller must be the on-chain owner of the wallet (e.g. EOA owner of TycoonUserWallet), its operator, backendMinter, or approved for all by the voucher owner (ERC1155).
            bool isAuthorizedWalletManager = false;
            if (voucherOwner.code.length > 0) {
                // Check owner()
                (bool ok, bytes memory data) = voucherOwner.staticcall(abi.encodeWithSignature("owner()"));
                if (ok && data.length >= 32) {
                    address ownerOf = abi.decode(data, (address));
                    if (ownerOf == msg.sender) isAuthorizedWalletManager = true;
                }
                // Check operator()
                if (!isAuthorizedWalletManager) {
                    (bool okOp, bytes memory dataOp) = voucherOwner.staticcall(abi.encodeWithSignature("operator()"));
                    if (okOp && dataOp.length >= 32) {
                        address operatorOf = abi.decode(dataOp, (address));
                        if (operatorOf == msg.sender) isAuthorizedWalletManager = true;
                    }
                }
            }
            require(isAuthorizedWalletManager || isApprovedForAll(voucherOwner, msg.sender), "Not owner or approved");
        }
        _burn(voucherOwner, tokenId, 1);
        _removeFromOwned(voucherOwner, tokenId, 1);
        require(tycToken.transfer(voucherOwner, val), "TYC transfer failed");
        emit VoucherRedeemed(tokenId, voucherOwner, val);
    }

    function mintCollectible(address to, TycoonLib.CollectiblePerk perk, uint256 strength)
        external
        onlyMinter
        returns (uint256 tokenId)
    {
        _validateStrength(perk, strength);
        tokenId = _nextCollectibleId++;
        collectiblePerk[tokenId] = perk;
        collectiblePerkStrength[tokenId] = strength;
        collectibleTycPrice[tokenId] = 0;
        collectibleUsdcPrice[tokenId] = 0;
        shopStock[tokenId] = 0;
        _mint(to, tokenId, 1, "");
        _addToOwned(to, tokenId, 1);
        emit CollectibleMinted(tokenId, to, perk, strength);
    }

    function stockShop(
        uint256 amount,
        TycoonLib.CollectiblePerk perk,
        uint256 strength,
        uint256 tycPrice,
        uint256 usdcPrice
    ) external onlyMinter {
        _validateStrength(perk, strength);
        require(amount > 0, "Amount > 0");
        uint256 tokenId = _nextCollectibleId++;
        collectiblePerk[tokenId] = perk;
        collectiblePerkStrength[tokenId] = strength;
        collectibleTycPrice[tokenId] = tycPrice;
        collectibleUsdcPrice[tokenId] = usdcPrice;
        shopStock[tokenId] = amount;
        _mint(address(this), tokenId, amount, "");
    }

    function buyCollectible(uint256 tokenId, bool useUsdc) external whenNotPaused nonReentrant {
        _buyCollectibleFor(msg.sender, tokenId, useUsdc);
    }

    /// @notice Deliver a collectible to a user from shop stock without payment (e.g. for fiat purchases).
    function deliverCollectible(address to, uint256 tokenId) external onlyMinter {
        require(_isCollectible(tokenId), "Not collectible");
        require(shopStock[tokenId] >= 1, "Out of stock");
        shopStock[tokenId] -= 1;
        _safeTransferFrom(address(this), to, tokenId, 1, "");
        _addToOwned(to, tokenId, 1);
        emit CollectibleBought(tokenId, to, 0, false);
    }

    /// @notice Buy a collectible with USDC or TYC from a given payer (e.g. smart wallet). Callable by the payer or by the owner of the payer if payer is a contract with owner().
    function buyCollectibleFrom(address payer, uint256 tokenId, bool useUsdc) external whenNotPaused nonReentrant {
        require(payer != address(0), "Zero payer");
        if (msg.sender != payer) {
            (bool ok, bytes memory data) = payer.staticcall(abi.encodeWithSignature("owner()"));
            require(ok && data.length >= 32, "Not payer or payer owner");
            address ownerOfPayer = abi.decode(data, (address));
            require(ownerOfPayer == msg.sender, "Not payer or payer owner");
        }
        _buyCollectibleFor(payer, tokenId, useUsdc);
    }

    function _buyCollectibleFor(address payer, uint256 tokenId, bool useUsdc) internal {
        require(_isCollectible(tokenId), "Not collectible");
        require(shopStock[tokenId] >= 1, "Out of stock");
        uint256 price = useUsdc ? collectibleUsdcPrice[tokenId] : collectibleTycPrice[tokenId];
        require(price > 0, "Not for sale");
        shopStock[tokenId] -= 1;
        if (useUsdc) {
            require(usdc.transferFrom(payer, address(this), price), "USDC transfer failed");
        } else {
            require(tycToken.transferFrom(payer, address(this), price), "TYC transfer failed");
        }
        _safeTransferFrom(address(this), payer, tokenId, 1, "");
        _addToOwned(payer, tokenId, 1);
        emit CollectibleBought(tokenId, payer, price, useUsdc);
    }

    function burnCollectibleForPerk(uint256 tokenId) external nonReentrant {
        require(_isCollectible(tokenId), "Not collectible");
        TycoonLib.CollectiblePerk perk = collectiblePerk[tokenId];
        uint256 strength = collectiblePerkStrength[tokenId];
        require(uint8(perk) != 0, "Unknown collectible");
        _burn(msg.sender, tokenId, 1);
        _removeFromOwned(msg.sender, tokenId, 1);
        uint256 cash;
        if (perk == TycoonLib.CollectiblePerk.CASH_TIERED || perk == TycoonLib.CollectiblePerk.TAX_REFUND) {
            cash = _getCashTierValue(strength);
            if (cash > 0) {
                require(tycToken.transfer(msg.sender, cash), "TYC transfer failed");
                emit CashPerkActivated(tokenId, msg.sender, cash);
            }
        }
        emit CollectibleBurned(tokenId, msg.sender, perk, strength);
    }

    /// @notice Burn a collectible to activate perk rewards from a given payer (e.g. smart wallet). Callable by the payer or by the owner of the payer if payer is a contract with owner().
    function burnCollectibleForPerkFrom(address payer, uint256 tokenId) external nonReentrant {
        require(payer != address(0), "Zero payer");
        if (msg.sender != payer) {
            (bool ok, bytes memory data) = payer.staticcall(abi.encodeWithSignature("owner()"));
            require(ok && data.length >= 32, "Not payer or payer owner");
            address ownerOfPayer = abi.decode(data, (address));
            require(ownerOfPayer == msg.sender, "Not payer or payer owner");
        }
        require(_isCollectible(tokenId), "Not collectible");
        TycoonLib.CollectiblePerk perk = collectiblePerk[tokenId];
        uint256 strength = collectiblePerkStrength[tokenId];
        require(uint8(perk) != 0, "Unknown collectible");
        _burn(payer, tokenId, 1);
        _removeFromOwned(payer, tokenId, 1);
        uint256 cash;
        if (perk == TycoonLib.CollectiblePerk.CASH_TIERED || perk == TycoonLib.CollectiblePerk.TAX_REFUND) {
            cash = _getCashTierValue(strength);
            if (cash > 0) {
                require(tycToken.transfer(payer, cash), "TYC transfer failed");
                emit CashPerkActivated(tokenId, payer, cash);
            }
        }
        emit CollectibleBurned(tokenId, payer, perk, strength);
    }

    function restockCollectible(uint256 tokenId, uint256 additionalAmount) external onlyMinter {
        require(_isCollectible(tokenId), "Not collectible");
        require(collectiblePerk[tokenId] != TycoonLib.CollectiblePerk.NONE, "Unknown collectible");
        require(additionalAmount > 0, "Amount > 0");
        shopStock[tokenId] += additionalAmount;
        _mint(address(this), tokenId, additionalAmount, "");
        emit CollectibleRestocked(tokenId, additionalAmount);
    }

    function updateCollectiblePrices(uint256 tokenId, uint256 newTycPrice, uint256 newUsdcPrice) external onlyMinter {
        require(_isCollectible(tokenId), "Not collectible");
        require(collectiblePerk[tokenId] != TycoonLib.CollectiblePerk.NONE, "Unknown collectible");
        collectibleTycPrice[tokenId] = newTycPrice;
        collectibleUsdcPrice[tokenId] = newUsdcPrice;
        emit CollectiblePricesUpdated(tokenId, newTycPrice, newUsdcPrice);
    }

    function getCollectibleInfo(uint256 tokenId)
        external
        view
        returns (
            TycoonLib.CollectiblePerk perk,
            uint256 strength,
            uint256 tycPrice,
            uint256 usdcPrice,
            uint256 stock
        )
    {
        require(_isCollectible(tokenId), "Not collectible");
        return (
            collectiblePerk[tokenId],
            collectiblePerkStrength[tokenId],
            collectibleTycPrice[tokenId],
            collectibleUsdcPrice[tokenId],
            shopStock[tokenId]
        );
    }

    // -------------------------
    // Bundle support
    // -------------------------

    /// @notice Create or update a bundle of collectibles sold together at fixed price.
    function stockBundle(
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        uint256 tycPrice,
        uint256 usdcPrice
    ) external onlyMinter returns (uint256 bundleId) {
        require(tokenIds.length > 0 && tokenIds.length == amounts.length, "Invalid arrays");
        require(tycPrice > 0 || usdcPrice > 0, "Need price");
        bundleId = _nextBundleId++;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(_isCollectible(tokenIds[i]), "Not collectible");
            require(amounts[i] > 0, "Amount > 0");
        }
        bundles[bundleId] = Bundle({
            tokenIds: tokenIds,
            amounts: amounts,
            tycPrice: tycPrice,
            usdcPrice: usdcPrice,
            active: true
        });
        emit BundleStocked(bundleId, tokenIds, tycPrice, usdcPrice);
    }

    /// @notice Update bundle active status.
    function setBundleActive(uint256 bundleId, bool active) external onlyMinter {
        require(bundles[bundleId].tokenIds.length > 0, "Bundle not found");
        bundles[bundleId].active = active;
        emit BundleUpdated(bundleId, active);
    }

    /// @notice Buy a bundle: pay TYC or USDC, receive all items in one tx.
    function buyBundle(uint256 bundleId, bool useUsdc) external whenNotPaused nonReentrant {
        Bundle storage b = bundles[bundleId];
        require(b.active, "Bundle inactive");
        require(b.tokenIds.length > 0, "Bundle not found");
        uint256 price = useUsdc ? b.usdcPrice : b.tycPrice;
        require(price > 0, "No price");
        for (uint256 i = 0; i < b.tokenIds.length; i++) {
            require(shopStock[b.tokenIds[i]] >= b.amounts[i], "Insufficient stock");
        }
        for (uint256 i = 0; i < b.tokenIds.length; i++) {
            shopStock[b.tokenIds[i]] -= b.amounts[i];
        }
        if (useUsdc) {
            require(usdc.transferFrom(msg.sender, address(this), price), "USDC transfer failed");
        } else {
            require(tycToken.transferFrom(msg.sender, address(this), price), "TYC transfer failed");
        }
        for (uint256 i = 0; i < b.tokenIds.length; i++) {
            _safeTransferFrom(address(this), msg.sender, b.tokenIds[i], b.amounts[i], "");
            _addToOwned(msg.sender, b.tokenIds[i], b.amounts[i]);
        }
        emit BundleBought(bundleId, msg.sender, price, useUsdc);
    }

    /// @notice Buy a bundle with USDC or TYC from a given payer (e.g. smart wallet). Callable by the payer or by the owner of the payer if payer is a contract with owner().
    function buyBundleFrom(address payer, uint256 bundleId, bool useUsdc) external whenNotPaused nonReentrant {
        require(payer != address(0), "Zero payer");
        if (msg.sender != payer) {
            (bool ok, bytes memory data) = payer.staticcall(abi.encodeWithSignature("owner()"));
            require(ok && data.length >= 32, "Not payer or payer owner");
            address ownerOfPayer = abi.decode(data, (address));
            require(ownerOfPayer == msg.sender, "Not payer or payer owner");
        }
        Bundle storage b = bundles[bundleId];
        require(b.active, "Bundle inactive");
        require(b.tokenIds.length > 0, "Bundle not found");
        uint256 price = useUsdc ? b.usdcPrice : b.tycPrice;
        require(price > 0, "No price");
        for (uint256 i = 0; i < b.tokenIds.length; i++) {
            require(shopStock[b.tokenIds[i]] >= b.amounts[i], "Insufficient stock");
        }
        for (uint256 i = 0; i < b.tokenIds.length; i++) {
            shopStock[b.tokenIds[i]] -= b.amounts[i];
        }
        if (useUsdc) {
            require(usdc.transferFrom(payer, address(this), price), "USDC transfer failed");
        } else {
            require(tycToken.transferFrom(payer, address(this), price), "TYC transfer failed");
        }
        for (uint256 i = 0; i < b.tokenIds.length; i++) {
            _safeTransferFrom(address(this), payer, b.tokenIds[i], b.amounts[i], "");
            _addToOwned(payer, b.tokenIds[i], b.amounts[i]);
        }
        emit BundleBought(bundleId, payer, price, useUsdc);
    }

    /// @notice Deliver a bundle to a user from shop stock without payment (e.g. for fiat purchases).
    function deliverBundle(address to, uint256 bundleId) external onlyMinter {
        Bundle storage b = bundles[bundleId];
        require(b.active, "Bundle inactive");
        require(b.tokenIds.length > 0, "Bundle not found");
        for (uint256 i = 0; i < b.tokenIds.length; i++) {
            require(shopStock[b.tokenIds[i]] >= b.amounts[i], "Insufficient stock");
        }
        for (uint256 i = 0; i < b.tokenIds.length; i++) {
            shopStock[b.tokenIds[i]] -= b.amounts[i];
            _safeTransferFrom(address(this), to, b.tokenIds[i], b.amounts[i], "");
            _addToOwned(to, b.tokenIds[i], b.amounts[i]);
        }
        emit BundleBought(bundleId, to, 0, false);
    }

    /// @notice Get bundle info.
    function getBundleInfo(uint256 bundleId)
        external
        view
        returns (
            uint256[] memory tokenIds,
            uint256[] memory amounts,
            uint256 tycPrice,
            uint256 usdcPrice,
            bool active
        )
    {
        Bundle storage b = bundles[bundleId];
        return (b.tokenIds, b.amounts, b.tycPrice, b.usdcPrice, b.active);
    }

    function withdrawFunds(IERC20 token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero address");
        require(token.transfer(to, amount), "Transfer failed");
        emit FundsWithdrawn(address(token), to, amount);
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override {
        super._update(from, to, ids, values);
        for (uint256 i = 0; i < ids.length; i++) {
            if (from != address(0)) _removeFromOwned(from, ids[i], values[i]);
            if (to != address(0)) _addToOwned(to, ids[i], values[i]);
        }
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

    receive() external payable {}
}
