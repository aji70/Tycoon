'use client';

import { encodeFunctionData, type Abi, type Address, type Hash, type Hex } from 'viem';
import {
  CELO_USDM_FEE_TOKEN,
  MINIPAY_CONTRACT_GAS,
  MINIPAY_REGISTER_GAS,
} from '@/lib/celoTransportForWagmi';
import { ensureMiniPayWalletReady, shouldBypassViemForTx } from '@/lib/minipayGuestFlow';
import { getInjectedEthereumProvider } from '@/lib/utils/erc8004InjectedEoa';
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

function isPermissionDenied(err: unknown): boolean {
  const e = err as { code?: number; message?: string; shortMessage?: string };
  if (e?.code === 4100 || e?.code === -32002) return true;
  const m = `${e?.message ?? ''} ${e?.shortMessage ?? ''}`.toLowerCase();
  return m.includes('permission denied') || m.includes('unauthorized') || m.includes('not authorized');
}

/**
 * MiniPay: bypass viem/wagmi entirely — `prepareTransactionRequest` on Celo uses CIP-42 /
 * `eth_estimateGas` params that MiniPay's injected provider rejects.
 * Raw `eth_sendTransaction` with explicit gas; MiniPay handles nonce, gas price, and signing.
 */
export async function minipayRawSendTransaction(
  to: Address,
  data: Hex,
  gasHex: string = MINIPAY_CONTRACT_GAS_HEX,
): Promise<Hash> {
  const eth = getInjectedEthereumProvider();
  if (!eth?.request) {
    throw new Error('Open Tycoon inside the MiniPay app.');
  }

  const accounts = await ensureMiniPayWalletReady();
  const from = accounts[0];

  const base: TxParam = { to, data, gas: gasHex };
  const attempts: TxParam[] = [
    from ? { ...base, from } : base,
    base,
    ...(from
      ? [
          { ...base, from, feeCurrency: CELO_USDM_FEE_TOKEN },
          { ...base, feeCurrency: CELO_USDM_FEE_TOKEN },
        ]
      : [{ ...base, feeCurrency: CELO_USDM_FEE_TOKEN }]),
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
      if (!isPermissionDenied(err)) throw err;
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

/**
 * For flows that already called encodeFunctionData (e.g. ERC-20 transfer to treasury).
 * MiniPay → raw eth_sendTransaction; otherwise → walletClient.sendTransaction.
 */
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
