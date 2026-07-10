"use client";

import { parseUnits, type Address, type Hash, type PublicClient } from "viem";
import { TYCOON_CONTRACT_ADDRESSES } from "@/constants/contracts";
import TycoonABI from "@/context/abi/tycoonabi.json";

const USDT_DECIMALS = 6;
const DEFAULT_JOIN_SYMBOL = "car";

/**
 * Opponent signs joinGame for a staked challenge (approve USDT if needed).
 */
export async function joinSignedChallengeGame(opts: {
  address: `0x${string}`;
  username: string;
  chainId: number;
  publicClient: PublicClient;
  writeContractAsync: (args: {
    address: Address;
    abi: typeof TycoonABI;
    functionName: "joinGame";
    args: [bigint, string, string, string];
  }) => Promise<Hash>;
  gameCode: string;
  stake: number;
  symbol?: string;
  stakeTokenAddress?: Address | null;
  approveUsdc?: (token: Address, spender: Address, amount: bigint) => Promise<unknown>;
  readAllowance?: () => Promise<bigint>;
}): Promise<{ symbol: string; contractGameId: string }> {
  const { username, chainId, publicClient, writeContractAsync, gameCode } = opts;
  const stake = Math.max(0, Number(opts.stake) || 0);
  const stakeWei = stake > 0 ? parseUnits(String(stake), USDT_DECIMALS) : 0n;
  const symbol = (opts.symbol || DEFAULT_JOIN_SYMBOL).trim() || DEFAULT_JOIN_SYMBOL;
  const code = String(gameCode || "").trim().toUpperCase();
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId as keyof typeof TYCOON_CONTRACT_ADDRESSES];
  if (!contractAddress) throw new Error("Game contract not available on this network");
  if (!username?.trim()) throw new Error("Register your username on-chain before joining");
  if (!code) throw new Error("Missing game code");

  const onChainGame = (await publicClient.readContract({
    address: contractAddress,
    abi: TycoonABI as never,
    functionName: "getGameByCode",
    args: [code],
  })) as { id?: bigint; stakePerPlayer?: bigint } | readonly unknown[];

  const rawId =
    onChainGame && typeof onChainGame === "object" && !Array.isArray(onChainGame)
      ? onChainGame.id
      : (onChainGame as readonly unknown[])?.[0];
  if (rawId == null || BigInt(rawId as bigint | number | string) === 0n) {
    throw new Error("Challenge lobby not found on-chain yet — wait a moment and try again");
  }
  const contractGameId = BigInt(rawId as bigint | number | string);

  const onChainStake =
    onChainGame && typeof onChainGame === "object" && !Array.isArray(onChainGame)
      ? BigInt(onChainGame.stakePerPlayer ?? 0n)
      : BigInt(((onChainGame as readonly unknown[])?.[9] as bigint | number | undefined) ?? 0);
  const requiredStake = onChainStake > 0n ? onChainStake : stakeWei;

  if (requiredStake > 0n) {
    if (!opts.stakeTokenAddress) throw new Error("USDT not available on this network");
    if (!opts.approveUsdc || !opts.readAllowance) {
      throw new Error("Stake approval helpers missing");
    }
    const allowance = await opts.readAllowance();
    if (allowance < requiredStake) {
      await opts.approveUsdc(opts.stakeTokenAddress, contractAddress, requiredStake);
      await new Promise((r) => setTimeout(r, 3500));
    }
  }

  const hash = await writeContractAsync({
    address: contractAddress,
    abi: TycoonABI,
    functionName: "joinGame",
    args: [contractGameId, username.trim(), symbol, code],
  });

  await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  return { symbol, contractGameId: contractGameId.toString() };
}
