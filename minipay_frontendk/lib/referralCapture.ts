/** Session key for `?ref=` until Privy backend sync succeeds. */
export const PENDING_REFERRAL_STORAGE_KEY = "tycoon_pending_referral_code";

export function captureReferralFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref")?.trim().toLowerCase();
    if (ref && /^[a-z0-9]+$/.test(ref) && ref.length >= 2 && ref.length <= 32) {
      sessionStorage.setItem(PENDING_REFERRAL_STORAGE_KEY, ref);
    }
  } catch {
    // sessionStorage unavailable
  }
}

export function clearPendingReferralCode(): void {
  try {
    sessionStorage.removeItem(PENDING_REFERRAL_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function peekPendingReferralCode(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const v = sessionStorage.getItem(PENDING_REFERRAL_STORAGE_KEY)?.trim().toLowerCase();
    return v || undefined;
  } catch {
    return undefined;
  }
}
