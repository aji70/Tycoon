// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {TagRouter, Wallet} from "../src/Counter.sol";
import {USDC, USDT} from "../src/MockUsdc.sol";

contract TagRouterTest is Test {
    TagRouter public tagrouter;
    USDC public usdc;
    USDT public usdt;

    address owner = makeAddr("owner");
    address user1 = makeAddr("user1");
    address user2 = makeAddr("user2");

    function setUp() public {
        tagrouter = new TagRouter();
        usdc = new USDC(owner);
        usdt = new USDT(owner);

        vm.deal(address(tagrouter), 1000 ether); // Fund the tagrouter contract with some ether
        vm.deal(user1, 10 ether); // Give user1 some ether
        vm.deal(user2, 10 ether); // Give user2 some ether
    }

    function test_register() public {
        string memory tag = "testTag";
        vm.deal(user1, 10 ether); // Give user1 some ether

        // Call registerTag with user1
        address userWallet = tagrouter.registerTag(tag, user1);
        address expectedWallet = tagrouter.getUserChainAddress(tag);

        assertEq(userWallet, expectedWallet, "User wallet address should match the expected wallet address");
        // Print to console
        vm.prank(user1);
        tagrouter.depositToTag{value: 1 ether}(tag); // Deposit 1 ether to the tag
        uint256 balance = tagrouter.getTagBalance(tag);
        assertEq(balance, 1 ether, "Tag balance should be 1 ether after deposit");

        // Simulate a withdrawal back to the main contract
        uint256 contractBalanceBefore = address(tagrouter).balance;

        Wallet userWallet1 = Wallet(payable(userWallet));
        vm.prank(address(tagrouter));
        userWallet1.withdrawTo(payable(address(tagrouter)), 1 ether);

        uint256 contractBalanceAfter = address(tagrouter).balance;
        assertEq(
            contractBalanceAfter, contractBalanceBefore + 1 ether, "Contract should receive 1 ether after withdrawal"
        );
    }

    function test_receive_ERC20() public {
        string memory tag = "testTag";

        vm.deal(user1, 10 ether); // Give user1 some ether

        // Register a tag
        address userWallet = tagrouter.registerTag(tag, user1);

        Wallet userWallet1 = Wallet(payable(userWallet));

        // Mint some USDC to user1
        vm.startPrank(owner);
        usdc.mint(address(userWallet1), 1000000000000000); // Assuming USDC has 6 decimals
        usdc.approve(address(tagrouter), 1000000000000000);

        userWallet1.getERC20Balance(address(usdc));

        assertEq(usdc.balanceOf(userWallet), 1000000000000000, "User wallet should initially have 0 USDC");

        uint256 bal = tagrouter.getERC20Balance(address(usdc), tag);
        assertEq(bal, 1000000000000000, "TagRouter should have 0 USDC initially");

        uint256 contractBalanceBefore = usdc.balanceOf(address(tagrouter));

        vm.startPrank(user1);
        tagrouter.swapTokenForEth(address(usdc), 3500, 3500, tag);
        uint256 contractBalanceAfter = usdc.balanceOf(address(tagrouter));
        assertEq(contractBalanceAfter, contractBalanceBefore + 3500, "TagRouter should receive 3500 USDC after swap");
        uint256 userBalanceAfter = usdc.balanceOf(userWallet);
        assertEq(
            userBalanceAfter, 1000000000000000 - 3500, "User wallet should have 1000000000000000 - 3500 USDC after swap"
        );
    }

function test_swap_eth_for_erc20() public {
    string memory tag = "testTag";

    vm.deal(user1, 10 ether); // Give user1 some ETH

    // Register a tag and get wallet
    address userWallet = tagrouter.registerTag(tag, user1);
    // Wallet userWallet1 = Wallet(payable(userWallet));

    vm.deal(userWallet, 100 ether); // Give the wallet contract ETH so it can send it


    // Fund the TagRouter with USDC liquidity
    vm.startPrank(owner);
    usdc.mint(address(tagrouter), 1_000_000); // 1 million USDC (6 decimals)
    vm.stopPrank();

    // Check that user wallet starts with 0 USDC
    assertEq(usdc.balanceOf(userWallet), 0, "User wallet should have 0 USDC before swap");

    // Instruct the user's wallet to send ETH to the TagRouter
    // vm.prank(user1);
    // userWallet1.withdrawTo(payable(address(tagrouter)), 1 ether); // sends ETH from wallet

    // Now the TagRouter holds ETH and swaps it for USDC into the user's wallet
    // TagRouter logic should auto-trigger swapEthForToken
    // If not, you may need to explicitly call it here
    vm.prank(address(tagrouter)); // simulate swap trigger (if not auto-internal)
    tagrouter.swapEthForToken(address(usdc), 3500, tag, 1 ether);

    // Check USDC was delivered to wallet
    uint256 userWalletUSDC = usdc.balanceOf(userWallet);
    assertEq(userWalletUSDC, (1 ether * 3500) / 1 ether, "User wallet should receive correct USDC after swap");

    // // Optional: confirm router has less USDC
    uint256 routerUSDC = usdc.balanceOf(address(tagrouter));
    assertLt(routerUSDC, 1_000_000, "Router USDC should decrease after swap");
}

}
