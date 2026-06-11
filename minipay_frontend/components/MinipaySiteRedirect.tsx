"use client";

import { useEffect } from "react";
import { isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";
import { isMinipayOnlyHost, MAIN_TYCOON_SITE_URL } from "@/lib/minipaySiteRedirect";

/** Client-side fallback if the inline redirect script did not run. */
export default function MinipaySiteRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const host = window.location.hostname.toLowerCase();
    if (!isMinipayOnlyHost(host)) return;
    if (host === "localhost" || host === "127.0.0.1") return;
    if (/[?&]stay=1(?:&|$)/.test(window.location.search)) return;
    if (isMiniPayEmbeddedWallet()) return;

    const dest =
      MAIN_TYCOON_SITE_URL +
      window.location.pathname +
      window.location.search +
      window.location.hash;
    window.location.replace(dest);
  }, []);

  return null;
}
