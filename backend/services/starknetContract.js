/**
 * Tycoon Dojo (Cairo) contract interaction on Starknet.
 * Uses Starknet.js to call Tycoon game/player contracts on Starknet Sepolia.
 *
 * Requires env: STARKNET_RPC_URL, BACKEND_STARKNET_PRIVATE_KEY, BACKEND_STARKNET_ACCOUNT_ADDRESS.
 * Optional: STARKNET_DOJO_GAME_ADDRESS, STARKNET_DOJO_PLAYER_ADDRESS (defaults match manifest_sepolia).
 *
 * Concurrency: Writes are serialized via withTxQueue() to avoid nonce collisions.
 */
import { RpcProvider, Account, Contract, shortString } from "starknet";
import { getStarknetConfig } from "../config/starknet.js";
import logger from "../config/logger.js";

let provider = null;
let account = null;

function getProvider() {
  if (provider) return provider;
  const { rpcUrl, isConfigured } = getStarknetConfig();
  if (!isConfigured) return null;
  provider = new RpcProvider({ nodeUrl: rpcUrl });
  return provider;
}

function getAccount() {
  if (account) return account;
  const { rpcUrl, privateKey, accountAddress, isConfigured } = getStarknetConfig();
  if (!isConfigured || !privateKey || !accountAddress) return null;
  const p = getProvider();
  if (!p) return null;
  const pk = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  account = new Account(p, accountAddress, pk);
  return account;
}

/** Serialize backend Starknet transactions to avoid nonce collisions. */
let txQueue = Promise.resolve();

export function withTxQueueStarknet(fn) {
  const prev = txQueue;
  let resolveNext;
  txQueue = new Promise((r) => {
    resolveNext = r;
  });
  return prev
    .then(() => fn())
    .finally(() => {
      resolveNext();
    });
}

export function isStarknetConfigured() {
  return getStarknetConfig().isConfigured;
}

/** Normalize Starknet address to felt (0x + 64 hex). */
function addressToFelt(addr) {
  if (!addr || typeof addr !== "string") return 0n;
  const s = String(addr).trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]+$/.test(s)) return 0n;
  const padded = s.padStart(64, "0");
  return BigInt("0x" + padded);
}

/** Encode string as shortstring felt (for username, code). */
function stringToFelt(str) {
  if (!str || typeof str !== "string") return 0n;
  try {
    return BigInt(shortString.encodeShortString(str.trim()));
  } catch {
    return 0n;
  }
}

