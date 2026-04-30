import axios, { AxiosError } from "axios";
import { API_BASE_URL, ApiError } from "@/lib/api";

const secret =
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_TYCOON_ADMIN_SECRET?.trim() : undefined;

/**
 * Axios client for /api/admin/* — sends x-tycoon-admin-secret when NEXT_PUBLIC_TYCOON_ADMIN_SECRET is set.
 */
export const adminApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    ...(secret ? { "x-tycoon-admin-secret": secret } : {}),
  },
  timeout: 20000,
});

adminApi.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; error?: string }>) => {
    if (error.response) {
      const { status, data } = error.response;
      const message = data?.message || data?.error || "Admin API request failed";
      return Promise.reject(new ApiError(status, message, data, error.response));
    }
    return Promise.reject(new ApiError(0, error.message || "No response from server"));
  }
);

export function isAdminSecretConfigured(): boolean {
  return Boolean(secret);
}
