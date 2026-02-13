# PayCrypt: Decentralized Tag-Based Payment System

## Overview

**PayCrypt** is a Starknet-based smart contract system that enables secure, user-friendly cryptocurrency payments using human-readable tags instead of complex contract addresses. It consists of two contracts:

- **PayCrypt Contract**: The main router that manages user tags, deploys wallet contracts, and handles token deposits and withdrawals.
- **Wallet Contract**: A user-specific wallet deployed for each registered tag to store and manage tokens.

The system allows users to register unique tags (e.g., "alice"), receive tokens via these tags, and withdraw funds securely. It includes robust security features like reentrancy protection, zero-address validations, and balance checks, making it suitable for decentralized payment applications.

## Features

- **Tag Registration**: Users can register unique tags and deploy dedicated wallet contracts to receive tokens.
- **Token Deposits**: Anyone can deposit tokens (e.g., USDC, STRK) to a user’s wallet using their tag.
- **Withdrawals**: Users can withdraw tokens from their wallets, and the admin can withdraw from the PayCrypt contract.
- **Admin Controls**: The admin can set token addresses (e.g., USDC, STRK) and manage contract funds.
- **Security**:
  - Reentrancy guards to prevent recursive call attacks.
  - Zero-address checks using `contract_address_const::<'0x0'>()`.
  - Balance checks before transfers to ensure sufficient funds.
- **Event Logging**: Emits events for tag registration, deposits, withdrawals, and token address updates for transparency and auditability.

## Contracts

### 1. PayCrypt Contract

The `PayCrypt` contract serves as the central hub for tag-based payments, managing user profiles, deploying wallets, and handling token operations.

#### Key Functions

- **`register_tag(tag: felt252) -> ContractAddress`**:
  - Registers a unique tag and deploys a `Wallet` contract for the caller.
  - **Parameters**:
    - `tag`: A unique identifier (e.g., a short string as a `felt252`).
  - **Returns**: The address of the deployed wallet.
  - **Emits**: `TagRegistered { tag, wallet_address }`.

- **`deposit_to_tag(tag: felt252, amount: u256, token: ContractAddress)`**:
  - Deposits tokens to the wallet associated with the given tag.
  - **Parameters**:
    - `tag`: The recipient’s tag.
    - `amount`: The amount of tokens to deposit.
    - `token`: The token contract address (e.g., USDC or STRK).
  - **Emits**: `DepositReceived { tag, sender, amount, token }`.

- **`withdraw_from_wallet(token: ContractAddress, tag: felt252, recipient_address: ContractAddress, amount: u256)`**:
  - Withdraws tokens from the user’s wallet (callable only by the tag’s owner).
  - **Parameters**:
    - `token`: The token contract address.
    - `tag`: The user’s tag.
    - `recipient_address`: The destination address for the tokens.
    - `amount`: The amount to withdraw.
  - **Emits**: `WithdrawalCompleted { sender, amount, token }`.

- **`withdraw(token: ContractAddress, recipient_address: ContractAddress, amount: u256) -> bool`**:
  - Withdraws tokens from the PayCrypt contract (admin-only).
  - **Parameters**:
    - `token`: The token contract address.
    - `recipient_address`: The destination address.
    - `amount`: The amount to withdraw.
  - **Returns**: `true` if successful.
  - **Emits**: `WithdrawalCompleted { sender, amount, token }`.

- **`set_token_address(token_key: felt252, token_address: ContractAddress)`**:
  - Sets the address for a token (e.g., 'USDC' or 'STRK') (admin-only).
  - **Parameters**:
    - `token_key`: The token identifier (e.g., 'USDC').
    - `token_address`: The token contract address.
  - **Emits**: `TokenAddressUpdated { token_key, token_address }`.

- **`get_tag_wallet_address(tag: felt252) -> ContractAddress`**:
  - Retrieves the wallet address for a tag.
- **`get_tag_wallet_balance(tag: felt252, token: ContractAddress) -> u256`**:
  - Retrieves the token balance of a user’s wallet.
- **`get_contract_token_balance(token: ContractAddress) -> u256`**:
  - Retrieves the token balance of the PayCrypt contract.
- **`get_user_profile(tag: felt252) -> UserProfile`**:
  - Retrieves the user profile (`tag`, `owner`, `user_wallet`, `exists`).
- **`get_admin_address() -> ContractAddress`**:
  - Retrieves the admin address.

#### Storage

- `is_tag_registered`: Maps tags to a boolean indicating if they’re registered.
- `admin_address`: Stores the contract admin’s address.
- `wallet_class_hash`: Stores the class hash for deploying wallet contracts.
- `user_profiles`: Maps tags to `UserProfile` structs (`tag`, `owner`, `user_wallet`, `exists`).
- `token_addresses`: Maps token keys (e.g., 'USDC', 'STRK') to contract addresses.
- `reentrancy_guard`: Prevents reentrancy attacks.

#### Events

