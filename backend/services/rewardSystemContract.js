/**
 * Reward System contract interaction (multi-chain).
 * Shop writes use onlyMinter (owner | backendMinter | gameMinter).
 * Signer priority: TYCOON_OWNER_PRIVATE_KEY → REWARD_STOCK_MINTER_PRIVATE_KEY → per-chain BACKEND_GAME_CONTROLLER_*.
 * Reward address: REWARD_CONTRACT_ADDRESS / TYCOON_REWARD_SYSTEM, else rewardSystem() on the Tycoon proxy (requires chain config).
 *
 * Shares the global tx queue with tycoonContract when using the same wallet, avoiding nonce collisions.
 */
import { JsonRpcProvider, Wallet, Contract, parseUnits, ZeroAddress } from "ethers";
import { getChainConfig } from "../config/chains.js";
import { INITIAL_COLLECTIBLES, BUNDLE_DEFS_FOR_STOCK } from "../config/shopStockConstants.js";
import logger from "../config/logger.js";
import { withTxQueue, getContract } from "./tycoonContract.js";

/**
 * Reward System ABI (subset for shop stocking + reads for bulk helpers).
 */
const REWARD_SYSTEM_ABI = [
  {
    type: "function",
    name: "stockShop",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "perk", type: "uint8" },
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
  {
    type: "function",
    name: "ownedTokenCount",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenOfOwnerByIndex",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "collectiblePerk",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "collectiblePerkStrength",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
];

function normalizePk(pk) {
  const s = String(pk).trim();
  return s.startsWith("0x") ? s : `0x${s}`;
}

/**
 * Private key used for reward minter/owner calls (stockShop, stockBundle, …).
 */
function getRewardStockPrivateKey(chain = "CELO") {
  const owner =
    process.env.TYCOON_OWNER_PRIVATE_KEY ||
    process.env.REWARD_STOCK_MINTER_PRIVATE_KEY;
  if (owner && String(owner).trim()) {
    return normalizePk(owner);
  }
  const cfg = getChainConfig(chain);
  if (cfg.privateKey && String(cfg.privateKey).trim()) {
    return normalizePk(cfg.privateKey);
  }
  throw new Error(
    "Set TYCOON_OWNER_PRIVATE_KEY (or REWARD_STOCK_MINTER_PRIVATE_KEY), or BACKEND_GAME_CONTROLLER_*_PRIVATE_KEY for this chain"
  );
}

function getRewardSystemWallet(chain = "CELO") {
  const config = getChainConfig(chain);
  if (!config?.rpcUrl) {
    throw new Error(`No RPC configured for chain ${chain}`);
  }
  const pk = getRewardStockPrivateKey(chain);
  const provider = new JsonRpcProvider(config.rpcUrl);
  return new Wallet(pk, provider);
}

async function resolveRewardSystemAddress(chain = "CELO") {
  const fromEnv = process.env.REWARD_CONTRACT_ADDRESS || process.env.TYCOON_REWARD_SYSTEM;
  if (fromEnv && String(fromEnv).trim() && fromEnv !== ZeroAddress) {
    return String(fromEnv).trim();
  }
  const cfg = getChainConfig(chain);
  if (!cfg.isConfigured) {
    throw new Error(
      `Set REWARD_CONTRACT_ADDRESS (or TYCOON_REWARD_SYSTEM), or configure Tycoon on ${chain} so rewardSystem() can be read`
    );
  }
  try {
    const tycoon = getContract(chain);
    const addr = await tycoon.rewardSystem();
    const a = typeof addr === "string" ? addr : addr?.toString?.() ?? "";
    if (a && a !== ZeroAddress) return a;
  } catch (err) {
    logger.warn({ err: err?.message, chain }, "resolveRewardSystemAddress: rewardSystem() read failed");
  }
  throw new Error(
    "Reward system address unknown: set REWARD_CONTRACT_ADDRESS or TYCOON_REWARD_SYSTEM in backend .env"
  );
}

async function getRewardSystemContract(chain = "CELO") {
  const wallet = getRewardSystemWallet(chain);
  const contractAddress = await resolveRewardSystemAddress(chain);
  return new Contract(contractAddress, REWARD_SYSTEM_ABI, wallet);
}

function receiptHash(receipt) {
  return receipt?.hash ?? receipt?.transactionHash ?? "";
}

/**
 * Map "perk:strength" → tokenId for collectibles currently held by the reward contract (shop inventory).
 */
async function buildPerkStrengthTokenMap(contract) {
  const rewardAddr = await contract.getAddress();
  const countBn = await contract.ownedTokenCount(rewardAddr);
  const n = Number(countBn);
  const map = new Map();
  for (let i = 0; i < n; i++) {
    const tid = await contract.tokenOfOwnerByIndex(rewardAddr, BigInt(i));
    const perk = Number(await contract.collectiblePerk(tid));
    const strength = Number(await contract.collectiblePerkStrength(tid));
    if (perk === 0) continue;
    const key = `${perk}:${strength}`;
    if (!map.has(key)) {
      map.set(key, BigInt(tid.toString()));
    }
  }
  return map;
}

/**
 * Stock 50 (or `amount`) of each INITIAL_COLLECTIBLE row that is not already present in shop (same as wallet "stock all" flow).
 */
export async function stockAllInitialPerks(chain = "CELO", amount = 50) {
  return withTxQueue(async () => {
    const contract = await getRewardSystemContract(chain);
    const map = await buildPerkStrengthTokenMap(contract);
    const amt = BigInt(amount);
    const toStock = INITIAL_COLLECTIBLES.filter((item) => !map.has(`${item.perk}:${item.strength}`));
    const transactions = [];

    for (const item of toStock) {
      const tycWei = parseUnits(item.tycPrice, 18);
      const usdcUnits = parseUnits(item.usdcPrice, 6);
      logger.info(
        { chain, perk: item.perk, strength: item.strength, amount: amt.toString() },
        "stockAllInitialPerks: stockShop"
      );
      const tx = await contract.stockShop(amt, item.perk, item.strength, tycWei, usdcUnits);
      const receipt = await tx.wait();
      transactions.push({
        perk: item.perk,
        strength: item.strength,
        txHash: receiptHash(receipt),
        blockNumber: receipt.blockNumber,
      });
    }

    return {
      success: true,
      stocked: transactions.length,
      skippedAlreadyPresent: INITIAL_COLLECTIBLES.length - toStock.length,
      transactions,
    };
  });
}

/**
 * Register all BUNDLE_DEFS_FOR_STOCK on-chain (perks must exist in shop first).
 */
export async function stockAllBundlesFromDefs(chain = "CELO") {
  return withTxQueue(async () => {
    const contract = await getRewardSystemContract(chain);
    const map = await buildPerkStrengthTokenMap(contract);
    const transactions = [];
    const errors = [];

    for (const def of BUNDLE_DEFS_FOR_STOCK) {
      try {
        const tokenIds = [];
        const amounts = [];
        for (const li of def.items) {
          const key = `${li.perk}:${li.strength}`;
          const tid = map.get(key);
          if (tid === undefined) {
            throw new Error(
              `Missing perk ${li.perk} tier ${li.strength} in shop — run stock-all-perks first`
            );
          }
          for (let q = 0; q < li.quantity; q++) {
            tokenIds.push(tid);
            amounts.push(1n);
          }
        }
        const tycWei = parseUnits(def.price_tyc, 18);
        const usdcUnits = parseUnits(def.price_usdc, 6);
        logger.info({ chain, bundle: def.name }, "stockAllBundlesFromDefs: stockBundle");
        const tx = await contract.stockBundle(tokenIds, amounts, tycWei, usdcUnits);
        const receipt = await tx.wait();
        transactions.push({
          name: def.name,
          txHash: receiptHash(receipt),
          blockNumber: receipt.blockNumber,
        });
      } catch (err) {
        logger.error({ err: err?.message, bundle: def.name }, "stockAllBundlesFromDefs failed for bundle");
        errors.push({ name: def.name, error: err?.message || String(err) });
      }
    }

    return {
      success: errors.length === 0,
      stocked: transactions.length,
      transactions,
      errors,
    };
  });
}

export async function stockShop(amount, perk, strength, tycPrice, usdcPrice, chain = "CELO") {
  return withTxQueue(async () => {
    try {
      const contract = await getRewardSystemContract(chain);
      logger.info(`Stocking shop: perk=${perk}, strength=${strength}, amount=${amount}, tycPrice=${tycPrice}, usdcPrice=${usdcPrice}`);

      const tx = await contract.stockShop(amount, perk, strength, tycPrice, usdcPrice);
      const receipt = await tx.wait();

      logger.info(`stockShop tx confirmed: ${receiptHash(receipt)}`);
      return {
        success: true,
        txHash: receiptHash(receipt),
        blockNumber: receipt.blockNumber,
      };
    } catch (err) {
      logger.error("stockShop error:", err);
      throw err;
    }
  });
}

export async function restockCollectible(tokenId, additionalAmount, chain = "CELO") {
  return withTxQueue(async () => {
    try {
      const contract = await getRewardSystemContract(chain);
      logger.info(`Restocking collectible: tokenId=${tokenId}, amount=${additionalAmount}`);

      const tx = await contract.restockCollectible(tokenId, additionalAmount);
      const receipt = await tx.wait();

      logger.info(`restockCollectible tx confirmed: ${receiptHash(receipt)}`);
      return {
        success: true,
        txHash: receiptHash(receipt),
        blockNumber: receipt.blockNumber,
      };
    } catch (err) {
      logger.error("restockCollectible error:", err);
      throw err;
    }
  });
}

export async function updateCollectiblePrices(tokenId, newTycPrice, newUsdcPrice, chain = "CELO") {
  return withTxQueue(async () => {
    try {
      const contract = await getRewardSystemContract(chain);
      logger.info(`Updating prices: tokenId=${tokenId}, tycPrice=${newTycPrice}, usdcPrice=${newUsdcPrice}`);

      const tx = await contract.updateCollectiblePrices(tokenId, newTycPrice, newUsdcPrice);
      const receipt = await tx.wait();

      logger.info(`updateCollectiblePrices tx confirmed: ${receiptHash(receipt)}`);
      return {
        success: true,
        txHash: receiptHash(receipt),
        blockNumber: receipt.blockNumber,
      };
    } catch (err) {
      logger.error("updateCollectiblePrices error:", err);
      throw err;
    }
  });
}

export async function stockBundle(tokenIds, amounts, tycPrice, usdcPrice, chain = "CELO") {
  return withTxQueue(async () => {
    try {
      const contract = await getRewardSystemContract(chain);
      logger.info(`Creating bundle: tokenIds=${tokenIds.join(",")}, amounts=${amounts.join(",")}, tycPrice=${tycPrice}, usdcPrice=${usdcPrice}`);

      const tx = await contract.stockBundle(tokenIds, amounts, tycPrice, usdcPrice);
      const receipt = await tx.wait();

      logger.info(`stockBundle tx confirmed: ${receiptHash(receipt)}`);
      return {
        success: true,
        txHash: receiptHash(receipt),
        blockNumber: receipt.blockNumber,
      };
    } catch (err) {
      logger.error("stockBundle error:", err);
      throw err;
    }
  });
}

export async function setBundleActive(bundleId, active, chain = "CELO") {
  return withTxQueue(async () => {
    try {
      const contract = await getRewardSystemContract(chain);
      logger.info(`Setting bundle ${bundleId} active=${active}`);

      const tx = await contract.setBundleActive(bundleId, active);
      const receipt = await tx.wait();

      logger.info(`setBundleActive tx confirmed: ${receiptHash(receipt)}`);
      return {
        success: true,
        txHash: receiptHash(receipt),
        blockNumber: receipt.blockNumber,
      };
    } catch (err) {
      logger.error("setBundleActive error:", err);
      throw err;
    }
  });
}
