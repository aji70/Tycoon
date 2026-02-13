/**
 * Tycoon contract interaction (Celo).
 * Requires BACKEND_GAME_CONTROLLER_PRIVATE_KEY to be set as game controller on the contract.
 * Used for: setTurnCount, removePlayerFromGame, transferPropertyOwnership.
 * Creates fresh provider/wallet per call to avoid stale env and ensure Railway env is used.
 */
import { JsonRpcProvider, Wallet, Contract, Network } from "ethers";
import { getCeloConfig } from "../config/celo.js";
import logger from "../config/logger.js";

const TYCOON_ABI = [
  {
    type: "function",
    name: "setTurnCount",
    inputs: [
      { name: "gameId", type: "uint256", internalType: "uint256" },
      { name: "player", type: "address", internalType: "address" },
      { name: "count", type: "uint256", internalType: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "removePlayerFromGame",
    inputs: [
      { name: "gameId", type: "uint256", internalType: "uint256" },
      { name: "player", type: "address", internalType: "address" },
      { name: "turnCount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferPropertyOwnership",
    inputs: [
      { name: "sellerUsername", type: "string", internalType: "string" },
      { name: "buyerUsername", type: "string", internalType: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // Read (view) functions for config-test
  { type: "function", name: "owner", inputs: [], outputs: [{ name: "", type: "address", internalType: "address" }], stateMutability: "view" },
  { type: "function", name: "backendGameController", inputs: [], outputs: [{ name: "", type: "address", internalType: "address" }], stateMutability: "view" },
  { type: "function", name: "minStake", inputs: [], outputs: [{ name: "", type: "uint256", internalType: "uint256" }], stateMutability: "view" },
  { type: "function", name: "minTurnsForPerks", inputs: [], outputs: [{ name: "", type: "uint256", internalType: "uint256" }], stateMutability: "view" },
  { type: "function", name: "totalGames", inputs: [], outputs: [{ name: "", type: "uint256", internalType: "uint256" }], stateMutability: "view" },
  { type: "function", name: "totalUsers", inputs: [], outputs: [{ name: "", type: "uint256", internalType: "uint256" }], stateMutability: "view" },
  { type: "function", name: "getUser", inputs: [{ name: "username", type: "string", internalType: "string" }], outputs: [{ name: "", type: "tuple", internalType: "struct TycoonLib.User", components: [
    { name: "id", type: "uint256" }, { name: "username", type: "string" }, { name: "playerAddress", type: "address" }, { name: "registeredAt", type: "uint64" },
    { name: "gamesPlayed", type: "uint256" }, { name: "gamesWon", type: "uint256" }, { name: "gamesLost", type: "uint256" }, { name: "totalStaked", type: "uint256" },
    { name: "totalEarned", type: "uint256" }, { name: "totalWithdrawn", type: "uint256" }, { name: "propertiesbought", type: "uint256" }, { name: "propertiesSold", type: "uint256" }
  ]}], stateMutability: "view" },
  { type: "function", name: "getGame", inputs: [{ name: "gameId", type: "uint256", internalType: "uint256" }], outputs: [{ name: "", type: "tuple", internalType: "struct TycoonLib.Game", components: [
    { name: "id", type: "uint256" }, { name: "code", type: "string" }, { name: "creator", type: "address" }, { name: "status", type: "uint8" },
    { name: "winner", type: "address" }, { name: "numberOfPlayers", type: "uint8" }, { name: "joinedPlayers", type: "uint8" }, { name: "mode", type: "uint8" },
    { name: "ai", type: "bool" }, { name: "stakePerPlayer", type: "uint256" }, { name: "totalStaked", type: "uint256" }, { name: "createdAt", type: "uint64" }, { name: "endedAt", type: "uint64" }
  ]}], stateMutability: "view" },
  { type: "function", name: "getGameByCode", inputs: [{ name: "code", type: "string", internalType: "string" }], outputs: [{ name: "", type: "tuple", internalType: "struct TycoonLib.Game", components: [
    { name: "id", type: "uint256" }, { name: "code", type: "string" }, { name: "creator", type: "address" }, { name: "status", type: "uint8" },
    { name: "winner", type: "address" }, { name: "numberOfPlayers", type: "uint8" }, { name: "joinedPlayers", type: "uint8" }, { name: "mode", type: "uint8" },
    { name: "ai", type: "bool" }, { name: "stakePerPlayer", type: "uint256" }, { name: "totalStaked", type: "uint256" }, { name: "createdAt", type: "uint64" }, { name: "endedAt", type: "uint64" }
  ]}], stateMutability: "view" },
  { type: "function", name: "getGamePlayer", inputs: [
    { name: "gameId", type: "uint256", internalType: "uint256" },
    { name: "player", type: "address", internalType: "address" }
  ], outputs: [{ name: "", type: "tuple", internalType: "struct TycoonLib.GamePlayer", components: [
    { name: "gameId", type: "uint256" }, { name: "playerAddress", type: "address" }, { name: "balance", type: "uint256" }, { name: "position", type: "uint8" },
    { name: "order", type: "uint8" }, { name: "symbol", type: "uint8" }, { name: "username", type: "string" }
  ]}], stateMutability: "view" },
  { type: "function", name: "getPlayersInGame", inputs: [{ name: "gameId", type: "uint256", internalType: "uint256" }], outputs: [{ name: "", type: "address[]", internalType: "address[]" }], stateMutability: "view" },
  { type: "function", name: "getLastGameCode", inputs: [{ name: "user", type: "address", internalType: "address" }], outputs: [{ name: "", type: "string", internalType: "string" }], stateMutability: "view" },
];

// Celo chain IDs: 42220 mainnet, 44787 Alfajores testnet
const CELO_MAINNET_CHAIN_ID = 42220;
const CELO_ALFAJORES_CHAIN_ID = 44787;

function getContract() {
  const { rpcUrl, contractAddress, privateKey, isConfigured } = getCeloConfig();
  if (!isConfigured) {
    throw new Error(
      "Tycoon contract not configured: set CELO_RPC_URL, TYCOON_CELO_CONTRACT_ADDRESS, and BACKEND_GAME_CONTROLLER_PRIVATE_KEY"
    );
  }
  const pk = String(privateKey).startsWith("0x") ? privateKey : `0x${privateKey}`;
  const network = new Network("celo", Number(process.env.CELO_CHAIN_ID) || CELO_MAINNET_CHAIN_ID);
  const provider = new JsonRpcProvider(rpcUrl, network);
  const wallet = new Wallet(pk, provider);
  const contract = new Contract(contractAddress, TYCOON_ABI, wallet);
  return contract;
}

/** Test RPC connection and wallet; returns { ok, error } for debugging */
export async function testContractConnection() {
  try {
    const { rpcUrl, contractAddress, privateKey, isConfigured } = getCeloConfig();
    if (!isConfigured) {
      return { ok: false, error: "Env not configured (CELO_RPC_URL, TYCOON_CELO_CONTRACT_ADDRESS, BACKEND_GAME_CONTROLLER_PRIVATE_KEY)" };
    }
    const pk = String(privateKey).startsWith("0x") ? privateKey : `0x${privateKey}`;
    const network = new Network("celo", Number(process.env.CELO_CHAIN_ID) || CELO_MAINNET_CHAIN_ID);
    const provider = new JsonRpcProvider(rpcUrl, network);
    const blockNumber = await provider.getBlockNumber();
    const wallet = new Wallet(pk, provider);
    const address = await wallet.getAddress();
    const balance = await provider.getBalance(address);
    return {
      ok: true,
      blockNumber: Number(blockNumber),
      walletAddress: address,
      balance: balance.toString(),
      contractAddress,
    };
  } catch (err) {
    logger.warn({ err: err.message }, "testContractConnection failed");
    return { ok: false, error: err.message };
  }
}

/**
 * Set on-chain turn count for a player (call once when they reach min turns, e.g. 20).
 * @param {string|bigint} gameId - On-chain game id
 * @param {string} playerAddress - Player wallet address (0x...)
 * @param {number|string} count - Turn count (e.g. 20)
 * @returns {Promise<{ hash: string }>} Transaction receipt / hash
 */
export async function setTurnCount(gameId, playerAddress, count) {
  const tycoon = getContract();
  const tx = await tycoon.setTurnCount(
    BigInt(gameId),
    playerAddress,
    BigInt(count)
  );
  const receipt = await tx.wait();
  logger.info(
    { gameId: String(gameId), player: playerAddress, count, hash: receipt?.hash },
    "Tycoon setTurnCount tx"
  );
  return { hash: receipt?.hash };
}

/**
 * Remove a player from the game on-chain (vote-out / stall). Payout uses turnCount for min-turns check.
 * @param {string|bigint} gameId - On-chain game id
 * @param {string} playerAddress - Player wallet address (0x...)
 * @param {number|string} turnCount - Turn count from your DB (for min-turns perk check)
 * @returns {Promise<{ hash: string, removed: boolean }>}
 */
export async function removePlayerFromGame(gameId, playerAddress, turnCount) {
  const tycoon = getContract();
  const tx = await tycoon.removePlayerFromGame(
    BigInt(gameId),
    playerAddress,
    BigInt(turnCount)
  );
  const receipt = await tx.wait();
  const removed = receipt?.status === 1;
  logger.info(
    {
      gameId: String(gameId),
      player: playerAddress,
      turnCount,
      hash: receipt?.hash,
      removed,
    },
    "Tycoon removePlayerFromGame tx"
  );
  return { hash: receipt?.hash, removed };
}

/**
 * Update on-chain property stats when a player-to-player sale happens (sellerUsername -> buyerUsername).
 * @param {string} sellerUsername - On-chain registered username of seller
 * @param {string} buyerUsername - On-chain registered username of buyer
 * @returns {Promise<{ hash: string }>}
 */
export async function transferPropertyOwnership(
  sellerUsername,
  buyerUsername
) {
  const tycoon = getContract();
  const tx = await tycoon.transferPropertyOwnership(
    sellerUsername,
    buyerUsername
  );
  const receipt = await tx.wait();
  logger.info(
    {
      sellerUsername,
      buyerUsername,
      hash: receipt?.hash,
    },
    "Tycoon transferPropertyOwnership tx"
  );
  return { hash: receipt?.hash };
}

/**
 * Whether backend contract integration is configured (env vars set).
 */
export function isContractConfigured() {
  return getCeloConfig().isConfigured;
}

const ALLOWED_READ_FNS = [
  "owner",
  "backendGameController",
  "minStake",
  "minTurnsForPerks",
  "totalGames",
  "totalUsers",
  "getUser",
  "getGame",
  "getGameByCode",
  "getGamePlayer",
  "getPlayersInGame",
  "getLastGameCode",
];

/**
 * Call a read-only contract function. Used by config-test for manual testing.
 * @param {string} fn - Function name (must be in ALLOWED_READ_FNS)
 * @param {Array} params - Arguments array (strings converted where needed)
 * @returns {Promise<unknown>} Raw result (may be object, array, bigint, string, etc.)
 */
export async function callContractRead(fn, params = []) {
  if (!ALLOWED_READ_FNS.includes(fn)) {
    throw new Error(`Unknown read function: ${fn}. Allowed: ${ALLOWED_READ_FNS.join(", ")}`);
  }
  const tycoon = getContract();

  // Normalize params by type
  const normalized = params.map((p, i) => {
    if (typeof p === "number" || (typeof p === "string" && /^\d+$/.test(String(p))))
      return BigInt(p);
    return p;
  });

  let result;
  switch (fn) {
    case "owner":
    case "backendGameController":
    case "minStake":
    case "minTurnsForPerks":
    case "totalGames":
    case "totalUsers":
      result = await tycoon[fn]();
      break;
    case "getUser":
      result = await tycoon.getUser(normalized[0] ?? "");
      break;
    case "getGame":
      result = await tycoon.getGame(normalized[0] ?? 0n);
      break;
    case "getGameByCode":
      result = await tycoon.getGameByCode(normalized[0] ?? "");
      break;
    case "getGamePlayer":
      result = await tycoon.getGamePlayer(normalized[0] ?? 0n, normalized[1] ?? "0x0");
      break;
    case "getPlayersInGame":
      result = await tycoon.getPlayersInGame(normalized[0] ?? 0n);
      break;
    case "getLastGameCode":
      result = await tycoon.getLastGameCode(normalized[0] ?? "0x0");
      break;
    default:
      throw new Error(`Unhandled read function: ${fn}`);
  }

  // Serialize bigints and structs for JSON
  return serializeContractResult(result);
}

function serializeContractResult(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === "bigint") return val.toString();
  if (Array.isArray(val)) return val.map(serializeContractResult);
  if (typeof val === "object" && val.constructor?.name === "Result") {
    const arr = [...val];
    const obj = {};
    for (let i = 0; i < arr.length; i++) obj[i] = serializeContractResult(arr[i]);
    if (Object.keys(val).filter((k) => !/^\d+$/.test(k)).length) {
      for (const k of Object.keys(val)) if (!/^\d+$/.test(k)) obj[k] = serializeContractResult(val[k]);
    }
    return obj;
  }
  if (typeof val === "object") {
    const out = {};
    for (const k of Object.keys(val)) out[k] = serializeContractResult(val[k]);
    return out;
  }
  return val;
}
