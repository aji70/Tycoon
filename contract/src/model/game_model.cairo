use starknet::{ContractAddress, contract_address_const};

// Keeps track of the state of the game
#[derive(Serde, Copy, Drop, Introspect, PartialEq)]
#[dojo::model]
pub struct GameCounter {
    #[key]
    pub id: felt252,
    pub current_val: u256,
}

#[derive(Drop, Clone, Serde)]
#[dojo::model]
pub struct Game {
    #[key]
    pub id: u256, // Unique id of the game
    pub created_by: felt252, // Address of the game creator
    pub is_initialised: bool, // Indicate whether game with given Id has been created/initialised
    pub status: GameStatus, // Status of the game
    pub mode: GameType, // Mode of the game
    pub ready_to_start: bool, // Indicate whether game can be started
    pub winner: ContractAddress, // First winner position 
    pub next_player: ContractAddress, // Address of the player to make the next move
    pub number_of_players: u8, // Number of players in the game
    pub rolls_count: u256, // Sum of all the numbers rolled by the dice
    pub rolls_times: u256, // Total number of times the dice has been rolled
    pub dice_face: u8, // Last value of dice thrown
    pub player_chance: ContractAddress, // Next player to make move
    pub has_thrown_dice: bool, // Whether the dice has been thrown or not
    pub game_condition: Array<u32>,
    pub hat: felt252, // item on the board
    pub car: felt252, // item on the board
    pub dog: felt252, // item on the board
    pub thimble: felt252, // item on the board
    pub iron: felt252, // item on the board
    pub battleship: felt252, // item on the board
    pub boot: felt252, // item on the board
    pub wheelbarrow: felt252, // item on the board
    pub player_hat: felt252, // item use address on the board
    pub player_car: felt252, // item use address on the board
    pub player_dog: felt252, // item use address on the board
    pub player_thimble: felt252, // item use address on the board
    pub player_iron: felt252, // item use address on the board
    pub player_battleship: felt252, // item use address on the board
    pub player_boot: felt252, // item use address on the board
    pub player_wheelbarrow: felt252,
    pub players_joined: u8,
    pub game_players: Array<ContractAddress>,
    pub chance: Array<ByteArray>,
    pub community: Array<ByteArray>,
}

pub trait GameTrait {
    fn new(
        id: u256,
        created_by: felt252,
        game_type: GameType,
        player_hat: felt252,
        player_car: felt252,
        player_dog: felt252,
        player_thimble: felt252,
        player_iron: felt252,
        player_battleship: felt252,
        player_boot: felt252,
        player_wheelbarrow: felt252,
        number_of_players: u8,
        game_players: Array<ContractAddress>,
        chance: Array<ByteArray>,
        community: Array<ByteArray>,
    ) -> Game;
    fn restart(ref self: Game);
    fn terminate_game(ref self: Game);
}

// Represents the status of the game
#[derive(Serde, Copy, Drop, Introspect, PartialEq, Debug)]
pub enum GameStatus {
    Pending, // Waiting for players to join (in multiplayer mode)
    Ongoing, // Game is ongoing
    Ended // Game has ended
}

// Represents the game mode
#[derive(Serde, Copy, Drop, Introspect, PartialEq)]
pub enum GameType {
    PublicGame, // Play with computer
    PrivateGame // Play online with friends
}

// Conversion implementations for GameStatus
impl GameStatusIntoFelt252 of Into<GameStatus, felt252> {
    fn into(self: GameStatus) -> felt252 {
        match self {
            GameStatus::Pending => 'PENDING',
            GameStatus::Ongoing => 'ONGOING',
            GameStatus::Ended => 'ENDED',
        }
    }
}

impl Felt252TryIntoGameStatus of TryInto<felt252, GameStatus> {
    fn try_into(self: felt252) -> Option<GameStatus> {
        if self == 'PENDING' {
            Option::Some(GameStatus::Pending)
        } else if self == 'ONGOING' {
            Option::Some(GameStatus::Ongoing)
        } else if self == 'ENDED' {
            Option::Some(GameStatus::Ended)
        } else {
            Option::None
        }
    }
}

// Conversion implementations for GameType
impl GameTypeIntoFelt252 of Into<GameType, felt252> {
    fn into(self: GameType) -> felt252 {
        match self {
            GameType::PublicGame => 'PUBLICGAME',
            GameType::PrivateGame => 'PRIVATEGAME',
        }
    }
}

impl Felt252TryIntoGameType of TryInto<felt252, GameType> {
    fn try_into(self: felt252) -> Option<GameType> {
        if self == 'PUBLICGAME' {
            Option::Some(GameType::PublicGame)
        } else if self == 'PRIVATEGAME' {
            Option::Some(GameType::PrivateGame)
        } else {
            Option::None
        }
    }
}

// Trait for GameStatus utilities
#[generate_trait]
impl GameStatusImpl of GameStatusTrait {
    fn all() -> Array<GameStatus> {
        array![GameStatus::Pending, GameStatus::Ongoing, GameStatus::Ended]
    }

    fn can_transition_to(self: GameStatus, new_state: GameStatus) -> bool {
        match (self, new_state) {
            (GameStatus::Pending, GameStatus::Ongoing) => true,
            (GameStatus::Ongoing, GameStatus::Ended) => true,
            _ => false,
        }
    }

