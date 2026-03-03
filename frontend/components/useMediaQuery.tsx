// hooks/useMediaQuery.ts
"use client";

import { useEffect, useState } from "react";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const media = window.matchMedia(query);
      const listener = () => setMatches(media.matches);
      listener();
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    } catch {
      setMatches(false);
    }
  }, [query]);

  return matches;
}
