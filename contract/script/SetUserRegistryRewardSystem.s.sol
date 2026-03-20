// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";

interface ITycoonUserRegistry {
    function setRewardSystem(address _rewardSystem) external;
}

interface IGameProxyReward {
    function rewardSystem() external view returns (address);
}

/// @title Point TycoonUserRegistry at the same reward system as the game (or an explicit address)
/// @notice Requires .env: TYCOON_USER_REGISTRY_ADDRESS, RPC_URL, PRIVATE_KEY (must be registry owner).
/// @dev Reward address resolution (app/backend use proxy.rewardSystem(), so proxy wins by default):
///   - If TYCOON_PROXY_ADDRESS is set: use proxy.rewardSystem() unless TYCOON_REGISTRY_REWARD_USE_ENV_ONLY=1.
///   - Else: require TYCOON_REWARD_SYSTEM in .env.
///   TYCOON_REGISTRY_REWARD_USE_ENV_ONLY=1 + TYCOON_REWARD_SYSTEM for rare cases (registry before proxy update).
contract SetUserRegistryRewardSystemScript is Script {
    function run() external {
        address registry = vm.envAddress("TYCOON_USER_REGISTRY_ADDRESS");

        address proxy = vm.envOr("TYCOON_PROXY_ADDRESS", address(0));
        bool useEnvOnly = vm.envOr("TYCOON_REGISTRY_REWARD_USE_ENV_ONLY", false);

        address reward;
        if (proxy != address(0) && !useEnvOnly) {
            reward = IGameProxyReward(proxy).rewardSystem();
            console.log("Using rewardSystem() from TYCOON_PROXY_ADDRESS (matches what the app uses)");
        } else {
            string memory explicitReward = vm.envOr("TYCOON_REWARD_SYSTEM", string(""));
            if (bytes(explicitReward).length == 0) {
                revert(
                    "Set TYCOON_PROXY_ADDRESS, or set TYCOON_REWARD_SYSTEM with TYCOON_REGISTRY_REWARD_USE_ENV_ONLY=1"
                );
            }
            reward = vm.parseAddress(explicitReward);
            console.log("Using TYCOON_REWARD_SYSTEM from env (TYCOON_REGISTRY_REWARD_USE_ENV_ONLY or no proxy in env)");
        }

        if (reward == address(0)) {
            revert("Reward system address is zero; fix proxy.rewardSystem() or TYCOON_REWARD_SYSTEM");
        }

        vm.startBroadcast();
        ITycoonUserRegistry(registry).setRewardSystem(reward);
        vm.stopBroadcast();

        console.log("TycoonUserRegistry.setRewardSystem done");
        console.log("  registry:", registry);
        console.log("  reward:  ", reward);
        console.log("Next: users with old smart wallets should recreate from Profile so wallet.rewardSystem matches.");
    }
}
