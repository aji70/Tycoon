'use client';

import { encodeFunctionData, getAddress, type Abi, type Address, type Hash, type Hex } from 'viem';
import {
  CELO_USDC_FEE_ADAPTER,
  CELO_USDM_FEE_TOKEN,
  MINIPAY_CONTRACT_GAS,
  MINIPAY_FEE_CURRENCY,
  MINIPAY_REGISTER_GAS,
} from '@/lib/celoTransportForWagmi';
import {
  ensureInjectedMiniPayConnection,
  getEthereumProvider,
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
    m.includes('unauthorized') ||
    m.includes('fee currency') ||
    m.includes('feecurrency') ||
    m.includes('insufficient funds') ||
    m.includes('gas required exceeds') ||
    m.includes('intrinsic gas')
  );
}

/**
 * Celopedia MiniPay send pattern on window.ethereum:
 * encodeFunctionData + eth_sendTransaction with explicit gas + feeCurrency (USDC adapter).
 * @see https://docs.minipay.xyz/getting-started/examples.html
 */
export async function minipayRawSendTransaction(
  to: Address,
  data: Hex,
  gasHex: string = MINIPAY_CONTRACT_GAS_HEX,
): Promise<Hash> {
  await ensureInjectedMiniPayConnection();
  const eth = getEthereumProvider();

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

  const refreshSender = async (): Promise<string> => {
    const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
    const raw = accounts?.[0];
    if (!raw) return resolveMiniPaySender();
    return getAddress(raw as `0x${string}`);
  };

  const feeAttempts: Array<Address | undefined> = [
    MINIPAY_FEE_CURRENCY,
    CELO_USDC_FEE_ADAPTER,
    CELO_USDM_FEE_TOKEN,
    undefined,
  ];

  const seen = new Set<string>();
  const uniqueFeeAttempts = feeAttempts.filter((fc) => {
    const key = fc ?? 'default';
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let from = await resolveMiniPaySender();
  let lastError: unknown;

  for (let round = 0; round < 2; round++) {
    for (const feeCurrency of uniqueFeeAttempts) {
      try {
        return await sendOnce(from, feeCurrency);
      } catch (err) {
        lastError = err;
        if (isUserRejectedTransaction(err)) throw err;
        if (!isRetryableSendError(err)) throw err;
      }
    }

    if (round === 0) {
      from = await refreshSender();
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