- `TagRegistered { tag, wallet_address }`
- `DepositReceived { tag, sender, amount, token }`
- `WithdrawalCompleted { sender, amount, token }`
- `TokenAddressUpdated { token_key, token_address }`

### 2. Wallet Contract

The `Wallet` contract is deployed by `PayCrypt` for each registered tag to manage a user’s tokens.

#### Key Functions

- **`withdraw(token: ContractAddress, recipient_address: ContractAddress, amount: u256) -> bool`**:
  - Withdraws tokens from the wallet (only callable by the `PayCrypt` contract).
  - **Parameters**:
    - `token`: The token contract address.
    - `recipient_address`: The destination address.
    - `amount`: The amount to withdraw.
  - **Returns**: `true` if successful.
  - **Emits**: `WithdrawalCompleted { sender, token, amount }`.

- **`check_balance(token: ContractAddress, address: ContractAddress) -> u256`**:
  - Retrieves the token balance of a specified address.
  - **Parameters**:
    - `token`: The token contract address.
    - `address`: The address to check.
  - **Returns**: The balance of the specified token.

- **`get_owner() -> ContractAddress`**:
  - Retrieves the wallet’s owner address.

#### Storage

- `owner`: The wallet’s owner address (set during deployment).
- `tag_router`: The `PayCrypt` contract address, restricting `withdraw` calls.
- `token_addresses`: Maps token keys (e.g., 'USDC', 'STRK') to contract addresses.
- `reentrancy_guard`: Prevents reentrancy attacks.

#### Events

- `DepositSuccessful { sender, token, amount }`: Defined but not emitted (for future deposit functionality).
- `WithdrawalCompleted { sender, token, amount }`: Emitted on successful withdrawals.

## Security Features

- **Reentrancy Protection**: Both contracts use a `reentrancy_guard` boolean to prevent recursive calls during external interactions (e.g., token transfers).
- **Zero-Address Checks**: All address inputs are validated against `contract_address_const::<'0x0'>()` to prevent invalid operations.
- **Balance Checks**: Ensures sufficient funds before transfers in `withdraw` (both contracts) and `withdraw_from_wallet` (PayCrypt).
- **Access Control**:
  - `PayCrypt.withdraw` is restricted to the admin.
  - `PayCrypt.withdraw_from_wallet` is restricted to the tag’s owner.
  - `Wallet.withdraw` is restricted to the `PayCrypt` contract.
- **Error Messages**: Descriptive errors (e.g., 'Unauthorized: Not admin', 'Insufficient contract balance') aid debugging.
- **Event Logging**: Comprehensive events ensure auditable operations.

## Usage Example

1. **Deploy PayCrypt Contract**:
   - Deploy with an admin address and the `Wallet` contract’s class hash.
   - Call `set_token_address` to configure `USDC` and `STRK` token addresses.

2. **Register a Tag**:
   - User calls `register_tag("alice")`, deploying a `Wallet` contract.
   - Returns the wallet address and emits `TagRegistered`.

3. **Deposit Tokens**:
   - Anyone calls `deposit_to_tag("alice", 100, usdc_address)` to send 100 USDC to Alice’s wallet.
   - Emits `DepositReceived`.

4. **Withdraw Tokens**:
   - Alice calls `withdraw_from_wallet(usdc_address, "alice", recipient_address, 50)` to withdraw 50 USDC.
   - Emits `WithdrawalCompleted`.
   - Admin calls `withdraw(usdc_address, recipient_address, 100)` to withdraw from the PayCrypt contract.
   - Emits `WithdrawalCompleted`.

5. **Query Balances**:
   - Use `get_tag_wallet_balance("alice", usdc_address)` to check Alice’s wallet balance.
   - Use `check_balance(usdc_address, wallet_address)` on the `Wallet` contract for the same.

## Deployment

