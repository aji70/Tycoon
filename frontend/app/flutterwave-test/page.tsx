"use client";

import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://base-monopoly-production.up.railway.app/api";

export default function FlutterwaveTestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTestPayment() {
    setError(null);
    setLoading(true);
    try {
      const callbackUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/flutterwave-test`
          : "";
      const res = await fetch(`${API_BASE}/shop/flutterwave/initialize-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 200, callback_url: callbackUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || `HTTP ${res.status}`);
        return;
      }
      if (data?.link) {
        window.location.href = data.link;
        return;
      }
      setError(data?.message || "No payment link returned");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold mb-2">Flutterwave test</h1>
      <p className="text-gray-400 mb-6">No login. Just test payment (N200).</p>
      <button
        onClick={handleTestPayment}
        disabled={loading}
        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg font-medium"
      >
        {loading ? "Starting…" : "Pay N200 (test)"}
      </button>
      {error && (
        <p className="mt-4 text-red-400 text-sm max-w-md text-center">
          {error}
        </p>
      )}
    </main>
  );
}
