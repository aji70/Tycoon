"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import toast from "react-hot-toast";

/** Handles legacy /verify-email?token= links (redirected to /profile). */
export default function VerifyEmailFromQuery() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const auth = useGuestAuthOptional();
  const ranRef = useRef(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token || ranRef.current || !auth?.verifyEmail) return;
    ranRef.current = true;

    auth
      .verifyEmail(token)
      .then((res) => {
        if (res.success) {
          toast.success("Email verified. You can now log in with email.");
        } else {
          toast.error(res.message ?? "Verification failed");
        }
      })
      .catch(() => {
        toast.error("Verification failed");
      })
      .finally(() => {
        setDone(true);
        const url = new URL(window.location.href);
        url.searchParams.delete("token");
        router.replace(url.pathname + (url.search || ""));
      });
  }, [searchParams, auth?.verifyEmail, router]);

  if (!searchParams.get("token") || done) return null;

  return (
    <p className="text-center text-cyan-300/90 text-sm py-2" role="status">
      Verifying your email…
    </p>
  );
}
