'use client';

import { encodeFunctionData, type Abi, type Address, type Hash, type Hex } from 'viem';
import {
  CELO_USDM_FEE_TOKEN,
  MINIPAY_CONTRACT_GAS,
  MINIPAY_REGISTER_GAS,
} from '@/lib/celoTransportForWagmi';
import {
  authorizeMiniPayWallet,
  getMiniPayAccountsForTx,
  shouldBypassViemForTx,
} from '@/lib/minipayGuestFlow';
import { getInjectedEthereumProvider } from '@/lib/utils/erc8004InjectedEoa';
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

function isPermissionDenied(err: unknown): boolean {
  const e = err as { code?: number; message?: string; shortMessage?: string };
  if (e?.code === 4100 || e?.code === -32002) return true;
  const m = `${e?.message ?? ''} ${e?.shortMessage ?? ''}`.toLowerCase();
  return m.includes('permission denied') || m.includes('unauthorized') || m.includes('not authorized');
}

/**
 * MiniPay payment send — friend's pattern:
 * bypass viem entirely; eth_accounts + eth_sendTransaction with explicit gas.
 * Auto-connect must call authorizeMiniPayWallet() first so eth_accounts is populated.
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

  const sendWithFrom = async (from: string): Promise<Hash> => {
    const txHash = (await eth.request({
      method: 'eth_sendTransaction',
      params: [{ from, to, data, gas: gasHex }],
    })) as Hash | null;

    if (!txHash) {
      throw new Error('Transaction hash unavailable — purchase may not have gone through');
    }
    return txHash;
  };

  let accounts = await getMiniPayAccountsForTx();
  let from = accounts[0];
  if (!from) {
    throw new Error('MiniPay wallet not connected. Open this app from MiniPay and try again.');
  }

  try {
    return await sendWithFrom(from);
  } catch (err) {
    if (isUserRejectedTransaction(err)) throw err;
    if (!isPermissionDenied(err)) throw err;

    // eth_accounts was empty/stale — re-authorize once, then retry (friend's flow + safety net)
    accounts = await authorizeMiniPayWallet();
    from = accounts[0];
    if (!from) throw err;

    try {
      return await sendWithFrom(from);
    } catch (retryErr) {
      if (isUserRejectedTransaction(retryErr)) throw retryErr;
      // Last resort: USDm feeCurrency (Celo fee abstraction)
      const txHash = (await eth.request({
        method: 'eth_sendTransaction',
        params: [{ from, to, data, gas: gasHex, feeCurrency: CELO_USDM_FEE_TOKEN }],
      })) as Hash | null;
      if (!txHash) throw retryErr;
      return txHash;
    }
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

/** Encode with viem; on MiniPay send via raw eth_accounts + eth_sendTransaction (never wagmi/viem prepare). */
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

/** Pre-encoded calldata (e.g. ERC-20 transfer). MiniPay → eth_accounts + raw send. */
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
