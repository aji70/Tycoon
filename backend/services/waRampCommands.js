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
import {
  handleOnboarding,
  mainMenuButtons,
  brandName,
} from "./waRampOnboarding.js";

function isAdmin(phone, config) {
  return config.adminWhatsappNumber && phone === config.adminWhatsappNumber;
}

function parseAmount(raw) {
  const n = Number(String(raw).replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 1e6) / 1e6;
}

function asText(text) {
  return { type: "text", text };
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

function chainPickButtons(side) {
  return {
    type: "buttons",
    body: side === "buy" ? "Receive USDC on which network?" : "Send USDC from which network?",
    buttons: [
      { id: side === "buy" ? "buy_chain_celo" : "sell_chain_celo", title: "Celo" },
      { id: side === "buy" ? "buy_chain_stellar" : "sell_chain_stellar", title: "Stellar" },
      { id: "menu_home", title: "Main menu" },
    ],
  };
}

function tradeAmountButtons(side, chain) {
  const config = getWaRampConfig();
  const amt = config.maxOrderUsdc;
  const c = chain === "stellar" ? "stellar" : "celo";
  return {
    type: "buttons",
    body:
      side === "buy"
        ? `Buy USDC on ${c === "stellar" ? "Stellar" : "Celo"}.\nTap an amount (max ${amt} USDC):`
        : `Sell USDC on ${c === "stellar" ? "Stellar" : "Celo"}.\nTap an amount (max ${amt} USDC):`,
    buttons: [
      { id: `${side}_${c}_1`, title: `${amt} USDC` },
      { id: "menu_home", title: "Main menu" },
    ],
  };
}

function depositForChain(config, chain) {
  if (chain === "stellar") return config.stellar.depositAddress || "";
  return config.celo.depositAddress || "";
}

function chainLabel(chain) {
  return chain === "stellar" ? "Stellar" : "Celo";
}

async function handleSell(phone, amount, config, chain = "celo") {
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

  const deposit = depositForChain(config, chain);
  if (!deposit) {
    return `${chainLabel(chain)} deposit address not configured yet.`;
  }

  const ngn = Math.round(amount * config.rates.sellNgn);
  const ref = shortRef("SELL");
  const expiresAt = new Date(Date.now() + config.orderTtlMinutes * 60_000);

  await createOrder({
    ref,
    type: "sell",
    phone,
    chain,
    amountUsdc: amount,
    amountNgn: ngn,
    rate: config.rates.sellNgn,
    status: "awaiting_crypto",
    depositAddress: deposit,
    payoutBank: {
      bankName: user.bankName,
      accountNumber: user.bankAccount,
      accountName: user.accountName,
    },
    txHash: null,
    expiresAt,
  });

  const networkNote =
    chain === "stellar"
      ? "Send USDC on Stellar to:"
      : "Send USDC on Celo to:";

  return [
    `Sell ${amount} USDC (${chainLabel(chain)}) → ₦${ngn.toLocaleString("en-NG")}`,
    `Rate: ₦${config.rates.sellNgn} / USDC`,
    `Ref: ${ref}`,
    "",
    networkNote,
    deposit,
    "",
    `Then wait — I'll confirm and send ₦${ngn.toLocaleString("en-NG")} to:`,
    `${user.bankName} ${user.bankAccount} (${user.accountName})`,
    "",
    `Expires in ${config.orderTtlMinutes} min. Reply cancel to stop.`,
  ].join("\n");
}

async function handleBuy(phone, amount, config, chain = "celo") {
  if (amount > config.maxOrderUsdc) {
    return `Max order is ${config.maxOrderUsdc} USDC while float is small. Try: buy ${config.maxOrderUsdc}`;
  }
  const open = await findOpenOrderForPhone(phone);
  if (open) return `You already have open order ${open.ref} (${open.status}). Reply cancel first.`;

  const user = await getUser(phone);
  const payoutWallet = chain === "stellar" ? user?.stellarWallet : user?.wallet;
  if (!payoutWallet) {
    return chain === "stellar"
      ? ["Save your Stellar wallet first:", "wallet stellar G..."].join("\n")
      : ["Save your Celo wallet first:", "wallet celo 0x..."].join("\n");
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
    chain,
    amountUsdc: amount,
    amountNgn: ngn,
    rate: config.rates.buyNgn,
    status: "awaiting_ngn",
    wallet: payoutWallet,
    txHash: null,
    expiresAt,
  });

  return [
    `Buy ${amount} USDC on ${chainLabel(chain)} → pay ₦${ngn.toLocaleString("en-NG")}`,
    `Rate: ₦${config.rates.buyNgn} / USDC`,
    `Ref: ${ref}`,
    "",
    "Pay NGN to:",
    `${config.ngn.bankName}`,
    `${config.ngn.accountNumber}`,
    `${config.ngn.accountName}`,
    `Narration / ref: ${ref}`,
    "",
    `After you pay, wait for confirmation. USDC goes to (${chainLabel(chain)}):`,
    payoutWallet,
    "",
    `Expires in ${config.orderTtlMinutes} min. Reply cancel to stop.`,
  ].join("\n");
}

