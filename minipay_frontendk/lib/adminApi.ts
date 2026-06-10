import axios, { AxiosError } from "axios";
import { API_BASE_URL, ApiError } from "@/lib/api";

const ADMIN_TOKEN_STORAGE_KEY = "tycoon_admin_token";

/**
 * Axios client for /api/admin/*.
 * Sends Authorization: Bearer <token> when admin session token exists in localStorage.
 */
export const adminApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 20000,
});

adminApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
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

export type AdminLoginResponse = { success: boolean; data?: { token: string; expiresIn: string }; error?: string };

export async function adminLogin(username: string, password: string): Promise<void> {
  const { data } = await adminApi.post<AdminLoginResponse>("admin/auth/login", { username, password });
  if (!data?.success || !data?.data?.token) {
    throw new ApiError(401, data?.error || "Invalid admin credentials");
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, data.data.token);
  }
}

export function clearAdminSession(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  }
}

export function hasAdminSession(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY));
}
