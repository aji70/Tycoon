// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TycoonGameFaucet
/// @notice Single contract backing for property buys/transfers/sales and game turns. Backend calls this; faucet calls the game.
interface ITycoonGameFaucetTarget {
    function setPropertyStats(string calldata sellerUsername, string calldata buyerUsername) external;
    function setTurnCount(uint256 gameId, address player, uint256 count) external;
}

/// @title TycoonGameFaucet
/// @notice Handles property buying/transfer/sells and game turns that need contract backing. Set as gameFaucet on the game; only gameController (backend) can call record*.
contract TycoonGameFaucet is Ownable, ReentrancyGuard {
    address public gameContract;
    address public gameController;

    event PropertySaleRecorded(string indexed sellerUsername, string indexed buyerUsername);
    event TurnRecorded(uint256 indexed gameId, address indexed player, uint256 count);
    event GameContractUpdated(address indexed previous, address indexed newContract);
    event GameControllerUpdated(address indexed previous, address indexed newController);

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
}
