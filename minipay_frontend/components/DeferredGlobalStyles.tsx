"use client";

import { useEffect } from "react";

/**
 * Loads the full Tailwind bundle after first paint (non-render-blocking).
 * Critical shell styles live in styles/critical.css (sync in root layout).
 */
export default function DeferredGlobalStyles() {
  useEffect(() => {
    void import("@/styles/globals.css");
  }, []);

  return null;
}
