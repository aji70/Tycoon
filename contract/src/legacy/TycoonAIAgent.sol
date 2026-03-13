// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TycoonAIAgentRegistry
 * @notice Registers 8 AI agents with on-chain identities and tracks their stats
 * @dev ERC721Holder required because agents are minted to address(this) via _safeMint
 */
contract TycoonAIAgentRegistry is ERC721, ERC721Holder, Ownable {
    
    struct AIAgent {
        string name;              // "AI_1", "AI_2", etc.
        string playStyle;         // "Aggressive Builder", etc.
        uint8 difficultyLevel;    // 1=Beginner, 2=Intermediate, 3=Advanced
        address agentAddress;     // In-game address (e.g., address(2))
        bytes publicKey;          // Set by contract: address encoded as bytes, for verification (no manual input)
        uint64 registeredAt;
    }
    
    struct AgentStats {
        uint256 gamesPlayed;
        uint256 gamesWon;
        uint256 gamesLost;
        uint256 totalPropertiesBought;
        uint256 totalTradesProposed;
        uint256 totalTradesAccepted;
        uint256 totalBankruptcies;
        uint256 totalHousesBuilt;
        uint256 totalHotelsBuilt;
        uint256 cumulativeFinalBalance;
        uint256 longestWinStreak;
        uint256 currentWinStreak;
    }
    
    // Storage
    uint256 private _nextTokenId = 1;
    mapping(uint256 => AIAgent) public agents;
    mapping(uint256 => AgentStats) public agentStats;
    mapping(address => uint256) public addressToTokenId;
    uint256[] public registeredAgents;
    address public tycoonGameContract;
    /// @dev Optional: wallet allowed to call updateAgentStats from frontend/backend (e.g. backend wallet). address(0) = disabled.
    address public statsUpdater;

    // Events
    event AgentRegistered(uint256 indexed tokenId, string name, address indexed agentAddress);
    event StatsUpdated(uint256 indexed tokenId, uint256 gamesPlayed, uint256 gamesWon);
    
    constructor(address initialOwner) 
        ERC721("Tycoon AI Agent", "TYCAI") 
        Ownable(initialOwner) 
    {}
    
    /**
     * @notice Register an AI agent. Public key is set automatically from the agent address.
     */
    function registerAgent(
        string memory _name,
        string memory _playStyle,
        uint8 _difficultyLevel,
        address _agentAddress
    ) external onlyOwner returns (uint256) {
        require(_difficultyLevel >= 1 && _difficultyLevel <= 3, "Invalid difficulty");
        require(_agentAddress != address(0), "Invalid address");
        require(addressToTokenId[_agentAddress] == 0, "Already registered");
        require(_nextTokenId <= 8, "Max 8 agents");
        
        uint256 tokenId = _nextTokenId++;
        
        _safeMint(address(this), tokenId);
        
        agents[tokenId] = AIAgent({
            name: _name,
            playStyle: _playStyle,
            difficultyLevel: _difficultyLevel,
            agentAddress: _agentAddress,
            publicKey: abi.encodePacked(_agentAddress),  // contract sets it: address as bytes for verification
            registeredAt: uint64(block.timestamp)
        });
        
        addressToTokenId[_agentAddress] = tokenId;
        registeredAgents.push(tokenId);
        
        emit AgentRegistered(tokenId, _name, _agentAddress);
        return tokenId;
    }

    /**
     * @notice Set the authorized game contract (can call updateAgentStats)
     */
    function setGameContract(address _gameContract) external onlyOwner {
        require(_gameContract != address(0), "Invalid address");
        tycoonGameContract = _gameContract;
    }

    /**
     * @notice Set the stats updater (frontend/backend wallet). Only game contract or this address can call updateAgentStats.
     */
    function setStatsUpdater(address _updater) external onlyOwner {
        statsUpdater = _updater;
    }

    /**
     * @notice Update agent stats after a game (called by game contract or statsUpdater)
     */
    function updateAgentStats(
        address _agentAddress,
        bool _won,
        uint256 _finalBalance,
        uint256 _propertiesBought,
        uint256 _tradesProposed,
        uint256 _tradesAccepted,
        uint256 _housesBuilt,
        uint256 _hotelsBuilt,
        bool _wentBankrupt
    ) external {
        require(msg.sender == tycoonGameContract || msg.sender == statsUpdater, "Not game or updater");
        
        uint256 tokenId = addressToTokenId[_agentAddress];
        require(tokenId != 0, "Agent not registered");
        
        AgentStats storage stats = agentStats[tokenId];
        
        stats.gamesPlayed++;
        
        if (_won) {
            stats.gamesWon++;
            stats.currentWinStreak++;
            if (stats.currentWinStreak > stats.longestWinStreak) {
                stats.longestWinStreak = stats.currentWinStreak;
            }
        } else {
            stats.gamesLost++;
            stats.currentWinStreak = 0;
        }
        
        stats.totalPropertiesBought += _propertiesBought;
        stats.totalTradesProposed += _tradesProposed;
        stats.totalTradesAccepted += _tradesAccepted;
        stats.totalHousesBuilt += _housesBuilt;
        stats.totalHotelsBuilt += _hotelsBuilt;
        stats.cumulativeFinalBalance += _finalBalance;
        
        if (_wentBankrupt) {
            stats.totalBankruptcies++;
        }
        
        emit StatsUpdated(tokenId, stats.gamesPlayed, stats.gamesWon);
    }
    
    // View Functions
    
    function getAgent(uint256 _tokenId) external view returns (AIAgent memory) {
        require(_tokenId > 0 && _tokenId <= registeredAgents.length, "Invalid token");
        return agents[_tokenId];
    }
    
    function getAgentStats(uint256 _tokenId) external view returns (AgentStats memory) {
        require(_tokenId > 0 && _tokenId <= registeredAgents.length, "Invalid token");
        return agentStats[_tokenId];
    }
    
    function getAllAgents() external view returns (uint256[] memory) {
        return registeredAgents;
    }
    
    function getWinRate(uint256 _tokenId) external view returns (uint256) {
        AgentStats memory stats = agentStats[_tokenId];
        if (stats.gamesPlayed == 0) return 0;
        return (stats.gamesWon * 10000) / stats.gamesPlayed; // Returns percentage * 100 (e.g., 3500 = 35.00%)
    }
    
    function getAverageFinalBalance(uint256 _tokenId) external view returns (uint256) {
        AgentStats memory stats = agentStats[_tokenId];
        if (stats.gamesPlayed == 0) return 0;
        return stats.cumulativeFinalBalance / stats.gamesPlayed;
    }
    
    function isRegisteredAgent(address _agentAddress) external view returns (bool) {
        return addressToTokenId[_agentAddress] != 0;
    }

    /**
     * @notice Verify an agent on-chain: get tokenId, identity, and stats in one call.
     *         Returns zeros/empty if the address is not registered.
     */
    function verifyAgent(address _agentAddress)
        external
        view
        returns (uint256 tokenId, AIAgent memory agent, AgentStats memory stats)
    {
        tokenId = addressToTokenId[_agentAddress];
        if (tokenId == 0) return (0, agent, stats);
        agent = agents[tokenId];
        stats = agentStats[tokenId];
    }

    /**
     * @notice Get name and public key / address for verification forms.
     *         publicKey is always set by the contract (agent address encoded as bytes).
     * @return name Agent display name
     * @return agentAddress In-game address
     * @return publicKey Address as bytes (set automatically at registration)
     */
    function getVerificationData(address _agentAddress)
        external
        view
        returns (string memory name, address agentAddress, bytes memory publicKey)
    {
        uint256 tokenId = addressToTokenId[_agentAddress];
        require(tokenId != 0, "Agent not registered");
        AIAgent memory a = agents[tokenId];
        return (a.name, a.agentAddress, a.publicKey);
    }
}