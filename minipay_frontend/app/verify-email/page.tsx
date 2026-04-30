"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const auth = useGuestAuthOptional();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!token || !auth?.verifyEmail) {
      if (!token) {
        setStatus("error");
        setMessage("Missing verification token");
      }
      return;
    }
    setStatus("loading");
    auth
      .verifyEmail(token)
      .then((res) => {
        if (res.success) {
          setStatus("success");
          setMessage("Email verified. You can now log in with email.");
        } else {
          setStatus("error");
          setMessage(res.message ?? "Verification failed");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Verification failed");
      });
  }, [token, auth?.verifyEmail]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#010F10] to-[#0E1415] text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-[#0E282A] bg-[#011112]/80 p-8 text-center">
        {status === "idle" && !token && (
          <>
            <p className="text-white/70">No verification token provided.</p>
            <Link href="/" className="mt-4 inline-block text-cyan-400 hover:underline">Go home</Link>
          </>
        )}
        {status === "loading" && (
          <>
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
            <p className="text-white/80">Verifying your email...</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-white mb-2">Email verified</h1>
            <p className="text-white/70 mb-6">{message}</p>
            <Link
              href="/profile"
              className="inline-block px-4 py-2 rounded-xl bg-cyan-500/25 border border-cyan-500/50 text-cyan-300 font-medium hover:bg-cyan-500/35"
            >
              Go to profile
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-white mb-2">Verification failed</h1>
            <p className="text-white/70 mb-6">{message}</p>
            <Link href="/" className="text-cyan-400 hover:underline">Go home</Link>
          </>
        )}
      </div>
    </div>
  );
}
