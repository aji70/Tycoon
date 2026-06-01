'use client';

import { createContext, useContext, useCallback } from 'react';
import {
  useSendTransaction,
  useWaitForTransactionReceipt,
  useChainId,
  useWriteContract,
} from 'wagmi';
import { Address, encodeFunctionData } from 'viem';
import TycoonABI from './abi/tycoonabi.json';
import { TYCOON_CONTRACT_ADDRESSES } from '@/constants/contracts';
import { minipaySendTransactionAttempts } from '@/lib/celoTransportForWagmi';
import { ensureMiniPayWalletReady, isMiniPayEmbeddedWallet } from '@/lib/minipayGuestFlow';
import { isUserRejectedTransaction } from '@/lib/utils/contractErrors';

type RegistrationContextType = {
  registerPlayer: (username: string) => Promise<string | undefined>;
  isPending: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  error: Error | null;
  txHash: Address | undefined;
  reset: () => void;
};

const RegistrationContext = createContext<RegistrationContextType | undefined>(undefined);

export const RegistrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const chainId = useChainId();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId];
  const { sendTransactionAsync, isPending, error: writeError, data: txHash, reset: resetSendTx } =
    useSendTransaction();
  const { writeContractAsync } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const registerPlayer = useCallback(
    async (username: string) => {
      if (!contractAddress) throw new Error('Contract not deployed on this chain');
      if (!username.trim()) throw new Error('Username cannot be empty');

      await ensureMiniPayWalletReady();

      const fn = isMiniPayEmbeddedWallet() ? 'registerPlayerWithoutWallet' : 'registerPlayer';

      // MiniPay path (embedded wallet)
      if (isMiniPayEmbeddedWallet()) {
        const data = encodeFunctionData({
          abi: TycoonABI,
          functionName: fn,
          args: [username.trim()],
        });

        const attempts = minipaySendTransactionAttempts();
        let lastError: unknown;
        for (const attempt of attempts) {
          try {
            return await sendTransactionAsync({
              to: contractAddress,
              data,
              ...attempt,
            });
          } catch (err) {
            lastError = err;
            if (isUserRejectedTransaction(err)) throw err;
          }
        }
        throw lastError ?? new Error('Registration failed');
      }

      // Regular EOA path
      return await writeContractAsync({
        address: contractAddress,
        abi: TycoonABI,
        functionName: fn,
        args: [username.trim()],
      });
    },
    [sendTransactionAsync, writeContractAsync, contractAddress]
  );

  const reset = useCallback(() => {
    resetSendTx();
  }, [resetSendTx]);

  const value: RegistrationContextType = {
    registerPlayer,
    isPending,
    isConfirming,
    isSuccess,
    error: writeError as Error | null,
    txHash,
    reset,
  };

  return (
    <RegistrationContext.Provider value={value}>
      {children}
    </RegistrationContext.Provider>
  );
};

export function useRegistration() {
  const context = useContext(RegistrationContext);
  if (!context) {
    throw new Error('useRegistration must be used within RegistrationProvider');
  }
  return context;
}
