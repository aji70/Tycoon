use starknet::ContractAddress;


#[derive(Drop, Serde, PartialEq, starknet::Store)]
pub struct UserProfile {
    pub tag: felt252,
    pub owner: ContractAddress,
    pub user_wallet: ContractAddress,
    pub exists: bool,
}

#[starknet::interface]
pub trait IPayCrypt<TContractState> {
    /// Registers a new tag and deploys a wallet for the user.
    /// @param tag The unique identifier for the user.
    /// @return The address of the deployed wallet.
    fn register_tag(ref self: TContractState, tag: felt252) -> ContractAddress;

    /// Deposits tokens to a user's wallet associated with a tag.
    /// @param tag The unique identifier for the user.
    /// @param amount The amount of tokens to deposit.
    /// @param token The address of the token contract.
    fn deposit_to_tag(ref self: TContractState, tag: felt252, amount: u256, token: ContractAddress);

    /// Retrieves the wallet address associated with a tag.
    /// @param tag The unique identifier for the user.
    /// @return The wallet address associated with the tag.
    fn get_tag_wallet_address(self: @TContractState, tag: felt252) -> ContractAddress;

    /// Retrieves the token balance of a user's wallet associated with a tag.
    /// @param tag The unique identifier for the user.
    /// @param token The address of the token contract.
    /// @return The balance of the specified token in the user's wallet.
    fn get_tag_wallet_balance(self: @TContractState, tag: felt252, token: ContractAddress) -> u256;

    /// Retrieves the token balance of the contract.
    /// @param token The address of the token contract.
    /// @return The balance of the specified token in the contract.
    fn get_contract_token_balance(self: @TContractState, token: ContractAddress) -> u256;

    /// Withdraws tokens from a user's wallet associated with a tag.
    /// @param token The address of the token contract.
    /// @param tag The unique identifier for the user.
    /// @param recipient_address The address to receive the withdrawn tokens.
    /// @param amount The amount of tokens to withdraw.
    fn withdraw_from_wallet(
        ref self: TContractState,
        token: ContractAddress,
        tag: felt252,
        recipient_address: ContractAddress,
        amount: u256,
    );

    /// Withdraws tokens from the contract (admin only).
    /// @param token The address of the token contract.
    /// @param recipient_address The address to receive the withdrawn tokens.
    /// @param amount The amount of tokens to withdraw.
    /// @return True if the withdrawal is successful.
    fn withdraw(
        ref self: TContractState,
        token: ContractAddress,
        recipient_address: ContractAddress,
        amount: u256,
    ) -> bool;

    /// Retrieves the user profile associated with a tag.
    /// @param tag The unique identifier for the user.
    /// @return The user profile associated with the tag.
    fn get_user_profile(self: @TContractState, tag: felt252) -> UserProfile;

    /// Retrieves the admin address of the contract.
    /// @return The address of the contract admin.
    fn get_admin_address(self: @TContractState) -> ContractAddress;

    /// Sets the token address for a given key (admin only).
    /// @param token_key The key identifying the token (e.g., 'STRK', 'USDC').
    /// @param token_address The address of the token contract.
    fn set_token_address(
        ref self: TContractState, token_key: felt252, token_address: ContractAddress,
    );
}

#[starknet::contract]
pub mod PayCrypt {
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use staknet::contracts::wallet::{IWalletDispatcher, IWalletDispatcherTrait};
    use starknet::class_hash::ClassHash;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::syscalls::deploy_syscall;
    use starknet::{
        ContractAddress, SyscallResultTrait, contract_address_const, get_block_timestamp,
        get_caller_address, get_contract_address,
    };
    use super::UserProfile;

    #[storage]
    struct Storage {
        is_tag_registered: Map<felt252, bool>,
        admin_address: ContractAddress,
        wallet_class_hash: ClassHash,
        user_profiles: Map<felt252, UserProfile>,
        token_addresses: Map<felt252, ContractAddress>,
        reentrancy_guard: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        TagRegistered: TagRegistered,
        DepositReceived: DepositReceived,
        WithdrawalCompleted: WithdrawalCompleted,
        TokenAddressUpdated: TokenAddressUpdated,
    }

