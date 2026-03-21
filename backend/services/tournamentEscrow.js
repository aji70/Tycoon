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

const TOURNAMENT_STORAGE_ABI = [
  {
    type: "function",
    name: "tournaments",
    inputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    outputs: [
      { name: "entryFee", type: "uint256", internalType: "uint256" },
      { name: "prizePoolDeposited", type: "uint256", internalType: "uint256" },
      { name: "totalEntryFees", type: "uint256", internalType: "uint256" },
      { name: "status", type: "uint8", internalType: "uint8" },
      { name: "creator", type: "address", internalType: "address" },
    ],
    stateMutability: "view",
  },
];

const ESCROW_ABI = [
  ...TOURNAMENT_STORAGE_ABI,
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
  {
    type: "function",
    name: "lockTournament",
    inputs: [{ name: "tournamentId", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "finalizeTournament",
    inputs: [
      { name: "tournamentId", type: "uint256", internalType: "uint256" },
      { name: "recipients", type: "address[]", internalType: "address[]" },
      { name: "amounts", type: "uint256[]", internalType: "uint256[]" },
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

/** On-chain enum TycoonTournamentEscrow.TournamentStatus */
const ESCROW_STATUS = { NONE: 0, OPEN: 1, LOCKED: 2, FINALIZED: 3, CANCELLED: 4 };

function getEscrowReadOnlyContract(chain) {
  const { rpcUrl, chainId, tournamentEscrowAddress } = getChainConfig(chain);
  if (!rpcUrl || !tournamentEscrowAddress) return null;
  const networkName = CHAIN_NAMES[String(chain).toUpperCase()] || "celo";
  const network = new Network(networkName, chainId);
  const provider = new JsonRpcProvider(rpcUrl, network);
  return new Contract(tournamentEscrowAddress, TOURNAMENT_STORAGE_ABI, provider);
}

/**
 * Read escrow ledger row for a tournament id (entry fees + status).
 * @returns {Promise<{ entryFee: bigint, prizePoolDeposited: bigint, totalEntryFees: bigint, status: number, creator: string } | null>}
 */
export async function readEscrowTournamentLedger(tournamentId, chain) {
  const read = getEscrowReadOnlyContract(chain);
  if (!read) return null;
  try {
    const row = await read.tournaments(BigInt(tournamentId));
    const entryFee = row.entryFee ?? row[0];
    const prizePoolDeposited = row.prizePoolDeposited ?? row[1];
    const totalEntryFees = row.totalEntryFees ?? row[2];
    const status = row.status ?? row[3];
    const creator = row.creator ?? row[4];
    return {
      entryFee: BigInt(entryFee),
      prizePoolDeposited: BigInt(prizePoolDeposited),
      totalEntryFees: BigInt(totalEntryFees),
      status: Number(status),
      creator: String(creator),
    };
  } catch (err) {
    logger.warn({ err: err?.message, tournamentId, chain }, "readEscrowTournamentLedger failed");
    return null;
  }
}

/**
 * Lock tournament on-chain (no more registrations). Backend/owner only.
 * @returns {Promise<{ hash: string } | null>}
 */
export async function lockTournamentOnChain(tournamentId, chain) {
  const escrow = getEscrowContract(chain);
  if (!escrow) return null;
  return withTxQueue(async () => {
    await assertEscrowSignerAuthorized(chain);
    const tx = await escrow.lockTournament(BigInt(tournamentId));
    const receipt = await tx.wait();
    logger.info({ tournamentId, chain, hash: receipt?.hash }, "Escrow lockTournament tx");
    return { hash: receipt?.hash };
  });
}

/**
 * Finalize and transfer USDC from escrow to recipients. Tournament must be Locked.
 * @param {number} tournamentId
 * @param {string[]} recipients
 * @param {bigint[]} amountsWei
 * @param {string} chain
 */
export async function finalizeTournamentOnChain(tournamentId, recipients, amountsWei, chain) {
  const escrow = getEscrowContract(chain);
  if (!escrow) return null;
  return withTxQueue(async () => {
    await assertEscrowSignerAuthorized(chain);
    const tx = await escrow.finalizeTournament(BigInt(tournamentId), recipients, amountsWei);
    const receipt = await tx.wait();
    logger.info(
      { tournamentId, chain, recipientCount: recipients.length, hash: receipt?.hash },
      "Escrow finalizeTournament tx"
    );
    return { hash: receipt?.hash };
  });
}

/**
 * If this tournament has funds on the escrow ledger, lock (when Open) and finalize payouts.
 * Skips when escrow is not configured, tournament was never opened on-chain, ledger pool is zero (legacy raw transfers), or already finalized.
 *
 * @param {number} tournamentId
 * @param {string} chain
 * @param {Array<{ address: string, amountWei: number }>} plan — recipients and USDC amounts (6-decimal integer wei)
 * @returns {Promise<{ skipped?: boolean, reason?: string, lockHash?: string, finalizeHash?: string }>}
 */
export async function lockAndFinalizeTournamentOnEscrow(tournamentId, chain, plan) {
  if (!isEscrowConfigured(chain)) {
    return { skipped: true, reason: "escrow_not_configured" };
  }

  const ledger = await readEscrowTournamentLedger(tournamentId, chain);
  if (!ledger) {
    return { skipped: true, reason: "read_failed" };
  }

  const poolOnBooks = ledger.totalEntryFees + ledger.prizePoolDeposited;
  if (poolOnBooks === 0n) {
    logger.info({ tournamentId, chain }, "Escrow ledger pool is zero; skipping on-chain finalize (legacy stake path or free tournament)");
    return { skipped: true, reason: "zero_onchain_pool" };
  }

  if (ledger.status === ESCROW_STATUS.FINALIZED || ledger.status === ESCROW_STATUS.CANCELLED) {
    return { skipped: true, reason: "already_finalized_or_cancelled" };
  }

  const ZERO = "0x0000000000000000000000000000000000000000";
  const recipients = [];
  const amounts = [];
  let sum = 0n;
  for (const row of plan || []) {
    const addr = row?.address && String(row.address).trim();
    const amt = Math.floor(Number(row?.amountWei) || 0);
    if (!addr || addr.toLowerCase() === ZERO.toLowerCase() || amt <= 0) continue;
    recipients.push(addr);
    amounts.push(BigInt(amt));
    sum += BigInt(amt);
  }

  if (recipients.length === 0) {
    return { skipped: true, reason: "no_recipients" };
  }

  if (sum > poolOnBooks) {
    throw new Error(
      `Escrow finalize: payout sum ${sum} exceeds on-chain pool ${poolOnBooks} for tournament ${tournamentId}`
    );
  }

  let lockHash;
  if (ledger.status === ESCROW_STATUS.OPEN) {
    try {
      const lockRes = await lockTournamentOnChain(tournamentId, chain);
      lockHash = lockRes?.hash;
    } catch (err) {
      const msg = `${err?.shortMessage || ""} ${err?.message || ""}`;
      if (msg.includes("Not open")) {
        logger.warn({ tournamentId, chain }, "lockTournament reverted Not open; assuming already locked");
      } else {
        throw err;
      }
    }
  } else if (ledger.status !== ESCROW_STATUS.LOCKED) {
    throw new Error(
      `Escrow finalize: tournament ${tournamentId} on-chain status ${ledger.status} is not Open or Locked`
    );
  }

  const fin = await finalizeTournamentOnChain(tournamentId, recipients, amounts, chain);
  return { lockHash, finalizeHash: fin?.hash };
}
