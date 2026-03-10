/**
 * Option B: "Use my API key" — remember key for this browser tab/session only.
 * Survives refresh; cleared when tab is closed. Not sent to server for storage.
 */

const STORAGE_KEY = "tycoon_my_agent_apikey";

export interface StoredAgentApiKey {
  provider: string;
  apiKey: string;
}

export function getStoredAgentApiKey(): StoredAgentApiKey | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as unknown;
    if (d && typeof d === "object" && "provider" in d && "apiKey" in d && typeof (d as StoredAgentApiKey).apiKey === "string") {
      return { provider: String((d as StoredAgentApiKey).provider), apiKey: (d as StoredAgentApiKey).apiKey };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function setStoredAgentApiKey(value: StoredAgentApiKey | null): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    if (value) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ provider: value.provider, apiKey: value.apiKey }));
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}
