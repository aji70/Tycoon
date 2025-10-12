use starknet::ContractAddress;
// define the interface
#[starknet::interface]
pub trait IMovement<T> {
    // fn roll_dice(ref self: T) -> (u8, u8);
    fn move_player(ref self: T, game_id: u256, steps: u8) -> u8;
    fn pay_jail_fine(ref self: T, game_id: u256) -> bool;
    fn use_getout_of_jail_chance(ref self: T, game_id: u256) -> bool;
    fn use_getout_of_jail_community_chest(ref self: T, game_id: u256) -> bool;

    fn current_player(self: @T, game_id: u256) -> ContractAddress;
    fn current_playername(self: @T, game_id: u256) -> felt252;

    fn process_community_chest_card(ref self: T, game_id: u256, card: ByteArray) -> bool;

    fn process_chance_card(ref self: T, game_id: u256, card: ByteArray) -> bool;

    fn pay_tax(ref self: T, tax_id: u8, game_id: u256) -> bool;
}

// dojo decorator
#[dojo::contract]
pub mod movement {
    use blockopoly::model::game_model::{Game, GameStatus};
    use blockopoly::model::game_player_model::{GamePlayer, GamePlayerTrait};
    use blockopoly::model::player_model::AddressToUsername;
    use blockopoly::model::property_model::{Property, PropertyTrait, PropertyType};

    // use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use starknet::{ContractAddress, contract_address_const, get_caller_address};

    // #[derive(Copy, Drop, Serde)]
    // #[dojo::event]
    // pub struct PlayerCreated {
    //     #[key]
    //     pub username: felt252,
    //     #[key]
    //     pub player: ContractAddress,
    //     pub timestamp: u64,
    // }

    #[abi(embed_v0)]
    impl MovementImpl of super::IMovement<ContractState> {
        fn move_player(ref self: ContractState, game_id: u256, steps: u8) -> u8 {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let mut game_player: GamePlayer = world.read_model((caller, game_id));
            assert(!game_player.rolled_dice, 'you have moved');
            let mut game: Game = world.read_model(game_id);

            assert!(game.next_player == caller, "Not your turn");
            assert!(game.status == GameStatus::Ongoing, "Game is not ongoing");

            // Handle jailed players
            if game_player.jailed {
                game_player.jail_turns += 1;

                if game_player.jail_turns > 3 {
                    // Automatically release player after 3 turns
                    game_player.jailed = false;
                    game_player.jail_turns = 0;
                } else {
                    // Still in jail, no move
                    world.write_model(@game_player);
                    return game_player.position;
                }
            }

            // Move player
            game_player = GamePlayerTrait::move(game_player, steps);
            game_player.dice_rolled = steps;

            // Passed or landed on Go
            if game_player.position >= 40 {
                game_player.position %= 40;
                game_player.balance += 200;
            }

            // Go To Jail logic
            if game_player.position == 30 {
                game_player.position = 10;
                game_player.jailed = true;
                game_player.jail_turns = 0;

                world.write_model(@game_player);
                world.write_model(@game);
                return game_player.position;
            }

            // Landing on a property
            let mut property: Property = world.read_model((game_player.position, game_id));

            // Determine rent status
            if property.owner != caller {
                game_player.paid_rent = false;
            }

            if property.owner == contract_address_const::<0>() {
                game_player.paid_rent = true;
            }

            if (property.property_type == PropertyType::Tax
                || property.property_type == PropertyType::CommunityChest
                || property.property_type == PropertyType::Chance) {
                game_player.paid_rent = false;
            }

            game_player.rolled_dice = true;

            // Update state
            world.write_model(@game_player);
            world.write_model(@game);
            world.write_model(@property);

            game_player.position
        }


        fn use_getout_of_jail_chance(ref self: ContractState, game_id: u256) -> bool {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let mut player: GamePlayer = world.read_model((caller, game_id));
            let mut game: Game = world.read_model(game_id);
            assert(player.chance_jail_card, 'No chance card');
            assert(player.jailed, 'Not in jail');
            assert(game.status == GameStatus::Ongoing, 'Game not started');
            // Use the card
            player.chance_jail_card = false;
            player.jailed = false;
            player.jail_turns = 0;
            world.write_model(@game);
            world.write_model(@player);
            true
        }

        fn use_getout_of_jail_community_chest(ref self: ContractState, game_id: u256) -> bool {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let mut player: GamePlayer = world.read_model((caller, game_id));
            let mut game: Game = world.read_model(game_id);
            assert(player.comm_free_card, 'No community chest card');
            assert(player.jailed, 'Not in jail');
            assert(game.status == GameStatus::Ongoing, 'Game not started');
            // Use the card
            player.comm_free_card = false;
            player.jailed = false;
            player.jail_turns = 0;
            world.write_model(@game);
            world.write_model(@player);
            true
        }


