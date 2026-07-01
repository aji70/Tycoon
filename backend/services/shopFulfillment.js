import { promoAddressSetFromUser } from "./minipayPerkPromo.js";

const ZERO = "0x0000000000000000000000000000000000000000";

export function normalizeEthAddress(value) {
  const s = String(value || "").trim();
  return /^0x[a-fA-F0-9]{40}$/.test(s) ? s : null;
}

/**
 * Where MiniPay shop perks should be delivered after Naira checkout or promos.
 * Prefer the wallet the player is actively using (connected address), then primary, then linked.
 * Smart wallet is excluded — MiniPay buys are paid from the connected EOA.
 */
export function resolveMinipayShopDeliveryAddress(user, preferredAddress) {
  if (!user) return null;

  const preferred = normalizeEthAddress(preferredAddress);
  if (preferred) {
    const allowed = promoAddressSetFromUser(user);
    if (allowed.has(preferred.toLowerCase())) return preferred;
  }

  const primary = normalizeEthAddress(user.address);
  if (primary && primary.toLowerCase() !== ZERO) return primary;

  const linked = normalizeEthAddress(user.linked_wallet_address);
  if (linked) return linked;

  return preferred;
}
