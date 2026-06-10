import { ApiResponse } from "@/types/api";
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

/** Arena start-game & on-chain lobby start: many sequential txs; default 15s client timeout aborts first. */
export const ONCHAIN_BATCH_REQUEST_TIMEOUT_MS = 240000;

export class ApiError extends Error {
  /** Axios response so getContractErrorMessage can read response.data.message */
  response?: { status?: number; data?: { message?: string; error?: string } };
  constructor(public status: number, message: string, public data?: any, response?: { status?: number; data?: any }) {
    super(message);
    this.name = "ApiError";
    this.response = response ?? (data && { status, data });
  }
}

/** Public API base (includes `/api`). Used by axios and ERC-8004 agent URI. */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://base-monopoly-production.up.railway.app/api";

class ApiClient {
  private axiosInstance: AxiosInstance;

  constructor(baseURL: string) {
    this.axiosInstance = axios.create({
      baseURL,
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });

    this.axiosInstance.interceptors.request.use(
      (config) => {
        try {
          if (typeof window !== "undefined" && window.localStorage) {
            const token = window.localStorage.getItem("token");
            if (token) {
              config.headers.Authorization = `Bearer ${token}`;
            }
          }
        } catch {
          // localStorage can throw on mobile (private mode, quota, iframe)
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          const { status, data } = error.response;
          const message = data?.message || data?.error || "API request failed";
          const apiError = new ApiError(status, message, data, error.response);
          return Promise.reject(apiError);
        } else if (error.request) {
          const ax = error as AxiosError;
          const isTimeout =
            ax.code === "ECONNABORTED" ||
            (typeof ax.message === "string" && ax.message.toLowerCase().includes("timeout"));
          return Promise.reject(
            new ApiError(
              0,
              isTimeout
                ? "Request timed out. On-chain setup can take 1–3 minutes — wait and try again, or use Agent Battles (lobby) for a two-step flow."
                : "No response from server"
            )
          );
        } else {
          return Promise.reject(new ApiError(0, error.message));
        }
      }
    );
  }

  private async request<T>(
    config: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response: AxiosResponse = await this.axiosInstance.request(config);
    const data = response.data;

    return {
      success: true,
      message: data?.message || "Request successful",
      data: data,
    };
  }

  async get<T>(endpoint: string, params?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ method: "GET", url: endpoint, params, ...config });
  }

  async post<T>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: "POST", url: endpoint, data });
  }

  async put<T>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: "PUT", url: endpoint, data });
  }

  async patch<T>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: "PATCH", url: endpoint, data });
  }

  async delete<T>(endpoint: string, params?: any): Promise<ApiResponse<T>> {
    return this.request<T>({ method: "DELETE", url: endpoint, params });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
