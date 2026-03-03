"use client";

import React, { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { Wallet, User } from "lucide-react";

/** Paths that do not require wallet or guest sign-in (user can access anonymously). */
const PUBLIC_PATHS = [
  "/",
  "/join-room",
  "/join-room-3d",
  "/verify-email",
  "/waitlist",
  "/rooms",
];

function isPublicPath(pathname: string): boolean {
  const path = pathname?.split("?")[0] ?? "";
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * Guard that ensures the user is either connected via wallet or signed in as guest
 * before allowing access to protected pages. Public paths (home, join-room, etc.) are always allowed.
 */
export default function AuthGuard({ children }: AuthGuardProps): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const { address } = useAccount();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const authLoading = guestAuth?.isLoading ?? true;

  const isPublic = isPublicPath(pathname ?? "");
  const isAuthenticated = !!address || !!guestUser;

  if (isPublic) {
    return <>{children}</>;
  }

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400">Checking sign-in…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-md w-full rounded-2xl border border-slate-600 bg-slate-900/90 p-8 text-center shadow-xl">
          <h2 className="text-xl font-bold text-slate-100 mb-2">
            Sign in to continue
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Connect your wallet or sign in as a guest to use this page.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition"
            >
              <Wallet className="w-5 h-5" />
              Go to home
            </button>
            <button
              type="button"
              onClick={() => router.push("/join-room")}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-500 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
            >
              <User className="w-5 h-5" />
              Join room / Guest sign-in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
