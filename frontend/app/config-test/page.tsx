"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

type ConfigTest = {
  CELO_RPC_URL: string | null;
  TYCOON_CELO_CONTRACT_ADDRESS: string | null;
  BACKEND_GAME_CONTROLLER_PRIVATE_KEY: string | null;
  connectionTest?: { ok: boolean; error?: string; blockNumber?: number; walletAddress?: string; balance?: string };
};

export default function ConfigTestPage() {
  const [data, setData] = useState<ConfigTest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<ConfigTest & { isConfigured?: boolean; connectionTest?: { ok: boolean; error?: string; blockNumber?: number; walletAddress?: string; balance?: string } }>("config/test", { params: { test_connection: "1" } });
        if (!cancelled && res.data) {
          const d = res.data as ConfigTest & { isConfigured?: boolean };
          setData({
            CELO_RPC_URL: d.CELO_RPC_URL ?? null,
            TYCOON_CELO_CONTRACT_ADDRESS: d.TYCOON_CELO_CONTRACT_ADDRESS ?? null,
            BACKEND_GAME_CONTROLLER_PRIVATE_KEY: d.BACKEND_GAME_CONTROLLER_PRIVATE_KEY ?? null,
            connectionTest: d.connectionTest,
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
        {data?.connectionTest && (
          <div className="border-t border-gray-700 pt-4 mt-4">
            <span className="text-gray-400 block text-sm mb-2">Connection test</span>
            {data.connectionTest.ok ? (
              <div className="space-y-1 text-green-400 text-sm">
                <p>OK — Block: {data.connectionTest.blockNumber}, Wallet: {data.connectionTest.walletAddress?.slice(0, 10)}...</p>
                <p>Balance: {data.connectionTest.balance} wei</p>
              </div>
            ) : (
              <p className="text-red-400 text-sm">{data.connectionTest.error}</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
