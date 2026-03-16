// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {TycoonUserRegistry} from "../src/legacy/TycoonUserRegistry.sol";
import {TycoonUpgradeable} from "../src/TycoonUpgradeable.sol";

/// @title Deploy new TycoonUserRegistry and configure it (operator, withdrawal authority, Naira vault, daily cap)
/// @notice Run with TYCOON_OWNER key. Updates game proxy to use the new registry.
///
/// Required .env:
///   TYCOON_OWNER
///   TYCOON_PROXY_ADDRESS
///   TYCOON_REWARDS_FAUCET_ADDRESS
///   OPERATOR_ADDRESS              (backend operator; e.g. from SMART_WALLET_OPERATOR_PRIVATE_KEY)
///   WITHDRAWAL_AUTHORITY_ADDRESS  (signs withdrawals after PIN; e.g. from WITHDRAWAL_AUTHORITY_PRIVATE_KEY)
///
/// Optional .env:
///   TYCOON_NAIRA_VAULT_ADDRESS    (if set, Naira vault is configured on registry)
///   DEFAULT_DAILY_CAP_USD6        (e.g. 100000000 = $100/day; default 100000000)
///   DEFAULT_PRICE_CELO_USD6       (e.g. 2500000 = $2.50 per CELO; default 2500000)
///
/// After run: set TYCOON_USER_REGISTRY_CELO and NEXT_PUBLIC_CELO_USER_REGISTRY to the logged registry address.
contract DeployAndConfigureUserRegistryScript is Script {
    function run() external {
        address owner = vm.envAddress("TYCOON_OWNER");
        address proxy = vm.envAddress("TYCOON_PROXY_ADDRESS");
        address rewardsFaucet = vm.envAddress("TYCOON_REWARDS_FAUCET_ADDRESS");
        address operatorAddress = vm.envAddress("OPERATOR_ADDRESS");
        address withdrawalAuthorityAddress = vm.envAddress("WITHDRAWAL_AUTHORITY_ADDRESS");

        uint256 dailyCapUsd6 = vm.envOr("DEFAULT_DAILY_CAP_USD6", uint256(100_000_000)); // 100e6 = $100/day
        uint256 priceCeloUsd6 = vm.envOr("DEFAULT_PRICE_CELO_USD6", uint256(2_500_000)); // 2.5e6 = $2.50/CELO

        address nairaVaultAddress = address(0);
        string memory nairaStr = vm.envOr("TYCOON_NAIRA_VAULT_ADDRESS", string(""));
        if (bytes(nairaStr).length > 0) nairaVaultAddress = vm.parseAddress(nairaStr);

        vm.startBroadcast();

        TycoonUserRegistry registry = new TycoonUserRegistry(proxy, rewardsFaucet, owner);
        console.log("TycoonUserRegistry:", address(registry));

        TycoonUpgradeable(payable(proxy)).setUserRegistry(address(registry));
        console.log("setUserRegistry on proxy done");

        registry.setOperator(operatorAddress);
        console.log("setOperator:", operatorAddress);

        registry.setWithdrawalAuthority(withdrawalAuthorityAddress);
        console.log("setWithdrawalAuthority:", withdrawalAuthorityAddress);

        if (nairaVaultAddress != address(0)) {
            registry.setNairaVault(nairaVaultAddress);
            console.log("setNairaVault:", nairaVaultAddress);
        }

        if (dailyCapUsd6 > 0 && priceCeloUsd6 > 0) {
            registry.setDefaultDailyCap(dailyCapUsd6, priceCeloUsd6);
            console.log("setDefaultDailyCap: cap (USD 6dec)", dailyCapUsd6, "price CELO (6dec)", priceCeloUsd6);
        }

        vm.stopBroadcast();

        console.log("---");
        console.log("Set in backend .env: TYCOON_USER_REGISTRY_CELO=", address(registry));
        console.log("Set in frontend .env: NEXT_PUBLIC_CELO_USER_REGISTRY=", address(registry));
    }
}