async function statusText(phone) {
  const open = await findOpenOrderForPhone(phone);
  if (!open) return "No open order. Use the menu to Buy or Sell.";
  return [
    `Order ${open.ref}`,
    `Type: ${open.type}`,
    `Amount: ${open.amountUsdc} USDC / ₦${open.amountNgn}`,
    `Status: ${open.status}`,
  ].join("\n");
}

export async function notifyWaRampAdmin(text, opts = {}) {
  const config = getWaRampConfig();
  if (!config.adminWhatsappNumber) return;
  try {
    await sendWhatsAppText(config.adminWhatsappNumber, text, opts);
  } catch (e) {
    logger.error({ err: e.message }, "[wa-ramp] admin notify failed");
  }
}

/**
 * @returns {Promise<string|object|Array>} replies for WhatsApp dispatcher
 */
export async function handleWaRampIncoming({ from, text, phoneNumberId, buttonId, contactName }) {
  const config = getWaRampConfig();
  const sendOpts = phoneNumberId ? { phoneNumberId } : {};
  const phone = String(from).replace(/\D/g, "");
  const raw = (text || "").trim();
  const lower = raw.toLowerCase();
  const btn = buttonId || null;

  try {
    const onboarded = await handleOnboarding({
      phone,
      text: raw,
      buttonId: btn,
      contactName,
    });
    if (onboarded) return onboarded;
  } catch (e) {
    logger.error({ err: e.message }, "[wa-ramp] onboarding error");
  }

  try {
    await expireStaleOrders(config.orderTtlMinutes);
  } catch (e) {
    logger.warn({ err: e.message }, "[wa-ramp] expireStaleOrders failed (migrate?)");
  }

  if (
    btn === "menu_home" ||
    btn === "menu_more" ||
    lower === "menu" ||
    lower === "hi" ||
    lower === "hello" ||
    lower === "start"
  ) {
    const user = await getUser(phone).catch(() => null);
    return mainMenuButtons(user);
  }
  if (btn === "menu_rates" || lower === "rate" || lower === "rates") {
    const user = await getUser(phone).catch(() => null);
    return [asText(rateText(config)), mainMenuButtons(user)];
  }
  if (btn === "menu_buy") return chainPickButtons("buy");
  if (btn === "menu_sell") return chainPickButtons("sell");
  if (btn === "buy_chain_celo") return tradeAmountButtons("buy", "celo");
  if (btn === "buy_chain_stellar") return tradeAmountButtons("buy", "stellar");
  if (btn === "sell_chain_celo") return tradeAmountButtons("sell", "celo");
  if (btn === "sell_chain_stellar") return tradeAmountButtons("sell", "stellar");
  if (btn === "buy_celo_1") return asText(await handleBuy(phone, config.maxOrderUsdc, config, "celo"));
  if (btn === "buy_stellar_1") return asText(await handleBuy(phone, config.maxOrderUsdc, config, "stellar"));
  if (btn === "sell_celo_1") return asText(await handleSell(phone, config.maxOrderUsdc, config, "celo"));
  if (btn === "sell_stellar_1") return asText(await handleSell(phone, config.maxOrderUsdc, config, "stellar"));
  // legacy ids
  if (btn === "buy_1") return asText(await handleBuy(phone, config.maxOrderUsdc, config, "celo"));
  if (btn === "sell_1") return asText(await handleSell(phone, config.maxOrderUsdc, config, "celo"));

  if (lower === "help") {
    const user = await getUser(phone).catch(() => null);
    return [
      asText(
        [
          `${brandName()} — USDC (${config.chainsLabel}) ↔ NGN`,
          "",
          "Use the buttons, or type:",
          "• buy 1 / sell 1",
          "• wallet celo 0x...",
          "• wallet stellar G...",
          "• bank <bank> <account> <name>",
          "• status / cancel / menu",
        ].join("\n")
      ),
      mainMenuButtons(user),
    ];
  }

  if (lower === "status") {
    try {
      return asText(await statusText(phone));
    } catch (e) {
      return asText("Ramp database not ready yet. Ask the operator to run: npm run migrate");
    }
  }

  if (lower === "cancel" || btn === "cancel") {
    const open = await findOpenOrderForPhone(phone);
    if (!open) return asText("Nothing to cancel.");
    if (!["awaiting_crypto", "awaiting_ngn"].includes(open.status)) {
      return asText(`Order ${open.ref} is ${open.status} and can't be cancelled from chat.`);
    }
    await updateOrder(open.ref, { status: "cancelled" });
    return asText(`Cancelled ${open.ref}.`);
  }

  const walletCelo = raw.match(/^wallet(?:\s+celo)?\s+(0x[a-fA-F0-9]{40})$/i);
  if (walletCelo) {
    await upsertUser(phone, { wallet: walletCelo[1] });
    const user = await getUser(phone);
    return [asText(`Saved Celo wallet:\n${walletCelo[1]}`), mainMenuButtons(user)];
  }

  const walletStellar = raw.match(/^wallet\s+stellar\s+([G][A-Z0-9]{55})$/i);
  if (walletStellar) {
    await upsertUser(phone, { stellarWallet: walletStellar[1] });
    const user = await getUser(phone);
    return [asText(`Saved Stellar wallet:\n${walletStellar[1]}`), mainMenuButtons(user)];
  }

  const bankMatch = raw.match(/^bank\s+(\S+)\s+(\d{8,12})\s+(.+)$/i);
  if (bankMatch) {
    await upsertUser(phone, {
      bankName: bankMatch[1],
      bankAccount: bankMatch[2],
      accountName: bankMatch[3].trim(),
    });
    const user = await getUser(phone);
    return [
      asText(`Saved NGN payout:\n${bankMatch[1]} ${bankMatch[2]}\n${bankMatch[3].trim()}`),
      mainMenuButtons(user),
    ];
  }

  const sellMatch = lower.match(/^sell\s+(\d+(?:\.\d+)?)\s*(usdc|usdt)?(?:\s+(celo|stellar))?$/);
  if (sellMatch) {
    const amount = parseAmount(sellMatch[1]);
    if (!amount) return asText("Invalid amount. Example: sell 1 celo");
    return asText(await handleSell(phone, amount, config, sellMatch[3] || "celo"));
  }

  const buyMatch = lower.match(/^buy\s+(\d+(?:\.\d+)?)\s*(usdc|usdt)?(?:\s+(celo|stellar))?$/);
  if (buyMatch) {
    const amount = parseAmount(buyMatch[1]);
    if (!amount) return asText("Invalid amount. Example: buy 1 stellar");
    return asText(await handleBuy(phone, amount, config, buyMatch[3] || "celo"));
  }

  const confirmMatch = lower.match(/^confirm\s+(buy_[a-f0-9]+|sell_[a-f0-9]+)$/);
  if (confirmMatch) {
    if (!isAdmin(phone, config)) return asText("Admin only.");
    const order = await findOrder(confirmMatch[1]);
    if (!order) return asText("Order not found.");

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
        ].join("\n"),
        sendOpts
      );
      return asText(
        [
          `Marked ${order.ref} as ngn_received.`,
          `Send ${order.amountUsdc} USDC on Celo to ${order.wallet}`,
          `Then reply: sent ${order.ref} <txHash>`,
        ].join("\n")
      );
    }

    if (order.type === "sell" && order.status === "crypto_received") {
      await updateOrder(order.ref, { status: "completed" });
      await sendWhatsAppText(
        order.phone,
        [
          `✅ Completed ${order.ref}`,
          `₦${order.amountNgn.toLocaleString("en-NG")} sent to your bank.`,
        ].join("\n"),
        sendOpts
      );
      return asText(`Completed ${order.ref}.`);
    }

    return asText(`Cannot confirm ${order.ref} in status ${order.status}.`);
  }

  const sentMatch = raw.match(/^sent\s+(buy_[a-f0-9]+)\s+(0x[a-fA-F0-9]{64})$/i);
  if (sentMatch) {
    if (!isAdmin(phone, config)) return asText("Admin only.");
    const order = await findOrder(sentMatch[1]);
    if (!order) return asText("Order not found.");
    await updateOrder(order.ref, { status: "completed", txHash: sentMatch[2] });
    await sendWhatsAppText(
      order.phone,
      [
        `✅ ${order.amountUsdc} USDC sent`,
        `Tx: ${sentMatch[2]}`,
        `Ref: ${order.ref}`,
      ].join("\n"),
      sendOpts
    );
    return asText(`Marked ${order.ref} completed.`);
  }

  if (lower === "orders") {
    if (!isAdmin(phone, config)) return asText("Admin only.");
    const open = await listOpenOrders();
    if (!open.length) return asText("No open orders.");
    return asText(
      open.map((o) => `${o.ref} ${o.type} ${o.amountUsdc}u ₦${o.amountNgn} ${o.status} ${o.phone}`).join("\n")
    );
  }

  const user = await getUser(phone).catch(() => null);
  return [asText("Tap a button below, or reply menu"), mainMenuButtons(user)];
}