        fn pay_jail_fine(ref self: ContractState, game_id: u256) -> bool {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let mut player: GamePlayer = world.read_model((caller, game_id));
            let mut game: Game = world.read_model(game_id);

            assert(game.status == GameStatus::Ongoing, 'Game not started');
            assert(player.jailed, 'Not in jail');

            // Pay the fine
            let fine_amount: u256 = 50;
            assert(player.balance >= fine_amount, 'Insufficient funds to pay fine');

            player.balance -= fine_amount;
            player.jailed = false;
            player.jail_turns = 0;

            world.write_model(@game);
            world.write_model(@player);

            true
        }

        fn pay_tax(ref self: ContractState, tax_id: u8, game_id: u256) -> bool {
            let mut world = self.world_default();

            // Read models
            let caller = get_caller_address();
            let mut player: GamePlayer = world.read_model((caller, game_id));
            let game: Game = world.read_model(game_id);
            let property: Property = world.read_model((player.position, game_id));

            assert!(player.position == 4 || player.position == 38);
            assert!(tax_id == player.position);
            // Apply tax based on player position
            if player.position == 4 {
                assert!(player.balance >= 200);
                player.balance -= 200;
            }

            if player.position == 38 {
                assert!(player.balance >= 100);
                player.balance -= 100;
            }

            player.paid_rent = true;

            // Write updated player model back to the world
            world.write_model(@player);
            world.write_model(@game);
            world.write_model(@property);

            true
        }


        fn process_community_chest_card(
            ref self: ContractState, game_id: u256, card: ByteArray,
        ) -> bool {
            let mut world = self.world_default();
            let mut player: GamePlayer = world.read_model((get_caller_address(), game_id));
            let mut game: Game = world.read_model(game_id);
            let mut property: Property = world.read_model((player.position, game_id));
            assert(
                property.property_type == PropertyType::CommunityChest, 'not on community chest',
            );
            if card == "Advance to Go (Collect $200)" {
                player.position = 0;
                player.balance += 200;
            } else if card == "Bank error in your favor - Collect $200" {
                player.balance += 200;
            } else if card == "Doctor fee - Pay $50" {
                player.balance -= 50;
            } else if card == "From sale of stock - collect $50" {
                player.balance += 50;
            } else if card == "Get Out of Jail Free" {
                player.comm_free_card = true;
            } else if card == "Go to Jail" {
                player.position = 10; // jail position
                player.jailed = true;
            } else if card == "Grand Opera Night - collect $50 from every player" {
                let mut i = 0;
                while i < game.game_players.len() {
                    let addr = *game.game_players[i];
                    if addr != player.address {
                        let mut other_player: GamePlayer = world.read_model((addr, game.id));
                        other_player.balance -= 50;
                        player.balance += 50;
                        world.write_model(@other_player);
                    }
                    i += 1;
                };
            } else if card == "Holiday Fund matures - Receive $100" {
                player.balance += 100;
            } else if card == "Income tax refund - Collect $20" {
                player.balance += 20;
            } else if card == "Life insurance matures - Collect $100" {
                player.balance += 100;
            } else if card == "Pay hospital fees of $100" {
                player.balance -= 100;
            } else if card == "Pay school fees of $150" {
                player.balance -= 150;
            } else if card == "Receive $25 consultancy fee" {
                player.balance += 25;
            } else if card == "Street repairs - $40 per house, $115 per hotel" {
                let houses = player.total_houses_owned;
                let hotels = player.total_hotels_owned;
                let cost = (40 * houses) + (115 * hotels);
                player.balance -= cost.into();
            } else if card == "Won second prize in beauty contest - Collect $10" {
                player.balance += 10;
            } else if card == "You inherit $100" {
                player.balance += 100;
            }

            player.paid_rent = true;

            // game = self.finish_turn(game);
            world.write_model(@player);
            world.write_model(@game);
            world.write_model(@property);
            true
        }

