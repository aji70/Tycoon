/**
 * Tycoon contract interaction (Celo).
 * Requires BACKEND_GAME_CONTROLLER_PRIVATE_KEY to be set as game controller on the contract.
 * Used for: setTurnCount, removePlayerFromGame, transferPropertyOwnership.
 * Creates fresh provider/wallet per call to avoid stale env and ensure Railway env is used.
 *
 * Concurrency: All writes from the backend wallet are serialized via withTxQueue() so that
 * only one transaction is in flight at a time. This prevents nonce collisions when many
 * guests (or other backend-triggered actions) hit the API at once.
 */
import { JsonRpcProvider, Wallet, Contract, Network } from "ethers";
import { getCeloConfig } from "../config/celo.js";
import logger from "../config/logger.js";

/** Serialize backend wallet transactions to avoid nonce collisions under concurrent load. */
let txQueue = Promise.resolve();

function withTxQueue(fn) {
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
  {
    type: "function",
    name: "registerPlayer",
    inputs: [{ name: "username", type: "string", internalType: "string" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "registerPlayerFor",
    inputs: [
      { name: "playerAddress", type: "address", internalType: "address" },
      { name: "username", type: "string", internalType: "string" },
      { name: "passwordHash", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "createGameByBackend",
    inputs: [
      { name: "forPlayer", type: "address", internalType: "address" },
      { name: "forUsername", type: "string", internalType: "string" },
      { name: "passwordHash", type: "bytes32", internalType: "bytes32" },
      { name: "creatorUsername", type: "string", internalType: "string" },
      { name: "gameType", type: "string", internalType: "string" },
      { name: "playerSymbol", type: "string", internalType: "string" },
      { name: "numberOfPlayers", type: "uint8", internalType: "uint8" },
      { name: "code", type: "string", internalType: "string" },
      { name: "startingBalance", type: "uint256", internalType: "uint256" },
      { name: "stakeAmount", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "gameId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "joinGameByBackend",
    inputs: [
      { name: "forPlayer", type: "address", internalType: "address" },
      { name: "forUsername", type: "string", internalType: "string" },
      { name: "passwordHash", type: "bytes32", internalType: "bytes32" },
      { name: "gameId", type: "uint256", internalType: "uint256" },
      { name: "playerUsername", type: "string", internalType: "string" },
      { name: "playerSymbol", type: "string", internalType: "string" },
      { name: "joinCode", type: "string", internalType: "string" },
    ],
    outputs: [{ name: "order", type: "uint8", internalType: "uint8" }],
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
  { type: "function", name: "getGameSettings", inputs: [{ name: "gameId", type: "uint256", internalType: "uint256" }], outputs: [{ name: "", type: "tuple", internalType: "struct TycoonLib.GameSettings", components: [
    { name: "maxPlayers", type: "uint8" }, { name: "auction", type: "bool" }, { name: "rentInPrison", type: "bool" }, { name: "mortgage", type: "bool" },
    { name: "evenBuild", type: "bool" }, { name: "startingCash", type: "uint256" }, { name: "privateRoomCode", type: "string" }
  ]}], stateMutability: "view" },
  { type: "function", name: "TOKEN_REWARD", inputs: [], outputs: [{ name: "", type: "uint256", internalType: "uint256" }], stateMutability: "view" },
  { type: "function", name: "rewardSystem", inputs: [], outputs: [{ name: "", type: "address", internalType: "contract TycoonRewardSystem" }], stateMutability: "view" },
  { type: "function", name: "houseUSDC", inputs: [], outputs: [{ name: "", type: "uint256", internalType: "uint256" }], stateMutability: "view" },
  { type: "function", name: "registered", inputs: [{ name: "", type: "address", internalType: "address" }], outputs: [{ name: "", type: "bool", internalType: "bool" }], stateMutability: "view" },
  { type: "function", name: "addressToUsername", inputs: [{ name: "", type: "address", internalType: "address" }], outputs: [{ name: "", type: "string", internalType: "string" }], stateMutability: "view" },
  { type: "function", name: "turnsPlayed", inputs: [{ name: "", type: "uint256" }, { name: "", type: "address" }], outputs: [{ name: "", type: "uint256", internalType: "uint256" }], stateMutability: "view" },
  // Write functions
  { type: "function", name: "createGame", inputs: [
    { name: "creatorUsername", type: "string" }, { name: "gameType", type: "string" }, { name: "playerSymbol", type: "string" },
    { name: "numberOfPlayers", type: "uint8" }, { name: "code", type: "string" }, { name: "startingBalance", type: "uint256" }, { name: "stakeAmount", type: "uint256" }
  ], outputs: [{ name: "gameId", type: "uint256" }], stateMutability: "nonpayable" },
  { type: "function", name: "createAIGame", inputs: [
    { name: "creatorUsername", type: "string" }, { name: "gameType", type: "string" }, { name: "playerSymbol", type: "string" },
    { name: "numberOfAI", type: "uint8" }, { name: "code", type: "string" }, { name: "startingBalance", type: "uint256" }
  ], outputs: [{ name: "gameId", type: "uint256" }], stateMutability: "nonpayable" },
  {
    type: "function",
    name: "createAIGameByBackend",
    inputs: [
      { name: "forPlayer", type: "address", internalType: "address" },
      { name: "forUsername", type: "string", internalType: "string" },
      { name: "passwordHash", type: "bytes32", internalType: "bytes32" },
      { name: "creatorUsername", type: "string", internalType: "string" },
      { name: "gameType", type: "string", internalType: "string" },
      { name: "playerSymbol", type: "string", internalType: "string" },
      { name: "numberOfAI", type: "uint8", internalType: "uint8" },
      { name: "code", type: "string", internalType: "string" },
      { name: "startingBalance", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "gameId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  { type: "function", name: "joinGame", inputs: [
    { name: "gameId", type: "uint256" }, { name: "playerUsername", type: "string" }, { name: "playerSymbol", type: "string" }, { name: "joinCode", type: "string" }
  ], outputs: [{ name: "order", type: "uint8" }], stateMutability: "nonpayable" },
  { type: "function", name: "leavePendingGame", inputs: [{ name: "gameId", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "exitGame", inputs: [{ name: "gameId", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "exitGameByBackend", inputs: [
    { name: "forPlayer", type: "address", internalType: "address" },
    { name: "forUsername", type: "string", internalType: "string" },
    { name: "passwordHash", type: "bytes32", internalType: "bytes32" },
    { name: "gameId", type: "uint256", internalType: "uint256" },
  ], outputs: [{ name: "", type: "bool", internalType: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "endAIGame", inputs: [
    { name: "gameId", type: "uint256" }, { name: "finalPosition", type: "uint8" }, { name: "finalBalance", type: "uint256" }, { name: "isWin", type: "bool" }
  ], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "endAIGameByBackend", inputs: [
    { name: "forPlayer", type: "address", internalType: "address" },
    { name: "forUsername", type: "string", internalType: "string" },
    { name: "passwordHash", type: "bytes32", internalType: "bytes32" },
    { name: "gameId", type: "uint256", internalType: "uint256" },
    { name: "finalPosition", type: "uint8", internalType: "uint8" },
    { name: "finalBalance", type: "uint256", internalType: "uint256" },
    { name: "isWin", type: "bool", internalType: "bool" },
  ], outputs: [{ name: "", type: "bool", internalType: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "setBackendGameController", inputs: [{ name: "newController", type: "address" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "setMinTurnsForPerks", inputs: [{ name: "newMin", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "setMinStake", inputs: [{ name: "newMinStake", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "withdrawHouse", inputs: [{ name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "drainContract", inputs: [], outputs: [], stateMutability: "nonpayable" },
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
  return withTxQueue(async () => {
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
  });
}

/**
 * Remove a player from the game on-chain (vote-out / stall). Payout uses turnCount for min-turns check.
 * @param {string|bigint} gameId - On-chain game id
 * @param {string} playerAddress - Player wallet address (0x...)
 * @param {number|string} turnCount - Turn count from your DB (for min-turns perk check)
 * @returns {Promise<{ hash: string, removed: boolean }>}
 */
export async function removePlayerFromGame(gameId, playerAddress, turnCount) {
  return withTxQueue(async () => {
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
  });
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
  return withTxQueue(async () => {
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
  });
}

/**
 * Register a player on behalf of an address (guest flow). Backend must be game controller.
 * @param {string} playerAddress - Custodial wallet address
 * @param {string} username - Username
 * @param {string} passwordHash - keccak256 hash of password (0x-prefixed hex 32 bytes)
 */
export async function registerPlayerFor(playerAddress, username, passwordHash) {
  return withTxQueue(async () => {
    const tycoon = getContract();
    const tx = await tycoon.registerPlayerFor(playerAddress, username, passwordHash);
    const receipt = await tx.wait();
    logger.info({ playerAddress, username, hash: receipt?.hash }, "Tycoon registerPlayerFor tx");
    return { hash: receipt?.hash };
  });
}

/**
 * Create game on behalf of a player (guest). Uses forPlayer with empty forUsername.
 * Returns gameId from GameCreated event.
 */
export async function createGameByBackend(
  forPlayer,
  passwordHash,
  creatorUsername,
  gameType,
  playerSymbol,
  numberOfPlayers,
  code,
  startingBalance,
  stakeAmount
) {
  return withTxQueue(async () => {
    const tycoon = getContract();
    const tx = await tycoon.createGameByBackend(
      forPlayer,
      "", // forUsername
      passwordHash,
      creatorUsername,
      gameType,
      playerSymbol,
      Number(numberOfPlayers),
      code,
      BigInt(startingBalance),
      BigInt(stakeAmount)
    );
    const receipt = await tx.wait();
    let newGameId;
    try {
      const iface = new ethers.Interface([
        "event GameCreated(uint256 indexed gameId, address indexed creator, uint64 timestamp)",
      ]);
      for (const log of receipt.logs || []) {
        try {
          const parsed = iface.parseLog({ topics: log.topics, data: log.data });
          if (parsed?.name === "GameCreated" && parsed.args?.gameId != null) {
            newGameId = String(parsed.args.gameId);
            break;
          }
        } catch (_) {}
      }
    } catch (_) {}
    logger.info({ forPlayer, code, gameId: newGameId, hash: receipt?.hash }, "Tycoon createGameByBackend tx");
    return { hash: receipt?.hash, gameId: newGameId };
  });
}

/**
 * Join game on behalf of a player (guest).
 */
export async function joinGameByBackend(
  forPlayer,
  passwordHash,
  gameId,
  playerUsername,
  playerSymbol,
  joinCode
) {
  return withTxQueue(async () => {
    const tycoon = getContract();
    const tx = await tycoon.joinGameByBackend(
      forPlayer,
      "",
      passwordHash,
      BigInt(gameId),
      playerUsername,
      playerSymbol,
      joinCode || ""
    );
    const receipt = await tx.wait();
    logger.info({ forPlayer, gameId, hash: receipt?.hash }, "Tycoon joinGameByBackend tx");
    return { hash: receipt?.hash };
  });
}

/**
 * Create AI game on behalf of a player (guest).
 */
export async function createAIGameByBackend(
  forPlayer,
  passwordHash,
  creatorUsername,
  gameType,
  playerSymbol,
  numberOfAI,
  code,
  startingBalance
) {
  return withTxQueue(async () => {
    const tycoon = getContract();
    const tx = await tycoon.createAIGameByBackend(
      forPlayer,
      "",
      passwordHash,
      creatorUsername,
      gameType,
      playerSymbol,
      Number(numberOfAI),
      code,
      BigInt(startingBalance)
    );
    const receipt = await tx.wait();
    let newGameId;
    try {
      const iface = new ethers.Interface([
        "event GameCreated(uint256 indexed gameId, address indexed creator, uint64 timestamp)",
      ]);
      for (const log of receipt.logs || []) {
        try {
          const parsed = iface.parseLog({ topics: log.topics, data: log.data });
          if (parsed?.name === "GameCreated" && parsed.args?.gameId != null) {
            newGameId = String(parsed.args.gameId);
            break;
          }
        } catch (_) {}
      }
    } catch (_) {}
    logger.info({ forPlayer, code, gameId: newGameId, hash: receipt?.hash }, "Tycoon createAIGameByBackend tx");
    return { hash: receipt?.hash, gameId: newGameId };
  });
}

/**
 * End AI game on-chain on behalf of the human player (e.g. when game ends by time).
 * Requires the player's password hash (guests have it in DB). Idempotent if game already ended on-chain.
 */
export async function endAIGameByBackend(forPlayer, forUsername, passwordHash, gameId, finalPosition, finalBalance, isWin) {
  return withTxQueue(async () => {
    const tycoon = getContract();
    const tx = await tycoon.endAIGameByBackend(
      forPlayer,
      forUsername || "",
      passwordHash,
      BigInt(gameId),
      Number(finalPosition ?? 0),
      BigInt(finalBalance ?? 0),
      Boolean(isWin)
    );
    const receipt = await tx.wait();
    logger.info({ forPlayer, gameId, isWin, hash: receipt?.hash }, "Tycoon endAIGameByBackend tx");
    return { hash: receipt?.hash };
  });
}

/**
 * Exit game on-chain on behalf of a player (e.g. when multiplayer game ends and winner is the last one).
 * Requires the player's password hash (guests have it in DB). Ends the game and pays out the winner.
 */
export async function exitGameByBackend(forPlayer, forUsername, passwordHash, gameId) {
  return withTxQueue(async () => {
    const tycoon = getContract();
    const tx = await tycoon.exitGameByBackend(
      forPlayer,
      forUsername || "",
      passwordHash,
      BigInt(gameId)
    );
    const receipt = await tx.wait();
    logger.info({ forPlayer, gameId, hash: receipt?.hash }, "Tycoon exitGameByBackend tx");
    return { hash: receipt?.hash };
  });
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
  "TOKEN_REWARD",
  "rewardSystem",
  "houseUSDC",
  "getUser",
  "getGame",
  "getGameByCode",
  "getGamePlayer",
  "getPlayersInGame",
  "getLastGameCode",
  "getGameSettings",
  "registered",
  "addressToUsername",
  "turnsPlayed",
];

const ALLOWED_WRITE_FNS = [
  "registerPlayer",
  "transferPropertyOwnership",
  "setTurnCount",
  "removePlayerFromGame",
  "createGame",
  "createAIGame",
  "joinGame",
  "leavePendingGame",
  "exitGame",
  "endAIGame",
  "setBackendGameController",
  "setMinTurnsForPerks",
  "setMinStake",
  "withdrawHouse",
  "drainContract",
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
    case "TOKEN_REWARD":
    case "rewardSystem":
    case "houseUSDC":
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
    case "getGameSettings":
      result = await tycoon.getGameSettings(normalized[0] ?? 0n);
      break;
    case "registered":
      result = await tycoon.registered(normalized[0] ?? "0x0");
      break;
    case "addressToUsername":
      result = await tycoon.addressToUsername(normalized[0] ?? "0x0");
      break;
    case "turnsPlayed":
      result = await tycoon.turnsPlayed(normalized[0] ?? 0n, normalized[1] ?? "0x0");
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

/**
 * Call a state-changing contract function. Used by config-test for manual testing.
 * Sends a transaction; returns receipt info or throws on revert.
 * @param {string} fn - Function name (must be in ALLOWED_WRITE_FNS)
 * @param {Array} params - Arguments array (strings/numbers converted where needed)
 * @returns {Promise<{ hash: string; status?: number; blockNumber?: number }>}
 */
export async function callContractWrite(fn, params = []) {
  return withTxQueue(async () => {
    if (!ALLOWED_WRITE_FNS.includes(fn)) {
      throw new Error(`Unknown write function: ${fn}. Allowed: ${ALLOWED_WRITE_FNS.join(", ")}`);
    }
    const tycoon = getContract();

    const normalized = params.map((p) => {
      if (p === true || p === false) return p;
      if (typeof p === "string" && (p === "true" || p === "false")) return p === "true";
      if (typeof p === "number" || (typeof p === "string" && /^\d+$/.test(String(p))))
        return BigInt(p);
      return p ?? "";
    });

    let tx;
    switch (fn) {
    case "registerPlayer":
      tx = await tycoon.registerPlayer(normalized[0] ?? "");
      break;
    case "transferPropertyOwnership":
      tx = await tycoon.transferPropertyOwnership(normalized[0] ?? "", normalized[1] ?? "");
      break;
    case "setTurnCount":
      tx = await tycoon.setTurnCount(normalized[0] ?? 0n, normalized[1] ?? "0x0", normalized[2] ?? 0n);
      break;
    case "removePlayerFromGame":
      tx = await tycoon.removePlayerFromGame(normalized[0] ?? 0n, normalized[1] ?? "0x0", normalized[2] ?? 0n);
      break;
    case "createGame":
      tx = await tycoon.createGame(
        normalized[0] ?? "",
        normalized[1] ?? "PUBLIC",
        normalized[2] ?? "hat",
        Number(normalized[3] ?? 2),
        normalized[4] ?? "",
        normalized[5] ?? 1500n,
        normalized[6] ?? 0n
      );
      break;
    case "createAIGame":
      tx = await tycoon.createAIGame(
        normalized[0] ?? "",
        normalized[1] ?? "PUBLIC",
        normalized[2] ?? "hat",
        Number(normalized[3] ?? 1),
        normalized[4] ?? "",
        normalized[5] ?? 1500n
      );
      break;
    case "joinGame":
      tx = await tycoon.joinGame(
        normalized[0] ?? 0n,
        normalized[1] ?? "",
        normalized[2] ?? "car",
        normalized[3] ?? ""
      );
      break;
    case "leavePendingGame":
      tx = await tycoon.leavePendingGame(normalized[0] ?? 0n);
      break;
    case "exitGame":
      tx = await tycoon.exitGame(normalized[0] ?? 0n);
      break;
    case "endAIGame":
      tx = await tycoon.endAIGame(
        normalized[0] ?? 0n,
        Number(normalized[1] ?? 1),
        normalized[2] ?? 0n,
        Boolean(normalized[3])
      );
      break;
    case "setBackendGameController":
      tx = await tycoon.setBackendGameController(normalized[0] ?? "0x0");
      break;
    case "setMinTurnsForPerks":
      tx = await tycoon.setMinTurnsForPerks(normalized[0] ?? 0n);
      break;
    case "setMinStake":
      tx = await tycoon.setMinStake(normalized[0] ?? 0n);
      break;
    case "withdrawHouse":
      tx = await tycoon.withdrawHouse(normalized[0] ?? 0n);
      break;
    case "drainContract":
      tx = await tycoon.drainContract();
      break;
    default:
      throw new Error(`Unhandled write function: ${fn}`);
    }

    const receipt = await tx.wait();
    return {
      hash: receipt?.hash,
      status: receipt?.status,
      blockNumber: receipt?.blockNumber ? Number(receipt.blockNumber) : undefined,
    };
  });
}
