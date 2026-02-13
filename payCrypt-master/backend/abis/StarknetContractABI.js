export const mainABI = [
  {
    type: "impl",
    name: "PayCryptImpl",
    interface_name: "staknet::contracts::main::IPayCrypt",
  },
  {
    type: "struct",
    name: "core::integer::u256",
    members: [
      {
        name: "low",
        type: "core::integer::u128",
      },
      {
        name: "high",
        type: "core::integer::u128",
      },
    ],
  },
  {
    type: "enum",
    name: "core::bool",
    variants: [
      {
        name: "False",
        type: "()",
      },
      {
        name: "True",
        type: "()",
      },
    ],
  },
  {
    type: "struct",
    name: "staknet::contracts::main::UserProfile",
    members: [
      {
        name: "tag",
        type: "core::felt252",
      },
      {
        name: "owner",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "user_wallet",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "exists",
        type: "core::bool",
      },
    ],
  },
  {
    type: "interface",
    name: "staknet::contracts::main::IPayCrypt",
    items: [
      {
        type: "function",
        name: "register_tag",
        inputs: [
          {
            name: "tag",
            type: "core::felt252",
          },
        ],
        outputs: [
          {
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "deposit_to_tag",
        inputs: [
          {
            name: "tag",
            type: "core::felt252",
          },
          {
            name: "senders_tag",
            type: "core::felt252",
          },
          {
            name: "amount",
            type: "core::integer::u256",
          },
          {
            name: "token",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "get_tag_wallet_address",
        inputs: [
          {
            name: "tag",
            type: "core::felt252",
          },
        ],
        outputs: [
          {
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_tag_wallet_balance",
        inputs: [
          {
            name: "tag",
            type: "core::felt252",
          },
          {
            name: "token",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [
          {
            type: "core::integer::u256",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_contract_token_balance",
        inputs: [
          {
            name: "token",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [
          {
            type: "core::integer::u256",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "withdraw_from_wallet",
        inputs: [
          {
            name: "token",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "tag",
            type: "core::felt252",
          },
          {
            name: "recipient_address",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "amount",
            type: "core::integer::u256",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "withdraw",
        inputs: [
          {
            name: "token",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "recipient_address",
            type: "core::starknet::contract_address::ContractAddress",
          },
          {
            name: "amount",
            type: "core::integer::u256",
          },
        ],
        outputs: [
          {
            type: "core::bool",
          },
        ],
        state_mutability: "external",
      },
      {
        type: "function",
        name: "get_user_profile",
        inputs: [
          {
            name: "tag",
            type: "core::felt252",
          },
        ],
        outputs: [
          {
            type: "staknet::contracts::main::UserProfile",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "get_admin_address",
        inputs: [],
        outputs: [
          {
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        state_mutability: "view",
      },
      {
        type: "function",
        name: "set_token_address",
        inputs: [
          {
            name: "token_key",
            type: "core::felt252",
          },
          {
            name: "token_address",
            type: "core::starknet::contract_address::ContractAddress",
          },
        ],
        outputs: [],
        state_mutability: "external",
      },
    ],
  },
  {
    type: "constructor",
    name: "constructor",
    inputs: [
      {
        name: "admin_address",
        type: "core::starknet::contract_address::ContractAddress",
      },
      {
        name: "wallet_class_hash",
        type: "core::starknet::class_hash::ClassHash",
      },
    ],
  },
  {
    type: "event",
    name: "staknet::contracts::main::PayCrypt::TagRegistered",
    kind: "struct",
    members: [
      {
        name: "tag",
        type: "core::felt252",
        kind: "data",
      },
      {
        name: "wallet_address",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "staknet::contracts::main::PayCrypt::DepositReceived",
    kind: "struct",
    members: [
      {
        name: "sender",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
      {
        name: "recipient",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
      {
        name: "amount",
        type: "core::integer::u256",
        kind: "data",
      },
      {
        name: "token",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "staknet::contracts::main::PayCrypt::WithdrawalCompleted",
    kind: "struct",
    members: [
      {
        name: "sender",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
      {
        name: "amount",
        type: "core::integer::u256",
        kind: "data",
      },
      {
        name: "token",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "staknet::contracts::main::PayCrypt::TokenAddressUpdated",
    kind: "struct",
    members: [
      {
        name: "token_key",
        type: "core::felt252",
        kind: "data",
      },
      {
        name: "token_address",
        type: "core::starknet::contract_address::ContractAddress",
        kind: "data",
      },
    ],
  },
  {
    type: "event",
    name: "staknet::contracts::main::PayCrypt::Event",
    kind: "enum",
    variants: [
      {
        name: "TagRegistered",
        type: "staknet::contracts::main::PayCrypt::TagRegistered",
        kind: "nested",
      },
      {
        name: "DepositReceived",
        type: "staknet::contracts::main::PayCrypt::DepositReceived",
        kind: "nested",
      },
      {
        name: "WithdrawalCompleted",
        type: "staknet::contracts::main::PayCrypt::WithdrawalCompleted",
        kind: "nested",
      },
      {
        name: "TokenAddressUpdated",
        type: "staknet::contracts::main::PayCrypt::TokenAddressUpdated",
        kind: "nested",
      },
    ],
  },
];
