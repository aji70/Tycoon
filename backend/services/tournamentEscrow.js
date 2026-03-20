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

const ESCROW_READ_ABI = [
  {
    type: "function",
    name: "backend",
    inputs: [],
    outputs: [{ type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ type: "address", internalType: "address" }],
    stateMutability: "view",
  },
];

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

const ZERO = "0x0000000000000000000000000000000000000000";

/**
 * Ensure the wallet used for escrow txs is allowed by TycoonTournamentEscrow (backend or owner).
 * Avoids opaque "Not backend or owner" reverts from estimateGas.
 */
async function assertEscrowSignerAuthorized(chain) {
  const cfg = getChainConfig(chain);
  const pkRaw = cfg.tournamentEscrowSignerPrivateKey ?? cfg.privateKey;
  if (!cfg.rpcUrl || !cfg.tournamentEscrowAddress || !pkRaw) return;

  const pk = String(pkRaw).startsWith("0x") ? pkRaw : `0x${pkRaw}`;
  const networkName = CHAIN_NAMES[String(chain).toUpperCase()] || "celo";
  const network = new Network(networkName, cfg.chainId);
  const provider = new JsonRpcProvider(cfg.rpcUrl, network);
  const wallet = new Wallet(pk, provider);
  const read = new Contract(cfg.tournamentEscrowAddress, ESCROW_READ_ABI, provider);

  const [onChainBackend, onChainOwner] = await Promise.all([read.backend(), read.owner()]);
  const me = wallet.address.toLowerCase();
  if (me === String(onChainOwner).toLowerCase()) return;

  const be = String(onChainBackend).toLowerCase();
  if (be === ZERO) {
    throw new Error(
      `Tournament escrow at ${cfg.tournamentEscrowAddress} has backend unset (0x0). ` +
        `Contract owner ${onChainOwner} must call setBackend("${wallet.address}") so the same wallet as ` +
        `BACKEND_GAME_CONTROLLER_* (or TOURNAMENT_ESCROW_SIGNER_PRIVATE_KEY*) can create tournaments.`
    );
  }
  if (me !== be) {
    throw new Error(
      `Tournament escrow signer is ${wallet.address} but on-chain backend is ${onChainBackend}. ` +
        `Either: (1) as owner ${onChainOwner}, call setBackend("${wallet.address}") on the escrow, or ` +
        `(2) set TOURNAMENT_ESCROW_SIGNER_PRIVATE_KEY* to the private key for ${onChainBackend}.`
    );
  }
}

function getEscrowContract(chain) {
  const { rpcUrl, privateKey, tournamentEscrowSignerPrivateKey, chainId, tournamentEscrowAddress, isConfigured } =
    getChainConfig(chain);
  if (!isConfigured || !tournamentEscrowAddress) {
    return null;
  }
  const pkRaw = tournamentEscrowSignerPrivateKey ?? privateKey;
  if (!pkRaw) return null;
  const pk = String(pkRaw).startsWith("0x") ? pkRaw : `0x${pkRaw}`;
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
  const pk = cfg.tournamentEscrowSignerPrivateKey ?? cfg.privateKey;
  return Boolean(cfg.isConfigured && cfg.tournamentEscrowAddress && pk);
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
    await assertEscrowSignerAuthorized(chain);
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
    await assertEscrowSignerAuthorized(chain);
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
