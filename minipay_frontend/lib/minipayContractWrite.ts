'use client';

import { encodeFunctionData, type Abi, type Address, type Hash, type Hex } from 'viem';
import {
  CELO_USDM_FEE_TOKEN,
  MINIPAY_CONTRACT_GAS,
  MINIPAY_REGISTER_GAS,
} from '@/lib/celoTransportForWagmi';
import {
  getMiniPayAccountsForTx,
  getMiniPayEthereumProvider,
  shouldBypassViemForTx,
} from '@/lib/minipayGuestFlow';
import { isUserRejectedTransaction } from '@/lib/utils/contractErrors';

/** 300_000 — ERC-20 approve / transfer */
export const MINIPAY_ERC20_GAS_HEX = '0x493E0' as const;

export const MINIPAY_CONTRACT_GAS_HEX = `0x${MINIPAY_CONTRACT_GAS.toString(16)}` as const;

export const MINIPAY_REGISTER_GAS_HEX = `0x${MINIPAY_REGISTER_GAS.toString(16)}` as const;

type TxParam = {
  from?: string;
  to: Address;
  data: Hex;
  gas: string;
  feeCurrency?: Address;
};

function isPermissionError(err: unknown): boolean {
  const e = err as { code?: number; message?: string; shortMessage?: string; data?: { message?: string } };
  if (e?.code === 4100 || e?.code === -32002) return true;
  const m = `${e?.message ?? ''} ${e?.shortMessage ?? ''} ${e?.data?.message ?? ''}`.toLowerCase();
  return (
    m.includes('permission denied') ||
    m.includes('permission null') ||
    m.includes('sender permission') ||
    m.includes('unauthorized') ||
    m.includes('not authorized')
  );
}

/**
 * MiniPay: bypass viem — raw eth_sendTransaction with explicit gas on window.ethereum.
 * Tries eth_accounts sender first (friend's pattern), then without `from`, then feeCurrency.
 */
export async function minipayRawSendTransaction(
  to: Address,
  data: Hex,
  gasHex: string = MINIPAY_CONTRACT_GAS_HEX,
): Promise<Hash> {
  const eth = getMiniPayEthereumProvider();
  if (!eth?.request) {
    throw new Error('Open Tycoon inside the MiniPay app.');
  }

  const accounts = await getMiniPayAccountsForTx();
  const from = accounts[0];

  const attempts: TxParam[] = [
    // Friend's pattern: eth_accounts + from
    ...(from ? [{ from, to, data, gas: gasHex }] : []),
    // MiniPay sometimes rejects explicit from — let wallet pick active account
    { to, data, gas: gasHex },
    ...(from
      ? [
          { from, to, data, gas: gasHex, feeCurrency: CELO_USDM_FEE_TOKEN },
          { to, data, gas: gasHex, feeCurrency: CELO_USDM_FEE_TOKEN },
        ]
      : [{ to, data, gas: gasHex, feeCurrency: CELO_USDM_FEE_TOKEN }]),
  ];

  let lastError: unknown;
  for (const tx of attempts) {
    try {
      const txHash = (await eth.request({
        method: 'eth_sendTransaction',
        params: [tx],
      })) as Hash | null;

      if (!txHash) {
        throw new Error('Transaction hash unavailable — purchase may not have gone through');
      }
      return txHash;
    } catch (err) {
      lastError = err;
      if (isUserRejectedTransaction(err)) throw err;
      if (!isPermissionError(err)) throw err;
    }
  }

  throw lastError ?? new Error('MiniPay transaction failed: permission denied');
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

/** Encode with viem; on MiniPay send via raw provider RPC (never wagmi/viem prepare). */
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

  if (shouldBypassViemForTx()) {
    return minipayRawSendTransaction(to, data, gasHex);
  }

  return writeContractAsync({ address: to, abi, functionName, args });
}

export type WalletSendFn = (args: { to: Address; data: Hex }) => Promise<Hash>;

export async function sendMinipayAwareEncodedTx(options: {
  to: Address;
  data: Hex;
  gasHex?: string;
  walletSend?: WalletSendFn;
}): Promise<Hash> {
  const { to, data, gasHex = MINIPAY_ERC20_GAS_HEX, walletSend } = options;

  if (shouldBypassViemForTx()) {
    return minipayRawSendTransaction(to, data, gasHex);
  }

  if (!walletSend) {
    throw new Error('Wallet not connected');
  }

  return walletSend({ to, data });
}
