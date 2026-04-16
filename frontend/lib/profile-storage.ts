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

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

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
