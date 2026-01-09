// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

library TycoonLib {
    // -------------------------
    // 📌 Enums
    // -------------------------

    enum GameStatus {
        Pending,
        Ongoing,
        Ended
    }

    enum GameType {
        PublicGame,
        PrivateGame
    }

    enum PlayerSymbol {
        Hat,
        Car,
        Dog,
        Thimble,
        Iron,
        Battleship,
        Boot,
        Wheelbarrow
    }

    // COLLECTIBLES: expanded burnable perks
    enum CollectiblePerk {
        NONE,
        EXTRA_TURN, // +extra turns
        JAIL_FREE, // Get out of jail free
        DOUBLE_RENT, // Next rent payment doubled
        ROLL_BOOST, // +bonus to dice roll
        CASH_TIERED, // In-game cash: uses CASH_TIERS
        TELEPORT, // Move to any property (no roll next turn)
        SHIELD, // Immune to rent/payments for 1-2 turns
        PROPERTY_DISCOUNT, // Next property purchase 30-50% off
        TAX_REFUND, // Instant cash from bank (tiered)
        ROLL_EXACT // Choose exact roll 2-12 once

    }

    // -------------------------
    // 📌 Structs
    // -------------------------

    struct User {
        uint256 id;
        string username;
        address playerAddress;
        uint64 registeredAt;
        uint256 gamesPlayed;
        uint256 gamesWon;
        uint256 gamesLost;
        uint256 totalStaked;
        uint256 totalEarned;
        uint256 totalWithdrawn;
        uint256 propertiesOwned;
    }

    struct GamePosition {
        address winner;
        address runnersup;
        address losers;
    }

    struct Game {
        uint256 id;
        string code;
        address creator;
        GameStatus status;
        address winner;
        uint8 numberOfPlayers;
        uint8 joinedPlayers;
        GameType mode;
        bool ai;
        uint256 stakePerPlayer;
        uint256 totalStaked; // Track total stakes for this game
        uint64 createdAt;
        uint64 endedAt;
    }

    struct GamePlayer {
        uint256 gameId;
        address playerAddress;
        uint256 balance;
        uint8 position;
        uint8 order;
        PlayerSymbol symbol;
        string username;
    }

    struct GameSettings {
        uint8 maxPlayers;
        bool auction;
        bool rentInPrison;
        bool mortgage;
        bool evenBuild;
        uint256 startingCash;
        string privateRoomCode; // Optional if private
    }

    struct Property {
        uint8 id;
        uint256 gameId;
        address owner;
    }

    // -------------------------
    // 📌 Constants (for use in library functions)
    // -------------------------

    uint256 internal constant BOARD_SIZE = 40; // Monopoly-style board
    uint256 internal constant STAKE_AMOUNT = 1 * 10 ** 18; // 1 token stake
    uint256 internal constant WINNER_REWARD_MULTIPLIER = 150; // 150% of stake as reward (1.5x)
    uint256 internal constant REWARD_DIVISOR = 100; // For percentage calculation (150 / 100 = 1.5)
    uint256 internal constant MIN_TURNS_FOR_BONUS = 40; // Minimum total turns for win bonus

    // -------------------------
    // 📌 String → Enum Helpers
    // -------------------------

    function stringToGameType(string memory g) internal pure returns (uint8) {
        bytes32 h = keccak256(bytes(g));
        if (h == keccak256("PUBLIC")) return uint8(GameType.PublicGame);
        if (h == keccak256("PRIVATE")) return uint8(GameType.PrivateGame);
        revert("Invalid game type");
    }

    function stringToPlayerSymbol(string memory s) internal pure returns (uint8) {
        bytes32 h = keccak256(bytes(s));
        if (h == keccak256("hat")) return uint8(PlayerSymbol.Hat);
        if (h == keccak256("car")) return uint8(PlayerSymbol.Car);
        if (h == keccak256("dog")) return uint8(PlayerSymbol.Dog);
        if (h == keccak256("thimble")) return uint8(PlayerSymbol.Thimble);
        if (h == keccak256("iron")) return uint8(PlayerSymbol.Iron);
        if (h == keccak256("battleship")) return uint8(PlayerSymbol.Battleship);
        if (h == keccak256("boot")) return uint8(PlayerSymbol.Boot);
        if (h == keccak256("wheelbarrow")) return uint8(PlayerSymbol.Wheelbarrow);
        revert("Invalid player symbol");
    }

    // -------------------------
    // 📌 Game Logic Helpers
    // -------------------------

    /**
     * @dev Calculates the winner reward.
     */
    function calculateReward(uint256 totalTurns) internal pure returns (uint256) {
        if (totalTurns >= MIN_TURNS_FOR_BONUS) {
            return (STAKE_AMOUNT * WINNER_REWARD_MULTIPLIER) / REWARD_DIVISOR;
        }
        return 0;
    }

    /**
     * @dev Checks if the game is in final phase (2 players left).
     */
    function isFinalPhase(uint8 joinedPlayers) internal pure returns (bool) {
        return joinedPlayers == 2;
    }

    function uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
