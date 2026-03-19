/**
 * Reward System contract interaction (Celo).
 * Used for: stockShop, restockCollectible, stockBundle, setBundleActive, updateCollectiblePrices.
 * Uses BACKEND_GAME_CONTROLLER_PRIVATE_KEY as the minter/backend caller.
 */
import { JsonRpcProvider, Wallet, Contract } from "ethers";
import { getChainConfig } from "../config/chains.js";
import logger from "../config/logger.js";

/**
 * Reward System ABI (subset for shop stocking).
 * Only include methods we need for backend admin endpoints.
 */
const REWARD_SYSTEM_ABI = [
  {
    type: "function",
    name: "stockShop",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "perk", type: "uint8" }, // CollectiblePerk enum
      { name: "strength", type: "uint256" },
      { name: "tycPrice", type: "uint256" },
      { name: "usdcPrice", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "restockCollectible",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "additionalAmount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateCollectiblePrices",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "newTycPrice", type: "uint256" },
      { name: "newUsdcPrice", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "stockBundle",
    inputs: [
      { name: "tokenIds", type: "uint256[]" },
      { name: "amounts", type: "uint256[]" },
      { name: "tycPrice", type: "uint256" },
      { name: "usdcPrice", type: "uint256" },
    ],
    outputs: [{ name: "bundleId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setBundleActive",
    inputs: [
      { name: "bundleId", type: "uint256" },
      { name: "active", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
];

/** Serialize backend wallet transactions to avoid nonce collisions. */
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

/**
 * Get provider and wallet for Celo reward system calls.
 * Chain defaults to CELO.
 */
function getRewardSystemWallet(chain = "CELO") {
  const config = getChainConfig(chain);
  if (!config || !config.rpcUrl) {
    throw new Error(`No RPC configured for chain ${chain}`);
  }

  const privKey = process.env.BACKEND_GAME_CONTROLLER_PRIVATE_KEY;
  if (!privKey) {
    throw new Error("BACKEND_GAME_CONTROLLER_PRIVATE_KEY not set");
  }

  const provider = new JsonRpcProvider(config.rpcUrl);
  const wallet = new Wallet(privKey, provider);
  return wallet;
}

/**
 * Get contract instance for reward system.
 * Address comes from NEXT_PUBLIC_CELO_REWARD or similar env var (read from .env for backend).
 */
function getRewardSystemContract(chain = "CELO") {
  const wallet = getRewardSystemWallet(chain);

  // Reward contract address — for Celo, read from env
  const contractAddress = process.env.REWARD_CONTRACT_ADDRESS || process.env.TYCOON_REWARD_SYSTEM;
  if (!contractAddress) {
    throw new Error("REWARD_CONTRACT_ADDRESS or TYCOON_REWARD_SYSTEM not set in .env");
  }

  const contract = new Contract(contractAddress, REWARD_SYSTEM_ABI, wallet);
  return contract;
}

/**
 * Stock a new perk in the shop.
 * Returns the auto-generated tokenId (emitted in BundleStocked event).
 */
export async function stockShop(amount, perk, strength, tycPrice, usdcPrice, chain = "CELO") {
  return withTxQueue(async () => {
    try {
      const contract = getRewardSystemContract(chain);
      logger.info(`Stocking shop: perk=${perk}, strength=${strength}, amount=${amount}, tycPrice=${tycPrice}, usdcPrice=${usdcPrice}`);

      const tx = await contract.stockShop(amount, perk, strength, tycPrice, usdcPrice);
      const receipt = await tx.wait();

      logger.info(`stockShop tx confirmed: ${receipt.transactionHash}`);

      // Extract tokenId from event logs if available
      // The contract emits CollectibleRestocked but we'd need to parse events
      // For now, return the tx hash
      return {
        success: true,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
      };
    } catch (err) {
      logger.error("stockShop error:", err);
      throw err;
    }
  });
}

/**
 * Restock an existing perk.
 */
export async function restockCollectible(tokenId, additionalAmount, chain = "CELO") {
  return withTxQueue(async () => {
    try {
      const contract = getRewardSystemContract(chain);
      logger.info(`Restocking collectible: tokenId=${tokenId}, amount=${additionalAmount}`);

      const tx = await contract.restockCollectible(tokenId, additionalAmount);
      const receipt = await tx.wait();

      logger.info(`restockCollectible tx confirmed: ${receipt.transactionHash}`);
      return {
        success: true,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
      };
    } catch (err) {
      logger.error("restockCollectible error:", err);
      throw err;
    }
  });
}

/**
 * Update prices for a perk.
 */
export async function updateCollectiblePrices(tokenId, newTycPrice, newUsdcPrice, chain = "CELO") {
  return withTxQueue(async () => {
    try {
      const contract = getRewardSystemContract(chain);
      logger.info(`Updating prices: tokenId=${tokenId}, tycPrice=${newTycPrice}, usdcPrice=${newUsdcPrice}`);

      const tx = await contract.updateCollectiblePrices(tokenId, newTycPrice, newUsdcPrice);
      const receipt = await tx.wait();

      logger.info(`updateCollectiblePrices tx confirmed: ${receipt.transactionHash}`);
      return {
        success: true,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
      };
    } catch (err) {
      logger.error("updateCollectiblePrices error:", err);
      throw err;
    }
  });
}

/**
 * Create a bundle.
 * Returns the generated bundleId.
 */
export async function stockBundle(tokenIds, amounts, tycPrice, usdcPrice, chain = "CELO") {
  return withTxQueue(async () => {
    try {
      const contract = getRewardSystemContract(chain);
      logger.info(`Creating bundle: tokenIds=${tokenIds.join(",")}, amounts=${amounts.join(",")}, tycPrice=${tycPrice}, usdcPrice=${usdcPrice}`);

      const tx = await contract.stockBundle(tokenIds, amounts, tycPrice, usdcPrice);
      const receipt = await tx.wait();

      logger.info(`stockBundle tx confirmed: ${receipt.transactionHash}`);
      // Extract bundleId from return value if available via events
      return {
        success: true,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
      };
    } catch (err) {
      logger.error("stockBundle error:", err);
      throw err;
    }
  });
}

/**
 * Activate or deactivate a bundle.
 */
export async function setBundleActive(bundleId, active, chain = "CELO") {
  return withTxQueue(async () => {
    try {
      const contract = getRewardSystemContract(chain);
      logger.info(`Setting bundle ${bundleId} active=${active}`);

      const tx = await contract.setBundleActive(bundleId, active);
      const receipt = await tx.wait();

      logger.info(`setBundleActive tx confirmed: ${receipt.transactionHash}`);
      return {
        success: true,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
      };
    } catch (err) {
      logger.error("setBundleActive error:", err);
      throw err;
    }
  });
}
