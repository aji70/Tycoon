// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {TycoonSoftPerkCatalog} from "../src/TycoonSoftPerkCatalog.sol";
import {TycoonToken} from "../src/legacy/TycoonToken.sol";

contract TycoonSoftPerkCatalogTest is Test {
    TycoonSoftPerkCatalog public catalog;
    TycoonToken public tyc;
    TycoonToken public usdc;
    address public owner = makeAddr("owner");
    address public minter = makeAddr("minter");
    address public treasury = makeAddr("treasury");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    bytes32 public constant TIP_PACK = keccak256("ai_tip_pack_v1");
    uint256 public constant PRICE_USDC = 50_000; // $0.05 with 6 decimals

    function setUp() public {
        vm.startPrank(owner);
        tyc = new TycoonToken(owner);
        usdc = new TycoonToken(owner);
        catalog = new TycoonSoftPerkCatalog(
            address(tyc),
            address(usdc),
            address(usdc),
            address(usdc),
            treasury,
            owner
        );
        catalog.setBackendMinter(minter);
        vm.stopPrank();

        vm.prank(minter);
        catalog.setSoftPerk(TIP_PACK, 0, PRICE_USDC, 0, 0, true);

        vm.prank(owner);
        usdc.mint(alice, 1_000_000_000);
        vm.prank(alice);
        usdc.approve(address(catalog), type(uint256).max);
    }

    function test_BuyPerk_TransfersToTreasuryAndEmits() public {
        uint256 beforeTreasury = usdc.balanceOf(treasury);
        uint256 beforeAlice = usdc.balanceOf(alice);

        vm.expectEmit(true, true, true, true);
        emit TycoonSoftPerkCatalog.SoftPerkPurchased(
            TIP_PACK, alice, PRICE_USDC, TycoonSoftPerkCatalog.PaymentToken.USDC, treasury
        );

        vm.prank(alice);
        catalog.buyPerk(TIP_PACK, TycoonSoftPerkCatalog.PaymentToken.USDC);

        assertEq(usdc.balanceOf(treasury), beforeTreasury + PRICE_USDC);
        assertEq(usdc.balanceOf(alice), beforeAlice - PRICE_USDC);
        assertEq(usdc.balanceOf(address(catalog)), 0);
    }

    function test_BuyPerk_RevertsWhenInactive() public {
        vm.prank(minter);
        catalog.setSoftPerk(TIP_PACK, 0, PRICE_USDC, 0, 0, false);

        vm.prank(alice);
        vm.expectRevert("Perk inactive");
        catalog.buyPerk(TIP_PACK, TycoonSoftPerkCatalog.PaymentToken.USDC);
    }

    function test_BuyPerk_RevertsWhenPriceZeroForToken() public {
        vm.prank(alice);
        vm.expectRevert("Not for sale");
        catalog.buyPerk(TIP_PACK, TycoonSoftPerkCatalog.PaymentToken.TYC);
    }

    function test_SetSoftPerk_OnlyMinter() public {
        vm.prank(bob);
        vm.expectRevert("Not minter");
        catalog.setSoftPerk(keccak256("new_perk"), 0, 1, 0, 0, true);
    }

    function test_BuyPerkFrom_PayerSelf() public {
        vm.prank(alice);
        catalog.buyPerkFrom(alice, TIP_PACK, TycoonSoftPerkCatalog.PaymentToken.USDC);
        assertEq(usdc.balanceOf(treasury), PRICE_USDC);
    }

    function test_BuyPerkFrom_RejectsStranger() public {
        vm.prank(bob);
        vm.expectRevert();
        catalog.buyPerkFrom(alice, TIP_PACK, TycoonSoftPerkCatalog.PaymentToken.USDC);
    }

    function test_PauseBlocksBuy() public {
        vm.prank(owner);
        catalog.pause();
        vm.prank(alice);
        vm.expectRevert();
        catalog.buyPerk(TIP_PACK, TycoonSoftPerkCatalog.PaymentToken.USDC);
    }
}