    #[derive(Drop, starknet::Event)]
    struct TagRegistered {
        tag: felt252,
        wallet_address: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct DepositReceived {
        tag: felt252,
        sender: ContractAddress,
        amount: u256,
        token: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct WithdrawalCompleted {
        sender: ContractAddress,
        amount: u256,
        token: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct TokenAddressUpdated {
        token_key: felt252,
        token_address: ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState, admin_address: ContractAddress, wallet_class_hash: ClassHash,
    ) {
        let zero_address: ContractAddress = contract_address_const::<'0x0'>();
        assert(admin_address != zero_address, 'Invalid admin address');
        self.admin_address.write(admin_address);
        self.wallet_class_hash.write(wallet_class_hash);
    }

    #[abi(embed_v0)]
    impl PayCryptImpl of super::IPayCrypt<ContractState> {
        /// Registers a new tag and deploys a wallet for the user.
        /// @param tag The unique identifier for the user.
        /// @return The address of the deployed wallet.
        fn register_tag(ref self: ContractState, tag: felt252) -> ContractAddress {
            let zero_address: ContractAddress = contract_address_const::<'0x0'>();
            assert(!self.reentrancy_guard.read(), 'Reentrancy detected');
            self.reentrancy_guard.write(true);

            let is_tag_registered = self.is_tag_registered.read(tag);
            assert(!is_tag_registered, 'Tag already taken');
            self.is_tag_registered.write(tag, true);

            let owner_address = get_caller_address();
            assert(owner_address != zero_address, 'Invalid owner address');

            let wallet_class_hash = self.wallet_class_hash.read();
            let strk_token_address = self.token_addresses.read('STRK');
            let usdc_token_address = self.token_addresses.read('USDC');
            assert(strk_token_address != zero_address, 'STRK address not set');
            assert(usdc_token_address != zero_address, 'USDC address not set');

            let mut wallet_constructor_calldata = array![
                owner_address.into(),
                get_contract_address().into(),
                usdc_token_address.into(),
                strk_token_address.into(),
            ];
            let salt: felt252 = get_block_timestamp().into();
            let (wallet_address, _) = deploy_syscall(
                wallet_class_hash, salt, wallet_constructor_calldata.span(), true,
            )
                .unwrap_syscall();
            assert(wallet_address != zero_address, 'Wallet deployment failed');

            let user_profile = UserProfile {
                tag, owner: owner_address, user_wallet: wallet_address, exists: true,
            };
            self.user_profiles.write(tag, user_profile);
            self.emit(TagRegistered { tag, wallet_address });

            self.reentrancy_guard.write(false);
            wallet_address
        }

        /// Deposits tokens to a user's wallet associated with a tag.
        /// @param tag The unique identifier for the user.
        /// @param amount The amount of tokens to deposit.
        /// @param token The address of the token contract.
        fn deposit_to_tag(
            ref self: ContractState, tag: felt252, amount: u256, token: ContractAddress,
        ) {
            let zero_address: ContractAddress = contract_address_const::<'0x0'>();
            assert(!self.reentrancy_guard.read(), 'Reentrancy detected');
            self.reentrancy_guard.write(true);

            assert(token != zero_address, 'Invalid token address');
            let user_profile = self.user_profiles.read(tag);
            assert(user_profile.exists, 'User profile does not exist');

            let sender_address = get_caller_address();
            assert(sender_address != zero_address, 'Invalid sender address');

            let erc20_dispatcher = IERC20Dispatcher { contract_address: token };
            let sender_balance = erc20_dispatcher.balance_of(sender_address);
            assert(sender_balance >= amount, 'Insufficient sender balance');

            let allowance = erc20_dispatcher.allowance(sender_address, get_contract_address());
            assert(allowance >= amount, 'Insufficient allowance');

            let success = erc20_dispatcher
                .transfer_from(sender_address, user_profile.user_wallet, amount);
            assert(success, 'Token transfer failed');

            self.emit(DepositReceived { tag, sender: sender_address, amount, token });
            self.reentrancy_guard.write(false);
        }

        /// Withdraws tokens from a user's wallet associated with a tag.
        /// @param token The address of the token contract.
        /// @param tag The unique identifier for the user.
        /// @param recipient_address The address to receive the withdrawn tokens.
        /// @param amount The amount of tokens to withdraw.
        fn withdraw_from_wallet(
            ref self: ContractState,
            token: ContractAddress,
            tag: felt252,
            recipient_address: ContractAddress,
            amount: u256,
        ) {
            let zero_address: ContractAddress = contract_address_const::<'0x0'>();
            assert(!self.reentrancy_guard.read(), 'Reentrancy detected');
            self.reentrancy_guard.write(true);

            assert(token != zero_address, 'Invalid token address');
            assert(recipient_address != zero_address, 'Invalid recipient address');
            assert(amount > 0, 'Amount must be positive');

            let user_profile = self.user_profiles.read(tag);
            assert(user_profile.exists, 'Tag not registered');
            let sender_address = get_caller_address();
            assert(sender_address == user_profile.owner, 'Unauthorized: Not profile owner');

            let wallet_dispatcher = IWalletDispatcher {
                contract_address: user_profile.user_wallet,
            };
            let wallet_balance = IERC20Dispatcher { contract_address: token }
                .balance_of(user_profile.user_wallet);
            assert(wallet_balance >= amount, 'Insufficient wallet balance');

            let success = wallet_dispatcher.withdraw(token, recipient_address, amount);
            assert(success, 'Wallet withdrawal failed');

            self.emit(WithdrawalCompleted { sender: sender_address, amount, token });
            self.reentrancy_guard.write(false);
        }

        /// Withdraws tokens from the contract (admin only).
        /// @param token The address of the token contract.
        /// @param recipient_address The address to receive the withdrawn tokens.
        /// @param amount The amount of tokens to withdraw.
        /// @return True if the withdrawal is successful.
        fn withdraw(
            ref self: ContractState,
            token: ContractAddress,
            recipient_address: ContractAddress,
            amount: u256,
        ) -> bool {
            let zero_address: ContractAddress = contract_address_const::<'0x0'>();
            assert(!self.reentrancy_guard.read(), 'Reentrancy detected');
            self.reentrancy_guard.write(true);

            assert(token != zero_address, 'Invalid token address');
            assert(recipient_address != zero_address, 'Invalid recipient address');
            assert(amount > 0, 'Amount must be positive');

            let sender_address = get_caller_address();
            let admin_address: ContractAddress = self.admin_address.read();
            assert(sender_address == admin_address, 'Unauthorized: Not admin');

            let erc20_dispatcher = IERC20Dispatcher { contract_address: token };
            let contract_balance = erc20_dispatcher.balance_of(get_contract_address());
            assert(contract_balance >= amount, 'Insufficient contract balance');

            let success = erc20_dispatcher.transfer(recipient_address, amount);
            assert(success, 'Token transfer failed');

            self.emit(WithdrawalCompleted { sender: sender_address, amount, token });
            self.reentrancy_guard.write(false);
            true
        }

        /// Sets the token address for a given key (admin only).
        /// @param token_key The key identifying the token (e.g., 'STRK', 'USDC').
        /// @param token_address The address of the token contract.
        fn set_token_address(
            ref self: ContractState, token_key: felt252, token_address: ContractAddress,
        ) {
            let zero_address: ContractAddress = contract_address_const::<'0x0'>();
            let sender_address = get_caller_address();
            let admin_address = self.admin_address.read();
            assert(sender_address == admin_address, 'Unauthorized: Not admin');
            assert(token_address != zero_address, 'Invalid token address');

            self.token_addresses.write(token_key, token_address);
            self.emit(TokenAddressUpdated { token_key, token_address });
        }

        /// Retrieves the wallet address associated with a tag.
        /// @param tag The unique identifier for the user.
        /// @return The wallet address associated with the tag.
        fn get_tag_wallet_address(self: @ContractState, tag: felt252) -> ContractAddress {
            let user_profile = self.user_profiles.read(tag);
            assert(user_profile.exists, 'User profile does not exist');
            user_profile.user_wallet
        }

        /// Retrieves the token balance of a user's wallet associated with a tag.
        /// @param tag The unique identifier for the user.
        /// @param token The address of the token contract.
        /// @return The balance of the specified token in the user's wallet.
        fn get_tag_wallet_balance(
            self: @ContractState, tag: felt252, token: ContractAddress,
        ) -> u256 {
            let zero_address: ContractAddress = contract_address_const::<'0x0'>();
            assert(token != zero_address, 'Invalid token address');
            let user_profile = self.user_profiles.read(tag);
            assert(user_profile.exists, 'User profile does not exist');

            let erc20_dispatcher = IERC20Dispatcher { contract_address: token };
            erc20_dispatcher.balance_of(user_profile.user_wallet)
        }

        /// Retrieves the token balance of the contract.
        /// @param token The address of the token contract.
        /// @return The balance of the specified token in the contract.
        fn get_contract_token_balance(self: @ContractState, token: ContractAddress) -> u256 {
            let zero_address: ContractAddress = contract_address_const::<'0x0'>();
            assert(token != zero_address, 'Invalid token address');
            let erc20_dispatcher = IERC20Dispatcher { contract_address: token };
            erc20_dispatcher.balance_of(get_contract_address())
        }

        /// Retrieves the user profile associated with a tag.
        /// @param tag The unique identifier for the user.
        /// @return The user profile associated with the tag.
        fn get_user_profile(self: @ContractState, tag: felt252) -> UserProfile {
            let user_profile = self.user_profiles.read(tag);
            assert(user_profile.exists, 'User profile does not exist');
            user_profile
        }

        /// Retrieves the admin address of the contract.
        /// @return The address of the contract admin.
        fn get_admin_address(self: @ContractState) -> ContractAddress {
            self.admin_address.read()
        }
    }
}

