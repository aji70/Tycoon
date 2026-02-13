export interface User {
  id: string;
  tag: string;
  address: string;
  is_verified: boolean;
  created_at: string;
  totalDeposits: number;
  totalWithdrawals: number;
}

export interface Balance {
  user_id: string;
  token: string;
  symbol: string;
  amount: number | string;
  usd_value: number | string;
  address: string;
  tag: string;
  user_email?: string;
  user_tag?: string;
}

export interface Transaction {
  id: string;
  reference: string;
  user_id: number;
  balance_id: number;
  chain_id: number;
  type: "deposit" | "withdrawal" | "swap" | "transfer";
  amount: number | string;
  usd_value: number | string;
  status: "pending" | "completed" | "failed";
  tx_hash?: string;
  timestamp?: string;
  from_address?: string;
  to_address?: string;
  description?: string;
  extra?: string;
  token_name?: string;
  token_logo_url?: string;
  token_symbol?: string;
  token_price?: string;
  chain_name?: string;
  chain_symbol?: string;
}

export interface SwapQuote {
  fromToken: string;
  toToken: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  priceImpact: number;
  gasEstimate: number;
}

export interface FiatPayout {
  id: string;
  tag: string;
  amount: number;
  currency: "NGN";
  provider: "paystack" | "monnify";
  status: "pending" | "processing" | "completed" | "failed";
  bankAccount: string;
  timestamp: string;
  requiresApproval?: boolean;
  approvedBy?: string;
  kycVerified?: boolean;
}

export interface Chain {
  id: string;
  name: string;
  symbol: string;
  rpc_url: string;
  block_explorer: string;
  native_currency: string;
}

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logo_url: string;
  chain: string;
  price: number;
}

export interface AuthUser {
  id: string;
  tag: string;
  email: string;
  address: string;
  is_verified: boolean;
  kyc_status: "none" | "pending" | "verified" | "rejected";
  created_at: string;
  last_login: string;
  role: "user" | "admin";
}

export interface KYCData {
  user_id: string;
  full_name: string;
  phone_number: string;
  bank_name: string;
  account_number: string;
  bvn?: string;
  id_document?: File;
  proof_of_address?: File;
  extra_document?: File;
  extra_content?: string;
}

export interface AdminStats {
  totalUsers: number;
  totalVolume: number;
  totalFees: number;
  activeUsers: number;
  pendingPayouts: number;
  dailyVolume: Array<{ date: string; volume: number }>;
  topUsers: Array<{ tag: string; volume: number; transactions: number }>;
}

export interface WebSocketMessage {
  type: "balance_update" | "transaction_update" | "system_alert";
  data: any;
  timestamp: string;
}
