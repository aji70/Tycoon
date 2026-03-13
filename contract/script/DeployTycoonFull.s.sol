// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {TycoonToken} from "../src/legacy/TycoonToken.sol";
import {TycoonRewardSystem} from "../src/TycoonRewardSystem.sol";
import {TycoonUpgradeable} from "../src/TycoonUpgradeable.sol";
import {TycoonUpgradeableLogic} from "../src/TycoonUpgradeableLogic.sol";
import {TycoonRewardsFaucet} from "../src/legacy/TycoonRewardsFaucet.sol";
import {TycoonGameFaucet} from "../src/legacy/TycoonGameFaucet.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title Deploy Tycoon stack — only deploys contracts whose address is not set in .env
/// @notice Set in .env: TYCOON_OWNER, USDC_ADDRESS. Optional (skip deploy if set): TYC_ADDRESS, TYCOON_REWARD_SYSTEM, TYCOON_PROXY_ADDRESS, TYCOON_REWARDS_FAUCET_ADDRESS, TYCOON_GAME_FAUCET_ADDRESS. Optional: GAME_CONTROLLER (defaults to owner).
/// @dev Broadcast with --private-key for TYCOON_OWNER so setLogicContract/setBackendMinter/setGameFaucet succeed.
contract DeployTycoonFullScript is Script {
    /// @return existing address from env, or address(0) if not set / empty (script will deploy)
    function _optAddress(string memory key) internal view returns (address) {
        if (!vm.envExists(key)) return address(0);
        string memory val = vm.envString(key);
        if (bytes(val).length == 0) return address(0);
        return vm.parseAddress(val);
    }

    function run() external {
        address owner = vm.envAddress("TYCOON_OWNER");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address gameController = vm.envOr("GAME_CONTROLLER", owner);

        address tycAddr = _optAddress("TYC_ADDRESS");
        address rewardSystemAddr = _optAddress("TYCOON_REWARD_SYSTEM");
        address proxyAddr = _optAddress("TYCOON_PROXY_ADDRESS");
        address rewardsFaucetAddr = _optAddress("TYCOON_REWARDS_FAUCET_ADDRESS");
        address gameFaucetAddr = _optAddress("TYCOON_GAME_FAUCET_ADDRESS");

        vm.startBroadcast();

        // 1. TycoonToken (TYC) — deploy only if TYC_ADDRESS not set
        if (tycAddr == address(0)) {
            TycoonToken tyc = new TycoonToken(owner);
            tycAddr = address(tyc);
            console.log("TycoonToken (TYC):", tycAddr);
        } else {
            console.log("TycoonToken (TYC): using existing", tycAddr);
        }

        // 2. TycoonRewardSystem — deploy only if TYCOON_REWARD_SYSTEM not set
        if (rewardSystemAddr == address(0)) {
            TycoonRewardSystem rewardSystem = new TycoonRewardSystem(tycAddr, usdc, owner);
            rewardSystemAddr = address(rewardSystem);
            console.log("TycoonRewardSystem:", rewardSystemAddr);
        } else {
            console.log("TycoonRewardSystem: using existing", rewardSystemAddr);
        }

        // 3–5. Logic, Impl, Proxy — deploy only if TYCOON_PROXY_ADDRESS not set
        if (proxyAddr == address(0)) {
            TycoonUpgradeableLogic logic = new TycoonUpgradeableLogic();
            console.log("TycoonUpgradeableLogic:", address(logic));

            TycoonUpgradeable impl = new TycoonUpgradeable();
            console.log("TycoonUpgradeable impl:", address(impl));

            bytes memory initData = abi.encodeCall(TycoonUpgradeable.initialize, (owner, rewardSystemAddr));
            ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
            proxyAddr = address(proxy);
            console.log("Game proxy (use this address):", proxyAddr);

            TycoonUpgradeable(payable(proxyAddr)).setLogicContract(address(logic));
            console.log("setLogicContract done");
        } else {
            console.log("Game proxy: using existing", proxyAddr);
        }

        // 6. TycoonRewardsFaucet — deploy only if TYCOON_REWARDS_FAUCET_ADDRESS not set
        if (rewardsFaucetAddr == address(0)) {
            TycoonRewardsFaucet rewardsFaucet = new TycoonRewardsFaucet(rewardSystemAddr, owner);
            rewardsFaucetAddr = address(rewardsFaucet);
            console.log("TycoonRewardsFaucet:", rewardsFaucetAddr);
            TycoonRewardSystem(payable(rewardSystemAddr)).setBackendMinter(rewardsFaucetAddr);
            console.log("setBackendMinter done");
        } else {
            console.log("TycoonRewardsFaucet: using existing", rewardsFaucetAddr);
        }

        // 7. TycoonGameFaucet — deploy only if TYCOON_GAME_FAUCET_ADDRESS not set
        if (gameFaucetAddr == address(0)) {
            TycoonGameFaucet gameFaucet = new TycoonGameFaucet(proxyAddr, gameController, owner);
            gameFaucetAddr = address(gameFaucet);
            console.log("TycoonGameFaucet:", gameFaucetAddr);
            TycoonUpgradeable(payable(proxyAddr)).setGameFaucet(gameFaucetAddr);
            TycoonUpgradeable(payable(proxyAddr)).setBackendGameController(gameController);
            console.log("setGameFaucet and setBackendGameController done");
        } else {
            console.log("TycoonGameFaucet: using existing", gameFaucetAddr);
        }

        vm.stopBroadcast();
    }
}
