use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare,start_cheat_block_timestamp,
    start_cheat_caller_address, stop_cheat_caller_address,
};
use staknet::contracts::main::{IPayCryptDispatcher, IPayCryptDispatcherTrait};
use starknet::{ContractAddress, contract_address_const};


pub fn deploy_mock_erc20(name: ByteArray) -> IERC20Dispatcher {
    let admin: ContractAddress = contract_address_const::<'admin'>();
    let contract = declare("MyToken").unwrap().contract_class();
    let mut calldata = array![];
    let token_name: ByteArray = name.clone();
    let token_symbol: ByteArray = name.clone();

    token_name.serialize(ref calldata);
    token_symbol.serialize(ref calldata);
    admin.serialize(ref calldata);

    let (contract_address, _) = contract.deploy(@calldata).unwrap();

    IERC20Dispatcher { contract_address }
}

fn deploy_contract() -> (IPayCryptDispatcher, ContractAddress, ContractAddress) {
    let erc20 = deploy_mock_erc20("STRK");
    let usdc = deploy_mock_erc20("USDC");

    let strkaddress = erc20.contract_address;
    let usdcaddress = usdc.contract_address;

    let admin: ContractAddress = contract_address_const::<'admin'>();
    let wallet_classhash = declare("Wallet").unwrap().contract_class();
    let mut calldata = ArrayTrait::new();
    admin.serialize(ref calldata);
    wallet_classhash.serialize(ref calldata);
    let contract = declare("PayCrypt").unwrap().contract_class();
    let (contract_address, _) = contract.deploy(@calldata).unwrap();

    (IPayCryptDispatcher { contract_address }, strkaddress, usdcaddress)
}

#[test]
fn test_contract_deployment() {
    let admin: ContractAddress = contract_address_const::<'admin'>();
    let (dispatcher, _, _) = deploy_contract();
    let a = dispatcher.get_admin_address();
    assert(admin == a, 'Invalid admin');
}

#[test]
fn test_register_tag() {
    let (dispatcher, _, _) = deploy_contract();

    let tag: felt252 = 'collins';
    let collins_wallet = dispatcher.register_tag(tag);

    let collinsadd: felt252 = collins_wallet.into();

    println!("collins address : {}", collinsadd);

    let Collins = dispatcher.get_user_profile('collins');
    assert(Collins.user_wallet == collins_wallet, 'wrong balance');
    assert(Collins.exists, 'exists');
}

#[test]
fn test_deposit_to_tag() {
    let depositor: ContractAddress = contract_address_const::<'admin'>();

    // Deploy PayCrypt contract
    let (tag_router, token_dispatcher, _) = deploy_contract();
    let token = IERC20Dispatcher { contract_address: token_dispatcher };

    // Mint ERC20 tokens to the depositor
    start_cheat_caller_address(token_dispatcher, depositor);
    token.approve(tag_router.contract_address, 50000);
    stop_cheat_caller_address(depositor);

    // Register the "tag_owner" tag
    start_cheat_caller_address(tag_router.contract_address, depositor);
    let tag_wallet = tag_router.register_tag('tag_owner');
    stop_cheat_caller_address(depositor);

    // Check balances before deposit
    let tag_balance_before = token.balance_of(tag_wallet);
    println!("Tag wallet balance before: {}", tag_balance_before);

    let depositor_balance_before = token.balance_of(depositor);
    println!("Depositor balance before: {}", depositor_balance_before);

    // Depositor sends tokens to the tag wallet
    start_cheat_caller_address(tag_router.contract_address, depositor);
    tag_router.deposit_to_tag('tag_owner', 10000, token_dispatcher);
    stop_cheat_caller_address(depositor);

    // Check balances after deposit
    let tag_balance_after = token.balance_of(tag_wallet);
    println!("Tag wallet balance after: {}", tag_balance_after);

    let depositor_balance_after = token.balance_of(depositor);
    println!("Depositor balance after: {}", depositor_balance_after);

    assert!(tag_balance_before + 10000 == tag_balance_after, "Incorrect tag wallet balance");
}


#[test]
fn test_withdraw_from_tag() {
    let depositor: ContractAddress = contract_address_const::<'admin'>();

    // Deploy PayCrypt contract
    let (tag_router, token_dispatcher, _) = deploy_contract();
    let token = IERC20Dispatcher { contract_address: token_dispatcher };

    // Mint ERC20 tokens to the depositor
    start_cheat_caller_address(token_dispatcher, depositor);
    token.approve(tag_router.contract_address, 50000);
    stop_cheat_caller_address(depositor);

    // Register the "tag_owner" tag
    start_cheat_caller_address(tag_router.contract_address, depositor);
    let tag_wallet = tag_router.register_tag('tag_owner');
    stop_cheat_caller_address(depositor);

    // Check balances before deposit
    let tag_balance_before = token.balance_of(tag_wallet);
    println!("Tag wallet balance before: {}", tag_balance_before);

    let depositor_balance_before = token.balance_of(depositor);
    println!("Depositor balance before: {}", depositor_balance_before);

    // Depositor sends tokens to the tag wallet
    start_cheat_caller_address(tag_router.contract_address, depositor);
    tag_router.deposit_to_tag('tag_owner', 10000, token_dispatcher);
    stop_cheat_caller_address(depositor);

    // Check balances after deposit
    let tag_balance_after = token.balance_of(tag_wallet);
    println!("Tag wallet balance after: {}", tag_balance_after);

    let depositor_balance_after = token.balance_of(depositor);
    println!("Depositor balance after: {}", depositor_balance_after);

    assert!(tag_balance_before + 10000 == tag_balance_after, "Incorrect tag wallet balance");

    // Mint ERC20 tokens to the depositor
    start_cheat_caller_address(token_dispatcher, tag_wallet);
    token.approve(tag_router.contract_address, 50000);
    stop_cheat_caller_address(tag_wallet);

    start_cheat_caller_address(tag_router.contract_address, tag_router.contract_address);
    tag_router.withdraw_from_wallet(token_dispatcher, 'tag_owner',tag_router.contract_address, 3000);
    stop_cheat_caller_address(depositor);

    let tag_balance_after_withdraw = token.balance_of(tag_wallet);
    println!("Tag wallet balance after withdraw: {}", tag_balance_after_withdraw);

    let tag_router_balance_after_withdraw = token.balance_of(tag_router.contract_address);
    println!("Tag Router balance after withdraw: {}", tag_router_balance_after_withdraw);

    assert(tag_balance_after_withdraw == 7000, 'tag bal error');
    assert(tag_router_balance_after_withdraw == 3000, 'router bal error');
}

