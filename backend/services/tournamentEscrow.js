/**
 * TycoonTournamentEscrow contract: create/lock/finalize tournaments on-chain.
 * Uses same backend wallet and tx queue as tycoonContract to avoid nonce collisions.
 * Env per chain: TOURNAMENT_ESCROW_ADDRESS_POLYGON (or TOURNAMENT_ESCROW_POLYGON), etc.
 */
import { JsonRpcProvider, Wallet, Contract, Network } from "ethers";
import { getChainConfig } from "../config/chains.js";
import { withTxQueue } from "./tycoonContract.js";
import logger from "../config/logger.js";

const CHAIN_NAMES = { CELO: "celo", POLYGON: "polygon", BASE: "base" };

const ESCROW_ABI = [
  {
    type: "function",
    name: "createTournament",
    inputs: [
      { name: "tournamentId", type: "uint256", internalType: "uint256" },
      { name: "entryFee", type: "uint256", internalType: "uint256" },
      { name: "creator", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "registerForTournamentFor",
    inputs: [
      { name: "tournamentId", type: "uint256", internalType: "uint256" },
      { name: "player", type: "address", internalType: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
];

function getEscrowContract(chain) {
  const { rpcUrl, privateKey, chainId, tournamentEscrowAddress, isConfigured } = getChainConfig(chain);
  if (!isConfigured || !tournamentEscrowAddress) {
    return null;
  }
  const pk = String(privateKey).startsWith("0x") ? privateKey : `0x${privateKey}`;
  const networkName = CHAIN_NAMES[String(chain).toUpperCase()] || "celo";
  const network = new Network(networkName, chainId);
  const provider = new JsonRpcProvider(rpcUrl, network);
  const wallet = new Wallet(pk, provider);
  return new Contract(tournamentEscrowAddress, ESCROW_ABI, wallet);
}

/**
 * Whether the tournament escrow is configured for the given chain.
 */
export function isEscrowConfigured(chain) {
  const cfg = getChainConfig(chain);
  return Boolean(cfg.isConfigured && cfg.tournamentEscrowAddress);
}

/**
 * Create a tournament on the TycoonTournamentEscrow contract.
 * Only backend or owner can call. Uses same tx queue as Tycoon contract.
 * @param {number} tournamentId - DB tournament id (same id on-chain)
 * @param {number|string|bigint} entryFeeWei - Entry fee in USDC wei (6 decimals). 0 = free.
 * @param {string} creatorAddress - Creator wallet (0x...). Use 0x0 if no prize / unknown.
 * @param {string} chain - POLYGON | CELO | BASE
 * @returns {Promise<{ hash: string }>} Receipt hash, or null if escrow not configured
 */
export async function createTournamentOnChain(tournamentId, entryFeeWei, creatorAddress, chain) {
  const escrow = getEscrowContract(chain);
  if (!escrow) {
    logger.info({ chain, tournamentId }, "Tournament escrow not configured for chain; skipping on-chain create");
    return null;
  }
  return withTxQueue(async () => {
    const creator = creatorAddress && creatorAddress !== "0x0" ? creatorAddress : "0x0000000000000000000000000000000000000000";
    const tx = await escrow.createTournament(BigInt(tournamentId), BigInt(entryFeeWei ?? 0), creator);
    const receipt = await tx.wait();
    logger.info(
      { tournamentId, entryFeeWei: String(entryFeeWei), creator, chain, hash: receipt?.hash },
      "Escrow createTournament tx"
    );
    return { hash: receipt?.hash };
  });
}

/**
 * Register a player for a free tournament on-chain. Backend calls on behalf of guests.
 * Only works for tournaments with entryFee == 0. Only backend or owner can call.
 * @param {number} tournamentId - DB tournament id (same id on-chain)
 * @param {string} playerAddress - Player address (0x...)
 * @param {string} chain - POLYGON | CELO | BASE
 * @returns {Promise<{ hash: string } | null>} Receipt hash, or null if escrow not configured
 */
export async function registerForTournamentFor(tournamentId, playerAddress, chain) {
  const escrow = getEscrowContract(chain);
  if (!escrow) {
    logger.info({ chain, tournamentId }, "Tournament escrow not configured for chain; skipping on-chain register");
    return null;
  }
  return withTxQueue(async () => {
    const player = playerAddress && playerAddress !== "0x0" ? playerAddress : null;
    if (!player) {
      logger.warn({ tournamentId, chain }, "registerForTournamentFor: no valid player address");
      return null;
    }
    const tx = await escrow.registerForTournamentFor(BigInt(tournamentId), player);
    const receipt = await tx.wait();
    logger.info(
      { tournamentId, player, chain, hash: receipt?.hash },
      "Escrow registerForTournamentFor tx"
    );
    return { hash: receipt?.hash };
  });
}
