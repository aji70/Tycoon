"use client";

import { useCallback } from "react";
import {
  useChainId,
  useAccount,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { TOURNAMENT_ESCROW_ADDRESSES, USDC_TOKEN_ADDRESS } from "@/constants/contracts";
import TycoonTournamentEscrowAbi from "@/context/abi/TycoonTournamentEscrow.json";
import { useApprove } from "@/context/ContractProvider";

/**
 * Creator funds tournament prize pool on-chain (USDC). Approve escrow then fundPrizePool.
 */
export function useFundPrizePool() {
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

  const fund = useCallback(
    async (tournamentId: number, amountWei: bigint): Promise<string | null> => {
      if (!address || !escrowAddress) {
        throw new Error("Wallet not connected or tournament escrow not configured for this network");
      }
      if (amountWei <= BigInt(0)) throw new Error("Amount must be greater than zero");
      if (!usdcAddress) throw new Error("USDC not configured for this network");

      const approveHash = await approve(usdcAddress, escrowAddress, amountWei);
      if (approveHash && publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      const hash = await writeContractAsync({
        address: escrowAddress,
        abi: TycoonTournamentEscrowAbi as never,
        functionName: "fundPrizePool",
        args: [BigInt(Math.floor(Number(tournamentId))), amountWei],
      });

      return hash ?? null;
    },
    [address, escrowAddress, usdcAddress, approve, writeContractAsync, publicClient]
  );

  return {
    fund,
    isPending: isWritePending || isConfirming,
    error: writeError,
    txHash,
    reset,
    isReady: !!address && !!escrowAddress && !!usdcAddress,
  };
}
