'use client';

import { encodeFunctionData, type Abi, type Address, type Hash, type Hex } from 'viem';
import {
  CELO_USDC_FEE_ADAPTER,
  CELO_USDM_FEE_TOKEN,
  MINIPAY_CONTRACT_GAS,
  MINIPAY_REGISTER_GAS,
} from '@/lib/celoTransportForWagmi';
import {
  ensureInjectedMiniPayConnection,
  getInjectedEthereumProvider,
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

function isFeeCurrencyRetryError(err: unknown): boolean {
  const e = err as { code?: number; message?: string; shortMessage?: string; data?: { message?: string } };
  if (e?.code === 4100 || e?.code === -32002) return false;
  const m = `${e?.message ?? ''} ${e?.shortMessage ?? ''} ${e?.data?.message ?? ''}`.toLowerCase();
  return (
    m.includes('fee currency') ||
    m.includes('feecurrency') ||
    m.includes('insufficient funds') ||
    m.includes('gas required exceeds') ||
    m.includes('intrinsic gas')
  );
}

/**
 * MiniPay raw send — friend's revive pattern on the injected provider wagmi uses:
 * eth_accounts → eth_sendTransaction with explicit from + gas (no feeCurrency on first attempt).
 */
export async function minipayRawSendTransaction(
  to: Address,
  data: Hex,
  gasHex: string = MINIPAY_CONTRACT_GAS_HEX,
): Promise<Hash> {
  const sendOnce = async (from: string, feeCurrency?: Address): Promise<Hash> => {
    await ensureInjectedMiniPayConnection();
    const eth = await getInjectedEthereumProvider();

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

  const from = await resolveMiniPaySender();

  try {
    return await sendOnce(from);
  } catch (err) {
    if (isUserRejectedTransaction(err)) throw err;

    const e = err as { code?: number; message?: string };
    const msg = `${e?.message ?? ''}`.toLowerCase();
    if (e?.code === 4100 || msg.includes('permission denied') || msg.includes('unauthorized')) {
      throw new Error(
        'MiniPay could not sign this transaction. Close the app, reopen Tycoon from MiniPay, and try again.',
      );
    }

    if (isFeeCurrencyRetryError(err)) {
      for (const feeCurrency of [CELO_USDC_FEE_ADAPTER, CELO_USDM_FEE_TOKEN]) {
        try {
          return await sendOnce(from, feeCurrency);
        } catch (retryErr) {
          if (isUserRejectedTransaction(retryErr)) throw retryErr;
        }
      }
    }

    throw err;
  }
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
