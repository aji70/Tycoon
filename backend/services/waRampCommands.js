import logger from "../config/logger.js";
import { getWaRampConfig } from "./waRampConfig.js";
import {
  createOrder,
  findOpenOrderForPhone,
  findOrder,
  getUser,
  shortRef,
  updateOrder,
  upsertUser,
  expireStaleOrders,
  listOpenOrders,
} from "./waRampStore.js";
import { sendWhatsAppText } from "./waRampWhatsapp.js";

function isAdmin(phone, config) {
  return config.adminWhatsappNumber && phone === config.adminWhatsappNumber;
}

function parseAmount(raw) {
  const n = Number(String(raw).replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 1e6) / 1e6;
}

function helpText(config) {
  return [
    "Tycoon Ramp — USDC (Celo) ↔ NGN",
    "",
    "Commands:",
    "• rate — see prices",
    "• sell <amount> — sell USDC, get NGN",
    "  e.g. sell 1",
    "• buy <amount> — pay NGN, get USDC",
    "  e.g. buy 1",
    "• wallet 0x... — save your Celo wallet (needed for buy)",
    "• bank <bank> <account> <name> — save NGN payout details (needed for sell)",
    "• status — your open order",
    "• cancel — cancel open order",
    "",
    `Max order: ${config.maxOrderUsdc} USDC`,
  ].join("\n");
}

function rateText(config) {
  return [
    "Rates (NGN per 1 USDC)",
    `• sell USDC → you get ₦${config.rates.sellNgn}`,
    `• buy USDC  → you pay ₦${config.rates.buyNgn}`,
    "",
    `Max order: ${config.maxOrderUsdc} USDC`,
  ].join("\n");
}

async function handleSell(phone, amount, config) {
  if (amount > config.maxOrderUsdc) {
    return `Max order is ${config.maxOrderUsdc} USDC while float is small. Try: sell ${config.maxOrderUsdc}`;
  }
  const open = await findOpenOrderForPhone(phone);
  if (open) return `You already have open order ${open.ref} (${open.status}). Reply cancel first.`;

  const user = await getUser(phone);
  if (!user?.bankAccount || !user?.bankName || !user?.accountName) {
    return [
      "Save your NGN payout details first:",
      "bank <bank> <account_number> <account_name>",
      "e.g. bank Opay 0123456789 Jane Doe",
    ].join("\n");
  }

  if (!config.celo.depositAddress) {
    return "Deposit address not configured yet. Operator needs WA_RAMP_CELO_DEPOSIT_ADDRESS.";
  }

  const ngn = Math.round(amount * config.rates.sellNgn);
  const ref = shortRef("SELL");
  const expiresAt = new Date(Date.now() + config.orderTtlMinutes * 60_000);

  await createOrder({
    ref,
    type: "sell",
    phone,
    amountUsdc: amount,
    amountNgn: ngn,
    rate: config.rates.sellNgn,
    status: "awaiting_crypto",
    depositAddress: config.celo.depositAddress,
    payoutBank: {
      bankName: user.bankName,
      accountNumber: user.bankAccount,
      accountName: user.accountName,
    },
    txHash: null,
    expiresAt,
  });

  return [
    `Sell ${amount} USDC → ₦${ngn.toLocaleString("en-NG")}`,
    `Rate: ₦${config.rates.sellNgn} / USDC`,
    `Ref: ${ref}`,
    "",
    "Send exactly that amount of USDC on Celo to:",
    config.celo.depositAddress,
    "",
    `Then wait — I'll confirm and send ₦${ngn.toLocaleString("en-NG")} to:`,
    `${user.bankName} ${user.bankAccount} (${user.accountName})`,
    "",
    `Expires in ${config.orderTtlMinutes} min. Reply cancel to stop.`,
  ].join("\n");
}

async function handleBuy(phone, amount, config) {
  if (amount > config.maxOrderUsdc) {
    return `Max order is ${config.maxOrderUsdc} USDC while float is small. Try: buy ${config.maxOrderUsdc}`;
  }
  const open = await findOpenOrderForPhone(phone);
  if (open) return `You already have open order ${open.ref} (${open.status}). Reply cancel first.`;

  const user = await getUser(phone);
  if (!user?.wallet) {
    return ["Save your Celo wallet first:", "wallet 0xYourAddress"].join("\n");
  }

  if (!config.ngn.accountNumber) {
    return "Operator NGN account not configured (WA_RAMP_NGN_ACCOUNT_NUMBER).";
  }

  const ngn = Math.round(amount * config.rates.buyNgn);
  const ref = shortRef("BUY");
  const expiresAt = new Date(Date.now() + config.orderTtlMinutes * 60_000);

  await createOrder({
    ref,
    type: "buy",
    phone,
    amountUsdc: amount,
    amountNgn: ngn,
    rate: config.rates.buyNgn,
    status: "awaiting_ngn",
    wallet: user.wallet,
    txHash: null,
    expiresAt,
  });

  return [
    `Buy ${amount} USDC → pay ₦${ngn.toLocaleString("en-NG")}`,
    `Rate: ₦${config.rates.buyNgn} / USDC`,
    `Ref: ${ref}`,
    "",
    "Pay NGN to:",
    `${config.ngn.bankName}`,
    `${config.ngn.accountNumber}`,
    `${config.ngn.accountName}`,
    `Narration / ref: ${ref}`,
    "",
    `After you pay, wait for confirmation. USDC goes to:`,
    user.wallet,
    "",
    `Expires in ${config.orderTtlMinutes} min. Reply cancel to stop.`,
  ].join("\n");
}

