// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Sends native CELO (or any EVM native token) to many EOAs in one transaction.
/// @dev Caller must set `msg.value` to the exact sum of `amounts`. Deploy on Celo mainnet or Alfajores as needed.
contract CeloBatchNativeDistributor {
    event Distributed(address indexed recipient, uint256 amount);

    /// @param recipients Addresses to receive native token transfers
    /// @param amounts Wei sent to each recipient; must match recipients.length
    /// @dev msg.value must equal sum(amounts). Reverts if any transfer fails.
    function distribute(address[] calldata recipients, uint256[] calldata amounts) external payable {
        require(recipients.length == amounts.length, "length mismatch");
        uint256 sum;
        for (uint256 i = 0; i < amounts.length; i++) {
            sum += amounts[i];
        }
        require(msg.value == sum, "value mismatch");
        for (uint256 i = 0; i < recipients.length; i++) {
            (bool ok,) = recipients[i].call{value: amounts[i]}("");
            require(ok, "native transfer failed");
            emit Distributed(recipients[i], amounts[i]);
        }
    }
}
