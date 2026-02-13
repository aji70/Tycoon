/**
 * Tycoon contract interaction (Celo).
 * Requires BACKEND_GAME_CONTROLLER_PRIVATE_KEY to be set as game controller on the contract.
 * Used for: setTurnCount, removePlayerFromGame, transferPropertyOwnership.
 */
import { JsonRpcProvider, Wallet, Contract } from "ethers";
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
];

let _provider = null;
let _wallet = null;
let _contract = null;

function getContract() {
  const { rpcUrl, contractAddress, privateKey, isConfigured } = getCeloConfig();
  if (!isConfigured) {
    throw new Error(
      "Tycoon contract not configured: set CELO_RPC_URL, TYCOON_CELO_CONTRACT_ADDRESS, and BACKEND_GAME_CONTROLLER_PRIVATE_KEY"
    );
  }
  if (!_provider) {
    _provider = new JsonRpcProvider(rpcUrl);
    _wallet = new Wallet(privateKey, _provider);
    _contract = new Contract(contractAddress, TYCOON_ABI, _wallet);
  }
  return _contract;
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
