import { randomBytes } from "node:crypto";
import db from "../config/database.js";

const OPEN = ["awaiting_crypto", "awaiting_ngn", "crypto_received", "ngn_received"];

function mapOrder(row) {
  if (!row) return null;
  return {
    id: row.id,
    ref: row.ref,
    type: row.type,
    phone: row.phone,
    amountUsdc: Number(row.amount_usdc),
    amountNgn: Number(row.amount_ngn),
    rate: Number(row.rate),
    status: row.status,
    depositAddress: row.deposit_address,
    wallet: row.wallet,
    payoutBank: row.payout_bank_account
      ? {
          bankName: row.payout_bank_name,
          accountNumber: row.payout_bank_account,
          accountName: row.payout_account_name,
        }
      : null,
    txHash: row.tx_hash,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUser(row) {
  if (!row) return null;
  return {
    phone: row.phone,
    wallet: row.wallet,
    bankName: row.bank_name,
    bankAccount: row.bank_account,
    accountName: row.account_name,
  };
}

export function shortRef(prefix) {
  return `${prefix}_${randomBytes(3).toString("hex")}`;
}

export async function getUser(phone) {
  const row = await db("wa_ramp_users").where({ phone }).first();
  return mapUser(row);
}

export async function upsertUser(phone, patch) {
  const existing = await db("wa_ramp_users").where({ phone }).first();
  const data = {
    phone,
    wallet: patch.wallet ?? existing?.wallet ?? null,
    bank_name: patch.bankName ?? existing?.bank_name ?? null,
    bank_account: patch.bankAccount ?? existing?.bank_account ?? null,
    account_name: patch.accountName ?? existing?.account_name ?? null,
    updated_at: db.fn.now(),
  };
  if (existing) {
    await db("wa_ramp_users").where({ phone }).update(data);
  } else {
    await db("wa_ramp_users").insert({ ...data, created_at: db.fn.now() });
  }
  return getUser(phone);
}

export async function listOpenOrders() {
  const rows = await db("wa_ramp_orders").whereIn("status", OPEN).orderBy("id", "desc");
  return rows.map(mapOrder);
}

export async function findOrder(ref) {
  const row = await db("wa_ramp_orders").whereRaw("LOWER(ref) = ?", [String(ref).toLowerCase()]).first();
  return mapOrder(row);
}

export async function findOpenOrderForPhone(phone) {
  const row = await db("wa_ramp_orders")
    .where({ phone })
    .whereIn("status", OPEN)
    .orderBy("id", "desc")
    .first();
  return mapOrder(row);
}

export async function createOrder(order) {
  await db("wa_ramp_orders").insert({
    ref: order.ref,
    type: order.type,
    phone: order.phone,
    amount_usdc: order.amountUsdc,
    amount_ngn: order.amountNgn,
    rate: order.rate,
    status: order.status,
    deposit_address: order.depositAddress || null,
    wallet: order.wallet || null,
    payout_bank_name: order.payoutBank?.bankName || null,
    payout_bank_account: order.payoutBank?.accountNumber || null,
    payout_account_name: order.payoutBank?.accountName || null,
    tx_hash: order.txHash || null,
    expires_at: order.expiresAt || null,
    created_at: db.fn.now(),
    updated_at: db.fn.now(),
  });
  return findOrder(order.ref);
}

export async function updateOrder(ref, patch) {
  const data = { updated_at: db.fn.now() };
  if (patch.status != null) data.status = patch.status;
  if (patch.txHash != null) data.tx_hash = patch.txHash;
  await db("wa_ramp_orders").whereRaw("LOWER(ref) = ?", [String(ref).toLowerCase()]).update(data);
  return findOrder(ref);
}

export async function expireStaleOrders(ttlMinutes) {
  const cutoff = new Date(Date.now() - ttlMinutes * 60_000);
  await db("wa_ramp_orders")
    .whereIn("status", ["awaiting_crypto", "awaiting_ngn"])
    .andWhere("created_at", "<", cutoff)
    .update({ status: "expired", updated_at: db.fn.now() });
}
