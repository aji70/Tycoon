'use client';

import { useCallback } from 'react';
import {
  useChainId,
  useSendTransaction,
  useWriteContract as useWagmiWriteContract,
} from 'wagmi';
import { encodeFunctionData, type Abi, type Address, type Hex } from 'viem';
import { appendAttributionTag, isCeloChainId } from '@/lib/celoAttribution';

type WriteVars = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  gas?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  nonce?: number;
  chainId?: number;
  dataSuffix?: Hex;
};

/**
 * Drop-in replacement for wagmi useWriteContract that appends the Celo
 * attribution tag on Celo chains (encodeFunctionData + sendTransaction).
 */
export function useTaggedWriteContract() {
  const write = useWagmiWriteContract();
  const send = useSendTransaction();
  const chainId = useChainId();

  const writeContractAsync = useCallback(
    async (variables: WriteVars, config?: Parameters<typeof write.writeContractAsync>[1]) => {
      const effectiveChainId = variables.chainId ?? chainId;
      if (!isCeloChainId(effectiveChainId)) {
        return write.writeContractAsync(variables as never, config);
      }

      const data = encodeFunctionData({
        abi: variables.abi,
        functionName: variables.functionName,
        args: variables.args as never,
      });
      const tagged = appendAttributionTag(data);

      return send.sendTransactionAsync(
        {
          to: variables.address,
          data: tagged,
          value: variables.value,
          gas: variables.gas,
          maxFeePerGas: variables.maxFeePerGas,
          maxPriorityFeePerGas: variables.maxPriorityFeePerGas,
          nonce: variables.nonce,
          chainId: variables.chainId,
        } as never,
        config as never
      );
    },
    [chainId, send, write]
  );

  const writeContract = useCallback(
    (variables: WriteVars, config?: Parameters<typeof write.writeContract>[1]) => {
      void writeContractAsync(variables, config as never).catch(() => {
        /* errors surface via send/write state */
      });
    },
    [writeContractAsync]
  );

  return {
    ...write,
    writeContract,
    writeContractAsync,
    data: send.data ?? write.data,
    error: send.error ?? write.error,
    isPending: write.isPending || send.isPending,
    isSuccess: send.isSuccess || write.isSuccess,
    isError: send.isError || write.isError,
    reset: () => {
      write.reset();
      send.reset();
    },
  };
}

/** Alias so call sites can import useWriteContract from this module. */
export const useWriteContract = useTaggedWriteContract;