async function statusText(phone, config) {
  await expireStaleOrders(config.orderTtlMinutes);
  const open = await findOpenOrderForPhone(phone);
  if (!open) return "No open order. Try: buy 1  or  sell 1";
  return [
    `Order ${open.ref}`,
    `Type: ${open.type}`,
    `Amount: ${open.amountUsdc} USDC / ₦${open.amountNgn}`,
    `Status: ${open.status}`,
  ].join("\n");
}

export async function notifyWaRampAdmin(text) {
  const config = getWaRampConfig();
  if (!config.adminWhatsappNumber) return;
  try {
    await sendWhatsAppText(config.adminWhatsappNumber, text);
  } catch (e) {
    logger.error({ err: e.message }, "[wa-ramp] admin notify failed");
  }
}

export async function handleWaRampIncoming({ from, text }) {
  const config = getWaRampConfig();
  await expireStaleOrders(config.orderTtlMinutes);
  const phone = String(from).replace(/\D/g, "");
  const raw = text.trim();
  const lower = raw.toLowerCase();

  if (!raw || lower === "hi" || lower === "hello" || lower === "help" || lower === "start") {
    return helpText(config);
  }
  if (lower === "rate" || lower === "rates") return rateText(config);
  if (lower === "status") return statusText(phone, config);

  if (lower === "cancel") {
    const open = await findOpenOrderForPhone(phone);
    if (!open) return "Nothing to cancel.";
    if (!["awaiting_crypto", "awaiting_ngn"].includes(open.status)) {
      return `Order ${open.ref} is ${open.status} and can't be cancelled from chat.`;
    }
    await updateOrder(open.ref, { status: "cancelled" });
    return `Cancelled ${open.ref}.`;
  }

  const walletMatch = raw.match(/^wallet\s+(0x[a-fA-F0-9]{40})$/i);
  if (walletMatch) {
    await upsertUser(phone, { wallet: walletMatch[1] });
    return `Saved wallet:\n${walletMatch[1]}`;
  }

  const bankMatch = raw.match(/^bank\s+(\S+)\s+(\d{8,12})\s+(.+)$/i);
  if (bankMatch) {
    await upsertUser(phone, {
      bankName: bankMatch[1],
      bankAccount: bankMatch[2],
      accountName: bankMatch[3].trim(),
    });
    return [
      "Saved NGN payout:",
      `${bankMatch[1]} ${bankMatch[2]}`,
      bankMatch[3].trim(),
    ].join("\n");
  }

  const sellMatch = lower.match(/^sell\s+(\d+(?:\.\d+)?)\s*(usdc|usdt)?$/);
  if (sellMatch) {
    const amount = parseAmount(sellMatch[1]);
    if (!amount) return "Invalid amount. Example: sell 1";
    return handleSell(phone, amount, config);
  }

  const buyMatch = lower.match(/^buy\s+(\d+(?:\.\d+)?)\s*(usdc|usdt)?$/);
  if (buyMatch) {
    const amount = parseAmount(buyMatch[1]);
    if (!amount) return "Invalid amount. Example: buy 1";
    return handleBuy(phone, amount, config);
  }

  const confirmMatch = lower.match(/^confirm\s+(buy_[a-f0-9]+|sell_[a-f0-9]+)$/);
  if (confirmMatch) {
    if (!isAdmin(phone, config)) return "Admin only.";
    const order = await findOrder(confirmMatch[1]);
    if (!order) return "Order not found.";

    if (order.type === "buy" && order.status === "awaiting_ngn") {
      await updateOrder(order.ref, { status: "ngn_received" });
      await sendWhatsAppText(
        order.phone,
        [
          `✅ NGN received for ${order.ref}`,
          `Sending ${order.amountUsdc} USDC to:`,
          order.wallet,
          "",
          "If it doesn't arrive in a few minutes, reply status.",
        ].join("\n")
      );
      return [
        `Marked ${order.ref} as ngn_received.`,
        `Send ${order.amountUsdc} USDC on Celo to ${order.wallet}`,
        `Then reply: sent ${order.ref} <txHash>`,
      ].join("\n");
    }

    if (order.type === "sell" && order.status === "crypto_received") {
      await updateOrder(order.ref, { status: "completed" });
      await sendWhatsAppText(
        order.phone,
        [
          `✅ Completed ${order.ref}`,
          `₦${order.amountNgn.toLocaleString("en-NG")} sent to your bank.`,
        ].join("\n")
      );
      return `Completed ${order.ref}.`;
    }

    return `Cannot confirm ${order.ref} in status ${order.status}.`;
  }

  const sentMatch = raw.match(/^sent\s+(buy_[a-f0-9]+)\s+(0x[a-fA-F0-9]{64})$/i);
  if (sentMatch) {
    if (!isAdmin(phone, config)) return "Admin only.";
    const order = await findOrder(sentMatch[1]);
    if (!order) return "Order not found.";
    await updateOrder(order.ref, { status: "completed", txHash: sentMatch[2] });
    await sendWhatsAppText(
      order.phone,
      [
        `✅ ${order.amountUsdc} USDC sent`,
        `Tx: ${sentMatch[2]}`,
        `Ref: ${order.ref}`,
      ].join("\n")
    );
    return `Marked ${order.ref} completed.`;
  }

  if (lower === "orders") {
    if (!isAdmin(phone, config)) return "Admin only.";
    const open = await listOpenOrders();
    if (!open.length) return "No open orders.";
    return open
      .map((o) => `${o.ref} ${o.type} ${o.amountUsdc}u ₦${o.amountNgn} ${o.status} ${o.phone}`)
      .join("\n");
  }

  return "Not sure what you mean. Reply help";
}
