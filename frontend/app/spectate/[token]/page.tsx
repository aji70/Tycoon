"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";

type SpectateRes = {
  success?: boolean;
  redirect_url?: string | null;
  game_code?: string | null;
  match_status?: string;
  message?: string;
};

export default function SpectateRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const token = String(params?.token ?? "").trim();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid link");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get<SpectateRes>(`/tournaments/spectate/${encodeURIComponent(token)}`);
        const data = res.data;
        if (cancelled) return;
        if (data?.redirect_url) {
          router.replace(data.redirect_url);
          return;
        }
        setError(data?.message ?? "Match not ready for spectating yet");
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
          (e as Error)?.message ||
          "Failed to load";
        if (!cancelled) setError(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (!token) {
    return (
      <div className="min-h-screen bg-[#010F10] text-white flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-red-400">Invalid spectator link.</p>
        <Link href="/tournaments" className="text-cyan-400 hover:underline">
          Tournaments
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#010F10] text-white flex flex-col items-center justify-center gap-4 px-4">
      {!error ? (
        <>
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
          <p className="text-white/70 text-sm">Opening spectator view…</p>
        </>
      ) : (
        <>
          <p className="text-amber-400/90 text-center max-w-md">{error}</p>
          <Link href="/tournaments" className="text-cyan-400 hover:underline">
            Back to tournaments
          </Link>
        </>
      )}
    </div>
  );
}
