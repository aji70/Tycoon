// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title CeloSwapExecutor
/// @notice Receives native CELO and swaps to USDC via Ubeswap V2 router; sends USDC to msg.sender (e.g. user's smart wallet).
/// @dev User's smart wallet calls withdrawNative(executor, amount); executor receive() runs and swaps CELO→USDC to msg.sender.
interface IUniswapV2Router02 {
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);

    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts);
}

contract CeloSwapExecutor {
    IUniswapV2Router02 public immutable router;
    address public immutable wcelo;
    address public immutable usdc;
    uint256 public constant SLIPPAGE_BPS = 500; // 5% max slippage (500/10000)

    constructor(address _router, address _wcelo, address _usdc) {
        router = IUniswapV2Router02(_router);
        wcelo = _wcelo;
        usdc = _usdc;
    }

    /// @notice Receive CELO, swap to USDC via Ubeswap, send USDC to the address that sent CELO (msg.sender).
    receive() external payable {
        if (msg.value == 0) return;
        address[] memory path = new address[](2);
        path[0] = wcelo;
        path[1] = usdc;
        uint256 deadline = block.timestamp + 300; // 5 min
        uint256[] memory amounts = router.getAmountsOut(msg.value, path);
        uint256 amountOutMin = (amounts[1] * (10_000 - SLIPPAGE_BPS)) / 10_000;
        router.swapExactETHForTokens{value: msg.value}(amountOutMin, path, msg.sender, deadline);
    }
}
