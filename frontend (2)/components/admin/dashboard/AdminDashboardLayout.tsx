"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Wallet, User, ChevronDown } from "lucide-react";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { useChainId } from "wagmi";
import { ADMIN_NAV_ITEMS } from "./adminNav";
import AdminGlobalSearch from "./AdminGlobalSearch";
import AdminDashboardAlerts from "./AdminDashboardAlerts";
import { adminApi, isAdminSecretConfigured } from "@/lib/adminApi";

function shortAddr(addr: string | undefined) {
  if (!addr) return "";
  if (addr.length < 14) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

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

type NotifItem = {
  id: string;
  kind: string;
  title: string;
  subtitle?: string | null;
  href: string;
  createdAt: string;
};

type NotifPayload = {
  badgeCount: number;
  items: NotifItem[];
};

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const secretOk = isAdminSecretConfigured();
  const router = useRouter();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const chainId = useChainId();
  const notifWrap = useRef<HTMLDivElement>(null);
  const profileWrap = useRef<HTMLDivElement>(null);

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifData, setNotifData] = useState<NotifPayload | null>(null);

  const loadNotifs = useCallback(() => {
    adminApi
      .get<{ success: boolean; data?: NotifPayload }>("admin/notifications")
      .then((r) => {
        if (r.data?.success && r.data.data) setNotifData(r.data.data);
      })
      .catch(() => setNotifData(null));
  }, []);

  useEffect(() => {
    loadNotifs();
  }, [loadNotifs]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (notifWrap.current && !notifWrap.current.contains(t)) setNotifOpen(false);
      if (profileWrap.current && !profileWrap.current.contains(t)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function signOut() {
    try {
      window.localStorage.removeItem("token");
    } catch {
      /* ignore */
    }
    setProfileOpen(false);
    router.push("/");
    router.refresh();
  }

  const badge = notifData && notifData.badgeCount > 0 ? Math.min(99, notifData.badgeCount) : 0;

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

        <div className="flex-1 max-w-md mx-2 min-w-0 hidden sm:flex justify-center">
          <AdminGlobalSearch />
        </div>

        <div className="flex items-center gap-1 sm:gap-2 ml-auto">
          <div className="relative" ref={notifWrap}>
            <button
              type="button"
              onClick={() => {
                setNotifOpen((o) => !o);
                if (!notifOpen) loadNotifs();
              }}
              className="relative p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              title="Notifications"
              aria-label="Notifications"
              aria-expanded={notifOpen}
            >
              <Bell className="w-5 h-5" />
              {badge > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-0.5 rounded-full bg-amber-600 text-[10px] font-bold text-white flex items-center justify-center">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 max-h-[min(70vh,360px)] overflow-y-auto rounded-xl border border-slate-700 bg-[#0d1416] shadow-xl z-50 py-2">
                <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Digest</p>
                {!notifData && <p className="px-3 py-2 text-sm text-slate-500">Loading…</p>}
                {notifData && notifData.items.length === 0 && (
                  <p className="px-3 py-2 text-sm text-slate-500">Nothing flagged right now.</p>
                )}
                {notifData &&
                  notifData.items.map((it) => (
                    <Link
                      key={it.id}
                      href={it.href}
                      className="block px-3 py-2 text-sm hover:bg-slate-800/80 border-b border-slate-800/60 last:border-0"
                      onClick={() => setNotifOpen(false)}
                    >
                      <span className="text-slate-200">{it.title}</span>
                      {it.subtitle && <span className="block text-xs text-slate-500 mt-0.5">{it.subtitle}</span>}
                      <span className="block text-[10px] text-slate-600 mt-1">{String(it.createdAt).slice(0, 19)}</span>
                    </Link>
                  ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-300 max-w-[min(100vw-8rem,200px)] sm:max-w-none">
            <Wallet className="w-3.5 h-3.5 shrink-0 text-slate-500" />
            {isConnected ? (
              <button
                type="button"
                onClick={() => open()}
                className="truncate max-w-[140px] text-left text-cyan-200/95 hover:underline"
                title="Wallet connected — click to open wallet menu"
              >
                {shortAddr(address)}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => open()}
                className="text-cyan-300 hover:text-cyan-200 font-medium"
                title="Connect wallet (same as main site — needed for Celo txs in admin)"
              >
                Connect wallet
              </button>
            )}
            {isConnected && chainId ? (
              <span className="text-[10px] text-slate-500 tabular-nums shrink-0 border-l border-slate-700 pl-1.5 ml-0.5">
                {chainId}
              </span>
            ) : null}
          </div>

          <Link
            href="/admin/wallet-monitor"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-300 hover:border-cyan-800 hover:text-cyan-200 transition-colors"
          >
            <Wallet className="w-3.5 h-3.5" />
            Wallet monitor
          </Link>

          <div className="relative border-l border-slate-700 pl-2 ml-1" ref={profileWrap}>
            <button
              type="button"
              onClick={() => setProfileOpen((o) => !o)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              aria-expanded={profileOpen}
              aria-label="Session menu"
            >
              <User className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline max-w-[100px] truncate">Session</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
            </button>
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-700 bg-[#0d1416] shadow-xl z-50 py-1">
                <Link
                  href="/admin"
                  className="block px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/80"
                  onClick={() => setProfileOpen(false)}
                >
                  Admin home
                </Link>
                <Link
                  href="/"
                  className="block px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/80"
                  onClick={() => setProfileOpen(false)}
                >
                  Player site
                </Link>
                <button
                  type="button"
                  onClick={signOut}
                  className="w-full text-left px-3 py-2 text-sm text-amber-200/90 hover:bg-slate-800/80"
                >
                  Clear JWT & leave admin
                </button>
              </div>
            )}
          </div>
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
          <AdminDashboardAlerts />
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
