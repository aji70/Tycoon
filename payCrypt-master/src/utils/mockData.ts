import { User, Transaction, Balance, Token, Chain } from '../types';

export const mockChains: Chain[] = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'ETH',
    rpc_url: 'https://mainnet.infura.io/v3/',
    block_explorer: 'https://etherscan.io',
    native_currency: 'ETH'
  },
  {
    id: 'starknet',
    name: 'Starknet',
    symbol: 'STRK',
    rpc_url: 'https://alpha-mainnet.starknet.io',
    block_explorer: 'https://starkscan.co',
    native_currency: 'STRK'
  },
  {
    id: 'base',
    name: 'Base',
    symbol: 'ETH',
    rpc_url: 'https://mainnet.base.org',
    block_explorer: 'https://basescan.org',
    native_currency: 'ETH'
  },
  {
    id: 'core',
    name: 'Core',
    symbol: 'CORE',
    rpc_url: 'https://rpc.coredao.org',
    block_explorer: 'https://scan.coredao.org',
    native_currency: 'CORE'
  }
];

export const mockTokens: Token[] = [
  {
    address: '0x0000000000000000000000000000000000000000',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    logo_url: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    chain: 'ethereum',
    price: 2450.0
  },
  {
    address: '0xA0b86a33E6415765b52957f0C6B4Cce0CdD9b9F2',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logo_url: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
    chain: 'ethereum',
    price: 1.0
  },
  {
    address: '0x0000000000000000000000000000000000000001',
    symbol: 'STRK',
    name: 'Starknet Token',
    decimals: 18,
    logo_url: 'https://cryptologos.cc/logos/starknet-strk-logo.png',
    chain: 'starknet',
    price: 0.75
  },
  {
    address: '0x0000000000000000000000000000000000000002',
    symbol: 'CORE',
    name: 'Core Token',
    decimals: 18,
    logo_url: 'https://cryptologos.cc/logos/core-core-logo.png',
    chain: 'core',
    price: 1.25
  }
];

export const mockUser: User = {
  id: '1',
  tag: 'llins',
  address: '0x742d35Cc6634C0532925a3b8D404FdDA8C6b8AC2',
  is_verified: true,
  created_at: '2024-01-15T10:30:00Z',
  totalDeposits: 15000,
  totalWithdrawals: 3500
};

export const mockBalances: Balance[] = [
  {
    token: 'ETH',
    symbol: 'ETH',
    amount: 2.5,
    usd_value: 6125.0,
    chain: 'ethereum'
  },
  {
    token: 'USDC',
    symbol: 'USDC',
    amount: 5000,
    usd_value: 5000.0,
    chain: 'ethereum'
  },
  {
    token: 'STRK',
    symbol: 'STRK',
    amount: 1500,
    usd_value: 1125.0,
    chain: 'starknet'
  },
  {
    token: 'CORE',
    symbol: 'CORE',
    amount: 800,
    usd_value: 1000.0,
    chain: 'core'
  }
];

export const mockTransactions: Transaction[] = [
  {
    id: '1',
    type: 'deposit',
    tag: 'llins',
    token: 'ETH',
    amount: 1.0,
    usd_value: 2450.0,
    status: 'completed',
    tx_hash: '0x123...abc',
    chain: 'ethereum',
    timestamp: '2024-01-20T14:30:00Z',
    from_address: '0x456...def'
  },
  {
    id: '2',
    type: 'withdrawal',
    tag: 'llins',
    token: 'USDC',
    amount: 500,
    usd_value: 500.0,
    status: 'pending',
    chain: 'ethereum',
    timestamp: '2024-01-20T13:15:00Z',
    to_address: '0x789...ghi'
  },
  {
    id: '3',
    type: 'swap',
    tag: 'llins',
    token: 'ETH',
    amount: 0.5,
    usd_value: 1225.0,
    status: 'completed',
    tx_hash: '0x321...cba',
    chain: 'ethereum',
    timestamp: '2024-01-20T12:00:00Z'
  }
];

export const getTransactionStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'text-emerald-600 bg-emerald-50';
    case 'pending':
      return 'text-amber-600 bg-amber-50';
    case 'failed':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
};

export const formatCurrency = (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const formatCrypto = (amount: number, symbol: string) => {
  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  })} ${symbol}`;
};