        fn process_chance_card(ref self: ContractState, game_id: u256, card: ByteArray) -> bool {
            // We'll decode by matching text.
            // NOTE: If you have enums or ids for cards, it's cleaner. With ByteArray, compare
            // strings.
            let mut world = self.world_default();
            let mut player: GamePlayer = world.read_model((get_caller_address(), game_id));
            let mut game: Game = world.read_model(game_id);
            let mut property: Property = world.read_model((player.position, game_id));
            assert(property.property_type == PropertyType::Chance, 'not on chance');
            if card == "Advance to Go (Collect $200)" {
                player.position = 0;
                player.balance += 200;
            } else if card == "Advance to MakerDAO Avenue - If you pass Go, collect $200" {
                if player.position > 24 { // suppose Illinois is tile 24
                    player.balance += 200;
                }
                player.position = 24;
            } else if card == "Advance to Arbitrium Avenue - If you pass Go, collect $200" {
                if player.position > 11 {
                    player.balance += 200;
                }
                player.position = 11;
            } else if card == "Advance token to nearest Utility. Pay 10x dice." {
                let mut pos: Array<u8> = array![];
                pos.append(12);
                pos.append(28);
                let utility_pos = self.find_nearest(player.position, pos);
                player.position = utility_pos;
                let rent: u256 = 10 * player.dice_rolled.into();
                player.balance -= rent;
            } else if card == "Advance token to nearest Railroad. Pay 2x rent." {
                let mut pos: Array<u8> = array![];
                pos.append(5);
                pos.append(15);
                pos.append(25);
                pos.append(35);
                let rail_pos = self.find_nearest(player.position, pos);
                player.position = rail_pos;
                let rail: Property = world.read_model((rail_pos, game.clone().id));
                let mut rail_owner: GamePlayer = world.read_model((rail.owner, game.id));
                let railroads = self.count_owner_railroadss(property.owner, property.game_id);
                let utilities = self.count_owner_utilitiess(property.owner, property.game_id);
                let mut rent_amount = PropertyTrait::get_rent_amount(
                    rail, railroads, utilities, player.dice_rolled.into(),
                );
                if (rail.owner == contract_address_const::<0>()) {
                    rent_amount = 0;
                }
                player.balance -= rent_amount;
                rail_owner.balance += rent_amount;

                world.write_model(@rail_owner);
            } else if card == "Bank pays you dividend of $50" {
                player.balance += 50;
            } else if card == "Get out of Jail Free" {
                player.chance_jail_card = true;
            } else if card == "Go Back 3 Spaces" {
                if player.position < 4 {
                    player.position = 39 - (4 - player.position);
                } else {
                    player.position -= 3;
                }
            } else if card == "Go to Jail" {
                player.position = 11; // suppose jail is tile 11
                player.jailed = true;
            } else if card == "Make general repairs - $25 house, $100 hotel" {
                let houses = player.total_houses_owned;
                let hotels = player.total_hotels_owned;
                let cost = (25 * houses) + (100 * hotels);
                player.balance -= cost.into();
            } else if card == "Pay poor tax of $15" {
                player.balance -= 15;
            } else if card == "Take a trip to IPFS Railroad" {
                if player.position > 5 {
                    player.balance += 200;
                }
                player.position = 5; // reading railroad
            } else if card == "Take a walk on the Bitcoin Lane" {
                player.position = 39;
            } else if card == "Speeding fine $200" {
                player.balance -= 200;
            } else if card == "Building loan matures - collect $150" {
                player.balance += 150;
            }

            player.paid_rent = true;
            // game = self.finish_turn(game);
            world.write_model(@player);
            world.write_model(@game);
            world.write_model(@property);

            true
        }

        fn current_player(self: @ContractState, game_id: u256) -> ContractAddress {
            let mut world = self.world_default();
            let game: Game = world.read_model(game_id);
            game.next_player
        }

        fn current_playername(self: @ContractState, game_id: u256) -> felt252 {
            let mut world = self.world_default();
            let game: Game = world.read_model(game_id);
            let player: AddressToUsername = world.read_model(game.next_player);
            player.username
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Use the default namespace "dojo_starter". This function is handy since the ByteArray
        /// can't be const.
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@"blockopoly")
        }

        fn count_owner_railroadss(
            ref self: ContractState, owner: ContractAddress, game_id: u256,
        ) -> u8 {
            let mut count = 0;
            let mut i = 1;
            while i < 41_u32 {
                let prop: Property = self.world_default().read_model((i, game_id));
                if prop.owner == owner && prop.property_type == PropertyType::RailRoad {
                    count += 1;
                }
                i += 1;
            };
            count
        }

        // Count how many utilities the owner has
        fn count_owner_utilitiess(
            ref self: ContractState, owner: ContractAddress, game_id: u256,
        ) -> u8 {
            let mut count = 0;
            let mut i = 1;
            while i < 41_u32 {
                let prop: Property = self.world_default().read_model((i, game_id));
                if prop.owner == owner && prop.property_type == PropertyType::Utility {
                    count += 1;
                }
                i += 1;
            };
            count
        }


        fn find_nearest(ref self: ContractState, player_pos: u8, utilities: Array<u8>) -> u8 {
            let board_size: u8 = 40;

            let mut nearest_pos: u8 = *utilities[0];
            let mut smallest_distance = if *utilities[0] >= player_pos {
                *utilities[0] - player_pos
            } else {
                board_size - (player_pos - *utilities[0])
            };

            let len = utilities.len();
            let mut i = 1;
            while i < len {
                let utility_pos = *utilities[i];
                let distance = if utility_pos >= player_pos {
                    utility_pos - player_pos
                } else {
                    board_size - (player_pos - utility_pos)
                };

                if distance < smallest_distance {
                    smallest_distance = distance;
                    nearest_pos = utility_pos;
                }
                i += 1;
            };

            nearest_pos
        }
    }
}

