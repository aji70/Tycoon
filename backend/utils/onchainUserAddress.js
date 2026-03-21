/**
 * Resolve which EVM address backend-signed flows should use (linked wallet, smart wallet, primary, or Privy placeholder).
 * Must stay aligned with guestAuthController.placeholderAddressForPrivyDid.
 */
import crypto from "crypto";

export function isValidEthAddress(maybe) {
  return typeof maybe === "string" && /^0x[a-fA-F0-9]{40}$/.test(maybe.trim());
}

export function placeholderAddressForPrivyDid(privyDid) {
  const id = privyDid && String(privyDid).trim();
  if (!id) return null;
  const hash = crypto.createHash("sha256").update(id).digest("hex").slice(0, 40);
  return `0x${hash}`;
}

export function getOnchainAddressForUser(user) {
  const linked = user?.linked_wallet_address;
  if (isValidEthAddress(linked)) return linked.trim();

  const smart = user?.smart_wallet_address;
  if (isValidEthAddress(smart)) return smart.trim();

  const primary = user?.address;
  if (isValidEthAddress(primary)) return primary.trim();

  return null;
}

/** Prefer real wallets; else deterministic placeholder from privy_did (guest / Privy-only). */
export function getOnchainAddressForGuestFlow(user) {
  const fromWallets = getOnchainAddressForUser(user);
  if (fromWallets) return fromWallets;
  if (user?.privy_did) return placeholderAddressForPrivyDid(user.privy_did);
  return null;
}
