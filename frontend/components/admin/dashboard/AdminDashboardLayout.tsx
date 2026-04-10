"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bell, Search, Wallet } from "lucide-react";
import { ADMIN_NAV_ITEMS } from "./adminNav";
import { isAdminSecretConfigured } from "@/lib/adminApi";

function NavLink({ href, label, exact }: { href: string; label: string; exact?: boolean }) {
  const pathname = usePathname();
  const path = pathname?.split("?")[0] ?? "";
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-cyan-950/80 text-cyan-300 border border-cyan-800/60"
          : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent"
      }`}
    >
      {label}
    </Link>
  );
}

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const secretOk = isAdminSecretConfigured();

  return (
    <div className="flex min-h-dvh flex-col bg-[#080c0d] text-slate-100">
      {!secretOk && (
        <div
          className="shrink-0 border-b border-amber-900/50 bg-amber-950/40 px-4 py-2 text-center text-amber-200/95 text-xs sm:text-sm"
          role="status"
        >
          Set <code className="text-amber-100/90">NEXT_PUBLIC_TYCOON_ADMIN_SECRET</code> in the frontend env and{" "}
          <code className="text-amber-100/90">TYCOON_ADMIN_SECRET</code> on the backend (same value) so admin API calls
          are authorized in production.
        </div>
      )}

      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-800/80 bg-[#0a1011] px-3 sm:px-4">
        <Link href="/" className="flex items-center gap-2 shrink-0 text-slate-200 hover:text-white transition-colors">
          <Image src="/icon.png" alt="" width={32} height={32} className="rounded-md" />
          <span className="font-semibold text-sm hidden sm:inline">Tycoon</span>
          <span className="text-cyan-500/90 text-xs font-medium uppercase tracking-wider hidden sm:inline">Admin</span>
        </Link>

        <div className="flex-1 max-w-md mx-2 hidden md:block">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" aria-hidden />
            <input
              type="search"
              placeholder="Search players, rooms… (soon)"
              disabled
              className="w-full rounded-lg bg-slate-900/80 border border-slate-700/80 pl-9 pr-3 py-1.5 text-sm text-slate-400 placeholder:text-slate-600 cursor-not-allowed"
              aria-label="Admin search (coming soon)"
            />
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 ml-auto">
          <button
            type="button"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-300 cursor-not-allowed"
            disabled
            title="Notifications (soon)"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
          </button>
          <Link
            href="/admin/wallet-monitor"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-300 hover:border-cyan-800 hover:text-cyan-200 transition-colors"
          >
            <Wallet className="w-3.5 h-3.5" />
            Wallet monitor
          </Link>
          <span className="text-xs text-slate-500 px-2 border-l border-slate-700 ml-1">Dashboard</span>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-52 shrink-0 border-r border-slate-800/80 bg-[#0a1011] p-3 overflow-y-auto hidden sm:block">
          <nav className="space-y-0.5" aria-label="Admin">
            {ADMIN_NAV_ITEMS.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} exact={item.exact === true} />
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6">{children}</main>

        <aside
          className="w-72 shrink-0 border-l border-slate-800/80 bg-[#0a1011] p-4 overflow-y-auto hidden xl:block"
          aria-label="Alerts"
        >
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Alerts</h2>
          <ul className="space-y-4 text-sm text-slate-500">
            <li>
              <p className="text-slate-400 font-medium mb-1">Flagged players</p>
              <p className="text-xs">No moderation pipeline wired yet.</p>
            </li>
            <li>
              <p className="text-slate-400 font-medium mb-1">Suspicious wallets</p>
              <p className="text-xs">Connect fraud rules in a later step.</p>
            </li>
            <li>
              <p className="text-slate-400 font-medium mb-1">Game errors</p>
              <p className="text-xs">Hook to analytics / Sentry events next.</p>
            </li>
          </ul>
        </aside>
      </div>

      <nav
        className="sm:hidden flex gap-1 overflow-x-auto border-t border-slate-800 bg-[#0a1011] px-2 py-2"
        aria-label="Admin sections"
      >
        {ADMIN_NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-400 bg-slate-900/80 border border-slate-800"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
