// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {TycoonUpgradeable} from "../src/TycoonUpgradeable.sol";

/// @title Register the Bank address on the Tycoon contract
/// @notice Registers 0xFb0331d4F586D38Df611E34b9bC77a99F96f09ee as username "Bank" so setPropertyStats("Bank", buyer) works for in-game purchases from bank.
/// @dev Caller must be owner or backendGameController. Uses registerPlayerFor so no need for the Bank address to sign.
///      Run with owner/controller key: forge script script/RegisterBank.s.sol --rpc-url $RPC_URL --broadcast
///      Requires .env: TYCOON_PROXY_ADDRESS. Optional: BANK_ADDRESS (defaults to 0xFb0331d4F586D38Df611E34b9bC77a99F96f09ee)
contract RegisterBankScript is Script {
    address constant DEFAULT_BANK_ADDRESS = 0xFb0331d4F586D38Df611E34b9bC77a99F96f09ee;

    function run() external {
        address proxy = vm.envAddress("TYCOON_PROXY_ADDRESS");
        address bankAddress = vm.envOr("BANK_ADDRESS", DEFAULT_BANK_ADDRESS);

        // Non-zero password hash required by registerPlayerFor; not used for game actions by Bank
        bytes32 passwordHash = keccak256(abi.encodePacked("Bank"));

        vm.startBroadcast();

        TycoonUpgradeable tycoon = TycoonUpgradeable(payable(proxy));
        tycoon.registerPlayerFor(bankAddress, "Bank", passwordHash);

        console.log("Registered Bank at", bankAddress);
        vm.stopBroadcast();
    }
}
