import express from "express";
import redis from "../config/redis.js";
import * as freecryptoapi from "../services/free-crypto-api.js";
import * as exchangerateapi from "../services/exchange-rate-api.js";
import starknet from "../starknet-contract.js";
import { shortString } from "starknet";
import listenForDeposits from "../services/starknetListener.js";
import { cryptoToFiat } from "../utils/amount.js";
import { NGN_KEY } from "../config/initials.js";

const router = express.Router();

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: "anon",
  });
});

// Get crypto rate
router.get("/api/crypto-rate", async (req, res) => {
  const { token } = req.query;
  const data = await freecryptoapi.rate(token);
  res.status(200).json(data);
});

// Get fiat rate
router.get("/api/fiat-rate", async (req, res) => {
  const { currency } = req.query;
  const data = await exchangerateapi.rate(currency);
  res.status(200).json(data);
});

router.get("/api/rates/ngn", async (req, res) => {
  try {
    let ngnValue = await redis.get(NGN_KEY);

    if (!ngnValue) {
      console.log("⚠️ NGN rate not cached, fetching fresh...");
      await updateNgnRate();
      ngnValue = await redis.get(NGN_KEY);
    }

    return res.json({
      USD: 1,
      NGN: Number.parseFloat(ngnValue),
    });
  } catch (err) {
    console.error("❌ Error fetching NGN from Redis:", err.message);
    return res.status(500).json({ error: "Failed to fetch NGN rate" });
  }
});

router.get("/create-tag-wallet-address/:tag", async (req, res) => {
  try {
    const { tag } = req.params;

    const contract = await starknet.getContract();
    // convert string -> felt
    const feltTag = shortString.encodeShortString(tag);

    console.log(tag, feltTag);
    const tx = await contract.register_tag(feltTag);
    console.log(tx);
    await starknet.provider.waitForTransaction(tx.transaction_hash);

    console.log("Raw contract response:", tx);

    return res.json({ tag, tx });
  } catch (error) {
    console.error("Error creating wallet address:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.get("/get-tag-wallet-address/:tag", async (req, res) => {
  try {
    const { tag } = req.params;

    const contract = await starknet.getContract();

    // Encode tag (felt252 from string)
    const feltTag = shortString.encodeShortString(tag);

    // Call the view function
    const raw = await contract.get_tag_wallet_address(feltTag);

    // Handle Starknet.js return shape
    let walletAddress;
    if (Array.isArray(raw)) {
      walletAddress = raw[0];
    } else if (raw?.wallet_address) {
      walletAddress = raw.wallet_address;
    } else if (typeof raw === "bigint") {
      walletAddress = raw;
    } else {
      throw new Error("Unexpected contract return format");
    }

    // Convert BigInt → hex string
    const address = `0x${walletAddress.toString(16)}`;

    return res.json({ tag, address });
  } catch (error) {
    console.error("❌ Error fetching wallet address:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.get("/fetch-transactions/:block_number", async (req, res) => {
  try {
    const { block_number } = req.params;
    const data = await listenForDeposits(block_number);
    return res.json(data);
  } catch (error) {
    console.error("❌ Error fetching transactions:", error);
    return res.status(500).json({ error: error.message });
  }
});

router.post("/api/usd-equivalent", async (req, res) => {
  try {
    const { token, amount } = req.body;
    const data = await cryptoToFiat(token, amount);
    return res.json(data);
  } catch (error) {
    console.error("❌ Error fetching usd equivalent:", error);
    return res.status(500).json({ error: error.message });
  }
});
export default router;
