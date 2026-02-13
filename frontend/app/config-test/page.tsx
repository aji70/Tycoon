"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiClient, ApiError } from "@/lib/api";

type ConfigTest = {
  rpcUrl: string | null;
  pk: string | null;
  isConfigured: boolean;
};

export default function ConfigTestPage() {
  const [data, setData] = useState<ConfigTest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<ConfigTest>("config/test");
        if (!cancelled && res.data) setData(res.data as ConfigTest);
        if (!cancelled) setStatusCode(200);
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Failed to fetch config";
          setError(msg);
          if (e instanceof ApiError && e.status) setStatusCode(e.status);
        }
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
        <h1 className="text-xl font-semibold mb-4">Config test</h1>
        <p>Loading...</p>
      </main>
    );
  }

  if (statusCode === 401) {
    return (
      <main className="min-h-screen w-full bg-[#010F10] p-6 text-white">
        <h1 className="text-xl font-semibold mb-4">Config test</h1>
        <p className="text-amber-400 mb-4">Please log in to view this page.</p>
        <Link href="/" className="text-cyan-400 hover:underline">Go home</Link>
      </main>
    );
  }

  if (statusCode === 403) {
    return (
      <main className="min-h-screen w-full bg-[#010F10] p-6 text-white">
        <h1 className="text-xl font-semibold mb-4">Config test</h1>
        <p className="text-amber-400">Only the configured owner can view this page.</p>
        <p className="text-gray-500 text-sm mt-2">Set CONFIG_TEST_OWNER_ADDRESS in Railway to your wallet address (same as your logged-in account).</p>
        <Link href="/" className="inline-block mt-4 text-cyan-400 hover:underline">Go home</Link>
      </main>
    );
  }

  if (statusCode === 503 || error) {
    return (
      <main className="min-h-screen w-full bg-[#010F10] p-6 text-white">
        <h1 className="text-xl font-semibold mb-4">Config test</h1>
        <p className="text-red-400">{error ?? "Service unavailable"}</p>
        <Link href="/" className="inline-block mt-4 text-cyan-400 hover:underline">Go home</Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-[#010F10] p-6 text-white">
      <h1 className="text-xl font-semibold mb-4">Backend config test (live)</h1>
      <p className="text-gray-500 text-sm mb-4">Values read from production backend env (e.g. Railway).</p>
      <div className="space-y-4 max-w-2xl">
        <div>
          <span className="text-gray-400 block text-sm mb-1">RPC URL</span>
          <code className="block bg-black/30 px-3 py-2 rounded break-all">
            {data?.rpcUrl ?? "(not set)"}
          </code>
        </div>
        <div>
          <span className="text-gray-400 block text-sm mb-1">PK (redacted)</span>
          <code className="block bg-black/30 px-3 py-2 rounded break-all">
            {data?.pk ?? "(not set)"}
          </code>
        </div>
        <div>
          <span className="text-gray-400 block text-sm mb-1">Contract configured</span>
          <span className={data?.isConfigured ? "text-green-400" : "text-amber-400"}>
            {data?.isConfigured ? "Yes" : "No"}
          </span>
        </div>
      </div>
      <p className="mt-6 text-gray-500 text-sm">
        In development, call with ?full=1 to show full PK (backend only when NODE_ENV=development).
      </p>
    </main>
  );
}
