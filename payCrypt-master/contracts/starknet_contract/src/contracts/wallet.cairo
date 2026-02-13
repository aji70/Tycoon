use starknet::ContractAddress;

#[starknet::interface]
pub trait IWallet<ContractState> {
    /// Withdraws tokens from the wallet (only callable by the TagRouter contract).
    /// @param token The address of the token contract.
    /// @param recipient_address The address to receive the withdrawn tokens.
    /// @param amount The amount of tokens to withdraw.
    /// @return True if the withdrawal is successful.
    fn withdraw(
        ref self: ContractState,
        token: ContractAddress,
        recipient_address: ContractAddress,
        amount: u256,
    ) -> bool;

    /// Retrieves the token balance of a specified address.
    /// @param token The address of the token contract.
    /// @param address The address to check the balance for.
    /// @return The balance of the specified token for the given address.
    fn check_balance(
        self: @ContractState, token: ContractAddress, address: ContractAddress,
    ) -> u256;

    /// Retrieves the owner address of the contract.
    /// @return The address of the contract owner.
    fn get_owner(self: @ContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod Wallet {
    use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use starknet::storage::{
        Map, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{
        ContractAddress, contract_address_const, get_caller_address, get_contract_address,
    };
    use super::IWallet;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        tag_router: ContractAddress,
        token_addresses: Map<felt252, ContractAddress>,
        reentrancy_guard: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        DepositSuccessful: DepositSuccessful,
        WithdrawalCompleted: WithdrawalCompleted,
    }

    #[derive(Drop, starknet::Event)]
    struct DepositSuccessful {
        sender: ContractAddress,
        token: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct WithdrawalCompleted {
        sender: ContractAddress,
        token: ContractAddress,
        amount: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        tag_router: ContractAddress,
        usdc_address: ContractAddress,
        strk_address: ContractAddress,
    ) {
        let zero_address: ContractAddress = contract_address_const::<'0x0'>();
        assert(owner != zero_address, 'Invalid owner address');
        assert(tag_router != zero_address, 'Invalid tag router address');
        assert(usdc_address != zero_address, 'Invalid USDC address');
        assert(strk_address != zero_address, 'Invalid STRK address');
        self.owner.write(owner);
        self.tag_router.write(tag_router);
        self.token_addresses.write('USDC', usdc_address);
        self.token_addresses.write('STRK', strk_address);
    }

    #[abi(embed_v0)]
    impl WalletImpl of IWallet<ContractState> {
        /// Withdraws tokens from the wallet (only callable by the TagRouter contract).
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

            let caller = get_caller_address();
            let tag_router: ContractAddress = self.tag_router.read();
            assert(caller == tag_router, 'Unauthorized: Not TagRouter');

            let erc20_dispatcher = IERC20Dispatcher { contract_address: token };
            let contract_balance = erc20_dispatcher.balance_of(get_contract_address());
            assert(contract_balance >= amount, 'Insufficient contract balance');

            let success = erc20_dispatcher.transfer(recipient_address, amount);
            assert(success, 'Token transfer failed');

            self.emit(WithdrawalCompleted { sender: caller, token, amount });
            self.reentrancy_guard.write(false);
            true
        }

        /// Retrieves the token balance of a specified address.
        /// @param token The address of the token contract.
        /// @param address The address to check the balance for.
        /// @return The balance of the specified token for the given address.
        fn check_balance(
            self: @ContractState, token: ContractAddress, address: ContractAddress,
        ) -> u256 {
            let zero_address: ContractAddress = contract_address_const::<'0x0'>();
            assert(token != zero_address, 'Invalid token address');
            assert(address != zero_address, 'Invalid address');
            let erc20_dispatcher = IERC20Dispatcher { contract_address: token };
            erc20_dispatcher.balance_of(address)
        }

        /// Retrieves the owner address of the contract.
        /// @return The address of the contract owner.
        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }
    }
}
