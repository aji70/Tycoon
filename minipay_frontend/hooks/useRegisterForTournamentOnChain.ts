"use client";

import { useCallback } from "react";
import {
  useChainId,
  useAccount,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  TOURNAMENT_ESCROW_ADDRESSES,
  USDC_TOKEN_ADDRESS,
} from "@/constants/contracts";
import TycoonTournamentEscrowAbi from "@/context/abi/TycoonTournamentEscrow.json";
import { useApprove } from "@/context/ContractProvider";

/**
 * Hook to register for a tournament on-chain (TycoonTournamentEscrow.registerForTournament).
 * For paid tournaments: approves USDC if needed, waits for confirmation, then calls registerForTournament.
 * For free tournaments: just calls registerForTournament (no approval needed).
 * @returns { register, isPending, error, txHash }
 */
export function useRegisterForTournamentOnChain() {
  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const escrowAddress = TOURNAMENT_ESCROW_ADDRESSES[chainId as keyof typeof TOURNAMENT_ESCROW_ADDRESSES];
  const usdcAddress = USDC_TOKEN_ADDRESS[chainId as keyof typeof USDC_TOKEN_ADDRESS];
  const { approve } = useApprove();

  const {
    writeContractAsync,
    isPending: isWritePending,
    error: writeError,
    data: txHash,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  const register = useCallback(
    async (tournamentId: number, entryFeeWei: bigint | number): Promise<string | null> => {
      if (!address || !escrowAddress) {
        throw new Error("Wallet not connected or escrow not configured for this network");
      }

      const tid = Number(tournamentId);
      const validTournamentId = Number.isFinite(tid) && tid >= 0 ? Math.floor(tid) : 0;

      const feeNum = Number(entryFeeWei);
      const fee = BigInt(Number.isFinite(feeNum) && feeNum >= 0 ? Math.floor(feeNum) : 0);

      if (fee > 0) {
        if (!usdcAddress) {
          throw new Error("USDC not configured for this network");
        }
        // Approve USDC for escrow if entry fee > 0
        const approveHash = await approve(usdcAddress, escrowAddress, fee);
        if (approveHash && publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
      }

      const hash = await writeContractAsync({
        address: escrowAddress,
        abi: TycoonTournamentEscrowAbi as never,
        functionName: "registerForTournament",
        args: [BigInt(validTournamentId)],
      });

      return hash ?? null;
    },
    [address, escrowAddress, usdcAddress, approve, writeContractAsync, publicClient]
  );

  return {
    register,
    isPending: isWritePending || isConfirming,
    error: writeError,
    txHash,
    reset,
    isReady: !!address && !!escrowAddress,
  };
}
