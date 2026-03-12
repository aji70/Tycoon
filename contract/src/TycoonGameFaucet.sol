// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TycoonGameFaucet
/// @notice Single contract backing for property buys/transfers/sales, game turns, and AI agent stats. Backend calls this; faucet calls the game and optional agent registry.
interface ITycoonGameFaucetTarget {
    function setPropertyStats(string calldata sellerUsername, string calldata buyerUsername) external;
    function setTurnCount(uint256 gameId, address player, uint256 count) external;
}

interface IAgentRegistry {
    function updateAgentStats(
        address agentAddress,
        bool won,
        uint256 finalBalance,
        uint256 propertiesBought,
        uint256 tradesProposed,
        uint256 tradesAccepted,
        uint256 housesBuilt,
        uint256 hotelsBuilt,
        bool wentBankrupt
    ) external;
}

/// @title TycoonGameFaucet
/// @notice Handles property buying/transfer/sells and game turns that need contract backing. Set as gameFaucet on the game; only gameController (backend) can call record*.
contract TycoonGameFaucet is Ownable, ReentrancyGuard {
    address public gameContract;
    address public gameController;
    /// @notice Optional AI agent registry (TycoonAIAgentRegistry). When set, recordAgentStats forwards to it. Set registry's statsUpdater to this faucet.
    address public agentRegistry;

    event PropertySaleRecorded(string indexed sellerUsername, string indexed buyerUsername);
    event TurnRecorded(uint256 indexed gameId, address indexed player, uint256 count);
    event AgentStatsRecorded(address indexed agentAddress, bool won);
    event GameContractUpdated(address indexed previous, address indexed newContract);
    event GameControllerUpdated(address indexed previous, address indexed newController);
    event AgentRegistryUpdated(address indexed previous, address indexed newRegistry);

    error OnlyGameController();
    error InvalidGame();

    modifier onlyGameController() {
        if (msg.sender != gameController && msg.sender != owner()) revert OnlyGameController();
        _;
    }

    constructor(address _gameContract, address _gameController, address initialOwner) Ownable(initialOwner) {
        gameContract = _gameContract;
        gameController = _gameController;
    }

    function setGameContract(address _gameContract) external onlyOwner {
        address previous = gameContract;
        gameContract = _gameContract;
        emit GameContractUpdated(previous, _gameContract);
    }

    function setGameController(address _gameController) external onlyOwner {
        address previous = gameController;
        gameController = _gameController;
        emit GameControllerUpdated(previous, _gameController);
    }

    function setAgentRegistry(address _agentRegistry) external onlyOwner {
        address previous = agentRegistry;
        agentRegistry = _agentRegistry;
        emit AgentRegistryUpdated(previous, _agentRegistry);
    }

    /// @notice Record a property sale/transfer (seller -> buyer). Updates game User stats. Call from backend when a trade completes.
    function recordPropertySale(string calldata sellerUsername, string calldata buyerUsername)
        external
        onlyGameController
        nonReentrant
    {
        if (gameContract == address(0)) revert InvalidGame();
        ITycoonGameFaucetTarget(gameContract).setPropertyStats(sellerUsername, buyerUsername);
        emit PropertySaleRecorded(sellerUsername, buyerUsername);
    }

    /// @notice Record a game turn (e.g. player reached N turns). Updates game turnsPlayed for perk eligibility. Call from backend.
    function recordTurn(uint256 gameId, address player, uint256 count) external onlyGameController nonReentrant {
        if (gameContract == address(0)) revert InvalidGame();
        ITycoonGameFaucetTarget(gameContract).setTurnCount(gameId, player, count);
        emit TurnRecorded(gameId, player, count);
    }

    /// @notice Record AI agent stats after an AI game. Forwards to agent registry when set. Set registry's statsUpdater to this faucet. Call from backend/frontend after endAIGame.
    function recordAgentStats(
        address agentAddress,
        bool won,
        uint256 finalBalance,
        uint256 propertiesBought,
        uint256 tradesProposed,
        uint256 tradesAccepted,
        uint256 housesBuilt,
        uint256 hotelsBuilt,
        bool wentBankrupt
    ) external onlyGameController nonReentrant {
        if (agentRegistry == address(0)) return;
        IAgentRegistry(agentRegistry).updateAgentStats(
            agentAddress,
            won,
            finalBalance,
            propertiesBought,
            tradesProposed,
            tradesAccepted,
            housesBuilt,
            hotelsBuilt,
            wentBankrupt
        );
        emit AgentStatsRecorded(agentAddress, won);
    }
}
