import starknet from "./../starknet-contract.js";
import Transaction from "../models/Transaction.js";
import Balance from "../models/Balance.js";
import User from "../models/User.js";
import secureRandomString from "../utils/random-string.js";
import { hash } from "starknet";
import { BigNumber } from "bignumber.js";
import db from "../config/database.js";
import { AutoSwappr, TOKEN_ADDRESSES } from "autoswap-sdk";
import Token from "../models/Token.js";
import { cryptoPrice } from "../utils/amount.js";

function normalizeHex(addr) {
  return new BigNumber(addr).toString(16);
}

function eqHex(a, b) {
  return new BigNumber(a).eq(new BigNumber(b));
}

const DEPOSIT_RECEIVED_SELECTOR = hash.getSelectorFromName("DepositReceived");

const decodeDepositEvent = (event) => {
  const [sender, recipient, low, high, token] = event.data;

  const amount = BigInt(low) + (BigInt(high) << 128n);

  return {
    sender,
    recipient,
    amount: amount.toString(),
    token,
  };
};

const listenForDeposits = async (block_number = null) => {
  if (block_number) {
    const blk = await starknet.provider.getBlockWithTxs(block_number);

    for (const tx of blk.transactions) {
      const receipt = await starknet.provider.getTransactionReceipt(
        tx.transaction_hash
      );
      // const exist_in_db = await db("transactions")
      //   .where("tx_hash", tx.transaction_hash)
      //   .first();
      // if (exist_in_db) continue;

      if (!receipt.events) continue;

      for (const ev of receipt.events) {
        // only process DepositReceived
        if (
          eqHex(ev.from_address, starknet.STARKNET_CONFIG.contractAddress) &&
          eqHex(ev.keys[0], DEPOSIT_RECEIVED_SELECTOR)
        ) {
          const decoded = decodeDepositEvent(ev);

          console.log("💰 DepositReceived:", decoded);

          // === persist into DB ===
          const balance = await Balance.findByAddress(decoded.recipient);
          if (balance) {
            const token = await Token.findById(balance.token_id);
            const user = await User.findById(balance.user_id);
            if (user && token) {
              const getUSDValue = await cryptoPrice(token.symbol);
              const update_bal = await Balance.update(balance.id, {
                amount: Number(decoded.amount) + Number(balance.amount),
                usd_value:
                  Number(decoded.amount * (getUSDValue ?? 1)) +
                  Number(balance.usd_value),
              });
              const create_tx = await Transaction.create({
                user_id: user.id,
                status: "completed",
                token_id: balance.token_id,
                chain_id: null,
                reference: secureRandomString(16),
                type: "credit",
                tx_hash: tx.transaction_hash,
                usd_value: Number(decoded.amount * getUSDValue ?? 1),
                amount: Number(decoded.amount),
                timestamp: new Date(),
                from_address: decoded.sender,
                to_address: decoded.recipient,
                description: "Deposit received",
                extra: decoded.token,
              });
              if (balance.auto_convert_threshold > 0) {
                const user_bal = await Balance.findById(balance.id);
                if (user_bal.amount >= user_bal.auto_convert_threshold) {
                  const autoswappr = new AutoSwappr({
                    contractAddress: process.env.AUTOSWAPPR_CONTRACT_ADDRESS,
                    rpcUrl: "https://starknet-mainnet.public.blastapi.io",
                    accountAddress: starknet.STARKNET_CONFIG.accountAddress,
                    privateKey: starknet.STARKNET_CONFIG.privateKey,
                  });
                  const result = await autoswappr.executeSwap(
                    TOKEN_ADDRESSES.STRK,
                    TOKEN_ADDRESSES.USDC,
                    {
                      amount: Number(user_bal.amount),
                    }
                  );

                  console.log("Swap result:", result);
                }
              }
            }
          }
        }
      }
    }
  } else {
    const latestBlock = await starknet.provider.getBlock("latest");
    let lastBlockNumber = latestBlock.block_number;

    console.log(
      `🔍 Listening for DepositReceived events from block ${lastBlockNumber}...`
    );

    try {
      const block = await starknet.provider.getBlock("latest");
      if (block.block_number <= lastBlockNumber) return;

      for (let bn = lastBlockNumber + 1; bn <= block.block_number; bn++) {
        const blk = await starknet.provider.getBlockWithTxs(bn);

        for (const tx of blk.transactions) {
          const receipt = await starknet.provider.getTransactionReceipt(
            tx.transaction_hash
          );
          const exist_in_db = await db("transactions")
            .where("tx_hash", tx.transaction_hash)
            .first();
          if (exist_in_db) continue;

          if (!receipt.events) continue;

          for (const ev of receipt.events) {
            if (
              eqHex(
                ev.from_address,
                starknet.STARKNET_CONFIG.contractAddress
              ) &&
              eqHex(ev.keys[0], DEPOSIT_RECEIVED_SELECTOR)
            ) {
              const decoded = decodeDepositEvent(ev);

              console.log("💰 DepositReceived:", decoded);

              const balance = await Balance.findByAddress(decoded.recipient);
              if (balance) {
                const token = await Token.findById(balance.token_id);
                const user = await User.findById(balance.user_id);
                if (user && token) {
                  const getUSDValue = await cryptoPrice(token.symbol);
                  // const update_bal = await Balance.update(balance.id, {
                  //   amount: Number(decoded.amount) + Number(balance.amount),
                  //   usd_value:
                  //     Number(decoded.amount * (getUSDValue ?? 1)) +
                  //     Number(decoded.usd_value),
                  // });
                  const create_tx = await Transaction.create({
                    user_id: user.id,
                    status: "completed",
                    token_id: balance.token_id,
                    chain_id: null,
                    reference: secureRandomString(16),
                    type: "credit",
                    tx_hash: tx.transaction_hash,
                    usd_value: Number(decoded.amount * getUSDValue ?? 1),
                    amount: Number(decoded.amount),
                    timestamp: new Date(),
                    from_address: decoded.sender,
                    to_address: decoded.recipient,
                    description: "Deposit received",
                    extra: decoded.token,
                  });
                }
              }
            }
          }
        }
      }

      lastBlockNumber = block.block_number;
    } catch (err) {
      console.error("⚠️ Error in listenForDeposits:", err);
    }
  }
};

export default listenForDeposits;