    fn is_active(self: GameStatus) -> bool {
        match self {
            GameStatus::Ongoing => true,
            _ => false,
        }
    }

    fn is_valid(status_felt: felt252) -> bool {
        let result: Option<GameStatus> = status_felt.try_into();
        result.is_some()
    }
}

// Trait for GameType utilities
#[generate_trait]
impl GameTypeImpl of GameTypeTrait {
    fn all() -> Array<GameType> {
        array![GameType::PublicGame, GameType::PrivateGame]
    }

    fn is_multiplayer(self: GameType) -> bool {
        match self {
            GameType::PrivateGame => true,
            GameType::PublicGame => false,
        }
    }

    fn is_valid(type_felt: felt252) -> bool {
        let result: Option<GameType> = type_felt.try_into();
        result.is_some()
    }
}

impl GameImpl of GameTrait {
    fn new(
        id: u256,
        created_by: felt252,
        game_type: GameType,
        player_hat: felt252,
        player_car: felt252,
        player_dog: felt252,
        player_thimble: felt252,
        player_iron: felt252,
        player_battleship: felt252,
        player_boot: felt252,
        player_wheelbarrow: felt252,
        number_of_players: u8,
        game_players: Array<ContractAddress>,
        chance: Array<ByteArray>,
        community: Array<ByteArray>,
    ) -> Game {
        let zero_address = contract_address_const::<0x0>();
        Game {
            id,
            created_by,
            is_initialised: true,
            status: GameStatus::Pending,
            mode: game_type,
            ready_to_start: false,
            player_hat,
            player_car,
            player_dog,
            player_thimble,
            player_iron,
            player_battleship,
            player_boot,
            player_wheelbarrow,
            next_player: zero_address.into(),
            winner: zero_address,
            rolls_times: 0,
            rolls_count: 0,
            number_of_players,
            dice_face: 0,
            player_chance: zero_address.into(),
            has_thrown_dice: false,
            game_condition: array![
                0_u32,
                0_u32,
                0_u32,
                0_u32,
                0_u32,
                0_u32,
                0_u32,
                0_u32,
                0_u32,
                0_u32,
                0_u32,
                0_u32,
                0_u32,
                0_u32,
                0_u32,
                0_u32,
            ],
            hat: 'hat',
            car: 'car',
            dog: 'dog',
            thimble: 'thimble',
            iron: 'iron',
            battleship: 'battleship',
            boot: 'boot',
            wheelbarrow: 'wheelbarrow',
            players_joined: 0,
            game_players,
            chance,
            community,
        }
    }

    fn restart(ref self: Game) {
        let zero_address = contract_address_const::<0x0>();
        self.next_player = zero_address.into();
        self.rolls_times = 0;
        self.rolls_count = 0;
        self.number_of_players = 0;
        self.dice_face = 0;
        self.player_chance = zero_address.into();
        self.has_thrown_dice = false;
    }

    fn terminate_game(ref self: Game) {
        self.status = GameStatus::Ended;
    }
}

// Test module for conversion logic
#[cfg(test)]
mod tests {
    use super::{GameStatus, GameStatusTrait, GameType, GameTypeTrait};

    #[test]
    fn test_game_status_conversion_roundtrip() {
        let all_statuses = GameStatusTrait::all();

        for i in 0..all_statuses.len() {
            let status = *all_statuses[i];
            let felt_val: felt252 = status.into();
            let converted_back: Option<GameStatus> = felt_val.try_into();

            assert(converted_back.is_some(), 'Status conversion should succeed');
            assert(converted_back.unwrap() == status, 'Should match original status');
        }
    }

    #[test]
    fn test_game_status_transitions() {
        assert!(
            GameStatusTrait::can_transition_to(GameStatus::Pending, GameStatus::Ongoing),
            'Pending should transition to Ongoing',
        );
        assert!(
            GameStatusTrait::can_transition_to(GameStatus::Ongoing, GameStatus::Ended),
            'Ongoing should transition to Ended',
        );
        assert!(
            !GameStatusTrait::can_transition_to(GameStatus::Ended, GameStatus::Ongoing),
            'Ended should not go back to Ongoing',
        );
    }

    #[test]
    fn test_game_status_active() {
        assert!(!GameStatusTrait::is_active(GameStatus::Pending), 'Pending should not be active');
        assert!(GameStatusTrait::is_active(GameStatus::Ongoing), 'Ongoing should be active');
        assert!(!GameStatusTrait::is_active(GameStatus::Ended), 'Ended should not be active');
    }

    #[test]
    fn test_game_type_conversion_roundtrip() {
        let all_types = GameTypeTrait::all();

        for i in 0..all_types.len() {
            let game_type = *all_types[i];
            let felt_val: felt252 = game_type.into();
            let converted_back: Option<GameType> = felt_val.try_into();

            assert(converted_back.is_some(), 'GameType conversion should succeed');
            assert(converted_back.unwrap() == game_type, 'Should match original game type');
        }
    }

    #[test]
    fn test_game_type_multiplayer() {
        assert!(
            !GameTypeTrait::is_multiplayer(GameType::PublicGame),
            'PublicGame should not be multiplayer',
        );
        assert!(
            GameTypeTrait::is_multiplayer(GameType::PrivateGame),
            'PrivateGame should be multiplayer',
        );
    }
}
