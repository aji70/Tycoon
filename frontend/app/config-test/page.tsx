"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

type ConfigTest = {
  CELO_RPC_URL: string | null;
  TYCOON_CELO_CONTRACT_ADDRESS: string | null;
  BACKEND_GAME_CONTROLLER_PRIVATE_KEY: string | null;
};

export default function ConfigTestPage() {
  const [data, setData] = useState<ConfigTest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<ConfigTest & { isConfigured?: boolean }>("config/test");
        if (!cancelled && res.data) {
          const d = res.data as ConfigTest & { isConfigured?: boolean };
          setData({
            CELO_RPC_URL: d.CELO_RPC_URL ?? null,
            TYCOON_CELO_CONTRACT_ADDRESS: d.TYCOON_CELO_CONTRACT_ADDRESS ?? null,
            BACKEND_GAME_CONTROLLER_PRIVATE_KEY: d.BACKEND_GAME_CONTROLLER_PRIVATE_KEY ?? null,
          });
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to fetch");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen w-full bg-[#010F10] p-6 text-white">
        <p>Loading...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen w-full bg-[#010F10] p-6 text-white">
        <p className="text-red-400">{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-[#010F10] p-6 text-white max-w-2xl">
      <div className="space-y-4">
        <div>
          <span className="text-gray-400 block text-sm mb-1">CELO_RPC_URL</span>
          <code className="block bg-black/30 px-3 py-2 rounded break-all">
            {data?.CELO_RPC_URL ?? "(not set)"}
          </code>
        </div>
        <div>
          <span className="text-gray-400 block text-sm mb-1">TYCOON_CELO_CONTRACT_ADDRESS</span>
          <code className="block bg-black/30 px-3 py-2 rounded break-all">
            {data?.TYCOON_CELO_CONTRACT_ADDRESS ?? "(not set)"}
          </code>
        </div>
        <div>
          <span className="text-gray-400 block text-sm mb-1">BACKEND_GAME_CONTROLLER_PRIVATE_KEY</span>
          <code className="block bg-black/30 px-3 py-2 rounded break-all">
            {data?.BACKEND_GAME_CONTROLLER_PRIVATE_KEY ?? "(not set)"}
          </code>
        </div>
      </div>
    </main>
  );
}
