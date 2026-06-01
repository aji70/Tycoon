// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {TycoonUpgradeable} from "../src/TycoonUpgradeable.sol";
import {TycoonUpgradeableLogic} from "../src/TycoonUpgradeableLogic.sol";
import {TycoonRewardSystem} from "../src/TycoonRewardSystem.sol";
import {TycoonToken} from "../src/legacy/TycoonToken.sol";
import {TycoonLib} from "../src/TycoonLib.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @notice Tests MiniPay registration path: registerPlayerWithoutWallet on TycoonUpgradeable (production proxy logic).
contract TycoonUpgradeableRegistrationTest is Test {
    TycoonUpgradeable public tycoon;
    TycoonRewardSystem public rewardSystem;

    address public owner = makeAddr("owner");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    function setUp() public {
        vm.startPrank(owner);
        TycoonToken tyc = new TycoonToken(owner);
        TycoonToken usdc = new TycoonToken(owner);
        rewardSystem = new TycoonRewardSystem(address(tyc), address(usdc), address(usdc), address(usdc), owner);

        TycoonUpgradeable impl = new TycoonUpgradeable();
        bytes memory initData = abi.encodeCall(TycoonUpgradeable.initialize, (owner, address(rewardSystem)));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        tycoon = TycoonUpgradeable(payable(address(proxy)));

        TycoonUpgradeableLogic logic = new TycoonUpgradeableLogic();
        tycoon.setLogicContract(address(logic));
        rewardSystem.setGameMinter(address(tycoon));
        vm.stopPrank();
    }

    function test_registerPlayerWithoutWallet() public {
        vm.prank(alice);
        uint256 playerId = tycoon.registerPlayerWithoutWallet("AliceMini");

        assertEq(playerId, 1);
        assertTrue(tycoon.registered(alice));
        assertEq(tycoon.addressToUsername(alice), "AliceMini");
        assertTrue(tycoon.addressVerified(alice));
        assertEq(tycoon.totalUsers(), 1);

        TycoonLib.User memory user = tycoon.getUser("AliceMini");
        assertEq(user.username, "AliceMini");
        assertEq(user.playerAddress, alice);
        assertEq(user.id, playerId);
    }

    function test_registerPlayerWithoutWallet_revert_already_registered() public {
        vm.prank(alice);
        tycoon.registerPlayerWithoutWallet("AliceMini");

        vm.prank(alice);
        vm.expectRevert(bytes("Already registered"));
        tycoon.registerPlayerWithoutWallet("AliceOther");
    }

    function test_registerPlayerWithoutWallet_revert_username_taken() public {
        vm.prank(alice);
        tycoon.registerPlayerWithoutWallet("TakenName");

        vm.prank(bob);
        vm.expectRevert(bytes("Username taken"));
        tycoon.registerPlayerWithoutWallet("TakenName");
    }

    function test_registerPlayerWithoutWallet_revert_empty_username() public {
        vm.prank(alice);
        vm.expectRevert(bytes("Username empty"));
        tycoon.registerPlayerWithoutWallet("");
    }
}
