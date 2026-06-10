'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAccount } from 'wagmi';
import { getProfile, setProfile as saveProfile, mergeLocalProfilesForAddresses, type ProfileData } from '@/lib/profile-storage';

type ProfileContextValue = {
  profile: ProfileData | null;
  setAvatar: (avatar: string | null) => void;
  setDisplayName: (name: string | null) => void;
  setBio: (bio: string | null) => void;
  setProfile: (data: Partial<Pick<ProfileData, 'avatar' | 'displayName' | 'bio'>>) => void;
  avatarUrl: string | null; // convenience: profile?.avatar ?? null
};

const defaultProfile: ProfileData = {
  avatar: null,
  displayName: null,
  bio: null,
  updatedAt: 0,
};

const defaultContextValue: ProfileContextValue = {
  profile: null,
  setAvatar: () => {},
  setDisplayName: () => {},
  setBio: () => {},
  setProfile: () => {},
  avatarUrl: null,
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const [profile, setProfileState] = useState<ProfileData | null>(null);

  useEffect(() => {
    if (!address) {
      setProfileState(null);
      return;
    }
    setProfileState(getProfile(address) ?? defaultProfile);
  }, [address]);

  const setProfile = useCallback(
    (data: Partial<Pick<ProfileData, 'avatar' | 'displayName' | 'bio'>>) => {
      if (!address) return;
      saveProfile(address, data);
      setProfileState((prev) => {
        const next = prev ?? { ...defaultProfile };
        return {
          ...next,
          ...data,
          updatedAt: Date.now(),
        };
      });
    },
    [address]
  );

  const setAvatar = useCallback(
    (avatar: string | null) => setProfile({ avatar }),
    [setProfile]
  );
  const setDisplayName = useCallback(
    (displayName: string | null) => setProfile({ displayName }),
    [setProfile]
  );
  const setBio = useCallback(
    (bio: string | null) => setProfile({ bio }),
    [setProfile]
  );

  const value: ProfileContextValue = {
    profile,
    setAvatar,
    setDisplayName,
    setBio,
    setProfile,
    avatarUrl: profile?.avatar ?? null,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

/** Safe hook: returns default (no-op setters, null profile) when outside ProfileProvider. */
export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  return ctx ?? defaultContextValue;
}

export function useProfileAvatar(): string | null {
  const ctx = useContext(ProfileContext);
  return ctx?.avatarUrl ?? null;
}

/**
 * Loads/saves the locally-stored profile data keyed by a specific address.
 * This is useful on `/profile` where "profile owner" (linked wallet) can differ from the connected wallet (smart wallet).
 */
export type UseProfileForAddressOptions = {
  /** Also read these localStorage keys and merge missing avatar/displayName/bio (linked vs smart vs guest address). */
  readFallbackAddresses?: (string | null | undefined)[];
};

export function useProfileForAddress(
  profileAddress: string | undefined | null,
  options?: UseProfileForAddressOptions
): ProfileContextValue {
  const address = profileAddress ?? undefined;
  const [profile, setProfileState] = useState<ProfileData | null>(null);
  const fallbackKey = JSON.stringify(options?.readFallbackAddresses ?? []);

  useEffect(() => {
    if (!address) {
      setProfileState(null);
      return;
    }
    const extras = options?.readFallbackAddresses ?? [];
    if (extras.length) {
      setProfileState(mergeLocalProfilesForAddresses(address, extras));
    } else {
      setProfileState(getProfile(address) ?? defaultProfile);
    }
  }, [address, fallbackKey]);

  const setProfile = useCallback(
    (data: Partial<Pick<ProfileData, 'avatar' | 'displayName' | 'bio'>>) => {
      if (!address) return;
      saveProfile(address, data);
      setProfileState((prev) => {
        const next = prev ?? { ...defaultProfile };
        return {
          ...next,
          ...data,
          updatedAt: Date.now(),
        };
      });
    },
    [address]
  );

  const setAvatar = useCallback((avatar: string | null) => setProfile({ avatar }), [setProfile]);
  const setDisplayName = useCallback((displayName: string | null) => setProfile({ displayName }), [setProfile]);
  const setBio = useCallback((bio: string | null) => setProfile({ bio }), [setProfile]);

  return {
    profile,
    setAvatar,
    setDisplayName,
    setBio,
    setProfile,
    avatarUrl: profile?.avatar ?? null,
  };
}
