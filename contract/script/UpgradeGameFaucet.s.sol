// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {TycoonUpgradeable} from "../src/TycoonUpgradeable.sol";
import {TycoonGameFaucet} from "../src/legacy/TycoonGameFaucet.sol";

/// @title Deploy new TycoonGameFaucet (agent recordPropertySaleByAgent) and point the game proxy at it.
/// @notice The game proxy (UUPS) does NOT need an impl upgrade for this — only setGameFaucet.
/// @dev Required .env: TYCOON_PROXY_ADDRESS, TYCOON_OWNER (broadcast key).
///      Optional: TYCOON_GAME_FAUCET_ADDRESS (old faucet; default read from proxy.gameFaucet()).
///      Optional: GAME_CONTROLLER (default copied from old faucet).
///      Optional: AGENT_WRITER_1 .. AGENT_WRITER_8 — authorized on the new faucet after deploy.
contract UpgradeGameFaucetScript is Script {
    function run() external {
        address owner = vm.envAddress("TYCOON_OWNER");
        address proxy = vm.envAddress("TYCOON_PROXY_ADDRESS");

        address oldFaucet = vm.envOr("TYCOON_GAME_FAUCET_ADDRESS", TycoonUpgradeable(payable(proxy)).gameFaucet());
        require(oldFaucet != address(0), "No game faucet (set TYCOON_GAME_FAUCET_ADDRESS)");

        TycoonGameFaucet oldContract = TycoonGameFaucet(payable(oldFaucet));
        address gameController = vm.envOr("GAME_CONTROLLER", oldContract.gameController());
        address agentRegistry = oldContract.agentRegistry();

        require(gameController != address(0), "gameController required");

        vm.startBroadcast();

        TycoonGameFaucet newFaucet = new TycoonGameFaucet(proxy, gameController, owner);
        console.log("Previous TycoonGameFaucet:", oldFaucet);
        console.log("New TycoonGameFaucet:", address(newFaucet));
        console.log("gameController:", gameController);

        if (agentRegistry != address(0)) {
            newFaucet.setAgentRegistry(agentRegistry);
            console.log("agentRegistry copied:", agentRegistry);
        }

        TycoonUpgradeable(payable(proxy)).setGameFaucet(address(newFaucet));
        console.log("setGameFaucet on proxy:", proxy);

        uint256 authorized;
        for (uint256 i = 1; i <= 8; i++) {
            address writer = _tryEnvWriter(i);
            if (writer == address(0)) continue;
            newFaucet.setAuthorizedAgentWriter(writer, true);
            console.log("authorizedAgentWriter:", writer);
            authorized++;
        }

        vm.stopBroadcast();

        console.log("--- Update backend .env ---");
        console.log("TYCOON_GAME_FAUCET_ADDRESS=", address(newFaucet));
        console.log("ENABLE_AGENT_SIGNED_PROPERTY_SALE=true");
        console.log("authorized writers:", authorized);
    }

    function _tryEnvWriter(uint256 index) internal view returns (address) {
        if (index == 1) return _tryEnvAddress("AGENT_WRITER_1");
        if (index == 2) return _tryEnvAddress("AGENT_WRITER_2");
        if (index == 3) return _tryEnvAddress("AGENT_WRITER_3");
        if (index == 4) return _tryEnvAddress("AGENT_WRITER_4");
        if (index == 5) return _tryEnvAddress("AGENT_WRITER_5");
        if (index == 6) return _tryEnvAddress("AGENT_WRITER_6");
        if (index == 7) return _tryEnvAddress("AGENT_WRITER_7");
        if (index == 8) return _tryEnvAddress("AGENT_WRITER_8");
        return address(0);
    }

    function _tryEnvAddress(string memory key) internal view returns (address) {
        try vm.envAddress(key) returns (address v) {
            return v;
        } catch {
            return address(0);
        }
    }
}
