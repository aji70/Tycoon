"use client";

import { useEffect } from "react";

/**
 * Hide the SSR LCP shell once the interactive hero mounts.
 * Never call .remove() — that breaks React reconciliation (removeChild crashes on click).
 */
export function HeroShellDismiss() {
  useEffect(() => {
    const el = document.getElementById("hero-lcp-shell");
    if (!el) return;
    el.style.display = "none";
    el.style.pointerEvents = "none";
    el.setAttribute("aria-hidden", "true");
  }, []);
  return null;
}
