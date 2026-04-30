/**
 * Bot Account Manager
 * Creates and manages 50 private key accounts for continuous game activity.
 * Each bot signs its own transactions (not the backend controller).
 */

import { Wallet, randomBytes } from "ethers";
import db from "../config/database.js";
import logger from "../config/logger.js";

const BOT_COUNT = 50;
const BOT_USERNAME_PREFIX = "bot_";
const BOT_STORAGE_FILE = "./bot-accounts.json"; // Store account details locally

/**
 * Generate 50 unique private key accounts
 * Each account has its own private key and signs its own transactions
 */
export async function generateBotAccounts() {
  const bots = [];

  for (let i = 1; i <= BOT_COUNT; i++) {
    const privateKey = `0x${randomBytes(32).toString("hex")}`;
    const wallet = new Wallet(privateKey);
    const username = `${BOT_USERNAME_PREFIX}${i}`;

    bots.push({
      id: i,
      username,
      address: wallet.address,
      privateKey, // Store securely in production!
      createdAt: new Date().toISOString(),
    });

    logger.info({ botId: i, address: wallet.address }, `Generated bot account`);
  }

  return bots;
}

/**
 * Register all bot accounts on-chain and in DB
 * Each bot signs with their own private key
 */
export async function registerBotAccounts(bots) {
  const results = {
    registered: [],
    failed: [],
  };

  for (const bot of bots) {
    try {
      // Create user in database
      const [userId] = await db("users").insert({
        username: bot.username,
        wallet_address: bot.address,
        created_at: db.fn.now(),
      });

      // In production: call registerPlayerFor on-chain with bot's private key
      // For now, just track in DB
      await db("users").where({ id: userId }).update({
        wallet_address: bot.address,
        is_bot: 1, // Mark as bot account
      });

      results.registered.push({
        userId,
        username: bot.username,
        address: bot.address,
      });

      logger.info(
        { botId: bot.id, userId, address: bot.address },
        "Bot account registered"
      );
    } catch (err) {
      results.failed.push({
        botId: bot.id,
        username: bot.username,
        error: err.message,
      });

      logger.error(
        { botId: bot.id, err: err?.message },
        "Failed to register bot account"
      );
    }
  }

  return results;
}

/**
 * Get all bot accounts from database
 */
export async function getAllBotAccounts() {
  return await db("users")
    .where({ is_bot: 1 })
    .select("id", "username", "wallet_address")
    .limit(BOT_COUNT);
}

/**
 * Get bot account details (including private key from storage)
 * In production, load private keys from secure vault (AWS Secrets Manager, etc)
 */
export async function getBotAccountDetails(botUsername) {
  const user = await db("users").where({ username: botUsername }).first();
  if (!user) return null;

  // In production: retrieve from secure vault
  // For now, you'd load from bot-accounts.json or environment
  return {
    userId: user.id,
    username: user.username,
    address: user.wallet_address,
    // privateKey would be loaded securely
  };
}

/**
 * Fund bot accounts with CELO for gas
 * Call this after generating accounts, before games start
 */
export async function fundBotAccounts(bots, amountCELO = 10) {
  logger.info(
    { botCount: bots.length, amountCELO },
    "Funding bot accounts (requires admin account with CELO)"
  );

  // This requires:
  // 1. Admin account with CELO balance
  // 2. Call to transfer CELO to each bot address
  // 3. Would look like: adminWallet.sendTransaction({ to: botAddress, value: amountCELO })

  return {
    status: "pending",
    message: "Funding requires admin wallet and CELO balance",
    bots: bots.map((b) => ({
      address: b.address,
      fundingAmount: `${amountCELO} CELO`,
    })),
  };
}

/**
 * Export bot accounts to JSON (for local storage / backup)
 * ⚠️ SECURITY WARNING: Never commit this file with private keys to git!
 */
export function exportBotAccounts(bots) {
  const exported = bots.map((b) => ({
    id: b.id,
    username: b.username,
    address: b.address,
    privateKey: b.privateKey, // ⚠️ SENSITIVE!
    createdAt: b.createdAt,
  }));

  return exported;
}

/**
 * Get random pair of bots for a game
 */
export async function getRandomBotPair() {
  const bots = await getAllBotAccounts();
  if (bots.length < 2) {
    throw new Error("Not enough bot accounts for a game");
  }

  const bot1 = bots[Math.floor(Math.random() * bots.length)];
  let bot2 = bots[Math.floor(Math.random() * bots.length)];

  // Ensure different bots
  while (bot2.id === bot1.id) {
    bot2 = bots[Math.floor(Math.random() * bots.length)];
  }

  return [bot1, bot2];
}

logger.info({ botCount: BOT_COUNT }, "Bot Account Manager initialized");
