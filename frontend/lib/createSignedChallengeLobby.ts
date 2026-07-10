"use client";

import { parseEventLogs, type Address, type Hash, type PublicClient } from "viem";
import { apiClient } from "@/lib/api";
import { generateGameCode } from "@/lib/utils/games";
import { resolveChainForBackend } from "@/lib/utils/chain";
import { TYCOON_CONTRACT_ADDRESSES } from "@/constants/contracts";
import TycoonABI from "@/context/abi/tycoonabi.json";

const STARTING_CASH = 1500n;
const STAKE = 0n;
const SYMBOL = "hat";
const PLAYERS = 2;

function parseGameCreatedIdFromReceipt(
  logs: Parameters<typeof parseEventLogs>[0]["logs"]
): bigint | null {
  const parsed = parseEventLogs({
    abi: TycoonABI as never,
    logs,
    eventName: "GameCreated",
  });
  const gameId = (parsed[0] as { args?: { gameId?: bigint } } | undefined)?.args?.gameId;
  return gameId != null ? BigInt(gameId) : null;
}

/**
 * Challenger signs createGame on-chain (PRIVATE 2p free), then saves the lobby to the API.
 */
export async function createSignedChallengeLobby(opts: {
  address: `0x${string}`;
  username: string;
  chainId: number;
  publicClient: PublicClient;
  writeContractAsync: (args: {
    address: Address;
    abi: typeof TycoonABI;
    functionName: "createGame";
    args: [string, string, string, number, string, bigint, bigint];
  }) => Promise<Hash>;
}): Promise<{ code: string; contractGameId: string }> {
  const { address, username, chainId, publicClient, writeContractAsync } = opts;
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[chainId as keyof typeof TYCOON_CONTRACT_ADDRESSES];
  if (!contractAddress) throw new Error("Game contract not available on this network");
  if (!username?.trim()) throw new Error("Register your username on-chain before challenging");

  const code = generateGameCode();
  const hash = await writeContractAsync({
    address: contractAddress,
    abi: TycoonABI,
    functionName: "createGame",
    args: [username.trim(), "PRIVATE", SYMBOL, PLAYERS, code, STARTING_CASH, STAKE],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  const onChainGameId = parseGameCreatedIdFromReceipt(receipt.logs);
  if (onChainGameId == null) throw new Error("GameCreated event not found in transaction");

  const chainName = resolveChainForBackend(chainId);

  const saveRes = await apiClient.post(
    "/games",
    {
      id: onChainGameId.toString(),
      code,
      mode: "PRIVATE",
      address,
      symbol: SYMBOL,
      number_of_players: PLAYERS,
      stake: 0,
      starting_cash: Number(STARTING_CASH),
      is_ai: false,
      is_minipay: false,
      chain: chainName,
      duration: 30,
      use_usdc: false,
      settings: {
        auction: true,
        rent_in_prison: false,
        mortgage: true,
        even_build: true,
        starting_cash: Number(STARTING_CASH),
      },
    },
    { timeout: 60000 }
  );

  const body = saveRes?.data as { success?: boolean; message?: string } | undefined;
  if (body && body.success === false) {
    throw new Error(body.message || "Failed to save game");
  }

  return { code, contractGameId: onChainGameId.toString() };
}
