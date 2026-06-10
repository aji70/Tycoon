import type { GuestUser } from "@/context/GuestAuthContext";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type NairaBlockReason = "sign_in" | "smart_wallet" | "session_expired";

export type NairaEligibility =
  | { ok: true }
  | { ok: false; reason: NairaBlockReason };

export function getNairaEligibility(
  guestUser: GuestUser | null | undefined,
  sessionToken: string | null | undefined,
  /** Connected EOA (e.g. wagmi). When set, Naira init can use `requireAuthOrWallet` without Profile JWT. */
  connectedWalletAddress?: string | null | undefined
): NairaEligibility {
  const raw = String(connectedWalletAddress ?? "").trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(raw) && raw.toLowerCase() !== ZERO_ADDRESS) {
    return { ok: true };
  }
  if (!sessionToken?.trim()) {
    return { ok: false, reason: "sign_in" };
  }
  if (!guestUser) {
    return { ok: false, reason: "sign_in" };
  }
  const sw = String(guestUser.smart_wallet_address ?? "").trim().toLowerCase();
  if (!sw || sw === ZERO_ADDRESS) {
    return { ok: false, reason: "smart_wallet" };
  }
  return { ok: true };
}

export function nairaBlockedMessage(reason: NairaBlockReason): string {
  switch (reason) {
    case "sign_in":
      return "Connect your wallet or open Profile to sign in before paying with Naira.";
    case "smart_wallet":
      return "Create your smart wallet in Profile before paying with Naira.";
    case "session_expired":
      return "Your session expired. Sign in again from Profile.";
  }
}

export function nairaButtonLabel(reason: NairaBlockReason | null, priceLabel: string): string {
  if (reason === "sign_in") return "Connect wallet for Naira";
  if (reason === "smart_wallet") return "Set up wallet for Naira";
  return priceLabel;
}
