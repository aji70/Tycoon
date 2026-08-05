import { ethers } from "ethers";
import logger from "../config/logger.js";
import { getWaRampConfig, isWaRampEnabled } from "./waRampConfig.js";
import { listOpenOrders, updateOrder } from "./waRampStore.js";
import { sendWhatsAppText } from "./waRampWhatsapp.js";
import { notifyWaRampAdmin } from "./waRampCommands.js";

const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");

let lastBlock = null;
let timer = null;

function provider() {
  const { celo } = getWaRampConfig();
  return new ethers.JsonRpcProvider(celo.rpcUrl);
}

export async function markSellCryptoReceived(order, txHash) {
  if (order.status !== "awaiting_crypto") return false;
  await updateOrder(order.ref, { status: "crypto_received", txHash });

  const bank = order.payoutBank;
  await sendWhatsAppText(
    order.phone,
    [
      `✅ Received ${order.amountUsdc} USDC`,
      `Tx: ${txHash}`,
      `Ref: ${order.ref}`,
      "",
      `Paying ₦${order.amountNgn.toLocaleString("en-NG")} to your bank next.`,
    ].join("\n")
  );

  await notifyWaRampAdmin(
    [
      `SELL ready to pay NGN`,
      `${order.ref}: ₦${order.amountNgn} → ${bank?.bankName} ${bank?.accountNumber} (${bank?.accountName})`,
      `After you pay NGN, reply: confirm ${order.ref}`,
    ].join("\n")
  );

  return true;
}

async function scanOnce() {
  const config = getWaRampConfig();
  if (!config.celo.depositAddress || !config.celo.usdcAddress) return;

  const p = provider();
  const latest = await p.getBlockNumber();
  if (lastBlock == null) {
    lastBlock = Math.max(0, latest - 20);
  }
  if (latest <= lastBlock) return;

  const fromBlock = lastBlock + 1;
  const toBlock = latest;
  lastBlock = latest;

  const deposit = ethers.getAddress(config.celo.depositAddress);
  const usdc = ethers.getAddress(config.celo.usdcAddress);
  const toTopic = ethers.zeroPadValue(deposit, 32);

  const logs = await p.getLogs({
    address: usdc,
    fromBlock,
    toBlock,
    topics: [TRANSFER_TOPIC, null, toTopic],
  });

  if (!logs.length) return;

  const openSells = (await listOpenOrders()).filter(
    (o) => o.type === "sell" && o.status === "awaiting_crypto"
  );
  if (!openSells.length) return;

  for (const log of logs) {
    const amount = Number(ethers.formatUnits(log.data, 6));
    const txHash = log.transactionHash;
    const order = openSells.find((o) => Math.abs(Number(o.amountUsdc) - amount) < 1e-6);
    if (!order) {
      logger.info({ amount, txHash }, "[wa-ramp] unmatched USDC deposit");
      await notifyWaRampAdmin(`Unmatched deposit ${amount} USDC\n${txHash}`);
      continue;
    }
    const ok = await markSellCryptoReceived(order, txHash);
    if (ok) {
      const idx = openSells.findIndex((o) => o.ref === order.ref);
      if (idx >= 0) openSells.splice(idx, 1);
    }
  }
}

export function startWaRampCeloWatcher() {
  if (!isWaRampEnabled()) {
    logger.info("[wa-ramp] disabled — celo watcher not started");
    return;
  }
  const { celo } = getWaRampConfig();
  if (!celo.depositAddress) {
    logger.warn("[wa-ramp] WA_RAMP_CELO_DEPOSIT_ADDRESS missing — watcher idle");
    return;
  }
  logger.info({ deposit: celo.depositAddress }, "[wa-ramp] watching USDC deposits");
  const tick = async () => {
    try {
      await scanOnce();
    } catch (e) {
      logger.error({ err: e.message }, "[wa-ramp] celo scan error");
    }
  };
  tick();
  timer = setInterval(tick, 12_000);
  if (timer.unref) timer.unref();
}

export function stopWaRampCeloWatcher() {
  if (timer) clearInterval(timer);
  timer = null;
}
