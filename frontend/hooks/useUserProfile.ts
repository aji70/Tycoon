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

  // Fetch user from backend
  useEffect(() => {
    if (!address) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);

      const fetchUser = async () => {
        if (!address) {
          setUser(null);
          return;
        }
    
        try {
          const res = await apiClient.get<ApiResponse<UserType>>(`/users/by-address/${address}?chain=Base`);
    
          // Check if the response indicates success and has data
          if (res?.data?.success && res.data.data) {
            setUser(res.data.data);
            console.log("User fetched successfully:", res.data.data);
          } else {
            // Backend returned 404 or { success: false } → user doesn't exist yet
            console.log("User not found for address:", address);
            setUser(null); // or setUser("no user found") if you prefer a string
          }
        } catch (error: any) {
          // This catches network errors, 500s, etc.
          // But importantly: check if it's a 404 from your backend
          if (error?.response?.status === 404) {
            console.log("User not found (404):", address);
            setUser(null);
          } else {
            console.error("Unexpected error fetching user:", error);
            setUser(null);
          }
        }
      };

    fetchUser();
  }, [address]);

  // Register new user
  const register = async (username: string) => {
    if (!address) throw new Error("Wallet not connected");

    setRegistering(true);
    try {
      const res = await apiClient.post<ApiResponse<UserType>>("/users", {
        username: username.trim(),
        address,
        chain: "Base",
      });

      if (res?.data?.success && res.data.data) {
        setUser(res.data.data);
        return res.data.data;
      } else {
        throw new Error(res?.data?.message || "Registration failed");
      }
    } catch (error: any) {
      throw error;
    } finally {
      setRegistering(false);
    }
  };

  return {
    user,
    loading: loading || isConnecting,
    registering,
    register,
    isRegistered: !!user,
    address,
  };
};