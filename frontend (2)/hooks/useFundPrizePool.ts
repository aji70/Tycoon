"use client";

import { useCallback } from "react";
import {
  useChainId,
  useAccount,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { encodeFunctionData, type Address } from "viem";
import { TOURNAMENT_ESCROW_ADDRESSES, USDC_TOKEN_ADDRESS } from "@/constants/contracts";
import TycoonTournamentEscrowAbi from "@/context/abi/TycoonTournamentEscrow.json";
import UserWalletAbi from "@/context/abi/tycoon-user-wallet-abi.json";
import { useApprove, useUserWalletApproveERC20 } from "@/context/ContractProvider";

/**
 * Creator funds tournament prize pool on-chain (USDC).
 * From EOA: approve USDC, then fundPrizePool.
 * From smart wallet: approve via wallet's approveERC20, then executeCall(fundPrizePool).
 */
export function useFundPrizePool(smartWalletAddress?: Address | null) {
  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const escrowAddress = TOURNAMENT_ESCROW_ADDRESSES[chainId as keyof typeof TOURNAMENT_ESCROW_ADDRESSES];
  const usdcAddress = USDC_TOKEN_ADDRESS[chainId as keyof typeof USDC_TOKEN_ADDRESS];
  const { approve } = useApprove();
  const { approveERC20: smartWalletApprove } = useUserWalletApproveERC20(smartWalletAddress ?? undefined);

  const {
    writeContractAsync,
    isPending: isWritePending,
    error: writeError,
    data: txHash,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash });

  const fund = useCallback(
    async (tournamentId: number, amountWei: bigint, fromSmartWallet = false): Promise<string | null> => {
      const payer = fromSmartWallet ? smartWalletAddress : address;
      if (!payer || !escrowAddress) {
        throw new Error(
          fromSmartWallet
            ? "Smart wallet required. Sign in and ensure your profile has a smart wallet."
            : "Wallet not connected or tournament escrow not configured for this network"
        );
      }
      if (amountWei <= BigInt(0)) throw new Error("Amount must be greater than zero");
      if (!usdcAddress) throw new Error("USDC not configured for this network");

      if (fromSmartWallet && smartWalletAddress) {
        const approveHash = await smartWalletApprove(usdcAddress, escrowAddress, amountWei);
        if (approveHash && publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approveHash as `0x${string}` });
        }

        const calldata = encodeFunctionData({
          abi: TycoonTournamentEscrowAbi as never,
          functionName: "fundPrizePool",
          args: [BigInt(Math.floor(Number(tournamentId))), amountWei],
        });

        const hash = await writeContractAsync({
          address: smartWalletAddress,
          abi: UserWalletAbi as never,
          functionName: "executeCall",
          args: [escrowAddress, BigInt(0), calldata as `0x${string}`],
          value: BigInt(0),
        });

        return hash ?? null;
      }

      const approveHash = await approve(usdcAddress, escrowAddress, amountWei);
      if (approveHash && publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: approveHash as `0x${string}` });
      }

      const hash = await writeContractAsync({
        address: escrowAddress,
        abi: TycoonTournamentEscrowAbi as never,
        functionName: "fundPrizePool",
        args: [BigInt(Math.floor(Number(tournamentId))), amountWei],
      });

      return hash ?? null;
    },
    [
      address,
      smartWalletAddress,
      escrowAddress,
      usdcAddress,
      approve,
      smartWalletApprove,
      writeContractAsync,
      publicClient,
    ]
  );

  const canUseSmartWallet = !!smartWalletAddress && !!address;
  const isReady = !!address && !!escrowAddress && !!usdcAddress;

  return {
    fund,
    isPending: isWritePending || isConfirming,
    error: writeError,
    txHash,
    reset,
    isReady,
    canUseSmartWallet,
  };
}
