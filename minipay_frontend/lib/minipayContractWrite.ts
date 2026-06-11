'use client';

import { encodeFunctionData, type Abi, type Address, type Hash, type Hex } from 'viem';
import {
  CELO_USDC_FEE_ADAPTER,
  CELO_USDM_FEE_TOKEN,
  MINIPAY_CONTRACT_GAS,
  MINIPAY_REGISTER_GAS,
} from '@/lib/celoTransportForWagmi';
import {
  getMiniPayEthereumProvider,
  resolveMiniPaySender,
  shouldBypassViemForTx,
} from '@/lib/minipayGuestFlow';
import { isUserRejectedTransaction } from '@/lib/utils/contractErrors';

/** 300_000 — ERC-20 approve / transfer */
export const MINIPAY_ERC20_GAS_HEX = '0x493E0' as const;

export const MINIPAY_CONTRACT_GAS_HEX = `0x${MINIPAY_CONTRACT_GAS.toString(16)}` as const;

export const MINIPAY_REGISTER_GAS_HEX = `0x${MINIPAY_REGISTER_GAS.toString(16)}` as const;

type TxParam = {
  from: string;
  to: Address;
  data: Hex;
  gas: string;
  feeCurrency?: Address;
};

function isRetryableSendError(err: unknown): boolean {
  const e = err as { code?: number; message?: string; shortMessage?: string; data?: { message?: string } };
  if (e?.code === 4100 || e?.code === -32002) return true;
  const m = `${e?.message ?? ''} ${e?.shortMessage ?? ''} ${e?.data?.message ?? ''}`.toLowerCase();
  return (
    m.includes('permission denied') ||
    m.includes('permission null') ||
    m.includes('sender permission') ||
    m.includes('invalid sender') ||
    m.includes('sender address null') ||
    m.includes('unauthorized')
  );
}

/**
 * MiniPay raw send — Celopedia pattern:
 * encodeFunctionData (viem) + eth_requestAccounts + eth_sendTransaction with explicit `from` + gas.
 * MiniPay REQUIRES non-null `from` — never omit it (causes "invalid sender address null").
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

  const sendOnce = async (from: string, feeCurrency?: Address): Promise<Hash> => {
    const tx: TxParam = { from, to, data, gas: gasHex, ...(feeCurrency ? { feeCurrency } : {}) };
    const txHash = (await eth.request({
      method: 'eth_sendTransaction',
      params: [tx],
    })) as Hash | null;

    if (!txHash) {
      throw new Error('Transaction hash unavailable — purchase may not have gone through');
    }
    return txHash;
  };

  let from = await resolveMiniPaySender();

  const attempts: Array<{ feeCurrency?: Address; refreshSender?: boolean }> = [
    {},
    { feeCurrency: CELO_USDC_FEE_ADAPTER },
    { feeCurrency: CELO_USDM_FEE_TOKEN },
    { refreshSender: true },
    { refreshSender: true, feeCurrency: CELO_USDM_FEE_TOKEN },
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      if (attempt.refreshSender) {
        from = await resolveMiniPaySender();
      }
      return await sendOnce(from, attempt.feeCurrency);
    } catch (err) {
      lastError = err;
      if (isUserRejectedTransaction(err)) throw err;
      if (!isRetryableSendError(err)) throw err;
    }
  }

  throw lastError ?? new Error('MiniPay transaction failed');
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