1. **Dependencies** (in `Scarb.toml`):

   ```toml
   [package]
   name = "pay_crypt"
   version = "0.1.0"
   edition = "2023_10"

   [dependencies]
   starknet = "2.11.4"
   openzeppelin = "1.0.0"

   [cairo]
   sierra-replace-ids = true

   [[target.starknet-contract]]
   sierra = true
   casm = true
Steps
Compile Contracts:
Compile both the PayCrypt and Wallet contracts:
bash

scarb build

Declare Contracts:
Declare the contract classes on the Starknet network (e.g., Sepolia testnet):
bash

starknet declare --contract target/dev/pay_crypt_PayCrypt.sierra.json --network alpha-sepolia
starknet declare --contract target/dev/pay_crypt_Wallet.sierra.json --network alpha-sepolia

Note the returned class hashes for PayCrypt (pay_crypt_class_hash) and Wallet (wallet_class_hash).

Deploy PayCrypt Contract:
Deploy the PayCrypt contract with the admin address and Wallet class hash:
bash

starknet deploy --class-hash <pay_crypt_class_hash> --network alpha-sepolia --inputs <admin_address> <wallet_class_hash>

Replace <pay_crypt_class_hash> with the class hash from the declare step.

Replace <admin_address> with the admin’s Starknet address.

Replace <wallet_class_hash> with the Wallet class hash.

Note the deployed contract address (pay_crypt_address).

Set Token Addresses:
Configure the USDC and STRK token addresses using set_token_address (admin-only):
bash

starknet invoke --address <pay_crypt_address> --function set_token_address --network alpha-sepolia --inputs 'USDC' <usdc_address>
starknet invoke --address <pay_crypt_address> --function set_token_address --network alpha-sepolia --inputs 'STRK' <strk_address>

Replace <pay_crypt_address> with the deployed PayCrypt contract address.

Replace <usdc_address> and <strk_address> with the respective token contract addresses on the network.

Verify Deployment:
Confirm the PayCrypt contract is deployed and token addresses are set by calling get_admin_address and token_addresses.read('USDC')/token_addresses.read('STRK').

Testing Recommendations
Unit Tests:
Test register_tag for successful wallet deployment and tag uniqueness.

Test deposit_to_tag for valid/invalid tags, sufficient/insufficient balances, and allowances.

Test withdraw_from_wallet and withdraw for access control, balance checks, and reentrancy.

Test zero-address validations across all functions.

Test event emissions for correct data.

Integration Tests:
Simulate a full flow: deploy PayCrypt, set token addresses, register a tag, deposit tokens, withdraw from wallet, and withdraw from contract.

Verify Wallet contract interactions via PayCrypt.

Edge Cases:
Test with zero amounts, invalid tags, and unauthorized callers.

Attempt reentrancy attacks to confirm guard effectiveness.

Limitations and Future Improvements
Salt Predictability: PayCrypt.register_tag uses get_block_timestamp() as a salt, which may lead to collisions if multiple registrations occur in the same block. Consider a more unique salt if Starknet supports a suitable hash function.

Deposit Functionality in Wallet: The Wallet contract defines a DepositSuccessful event but lacks a deposit function. Adding one could enable direct deposits to wallets.

Admin Privileges: The admin has full control over contract funds. Consider multi-signature or timelock mechanisms for enhanced security.

Token Validation: Add checks to verify that token addresses are valid ERC20 contracts.

License
This project is licensed under the MIT License.

### Changes Made

1. **Deployment Section**:
   - Expanded the **Deployment** section to include complete steps for compiling, declaring, and deploying both the `PayCrypt` and `Wallet` contracts.
   - Added commands for declaring the contract classes (`starknet declare`) and deploying `PayCrypt` (`starknet deploy`).
   - Included detailed instructions for setting token addresses using `starknet invoke` for `set_token_address` with `USDC` and `STRK`.
   - Added a verification step to confirm deployment and token address configuration.

2. **Consistency with Previous README**:
   - Maintained all other sections (Overview, Features, Contracts, Security Features, Usage Example, Testing Recommendations, Limitations and Future Improvements, License) as provided in the previous README.
   - Ensured the contract name is consistently `PayCrypt` throughout, reflecting your renaming request.
   - Kept all function descriptions, storage details, events, and security features aligned with the updated `PayCrypt` and `Wallet` contracts (including zero-address checks with `contract_address_const::<'0x0'>()`, reentrancy guards, etc.).

3. **Assumptions**:
   - Assumed the `staknet` dependency is a custom dependency for `IWalletDispatcher`. The placeholder Git URL (`https://github.com/your-repo/staknet.git`) should be replaced with the actual source.
   - Assumed the Sepolia testnet (`alpha-sepolia`) for deployment examples, but you can replace it with your target network (e.g., mainnet or a local devnet).

### Notes
- **Renaming**: The README uses `PayCrypt` consistently, and the `Scarb.toml` example reflects `name = "pay_crypt"`. Ensure your code files are named `PayCrypt.cairo` and `Wallet.cairo`.
- **Deployment Commands**: The `starknet` CLI commands assume the use of a Starknet client like `starknet-rs` or a similar tool. Adjust the syntax if your environment uses a different CLI (e.g., `starkli`).
- **Testing**: The testing recommendations cover both unit and integration tests, aligning with the security features and functionality of the contracts.
- **Future Enhancements**: The Limitations section includes suggestions like a deposit function for `Wallet` or a more unique salt for `register_tag`, which can be implemented if desired.

If you need additional sections (e.g., detailed test scripts, example client code for interacting with the contracts), want to add a deposit function to `Wallet`, or need further customization of the README, please let me know!

Contract details
contract_address: 0x04e0b478713574f2f492e43b5249c032b57129c81c94d7dfea8cc483d533141e
transaction_hash: 0x031684698d7928bcc39d5ba0899d23d0a909551713f49cf847139cfa75e8d3fd

To see deployment details, visit:
contract: https://sepolia.starkscan.co/contract/0x04e0b478713574f2f492e43b5249c032b57129c81c94d7dfea8cc483d533141e
transaction: https://sepolia.starkscan.co/tx/0x031684698d7928bcc39d5ba0899d23d0a909551713f49cf847139cfa75e8d3fd