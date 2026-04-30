const STORAGE_KEY_PREFIX = 'tycoon_profile_';

export type ProfileData = {
  avatar: string | null; // data URL or null
  displayName: string | null;
  bio: string | null;
  updatedAt: number;
};

function storageKey(address: string): string {
  return `${STORAGE_KEY_PREFIX}${address.toLowerCase()}`;
}

export function getProfile(address: string | undefined): ProfileData | null {
  if (typeof window === 'undefined' || !address) return null;
  try {
    const raw = localStorage.getItem(storageKey(address));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProfileData;
    return {
      avatar: parsed.avatar ?? null,
      displayName: parsed.displayName ?? null,
      bio: parsed.bio ?? null,
      updatedAt: parsed.updatedAt ?? 0,
    };
  } catch {
    return null;
  }
}

const defaultProfileEmpty: ProfileData = {
  avatar: null,
  displayName: null,
  bio: null,
  updatedAt: 0,
};

/**
 * Merge localStorage profile rows across linked / smart / guest keys so avatars survive
 * when the canonical key changes (e.g. user linked a wallet after saving a photo on smart only).
 */
export function mergeLocalProfilesForAddresses(
  primaryAddress: string,
  additionalAddresses: (string | null | undefined)[]
): ProfileData {
  const primary = getProfile(primaryAddress) ?? { ...defaultProfileEmpty };
  const primaryLower = primaryAddress.trim().toLowerCase();
  let merged: ProfileData = { ...primary };
  for (const raw of additionalAddresses) {
    if (!raw || typeof raw !== 'string') continue;
    const a = raw.trim();
    if (!a || a.toLowerCase() === primaryLower) continue;
    const p = getProfile(a);
    if (!p) continue;
    merged = {
      avatar: merged.avatar || p.avatar || null,
      displayName: merged.displayName || p.displayName || null,
      bio: merged.bio || p.bio || null,
      updatedAt: Math.max(merged.updatedAt, p.updatedAt || 0),
    };
  }
  return merged;
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

/** Avatar / bio keyed under any of the guest account addresses (same order as `guestProfileStorageKey` priority). */
export function mergeProfilesFromGuestUser(guestUser: {
  linked_wallet_address?: string | null;
  smart_wallet_address?: string | null;
  address?: string;
}): ProfileData | null {
  const ordered: string[] = [];
  const push = (a: string | null | undefined) => {
    if (!a || typeof a !== 'string') return;
    const s = a.trim();
    if (!/^0x[a-fA-F0-9]{40}$/i.test(s) || s.toLowerCase() === ZERO_ADDR.toLowerCase()) return;
    const low = s.toLowerCase();
    if (ordered.some((x) => x.toLowerCase() === low)) return;
    ordered.push(s);
  };
  push(guestUser.linked_wallet_address);
  push(guestUser.smart_wallet_address);
  push(guestUser.address);
  if (ordered.length === 0) return null;
  const [first, ...rest] = ordered;
  return mergeLocalProfilesForAddresses(first, rest);
}

/** Same key as profile page `useProfileForAddress` for JWT / Privy users without wagmi. */
export function guestProfileStorageKey(guestUser: {
  address?: string;
  linked_wallet_address?: string | null;
  smart_wallet_address?: string | null;
}): string | null {
  const linked = guestUser.linked_wallet_address?.trim();
  if (linked && linked.toLowerCase() !== ZERO_ADDR && /^0x[a-fA-F0-9]{40}$/i.test(linked)) {
    return linked.toLowerCase();
  }
  const sw = guestUser.smart_wallet_address?.trim();
  if (sw && sw.toLowerCase() !== ZERO_ADDR && /^0x[a-fA-F0-9]{40}$/i.test(sw)) {
    return sw.toLowerCase();
  }
  const a = guestUser.address?.trim();
  if (a) return a.toLowerCase();
  return null;
}

export function setProfile(
  address: string | undefined,
  data: Partial<Pick<ProfileData, 'avatar' | 'displayName' | 'bio'>>
): void {
  if (typeof window === 'undefined' || !address) return;
  const key = storageKey(address);
  const existing = getProfile(address);
  const updated: ProfileData = {
    avatar: data.avatar !== undefined ? data.avatar : (existing?.avatar ?? null),
    displayName: data.displayName !== undefined ? data.displayName : (existing?.displayName ?? null),
    bio: data.bio !== undefined ? data.bio : (existing?.bio ?? null),
    updatedAt: Date.now(),
  };
  localStorage.setItem(key, JSON.stringify(updated));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tycoon-profile-updated', { detail: { address } }));
  }
}
