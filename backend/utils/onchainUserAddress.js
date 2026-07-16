/**
 * Resolve which EVM address backend-signed flows should use (linked wallet, smart wallet, primary, or social-auth placeholder).
 * Must stay aligned with guestAuthController placeholder helpers.
 */
import crypto from "crypto";

export function isValidEthAddress(maybe) {
  return typeof maybe === "string" && /^0x[a-fA-F0-9]{40}$/.test(maybe.trim());
}

/** Deterministic placeholder from any stable social-auth id (Privy DID or Web3Auth id). */
export function placeholderAddressForAuthId(authId) {
  const id = authId && String(authId).trim();
  if (!id) return null;
  const hash = crypto.createHash("sha256").update(id).digest("hex").slice(0, 40);
  return `0x${hash}`;
}

/** @deprecated Prefer placeholderAddressForAuthId — kept for call-site compatibility. */
export function placeholderAddressForPrivyDid(privyDid) {
  return placeholderAddressForAuthId(privyDid);
}

/** Stable social login id on the user row (Web3Auth preferred, then Privy). */
export function getSocialAuthId(user) {
  const w3a = user?.web3auth_id && String(user.web3auth_id).trim();
  if (w3a) return w3a;
  const privy = user?.privy_did && String(user.privy_did).trim();
  if (privy) return privy;
  return null;
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

/** Prefer real wallets; else deterministic placeholder from web3auth_id / privy_did. */
export function getOnchainAddressForGuestFlow(user) {
  const fromWallets = getOnchainAddressForUser(user);
  if (fromWallets) return fromWallets;
  const socialId = getSocialAuthId(user);
  if (socialId) return placeholderAddressForAuthId(socialId);
  return null;
}
