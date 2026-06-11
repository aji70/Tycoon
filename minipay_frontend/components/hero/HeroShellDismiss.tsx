"use client";

import { useEffect } from "react";

/** Removes the SSR LCP shell once the interactive hero has mounted. */
export function HeroShellDismiss() {
  useEffect(() => {
    document.getElementById("hero-lcp-shell")?.remove();
  }, []);
  return null;
}
