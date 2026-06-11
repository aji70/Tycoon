"use client";

import { useEffect, useState } from "react";

function readMatches(query: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => readMatches(query));

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
