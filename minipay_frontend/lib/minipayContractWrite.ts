'use client';

import { encodeFunctionData, type Abi, type Address, type Hash, type Hex } from 'viem';
import { MINIPAY_CONTRACT_GAS, MINIPAY_REGISTER_GAS } from '@/lib/celoTransportForWagmi';
import { ensureMiniPayWalletReady, isMiniPayEmbeddedWallet } from '@/lib/minipayGuestFlow';

/** 300_000 — ERC-20 approve / transfer */
export const MINIPAY_ERC20_GAS_HEX = '0x493E0' as const;

export const MINIPAY_CONTRACT_GAS_HEX = `0x${MINIPAY_CONTRACT_GAS.toString(16)}` as const;

export const MINIPAY_REGISTER_GAS_HEX = `0x${MINIPAY_REGISTER_GAS.toString(16)}` as const;

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getEthereum(): EthereumProvider | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { ethereum?: EthereumProvider }).ethereum;
}

/**
 * MiniPay: bypass viem/wagmi `prepareTransactionRequest` — Celo CIP-42 / `eth_estimateGas`
 * with Celo-specific params can RpcError on MiniPay's injected provider.
 * Raw `eth_sendTransaction` with explicit gas; MiniPay handles nonce, gas price, and signing.
 */
export async function minipayRawSendTransaction(
  to: Address,
  data: Hex,
  gasHex: string = MINIPAY_CONTRACT_GAS_HEX,
): Promise<Hash> {
  const eth = getEthereum();
  if (!eth?.request) throw new Error('Open Tycoon inside the MiniPay app.');

  // Must use eth_requestAccounts (not eth_accounts) — unauthorized `from` → 4100 permission denied.
  const accounts = await ensureMiniPayWalletReady();
  const from = accounts[0];
  if (!from) {
    throw new Error('MiniPay wallet not connected. Open this app from MiniPay and try again.');
  }

  const txHash = (await eth.request({
    method: 'eth_sendTransaction',
    params: [{ from, to, data, gas: gasHex }],
  })) as Hash | null;

  if (!txHash) {
    throw new Error('Transaction hash unavailable — purchase may not have gone through');
  }
  return txHash;
}

export type WriteContractAsyncFn = (args: {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
}) => Promise<Hash>;

export type MinipayContractWriteOptions = {
  to: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  gasHex?: string;
  writeContractAsync: WriteContractAsyncFn;
};

/** Encode with viem; send via raw MiniPay RPC or wagmi writeContract. */
export async function sendMinipayAwareContractTx(
  options: MinipayContractWriteOptions,
): Promise<Hash> {
  const {
    to,
    abi,
    functionName,
    args,
    gasHex = MINIPAY_CONTRACT_GAS_HEX,
    writeContractAsync,
  } = options;

  const data = encodeFunctionData({
    abi,
    functionName,
    args: args as never,
  });

  if (isMiniPayEmbeddedWallet()) {
    return minipayRawSendTransaction(to, data, gasHex);
  }

  return writeContractAsync({ address: to, abi, functionName, args });
}