// Minimal Cairo ABIs for Dojo game and player (entrypoints we use). Short types for Starknet.js.
const GAME_ABI = [
  {
    type: "function",
    name: "create_ai_game",
    inputs: [
      { name: "creator_username", type: "felt" },
      { name: "game_type", type: "felt" },
      { name: "player_symbol", type: "felt" },
      { name: "number_of_ai", type: "felt" },
      { name: "code", type: "felt" },
      { name: "starting_balance", type: "felt" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "get_game_by_code",
    inputs: [{ name: "code", type: "felt" }],
    outputs: [{ type: "felt" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_game",
    inputs: [{ name: "game_id", type: "u256" }],
    outputs: [{ type: "felt" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_players_in_game",
    inputs: [{ name: "game_id", type: "u256" }],
    outputs: [{ type: "felt" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_last_game_code",
    inputs: [{ name: "account", type: "felt" }],
    outputs: [{ type: "felt" }],
    state_mutability: "view",
  },
];

const PLAYER_ABI = [
  {
    type: "function",
    name: "register_player",
    inputs: [{ name: "username", type: "felt" }],
    outputs: [],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "is_registered",
    inputs: [{ name: "address", type: "felt" }],
    outputs: [{ type: "bool" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_username",
    inputs: [{ name: "address", type: "felt" }],
    outputs: [{ type: "felt" }],
    state_mutability: "view",
  },
];

function getGameContract() {
  const p = getProvider();
  const { gameAddress } = getStarknetConfig();
  if (!p || !gameAddress) return null;
  return new Contract(GAME_ABI, gameAddress, p);
}

function getPlayerContract() {
  const p = getProvider();
  const { playerAddress } = getStarknetConfig();
  if (!p || !playerAddress) return null;
  return new Contract(PLAYER_ABI, playerAddress, p);
}

function getGameContractWithAccount() {
  const acc = getAccount();
  const { gameAddress } = getStarknetConfig();
  if (!acc || !gameAddress) return null;
  return new Contract(GAME_ABI, gameAddress, acc);
}

function getPlayerContractWithAccount() {
  const acc = getAccount();
  const { playerAddress } = getStarknetConfig();
  if (!acc || !playerAddress) return null;
  return new Contract(PLAYER_ABI, playerAddress, acc);
}

/**
 * Read-only call to a Starknet contract.
 * @param {"game"|"player"} contractTag - Which Dojo contract
 * @param {string} method - Entrypoint name (snake_case)
 * @param {Array<bigint|string|number>} args - Calldata arguments
 * @returns {Promise<unknown>} Decoded result (bigint, array, etc.)
 */
export async function starknetCall(contractTag, method, args = []) {
  const contract =
    contractTag === "game" ? getGameContract() : getPlayerContract();
  if (!contract) {
    throw new Error("Starknet not configured or contract missing");
  }
  const result = await contract.call(method, args, {
    blockIdentifier: "latest",
  });
  return result;
}

/**
 * Register a player (Starknet/Dojo). Caller must be the account that will be registered.
 * @param {string} username - Username to register
 * @returns {Promise<{ transaction_hash: string }>}
 */
export async function registerPlayerStarknet(username) {
  return withTxQueueStarknet(async () => {
    const contract = getPlayerContractWithAccount();
    if (!contract) {
      throw new Error("Starknet not configured for writes (missing account/key)");
    }
    const usernameFelt = stringToFelt(username);
    const tx = await contract.register_player(usernameFelt);
    const hash = tx?.transaction_hash ?? tx?.hash;
    if (hash) {
      const p = getProvider();
      if (p) await p.waitForTransaction(hash);
      logger.info({ username, hash }, "Starknet register_player tx");
    }
    return { transaction_hash: hash, hash };
  });
}

/**
 * Create AI game on Starknet/Dojo. Backend account must be the creator (or have auth).
 * @param {object} params
 * @param {string} params.creatorUsername - Creator username (shortstring)
 * @param {string} params.gameType - "PUBLIC" or "PRIVATE" (felt: 0 or 1)
 * @param {string} params.playerSymbol - Symbol id e.g. "hat" (felt index)
 * @param {number} params.numberOfAi - Number of AI players
 * @param {string} params.code - Game code (shortstring)
 * @param {number|bigint} params.startingBalance - Starting cash
 * @returns {Promise<{ transaction_hash: string; gameId?: string }>}
 */
export async function createAiGameStarknet({
  creatorUsername,
  gameType,
  playerSymbol,
  numberOfAi,
  code,
  startingBalance,
}) {
  return withTxQueueStarknet(async () => {
    const contract = getGameContractWithAccount();
    if (!contract) {
      throw new Error("Starknet not configured for writes (missing account/key)");
    }
    const creatorFelt = stringToFelt(creatorUsername);
    const gameTypeFelt = String(gameType).toUpperCase() === "PRIVATE" ? 1n : 0n;
    const symbolFelt = BigInt(
      typeof playerSymbol === "string" ? symbolNameToIndex(playerSymbol) : playerSymbol
    );
    const codeFelt = stringToFelt(code);
    const balanceFelt = BigInt(startingBalance);

    const tx = await contract.create_ai_game(
      creatorFelt,
      gameTypeFelt,
      symbolFelt,
      BigInt(numberOfAi),
      codeFelt,
      balanceFelt
    );
    const hash = tx?.transaction_hash ?? tx?.hash;
    if (hash) {
      const p = getProvider();
      if (p) await p.waitForTransaction(hash);
      logger.info({ code, hash }, "Starknet create_ai_game tx");
    }

    let gameId;
    try {
      const res = await starknetCall("game", "get_game_by_code", [codeFelt]);
      const raw = res?.result ?? res?.[0] ?? res;
      if (raw != null) gameId = String(raw);
    } catch (_) {}

    return { transaction_hash: hash, hash, gameId };
  });
}

/** Map symbol name to Dojo index (match frontend GamePieces order if needed). */
function symbolNameToIndex(name) {
  const symbols = ["hat", "car", "ship", "dog", "cat", "boot", "thimble", "wheelbarrow"];
  const i = symbols.indexOf(String(name).toLowerCase());
  return i >= 0 ? i : 0;
}

/**
 * Get game by code (read-only).
 * @param {string} code - Game code
 * @returns {Promise<unknown>} Raw result (felt/game id or struct)
 */
export async function getGameByCodeStarknet(code) {
  const codeFelt = stringToFelt(code);
  return starknetCall("game", "get_game_by_code", [codeFelt]);
}

/**
 * Check if an address is registered (read-only).
 * @param {string} address - Starknet address
 * @returns {Promise<boolean>}
 */
export async function isRegisteredStarknet(address) {
  const addrFelt = addressToFelt(address);
  const res = await starknetCall("player", "is_registered", [addrFelt]);
  const raw = res?.result ?? res?.[0] ?? res;
  return raw === true || raw === 1n || raw === "1";
}

/**
 * Serialize contract result for JSON (bigint -> string).
 */
function serializeResult(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === "bigint") return val.toString();
  if (Array.isArray(val)) return val.map(serializeResult);
  if (typeof val === "object") {
    const out = {};
    for (const k of Object.keys(val)) out[k] = serializeResult(val[k]);
    return out;
  }
  return val;
}

/**
 * Generic read for config/test. Contract tag and method must be allowed.
 */
const ALLOWED_READS = [
  "game:get_game_by_code",
  "game:get_game",
  "game:get_players_in_game",
  "game:get_last_game_code",
  "player:is_registered",
  "player:get_username",
];

export async function starknetCallContractRead(contractTag, method, params = []) {
  const key = `${contractTag}:${method}`;
  if (!ALLOWED_READS.includes(key)) {
    throw new Error(`Starknet read not allowed: ${key}. Allowed: ${ALLOWED_READS.join(", ")}`);
  }
  const args = params.map((p) => {
    if (typeof p === "string" && p.startsWith("0x")) return addressToFelt(p);
    if (typeof p === "string") return stringToFelt(p);
    if (typeof p === "number" || (typeof p === "string" && /^\d+$/.test(String(p))))
      return BigInt(p);
    return p;
  });
  const result = await starknetCall(contractTag, method, args);
  return serializeResult(result);
}

/**
 * Test that Starknet RPC and contracts are reachable (e.g. one read call).
 * @returns {Promise<{ ok: boolean; error?: string }>}
 */
export async function testStarknetConnection() {
  if (!isStarknetConfigured()) {
    return { ok: false, error: "Starknet not configured (missing STARKNET_RPC_URL or BACKEND_STARKNET_PRIVATE_KEY)" };
  }
  try {
    await starknetCall("game", "get_game_by_code", [0n]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message ?? String(err) };
  }
}
