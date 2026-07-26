// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TycoonSoftPerkCatalog
/// @notice Soft (non-NFT) shop SKUs: paylisted price, funds go to the existing RewardSystem treasury.
/// @dev Does not modify or redeploy TycoonRewardSystem. New perks = setSoftPerk admin txs.
contract TycoonSoftPerkCatalog is Ownable, Pausable, ReentrancyGuard {
    enum PaymentToken {
        TYC,
        USDC,
        CUSDC,
        USDT
    }

    struct SoftPerk {
        uint256 tycPrice;
        uint256 usdcPrice;
        uint256 cusdcPrice;
        uint256 usdtPrice;
        bool active;
    }

    IERC20 public tycToken;
    IERC20 public usdc;
    IERC20 public cusdc;
    IERC20 public usdt;

    /// @notice Where purchase proceeds are sent (production: TycoonRewardSystem).
    address public treasury;
    address public backendMinter;

    mapping(bytes32 => SoftPerk) public softPerks;

    event BackendMinterUpdated(address indexed newMinter);
    event TreasuryUpdated(address indexed previous, address indexed next);
    event SoftPerkConfigured(
        bytes32 indexed perkId,
        uint256 tycPrice,
        uint256 usdcPrice,
        uint256 cusdcPrice,
        uint256 usdtPrice,
        bool active
    );
    event SoftPerkPurchased(
        bytes32 indexed perkId,
        address indexed buyer,
        uint256 price,
        PaymentToken paymentToken,
        address indexed treasury
    );

    constructor(
        address _tycToken,
        address _usdc,
        address _cusdc,
        address _usdt,
        address _treasury,
        address initialOwner
    ) Ownable(initialOwner) {
        require(
            _tycToken != address(0) && _usdc != address(0) && _cusdc != address(0) && _usdt != address(0),
            "Invalid tokens"
        );
        require(_treasury != address(0), "Zero treasury");
        tycToken = IERC20(_tycToken);
        usdc = IERC20(_usdc);
        cusdc = IERC20(_cusdc);
        usdt = IERC20(_usdt);
        treasury = _treasury;
    }

    modifier onlyMinter() {
        require(msg.sender == backendMinter || msg.sender == owner(), "Not minter");
        _;
    }

    function setBackendMinter(address newMinter) external onlyOwner {
        backendMinter = newMinter;
        emit BackendMinterUpdated(newMinter);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Zero treasury");
        address previous = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(previous, newTreasury);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Create or update a soft perk listing. perkId e.g. keccak256("ai_tip_pack_v1").
    function setSoftPerk(
        bytes32 perkId,
        uint256 tycPrice,
        uint256 usdcPrice,
        uint256 cusdcPrice,
        uint256 usdtPrice,
        bool active
    ) external onlyMinter {
        require(perkId != bytes32(0), "Zero perkId");
        softPerks[perkId] = SoftPerk({
            tycPrice: tycPrice,
            usdcPrice: usdcPrice,
            cusdcPrice: cusdcPrice,
            usdtPrice: usdtPrice,
            active: active
        });
        emit SoftPerkConfigured(perkId, tycPrice, usdcPrice, cusdcPrice, usdtPrice, active);
    }

    function buyPerk(bytes32 perkId, PaymentToken paymentToken) external whenNotPaused nonReentrant {
        _buyPerkFor(msg.sender, perkId, paymentToken);
    }

    /// @notice Buy for a payer (e.g. smart wallet). Caller must be payer or payer.owner().
    function buyPerkFrom(address payer, bytes32 perkId, PaymentToken paymentToken)
        external
        whenNotPaused
        nonReentrant
    {
        require(payer != address(0), "Zero payer");
        if (msg.sender != payer) {
            (bool ok, bytes memory data) = payer.staticcall(abi.encodeWithSignature("owner()"));
            require(ok && data.length >= 32, "Not payer or payer owner");
            address ownerOfPayer = abi.decode(data, (address));
            require(ownerOfPayer == msg.sender, "Not payer or payer owner");
        }
        _buyPerkFor(payer, perkId, paymentToken);
    }

    function _buyPerkFor(address payer, bytes32 perkId, PaymentToken paymentToken) internal {
        SoftPerk memory perk = softPerks[perkId];
        require(perk.active, "Perk inactive");
        uint256 price = _price(perk, paymentToken);
        require(price > 0, "Not for sale");

        IERC20 token = _paymentTokenContract(paymentToken);
        address sink = treasury;
        require(token.transferFrom(payer, sink, price), "Payment transfer failed");

        emit SoftPerkPurchased(perkId, payer, price, paymentToken, sink);
    }

    function _price(SoftPerk memory perk, PaymentToken paymentToken) internal pure returns (uint256) {
        if (paymentToken == PaymentToken.TYC) return perk.tycPrice;
        if (paymentToken == PaymentToken.USDC) return perk.usdcPrice;
        if (paymentToken == PaymentToken.CUSDC) return perk.cusdcPrice;
        return perk.usdtPrice;
    }

    function _paymentTokenContract(PaymentToken paymentToken) internal view returns (IERC20) {
        if (paymentToken == PaymentToken.TYC) return tycToken;
        if (paymentToken == PaymentToken.USDC) return usdc;
        if (paymentToken == PaymentToken.CUSDC) return cusdc;
        return usdt;
    }
}
