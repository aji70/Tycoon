// src/hooks/useUserProfile.ts
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { apiClient } from "@/lib/api";
import { User as UserType } from "@/lib/types/users";
import { ApiResponse } from "@/types/api";

export const useUserProfile = () => {
  const { address, isConnecting } = useAccount();

  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  // Reset everything when address changes or disconnects
  useEffect(() => {
    if (!address) {
      setUser(null);
      setLoading(false); // No need to load if not connected
      return;
    }

    // When address is present, start loading
    setLoading(true);

    let isActive = true;

    const fetchUser = async () => {
      try {
        const res = await apiClient.get<ApiResponse<UserType>>(
          `/users/by-address/${address}?chain=Base`
        );

        if (!isActive) return;

        if (res.success && res.data) {
            const r = res.data as UserType;
          setUser(r);
        } else {
          setUser(null);
        }
      } catch (error: any) {
        if (!isActive) return;

        if (error?.response?.status === 404) {
          setUser(null);
        } else {
          console.error("Unexpected error fetching user:", error);
          setUser(null);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    fetchUser();

    return () => {
      isActive = false;
    };
  }, [address]);

  // Register new user
  const register = async (username: string): Promise<UserType> => {
    if (!address) {
      throw new Error("Wallet not connected");
    }

    if (!username.trim()) {
      throw new Error("Username is required");
    }

    setRegistering(true);

    try {
      const res = await apiClient.post<ApiResponse<UserType>>("/users", {
        username: username.trim(),
        address,
        chain: "Base",
      });

      if (res.success && res.data) {
        const r = res.data as UserType;
        setUser(r);
        return r;
      } else {
        throw new Error(res.message || "Registration failed");
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      throw error instanceof Error ? error : new Error("Registration failed");
    } finally {
      setRegistering(false);
    }
  };

  return {
    user,
    loading: isConnecting || loading,
    registering,
    register,
    isRegistered: !!user,
    address,
  };
};